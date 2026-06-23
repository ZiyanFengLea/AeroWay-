import { useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ApiError,
  cancelReservation,
  confirmBooking,
  fetchFlights,
  fetchSeats,
  holdSeat,
} from "./api";
import type {
  FlightResponse,
  ReservationResponse,
  SeatResponse,
} from "./types";

type BookingStep = "search" | "flights" | "seats" | "passenger" | "confirmation";
type AppView = "booking" | "account";
type UserProfile = {
  name: string;
  email: string;
  documentNumber: string;
  passengerType: string;
};
type FlightRecommendation = {
  flight: FlightResponse;
  reasons: string[];
};
type SeatRecommendation = {
  seat: SeatResponse;
  label: string;
  reason: string;
};

const defaultUserProfile: UserProfile = {
  name: "Ziyan Feng",
  email: "ziyan@example.com",
  documentNumber: "P12345678",
  passengerType: "ADULT",
};

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

const airlineOptions = [
  ["", "Any airline"],
  ["AW", "AeroWay Airlines"],
  ["LH", "Lufthansa"],
  ["BA", "British Airways"],
  ["AF", "Air France"],
  ["KL", "KLM Royal Dutch Airlines"],
  ["IB", "Iberia Airlines"],
  ["EK", "Emirates"],
  ["QR", "Qatar Airways"],
  ["SQ", "Singapore Airlines"],
  ["JL", "Japan Airlines"],
  ["CA", "Air China"],
  ["MU", "China Eastern Airlines"],
  ["QF", "Qantas"],
  ["UA", "United Airlines"],
  ["DL", "Delta Air Lines"],
] as const;

