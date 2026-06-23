package com.aeroway.flight.repository;

import com.aeroway.flight.model.SeatWithReservationStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SeatRepository {

    private final JdbcTemplate jdbcTemplate;

    public SeatRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<SeatWithReservationStatus> findByFlightId(UUID flightId) {
        return jdbcTemplate.query("""
                SELECT
                    s.id,
                    s.flight_id,
                    s.seat_number,
                    s.cabin_class,
                    EXISTS (
                        SELECT 1
                        FROM seat_reservations sr
                        WHERE sr.flight_id = s.flight_id
                          AND sr.seat_id = s.id
                          AND (
                              sr.status = 'CONFIRMED'
                              OR (sr.status = 'HELD' AND sr.hold_expires_at > now())
                          )
                    ) AS reserved
                FROM seats s
                WHERE s.flight_id = ?
                ORDER BY s.seat_number
                """, this::mapSeat, flightId);
    }

    public boolean existsByIdAndFlightId(UUID seatId, UUID flightId) {
        Boolean exists = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM seats
                    WHERE id = ?
                      AND flight_id = ?
                )
                """, Boolean.class, seatId, flightId);
        return Boolean.TRUE.equals(exists);
    }

    private SeatWithReservationStatus mapSeat(ResultSet rs, int rowNum) throws SQLException {
        return new SeatWithReservationStatus(
                rs.getObject("id", UUID.class),
                rs.getObject("flight_id", UUID.class),
                rs.getString("seat_number"),
                rs.getString("cabin_class"),
                rs.getBoolean("reserved")
        );
    }
}
