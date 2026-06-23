ALTER TABLE seat_reservations
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS document_number TEXT,
    ADD COLUMN IF NOT EXISTS passenger_type TEXT NOT NULL DEFAULT 'ADULT',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE seat_reservations
    DROP CONSTRAINT IF EXISTS uk_reservation_per_flight_seat;

CREATE UNIQUE INDEX IF NOT EXISTS uk_confirmed_reservation_per_flight_seat
    ON seat_reservations(flight_id, seat_id)
    WHERE status = 'CONFIRMED';
