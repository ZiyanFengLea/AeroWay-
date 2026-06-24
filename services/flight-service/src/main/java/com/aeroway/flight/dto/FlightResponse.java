package com.aeroway.flight.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * API projection of a flight enriched with airline, airport, price, duration, and availability data.
 */
public record FlightResponse(
        UUID id,
        String flightNumber,
        String origin,
        String destination,
        OffsetDateTime departureTime,
        String airlineCode,
        String airlineName,
        String originAirportName,
        String originCity,
        String originCountry,
        String destinationAirportName,
        String destinationCity,
        String destinationCountry,
        String equipment,
        Integer basePriceCents,
        Integer availableSeatCount,
        Integer durationMinutes
) {
}
