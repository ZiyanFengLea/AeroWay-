package com.aeroway.flight.controller;

import com.aeroway.flight.dto.ConfirmBookingRequest;
import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.CreateSeatHoldRequest;
import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.service.ReservationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides reservation lifecycle endpoints, including direct booking, seat hold, checkout confirmation, lookup,
 * and cancellation.
 */
@RestController
public class ReservationController {

    private final ReservationService reservationService;

    public ReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    @PostMapping("/api/flights/{flightId}/seats/{seatId}/reservations")
    public ResponseEntity<ReservationResponse> reserveSeat(
            @PathVariable UUID flightId,
            @PathVariable UUID seatId,
            @Valid @RequestBody CreateReservationRequest request
    ) {
        // Creates a confirmed reservation immediately and returns a Location header for REST clients.
        ReservationResponse response = reservationService.reserveSeat(flightId, seatId, request);
        URI location = URI.create("/api/flights/%s/seats/%s/reservations/%s".formatted(
                flightId,
                seatId,
                response.reservationId()
        ));

        return ResponseEntity.created(location).body(response);
    }

    @PostMapping("/api/flights/{flightId}/seats/{seatId}/holds")
    public ResponseEntity<ReservationResponse> holdSeat(
            @PathVariable UUID flightId,
            @PathVariable UUID seatId,
            @Valid @RequestBody CreateSeatHoldRequest request
    ) {
        // Starts the checkout flow by holding a seat before payment confirmation.
        ReservationResponse response = reservationService.holdSeat(flightId, seatId, request);
        URI location = URI.create("/api/reservations/%s".formatted(response.reservationId()));
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping("/api/reservations/{reservationId}")
    public ReservationResponse getReservation(@PathVariable UUID reservationId) {
        return reservationService.getReservation(reservationId);
    }

    @PostMapping("/api/reservations/{reservationId}/cancel")
    public ReservationResponse cancelReservation(@PathVariable UUID reservationId) {
        return reservationService.cancelReservation(reservationId);
    }

    @PostMapping("/api/reservations/{reservationId}/confirm")
    public ReservationResponse confirmBooking(
            @PathVariable UUID reservationId,
            @Valid @RequestBody ConfirmBookingRequest request
    ) {
        return reservationService.confirmBooking(reservationId, request);
    }
}
