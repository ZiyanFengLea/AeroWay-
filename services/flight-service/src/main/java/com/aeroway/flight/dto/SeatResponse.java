package com.aeroway.flight.dto;

import java.util.UUID;

public record SeatResponse(
        UUID id,
        UUID flightId,
        String seatNumber,
        String cabinClass,
        boolean reserved
) {
}
