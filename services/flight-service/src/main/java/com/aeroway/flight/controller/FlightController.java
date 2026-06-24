package com.aeroway.flight.controller;

import com.aeroway.flight.dto.FlightResponse;
import com.aeroway.flight.dto.SeatResponse;
import com.aeroway.flight.model.FlightSearchCriteria;
import com.aeroway.flight.service.FlightService;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes read-only flight search and seat-map REST endpoints.
 * Reservation lifecycle commands live in ReservationController.
 */
@RestController
@RequestMapping("/api/flights")
public class FlightController {

    private final FlightService flightService;

    public FlightController(FlightService flightService) {
        this.flightService = flightService;
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
}
