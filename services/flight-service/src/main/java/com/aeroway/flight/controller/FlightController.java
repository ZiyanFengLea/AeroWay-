package com.aeroway.flight.controller;

import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.CreateSeatHoldRequest;
import com.aeroway.flight.dto.FlightResponse;
import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.dto.SeatResponse;
import com.aeroway.flight.model.FlightSearchCriteria;
import com.aeroway.flight.service.FlightService;
import com.aeroway.flight.service.ReservationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes the flight search, seat map, direct reservation, and seat-hold REST endpoints.
 * Flight reads and reservation writes are delegated to separate service boundaries.
 */
@RestController
@RequestMapping("/api/flights")
public class FlightController {

    private final FlightService flightService;
    private final ReservationService reservationService;

    public FlightController(FlightService flightService, ReservationService reservationService) {
        this.flightService = flightService;
        this.reservationService = reservationService;
    }

    @GetMapping
    public List<FlightResponse> listFlights(
            @RequestParam(required = false) String origin,
            @RequestParam(required = false) String destination,
            @RequestParam(required = false) LocalDate departureDate,
            @RequestParam(required = false) String airlineCode,
            @RequestParam(required = false) Integer maxPriceCents,
            @RequestParam(required = false) String cabinClass,
            @RequestParam(required = false) Boolean directOnly,
            @RequestParam(required = false) LocalTime departureTimeFrom,
            @RequestParam(required = false) LocalTime departureTimeTo
    ) {
        // Converts query parameters into a typed search object for the service layer.
        return flightService.searchFlights(new FlightSearchCriteria(
                origin,
                destination,
                departureDate,
                airlineCode,
                maxPriceCents,
                cabinClass,
                directOnly,
                departureTimeFrom,
                departureTimeTo
        ));
    }

    @GetMapping("/{flightId}")
    public FlightResponse getFlight(@PathVariable UUID flightId) {
        return flightService.getFlight(flightId);
    }

    @GetMapping("/{flightId}/seats")
    public List<SeatResponse> listSeats(@PathVariable UUID flightId) {
        return flightService.listSeats(flightId);
    }

    @PostMapping("/{flightId}/seats/{seatId}/reservations")
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

    @PostMapping("/{flightId}/seats/{seatId}/holds")
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
}
