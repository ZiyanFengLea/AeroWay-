package com.aeroway.flight.model;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Typed search criteria built from REST query parameters and consumed by the JDBC repository.
 */
public record FlightSearchCriteria(
        String origin,
        String destination,
        LocalDate departureDate,
        String airlineCode,
        Integer maxPriceCents,
        String cabinClass,
        Boolean directOnly,
        LocalTime departureTimeFrom,
        LocalTime departureTimeTo
) {
}
