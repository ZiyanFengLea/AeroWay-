-- Showcase inventory for product demos.
-- These are realistic-looking sample flights, not live airline availability.

INSERT INTO airports (iata_code, icao_code, name, city, country, latitude, longitude, timezone) VALUES
    ('BER', 'EDDB', 'Berlin Brandenburg Airport', 'Berlin', 'Germany', 52.362247, 13.500672, 'Europe/Berlin'),
    ('JFK', 'KJFK', 'John F. Kennedy International Airport', 'New York', 'United States', 40.6413, -73.7781, 'America/New_York'),
    ('LAX', 'KLAX', 'Los Angeles International Airport', 'Los Angeles', 'United States', 33.9416, -118.4085, 'America/Los_Angeles'),
    ('SFO', 'KSFO', 'San Francisco International Airport', 'San Francisco', 'United States', 37.6213, -122.3790, 'America/Los_Angeles'),
    ('DXB', 'OMDB', 'Dubai International Airport', 'Dubai', 'United Arab Emirates', 25.2532, 55.3657, 'Asia/Dubai'),
    ('DOH', 'OTHH', 'Hamad International Airport', 'Doha', 'Qatar', 25.2731, 51.6081, 'Asia/Qatar'),
    ('SIN', 'WSSS', 'Singapore Changi Airport', 'Singapore', 'Singapore', 1.3644, 103.9915, 'Asia/Singapore'),
    ('HND', 'RJTT', 'Tokyo Haneda Airport', 'Tokyo', 'Japan', 35.5494, 139.7798, 'Asia/Tokyo'),
    ('NRT', 'RJAA', 'Narita International Airport', 'Tokyo', 'Japan', 35.7719, 140.3929, 'Asia/Tokyo'),
    ('PVG', 'ZSPD', 'Shanghai Pudong International Airport', 'Shanghai', 'China', 31.1443, 121.8083, 'Asia/Shanghai'),
    ('PEK', 'ZBAA', 'Beijing Capital International Airport', 'Beijing', 'China', 40.0799, 116.6031, 'Asia/Shanghai'),
    ('SYD', 'YSSY', 'Sydney Kingsford Smith Airport', 'Sydney', 'Australia', -33.9399, 151.1753, 'Australia/Sydney')
ON CONFLICT (iata_code) DO NOTHING;

INSERT INTO airlines (code, name, country) VALUES
    ('AW', 'AeroWay Airlines', 'Germany'),
    ('UA', 'United Airlines', 'United States'),
    ('DL', 'Delta Air Lines', 'United States'),
    ('EK', 'Emirates', 'United Arab Emirates'),
    ('QR', 'Qatar Airways', 'Qatar'),
    ('SQ', 'Singapore Airlines', 'Singapore'),
    ('JL', 'Japan Airlines', 'Japan'),
    ('CA', 'Air China', 'China'),
    ('MU', 'China Eastern Airlines', 'China'),
    ('QF', 'Qantas', 'Australia')
ON CONFLICT (code) DO NOTHING;

