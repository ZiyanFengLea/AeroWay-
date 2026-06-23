package com.aeroway.flight.repository;

import com.aeroway.flight.model.SeatReservation;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

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
        return jdbcTemplate.queryForObject("""
                WITH inserted_reservation AS (
                    INSERT INTO seat_reservations (
                        flight_id,
                        seat_id,
                        customer_name,
                        customer_email,
                        document_number,
                        passenger_type,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')
                    RETURNING id
                )
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
                    s.cabin_class
                FROM seat_reservations sr
                JOIN inserted_reservation ir ON ir.id = sr.id
                JOIN flights f ON f.id = sr.flight_id
                JOIN seats s ON s.id = sr.seat_id
                """, this::mapReservation, flightId, seatId, customerName, customerEmail, documentNumber, passengerType);
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
        return jdbcTemplate.query("""
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
                    s.cabin_class
                FROM seat_reservations sr
                JOIN flights f ON f.id = sr.flight_id
                JOIN seats s ON s.id = sr.seat_id
                WHERE sr.flight_id = ?
                  AND sr.seat_id = ?
                  AND sr.status = 'CONFIRMED'
                """, this::mapReservation, flightId, seatId).stream().findFirst();
    }

    public Optional<SeatReservation> findById(UUID reservationId) {
        return jdbcTemplate.query("""
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
                    s.cabin_class
                FROM seat_reservations sr
                JOIN flights f ON f.id = sr.flight_id
                JOIN seats s ON s.id = sr.seat_id
                WHERE sr.id = ?
                """, this::mapReservation, reservationId).stream().findFirst();
    }

    public Optional<SeatReservation> cancel(UUID reservationId) {
        return jdbcTemplate.query("""
                WITH updated_reservation AS (
                    UPDATE seat_reservations
                    SET status = 'CANCELLED',
                        updated_at = now()
                    WHERE id = ?
                      AND status = 'CONFIRMED'
                    RETURNING id
                )
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
                    s.cabin_class
                FROM seat_reservations sr
                JOIN updated_reservation ur ON ur.id = sr.id
                JOIN flights f ON f.id = sr.flight_id
                JOIN seats s ON s.id = sr.seat_id
                """, this::mapReservation, reservationId).stream().findFirst();
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
                rs.getString("cabin_class")
        );
    }
}
