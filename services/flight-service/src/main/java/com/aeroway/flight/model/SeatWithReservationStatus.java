package com.aeroway.flight.model;

import java.util.UUID;

public record SeatWithReservationStatus(
        UUID id,
        UUID flightId,
        String seatNumber,
        String cabinClass,
        boolean reserved
) {
}
