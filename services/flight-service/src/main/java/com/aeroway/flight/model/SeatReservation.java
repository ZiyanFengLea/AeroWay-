package com.aeroway.flight.model;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SeatReservation(
        UUID id,
        UUID flightId,
        UUID seatId,
        String customerName,
        String customerEmail,
        String documentNumber,
        String passengerType,
        String status,
        OffsetDateTime createdAt,
        String flightNumber,
        String origin,
        String destination,
        String seatNumber,
        String cabinClass
) {
    public SeatReservation(
            UUID id,
            UUID flightId,
            UUID seatId,
            String customerName,
            String status,
            OffsetDateTime createdAt
    ) {
        this(
                id,
                flightId,
                seatId,
                customerName,
                null,
                null,
                "ADULT",
                status,
                createdAt,
                null,
                null,
                null,
                null,
                null
        );
    }
}
