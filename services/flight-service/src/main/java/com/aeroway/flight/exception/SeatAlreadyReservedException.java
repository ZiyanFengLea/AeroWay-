package com.aeroway.flight.exception;

public class SeatAlreadyReservedException extends RuntimeException {

    public SeatAlreadyReservedException() {
        super("This seat has already been reserved.");
    }
}
