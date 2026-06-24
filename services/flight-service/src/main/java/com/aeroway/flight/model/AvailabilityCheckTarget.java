package com.aeroway.flight.model;

import java.util.UUID;

/**
 * Identifies the fresh flight-seat pair used for the concurrent integrity check.
 */
public record AvailabilityCheckTarget(
        UUID flightId,
        UUID seatId
) {
}
