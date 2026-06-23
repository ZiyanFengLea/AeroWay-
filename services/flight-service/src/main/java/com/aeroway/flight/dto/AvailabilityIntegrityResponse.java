package com.aeroway.flight.dto;

public record AvailabilityIntegrityResponse(
        int attempts,
        int successfulReservations,
        int conflicts,
        long duplicateReservationsInDatabase
) {
}
