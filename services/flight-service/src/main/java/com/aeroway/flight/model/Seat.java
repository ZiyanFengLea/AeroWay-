package com.aeroway.flight.model;

import java.util.UUID;

public record Seat(
        UUID id,
        UUID flightId,
        String seatNumber,
        String cabinClass
) {
}
