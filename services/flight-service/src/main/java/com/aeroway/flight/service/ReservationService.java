package com.aeroway.flight.service;

import com.aeroway.flight.dto.ConfirmBookingRequest;
import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.CreateSeatHoldRequest;
import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.exception.ResourceNotFoundException;
import com.aeroway.flight.exception.SeatAlreadyReservedException;
import com.aeroway.flight.exception.SeatHoldExpiredException;
import com.aeroway.flight.model.SeatReservation;
import com.aeroway.flight.repository.FlightRepository;
import com.aeroway.flight.repository.SeatRepository;
import com.aeroway.flight.repository.SeatReservationRepository;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coordinates the reservation lifecycle: seat holds, booking confirmation, payment outcomes, and cancellation.
 * Spring transactions keep each reservation state change atomic at the service boundary.
 */
@Service
public class ReservationService {

    private final FlightRepository flightRepository;
    private final SeatRepository seatRepository;
    private final SeatReservationRepository reservationRepository;

    public ReservationService(
            FlightRepository flightRepository,
            SeatRepository seatRepository,
            SeatReservationRepository reservationRepository
    ) {
        this.flightRepository = flightRepository;
        this.seatRepository = seatRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional
    public ReservationResponse holdSeat(UUID flightId, UUID seatId, CreateSeatHoldRequest request) {
        // Creates a short-lived seat hold before checkout; PostgreSQL enforces one active hold or booking per seat.
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
        // Uses an idempotency key so repeated checkout submissions return one booking result.
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
        // Maintains the original direct reservation endpoint used by integration and concurrency tests.
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
        // Cancellation changes the reservation state and frees the seat for future searches.
        return reservationRepository.cancel(reservationId)
                .map(this::toReservationResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Confirmed reservation was not found."));
    }

    private ReservationResponse completeBooking(UUID reservationId, String idempotencyKey, boolean simulatePaymentFailure) {
        // Simulated payment result drives either CONFIRMED or PAYMENT_FAILED without external payment infrastructure.
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
        // Verifies the URL relationship before writing reservation data.
        if (!flightRepository.existsById(flightId)) {
            throw new ResourceNotFoundException("Flight was not found.");
        }
        if (!seatRepository.existsByIdAndFlightId(seatId, flightId)) {
            throw new ResourceNotFoundException("Seat was not found for this flight.");
        }
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
