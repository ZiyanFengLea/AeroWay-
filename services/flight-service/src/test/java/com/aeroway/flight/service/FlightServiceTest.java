package com.aeroway.flight.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.ReservationResponse;
import com.aeroway.flight.exception.SeatAlreadyReservedException;
import com.aeroway.flight.model.SeatReservation;
import com.aeroway.flight.repository.FlightRepository;
import com.aeroway.flight.repository.SeatRepository;
import com.aeroway.flight.repository.SeatReservationRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.DuplicateKeyException;

class FlightServiceTest {

    private static final UUID FLIGHT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID SEAT_ID = UUID.fromString("22222222-2222-2222-2222-222222222201");
    private static final UUID RESERVATION_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private final FlightRepository flightRepository = Mockito.mock(FlightRepository.class);
    private final SeatRepository seatRepository = Mockito.mock(SeatRepository.class);
    private final SeatReservationRepository reservationRepository = Mockito.mock(SeatReservationRepository.class);
    private final FlightService flightService = new FlightService(
            flightRepository,
            seatRepository,
            reservationRepository
    );

    @Test
    void reserveSeatCreatesConfirmedReservation() {
        when(flightRepository.existsById(FLIGHT_ID)).thenReturn(true);
        when(seatRepository.existsByIdAndFlightId(SEAT_ID, FLIGHT_ID)).thenReturn(true);
        when(reservationRepository.create(
                FLIGHT_ID,
                SEAT_ID,
                "Ziyan Feng",
                "ziyan@example.com",
                "P12345678",
                "STUDENT"
        ))
                .thenReturn(new SeatReservation(
                        RESERVATION_ID,
                        FLIGHT_ID,
                        SEAT_ID,
                        "Ziyan Feng",
                        "ziyan@example.com",
                        "P12345678",
                        "STUDENT",
                        "CONFIRMED",
                        OffsetDateTime.now(),
                        "AL101",
                        "BER",
                        "LIS",
                        "1A",
                        "BUSINESS"
                ));

        ReservationResponse response = flightService.reserveSeat(
                FLIGHT_ID,
                SEAT_ID,
                new CreateReservationRequest(" Ziyan Feng ", "ziyan@example.com", "P12345678", "student")
        );

        assertThat(response.reservationId()).isEqualTo(RESERVATION_ID);
        assertThat(response.flightId()).isEqualTo(FLIGHT_ID);
        assertThat(response.seatId()).isEqualTo(SEAT_ID);
        assertThat(response.customerName()).isEqualTo("Ziyan Feng");
        assertThat(response.customerEmail()).isEqualTo("ziyan@example.com");
        assertThat(response.documentNumber()).isEqualTo("P12345678");
        assertThat(response.passengerType()).isEqualTo("STUDENT");
        assertThat(response.status()).isEqualTo("CONFIRMED");
        verify(reservationRepository).create(
                FLIGHT_ID,
                SEAT_ID,
                "Ziyan Feng",
                "ziyan@example.com",
                "P12345678",
                "STUDENT"
        );
    }

    @Test
    void reserveSeatRejectsDuplicateReservation() {
        when(flightRepository.existsById(FLIGHT_ID)).thenReturn(true);
        when(seatRepository.existsByIdAndFlightId(SEAT_ID, FLIGHT_ID)).thenReturn(true);
        when(reservationRepository.create(FLIGHT_ID, SEAT_ID, "Ziyan Feng", null, null, "ADULT"))
                .thenThrow(new DuplicateKeyException("duplicate key value violates unique constraint"));

        assertThatThrownBy(() -> flightService.reserveSeat(
                FLIGHT_ID,
                SEAT_ID,
                new CreateReservationRequest("Ziyan Feng")
        )).isInstanceOf(SeatAlreadyReservedException.class)
                .hasMessage("This seat has already been reserved.");
    }
}
