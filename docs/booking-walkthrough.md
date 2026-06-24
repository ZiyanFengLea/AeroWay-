# AeroWay Booking Walkthrough

## Product Summary

AeroWay is a flight booking application focused on reliable seat reservations. A user can browse flights, inspect live seat availability, select a seat, enter passenger details, and complete a booking. The system protects each seat with database-enforced uniqueness so the same seat cannot be booked twice.

## User Flow

1. Open `http://localhost:5173`.
2. Enter or review the route fields.
3. Select an available flight.
4. Review the flight details, fare, baggage note, and seat map.
5. Choose an available seat.
6. Enter passenger name, email, document number, and passenger type.
7. Complete the booking.
8. Review the confirmation details.
9. Cancel the booking if needed and confirm that the seat becomes available again.

## Engineering Value

The application demonstrates a clean frontend booking flow, a Spring Boot REST backend, JDBC-based persistence, PostgreSQL transaction handling, OpenAPI documentation, and automated tests for realistic high-concurrency reservation problems.
