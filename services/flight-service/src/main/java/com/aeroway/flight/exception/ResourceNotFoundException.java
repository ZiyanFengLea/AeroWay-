package com.aeroway.flight.exception;

/**
 * Signals that a requested flight, seat, or reservation does not exist.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
