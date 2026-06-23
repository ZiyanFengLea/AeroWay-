package com.aeroway.flight.controller;

import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.service.FlightService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final FlightService flightService;

    public ReservationController(FlightService flightService) {
        this.flightService = flightService;
    }

    @GetMapping("/{reservationId}")
    public ReservationResponse getReservation(@PathVariable UUID reservationId) {
        return flightService.getReservation(reservationId);
    }

    @PostMapping("/{reservationId}/cancel")
    public ReservationResponse cancelReservation(@PathVariable UUID reservationId) {
        return flightService.cancelReservation(reservationId);
    }
}
