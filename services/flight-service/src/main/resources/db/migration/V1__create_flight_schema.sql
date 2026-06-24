CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Airport and airline reference data. Later seed migrations fill these tables with realistic inventory.
CREATE TABLE airports (
    iata_code TEXT PRIMARY KEY,
    icao_code TEXT,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timezone TEXT
);

CREATE TABLE airlines (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT
);

CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_code TEXT NOT NULL REFERENCES airlines(code),
    origin TEXT NOT NULL REFERENCES airports(iata_code),
    destination TEXT NOT NULL REFERENCES airports(iata_code),
    equipment TEXT,
    CONSTRAINT uk_route UNIQUE (airline_code, origin, destination)
);

-- Core flight inventory table used by the flight search API.
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_number TEXT NOT NULL UNIQUE,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL,
    airline_code TEXT REFERENCES airlines(code),
    equipment TEXT,
    base_price_cents INTEGER
);

-- Seat inventory is scoped to one flight; the same seat number may exist on different flights.
CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    cabin_class TEXT NOT NULL,
    CONSTRAINT uk_seat_per_flight UNIQUE (flight_id, seat_number)
);

-- Reservation lifecycle table used by direct booking, temporary holds, payment simulation, and idempotent confirmation.
CREATE TABLE seat_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    document_number TEXT,
    passenger_type TEXT NOT NULL DEFAULT 'ADULT',
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hold_expires_at TIMESTAMPTZ,
    booking_reference TEXT,
    confirm_idempotency_key TEXT,
    payment_status TEXT
);

CREATE INDEX idx_seats_flight_id ON seats(flight_id);
CREATE INDEX idx_seat_reservations_flight_seat ON seat_reservations(flight_id, seat_id);

-- Prevents double-booking by allowing only one active HELD or CONFIRMED row per flight-seat pair.
CREATE UNIQUE INDEX uk_active_reservation_per_flight_seat
    ON seat_reservations(flight_id, seat_id)
    WHERE status IN ('HELD', 'CONFIRMED');

-- Ensures repeated checkout submissions with the same idempotency key resolve to one reservation.
CREATE UNIQUE INDEX uk_reservation_confirm_idempotency_key
    ON seat_reservations(confirm_idempotency_key)
    WHERE confirm_idempotency_key IS NOT NULL;
