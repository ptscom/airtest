import type { FlightData } from "@/types/flight";
import type {
  HistoricalFlightSummary,
  HistoricalFlightsResponse,
  HistoricalQueryResult,
} from "@/types/historical-flight";

export const UAE_AIRPORT_CODES = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"] as const;
const UAE_AIRPORTS = [...UAE_AIRPORT_CODES];
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
    (dep != null && (UAE_AIRPORT_CODES as readonly string[]).includes(dep)) ||
    (arr != null && (UAE_AIRPORT_CODES as readonly string[]).includes(arr))
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

function recordToSummary(
  record: AeFlightRecord,
  uaeAirport: string,
  queryType: "arrival" | "departure"
): HistoricalFlightSummary {
  const depDelay = parseDelay(record.departure?.delay);
  const arrDelay = parseDelay(record.arrival?.delay);

  return {
    flightIata: record.flight?.iataNumber?.toUpperCase() ?? "UNKNOWN",
    airline: record.airline?.iataCode?.toUpperCase() ?? null,
    departure: normalizeIata(record.departure?.iataCode) ?? null,
    arrival: normalizeIata(record.arrival?.iataCode) ?? null,
    status: record.status ?? "unknown",
    flightDate: extractDateFromDateTime(
      record.departure?.scheduledTime ?? record.departure?.actualTime
    ),
    depScheduled: formatAeTime(record.departure?.scheduledTime) ?? null,
    arrScheduled: formatAeTime(record.arrival?.scheduledTime) ?? null,
    depDelay,
    arrDelay,
    uaeAirport,
    queryType,
  };
}

function flightDedupKey(flight: HistoricalFlightSummary): string {
  return [
    flight.flightIata,
    flight.depScheduled ?? "",
    flight.departure ?? "",
    flight.arrival ?? "",
  ].join("|");
}

export function getDateRangeDays(dateFrom: string, dateTo: string): number {
  return daysBetween(dateFrom, dateTo) + 1;
}

export function shiftDateBack(days: number, fromDate?: string): string {
  return shiftDate(fromDate ?? getTodayInUae(), -days);
}

export function eachDayInRange(dateFrom: string, dateTo: string): string[] {
  const days: string[] = [];
  let current = dateFrom;

  while (current <= dateTo) {
    days.push(current);
    current = shiftDate(current, 1);
  }

  return days;
}

function buildHistoryUrl(
  airport: string,
  type: "arrival" | "departure",
  date: string,
  filters: { airlineIata?: string; status?: string }
): string {
  const params = new URLSearchParams({
    code: airport,
    type,
    date_from: date,
  });

  if (filters.airlineIata) params.set("airline_iata", filters.airlineIata);
  if (filters.status) params.set("status", filters.status);

  return `${BASE_URL}/flightsHistory?key=***&${params.toString()}`;
}

function parseHistoryResponse(
  data: unknown
): { records: AeFlightRecord[]; error?: string } {
  if (Array.isArray(data)) {
    return { records: data };
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (obj.error) {
      const message =
        typeof obj.error === "string"
          ? obj.error
          : typeof obj.error === "object" &&
              obj.error &&
              "message" in obj.error &&
              typeof (obj.error as { message?: string }).message === "string"
            ? (obj.error as { message: string }).message
            : JSON.stringify(obj.error);

      return { records: [], error: message };
    }

    if (Array.isArray(obj.data)) {
      return { records: obj.data as AeFlightRecord[] };
    }

    if (Array.isArray(obj.response)) {
      return { records: obj.response as AeFlightRecord[] };
    }

    return {
      records: [],
      error: `Unexpected response: ${JSON.stringify(data).slice(0, 180)}`,
    };
  }

  return { records: [], error: "Empty response from Aviation Edge" };
}

async function fetchAirportHistory(
  airport: string,
  type: "arrival" | "departure",
  date: string,
  apiKey: string,
  filters: { airlineIata?: string; status?: string }
): Promise<{
  records: AeFlightRecord[];
  error?: string;
  sampleUrl: string;
}> {
  const params: Record<string, string> = {
    code: airport,
    type,
    date_from: date,
  };

  if (filters.airlineIata) params.airline_iata = filters.airlineIata;
  if (filters.status) params.status = filters.status;

  const sampleUrl = buildHistoryUrl(airport, type, date, filters);
  const search = new URLSearchParams({ key: apiKey, ...params });

  const response = await fetch(
    `${BASE_URL}/flightsHistory?${search.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (response.status === 404) {
    return { records: [], sampleUrl };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      records: [],
      error: `HTTP ${response.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      sampleUrl,
    };
  }

  const data = await response.json();
  const parsed = parseHistoryResponse(data);

  return { ...parsed, sampleUrl };
}

