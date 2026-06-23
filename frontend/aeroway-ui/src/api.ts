import type {
  AvailabilityIntegrityResponse,
  ErrorResponse,
  FlightResponse,
  ReservationResponse,
  SeatResponse,
} from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ErrorResponse | null;
    throw new ApiError(response.status, error?.message ?? "Request failed.");
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type FlightSearchParams = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  airlineCode?: string;
  maxPriceCents?: number;
  cabinClass?: string;
  directOnly?: boolean;
  departureTimeFrom?: string;
  departureTimeTo?: string;
};

export function fetchFlights(params: FlightSearchParams = {}): Promise<FlightResponse[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<FlightResponse[]>(`/api/flights${suffix}`);
}

export function fetchSeats(flightId: string): Promise<SeatResponse[]> {
  return request<SeatResponse[]>(`/api/flights/${flightId}/seats`);
}

export function reserveSeat(
  flightId: string,
  seatId: string,
  customerName: string,
  customerEmail: string,
  documentNumber: string,
  passengerType: string
): Promise<ReservationResponse> {
  return request<ReservationResponse>(`/api/flights/${flightId}/seats/${seatId}/reservations`, {
    method: "POST",
    body: JSON.stringify({ customerName, customerEmail, documentNumber, passengerType }),
  });
}

export function cancelReservation(reservationId: string): Promise<ReservationResponse> {
  return request<ReservationResponse>(`/api/reservations/${reservationId}/cancel`, {
    method: "POST",
  });
}

export function runAvailabilityIntegrityCheck(): Promise<AvailabilityIntegrityResponse> {
  return request<AvailabilityIntegrityResponse>("/api/availability/integrity-check", {
    method: "POST",
  });
}
