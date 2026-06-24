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
type AppView = "home" | "booking" | "account";

// Local UI models keep recommendation and account state explicit without adding frontend libraries.
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
type Toast = {
  kind: "success" | "error" | "info";
  message: string;
};
type DestinationSpotlight = {
  airportCode: string;
  city: string;
  country?: string;
  imageUrl: string;
  summary: string;
  startingFare?: number;
  flightCount: number;
  sampleFlights: FlightResponse[];
};

const defaultUserProfile: UserProfile = {
  name: "Ziyan Feng",
  email: "ziyan@example.com",
  documentNumber: "P12345678",
  passengerType: "ADULT",
};

// Step labels drive the booking progress indicator.
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

// Static airline choices match the seed data used by the backend migrations.
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

// Destination copy and images enrich backend flight data for the Explore homepage.
const destinationContent: Record<string, { imageUrl: string; summary: string }> = {
  AMS: {
    imageUrl: "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1200&q=80",
    summary: "Canals, galleries, bikes, and soft evening light by the water.",
  },
  ARN: {
    imageUrl: "https://images.unsplash.com/photo-1509356843151-3e7d96241e11?auto=format&fit=crop&w=1200&q=80",
    summary: "Island views, clean design, and calm Nordic city weekends.",
  },
  ATH: {
    imageUrl: "https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1200&q=80",
    summary: "Ancient hills, bright coastlines, and late dinners under warm skies.",
  },
  BCN: {
    imageUrl: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80",
    summary: "Mediterranean evenings, Gaudi landmarks, and easy beach days.",
  },
  BER: {
    imageUrl: "https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1200&q=80",
    summary: "Creative neighborhoods, museums, and a relaxed city-break pace.",
  },
  CDG: {
    imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
    summary: "Classic boulevards, galleries, cafes, and a long-weekend glow.",
  },
  CPH: {
    imageUrl: "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&w=1200&q=80",
    summary: "Harbor swims, design streets, and easy Scandinavian food stops.",
  },
  DUB: {
    imageUrl: "https://images.unsplash.com/photo-1549918864-48ac978761a4?auto=format&fit=crop&w=1200&q=80",
    summary: "Cozy pubs, coastal walks, and a warm city break atmosphere.",
  },
  DXB: {
    imageUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
    summary: "Sunset skylines, warm beaches, and polished stopover energy.",
  },
  EDI: {
    imageUrl: "https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80",
    summary: "Castle views, stone streets, and dramatic Scottish weekend scenery.",
  },
  FCO: {
    imageUrl: "https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1200&q=80",
    summary: "Ancient streets, open-air dining, and slow golden afternoons.",
  },
  FRA: {
    imageUrl: "https://images.unsplash.com/photo-1508375052021-249ee3d7e2ec?auto=format&fit=crop&w=1200&q=80",
    summary: "Riverfront skyline walks, museums, and efficient onward connections.",
  },
  JFK: {
    imageUrl: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1200&q=80",
    summary: "Big-city momentum, landmark views, and neighborhoods made for wandering.",
  },
  LHR: {
    imageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80",
    summary: "Royal parks, riverside walks, West End nights, and classic city energy.",
  },
  LIS: {
    imageUrl: "https://images.unsplash.com/photo-1500930287596-c1ecaa373bb2?auto=format&fit=crop&w=1200&q=80",
    summary: "Ocean air, tiled streets, hilltop views, and easy Atlantic light.",
  },
  MAD: {
    imageUrl: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80",
    summary: "Late dinners, museum days, and sunlit plazas made for wandering.",
  },
  MUC: {
    imageUrl: "https://images.unsplash.com/photo-1595867818082-083862f3d630?auto=format&fit=crop&w=1200&q=80",
    summary: "Bavarian squares, beer gardens, and alpine day-trip possibilities.",
  },
  NRT: {
    imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80",
    summary: "Neon nights, quiet gardens, and food worth planning a trip around.",
  },
  PEK: {
    imageUrl: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1200&q=80",
    summary: "Imperial history, modern scale, and rich cultural routes.",
  },
  SIN: {
    imageUrl: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1200&q=80",
    summary: "Garden-city design, night markets, and seamless tropical stopovers.",
  },
  VIE: {
    imageUrl: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=1200&q=80",
    summary: "Grand cafes, music halls, and elegant streets for slow travel.",
  },
  WAW: {
    imageUrl: "https://images.unsplash.com/photo-1519197924294-4ba991a11128?auto=format&fit=crop&w=1200&q=80",
    summary: "Historic squares, modern food spots, and an easy city-break rhythm.",
  },
  ZRH: {
    imageUrl: "https://images.unsplash.com/photo-1515488764276-beab7607c1e6?auto=format&fit=crop&w=1200&q=80",
    summary: "Lake views, crisp old-town walks, and mountain air within reach.",
  },
};

