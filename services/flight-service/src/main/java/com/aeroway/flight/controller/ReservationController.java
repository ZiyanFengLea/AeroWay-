package com.aeroway.flight.controller;

import com.aeroway.flight.dto.ConfirmBookingRequest;
import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.service.ReservationService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides reservation lifecycle endpoints after a seat has been held or confirmed.
 * The endpoints support checkout confirmation, booking lookup, and cancellation.
 */
@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @GetMapping("/{reservationId}")
    public ReservationResponse getReservation(@PathVariable UUID reservationId) {
        return reservationService.getReservation(reservationId);
    }

    @PostMapping("/{reservationId}/cancel")
    public ReservationResponse cancelReservation(@PathVariable UUID reservationId) {
        return reservationService.cancelReservation(reservationId);
    }

    @PostMapping("/{reservationId}/confirm")
    public ReservationResponse confirmBooking(
            @PathVariable UUID reservationId,
            @Valid @RequestBody ConfirmBookingRequest request
    ) {
        return reservationService.confirmBooking(reservationId, request);
    }
}
