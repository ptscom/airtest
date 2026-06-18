import type { FlightData } from "@/types/flight";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];
const UAE_TIMEZONE = "Asia/Dubai";

interface ScheduleRecord {
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string;
  arr_time?: string;
  arr_actual?: string;
  arr_estimated?: string;
  dep_delayed?: number;
  arr_delayed?: number | null;
  status?: string;
}

interface AirLabsListResponse<T> {
  response?: T[];
  error?: { message?: string; code?: string };
}

interface LiveFlightResponse {
  response?: ScheduleRecord;
  error?: { message?: string; code?: string };
}

interface RouteRecord {
  dep_iata?: string;
  arr_iata?: string;
}

export interface FlightLookupResult {
  flight: FlightData | null;
  message?: string;
}

function matchesFlightDate(
  depTime: string | undefined,
  flightDate: string
): boolean {
  return Boolean(depTime?.startsWith(flightDate));
}

export function extractDepartureDate(
  depTime: string | undefined
): string | null {
  if (!depTime) return null;
  return depTime.slice(0, 10);
}

export function getTodayInUae(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: UAE_TIMEZONE,
  }).format(new Date());
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

function mapRecord(
  record: ScheduleRecord,
  source: FlightData["source"]
): FlightData {
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
    source,
  };
}

function findMatchingRecord(
  records: ScheduleRecord[],
  flightDate: string
): ScheduleRecord | undefined {
  return records.find((record) => matchesFlightDate(record.dep_time, flightDate));
}

async function fetchSchedulesFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
    _fields:
      "status,arr_delayed,dep_iata,arr_iata,dep_time,arr_time,arr_actual,dep_delayed",
  });

  const response = await fetch(
    `https://airlabs.co/api/v9/schedules?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return null;

  const data: AirLabsListResponse<ScheduleRecord> = await response.json();
  if (data.error || !data.response?.length) return null;

  const match = findMatchingRecord(data.response, flightDate);
  return match ? mapRecord(match, "schedules") : null;
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

  return mapRecord(
    {
      ...data.response,
      arr_actual: data.response.arr_actual ?? data.response.arr_estimated,
    },
    "live"
  );
}

export async function fetchRouteAirports(
  flightIata: string,
  apiKey: string
): Promise<{ dep_iata?: string; arr_iata?: string } | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
    _fields: "dep_iata,arr_iata",
    limit: "1",
  });

  const response = await fetch(
    `https://airlabs.co/api/v9/routes?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return null;

  const data: AirLabsListResponse<RouteRecord> = await response.json();
  if (data.error || !data.response?.length) return null;

  return data.response[0];
}

export async function fetchTodayFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const schedulesFlight = await fetchSchedulesFlight(
    flightIata,
    flightDate,
    apiKey
  );
  if (schedulesFlight) return schedulesFlight;

  return fetchLiveFlight(flightIata, flightDate, apiKey);
}

export function isValidFlightDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function touchesUaeAirport(flight: {
  dep_iata?: string;
  arr_iata?: string;
}): boolean {
  return (
    (flight.dep_iata != null && UAE_AIRPORTS.includes(flight.dep_iata)) ||
    (flight.arr_iata != null && UAE_AIRPORTS.includes(flight.arr_iata))
  );
}

export function buildManualFlightData(input: {
  flightDate: string;
  isCancelled: boolean;
  arrDelayMinutes: number;
  depIata?: string;
  arrIata?: string;
}): FlightData {
  return {
    status: input.isCancelled ? "cancelled" : "landed",
    arr_delayed: input.isCancelled ? 0 : input.arrDelayMinutes,
    dep_iata: input.depIata,
    arr_iata: input.arrIata,
    dep_time: `${input.flightDate} 00:00`,
    source: "manual",
  };
}

export function formatRoute(flight: FlightData): string | null {
  if (!flight.dep_iata && !flight.arr_iata) return null;
  return `${flight.dep_iata ?? "?"} → ${flight.arr_iata ?? "?"}`;
}
