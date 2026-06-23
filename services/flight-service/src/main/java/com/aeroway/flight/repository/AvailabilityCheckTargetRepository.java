package com.aeroway.flight.repository;

import com.aeroway.flight.model.AvailabilityCheckTarget;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AvailabilityCheckTargetRepository {

    private final JdbcTemplate jdbcTemplate;

    public AvailabilityCheckTargetRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public AvailabilityCheckTarget createFreshTarget() {
        UUID flightId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        String flightNumber = "DEMO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        jdbcTemplate.update("""
                INSERT INTO flights (id, flight_number, origin, destination, departure_time)
                VALUES (?, ?, 'BER', 'ASE', ?)
                """, flightId, flightNumber, OffsetDateTime.now().plusDays(30));

        jdbcTemplate.update("""
                INSERT INTO seats (id, flight_id, seat_number, cabin_class)
                VALUES (?, ?, '99A', 'DEMO')
                """, seatId, flightId);

        return new AvailabilityCheckTarget(flightId, seatId);
    }
}
