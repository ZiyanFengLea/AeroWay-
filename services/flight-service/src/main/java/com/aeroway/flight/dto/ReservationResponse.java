package com.aeroway.flight.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ReservationResponse(
        UUID reservationId,
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
}
