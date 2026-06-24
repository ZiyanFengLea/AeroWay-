package com.aeroway.flight.exception;

/**
 * Represents a duplicate active reservation detected by PostgreSQL uniqueness constraints.
 */
public class SeatAlreadyReservedException extends RuntimeException {

    public SeatAlreadyReservedException() {
        super("This seat has already been reserved.");
    }
}
