-- Adds checkout state: temporary holds, booking references, idempotent confirmation, and payment status.
ALTER TABLE seat_reservations
    ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS booking_reference TEXT,
    ADD COLUMN IF NOT EXISTS confirm_idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS payment_status TEXT;

ALTER TABLE seat_reservations
    DROP CONSTRAINT IF EXISTS uk_reservation_per_flight_seat;

DROP INDEX IF EXISTS uk_confirmed_reservation_per_flight_seat;
DROP INDEX IF EXISTS uk_active_reservation_per_flight_seat;
DROP INDEX IF EXISTS uk_reservation_confirm_idempotency_key;

-- Prevents double-booking by allowing only one active HELD or CONFIRMED row per flight-seat pair.
CREATE UNIQUE INDEX uk_active_reservation_per_flight_seat
    ON seat_reservations(flight_id, seat_id)
    WHERE status IN ('HELD', 'CONFIRMED');

-- Ensures repeated checkout submissions with the same idempotency key resolve to one reservation.
CREATE UNIQUE INDEX uk_reservation_confirm_idempotency_key
    ON seat_reservations(confirm_idempotency_key)
    WHERE confirm_idempotency_key IS NOT NULL;
