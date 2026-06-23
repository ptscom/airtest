import type { FlightData } from "@/types/flight";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];
const UAE_TIMEZONE = "Asia/Dubai";
const RECENT_FLIGHT_DAYS = 3;
const BASE_URL = "https://aviation-edge.com/v2/public";

interface AeAirportTime {
  actualRunway?: string;
  actualTime?: string;
  delay?: string | number | null;
  estimatedRunway?: string;
  estimatedTime?: string;
  iataCode?: string;
  scheduledTime?: string;
}

interface AeFlightRecord {
  airline?: { iataCode?: string; icaoCode?: string; name?: string };
  arrival?: AeAirportTime;
  departure?: AeAirportTime;
  flight?: { iataNumber?: string; icaoNumber?: string; number?: string };
  codeshared?: {
    airline?: { iataCode?: string };
    flight?: { iataNumber?: string; number?: string };
  };
  status?: string;
  type?: string;
}

interface AeRouteRecord {
  departureIata?: string;
  arrivalIata?: string;
}

export interface FlightLookupResult {
  flight: FlightData | null;
  message?: string;
}

function extractDateFromDateTime(dateTime: string | undefined): string | null {
  if (!dateTime) return null;
  return dateTime.slice(0, 10);
}

export function recordMatchesDate(
  record: AeFlightRecord,
  flightDate: string
): boolean {
  const candidateDates = [
    record.departure?.scheduledTime,
    record.departure?.actualTime,
    record.departure?.estimatedTime,
    record.arrival?.scheduledTime,
    record.arrival?.actualTime,
    record.arrival?.estimatedTime,
  ]
    .map(extractDateFromDateTime)
    .filter((value): value is string => Boolean(value));

  return candidateDates.includes(flightDate);
}

export function getTodayInUae(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: UAE_TIMEZONE,
  }).format(new Date());
}

