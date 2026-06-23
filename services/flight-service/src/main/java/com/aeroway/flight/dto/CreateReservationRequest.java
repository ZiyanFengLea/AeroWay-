package com.aeroway.flight.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;

public record CreateReservationRequest(
        @NotBlank(message = "customerName is required")
        String customerName,

        @Email(message = "customerEmail must be a valid email address")
        String customerEmail,

        String documentNumber,

        String passengerType
) {
    public CreateReservationRequest(String customerName) {
        this(customerName, null, null, "ADULT");
    }
}
