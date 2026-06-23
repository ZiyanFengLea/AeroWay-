package com.aeroway.flight.dto;

import jakarta.validation.constraints.NotBlank;

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
