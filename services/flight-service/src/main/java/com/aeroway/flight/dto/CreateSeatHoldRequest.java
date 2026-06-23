package com.aeroway.flight.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateSeatHoldRequest(
        @NotBlank(message = "Customer name is required.")
        String customerName,
        @Email(message = "Customer email must be valid.")
        String customerEmail,
        String documentNumber,
        String passengerType
) {
}
