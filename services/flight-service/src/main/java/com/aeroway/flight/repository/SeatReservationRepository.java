package com.aeroway.flight.repository;

import com.aeroway.flight.model.SeatReservation;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Implements reservation persistence with JdbcTemplate and PostgreSQL RETURNING clauses.
 * The active reservation uniqueness rule is enforced by the database schema, not by in-memory checks.
 */
@Repository
public class SeatReservationRepository {

    private final JdbcTemplate jdbcTemplate;

    public SeatReservationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public SeatReservation create(
            UUID flightId,
            UUID seatId,
            String customerName,
            String customerEmail,
            String documentNumber,
            String passengerType
    ) {
        // Inserts a confirmed reservation directly; duplicate active seats surface as DuplicateKeyException.
        UUID reservationId = jdbcTemplate.queryForObject("""
                INSERT INTO seat_reservations (
                    flight_id,
                    seat_id,
                    customer_name,
                    customer_email,
                    document_number,
                    passenger_type,
                    status,
                    payment_status,
                    booking_reference
                )
                VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', 'PAID', 'AW-' || upper(substr(gen_random_uuid()::text, 1, 8)))
                RETURNING id
                """, UUID.class, flightId, seatId, customerName, customerEmail, documentNumber, passengerType);
        return findById(reservationId).orElseThrow();
    }

    public SeatReservation create(UUID flightId, UUID seatId, String customerName) {
        return create(flightId, seatId, customerName, null, null, "ADULT");
    }

