CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_number TEXT NOT NULL UNIQUE,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    cabin_class TEXT NOT NULL,
    CONSTRAINT uk_seat_per_flight UNIQUE (flight_id, seat_number)
);

CREATE TABLE seat_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_id UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_reservation_per_flight_seat UNIQUE (flight_id, seat_id)
);

CREATE INDEX idx_seats_flight_id ON seats(flight_id);
CREATE INDEX idx_seat_reservations_flight_seat ON seat_reservations(flight_id, seat_id);