export function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [view, setView] = useState<AppView>("booking");
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
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    readStoredValue("aeroway.userProfile", defaultUserProfile)
  );
  const [viewedFlights, setViewedFlights] = useState<FlightResponse[]>(() =>
    readStoredValue("aeroway.viewedFlights", [])
  );
  const [favoriteFlights, setFavoriteFlights] = useState<FlightResponse[]>(() =>
    readStoredValue("aeroway.favoriteFlights", [])
  );
  const [bookingRecords, setBookingRecords] = useState<ReservationResponse[]>(() =>
    readStoredValue("aeroway.bookingRecords", [])
  );
  const [customerName, setCustomerName] = useState(() => userProfile.name);
  const [customerEmail, setCustomerEmail] = useState(() => userProfile.email);
  const [documentNumber, setDocumentNumber] = useState(() => userProfile.documentNumber);
  const [passengerType, setPassengerType] = useState(() => userProfile.passengerType);
  const [statusMessage, setStatusMessage] = useState("");
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [holdingSeat, setHoldingSeat] = useState(false);
  const [confirmIdempotencyKey, setConfirmIdempotencyKey] = useState(() => createIdempotencyKey());
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false);

  const availableSeatCount = useMemo(
    () => seats.filter((seat) => !seat.reserved).length,
    [seats]
  );
  const recommendedFlight = useMemo(
    () =>
      recommendFlight(flights, {
        departureTimeFrom,
        destination,
        directOnly,
        origin,
        viewedFlights,
      }),
    [departureTimeFrom, destination, directOnly, flights, origin, viewedFlights]
  );
  const seatRecommendations = useMemo(() => recommendSeats(seats), [seats]);
  const recommendedSeat = seatRecommendations[0] ?? null;

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

  function updateUserProfile(nextProfile: UserProfile) {
    setUserProfile(nextProfile);
    storeValue("aeroway.userProfile", nextProfile);
    setCustomerName(nextProfile.name);
    setCustomerEmail(nextProfile.email);
    setDocumentNumber(nextProfile.documentNumber);
    setPassengerType(nextProfile.passengerType);
  }

  function rememberViewedFlight(flight: FlightResponse) {
    setViewedFlights((current) => {
      const next = [flight, ...current.filter((item) => item.id !== flight.id)].slice(0, 8);
      storeValue("aeroway.viewedFlights", next);
      return next;
    });
  }

  function toggleFavoriteFlight(flight: FlightResponse) {
    setFavoriteFlights((current) => {
      const exists = current.some((item) => item.id === flight.id);
      const next = exists
        ? current.filter((item) => item.id !== flight.id)
        : [flight, ...current].slice(0, 12);
      storeValue("aeroway.favoriteFlights", next);
      return next;
    });
  }

  function isFavoriteFlight(flightId: string) {
    return favoriteFlights.some((flight) => flight.id === flightId);
  }

  function rememberBooking(record: ReservationResponse) {
    setBookingRecords((current) => {
      const next = [record, ...current.filter((item) => item.reservationId !== record.reservationId)];
      storeValue("aeroway.bookingRecords", next);
      return next;
    });
  }

  async function openFlightFromAccount(flight: FlightResponse) {
    setView("booking");
    await chooseFlight(flight);
  }

  async function chooseFlight(flight: FlightResponse) {
    rememberViewedFlight(flight);
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
      rememberBooking(response);
      updateUserProfile({ name: customerName, email: customerEmail, documentNumber, passengerType });
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

  async function handleCancelReservation() {
    if (!reservation || !selectedFlight) {
      return;
    }
    setStatusMessage("");
    try {
      const cancelled = await cancelReservation(reservation.reservationId);
      setReservation(cancelled);
      rememberBooking(cancelled);
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

  if (showWelcome) {
    return <WelcomeScreen onEnter={() => setShowWelcome(false)} />;
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <div>
          <strong>AeroWay</strong>
          <span>Flight booking</span>
        </div>
        <nav className="site-nav" aria-label="Main navigation">
          <button
            className={view === "booking" ? "nav-active" : ""}
            type="button"
            onClick={() => setView("booking")}
          >
            Book
          </button>
          <button
            className={view === "account" ? "nav-active" : ""}
            type="button"
            onClick={() => setView("account")}
          >
            My account
          </button>
          <a href="http://localhost:8080/swagger-ui/index.html" target="_blank" rel="noreferrer">
            API docs
          </a>
        </nav>
      </header>

      {view === "account" ? (
        <UserAccount
          bookingRecords={bookingRecords}
          favoriteFlights={favoriteFlights}
          isFavoriteFlight={isFavoriteFlight}
          onBookFlight={openFlightFromAccount}
          onProfileChange={updateUserProfile}
          onToggleFavorite={toggleFavoriteFlight}
          profile={userProfile}
          viewedFlights={viewedFlights}
        />
      ) : (
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
	                  {recommendedFlight && (
	                    <RecommendedFlightCard
	                      recommendation={recommendedFlight}
	                      onChoose={chooseFlight}
	                    />
	                  )}
	                  {flights.map((flight) => (
	                    <FlightRow
	                      flight={flight}
	                      isRecommended={recommendedFlight?.flight.id === flight.id}
	                      isFavorite={isFavoriteFlight(flight.id)}
	                      key={flight.id}
	                      onChoose={chooseFlight}
	                      onToggleFavorite={toggleFavoriteFlight}
	                    />
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
	              {recommendedSeat && (
	                <RecommendedSeatCard recommendation={recommendedSeat} onChoose={chooseSeat} />
	              )}
	              {loadingSeats ? (
	                <p className="muted">Loading seats...</p>
	              ) : (
	                <div className="seat-grid">
	                  {seats.map((seat) => (
	                    <article className={`seat-card ${seat.reserved ? "reserved" : ""}`} key={seat.id}>
	                      <div>
	                        <strong>
	                          {seat.seatNumber}
	                          {seatRecommendations.find((item) => item.seat.id === seat.id) && (
	                            <span className="seat-tag">
	                              {seatRecommendations.find((item) => item.seat.id === seat.id)?.label}
	                            </span>
	                          )}
	                        </strong>
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

	        </section>
	      </section>
	      )}
	    </main>
  );
}

function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const [entering, setEntering] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const stopAmbienceRef = useRef<(() => void) | null>(null);

  function enterBooking() {
    setEntering(true);
    if (soundEnabled) {
      stopAmbienceRef.current = startOceanAmbience();
    }

    window.setTimeout(() => {
      stopAmbienceRef.current?.();
      onEnter();
    }, 1500);
  }

  return (
    <main className="welcome-screen">
      <video
        aria-label="Ocean waves"
        autoPlay
        className="welcome-video"
        loop
        muted
        playsInline
        poster="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80"
      >
        <source src="/media/ocean.mp4" type="video/mp4" />
        <source
          src="https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4"
          type="video/mp4"
        />
      </video>
      <div className="welcome-tint" />
      <section className={`welcome-content ${entering ? "is-entering" : ""}`}>
        <p className="welcome-kicker">AeroWay</p>
        <h1>Plan your next escape by the sea.</h1>
        <p>
          Search flights, hold your seat, and complete your booking with a calm, reliable travel
          experience.
        </p>
        <div className="welcome-actions">
          <button className="primary welcome-primary" disabled={entering} type="button" onClick={enterBooking}>
            {entering ? "Preparing your trip..." : "Enter booking"}
          </button>
          <button
            className="welcome-sound"
            disabled={entering}
            type="button"
            onClick={() => setSoundEnabled((current) => !current)}
          >
            {soundEnabled ? "Wave sound on" : "Wave sound off"}
          </button>
        </div>
        <div className="welcome-progress" aria-hidden={!entering}>
          <span />
        </div>
      </section>
      <div className="wave-line" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

function FlightRow({
  flight,
  isFavorite,
  isRecommended,
  onChoose,
  onToggleFavorite,
}: {
  flight: FlightResponse;
  isFavorite: boolean;
  isRecommended: boolean;
  onChoose: (flight: FlightResponse) => void;
  onToggleFavorite: (flight: FlightResponse) => void;
}) {
  return (
    <article className={`flight-row ${isRecommended ? "recommended" : ""}`}>
      <div className="flight-main">
        <strong>
          {flight.flightNumber}
          {isRecommended && <span className="flight-tag">Recommended</span>}
        </strong>
        <span>{flight.airlineName ?? "AeroWay Partner"}</span>
      </div>
      <span className="route-line">
        {flight.origin} {flight.originCity ? `(${flight.originCity})` : ""} to {flight.destination}{" "}
        {flight.destinationCity ? `(${flight.destinationCity})` : ""}
      </span>
      <small>
        {formatDate(flight.departureTime)}
        {flight.durationMinutes ? ` · ${formatDuration(flight.durationMinutes)}` : ""}
        {flight.equipment ? ` · ${flight.equipment}` : ""}
      </small>
      <div className="flight-actions">
        <span className="price">
          {flight.basePriceCents ? `from ${formatPrice(flight.basePriceCents)}` : "Price pending"}
        </span>
        <button type="button" onClick={() => onToggleFavorite(flight)}>
          {isFavorite ? "Saved" : "Save"}
        </button>
        <button className="primary" type="button" onClick={() => onChoose(flight)}>
          Select flight
        </button>
      </div>
    </article>
  );
}

function RecommendedFlightCard({
  onChoose,
  recommendation,
}: {
  onChoose: (flight: FlightResponse) => void;
  recommendation: FlightRecommendation;
}) {
  const { flight, reasons } = recommendation;

  return (
    <article className="recommendation-card flight-recommendation">
      <div>
        <p className="eyebrow">Recommended for you</p>
        <h3>{flight.flightNumber}</h3>
        <strong>
          {flight.origin} to {flight.destination}
        </strong>
        <span>
          {flight.basePriceCents ? formatPrice(flight.basePriceCents) : "Price pending"}
          {flight.durationMinutes ? ` · ${formatDuration(flight.durationMinutes)}` : ""}
        </span>
      </div>
      <div>
        <p className="recommendation-title">Why recommended</p>
        <ul className="reason-list">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      <button className="primary" type="button" onClick={() => onChoose(flight)}>
        Select recommended flight
      </button>
    </article>
  );
}

function RecommendedSeatCard({
  onChoose,
  recommendation,
}: {
  onChoose: (seat: SeatResponse) => void;
  recommendation: SeatRecommendation;
}) {
  return (
    <article className="recommendation-card seat-recommendation">
      <div>
        <p className="eyebrow">Recommended seat</p>
        <h3>{recommendation.seat.seatNumber}</h3>
        <span>{recommendation.seat.cabinClass}</span>
      </div>
      <p>{recommendation.reason}</p>
      <button className="primary" type="button" onClick={() => onChoose(recommendation.seat)}>
        Choose recommended seat
      </button>
    </article>
  );
}

function UserAccount({
  bookingRecords,
  favoriteFlights,
  isFavoriteFlight,
  onBookFlight,
  onProfileChange,
  onToggleFavorite,
  profile,
  viewedFlights,
}: {
  bookingRecords: ReservationResponse[];
  favoriteFlights: FlightResponse[];
  isFavoriteFlight: (flightId: string) => boolean;
  onBookFlight: (flight: FlightResponse) => void;
  onProfileChange: (profile: UserProfile) => void;
  onToggleFavorite: (flight: FlightResponse) => void;
  profile: UserProfile;
  viewedFlights: FlightResponse[];
}) {
  function updateProfileField(field: keyof UserProfile, value: string) {
    onProfileChange({ ...profile, [field]: value });
  }

  return (
    <section className="account-shell">
      <div className="account-hero">
        <div>
          <p className="eyebrow">My account</p>
          <h1>Your AeroWay trips</h1>
          <p className="muted">
            Manage passenger details, saved flights, recent searches, and booking records in one place.
          </p>
        </div>
        <div className="account-stats" aria-label="Account summary">
          <span>
            <strong>{bookingRecords.length}</strong>
            bookings
          </span>
          <span>
            <strong>{favoriteFlights.length}</strong>
            saved
          </span>
          <span>
            <strong>{viewedFlights.length}</strong>
            viewed
          </span>
        </div>
      </div>

      <div className="account-grid">
        <section className="account-card profile-card">
          <div className="card-heading">
            <p className="eyebrow">Passenger profile</p>
            <h2>Basic information</h2>
          </div>
          <div className="profile-grid">
            <Field label="Full name" htmlFor="accountName">
              <input
                id="accountName"
                value={profile.name}
                onChange={(event) => updateProfileField("name", event.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="accountEmail">
              <input
                id="accountEmail"
                type="email"
                value={profile.email}
                onChange={(event) => updateProfileField("email", event.target.value)}
              />
            </Field>
            <Field label="Passport or document number" htmlFor="accountDocument">
              <input
                id="accountDocument"
                value={profile.documentNumber}
                onChange={(event) => updateProfileField("documentNumber", event.target.value)}
              />
            </Field>
            <Field label="Passenger type" htmlFor="accountPassengerType">
              <select
                id="accountPassengerType"
                value={profile.passengerType}
                onChange={(event) => updateProfileField("passengerType", event.target.value)}
              >
                <option value="ADULT">Adult</option>
                <option value="STUDENT">Student</option>
                <option value="CHILD">Child</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="account-card">
          <div className="card-heading">
            <p className="eyebrow">Purchase history</p>
            <h2>Bookings</h2>
          </div>
          <BookingRecordList records={bookingRecords} />
        </section>

        <section className="account-card">
          <div className="card-heading">
            <p className="eyebrow">Saved flights</p>
            <h2>Favorites</h2>
          </div>
          <FlightMiniList
            emptyText="No saved flights yet."
            flights={favoriteFlights}
            isFavoriteFlight={isFavoriteFlight}
            onBookFlight={onBookFlight}
            onToggleFavorite={onToggleFavorite}
          />
        </section>

        <section className="account-card">
          <div className="card-heading">
            <p className="eyebrow">Recently viewed</p>
            <h2>Browsing history</h2>
          </div>
          <FlightMiniList
            emptyText="Viewed flights will appear here."
            flights={viewedFlights}
            isFavoriteFlight={isFavoriteFlight}
            onBookFlight={onBookFlight}
            onToggleFavorite={onToggleFavorite}
          />
        </section>
      </div>
    </section>
  );
}

function FlightMiniList({
  emptyText,
  flights,
  isFavoriteFlight,
  onBookFlight,
  onToggleFavorite,
}: {
  emptyText: string;
  flights: FlightResponse[];
  isFavoriteFlight: (flightId: string) => boolean;
  onBookFlight: (flight: FlightResponse) => void;
  onToggleFavorite: (flight: FlightResponse) => void;
}) {
  if (flights.length === 0) {
    return <p className="muted empty-state">{emptyText}</p>;
  }

  return (
    <div className="saved-list">
      {flights.map((flight) => (
        <article className="saved-item" key={flight.id}>
          <div>
            <strong>{flight.flightNumber}</strong>
            <span>
              {flight.origin} to {flight.destination}
            </span>
            <small>
              {formatDate(flight.departureTime)}
              {flight.basePriceCents ? ` · ${formatPrice(flight.basePriceCents)}` : ""}
            </small>
          </div>
          <div className="saved-actions">
            <button type="button" onClick={() => onToggleFavorite(flight)}>
              {isFavoriteFlight(flight.id) ? "Saved" : "Save"}
            </button>
            <button className="primary" type="button" onClick={() => onBookFlight(flight)}>
              Book
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function BookingRecordList({ records }: { records: ReservationResponse[] }) {
  if (records.length === 0) {
    return <p className="muted empty-state">Completed bookings will appear here.</p>;
  }

  return (
    <div className="record-list">
      {records.map((record) => (
        <article className="record-item" key={record.reservationId}>
          <div>
            <strong>{record.bookingReference ?? record.reservationId}</strong>
            <span>
              {record.flightNumber}: {record.origin} to {record.destination}
            </span>
            <small>
              Seat {record.seatNumber} · {record.customerName} · {formatDate(record.createdAt)}
            </small>
          </div>
          <span className={`status-pill ${record.status.toLowerCase()}`}>{record.status}</span>
        </article>
      ))}
    </div>
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

function recommendFlight(
  flights: FlightResponse[],
  preferences: {
    departureTimeFrom: string;
    destination: string;
    directOnly: boolean;
    origin: string;
    viewedFlights: FlightResponse[];
  }
): FlightRecommendation | null {
  if (flights.length === 0) {
    return null;
  }

  const prices = flights.map((flight) => flight.basePriceCents ?? Number.MAX_SAFE_INTEGER);
  const durations = flights.map((flight) => flight.durationMinutes ?? Number.MAX_SAFE_INTEGER);
  const seats = flights.map((flight) => flight.availableSeatCount ?? 0);
  const minPrice = Math.min(...prices);
  const minDuration = Math.min(...durations);
  const maxSeats = Math.max(...seats);
  const recentlyViewedRoute = preferences.viewedFlights.find(Boolean);

  const scoredFlights = flights.map((flight) => {
    let score = 0;
    const reasons: string[] = [];

    if ((flight.basePriceCents ?? Number.MAX_SAFE_INTEGER) === minPrice) {
      score += 34;
      reasons.push("Best price among available flights");
    }

    if ((flight.durationMinutes ?? Number.MAX_SAFE_INTEGER) === minDuration) {
      score += 24;
      reasons.push("Fastest route in this result set");
    }

    if ((flight.availableSeatCount ?? 0) === maxSeats && maxSeats > 0) {
      score += 22;
      reasons.push(`${maxSeats} seats still available`);
    } else if ((flight.availableSeatCount ?? 0) >= 10) {
      score += 12;
      reasons.push(`${flight.availableSeatCount} seats still available`);
    }

    if (preferences.directOnly) {
      score += 8;
      reasons.push("Direct route");
    }

    if (
      recentlyViewedRoute &&
      recentlyViewedRoute.origin === flight.origin &&
      recentlyViewedRoute.destination === flight.destination
    ) {
      score += 10;
      reasons.push("Matches a route you recently viewed");
    } else if (flight.origin === preferences.origin && flight.destination === preferences.destination) {
      score += 8;
      reasons.push("Matches your selected route");
    }

    if (preferences.departureTimeFrom && isNearPreferredDeparture(flight, preferences.departureTimeFrom)) {
      score += 8;
      reasons.push("Close to your preferred departure time");
    }

    return {
      flight,
      reasons: reasons.slice(0, 4),
      score,
    };
  });

  scoredFlights.sort((a, b) => b.score - a.score);
  const best = scoredFlights[0];

  return {
    flight: best.flight,
    reasons: best.reasons.length > 0 ? best.reasons : ["Balanced price, duration, and seat availability"],
  };
}

function isNearPreferredDeparture(flight: FlightResponse, preferredTime: string) {
  const [, preferredHour = ""] = preferredTime.match(/^(\d{2})/) ?? [];
  if (!preferredHour) {
    return false;
  }
  const departureHour = new Date(flight.departureTime).getHours();
  return Math.abs(departureHour - Number(preferredHour)) <= 2;
}

function recommendSeats(seats: SeatResponse[]): SeatRecommendation[] {
  const availableSeats = seats.filter((seat) => !seat.reserved);
  const reservedSeatNumbers = new Set(seats.filter((seat) => seat.reserved).map((seat) => seat.seatNumber));

  return availableSeats
    .map((seat) => {
      const row = seatRow(seat.seatNumber);
      const letter = seatLetter(seat.seatNumber);
      const isWindow = ["A", "F", "D"].includes(letter);
      const hasReservedNeighbor = adjacentSeatLetters(letter).some((neighbor) =>
        reservedSeatNumbers.has(`${row}${neighbor}`)
      );
      let score = 100 - row;
      const reasons: string[] = [];

      if (isWindow) {
        score += 24;
        reasons.push("window seat");
      }

      if (row > 0 && row <= 12) {
        score += 18;
        reasons.push("near the front");
      }

      if (!hasReservedNeighbor) {
        score += 14;
        reasons.push("not next to a reserved seat");
      }

      if (seat.cabinClass === "ECONOMY") {
        score += 6;
        reasons.push("available economy seat");
      }

      const label = isWindow ? "Window seat" : row <= 12 ? "Recommended" : "More availability";
      const reason = `Available ${seat.cabinClass.toLowerCase()} seat ${
        reasons.length > 0 ? reasons.join(", ") : "with a balanced position"
      }.`;

      return { label, reason, score, seat };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ label, reason, seat }, index) => ({
      label: index === 0 ? "Recommended" : label,
      reason,
      seat,
    }));
}

function seatRow(seatNumber: string) {
  return Number(seatNumber.match(/\d+/)?.[0] ?? 99);
}

function seatLetter(seatNumber: string) {
  return seatNumber.match(/[A-Z]$/)?.[0] ?? "";
}

function adjacentSeatLetters(letter: string) {
  const order = ["A", "B", "C", "D", "E", "F"];
  const index = order.indexOf(letter);
  return [order[index - 1], order[index + 1]].filter(Boolean);
}

function startOceanAmbience() {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return () => undefined;
  }

  const audioContext = new AudioContextClass();
  const frameCount = audioContext.sampleRate * 3;
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const channelData = buffer.getChannelData(0);
  let lastValue = 0;

  for (let i = 0; i < frameCount; i += 1) {
    const white = Math.random() * 2 - 1;
    lastValue = lastValue * 0.985 + white * 0.015;
    const swell = 0.55 + Math.sin((i / audioContext.sampleRate) * Math.PI * 1.4) * 0.28;
    channelData[i] = lastValue * swell;
  }

  const source = audioContext.createBufferSource();
  const lowpass = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  source.buffer = buffer;
  source.loop = true;
  lowpass.type = "lowpass";
  lowpass.frequency.value = 760;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.6);

  source.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(audioContext.destination);
  source.start();

  return () => {
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);
    window.setTimeout(() => {
      source.stop();
      audioContext.close();
    }, 420);
  };
}

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function storeValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browsing data is helpful for the product experience, but booking should keep working without it.
  }
}
