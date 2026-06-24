package com.aeroway.flight.dto;

/**
 * API response summarizing the controlled concurrent reservation check.
 */
public record AvailabilityIntegrityResponse(
        int attempts,
        int successfulReservations,
        int conflicts,
        long duplicateReservationsInDatabase
) {
}
