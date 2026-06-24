// DTO shapes returned by the Spring Boot API and consumed by the React UI.
export type FlightResponse = {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  airlineCode?: string;
  airlineName?: string;
  originAirportName?: string;
  originCity?: string;
  originCountry?: string;
  destinationAirportName?: string;
  destinationCity?: string;
  destinationCountry?: string;
  equipment?: string;
  basePriceCents?: number;
  availableSeatCount?: number;
  durationMinutes?: number;
};

// Seat-map item with availability already computed by the backend.
export type SeatResponse = {
  id: string;
  flightId: string;
  seatNumber: string;
  cabinClass: string;
  reserved: boolean;
};

// Reservation lifecycle projection used for holds, confirmations, cancellations, and account history.
export type ReservationResponse = {
  reservationId: string;
  flightId: string;
  seatId: string;
  customerName: string;
  customerEmail?: string;
  documentNumber?: string;
  passengerType?: string;
  status: string;
  createdAt: string;
  flightNumber: string;
  origin: string;
  destination: string;
  seatNumber: string;
  cabinClass: string;
  holdExpiresAt?: string;
  bookingReference?: string;
  paymentStatus?: string;
};

// Standard JSON error response from the backend exception handler.
export type ErrorResponse = {
  error: string;
  message: string;
};
