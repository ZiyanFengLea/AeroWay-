package com.aeroway.flight.dto;

/**
 * Standard error payload returned by the global exception handler.
 */
public record ErrorResponse(
        String error,
        String message
) {
}