const fallbackDestinationImage = "https://source.unsplash.com/1200x800/?";

export function App() {
  // Top-level state controls the welcome screen, Explore page, booking flow, and account page.
  const [showWelcome, setShowWelcome] = useState(true);
  const [appEntering, setAppEntering] = useState(false);
  const [view, setView] = useState<AppView>("home");
  const [step, setStep] = useState<BookingStep>("search");
  const [flights, setFlights] = useState<FlightResponse[]>([]);
  const [exploreFlights, setExploreFlights] = useState<FlightResponse[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<DestinationSpotlight | null>(null);
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
  const [statusTone, setStatusTone] = useState<Toast["kind"]>("info");
  const [toast, setToast] = useState<Toast | null>(null);
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [holdingSeat, setHoldingSeat] = useState(false);
  const [confirmIdempotencyKey, setConfirmIdempotencyKey] = useState(() => createIdempotencyKey());
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);

  const availableSeatCount = useMemo(
    () => seats.filter((seat) => !seat.reserved).length,
    [seats]
  );
  // Rule-based recommendation is recalculated from the current flight results and user context.
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
  // Explore content is derived from backend flights and grouped by destination.
  const destinationSpotlights = useMemo(() => buildDestinationSpotlights(exploreFlights), [exploreFlights]);
  const lowFareFlights = useMemo(
    () =>
      [...exploreFlights]
        .filter((flight) => flight.basePriceCents)
        .sort((a, b) => (a.basePriceCents ?? 0) - (b.basePriceCents ?? 0))
        .slice(0, 4),
    [exploreFlights]
  );

  function clearStatus() {
    setStatusMessage("");
    setStatusTone("info");
  }

  function showStatus(message: string, kind: Toast["kind"] = "info") {
    setStatusMessage(message);
    setStatusTone(kind);
  }

  function showToast(message: string, kind: Toast["kind"] = "info") {
    // Toasts provide short-lived feedback for success, conflict, and loading failures.
    setToast({ kind, message });
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  async function loadExploreFlights() {
    // Loads all bookable flights once and reuses them for destination and low-fare recommendations.
    if (loadingExplore || exploreFlights.length > 0) {
      return;
    }

    setLoadingExplore(true);
    try {
      setExploreFlights(await fetchFlights());
    } catch {
      showToast("Travel inspiration could not be loaded", "error");
    } finally {
      setLoadingExplore(false);
    }
  }

  function openHome() {
    setView("home");
    void loadExploreFlights();
  }

  async function loadFlights(nextStep: BookingStep = "flights") {
    // Runs the backend search; if exact filters are too narrow, falls back to nearby useful results.
    setLoadingFlights(true);
    clearStatus();
    try {
      const data = await fetchFlights(searchParams());
      if (data.length === 0 && hasActiveSearch()) {
        const suggestedFlights = await fetchFallbackFlights();
        setFlights(suggestedFlights);
        setSelectedFlight(null);
        showStatus(fallbackMessage(suggestedFlights), "info");
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
      showStatus("Flights could not be loaded. Please check the booking service.", "error");
      showToast("Flights could not be loaded", "error");
    } finally {
      setLoadingFlights(false);
    }
  }

  function searchParams() {
    // Translates controlled form fields into API query parameters.
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
    // Keeps the product usable by showing same-route, same-origin, or same-destination alternatives.
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
    // Retrieves the backend-computed seat map for a selected flight.
    setLoadingSeats(true);
    clearStatus();
    try {
      setSeats(await fetchSeats(flightId));
    } catch {
      showStatus("Seat availability could not be loaded for this flight.", "error");
      showToast("Seat map unavailable", "error");
    } finally {
      setLoadingSeats(false);
    }
  }

  function updateUserProfile(nextProfile: UserProfile) {
    // Persists profile edits locally so later checkout forms are prefilled.
    setUserProfile(nextProfile);
    storeValue("aeroway.userProfile", nextProfile);
    setCustomerName(nextProfile.name);
    setCustomerEmail(nextProfile.email);
    setDocumentNumber(nextProfile.documentNumber);
    setPassengerType(nextProfile.passengerType);
  }

  function rememberViewedFlight(flight: FlightResponse) {
    // Stores lightweight browsing history for the account page.
    setViewedFlights((current) => {
      const next = [flight, ...current.filter((item) => item.id !== flight.id)].slice(0, 8);
      storeValue("aeroway.viewedFlights", next);
      return next;
    });
  }

  function toggleFavoriteFlight(flight: FlightResponse) {
    // Maintains a local saved-flight list without requiring authentication.
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
    // Stores booking lifecycle records so confirmations and cancellations remain visible in account history.
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

  async function openFlightFromHome(flight: FlightResponse) {
    setView("booking");
    setFlights([flight]);
    await chooseFlight(flight);
  }

  function browseDestination(destinationSpotlight: DestinationSpotlight) {
    // Converts an Explore destination card into preloaded booking results.
    const destinationFlights = destinationSpotlight.sampleFlights;
    const firstFlight = destinationFlights[0];
    if (firstFlight) {
      setOrigin(firstFlight.origin);
      setDestination(destinationSpotlight.airportCode);
      setTravelDate(firstFlight.departureTime.slice(0, 10));
    }
    setFlights(destinationFlights);
    setSelectedFlight(null);
    setSelectedSeat(null);
    setReservation(null);
    clearStatus();
    setView("booking");
    setStep("flights");
  }

  async function chooseFlight(flight: FlightResponse) {
    // Selecting a flight records browsing intent and moves the user to the live seat map.
    rememberViewedFlight(flight);
    setSelectedFlight(flight);
    setSelectedSeat(null);
    setReservation(null);
    await loadSeats(flight.id);
    setStep("seats");
  }

  async function chooseSeat(seat: SeatResponse) {
    // Seat selection calls the hold endpoint, reserving checkout time before payment confirmation.
    if (!selectedFlight) {
      return;
    }

    setHoldingSeat(true);
    setSelectedSeat(seat);
    clearStatus();
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
      showStatus(`Seat ${seat.seatNumber} is held for 5 minutes while you complete booking.`, "success");
      showToast(`Seat ${seat.seatNumber} held`, "success");
      await loadSeats(selectedFlight.id);
      setStep("passenger");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showStatus("Seat already reserved.", "error");
        showToast("Seat already reserved", "error");
        await loadSeats(selectedFlight.id);
      } else if (error instanceof ApiError) {
        showStatus(`Seat hold could not be created (${error.status}). ${error.message}`, "error");
        showToast("Seat hold failed", "error");
      } else {
        showStatus("Seat hold could not be created. Please try again.", "error");
        showToast("Seat hold failed", "error");
      }
      setSelectedSeat(null);
    } finally {
      setHoldingSeat(false);
    }
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    // Checkout confirms the existing hold using an idempotency key to avoid duplicate orders.
    event.preventDefault();
    if (!selectedFlight || !selectedSeat || !reservation) {
      return;
    }

    setReserving(true);
    clearStatus();
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
      showToast("Booking confirmed", "success");
      await loadSeats(selectedFlight.id);
      setStep("confirmation");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        showStatus("Seat already reserved.", "error");
        showToast("Seat already reserved", "error");
        await loadSeats(selectedFlight.id);
        setStep("seats");
      } else {
        showStatus("Booking could not be completed. Please try again.", "error");
        showToast("Booking failed", "error");
      }
    } finally {
      setReserving(false);
    }
  }

  async function handleCancelReservation() {
    // Cancellation updates backend state and refreshes seat availability.
    if (!reservation || !selectedFlight) {
      return;
    }
    clearStatus();
    try {
      const cancelled = await cancelReservation(reservation.reservationId);
      setReservation(cancelled);
      rememberBooking(cancelled);
      showToast("Booking cancelled", "info");
      await loadSeats(selectedFlight.id);
    } catch {
      showStatus("Booking could not be cancelled. Please try again.", "error");
      showToast("Cancellation failed", "error");
    }
  }

  function startNewSearch() {
    setSelectedFlight(null);
    setSelectedSeat(null);
    setReservation(null);
    clearStatus();
    setConfirmIdempotencyKey(createIdempotencyKey());
    setSimulatePaymentFailure(false);
    setStep("search");
  }

  function enterAppFromWelcome() {
    setShowWelcome(false);
    setAppEntering(true);
    setView("home");
    void loadExploreFlights();
    window.setTimeout(() => setAppEntering(false), 950);
  }

  if (showWelcome) {
    return <WelcomeScreen onEnter={enterAppFromWelcome} />;
  }

  return (
    <main className={`app-shell ${appEntering ? "app-entering" : ""}`}>
      <header className="site-header">
        <div>
          <strong>AeroWay</strong>
          <span>Flight booking</span>
        </div>
        <nav className="site-nav" aria-label="Main navigation">
          <button
            className={view === "home" ? "nav-active" : ""}
            type="button"
            onClick={openHome}
          >
            Explore
          </button>
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
      {toast && <ToastMessage toast={toast} onClose={() => setToast(null)} />}

      {view === "home" ? (
        <ExploreHome
          destinations={destinationSpotlights}
          loading={loadingExplore}
          lowFareFlights={lowFareFlights}
          onBrowseDestination={browseDestination}
          onOpenFlight={openFlightFromHome}
          onSelectDestination={setSelectedDestination}
          selectedDestination={selectedDestination}
        />
      ) : view === "account" ? (
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
          {statusMessage && <StatusNotice message={statusMessage} tone={statusTone} />}

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
                  {loadingFlights ? (
                    <>
                      <SpinnerIcon />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Icon name="search" />
                      Search flights
                    </>
                  )}
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
                <FlightSkeletonList />
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
                      {reserving ? (
                        <>
                          <SpinnerIcon />
                          Reserving...
                        </>
                      ) : (
                        <>
                          <Icon name="check" />
                          Complete booking
                        </>
                      )}
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
  // Full-screen video intro creates travel context before the user reaches the product UI.
  const [entering, setEntering] = useState(false);

  function enterBooking() {
    setEntering(true);
    window.setTimeout(() => {
      onEnter();
    }, 1800);
  }

  return (
    <main className={`welcome-screen ${entering ? "is-leaving" : ""}`}>
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

function ToastMessage({ onClose, toast }: { onClose: () => void; toast: Toast }) {
  // Compact notification component used for booking success, conflicts, and recoverable errors.
  return (
    <div className={`toast ${toast.kind}`} role="status">
      <Icon name={toast.kind === "success" ? "check" : toast.kind === "error" ? "alert" : "info"} />
      <span>{toast.message}</span>
      <button aria-label="Dismiss notification" type="button" onClick={onClose}>
        <Icon name="close" />
      </button>
    </div>
  );
}

function StatusNotice({ message, tone }: { message: string; tone: Toast["kind"] }) {
  // Inline status message used when the user needs context inside the booking flow.
  return (
    <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "success" ? "check" : tone === "error" ? "alert" : "info"} />
      <span>{message}</span>
    </div>
  );
}

function ExploreHome({
  destinations,
  loading,
  lowFareFlights,
  onBrowseDestination,
  onOpenFlight,
  onSelectDestination,
  selectedDestination,
}: {
  destinations: DestinationSpotlight[];
  loading: boolean;
  lowFareFlights: FlightResponse[];
  onBrowseDestination: (destination: DestinationSpotlight) => void;
  onOpenFlight: (flight: FlightResponse) => void;
  onSelectDestination: (destination: DestinationSpotlight) => void;
  selectedDestination: DestinationSpotlight | null;
}) {
  // Landing page derived from live flight inventory, used to inspire trips before search.
  const featuredDestinations = destinations.slice(0, 6);

  return (
    <section className="home-shell">
      <section className="home-hero">
        <div>
          <p className="eyebrow">Travel inspiration</p>
          <h1>Find a route before you know the destination.</h1>
          <p>
            Browse beach weekends, city escapes, and low-fare routes generated from live AeroWay
            flight availability.
          </p>
        </div>
        <div className="home-hero-card">
          <span>Today&apos;s idea</span>
          <strong>{featuredDestinations[0]?.city ?? "Lisbon"}</strong>
          <small>
            {featuredDestinations[0]?.startingFare
              ? `Flights from ${formatPrice(featuredDestinations[0].startingFare)}`
              : "Ocean light, city walks, and easy planning"}
          </small>
        </div>
      </section>

      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <section className="home-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recommended destinations</p>
                <h2>Places to start from</h2>
              </div>
            </div>
            <div className="destination-grid">
              {featuredDestinations.map((destination) => (
                <DestinationCard
                  destination={destination}
                  key={destination.airportCode}
                  onBrowse={onBrowseDestination}
                  onSelect={onSelectDestination}
                />
              ))}
            </div>
          </section>

          {selectedDestination && (
            <DestinationDetail
              destination={selectedDestination}
              onBrowse={onBrowseDestination}
              onOpenFlight={onOpenFlight}
            />
          )}

          <section className="home-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Low fare finder</p>
                <h2>Bookable fares right now</h2>
              </div>
            </div>
            <div className="fare-grid">
              {lowFareFlights.map((flight) => (
                <button className="fare-tile" key={flight.id} type="button" onClick={() => onOpenFlight(flight)}>
                  <span>{flight.airlineName ?? "AeroWay Partner"}</span>
                  <strong>
                    {flight.origin} to {flight.destination}
                  </strong>
                  <small>{formatDate(flight.departureTime)}</small>
                  <b>{flight.basePriceCents ? formatPrice(flight.basePriceCents) : "Price pending"}</b>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function DestinationCard({
  destination,
  onBrowse,
  onSelect,
}: {
  destination: DestinationSpotlight;
  onBrowse: (destination: DestinationSpotlight) => void;
  onSelect: (destination: DestinationSpotlight) => void;
}) {
  // Destination card combines backend fare data with curated image and travel copy.
  return (
    <article className="destination-card">
      <button
        className="destination-media"
        style={{ backgroundImage: `url(${destination.imageUrl})` }}
        type="button"
        onClick={() => onSelect(destination)}
      >
        <span>{destination.airportCode}</span>
      </button>
      <div>
        <strong>{destination.city}</strong>
        <p>{destination.summary}</p>
      </div>
      <div className="destination-meta">
        <span>{destination.flightCount} flights</span>
        <span>
          {destination.startingFare ? `from ${formatPrice(destination.startingFare)}` : "fares loading"}
        </span>
      </div>
      <button className="primary" type="button" onClick={() => onBrowse(destination)}>
        Browse trips
      </button>
    </article>
  );
}

function DestinationDetail({
  destination,
  onBrowse,
  onOpenFlight,
}: {
  destination: DestinationSpotlight;
  onBrowse: (destination: DestinationSpotlight) => void;
  onOpenFlight: (flight: FlightResponse) => void;
}) {
  // Detail panel previews a destination and exposes concrete bookable flights.
  return (
    <section className="destination-detail">
      <div
        className="destination-detail-image"
        style={{ backgroundImage: `url(${destination.imageUrl})` }}
      />
      <div>
        <p className="eyebrow">Destination preview</p>
        <h2>{destination.city}</h2>
        <p>{destination.summary}</p>
        <div className="detail-chips">
          <span>{destination.airportCode}</span>
          <span>{destination.flightCount} available flights</span>
          <span>
            {destination.startingFare ? `from ${formatPrice(destination.startingFare)}` : "fare pending"}
          </span>
        </div>
        <div className="mini-flight-list">
          {destination.sampleFlights.slice(0, 3).map((flight) => (
            <button key={flight.id} type="button" onClick={() => onOpenFlight(flight)}>
              <strong>{flight.flightNumber}</strong>
              <span>
                {flight.origin} to {flight.destination} ·{" "}
                {flight.basePriceCents ? formatPrice(flight.basePriceCents) : "Price pending"}
              </span>
            </button>
          ))}
        </div>
        <button className="primary" type="button" onClick={() => onBrowse(destination)}>
          See all trips to {destination.city}
        </button>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <section className="home-section">
      <div className="destination-grid">
        {[0, 1, 2].map((item) => (
          <article className="destination-card skeleton-card" key={item}>
            <span className="destination-media" />
            <span className="skeleton-line short" />
            <span className="skeleton-line long" />
            <span className="skeleton-button" />
          </article>
        ))}
      </div>
    </section>
  );
}

function FlightSkeletonList() {
  // Skeleton loading preserves layout while flight search is in progress.
  return (
    <div className="flight-list" aria-label="Loading flights">
      {[0, 1, 2].map((item) => (
        <article className="flight-row skeleton-card" key={item}>
          <span className="skeleton-line short" />
          <span className="skeleton-line long" />
          <span className="skeleton-line medium" />
          <div className="flight-actions">
            <span className="skeleton-pill" />
            <span className="skeleton-button" />
          </div>
        </article>
      ))}
    </div>
  );
}

function SpinnerIcon() {
  return <span className="spinner-icon" aria-hidden="true" />;
}

function Icon({ name }: { name: "alert" | "check" | "close" | "info" | "search" }) {
  const paths = {
    alert: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.2 2.5 17.5A1.7 1.7 0 0 0 4 20h16a1.7 1.7 0 0 0 1.5-2.5L13.7 4.2a1.9 1.9 0 0 0-3.4 0Z" />
      </>
    ),
    check: (
      <>
        <path d="M20 6 9 17l-5-5" />
      </>
    ),
    close: (
      <>
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
      </>
    ),
    info: (
      <>
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  };

  return (
    <svg className="icon" aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
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
  // Flight result row supports selection, saving, and recommendation highlighting.
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
  // Displays the highest-scoring rule-based flight with explicit recommendation reasons.
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
  // Presents the top seat recommendation before the full seat grid.
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
  // Account page stores profile, browsing history, favorites, and bookings in localStorage.
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

function buildDestinationSpotlights(flights: FlightResponse[]): DestinationSpotlight[] {
  // Groups backend flights by destination and computes homepage cards with fare and inventory summaries.
  const groupedFlights = new Map<string, FlightResponse[]>();

  flights.forEach((flight) => {
    const destinationFlights = groupedFlights.get(flight.destination) ?? [];
    destinationFlights.push(flight);
    groupedFlights.set(flight.destination, destinationFlights);
  });

  return [...groupedFlights.entries()]
    .map(([airportCode, destinationFlights]) => {
      const firstFlight = destinationFlights[0];
      const content = destinationContent[airportCode];
      const city = firstFlight.destinationCity ?? airportCode;
      const prices = destinationFlights
        .map((flight) => flight.basePriceCents)
        .filter((price): price is number => Boolean(price));

      return {
        airportCode,
        city,
        country: firstFlight.destinationCountry,
        flightCount: destinationFlights.length,
        imageUrl: content?.imageUrl ?? destinationFallbackImage(city),
        sampleFlights: destinationFlights
          .sort((a, b) => (a.basePriceCents ?? Number.MAX_SAFE_INTEGER) - (b.basePriceCents ?? Number.MAX_SAFE_INTEGER))
          .slice(0, 5),
        startingFare: prices.length > 0 ? Math.min(...prices) : undefined,
        summary: content?.summary ?? `A flexible trip idea with ${destinationFlights.length} bookable flights.`,
      };
    })
    .sort((a, b) => {
      const fareDifference =
        (a.startingFare ?? Number.MAX_SAFE_INTEGER) - (b.startingFare ?? Number.MAX_SAFE_INTEGER);
      return fareDifference || b.flightCount - a.flightCount;
    })
    .slice(0, 8);
}

function destinationFallbackImage(city: string) {
  const query = encodeURIComponent(`${city} travel city`);
  return `${fallbackDestinationImage}${query}`;
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
  // Scores visible flights by fare, duration, seat availability, direct routing, and recent user context.
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
  // Scores available seats by front-row position, window preference, and distance from reserved neighbors.
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

function readStoredValue<T>(key: string, fallback: T): T {
  // Reads optional localStorage state while keeping server-side or restricted environments safe.
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
  // Persists non-critical account and browsing state; failures should not block booking.
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browsing data is helpful for the product experience, but booking should keep working without it.
  }
}
