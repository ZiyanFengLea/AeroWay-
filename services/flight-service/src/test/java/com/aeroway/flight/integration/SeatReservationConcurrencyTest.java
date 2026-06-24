package com.aeroway.flight.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.aeroway.flight.dto.CreateReservationRequest;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
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
 * Proves that 100 concurrent REST reservation attempts produce one success and 99 conflicts.
 */
@Testcontainers
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
    @Timeout(30)
    void oneOutOfOneHundredConcurrentReservationsSucceeds() throws Exception {
        // Latches make the requests start together, increasing the chance of a real database write race.
        ExecutorService executor = Executors.newFixedThreadPool(REQUEST_COUNT);
        CountDownLatch ready = new CountDownLatch(REQUEST_COUNT);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<HttpStatus>> futures = new ArrayList<>();

        for (int i = 0; i < REQUEST_COUNT; i++) {
            int customerNumber = i + 1;
            futures.add(executor.submit(createReservationTask(ready, start, customerNumber)));
        }

        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        start.countDown();

        List<HttpStatus> statuses = new ArrayList<>();
        for (Future<HttpStatus> future : futures) {
            statuses.add(future.get(10, TimeUnit.SECONDS));
        }
        executor.shutdown();
        assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();

        long successCount = statuses.stream().filter(HttpStatus.CREATED::equals).count();
        long conflictCount = statuses.stream().filter(HttpStatus.CONFLICT::equals).count();

        assertThat(successCount).isEqualTo(1);
        assertThat(conflictCount).isEqualTo(99);
        assertThat(countReservations()).isEqualTo(1);
    }

    private Callable<HttpStatus> createReservationTask(
            CountDownLatch ready,
            CountDownLatch start,
            int customerNumber
    ) {
        return () -> {
            ready.countDown();
            assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();

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

    private long countReservations() {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM seat_reservations
                WHERE flight_id = ?
                  AND seat_id = ?
                """, Long.class, FLIGHT_ID, SEAT_ID);
        return count == null ? 0 : count;
    }
}
