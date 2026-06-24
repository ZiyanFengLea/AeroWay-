package com.aeroway.flight.service;

import com.aeroway.flight.dto.FlightResponse;
import com.aeroway.flight.dto.SeatResponse;
import com.aeroway.flight.exception.ResourceNotFoundException;
import com.aeroway.flight.model.Flight;
import com.aeroway.flight.model.FlightSearchCriteria;
import com.aeroway.flight.model.SeatWithReservationStatus;
import com.aeroway.flight.repository.FlightRepository;
import com.aeroway.flight.repository.SeatRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordinates flight search and seat-map reads.
 * Booking state changes live in ReservationService so the query and checkout boundaries stay separate.
 */
@Service
public class FlightService {

    private final FlightRepository flightRepository;
    private final SeatRepository seatRepository;

    public FlightService(
            FlightRepository flightRepository,
            SeatRepository seatRepository
    ) {
        this.flightRepository = flightRepository;
        this.seatRepository = seatRepository;
    }

    @Transactional(readOnly = true)
    public List<FlightResponse> listFlights() {
        return searchFlights(new FlightSearchCriteria(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        ));
    }

    @Transactional(readOnly = true)
    public List<FlightResponse> searchFlights(FlightSearchCriteria criteria) {
        // Delegates all filtering to JdbcTemplate SQL and maps database rows to API DTOs.
        return flightRepository.findByCriteria(criteria).stream()
                .map(this::toFlightResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public FlightResponse getFlight(UUID flightId) {
        return flightRepository.findById(flightId)
                .map(this::toFlightResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Flight was not found."));
    }

    @Transactional(readOnly = true)
    public List<SeatResponse> listSeats(UUID flightId) {
        if (!flightRepository.existsById(flightId)) {
            throw new ResourceNotFoundException("Flight was not found.");
        }

        return seatRepository.findByFlightId(flightId).stream()
                .map(this::toSeatResponse)
                .toList();
    }

    private FlightResponse toFlightResponse(Flight flight) {
        return new FlightResponse(
                flight.id(),
                flight.flightNumber(),
                flight.origin(),
                flight.destination(),
                flight.departureTime(),
                flight.airlineCode(),
                flight.airlineName(),
                flight.originAirportName(),
                flight.originCity(),
                flight.originCountry(),
                flight.destinationAirportName(),
                flight.destinationCity(),
                flight.destinationCountry(),
                flight.equipment(),
                flight.basePriceCents(),
                flight.availableSeatCount(),
                flight.durationMinutes()
        );
    }

    private SeatResponse toSeatResponse(SeatWithReservationStatus seat) {
        return new SeatResponse(
                seat.id(),
                seat.flightId(),
                seat.seatNumber(),
                seat.cabinClass(),
                seat.reserved()
        );
    }
}
