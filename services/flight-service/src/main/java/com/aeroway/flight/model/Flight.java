package com.aeroway.flight.model;

import java.time.OffsetDateTime;
import java.util.UUID;

public record Flight(
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
