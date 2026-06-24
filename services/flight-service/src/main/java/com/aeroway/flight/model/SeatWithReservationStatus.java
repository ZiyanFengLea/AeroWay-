package com.aeroway.flight.model;

import java.util.UUID;

/**
 * Seat-map projection that combines seat data with a computed active-reservation flag.
 */
public record SeatWithReservationStatus(
        UUID id,
        UUID flightId,
        String seatNumber,
        String cabinClass,
        boolean reserved
) {
}
