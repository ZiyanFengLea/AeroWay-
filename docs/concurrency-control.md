# AeroWay Concurrency Control

## What Double-Booking Means

Double-booking means two customers end up with confirmed reservations for the same limited resource. In AeroWay, the resource is one flight seat on one flight.

## Why It Happens

A common but unsafe flow is:

1. Check whether the seat is available.
2. If it looks available, insert a reservation row.

Under concurrent traffic, two requests can both complete the availability check before either insert is committed. If the database does not enforce uniqueness, both reservations can be created.

## Why Application Checks Alone Are Not Enough

Application checks are useful for user experience, but they are not a final correctness guarantee. In a real deployment there may be multiple application threads, multiple service instances, retries, and requests arriving at almost the same time. The invariant must be protected where the shared data is written.

## The AeroWay Solution

AeroWay uses PostgreSQL as the source of truth. The reservation table has a unique constraint:

```sql
CREATE UNIQUE INDEX uk_active_reservation_per_flight_seat
    ON seat_reservations(flight_id, seat_id)
    WHERE status IN ('HELD', 'CONFIRMED');
```

When 100 requests race to reserve or hold the same seat, PostgreSQL allows one active booking state and rejects the rest. The service catches the duplicate-key violation and maps it to:

```http
HTTP/1.1 409 Conflict
```

```json
{
  "error": "SEAT_ALREADY_RESERVED",
  "message": "This seat has already been reserved."
}
```

## What The Automated Test Proves

The concurrency tests start 100 reservation or hold attempts at nearly the same time using Java concurrency utilities. The expected result is:

- `1` successful reservation or hold.
- `99` duplicate active-seat conflicts.
- `1` database row for the flight-seat pair.
