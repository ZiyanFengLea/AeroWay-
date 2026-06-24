package com.aeroway.flight.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for confirming a held seat and optionally simulating payment failure.
 */
public record ConfirmBookingRequest(
        @NotBlank(message = "Idempotency key is required.")
        String idempotencyKey,
        boolean simulatePaymentFailure,
        String customerName,
        String customerEmail,
        String documentNumber,
        String passengerType
) {
}
