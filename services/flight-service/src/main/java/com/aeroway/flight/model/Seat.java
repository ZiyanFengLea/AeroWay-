package com.aeroway.flight.model;

import java.util.UUID;

/**
 * Repository model for a physical seat assigned to one flight.
 */
public record Seat(
        UUID id,
        UUID flightId,
        String seatNumber,
        String cabinClass
) {
}