WITH route_templates (airline_code, origin, destination, equipment, base_price_cents) AS (
    VALUES
        ('AW', 'BER', 'LIS', 'Airbus A320', 13900),
        ('AW', 'BER', 'AMS', 'Airbus A320', 9900),
        ('AW', 'BER', 'CDG', 'Airbus A320', 11900),
        ('AW', 'BER', 'FCO', 'Airbus A321', 14900),
        ('AW', 'BER', 'BCN', 'Airbus A320', 12900),
        ('LH', 'FRA', 'JFK', 'Airbus A340', 48900),
        ('LH', 'FRA', 'LAX', 'Airbus A350', 55900),
        ('LH', 'MUC', 'JFK', 'Airbus A350', 51900),
        ('BA', 'LHR', 'JFK', 'Boeing 777', 46900),
        ('BA', 'LHR', 'LAX', 'Boeing 787', 57900),
        ('AF', 'CDG', 'JFK', 'Boeing 777', 45900),
        ('AF', 'CDG', 'NRT', 'Boeing 787', 62900),
        ('KL', 'AMS', 'JFK', 'Boeing 787', 44900),
        ('KL', 'AMS', 'SIN', 'Boeing 777', 64900),
        ('IB', 'MAD', 'JFK', 'Airbus A330', 42900),
        ('IB', 'MAD', 'LAX', 'Airbus A350', 54900),
        ('EK', 'DXB', 'LHR', 'Airbus A380', 39900),
        ('EK', 'DXB', 'JFK', 'Airbus A380', 69900),
        ('EK', 'DXB', 'SIN', 'Boeing 777', 29900),
        ('QR', 'DOH', 'LHR', 'Airbus A350', 38900),
        ('QR', 'DOH', 'JFK', 'Airbus A350', 67900),
        ('QR', 'DOH', 'SYD', 'Airbus A350', 75900),
        ('SQ', 'SIN', 'LHR', 'Airbus A380', 68900),
        ('SQ', 'SIN', 'HND', 'Boeing 787', 31900),
        ('SQ', 'SIN', 'SYD', 'Airbus A350', 34900),
        ('JL', 'HND', 'LHR', 'Boeing 787', 69900),
        ('JL', 'HND', 'SFO', 'Boeing 777', 62900),
        ('CA', 'PEK', 'FRA', 'Boeing 777', 61900),
        ('CA', 'PEK', 'LHR', 'Airbus A350', 63900),
        ('MU', 'PVG', 'CDG', 'Boeing 777', 59900),
        ('MU', 'PVG', 'LAX', 'Boeing 777', 65900),
        ('QF', 'SYD', 'LAX', 'Boeing 787', 71900),
        ('QF', 'SYD', 'SIN', 'Airbus A330', 39900),
        ('UA', 'JFK', 'LHR', 'Boeing 767', 43900),
        ('UA', 'SFO', 'HND', 'Boeing 777', 66900),
        ('DL', 'JFK', 'CDG', 'Airbus A330', 44900),
        ('DL', 'LAX', 'SYD', 'Airbus A350', 72900)
),
bidirectional_routes AS (
    SELECT * FROM route_templates
    UNION ALL
    SELECT airline_code, destination, origin, equipment, base_price_cents + 2500
    FROM route_templates
),
schedule (day_offset, departure_time) AS (
    VALUES
        (1, TIME '07:15'),
        (2, TIME '10:40'),
        (3, TIME '14:20'),
        (5, TIME '18:05'),
        (7, TIME '21:30'),
        (10, TIME '09:25'),
        (14, TIME '16:45'),
        (21, TIME '12:10')
),
numbered_flights AS (
    SELECT
        airline_code,
        origin,
        destination,
        equipment,
        base_price_cents + (day_offset * 80) AS base_price_cents,
        (CURRENT_DATE + day_offset + departure_time) AT TIME ZONE 'UTC' AS departure_time,
        airline_code || (7000 + row_number() OVER (
            ORDER BY origin, destination, airline_code, day_offset, departure_time
        ))::text AS flight_number
    FROM bidirectional_routes
    CROSS JOIN schedule
)
INSERT INTO flights (
    flight_number,
    origin,
    destination,
    departure_time,
    airline_code,
    equipment,
    base_price_cents
)
SELECT
    flight_number,
    origin,
    destination,
    departure_time,
    airline_code,
    equipment,
    base_price_cents
FROM numbered_flights
ON CONFLICT (flight_number) DO NOTHING;

WITH seat_template (seat_number, cabin_class) AS (
    VALUES
        ('1A', 'BUSINESS'),
        ('1B', 'BUSINESS'),
        ('1C', 'BUSINESS'),
        ('2A', 'PREMIUM'),
        ('2B', 'PREMIUM'),
        ('2C', 'PREMIUM'),
        ('10A', 'ECONOMY'),
        ('10B', 'ECONOMY'),
        ('10C', 'ECONOMY'),
        ('10D', 'ECONOMY'),
        ('14A', 'ECONOMY'),
        ('14B', 'ECONOMY'),
        ('14C', 'ECONOMY'),
        ('14D', 'ECONOMY'),
        ('18A', 'ECONOMY'),
        ('18B', 'ECONOMY'),
        ('18C', 'ECONOMY'),
        ('18D', 'ECONOMY')
)
INSERT INTO seats (flight_id, seat_number, cabin_class)
SELECT
    f.id,
    st.seat_number,
    st.cabin_class
FROM flights f
CROSS JOIN seat_template st
WHERE f.flight_number ~ '^(AW|LH|BA|AF|KL|IB|EK|QR|SQ|JL|CA|MU|QF|UA|DL)7[0-9]+$'
ON CONFLICT (flight_id, seat_number) DO NOTHING;