    public long countByFlightIdAndSeatId(UUID flightId, UUID seatId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM seat_reservations
                WHERE flight_id = ?
                  AND seat_id = ?
                  AND status = 'CONFIRMED'
                """, Long.class, flightId, seatId);
        return count == null ? 0 : count;
    }

    public Optional<SeatReservation> findByFlightIdAndSeatId(UUID flightId, UUID seatId) {
        return jdbcTemplate.query(selectReservationSql() + """
                WHERE sr.flight_id = ?
                  AND sr.seat_id = ?
                  AND sr.status = 'CONFIRMED'
                """, this::mapReservation, flightId, seatId).stream().findFirst();
    }

    public Optional<SeatReservation> findById(UUID reservationId) {
        return jdbcTemplate.query(selectReservationSql() + """
                WHERE sr.id = ?
                """, this::mapReservation, reservationId).stream().findFirst();
    }

    public Optional<SeatReservation> findByConfirmIdempotencyKey(String idempotencyKey) {
        return jdbcTemplate.query(selectReservationSql() + """
                WHERE sr.confirm_idempotency_key = ?
                """, this::mapReservation, idempotencyKey).stream().findFirst();
    }

    public SeatReservation hold(
            UUID flightId,
            UUID seatId,
            String customerName,
            String customerEmail,
            String documentNumber,
            String passengerType
    ) {
        // Inserts a temporary hold that blocks the same seat until payment succeeds, fails, or the hold expires.
        UUID reservationId = jdbcTemplate.queryForObject("""
                INSERT INTO seat_reservations (
                    flight_id,
                    seat_id,
                    customer_name,
                    customer_email,
                    document_number,
                    passenger_type,
                    status,
                    hold_expires_at,
                    payment_status
                )
                VALUES (?, ?, ?, ?, ?, ?, 'HELD', now() + interval '5 minutes', 'PENDING')
                RETURNING id
                """, UUID.class, flightId, seatId, customerName, customerEmail, documentNumber, passengerType);
        return findById(reservationId).orElseThrow();
    }

    public Optional<SeatReservation> confirm(UUID reservationId, String idempotencyKey) {
        // Confirms only unexpired holds; RETURNING id lets the repository reload the joined reservation projection.
        UUID updatedId = jdbcTemplate.query("""
                UPDATE seat_reservations
                SET status = 'CONFIRMED',
                    payment_status = 'PAID',
                    confirm_idempotency_key = ?,
                    booking_reference = COALESCE(booking_reference, 'AW-' || upper(substr(gen_random_uuid()::text, 1, 8))),
                    updated_at = now()
                WHERE id = ?
                  AND status = 'HELD'
                  AND hold_expires_at > now()
                RETURNING id
                """, (rs, rowNum) -> rs.getObject("id", UUID.class), idempotencyKey, reservationId)
                .stream()
                .findFirst()
                .orElse(null);
        return updatedId == null ? Optional.empty() : findById(updatedId);
    }

    public void updatePassengerDetails(
            UUID reservationId,
            String customerName,
            String customerEmail,
            String documentNumber,
            String passengerType
    ) {
        jdbcTemplate.update("""
                UPDATE seat_reservations
                SET customer_name = ?,
                    customer_email = ?,
                    document_number = ?,
                    passenger_type = ?,
                    updated_at = now()
                WHERE id = ?
                  AND status = 'HELD'
                  AND hold_expires_at > now()
                """, customerName, customerEmail, documentNumber, passengerType, reservationId);
    }

    public Optional<SeatReservation> failPayment(UUID reservationId, String idempotencyKey) {
        // Records a failed payment and releases the seat because PAYMENT_FAILED is outside the active unique index.
        UUID updatedId = jdbcTemplate.query("""
                UPDATE seat_reservations
                SET status = 'PAYMENT_FAILED',
                    payment_status = 'FAILED',
                    confirm_idempotency_key = ?,
                    updated_at = now()
                WHERE id = ?
                  AND status = 'HELD'
                  AND hold_expires_at > now()
                RETURNING id
                """, (rs, rowNum) -> rs.getObject("id", UUID.class), idempotencyKey, reservationId)
                .stream()
                .findFirst()
                .orElse(null);
        return updatedId == null ? Optional.empty() : findById(updatedId);
    }

    public int expireOldHolds() {
        // Converts expired HELD rows into EXPIRED rows so availability queries can treat the seat as free.
        return jdbcTemplate.update("""
                UPDATE seat_reservations
                SET status = 'EXPIRED',
                    payment_status = 'EXPIRED',
                    updated_at = now()
                WHERE status = 'HELD'
                  AND hold_expires_at <= now()
                """);
    }

    public Optional<SeatReservation> cancel(UUID reservationId) {
        // Cancels only confirmed bookings; cancelled rows no longer reserve the flight-seat pair.
        UUID updatedId = jdbcTemplate.query("""
                UPDATE seat_reservations
                SET status = 'CANCELLED',
                    updated_at = now()
                WHERE id = ?
                  AND status = 'CONFIRMED'
                RETURNING id
                """, (rs, rowNum) -> rs.getObject("id", UUID.class), reservationId)
                .stream()
                .findFirst()
                .orElse(null);
        return updatedId == null ? Optional.empty() : findById(updatedId);
    }

    private String selectReservationSql() {
        // Shared projection enriches reservation rows with flight and seat details for API responses.
        return """
                SELECT
                    sr.id,
                    sr.flight_id,
                    sr.seat_id,
                    sr.customer_name,
                    sr.customer_email,
                    sr.document_number,
                    sr.passenger_type,
                    sr.status,
                    sr.created_at,
                    f.flight_number,
                    f.origin,
                    f.destination,
                    s.seat_number,
                    s.cabin_class,
                    sr.hold_expires_at,
                    sr.booking_reference,
                    sr.payment_status
                FROM seat_reservations sr
                JOIN flights f ON f.id = sr.flight_id
                JOIN seats s ON s.id = sr.seat_id
                """;
    }

    private SeatReservation mapReservation(ResultSet rs, int rowNum) throws SQLException {
        return new SeatReservation(
                rs.getObject("id", UUID.class),
                rs.getObject("flight_id", UUID.class),
                rs.getObject("seat_id", UUID.class),
                rs.getString("customer_name"),
                rs.getString("customer_email"),
                rs.getString("document_number"),
                rs.getString("passenger_type"),
                rs.getString("status"),
                rs.getObject("created_at", java.time.OffsetDateTime.class),
                rs.getString("flight_number"),
                rs.getString("origin"),
                rs.getString("destination"),
                rs.getString("seat_number"),
                rs.getString("cabin_class"),
                rs.getObject("hold_expires_at", java.time.OffsetDateTime.class),
                rs.getString("booking_reference"),
                rs.getString("payment_status")
        );
    }
}
