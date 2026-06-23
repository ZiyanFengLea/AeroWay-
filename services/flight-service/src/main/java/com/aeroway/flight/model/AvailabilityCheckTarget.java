package com.aeroway.flight.model;

import java.util.UUID;

public record AvailabilityCheckTarget(
        UUID flightId,
        UUID seatId
) {
}
