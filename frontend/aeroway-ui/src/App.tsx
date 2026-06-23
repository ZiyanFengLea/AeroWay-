import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ApiError,
  cancelReservation,
  confirmBooking,
  fetchFlights,
  fetchSeats,
  holdSeat,
  runAvailabilityIntegrityCheck,
} from "./api";
import type {
  AvailabilityIntegrityResponse,
  FlightResponse,
  ReservationResponse,
  SeatResponse,
} from "./types";

type BookingStep = "search" | "flights" | "seats" | "passenger" | "confirmation";

const steps: Array<{ id: BookingStep; label: string }> = [
  { id: "search", label: "Search" },
  { id: "flights", label: "Flights" },
  { id: "seats", label: "Seats" },
  { id: "passenger", label: "Passenger" },
  { id: "confirmation", label: "Confirmation" },
];

const airportOptions = [
  { code: "AMS", label: "Amsterdam Airport Schiphol", city: "Amsterdam" },
  { code: "ARN", label: "Stockholm-Arlanda Airport", city: "Stockholm" },
  { code: "ATH", label: "Athens International Airport", city: "Athens" },
  { code: "BCN", label: "Barcelona Airport", city: "Barcelona" },
  { code: "BER", label: "Berlin Brandenburg Airport", city: "Berlin" },
  { code: "BRU", label: "Brussels Airport", city: "Brussels" },
  { code: "BUD", label: "Budapest Airport", city: "Budapest" },
  { code: "CDG", label: "Paris Charles de Gaulle", city: "Paris" },
  { code: "CPH", label: "Copenhagen Airport", city: "Copenhagen" },
  { code: "DOH", label: "Hamad International Airport", city: "Doha" },
  { code: "DUB", label: "Dublin Airport", city: "Dublin" },
  { code: "DXB", label: "Dubai International Airport", city: "Dubai" },
  { code: "FCO", label: "Rome Fiumicino Airport", city: "Rome" },
  { code: "FRA", label: "Frankfurt Airport", city: "Frankfurt" },
  { code: "HND", label: "Tokyo Haneda Airport", city: "Tokyo" },
  { code: "JFK", label: "John F. Kennedy International Airport", city: "New York" },
  { code: "LAX", label: "Los Angeles International Airport", city: "Los Angeles" },
  { code: "LHR", label: "London Heathrow Airport", city: "London" },
  { code: "LIS", label: "Lisbon Airport", city: "Lisbon" },
  { code: "MAD", label: "Madrid-Barajas Airport", city: "Madrid" },
  { code: "MUC", label: "Munich Airport", city: "Munich" },
  { code: "NRT", label: "Tokyo Narita Airport", city: "Tokyo" },
  { code: "PEK", label: "Beijing Capital Airport", city: "Beijing" },
  { code: "PVG", label: "Shanghai Pudong Airport", city: "Shanghai" },
  { code: "SFO", label: "San Francisco International Airport", city: "San Francisco" },
  { code: "SIN", label: "Singapore Changi Airport", city: "Singapore" },
  { code: "SYD", label: "Sydney Airport", city: "Sydney" },
  { code: "VIE", label: "Vienna International Airport", city: "Vienna" },
  { code: "WAW", label: "Warsaw Chopin Airport", city: "Warsaw" },
  { code: "ZRH", label: "Zurich Airport", city: "Zurich" },
];

