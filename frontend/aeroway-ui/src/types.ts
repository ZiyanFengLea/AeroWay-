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

export type SeatResponse = {
  id: string;
  flightId: string;
  seatNumber: string;
  cabinClass: string;
  reserved: boolean;
};

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

export type ErrorResponse = {
  error: string;
  message: string;
};

export type AvailabilityIntegrityResponse = {
  attempts: number;
  successfulReservations: number;
  conflicts: number;
  duplicateReservationsInDatabase: number;
};
