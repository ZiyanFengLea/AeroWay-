package com.aeroway.flight.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.CreateSeatHoldRequest;
import com.aeroway.flight.dto.ReservationResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
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
 * Proves that concurrent booking requests cannot double-book the same physical seat.
 */
@Testcontainers
@ExtendWith(TestResultLoggerExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@SuppressWarnings("resource")
class SeatReservationConcurrencyTest {

    private static final int REQUEST_COUNT = 100;
    private static final UUID FLIGHT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID SEAT_ID = UUID.fromString("22222222-2222-2222-2222-222222222202");

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("aeroway_concurrency_test")
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
    @DisplayName("Concurrent direct reservations create one booking and reject duplicates")
    @Timeout(30)
    void oneOutOfOneHundredConcurrentReservationsSucceeds() throws Exception {
        // Stress-tests the confirmed-reservation path: 100 users race for one seat, only one wins.
        List<HttpStatus> statuses = runConcurrentRequests(
                (customerNumber, ready, start) -> createReservationTask(customerNumber, ready, start)
        );

        assertSingleSuccessAndConflicts(statuses);
        assertThat(countReservations()).as("database should contain one row after concurrent direct reservations").isEqualTo(1);
        assertThat(countReservationsByStatus("CONFIRMED"))
                .as("database should contain one confirmed booking after concurrent direct reservations")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("Concurrent seat holds create one active hold and reject duplicates")
    @Timeout(30)
    void oneOutOfOneHundredConcurrentSeatHoldsSucceeds() throws Exception {
        // Stress-tests the checkout hold path: 100 users race to hold one seat, only one hold stays active.
        List<HttpStatus> statuses = runConcurrentRequests(
                (customerNumber, ready, start) -> createHoldTask(customerNumber, ready, start)
        );

        assertSingleSuccessAndConflicts(statuses);
        assertThat(countReservations()).as("database should contain one row after concurrent seat holds").isEqualTo(1);
        assertThat(countReservationsByStatus("HELD"))
                .as("database should contain one active hold after concurrent seat holds")
                .isEqualTo(1);
    }

    private List<HttpStatus> runConcurrentRequests(TaskFactory taskFactory) throws Exception {
        // Latches make every worker hit the endpoint together, creating a realistic database write race.
        ExecutorService executor = Executors.newFixedThreadPool(REQUEST_COUNT);
        CountDownLatch ready = new CountDownLatch(REQUEST_COUNT);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<HttpStatus>> futures = new ArrayList<>();

        for (int i = 0; i < REQUEST_COUNT; i++) {
            int customerNumber = i + 1;
            futures.add(executor.submit(taskFactory.create(customerNumber, ready, start)));
        }

        assertThat(ready.await(5, TimeUnit.SECONDS)).as("all concurrent workers should be ready").isTrue();
        start.countDown();

        List<HttpStatus> statuses = new ArrayList<>();
        for (Future<HttpStatus> future : futures) {
            statuses.add(future.get(10, TimeUnit.SECONDS));
        }
        executor.shutdown();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).as("concurrent executor should terminate").isTrue();
        return statuses;
    }

    private void assertSingleSuccessAndConflicts(List<HttpStatus> statuses) {
        // Both concurrency scenarios should collapse to one 201 Created and the rest 409 Conflict.
        long successCount = statuses.stream().filter(HttpStatus.CREATED::equals).count();
        long conflictCount = statuses.stream().filter(HttpStatus.CONFLICT::equals).count();

        assertThat(successCount).as("exactly one concurrent request should create the seat booking state").isEqualTo(1);
        assertThat(conflictCount).as("all duplicate concurrent requests should return conflict").isEqualTo(REQUEST_COUNT - 1);
    }

    private Callable<HttpStatus> createReservationTask(
            int customerNumber,
            CountDownLatch ready,
            CountDownLatch start
    ) {
        return () -> {
            ready.countDown();
            assertThat(start.await(5, TimeUnit.SECONDS)).as("reservation worker should receive start signal").isTrue();

            String url = "http://localhost:%d/api/flights/%s/seats/%s/reservations"
                    .formatted(port, FLIGHT_ID, SEAT_ID);
            ResponseEntity<ReservationResponse> response = restTemplate.postForEntity(
                    url,
                    new CreateReservationRequest("Customer " + customerNumber),
                    ReservationResponse.class
            );
            return HttpStatus.valueOf(response.getStatusCode().value());
        };
    }

    private Callable<HttpStatus> createHoldTask(
            int customerNumber,
            CountDownLatch ready,
            CountDownLatch start
    ) {
        return () -> {
            ready.countDown();
            assertThat(start.await(5, TimeUnit.SECONDS)).as("hold worker should receive start signal").isTrue();

            String url = "http://localhost:%d/api/flights/%s/seats/%s/holds"
                    .formatted(port, FLIGHT_ID, SEAT_ID);
            ResponseEntity<ReservationResponse> response = restTemplate.postForEntity(
                    url,
                    new CreateSeatHoldRequest(
                            "Customer " + customerNumber,
                            "customer" + customerNumber + "@example.com",
                            "P" + customerNumber,
                            "ADULT"
                    ),
                    ReservationResponse.class
            );
            return HttpStatus.valueOf(response.getStatusCode().value());
        };
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

    @FunctionalInterface
    private interface TaskFactory {
        Callable<HttpStatus> create(int customerNumber, CountDownLatch ready, CountDownLatch start);
    }
}
