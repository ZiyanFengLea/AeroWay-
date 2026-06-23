package com.aeroway.flight.exception;

public class SeatHoldExpiredException extends RuntimeException {
    public SeatHoldExpiredException() {
        super("This seat hold has expired. Please choose the seat again.");
    }
}
