export interface HistoricalFlightSummary {
  flightIata: string;
  airline: string | null;
  departure: string | null;
  arrival: string | null;
  status: string;
  flightDate: string | null;
  depScheduled: string | null;
  arrScheduled: string | null;
  depDelay: number | null;
  arrDelay: number | null;
  uaeAirport: string;
  queryType: "arrival" | "departure";
}

export interface HistoricalQueryResult {
  airport: string;
  type: "arrival" | "departure";
  count: number;
  error?: string;
}

export interface HistoricalFlightsResponse {
  flights: HistoricalFlightSummary[];
  queries: HistoricalQueryResult[];
  dateFrom: string;
  dateTo: string;
  totalUnique: number;
  cancelledCount: number;
  delayedCount: number;
}
