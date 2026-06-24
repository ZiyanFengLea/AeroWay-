package com.aeroway.flight.dto;

import java.util.UUID;

/**
 * API projection of a seat and its current reserved status for the seat map.
 */
public record SeatResponse(
        UUID id,
        UUID flightId,
        String seatNumber,
        String cabinClass,
        boolean reserved
) {
}
