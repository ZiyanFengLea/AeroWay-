package com.aeroway.flight.service;

import com.aeroway.flight.dto.ConfirmBookingRequest;
import com.aeroway.flight.dto.CreateSeatHoldRequest;
import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.FlightResponse;
import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.dto.SeatResponse;
import com.aeroway.flight.exception.ResourceNotFoundException;
import com.aeroway.flight.exception.SeatAlreadyReservedException;
import com.aeroway.flight.exception.SeatHoldExpiredException;
import com.aeroway.flight.model.Flight;
import com.aeroway.flight.model.FlightSearchCriteria;
import com.aeroway.flight.model.SeatReservation;
import com.aeroway.flight.model.SeatWithReservationStatus;
import com.aeroway.flight.repository.FlightRepository;
import com.aeroway.flight.repository.SeatRepository;
import com.aeroway.flight.repository.SeatReservationRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FlightService {

    private final FlightRepository flightRepository;
    private final SeatRepository seatRepository;
    private final SeatReservationRepository reservationRepository;

    public FlightService(
            FlightRepository flightRepository,
            SeatRepository seatRepository,
            SeatReservationRepository reservationRepository
    ) {
        this.flightRepository = flightRepository;
        this.seatRepository = seatRepository;
        this.reservationRepository = reservationRepository;
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

    @Transactional
    public ReservationResponse holdSeat(UUID flightId, UUID seatId, CreateSeatHoldRequest request) {
        validateFlightAndSeat(flightId, seatId);
        reservationRepository.expireOldHolds();

        try {
            SeatReservation reservation = reservationRepository.hold(
                    flightId,
                    seatId,
                    request.customerName().trim(),
                    clean(request.customerEmail()),
                    clean(request.documentNumber()),
                    normalizePassengerType(request.passengerType())
            );
            return toReservationResponse(reservation);
        } catch (DuplicateKeyException exception) {
            throw new SeatAlreadyReservedException();
        }
    }

    @Transactional
    public ReservationResponse confirmBooking(UUID reservationId, ConfirmBookingRequest request) {
        reservationRepository.expireOldHolds();
        String idempotencyKey = request.idempotencyKey().trim();

        return reservationRepository.findByConfirmIdempotencyKey(idempotencyKey)
                .map(this::toReservationResponse)
                .orElseGet(() -> {
                    if (request.customerName() != null && !request.customerName().isBlank()) {
                        reservationRepository.updatePassengerDetails(
                                reservationId,
                                request.customerName().trim(),
                                clean(request.customerEmail()),
                                clean(request.documentNumber()),
                                normalizePassengerType(request.passengerType())
                        );
                    }
                    return completeBooking(reservationId, idempotencyKey, request.simulatePaymentFailure());
                });
    }

    @Transactional
    public ReservationResponse reserveSeat(UUID flightId, UUID seatId, CreateReservationRequest request) {
        validateFlightAndSeat(flightId, seatId);
        reservationRepository.expireOldHolds();

        try {
            SeatReservation reservation = reservationRepository.create(
                    flightId,
                    seatId,
                    request.customerName().trim(),
                    clean(request.customerEmail()),
                    clean(request.documentNumber()),
                    normalizePassengerType(request.passengerType())
            );
            return toReservationResponse(reservation);
        } catch (DuplicateKeyException exception) {
            throw new SeatAlreadyReservedException();
        }
    }

    @Transactional(readOnly = true)
    public ReservationResponse getReservation(UUID reservationId) {
        return reservationRepository.findById(reservationId)
                .map(this::toReservationResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation was not found."));
    }

    @Transactional
    public ReservationResponse cancelReservation(UUID reservationId) {
        return reservationRepository.cancel(reservationId)
                .map(this::toReservationResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Confirmed reservation was not found."));
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

    private ReservationResponse toReservationResponse(SeatReservation reservation) {
        return new ReservationResponse(
                reservation.id(),
                reservation.flightId(),
                reservation.seatId(),
                reservation.customerName(),
                reservation.customerEmail(),
                reservation.documentNumber(),
                reservation.passengerType(),
                reservation.status(),
                reservation.createdAt(),
                reservation.flightNumber(),
                reservation.origin(),
                reservation.destination(),
                reservation.seatNumber(),
                reservation.cabinClass(),
                reservation.holdExpiresAt(),
                reservation.bookingReference(),
                reservation.paymentStatus()
        );
    }

    private ReservationResponse completeBooking(UUID reservationId, String idempotencyKey, boolean simulatePaymentFailure) {
        try {
            return (simulatePaymentFailure
                    ? reservationRepository.failPayment(reservationId, idempotencyKey)
                    : reservationRepository.confirm(reservationId, idempotencyKey))
                    .map(this::toReservationResponse)
                    .orElseThrow(SeatHoldExpiredException::new);
        } catch (DuplicateKeyException exception) {
            return reservationRepository.findByConfirmIdempotencyKey(idempotencyKey)
                    .map(this::toReservationResponse)
                    .orElseThrow(() -> exception);
        }
    }

    private void validateFlightAndSeat(UUID flightId, UUID seatId) {
        if (!flightRepository.existsById(flightId)) {
            throw new ResourceNotFoundException("Flight was not found.");
        }
        if (!seatRepository.existsByIdAndFlightId(seatId, flightId)) {
            throw new ResourceNotFoundException("Seat was not found for this flight.");
        }
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizePassengerType(String passengerType) {
        if (passengerType == null || passengerType.isBlank()) {
            return "ADULT";
        }
        return passengerType.trim().toUpperCase();
    }
}