function daysBetween(earlier: string, later: string): number {
  const start = new Date(`${earlier}T00:00:00Z`).getTime();
  const end = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function isRecentFlightDate(flightDate: string, today: string): boolean {
  const diff = daysBetween(flightDate, today);
  return diff >= 0 && diff <= RECENT_FLIGHT_DAYS;
}

function parseFlightIata(
  flightIata: string
): { airline: string; number: string } | null {
  const match = flightIata.match(/^([A-Z]{2,3})(\d+)$/i);
  if (!match) return null;
  return { airline: match[1].toUpperCase(), number: match[2] };
}

function parseDelay(delay: string | number | null | undefined): number | null {
  if (delay == null || delay === "") return null;
  const parsed = typeof delay === "number" ? delay : parseInt(delay, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatAeTime(isoTime: string | undefined): string | undefined {
  if (!isoTime) return undefined;
  return isoTime.replace("T", " ").replace(/\.\d+$/, "");
}

function calculateArrDelay(
  scheduledTime: string | undefined,
  actualTime: string | undefined,
  reportedDelay: number | null
): number {
  if (reportedDelay != null) return reportedDelay;
  if (!scheduledTime || !actualTime) return 0;

  const scheduled = new Date(scheduledTime).getTime();
  const actual = new Date(actualTime).getTime();
  const delayMs = actual - scheduled;

  return delayMs > 0 ? Math.round(delayMs / 60000) : 0;
}

function matchesFlight(
  record: AeFlightRecord,
  flightIata: string,
  airline: string,
  number: string
): boolean {
  const iataNumber = record.flight?.iataNumber?.toUpperCase();
  if (iataNumber === flightIata) return true;

  if (
    record.flight?.number === number &&
    record.airline?.iataCode?.toUpperCase() === airline
  ) {
    return true;
  }

  const codeshareIata = record.codeshared?.flight?.iataNumber?.toUpperCase();
  return codeshareIata === flightIata;
}

function normalizeIata(code: string | undefined): string | undefined {
  return code?.trim().toUpperCase() || undefined;
}

function mapRecord(
  record: AeFlightRecord,
  source: FlightData["source"]
): FlightData {
  const arrDelay = parseDelay(record.arrival?.delay);

  return {
    status: record.status ?? "landed",
    arr_delayed: calculateArrDelay(
      record.arrival?.scheduledTime,
      record.arrival?.actualTime ?? record.arrival?.estimatedTime,
      arrDelay
    ),
    dep_iata: normalizeIata(record.departure?.iataCode),
    arr_iata: normalizeIata(record.arrival?.iataCode),
    dep_time: formatAeTime(
      record.departure?.actualTime ?? record.departure?.scheduledTime
    ),
    arr_time: formatAeTime(record.arrival?.scheduledTime),
    arr_actual: formatAeTime(
      record.arrival?.actualTime ?? record.arrival?.estimatedTime
    ),
    source,
  };
}

function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function searchDates(flightDate: string, today: string): string[] {
  const dates = new Set<string>([
    flightDate,
    shiftDate(flightDate, -1),
    shiftDate(flightDate, 1),
  ]);

  return Array.from(dates)
    .filter((date) => date <= today)
    .sort();
}

async function aeFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string
): Promise<T | null> {
  const search = new URLSearchParams({ key: apiKey, ...params });
  const response = await fetch(`${BASE_URL}/${endpoint}?${search.toString()}`, {
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data || data.error) return null;

  return data as T;
}

function findMatchingRecord(
  records: AeFlightRecord[],
  flightIata: string,
  airline: string,
  number: string,
  flightDate: string
): AeFlightRecord | undefined {
  return records.find(
    (record) =>
      matchesFlight(record, flightIata, airline, number) &&
      recordMatchesDate(record, flightDate)
  );
}

interface AirportQuery {
  code: string;
  type: "arrival" | "departure";
}

function buildAirportQueries(
  route: { dep_iata?: string; arr_iata?: string } | null
): AirportQuery[] {
  const queries: AirportQuery[] = [];

  if (route?.arr_iata) {
    queries.push({ code: route.arr_iata, type: "arrival" });
  }
  if (route?.dep_iata) {
    queries.push({ code: route.dep_iata, type: "departure" });
  }

  const knownCodes = new Set(queries.map((query) => query.code));

  for (const airport of UAE_AIRPORTS) {
    if (!knownCodes.has(airport)) {
      queries.push({ code: airport, type: "arrival" });
      queries.push({ code: airport, type: "departure" });
    }
  }

  return queries;
}

async function fetchHistoricalAtAirport(
  query: AirportQuery,
  date: string,
  airline: string,
  number: string,
  apiKey: string
): Promise<AeFlightRecord[]> {
  const data = await aeFetch<AeFlightRecord[]>("flightsHistory", {
    code: query.code,
    type: query.type,
    date_from: date,
    airline_iata: airline,
    flight_number: number,
  }, apiKey);

  return Array.isArray(data) ? data : [];
}

async function fetchHistoricalFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string,
  route: { dep_iata?: string; arr_iata?: string } | null
): Promise<FlightData | null> {
  const parsed = parseFlightIata(flightIata);
  if (!parsed) return null;

  const today = getTodayInUae();
  const dates = searchDates(flightDate, today);
  const queries = buildAirportQueries(route);

  for (const date of dates) {
    const results = await Promise.all(
      queries.map((query) =>
        fetchHistoricalAtAirport(query, date, parsed.airline, parsed.number, apiKey)
      )
    );

    for (const records of results) {
      const match = findMatchingRecord(
        records,
        flightIata,
        parsed.airline,
        parsed.number,
        flightDate
      );
      if (match) return mapRecord(match, "historical");
    }
  }

  return null;
}

async function fetchTimetableAtAirport(
  airport: string,
  type: "arrival" | "departure",
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const data = await aeFetch<AeFlightRecord[]>("timetable", {
    iataCode: airport,
    type,
    flight_iata: flightIata,
  }, apiKey);

  if (!Array.isArray(data)) return null;

  const parsed = parseFlightIata(flightIata);
  if (!parsed) return null;

  const match = findMatchingRecord(
    data,
    flightIata,
    parsed.airline,
    parsed.number,
    flightDate
  );

  return match ? mapRecord(match, "live") : null;
}

async function fetchLiveFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string,
  route: { dep_iata?: string; arr_iata?: string } | null
): Promise<FlightData | null> {
  const queries = buildAirportQueries(route);

  for (const query of queries) {
    const flight = await fetchTimetableAtAirport(
      query.code,
      query.type,
      flightIata,
      flightDate,
      apiKey
    );
    if (flight) return flight;
  }

  return null;
}

export async function fetchRouteAirports(
  flightIata: string,
  apiKey: string
): Promise<{ dep_iata?: string; arr_iata?: string } | null> {
  const parsed = parseFlightIata(flightIata);
  if (!parsed) return null;

  const data = await aeFetch<AeRouteRecord[]>("routes", {
    airlineIata: parsed.airline,
    flightNumber: parsed.number,
  }, apiKey);

  if (!Array.isArray(data) || !data.length) return null;

  const route = data[0];
  return {
    dep_iata: normalizeIata(route.departureIata),
    arr_iata: normalizeIata(route.arrivalIata),
  };
}

export async function resolveFlightData(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightLookupResult> {
  const today = getTodayInUae();
  const route = await fetchRouteAirports(flightIata, apiKey);

  const historicalFlight = await fetchHistoricalFlight(
    flightIata,
    flightDate,
    apiKey,
    route
  );

  if (historicalFlight) {
    return { flight: historicalFlight };
  }

  if (isRecentFlightDate(flightDate, today)) {
    const liveFlight = await fetchLiveFlight(
      flightIata,
      flightDate,
      apiKey,
      route
    );
    if (liveFlight) return { flight: liveFlight };
  }

  const routeHint = route
    ? ` Route: ${route.dep_iata ?? "?"} → ${route.arr_iata ?? "?"}.`
    : "";

  return {
    flight: null,
    message: `No flight record found for ${flightIata} on ${flightDate}.${routeHint} Try the UTC date if your boarding pass shows a different local departure day (e.g. EK569 BLR→DXB departs June 18 local / June 17 UTC). You can also enter delay or cancellation details manually below.`,
  };
}

export function isValidFlightDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function touchesUaeAirport(flight: {
  dep_iata?: string;
  arr_iata?: string;
}): boolean {
  const dep = normalizeIata(flight.dep_iata);
  const arr = normalizeIata(flight.arr_iata);

  return (
    (dep != null && UAE_AIRPORTS.includes(dep)) ||
    (arr != null && UAE_AIRPORTS.includes(arr))
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
    dep_iata: normalizeIata(input.depIata),
    arr_iata: normalizeIata(input.arrIata),
    dep_time: `${input.flightDate} 00:00`,
    source: "manual",
  };
}

export function formatRoute(flight: FlightData): string | null {
  if (!flight.dep_iata && !flight.arr_iata) return null;
  return `${flight.dep_iata ?? "?"} → ${flight.arr_iata ?? "?"}`;
}
