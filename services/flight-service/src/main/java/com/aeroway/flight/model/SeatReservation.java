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
        String cabinClass,
        OffsetDateTime holdExpiresAt,
        String bookingReference,
        String paymentStatus
) {
    public SeatReservation(
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
        this(
                id,
                flightId,
                seatId,
                customerName,
                customerEmail,
                documentNumber,
                passengerType,
                status,
                createdAt,
                flightNumber,
                origin,
                destination,
                seatNumber,
                cabinClass,
                null,
                null,
                null
        );
    }

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
                null,
                null,
                null,
                null
        );
    }
}
