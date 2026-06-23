package com.aeroway.flight.dto;

public record ErrorResponse(
        String error,
        String message
) {
}
