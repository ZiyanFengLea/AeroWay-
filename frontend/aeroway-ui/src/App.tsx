import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  cancelReservation,
  fetchFlights,
  fetchSeats,
  reserveSeat,
  runAvailabilityIntegrityCheck,
} from "./api";
import type {
  FlightResponse,
  ReservationResponse,
  AvailabilityIntegrityResponse,
  SeatResponse,
} from "./types";

export function App() {
  const [flights, setFlights] = useState<FlightResponse[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightResponse | null>(null);
  const [seats, setSeats] = useState<SeatResponse[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SeatResponse | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [cabinClass, setCabinClass] = useState("");
  const [departureTimeFrom, setDepartureTimeFrom] = useState("");
  const [departureTimeTo, setDepartureTimeTo] = useState("");
  const [directOnly, setDirectOnly] = useState(true);
  const [customerName, setCustomerName] = useState("Ziyan Feng");
  const [customerEmail, setCustomerEmail] = useState("ziyan@example.com");
  const [documentNumber, setDocumentNumber] = useState("P12345678");
  const [passengerType, setPassengerType] = useState("ADULT");
  const [statusMessage, setStatusMessage] = useState("");
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [integrityCheckResult, setIntegrityCheckResult] =
    useState<AvailabilityIntegrityResponse | null>(null);
  const [loadingFlights, setLoadingFlights] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [runningIntegrityCheck, setRunningIntegrityCheck] = useState(false);

  useEffect(() => {
    loadFlights();
  }, []);

  const availableSeatCount = useMemo(
    () => seats.filter((seat) => !seat.reserved).length,
    [seats]
  );
  const reservedSeatCount = seats.length - availableSeatCount;
  const airlineOptions = useMemo(() => {
    const options = new Map<string, string>();
    flights.forEach((flight) => {
      if (flight.airlineCode) {
        options.set(flight.airlineCode, flight.airlineName ?? flight.airlineCode);
      }
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [flights]);

  async function loadFlights() {
    setLoadingFlights(true);
    setStatusMessage("");
    try {
      const data = await fetchFlights({
        origin,
        destination,
        departureDate: travelDate,
        airlineCode,
        maxPriceCents: maxPrice ? Number(maxPrice) * 100 : undefined,
        cabinClass,
        directOnly,
        departureTimeFrom,
        departureTimeTo,
      });
      setFlights(data);
      if (data.length > 0) {
        setSelectedFlight(data[0]);
        await loadSeats(data[0].id);
      }
    } catch {
      setStatusMessage("Flights could not be loaded. Please check the booking service.");
    } finally {
      setLoadingFlights(false);
    }
  }

  async function loadSeats(flightId: string) {
    setLoadingSeats(true);
    try {
      const data = await fetchSeats(flightId);
      setSeats(data);
    } catch {
      setStatusMessage("Seat availability could not be loaded for this flight.");
    } finally {
      setLoadingSeats(false);
    }
  }

  async function selectFlight(flight: FlightResponse) {
    setSelectedFlight(flight);
    setSelectedSeat(null);
    setReservation(null);
    setStatusMessage("");
    await loadSeats(flight.id);
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFlight || !selectedSeat) {
      return;
    }

    setReserving(true);
    setStatusMessage("");
    setReservation(null);
    try {
      const response = await reserveSeat(
        selectedFlight.id,
        selectedSeat.id,
        customerName,
        customerEmail,
        documentNumber,
        passengerType
      );
      setReservation(response);
      setStatusMessage(`Seat ${selectedSeat.seatNumber} is confirmed for ${response.customerName}.`);
      setSelectedSeat(null);
      await loadSeats(selectedFlight.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStatusMessage("This seat has already been reserved. Please choose another seat.");
        await loadSeats(selectedFlight.id);
      } else {
        setStatusMessage("Booking could not be completed. Please try again.");
      }
    } finally {
      setReserving(false);
    }
  }

  async function handleRunIntegrityCheck() {
    setRunningIntegrityCheck(true);
    setIntegrityCheckResult(null);
    setStatusMessage("");
    try {
      setIntegrityCheckResult(await runAvailabilityIntegrityCheck());
    } catch {
      setStatusMessage("Availability check could not be completed. Please check the booking service.");
    } finally {
      setRunningIntegrityCheck(false);
    }
  }

  async function handleCancelReservation() {
    if (!reservation || !selectedFlight) {
      return;
    }
    setStatusMessage("");
    try {
      const cancelled = await cancelReservation(reservation.reservationId);
      setReservation(cancelled);
      setStatusMessage("Booking has been cancelled. The seat is available again.");
      await loadSeats(selectedFlight.id);
      await loadFlights();
    } catch {
      setStatusMessage("Booking could not be cancelled. Please try again.");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero" id="overview">
        <div>
          <p className="eyebrow">Secure flight booking</p>
          <h1>AeroWay</h1>
          <p className="hero-copy">
            Search flights, choose a seat, and complete reservations with real-time availability.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#flights">
              Book a flight
            </a>
            <a className="button" href="#availability">
              Check seat protection
            </a>
          </div>
        </div>
      </section>

      <section className="workspace" id="flights">
        <section className="search-panel">
          <div>
            <label htmlFor="origin">From</label>
            <input
              id="origin"
              placeholder="BER"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="destination">To</label>
            <input
              id="destination"
              placeholder="LIS"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="travelDate">Departure</label>
            <input
              id="travelDate"
              type="date"
              value={travelDate}
              onChange={(event) => setTravelDate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="airlineCode">Airline</label>
            <select
              id="airlineCode"
              value={airlineCode}
              onChange={(event) => setAirlineCode(event.target.value)}
            >
              <option value="">Any airline</option>
              {airlineOptions.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="maxPrice">Max price</label>
            <input
              id="maxPrice"
              min="0"
              placeholder="250"
              type="number"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cabinClass">Cabin</label>
            <select
              id="cabinClass"
              value={cabinClass}
              onChange={(event) => setCabinClass(event.target.value)}
            >
              <option value="">Any cabin</option>
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM">Premium</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
          <div>
            <label htmlFor="departureTimeFrom">After</label>
            <input
              id="departureTimeFrom"
              type="time"
              value={departureTimeFrom}
              onChange={(event) => setDepartureTimeFrom(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="departureTimeTo">Before</label>
            <input
              id="departureTimeTo"
              type="time"
              value={departureTimeTo}
              onChange={(event) => setDepartureTimeTo(event.target.value)}
            />
          </div>
          <label className="checkbox-row" htmlFor="directOnly">
            <input
              checked={directOnly}
              id="directOnly"
              type="checkbox"
              onChange={(event) => setDirectOnly(event.target.checked)}
            />
            Direct only
          </label>
          <button className="primary" type="button" onClick={loadFlights}>
            Search flights
          </button>
        </section>

        <div className="section-heading">
          <div>
            <p className="eyebrow">Available trips</p>
            <h2>Choose your flight and seat</h2>
          </div>
          <div className="metric-group">
            <span className="metric">{availableSeatCount} seats available</span>
            <span className="metric secondary">{reservedSeatCount} reserved</span>
          </div>
        </div>

        {statusMessage && <div className="notice">{statusMessage}</div>}
        {reservation && (
          <div className="success">
            Reservation confirmed: {reservation.reservationId}
          </div>
        )}

        <div className="two-column" id="results">
          <section className="panel">
            <h3>Flights</h3>
            {loadingFlights ? (
              <p className="muted">Loading flights...</p>
            ) : (
              <div className="flight-list">
                {flights.map((flight) => (
                  <button
                    className={`flight-row ${selectedFlight?.id === flight.id ? "selected" : ""}`}
                    key={flight.id}
                    onClick={() => selectFlight(flight)}
                  >
                    <div className="flight-main">
                      <strong>{flight.flightNumber}</strong>
                      <span>{flight.airlineName ?? "AeroWay Partner"}</span>
                    </div>
                    <span className="route-line">
                      {flight.origin} {flight.originCity ? `(${flight.originCity})` : ""} to{" "}
                      {flight.destination}{" "}
                      {flight.destinationCity ? `(${flight.destinationCity})` : ""}
                    </span>
                    <small>
                      {formatDate(flight.departureTime)}
                      {flight.equipment ? ` · ${flight.equipment}` : ""}
                    </small>
                    {flight.basePriceCents && (
                      <span className="price">from {formatPrice(flight.basePriceCents)}</span>
                    )}
                  </button>
                ))}
                {flights.length === 0 && (
                  <p className="muted">No flights match your current search.</p>
                )}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title-row">
              <h3>Seat map</h3>
              {selectedFlight && <span>{selectedFlight.flightNumber}</span>}
            </div>
            {loadingSeats ? (
              <p className="muted">Loading seats...</p>
            ) : (
              <div className="seat-grid">
                {seats.map((seat) => (
                  <article className={`seat-card ${seat.reserved ? "reserved" : ""}`} key={seat.id}>
                    <div>
                      <strong>{seat.seatNumber}</strong>
                      <span>{seat.cabinClass}</span>
                    </div>
                    <p>{seat.reserved ? "Reserved" : "Available"}</p>
                    <button
                      disabled={seat.reserved}
                      onClick={() => {
                        setSelectedSeat(seat);
                        setStatusMessage("");
                      }}
                    >
                      Select
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {selectedFlight && (
          <section className="flight-detail-panel">
            <div>
              <p className="eyebrow">Flight details</p>
              <h3>
                {selectedFlight.flightNumber} · {selectedFlight.airlineName ?? "AeroWay Partner"}
              </h3>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Route</dt>
                <dd>
                  {selectedFlight.originAirportName ?? selectedFlight.origin} to{" "}
                  {selectedFlight.destinationAirportName ?? selectedFlight.destination}
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(selectedFlight.durationMinutes)}</dd>
              </div>
              <div>
                <dt>Aircraft</dt>
                <dd>{selectedFlight.equipment ?? "N/A"}</dd>
              </div>
              <div>
                <dt>Available seats</dt>
                <dd>{selectedFlight.availableSeatCount ?? availableSeatCount}</dd>
              </div>
              <div>
                <dt>Starting fare</dt>
                <dd>{selectedFlight.basePriceCents ? formatPrice(selectedFlight.basePriceCents) : "N/A"}</dd>
              </div>
              <div>
                <dt>Baggage</dt>
                <dd>1 cabin bag included. Checked baggage available at airport counter.</dd>
              </div>
            </dl>
          </section>
        )}

        {selectedSeat && selectedFlight && (
          <section className="reservation-panel">
            <div>
              <p className="eyebrow">Booking details</p>
              <h3>Confirm seat {selectedSeat.seatNumber}</h3>
              <p className="muted">
                {selectedFlight.flightNumber}: {selectedFlight.origin} to {selectedFlight.destination}
              </p>
              <dl className="booking-summary">
                <div>
                  <dt>Carrier</dt>
                  <dd>{selectedFlight.airlineName ?? "AeroWay Partner"}</dd>
                </div>
                <div>
                  <dt>Departure</dt>
                  <dd>{formatDate(selectedFlight.departureTime)}</dd>
                </div>
                <div>
                  <dt>Cabin</dt>
                  <dd>{selectedSeat.cabinClass}</dd>
                </div>
                {selectedFlight.basePriceCents && (
                  <div>
                    <dt>Starting fare</dt>
                    <dd>{formatPrice(selectedFlight.basePriceCents)}</dd>
                  </div>
                )}
              </dl>
            </div>
            <form onSubmit={submitReservation}>
              <label htmlFor="customerName">Passenger name</label>
              <input
                id="customerName"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
              />
              <label htmlFor="customerEmail">Email</label>
              <input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                required
              />
              <label htmlFor="documentNumber">Passport or document number</label>
              <input
                id="documentNumber"
                value={documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
                required
              />
              <label htmlFor="passengerType">Passenger type</label>
              <select
                id="passengerType"
                value={passengerType}
                onChange={(event) => setPassengerType(event.target.value)}
              >
                <option value="ADULT">Adult</option>
                <option value="STUDENT">Student</option>
                <option value="CHILD">Child</option>
              </select>
              <div className="form-actions">
                <button className="primary" disabled={reserving} type="submit">
                  {reserving ? "Confirming..." : "Complete booking"}
                </button>
                <button type="button" onClick={() => setSelectedSeat(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {reservation && (
          <section className="confirmation-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Booking confirmation</p>
                <h2>{reservation.status}</h2>
              </div>
              {reservation.status === "CONFIRMED" && (
                <button type="button" onClick={handleCancelReservation}>
                  Cancel booking
                </button>
              )}
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Booking number</dt>
                <dd>{reservation.reservationId}</dd>
              </div>
              <div>
                <dt>Flight</dt>
                <dd>
                  {reservation.flightNumber}: {reservation.origin} to {reservation.destination}
                </dd>
              </div>
              <div>
                <dt>Seat</dt>
                <dd>
                  {reservation.seatNumber} · {reservation.cabinClass}
                </dd>
              </div>
              <div>
                <dt>Passenger</dt>
                <dd>
                  {reservation.customerName} · {reservation.passengerType}
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{reservation.customerEmail ?? "N/A"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(reservation.createdAt)}</dd>
              </div>
            </dl>
          </section>
        )}
      </section>

      <section className="integrity-section" id="availability">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Availability integrity</p>
            <h2>Validate booking protection</h2>
          </div>
          <button className="primary" disabled={runningIntegrityCheck} onClick={handleRunIntegrityCheck}>
            {runningIntegrityCheck ? "Checking..." : "Run 100-attempt availability check"}
          </button>
        </div>

        <div className="integrity-grid">
          {integrityCheckResult ? (
            <>
              <ResultCard label="Booking attempts" value={integrityCheckResult.attempts} />
              <ResultCard
                label="Confirmed bookings"
                value={integrityCheckResult.successfulReservations}
              />
              <ResultCard label="Rejected conflicts" value={integrityCheckResult.conflicts} />
              <ResultCard
                label="Duplicate bookings stored"
                value={integrityCheckResult.duplicateReservationsInDatabase}
              />
            </>
          ) : (
            <p className="muted">
              Run a live availability protection check to confirm that only one booking can be
              stored for a single seat, even when many requests arrive at once.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function ResultCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="result-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

function formatDuration(value?: number) {
  if (!value) {
    return "N/A";
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes}m`;
}
