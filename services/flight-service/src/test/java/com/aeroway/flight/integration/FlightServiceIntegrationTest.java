package com.aeroway.flight.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.aeroway.flight.dto.CreateReservationRequest;
import com.aeroway.flight.dto.ErrorResponse;
import com.aeroway.flight.dto.ReservationResponse;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
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
    void reserveSeatThroughRestEndpoint() {
        ResponseEntity<ReservationResponse> response = reserveSeat("Ziyan Feng", ReservationResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().flightId()).isEqualTo(FLIGHT_ID);
        assertThat(response.getBody().seatId()).isEqualTo(SEAT_ID);
        assertThat(response.getBody().customerName()).isEqualTo("Ziyan Feng");
        assertThat(response.getBody().status()).isEqualTo("CONFIRMED");
    }

    @Test
    void duplicateReservationReturnsConflictAndLeavesOneDatabaseRow() {
        ResponseEntity<ReservationResponse> firstResponse = reserveSeat("First Customer", ReservationResponse.class);
        ResponseEntity<ErrorResponse> secondResponse = reserveSeat("Second Customer", ErrorResponse.class);

        assertThat(firstResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(secondResponse.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(secondResponse.getBody()).isEqualTo(new ErrorResponse(
                "SEAT_ALREADY_RESERVED",
                "This seat has already been reserved."
        ));
        assertThat(countReservations()).isEqualTo(1);
    }

    private <T> ResponseEntity<T> reserveSeat(String customerName, Class<T> responseType) {
        String url = "http://localhost:%d/api/flights/%s/seats/%s/reservations"
                .formatted(port, FLIGHT_ID, SEAT_ID);
        return restTemplate.postForEntity(url, new CreateReservationRequest(customerName), responseType);
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
