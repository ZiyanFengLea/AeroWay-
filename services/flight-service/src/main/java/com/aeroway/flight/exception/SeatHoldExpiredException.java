package com.aeroway.flight.exception;

/**
 * Signals that checkout attempted to confirm a hold after its time window closed.
 */
public class SeatHoldExpiredException extends RuntimeException {
    public SeatHoldExpiredException() {
        super("This seat hold has expired. Please choose the seat again.");
    }
}
