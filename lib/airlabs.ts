import type { FlightData } from "@/types/flight";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];

interface HistoricalRecord {
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string;
  arr_time?: string;
  arr_actual?: string;
  dep_delayed?: number;
  arr_delayed?: number | null;
  status?: string;
}

interface HistoricalResponse {
  response?: HistoricalRecord[];
  error?: { message?: string };
  request?: { has_more?: boolean };
}

interface LiveFlightResponse {
  response?: {
    status?: string;
    arr_delayed?: number | null;
    dep_iata?: string;
    arr_iata?: string;
    dep_time?: string;
    arr_time?: string;
    arr_estimated?: string;
  };
  error?: { message?: string };
}

function matchesFlightDate(depTime: string | undefined, flightDate: string): boolean {
  return Boolean(depTime?.startsWith(flightDate));
}

function calculateArrDelay(
  arrTime: string | undefined,
  arrActual: string | undefined,
  reportedDelay: number | null | undefined
): number {
  if (reportedDelay != null && reportedDelay >= 0) {
    return reportedDelay;
  }
  if (!arrTime || !arrActual) return 0;

  const scheduled = new Date(arrTime.replace(" ", "T"));
  const actual = new Date(arrActual.replace(" ", "T"));
  const delayMs = actual.getTime() - scheduled.getTime();

  return delayMs > 0 ? Math.round(delayMs / 60000) : 0;
}

function mapHistoricalRecord(record: HistoricalRecord): FlightData {
  return {
    status: record.status ?? "landed",
    arr_delayed: calculateArrDelay(
      record.arr_time,
      record.arr_actual,
      record.arr_delayed
    ),
    dep_iata: record.dep_iata,
    arr_iata: record.arr_iata,
    dep_time: record.dep_time,
    arr_time: record.arr_time,
    arr_actual: record.arr_actual,
    source: "historical",
  };
}

async function fetchHistoricalFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  let offset = 0;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      api_key: apiKey,
      flight_iata: flightIata,
      offset: String(offset),
    });

    const response = await fetch(
      `https://airlabs.co/api/v10/historical?${params.toString()}`,
      { next: { revalidate: 0 } }
    );

    if (!response.ok) return null;

    const data: HistoricalResponse = await response.json();
    if (data.error || !data.response?.length) return null;

    const match = data.response.find((record) =>
      matchesFlightDate(record.dep_time, flightDate)
    );

    if (match) return mapHistoricalRecord(match);

    if (!data.request?.has_more) break;
    offset += data.response.length;
  }

  return null;
}

async function fetchLiveFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
    _fields:
      "status,arr_delayed,dep_iata,arr_iata,dep_time,arr_time,arr_estimated",
  });

  const response = await fetch(
    `https://airlabs.co/api/v9/flight?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return null;

  const data: LiveFlightResponse = await response.json();
  if (data.error || !data.response) return null;
  if (!matchesFlightDate(data.response.dep_time, flightDate)) return null;

  return {
    status: data.response.status ?? "scheduled",
    arr_delayed: data.response.arr_delayed ?? 0,
    dep_iata: data.response.dep_iata,
    arr_iata: data.response.arr_iata,
    dep_time: data.response.dep_time,
    arr_time: data.response.arr_time,
    arr_actual: data.response.arr_estimated,
    source: "live",
  };
}

export function isValidFlightDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function touchesUaeAirport(flight: FlightData): boolean {
  return (
    (flight.dep_iata != null && UAE_AIRPORTS.includes(flight.dep_iata)) ||
    (flight.arr_iata != null && UAE_AIRPORTS.includes(flight.arr_iata))
  );
}

export async function fetchFlightByNumberAndDate(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const historical = await fetchHistoricalFlight(flightIata, flightDate, apiKey);
  if (historical) return historical;

  const today = new Date().toISOString().slice(0, 10);
  if (flightDate === today) {
    return fetchLiveFlight(flightIata, flightDate, apiKey);
  }

  return null;
}

export function formatRoute(flight: FlightData): string | null {
  if (!flight.dep_iata && !flight.arr_iata) return null;
  return `${flight.dep_iata ?? "?"} → ${flight.arr_iata ?? "?"}`;
}
