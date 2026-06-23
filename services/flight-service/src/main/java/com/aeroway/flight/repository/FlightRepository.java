package com.aeroway.flight.repository;

import com.aeroway.flight.model.Flight;
import com.aeroway.flight.model.FlightSearchCriteria;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class FlightRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlightRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Flight> findAll() {
        return findByCriteria(new FlightSearchCriteria(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        ));
    }

    public List<Flight> findByCriteria(FlightSearchCriteria criteria) {
        StringBuilder sql = new StringBuilder(baseFlightQuery());
        List<Object> params = new ArrayList<>();
        List<Integer> types = new ArrayList<>();

        appendTextFilter(sql, params, types, criteria.origin(), """
                AND (
                    LOWER(f.origin) LIKE LOWER(?)
                    OR LOWER(oa.city) LIKE LOWER(?)
                    OR LOWER(oa.name) LIKE LOWER(?)
                )
                """);
        appendTextFilter(sql, params, types, criteria.destination(), """
                AND (
                    LOWER(f.destination) LIKE LOWER(?)
                    OR LOWER(da.city) LIKE LOWER(?)
                    OR LOWER(da.name) LIKE LOWER(?)
                )
                """);
        if (criteria.departureDate() != null) {
            sql.append(" AND f.departure_time >= ? AND f.departure_time < ? ");
            LocalDate date = criteria.departureDate();
            params.add(Timestamp.valueOf(date.atStartOfDay()));
            types.add(Types.TIMESTAMP);
            params.add(Timestamp.valueOf(date.plusDays(1).atStartOfDay()));
            types.add(Types.TIMESTAMP);
        }
        if (hasText(criteria.airlineCode())) {
            sql.append(" AND f.airline_code = ? ");
            params.add(criteria.airlineCode().trim().toUpperCase());
            types.add(Types.VARCHAR);
        }
        if (criteria.maxPriceCents() != null) {
            sql.append(" AND f.base_price_cents <= ? ");
            params.add(criteria.maxPriceCents());
            types.add(Types.INTEGER);
        }
        if (hasText(criteria.cabinClass())) {
            sql.append("""
                    AND EXISTS (
                        SELECT 1
                        FROM seats cabin_seat
                        WHERE cabin_seat.flight_id = f.id
                          AND cabin_seat.cabin_class = ?
                    )
                    """);
            params.add(criteria.cabinClass().trim().toUpperCase());
            types.add(Types.VARCHAR);
        }
        if (criteria.departureTimeFrom() != null) {
            sql.append(" AND CAST(f.departure_time AS time) >= ? ");
            params.add(criteria.departureTimeFrom());
            types.add(Types.TIME);
        }
        if (criteria.departureTimeTo() != null) {
            sql.append(" AND CAST(f.departure_time AS time) <= ? ");
            params.add(criteria.departureTimeTo());
            types.add(Types.TIME);
        }

        sql.append(" ORDER BY f.departure_time, f.flight_number ");

        return jdbcTemplate.query(sql.toString(), params.toArray(), types.stream().mapToInt(Integer::intValue).toArray(), this::mapFlight);
    }

    public Optional<Flight> findById(UUID flightId) {
        return jdbcTemplate.query(baseFlightQuery() + " AND f.id = ? ",
                this::mapFlight,
                flightId
        ).stream().findFirst();
    }

    private String baseFlightQuery() {
        return """
                SELECT
                    f.id,
                    f.flight_number,
                    f.origin,
                    f.destination,
                    f.departure_time,
                    f.airline_code,
                    COALESCE(al.name, f.airline_code, 'AeroWay Partner') AS airline_name,
                    oa.name AS origin_airport_name,
                    oa.city AS origin_city,
                    oa.country AS origin_country,
                    da.name AS destination_airport_name,
                    da.city AS destination_city,
                    da.country AS destination_country,
                    f.equipment,
                    f.base_price_cents,
                    (
                        SELECT COUNT(*)
                        FROM seats available_seat
                        WHERE available_seat.flight_id = f.id
                          AND NOT EXISTS (
                              SELECT 1
                              FROM seat_reservations confirmed_reservation
                              WHERE confirmed_reservation.flight_id = f.id
                                AND confirmed_reservation.seat_id = available_seat.id
                                AND (
                                    confirmed_reservation.status = 'CONFIRMED'
                                    OR (
                                        confirmed_reservation.status = 'HELD'
                                        AND confirmed_reservation.hold_expires_at > now()
                                    )
                                )
                          )
                    ) AS available_seat_count,
                    CASE
                        WHEN oa.latitude IS NULL OR oa.longitude IS NULL
                          OR da.latitude IS NULL OR da.longitude IS NULL THEN NULL
                        ELSE (
                            ROUND(
                                (
                                    6371 * acos(
                                        LEAST(1, GREATEST(-1,
                                            cos(radians(oa.latitude))
                                            * cos(radians(da.latitude))
                                            * cos(radians(da.longitude) - radians(oa.longitude))
                                            + sin(radians(oa.latitude))
                                            * sin(radians(da.latitude))
                                        ))
                                    )
                                ) / 800 * 60 + 30
                            )
                        )::int
                    END AS duration_minutes
                FROM flights f
                LEFT JOIN airlines al ON al.code = f.airline_code
                LEFT JOIN airports oa ON oa.iata_code = f.origin
                LEFT JOIN airports da ON da.iata_code = f.destination
                WHERE 1 = 1
                """;
    }

    private void appendTextFilter(
            StringBuilder sql,
            List<Object> params,
            List<Integer> types,
            String value,
            String clause
    ) {
        if (!hasText(value)) {
            return;
        }
        sql.append(clause);
        String pattern = "%" + value.trim() + "%";
        params.add(pattern);
        params.add(pattern);
        params.add(pattern);
        types.add(Types.VARCHAR);
        types.add(Types.VARCHAR);
        types.add(Types.VARCHAR);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    public boolean existsById(UUID flightId) {
        Boolean exists = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM flights WHERE id = ?
                )
                """, Boolean.class, flightId);
        return Boolean.TRUE.equals(exists);
    }

    private Flight mapFlight(ResultSet rs, int rowNum) throws SQLException {
        return new Flight(
                rs.getObject("id", UUID.class),
                rs.getString("flight_number"),
                rs.getString("origin"),
                rs.getString("destination"),
                rs.getObject("departure_time", java.time.OffsetDateTime.class),
                rs.getString("airline_code"),
                rs.getString("airline_name"),
                rs.getString("origin_airport_name"),
                rs.getString("origin_city"),
                rs.getString("origin_country"),
                rs.getString("destination_airport_name"),
                rs.getString("destination_city"),
                rs.getString("destination_country"),
                rs.getString("equipment"),
                nullableInt(rs, "base_price_cents"),
                nullableInt(rs, "available_seat_count"),
                nullableInt(rs, "duration_minutes")
        );
    }

    private Integer nullableInt(ResultSet rs, String columnName) throws SQLException {
        int value = rs.getInt(columnName);
        return rs.wasNull() ? null : value;
    }
}
