import type { FlightData } from "@/types/flight";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];
const UAE_TIMEZONE = "Asia/Dubai";
const RECENT_FLIGHT_DAYS = 3;

interface ScheduleRecord {
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string;
  dep_actual?: string;
  dep_time_utc?: string;
  dep_actual_utc?: string;
  arr_time?: string;
  arr_actual?: string;
  arr_estimated?: string;
  arr_estimated_utc?: string;
  dep_delayed?: number;
  arr_delayed?: number | null;
  status?: string;
}

interface AirLabsListResponse<T> {
  response?: T[];
  error?: { message?: string; code?: string };
  request?: { has_more?: boolean; total_items?: number };
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
  sampleDates?: string[];
}

function extractDateFromDateTime(dateTime: string | undefined): string | null {
  if (!dateTime) return null;
  return dateTime.slice(0, 10);
}

export function recordMatchesDate(
  record: ScheduleRecord,
  flightDate: string
): boolean {
  const candidateDates = [
    record.dep_time,
    record.dep_actual,
    record.dep_time_utc,
    record.dep_actual_utc,
  ]
    .map(extractDateFromDateTime)
    .filter((value): value is string => Boolean(value));

  return candidateDates.includes(flightDate);
}

export function extractDepartureDate(
  depTime: string | undefined
): string | null {
  return extractDateFromDateTime(depTime);
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
      record.arr_actual ?? record.arr_estimated,
      record.arr_delayed
    ),
    dep_iata: record.dep_iata,
    arr_iata: record.arr_iata,
    dep_time: record.dep_actual ?? record.dep_time,
    arr_time: record.arr_time,
    arr_actual: record.arr_actual ?? record.arr_estimated,
    source,
  };
}

function findMatchingRecord(
  records: ScheduleRecord[],
  flightDate: string
): ScheduleRecord | undefined {
  return records.find((record) => recordMatchesDate(record, flightDate));
}

function collectSampleDates(records: ScheduleRecord[]): string[] {
  const dates = new Set<string>();

  for (const record of records) {
    for (const field of [
      record.dep_time,
      record.dep_actual,
      record.dep_time_utc,
      record.dep_actual_utc,
    ]) {
      const date = extractDateFromDateTime(field);
      if (date) dates.add(date);
    }
  }

  return Array.from(dates).sort();
}

async function fetchHistoricalFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<{ flight: FlightData | null; sampleDates: string[] }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
  });

  const response = await fetch(
    `https://airlabs.co/api/v10/historical?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) {
    return { flight: null, sampleDates: [] };
  }

  const data: AirLabsListResponse<ScheduleRecord> = await response.json();
  if (data.error || !data.response?.length) {
    return { flight: null, sampleDates: [] };
  }

  const sampleDates = collectSampleDates(data.response);
  const match = findMatchingRecord(data.response, flightDate);

  return {
    flight: match ? mapRecord(match, "historical") : null,
    sampleDates,
  };
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
      "status,arr_delayed,dep_iata,arr_iata,dep_time,dep_actual,dep_time_utc,dep_actual_utc,arr_time,arr_actual,dep_delayed",
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
      "status,arr_delayed,dep_iata,arr_iata,dep_time,dep_actual,dep_time_utc,dep_actual_utc,arr_time,arr_actual,arr_estimated",
  });

  const response = await fetch(
    `https://airlabs.co/api/v9/flight?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return null;

  const data: LiveFlightResponse = await response.json();
  if (data.error || !data.response) return null;
  if (!recordMatchesDate(data.response, flightDate)) return null;

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

export async function resolveFlightData(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightLookupResult> {
  const today = getTodayInUae();
  const { flight: historicalFlight, sampleDates } = await fetchHistoricalFlight(
    flightIata,
    flightDate,
    apiKey
  );

  if (historicalFlight) {
    return { flight: historicalFlight };
  }

  if (isRecentFlightDate(flightDate, today)) {
    const liveFlight = await fetchLiveFlight(flightIata, flightDate, apiKey);
    if (liveFlight) return { flight: liveFlight };

    const schedulesFlight = await fetchSchedulesFlight(
      flightIata,
      flightDate,
      apiKey
    );
    if (schedulesFlight) return { flight: schedulesFlight };
  }

  return {
    flight: null,
    sampleDates,
    message: sampleDates.length
      ? `No match for ${flightDate}. AirLabs historical sample dates: ${sampleDates.join(", ")}. For recent flights, we also check UTC departure dates — EK569 departs BLR locally on the next calendar day.`
      : undefined,
  };
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