export function App() {
  const [step, setStep] = useState<BookingStep>("search");
  const [flights, setFlights] = useState<FlightResponse[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightResponse | null>(null);
  const [seats, setSeats] = useState<SeatResponse[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SeatResponse | null>(null);
  const [origin, setOrigin] = useState("BER");
  const [destination, setDestination] = useState("LIS");
  const [travelDate, setTravelDate] = useState(getTomorrowDate());
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
  const [holdingSeat, setHoldingSeat] = useState(false);
  const [runningIntegrityCheck, setRunningIntegrityCheck] = useState(false);
  const [confirmIdempotencyKey, setConfirmIdempotencyKey] = useState(() => createIdempotencyKey());
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false);

  useEffect(() => {
    loadFlights("search");
  }, []);

  const availableSeatCount = useMemo(
    () => seats.filter((seat) => !seat.reserved).length,
    [seats]
  );

  const airlineOptions = useMemo(() => {
    const options = new Map<string, string>();
    flights.forEach((flight) => {
      if (flight.airlineCode) {
        options.set(flight.airlineCode, flight.airlineName ?? flight.airlineCode);
      }
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [flights]);

  async function loadFlights(nextStep: BookingStep = "flights") {
    setLoadingFlights(true);
    setStatusMessage("");
    try {
      const data = await fetchFlights(searchParams());
      if (data.length === 0 && hasActiveSearch()) {
        const suggestedFlights = await fetchFallbackFlights();
        setFlights(suggestedFlights);
        setSelectedFlight(null);
        setStatusMessage(fallbackMessage(suggestedFlights));
      } else {
        setFlights(data);
        setSelectedFlight((current) => data.find((flight) => flight.id === current?.id) ?? null);
      }
      setSelectedSeat(null);
      setReservation(null);
      if (nextStep !== "search") {
        setStep(nextStep);
      }
    } catch {
      setStatusMessage("Flights could not be loaded. Please check the booking service.");
    } finally {
      setLoadingFlights(false);
    }
  }

  function searchParams() {
    return {
      origin,
      destination,
      departureDate: travelDate,
      airlineCode,
      maxPriceCents: maxPrice ? Number(maxPrice) * 100 : undefined,
      cabinClass,
      directOnly,
      departureTimeFrom,
      departureTimeTo,
    };
  }

  async function fetchFallbackFlights() {
    if (origin && destination) {
      const sameRoute = await fetchFlights({ origin, destination, directOnly });
      if (sameRoute.length > 0) {
        return sameRoute;
      }
    }

    if (origin) {
      const sameOrigin = await fetchFlights({ origin, directOnly });
      if (sameOrigin.length > 0) {
        return sameOrigin;
      }
    }

    if (destination) {
      const sameDestination = await fetchFlights({ destination, directOnly });
      if (sameDestination.length > 0) {
        return sameDestination;
      }
    }

    return fetchFlights();
  }

  function fallbackMessage(suggestedFlights: FlightResponse[]) {
    if (suggestedFlights.length === 0) {
      return "No flights are currently available. Please edit your search.";
    }
    if (origin && destination && suggestedFlights.every((flight) => flight.origin === origin && flight.destination === destination)) {
      return "No exact match for the selected filters, so showing the same route on available dates.";
    }
    if (origin && suggestedFlights.every((flight) => flight.origin === origin)) {
      return "No exact match for the selected filters, so showing flights from the same departure airport.";
    }
    if (destination && suggestedFlights.every((flight) => flight.destination === destination)) {
      return "No exact match for the selected filters, so showing flights to the same destination.";
    }
    return "No exact matches were found, so here are available flights you can book now.";
  }

  function hasActiveSearch() {
    return Boolean(
      origin ||
        destination ||
        travelDate ||
        airlineCode ||
        maxPrice ||
        cabinClass ||
        departureTimeFrom ||
        departureTimeTo ||
        !directOnly
    );
  }

  async function loadSeats(flightId: string) {
    setLoadingSeats(true);
    setStatusMessage("");
    try {
      setSeats(await fetchSeats(flightId));
    } catch {
      setStatusMessage("Seat availability could not be loaded for this flight.");
    } finally {
      setLoadingSeats(false);
    }
  }

  async function chooseFlight(flight: FlightResponse) {
    setSelectedFlight(flight);
    setSelectedSeat(null);
    setReservation(null);
    await loadSeats(flight.id);
    setStep("seats");
  }

  async function chooseSeat(seat: SeatResponse) {
    if (!selectedFlight) {
      return;
    }

    setHoldingSeat(true);
    setSelectedSeat(seat);
    setStatusMessage("");
    setReservation(null);
    try {
      const hold = await holdSeat(
        selectedFlight.id,
        seat.id,
        customerName,
        customerEmail,
        documentNumber,
        passengerType
      );
      setReservation(hold);
      setConfirmIdempotencyKey(createIdempotencyKey());
      setStatusMessage(`Seat ${seat.seatNumber} is held for 5 minutes while you complete booking.`);
      await loadSeats(selectedFlight.id);
      setStep("passenger");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStatusMessage("This seat is no longer available. Please choose another seat.");
        await loadSeats(selectedFlight.id);
      } else if (error instanceof ApiError) {
        setStatusMessage(`Seat hold could not be created (${error.status}). ${error.message}`);
      } else {
        setStatusMessage("Seat hold could not be created. Please try again.");
      }
      setSelectedSeat(null);
    } finally {
      setHoldingSeat(false);
    }
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFlight || !selectedSeat || !reservation) {
      return;
    }

    setReserving(true);
    setStatusMessage("");
    try {
      const response = await confirmBooking(
        reservation.reservationId,
        confirmIdempotencyKey,
        simulatePaymentFailure,
        customerName,
        customerEmail,
        documentNumber,
        passengerType
      );
      setReservation(response);
      await loadSeats(selectedFlight.id);
      setStep("confirmation");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStatusMessage("This seat hold expired or was no longer available. Please choose another seat.");
        await loadSeats(selectedFlight.id);
        setStep("seats");
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
      await loadSeats(selectedFlight.id);
    } catch {
      setStatusMessage("Booking could not be cancelled. Please try again.");
    }
  }

  function startNewSearch() {
    setSelectedFlight(null);
    setSelectedSeat(null);
    setReservation(null);
    setStatusMessage("");
    setConfirmIdempotencyKey(createIdempotencyKey());
    setSimulatePaymentFailure(false);
    setStep("search");
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div>
          <strong>AeroWay</strong>
          <span>Flight booking</span>
        </div>
        <a href="http://localhost:8080/swagger-ui/index.html" target="_blank" rel="noreferrer">
          API docs
        </a>
      </header>

      <section className="booking-shell">
        <aside className="trip-summary">
          <p className="eyebrow">Your trip</p>
          <h1>Book a flight</h1>
          <div className="summary-line">
            <span>Route</span>
            <strong>
              {selectedFlight
                ? `${selectedFlight.origin} to ${selectedFlight.destination}`
                : origin || destination
                  ? `${origin || "Any"} to ${destination || "Any"}`
                  : "Choose a route"}
            </strong>
          </div>
          <div className="summary-line">
            <span>Flight</span>
            <strong>{selectedFlight?.flightNumber ?? "Not selected"}</strong>
          </div>
          <div className="summary-line">
            <span>Seat</span>
            <strong>{selectedSeat?.seatNumber ?? reservation?.seatNumber ?? "Not selected"}</strong>
          </div>
          <div className="summary-line">
            <span>Status</span>
            <strong>{reservation?.status ?? "In progress"}</strong>
          </div>
        </aside>

        <section className="booking-main">
          <StepIndicator currentStep={step} />
          {statusMessage && <div className="notice">{statusMessage}</div>}

          {step === "search" && (
            <section className="booking-card">
              <div className="card-heading">
                <p className="eyebrow">Step 1</p>
                <h2>Where would you like to go?</h2>
              </div>
              <div className="search-panel compact">
                <Field label="From" htmlFor="origin">
                  <AirportInput
                    id="origin"
                    placeholder="BER"
                    value={origin}
                    onChange={setOrigin}
                  />
                </Field>
                <Field label="To" htmlFor="destination">
                  <AirportInput
                    id="destination"
                    placeholder="LIS"
                    value={destination}
                    onChange={setDestination}
                  />
                </Field>
                <Field label="Departure" htmlFor="travelDate">
                  <input
                    id="travelDate"
                    type="date"
                    value={travelDate}
                    onChange={(event) => setTravelDate(event.target.value)}
                  />
                </Field>
                <Field label="Airline" htmlFor="airlineCode">
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
                </Field>
                <Field label="Max price" htmlFor="maxPrice">
                  <input
                    id="maxPrice"
                    min="0"
                    placeholder="250"
                    type="number"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                  />
                </Field>
                <Field label="Cabin" htmlFor="cabinClass">
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
                </Field>
                <Field label="After" htmlFor="departureTimeFrom">
                  <input
                    id="departureTimeFrom"
                    type="time"
                    value={departureTimeFrom}
                    onChange={(event) => setDepartureTimeFrom(event.target.value)}
                  />
                </Field>
                <Field label="Before" htmlFor="departureTimeTo">
                  <input
                    id="departureTimeTo"
                    type="time"
                    value={departureTimeTo}
                    onChange={(event) => setDepartureTimeTo(event.target.value)}
                  />
                </Field>
                <label className="checkbox-row" htmlFor="directOnly">
                  <input
                    checked={directOnly}
                    id="directOnly"
                    type="checkbox"
                    onChange={(event) => setDirectOnly(event.target.checked)}
                  />
                  Direct only
                </label>
              </div>
              <div className="step-actions">
                <button className="primary" type="button" onClick={() => loadFlights("flights")}>
                  {loadingFlights ? "Searching..." : "Search flights"}
                </button>
              </div>
            </section>
          )}

          {step === "flights" && (
            <section className="booking-card">
              <div className="card-heading split">
                <div>
                  <p className="eyebrow">Step 2</p>
                  <h2>Choose your flight</h2>
                </div>
                <button type="button" onClick={() => setStep("search")}>
                  Edit search
                </button>
              </div>
              {loadingFlights ? (
                <p className="muted">Loading flights...</p>
              ) : (
                <div className="flight-list">
                  {flights.map((flight) => (
                    <button className="flight-row" key={flight.id} onClick={() => chooseFlight(flight)}>
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
                        {flight.durationMinutes ? ` · ${formatDuration(flight.durationMinutes)}` : ""}
                        {flight.equipment ? ` · ${flight.equipment}` : ""}
                      </small>
                      <span className="price">
                        {flight.basePriceCents ? `from ${formatPrice(flight.basePriceCents)}` : "Price pending"}
                      </span>
                    </button>
                  ))}
                  {flights.length === 0 && (
                    <p className="muted">No flights match your current search.</p>
                  )}
                </div>
              )}
            </section>
          )}

          {step === "seats" && selectedFlight && (
            <section className="booking-card">
              <div className="card-heading split">
                <div>
                  <p className="eyebrow">Step 3</p>
                  <h2>Select a seat</h2>
                </div>
                <button type="button" onClick={() => setStep("flights")}>
                  Change flight
                </button>
              </div>
              <FlightDetails flight={selectedFlight} availableSeatCount={availableSeatCount} />
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
                      <button disabled={seat.reserved || holdingSeat} onClick={() => chooseSeat(seat)}>
                        {holdingSeat && selectedSeat?.id === seat.id ? "Holding..." : "Choose seat"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === "passenger" && selectedFlight && selectedSeat && (
            <section className="booking-card">
              <div className="card-heading split">
                <div>
                  <p className="eyebrow">Step 4</p>
                  <h2>Passenger details</h2>
                </div>
                <button type="button" onClick={() => setStep("seats")}>
                  Change seat
                </button>
              </div>
              <div className="checkout-layout">
                <div className="fare-card">
                  <strong>
                    {selectedFlight.flightNumber} · Seat {selectedSeat.seatNumber}
                  </strong>
                  <span>
                    {selectedFlight.origin} to {selectedFlight.destination}
                  </span>
                  <span>{formatDate(selectedFlight.departureTime)}</span>
                  <span>{selectedSeat.cabinClass}</span>
                  {reservation?.holdExpiresAt && (
                    <span>Held until {formatDate(reservation.holdExpiresAt)}</span>
                  )}
                  <strong>
                    {selectedFlight.basePriceCents
                      ? formatPrice(selectedFlight.basePriceCents)
                      : "Fare pending"}
                  </strong>
                </div>
                <form onSubmit={submitReservation}>
                  <Field label="Passenger name" htmlFor="customerName">
                    <input
                      id="customerName"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Email" htmlFor="customerEmail">
                    <input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Passport or document number" htmlFor="documentNumber">
                    <input
                      id="documentNumber"
                      value={documentNumber}
                      onChange={(event) => setDocumentNumber(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Passenger type" htmlFor="passengerType">
                    <select
                      id="passengerType"
                      value={passengerType}
                      onChange={(event) => setPassengerType(event.target.value)}
                    >
                      <option value="ADULT">Adult</option>
                      <option value="STUDENT">Student</option>
                      <option value="CHILD">Child</option>
                    </select>
                  </Field>
                  <label className="checkbox-row payment-option" htmlFor="simulatePaymentFailure">
                    <input
                      checked={simulatePaymentFailure}
                      id="simulatePaymentFailure"
                      type="checkbox"
                      onChange={(event) => setSimulatePaymentFailure(event.target.checked)}
                    />
                    Simulate payment failure
                  </label>
                  <p className="muted">
                    Complete booking uses an idempotency key, so retrying this request returns the
                    same booking result instead of creating a duplicate order.
                  </p>
                  <div className="step-actions">
                    <button className="primary" disabled={reserving} type="submit">
                      {reserving ? "Processing payment..." : "Complete booking"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {step === "confirmation" && reservation && (
            <section className="booking-card">
              <div className="card-heading split">
                <div>
                  <p className="eyebrow">Step 5</p>
                  <h2>Booking {reservation.status.toLowerCase()}</h2>
                </div>
                <button type="button" onClick={startNewSearch}>
                  New search
                </button>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Booking number</dt>
                  <dd>{reservation.bookingReference ?? reservation.reservationId}</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>{reservation.paymentStatus ?? "N/A"}</dd>
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
                {reservation.holdExpiresAt && reservation.status === "HELD" && (
                  <div>
                    <dt>Hold expires</dt>
                    <dd>{formatDate(reservation.holdExpiresAt)}</dd>
                  </div>
                )}
              </dl>
              <div className="step-actions">
                {reservation.status === "CONFIRMED" && (
                  <button type="button" onClick={handleCancelReservation}>
                    Cancel booking
                  </button>
                )}
                <button className="primary" type="button" onClick={startNewSearch}>
                  Book another flight
                </button>
              </div>
            </section>
          )}

          <section className="booking-card availability-card">
            <div className="card-heading split">
              <div>
                <p className="eyebrow">Seat availability</p>
                <h2>Protection check</h2>
              </div>
              <button className="primary" disabled={runningIntegrityCheck} onClick={handleRunIntegrityCheck}>
                {runningIntegrityCheck ? "Checking..." : "Run 100 booking attempts"}
              </button>
            </div>
            <div className="integrity-grid">
              {integrityCheckResult ? (
                <>
                  <ResultCard label="Attempts" value={integrityCheckResult.attempts} />
                  <ResultCard label="Confirmed" value={integrityCheckResult.successfulReservations} />
                  <ResultCard label="Conflicts" value={integrityCheckResult.conflicts} />
                  <ResultCard
                    label="Duplicates stored"
                    value={integrityCheckResult.duplicateReservationsInDatabase}
                  />
                </>
              ) : (
                <p className="muted">
                  Run this check to verify that only one booking is stored when many customers try
                  to reserve the same seat at the same time.
                </p>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function StepIndicator({ currentStep }: { currentStep: BookingStep }) {
  const currentIndex = steps.findIndex((item) => item.id === currentStep);
  return (
    <nav className="stepper" aria-label="Booking progress">
      {steps.map((item, index) => (
        <div
          className={`stepper-item ${index <= currentIndex ? "active" : ""} ${
            item.id === currentStep ? "current" : ""
          }`}
          key={item.id}
        >
          <span>{index + 1}</span>
          <strong>{item.label}</strong>
        </div>
      ))}
    </nav>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function AirportInput({
  id,
  onChange,
  placeholder,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <>
      <input
        autoComplete="off"
        id={id}
        list={`${id}-airport-options`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
      <datalist id={`${id}-airport-options`}>
        {airportOptions.map((airport) => (
          <option
            key={airport.code}
            value={airport.code}
            label={`${airport.city} - ${airport.label}`}
          />
        ))}
      </datalist>
    </>
  );
}

function FlightDetails({
  availableSeatCount,
  flight,
}: {
  availableSeatCount: number;
  flight: FlightResponse;
}) {
  return (
    <dl className="detail-grid flight-details">
      <div>
        <dt>Route</dt>
        <dd>
          {flight.originAirportName ?? flight.origin} to{" "}
          {flight.destinationAirportName ?? flight.destination}
        </dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{formatDuration(flight.durationMinutes)}</dd>
      </div>
      <div>
        <dt>Aircraft</dt>
        <dd>{flight.equipment ?? "N/A"}</dd>
      </div>
      <div>
        <dt>Available seats</dt>
        <dd>{flight.availableSeatCount ?? availableSeatCount}</dd>
      </div>
      <div>
        <dt>Starting fare</dt>
        <dd>{flight.basePriceCents ? formatPrice(flight.basePriceCents) : "N/A"}</dd>
      </div>
      <div>
        <dt>Baggage</dt>
        <dd>1 cabin bag included. Checked baggage available at airport counter.</dd>
      </div>
    </dl>
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

function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function createIdempotencyKey() {
  return `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
