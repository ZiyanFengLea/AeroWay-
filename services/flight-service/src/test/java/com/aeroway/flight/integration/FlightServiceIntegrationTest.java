package com.aeroway.flight.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.aeroway.flight.dto.ConfirmBookingRequest;
import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.CreateSeatHoldRequest;
import com.aeroway.flight.dto.ErrorResponse;
import com.aeroway.flight.dto.ReservationResponse;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Exercises reservation REST endpoints with Spring Boot and Testcontainers PostgreSQL.
 */
@Testcontainers
@ExtendWith(TestResultLoggerExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@SuppressWarnings("resource")
class FlightServiceIntegrationTest {

    private static final UUID FLIGHT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID SEAT_ID = UUID.fromString("22222222-2222-2222-2222-222222222201");

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("aeroway_test")
            .withUsername("aeroway")
            .withPassword("aeroway");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate restTemplate;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void clearReservations() {
        jdbcTemplate.update("DELETE FROM seat_reservations");
    }

    @Test
    @DisplayName("Direct reservation creates one confirmed booking")
    void reserveSeatThroughRestEndpoint() {
        // Verifies the legacy direct reservation API still creates a paid, confirmed seat booking.
        ResponseEntity<ReservationResponse> response = reserveSeat("Ziyan Feng", ReservationResponse.class);

        assertThat(response.getStatusCode()).as("direct reservation should return HTTP 201").isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).as("direct reservation response body").isNotNull();
        assertThat(response.getBody().flightId()).as("reserved flight id").isEqualTo(FLIGHT_ID);
        assertThat(response.getBody().seatId()).as("reserved seat id").isEqualTo(SEAT_ID);
        assertThat(response.getBody().customerName()).as("reserved customer name").isEqualTo("Ziyan Feng");
        assertThat(response.getBody().status()).as("direct reservation should be confirmed").isEqualTo("CONFIRMED");
    }

    @Test
    @DisplayName("Duplicate direct reservation returns conflict and keeps one row")
    void duplicateReservationReturnsConflictAndLeavesOneDatabaseRow() {
        // Protects the seat inventory rule: a second direct reservation for the same seat must fail.
        ResponseEntity<ReservationResponse> firstResponse = reserveSeat("First Customer", ReservationResponse.class);
        ResponseEntity<ErrorResponse> secondResponse = reserveSeat("Second Customer", ErrorResponse.class);

        assertThat(firstResponse.getStatusCode()).as("first direct reservation should succeed").isEqualTo(HttpStatus.CREATED);
        assertThat(secondResponse.getStatusCode()).as("duplicate direct reservation should return conflict").isEqualTo(HttpStatus.CONFLICT);
        assertThat(secondResponse.getBody()).as("duplicate reservation error body").isEqualTo(new ErrorResponse(
                "SEAT_ALREADY_RESERVED",
                "This seat has already been reserved."
        ));
        assertThat(countReservations()).as("database should contain one reservation for the seat").isEqualTo(1);
    }

    @Test
    @DisplayName("Seat hold reserves checkout time and blocks another active hold")
    void seatHoldBlocksDuplicateHoldUntilReleased() {
        // Covers the temporary lock-seat flow before payment, including the active-hold conflict path.
        ResponseEntity<ReservationResponse> firstHold = holdSeat("Hold Customer", ReservationResponse.class);
        ResponseEntity<ErrorResponse> duplicateHold = holdSeat("Second Customer", ErrorResponse.class);

        assertThat(firstHold.getStatusCode()).as("first seat hold should return HTTP 201").isEqualTo(HttpStatus.CREATED);
        assertThat(firstHold.getBody()).as("seat hold response body").isNotNull();
        assertThat(firstHold.getBody().status()).as("seat hold should be HELD").isEqualTo("HELD");
        assertThat(firstHold.getBody().paymentStatus()).as("held seat payment should be pending").isEqualTo("PENDING");
        assertThat(firstHold.getBody().holdExpiresAt()).as("held seat should include an expiry timestamp").isNotNull();
        assertThat(duplicateHold.getStatusCode()).as("duplicate active hold should conflict").isEqualTo(HttpStatus.CONFLICT);
        assertThat(countActiveReservations()).as("only one active hold or booking should exist for the seat").isEqualTo(1);
    }

    @Test
    @DisplayName("Complete booking is idempotent and returns the same confirmed booking on retry")
    void confirmBookingIsIdempotentForRepeatedCheckoutSubmissions() {
        // Simulates a double-click or browser retry on Complete booking with the same idempotency key.
        ResponseEntity<ReservationResponse> hold = holdSeat("Idempotent Customer", ReservationResponse.class);
        assertThat(hold.getStatusCode()).as("seat hold before idempotency test should succeed").isEqualTo(HttpStatus.CREATED);

        UUID reservationId = hold.getBody().reservationId();
        String idempotencyKey = "checkout-repeat-" + reservationId;
        ResponseEntity<ReservationResponse> firstConfirm = confirmBooking(reservationId, idempotencyKey, false);
        ResponseEntity<ReservationResponse> retryConfirm = confirmBooking(reservationId, idempotencyKey, false);

        assertThat(firstConfirm.getStatusCode()).as("first confirmation should succeed").isEqualTo(HttpStatus.OK);
        assertThat(retryConfirm.getStatusCode()).as("retry confirmation with same key should succeed").isEqualTo(HttpStatus.OK);
        assertThat(firstConfirm.getBody()).as("first confirmation body").isNotNull();
        assertThat(retryConfirm.getBody()).as("retry confirmation body").isNotNull();
        assertThat(retryConfirm.getBody().reservationId())
                .as("retry should return the same reservation id")
                .isEqualTo(firstConfirm.getBody().reservationId());
        assertThat(retryConfirm.getBody().bookingReference())
                .as("retry should return the same booking reference")
                .isEqualTo(firstConfirm.getBody().bookingReference());
        assertThat(firstConfirm.getBody().status()).as("confirmed booking status").isEqualTo("CONFIRMED");
        assertThat(firstConfirm.getBody().paymentStatus()).as("confirmed booking payment status").isEqualTo("PAID");
        assertThat(countReservations()).as("idempotent retry must not create another reservation row").isEqualTo(1);
        assertThat(countConfirmedReservations()).as("idempotent retry must keep one confirmed booking").isEqualTo(1);
    }

    @Test
    @DisplayName("Mock payment failure releases the held seat for a new booking")
    void paymentFailureReleasesHeldSeat() {
        // Ensures a failed mock payment moves the reservation out of the active seat lock set.
        ResponseEntity<ReservationResponse> hold = holdSeat("Payment Failure Customer", ReservationResponse.class);
        assertThat(hold.getStatusCode()).as("seat hold before payment failure should succeed").isEqualTo(HttpStatus.CREATED);

        UUID reservationId = hold.getBody().reservationId();
        ResponseEntity<ReservationResponse> failedPayment = confirmBooking(
                reservationId,
                "payment-failure-" + reservationId,
                true
        );
        ResponseEntity<ReservationResponse> nextHold = holdSeat("Recovered Customer", ReservationResponse.class);

        assertThat(failedPayment.getStatusCode()).as("simulated failed payment should return HTTP 200").isEqualTo(HttpStatus.OK);
        assertThat(failedPayment.getBody()).as("failed payment response body").isNotNull();
        assertThat(failedPayment.getBody().status()).as("failed payment reservation status").isEqualTo("PAYMENT_FAILED");
        assertThat(failedPayment.getBody().paymentStatus()).as("failed payment status").isEqualTo("FAILED");
        assertThat(nextHold.getStatusCode()).as("seat should be holdable again after failed payment").isEqualTo(HttpStatus.CREATED);
        assertThat(nextHold.getBody().status()).as("new hold after failed payment").isEqualTo("HELD");
        assertThat(countActiveReservations()).as("failed payment row should not block the new active hold").isEqualTo(1);
    }

    @Test
    @DisplayName("Expired seat hold is released before the next booking attempt")
    void expiredHoldReleasesSeatForNextBookingAttempt() {
        // Forces a hold into the past to verify cleanup releases the seat for the next customer.
        ResponseEntity<ReservationResponse> hold = holdSeat("Expiring Customer", ReservationResponse.class);
        assertThat(hold.getStatusCode()).as("seat hold before expiry should succeed").isEqualTo(HttpStatus.CREATED);

        jdbcTemplate.update("""
                UPDATE seat_reservations
                SET hold_expires_at = now() - interval '1 minute'
                WHERE id = ?
                """, hold.getBody().reservationId());

        ResponseEntity<ReservationResponse> directReservation = reserveSeat("Next Customer", ReservationResponse.class);

        assertThat(directReservation.getStatusCode()).as("new reservation should succeed after hold expires").isEqualTo(HttpStatus.CREATED);
        assertThat(directReservation.getBody()).as("new reservation response body").isNotNull();
        assertThat(directReservation.getBody().status()).as("new booking after expiry should be confirmed").isEqualTo("CONFIRMED");
        assertThat(countReservationsByStatus("EXPIRED")).as("old hold should be marked expired").isEqualTo(1);
        assertThat(countConfirmedReservations()).as("new confirmed reservation should own the seat").isEqualTo(1);
    }

    private <T> ResponseEntity<T> reserveSeat(String customerName, Class<T> responseType) {
        String url = "http://localhost:%d/api/flights/%s/seats/%s/reservations"
                .formatted(port, FLIGHT_ID, SEAT_ID);
        return restTemplate.postForEntity(url, new CreateReservationRequest(customerName), responseType);
    }

    private <T> ResponseEntity<T> holdSeat(String customerName, Class<T> responseType) {
        String url = "http://localhost:%d/api/flights/%s/seats/%s/holds"
                .formatted(port, FLIGHT_ID, SEAT_ID);
        return restTemplate.postForEntity(
                url,
                new CreateSeatHoldRequest(
                        customerName,
                        customerName.toLowerCase().replace(" ", ".") + "@example.com",
                        "P123456",
                        "ADULT"
                ),
                responseType
        );
    }

    private ResponseEntity<ReservationResponse> confirmBooking(
            UUID reservationId,
            String idempotencyKey,
            boolean simulatePaymentFailure
    ) {
        String url = "http://localhost:%d/api/reservations/%s/confirm"
                .formatted(port, reservationId);
        return restTemplate.postForEntity(
                url,
                new ConfirmBookingRequest(
                        idempotencyKey,
                        simulatePaymentFailure,
                        "Checkout Customer",
                        "checkout@example.com",
                        "P999999",
                        "ADULT"
                ),
                ReservationResponse.class
        );
    }

    private long countReservations() {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM seat_reservations
                WHERE flight_id = ?
                  AND seat_id = ?
                """, Long.class, FLIGHT_ID, SEAT_ID);
        return count == null ? 0 : count;
    }

    private long countActiveReservations() {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM seat_reservations
                WHERE flight_id = ?
                  AND seat_id = ?
                  AND status IN ('HELD', 'CONFIRMED')
                """, Long.class, FLIGHT_ID, SEAT_ID);
        return count == null ? 0 : count;
    }

    private long countConfirmedReservations() {
        return countReservationsByStatus("CONFIRMED");
    }

    private long countReservationsByStatus(String status) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM seat_reservations
                WHERE flight_id = ?
                  AND seat_id = ?
                  AND status = ?
                """, Long.class, FLIGHT_ID, SEAT_ID, status);
        return count == null ? 0 : count;
    }
}