async function fetchTimetableForAirport(
  airport: string,
  type: "arrival" | "departure",
  date: string,
  apiKey: string,
  filters: { airlineIata?: string; status?: string }
): Promise<AeFlightRecord[]> {
  const params: Record<string, string> = {
    iataCode: airport,
    type,
  };

  if (filters.airlineIata) params.airline_iata = filters.airlineIata;
  if (filters.status) params.status = filters.status;

  const search = new URLSearchParams({ key: apiKey, ...params });
  const response = await fetch(
    `${BASE_URL}/timetable?${search.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.filter((record: AeFlightRecord) =>
    recordMatchesDate(record, date)
  );
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    const current = index++;
    if (current >= items.length) return;
    results[current] = await worker(items[current]);
    await runNext();
  }

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => runNext()
  );
  await Promise.all(runners);

  return results;
}

export async function fetchUaeHistoricalFlights(options: {
  dateFrom: string;
  dateTo: string;
  apiKey: string;
  airports?: string[];
  airlineIata?: string;
  status?: string;
}): Promise<HistoricalFlightsResponse> {
  const {
    dateFrom,
    dateTo,
    apiKey,
    airlineIata,
    status,
    airports = [...UAE_AIRPORT_CODES],
  } = options;

  const filters = { airlineIata, status };
  const queries: HistoricalQueryResult[] = [];
  const allFlights: HistoricalFlightSummary[] = [];
  const warnings: string[] = [];
  const today = getTodayInUae();
  const days = eachDayInRange(dateFrom, dateTo);

  const tasks: Array<{
    airport: string;
    type: "arrival" | "departure";
    date: string;
    useTimetable: boolean;
  }> = [];

  for (const date of days) {
    const useTimetable = isRecentFlightDate(date, today);

    for (const airport of airports) {
      tasks.push({ airport, type: "arrival", date, useTimetable });
      tasks.push({ airport, type: "departure", date, useTimetable });
    }
  }

  const results = await runWithConcurrency(tasks, 4, async (task) => {
    const history = await fetchAirportHistory(
      task.airport,
      task.type,
      task.date,
      apiKey,
      filters
    );

    let records = history.records;

    if (records.length === 0 && task.useTimetable) {
      const timetableRecords = await fetchTimetableForAirport(
        task.airport,
        task.type,
        task.date,
        apiKey,
        filters
      );
      if (timetableRecords.length > 0) {
        records = timetableRecords;
      }
    }

    return {
      airport: task.airport,
      type: task.type,
      date: task.date,
      records,
      error: history.error,
      sampleUrl: history.sampleUrl,
    };
  });

  for (const { airport, type, date, records, error, sampleUrl } of results) {
    queries.push({
      airport,
      type,
      date,
      count: records.length,
      error,
      sampleUrl,
    });

    for (const record of records) {
      allFlights.push(recordToSummary(record, airport, type));
    }
  }

  const seen = new Set<string>();
  const uniqueFlights: HistoricalFlightSummary[] = [];

  for (const flight of allFlights) {
    const key = flightDedupKey(flight);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFlights.push(flight);
  }

  uniqueFlights.sort((a, b) => {
    const dateCompare = (b.flightDate ?? "").localeCompare(a.flightDate ?? "");
    if (dateCompare !== 0) return dateCompare;
    return a.flightIata.localeCompare(b.flightIata);
  });

  const cancelledCount = uniqueFlights.filter(
    (f) => f.status === "cancelled"
  ).length;
  const delayedCount = uniqueFlights.filter(
    (f) => (f.arrDelay ?? 0) >= 120 || (f.depDelay ?? 0) >= 120
  ).length;

  const errors = queries.filter((query) => query.error);
  const zeroResults = queries.filter((query) => query.count === 0 && !query.error);

  if (uniqueFlights.length === 0 && errors.length > 0) {
    warnings.push(
      `All ${errors.length} queries returned errors. Check your API key and subscription includes Historical Schedules.`
    );
  } else if (uniqueFlights.length === 0 && zeroResults.length === queries.length) {
    warnings.push(
      "Aviation Edge returned empty arrays for every query. Try a single recent day (e.g. yesterday), one airport (AUH), and no filters first."
    );
  }

  if (days.some((day) => day > today)) {
    warnings.push("Future dates were excluded — historical data only exists for past dates.");
  }

  return {
    flights: uniqueFlights,
    queries,
    dateFrom,
    dateTo,
    totalUnique: uniqueFlights.length,
    cancelledCount,
    delayedCount,
    totalApiCalls: queries.length,
    warnings,
  };
}
