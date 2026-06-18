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

interface HistoricalRecord extends ScheduleRecord {}

interface AirLabsListResponse<T> {
  response?: T[];
  error?: { message?: string; code?: string };
  request?: { has_more?: boolean };
}

interface LiveFlightResponse {
  response?: ScheduleRecord;
  error?: { message?: string; code?: string };
}

export interface FlightLookupResult {
  flight: FlightData | null;
  errorCode?: "not_found" | "historical_unavailable" | "date_mismatch";
  message?: string;
  returnedDate?: string;
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

function findMatchingRecord<T extends ScheduleRecord>(
  records: T[],
  flightDate: string
): T | undefined {
  return records.find((record) => matchesFlightDate(record.dep_time, flightDate));
}

async function fetchHistoricalFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<{ flight: FlightData | null; unavailable: boolean }> {
  let offset = 0;
  const maxPages = 20;

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

    const data: AirLabsListResponse<HistoricalRecord> = await response.json();

    if (data.error) {
      const code = data.error.code ?? "";
      const unavailable =
        code === "unknown_method" ||
        code === "method_not_allowed" ||
        data.error.message?.toLowerCase().includes("historical") === true;
      return { flight: null, unavailable };
    }

    if (!response.ok || !data.response?.length) {
      return { flight: null, unavailable: false };
    }

    const match = findMatchingRecord(data.response, flightDate);
    if (match) {
      return { flight: mapRecord(match, "historical"), unavailable: false };
    }

    if (!data.request?.has_more) break;
    offset += data.response.length;
  }

  return { flight: null, unavailable: false };
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

export function isValidFlightDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function touchesUaeAirport(flight: FlightData): boolean {
  return (
    (flight.dep_iata != null && UAE_AIRPORTS.includes(flight.dep_iata)) ||
    (flight.arr_iata != null && UAE_AIRPORTS.includes(flight.arr_iata))
  );
}

export function assertFlightMatchesDate(
  flight: FlightData,
  flightDate: string
): FlightLookupResult | null {
  const returnedDate = extractDepartureDate(flight.dep_time);

  if (!returnedDate || returnedDate !== flightDate) {
    return {
      flight: null,
      errorCode: "date_mismatch",
      returnedDate: returnedDate ?? undefined,
      message: returnedDate
        ? `AirLabs returned ${flight.dep_iata ?? "?"} → ${flight.arr_iata ?? "?"} departing on ${returnedDate}, not ${flightDate}. EK569 flies daily — make sure you entered the exact date shown on your ticket.`
        : `Could not confirm the departure date for this flight. Please check the date on your boarding pass.`,
    };
  }

  return null;
}

export async function fetchFlightByNumberAndDate(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightLookupResult> {
  const today = getTodayInUae();
  const isToday = flightDate === today;

  const { flight: historicalFlight, unavailable: historicalUnavailable } =
    await fetchHistoricalFlight(flightIata, flightDate, apiKey);

  if (historicalFlight) {
    const mismatch = assertFlightMatchesDate(historicalFlight, flightDate);
    if (mismatch) return mismatch;
    return { flight: historicalFlight };
  }

  if (!isToday && historicalUnavailable) {
    return {
      flight: null,
      errorCode: "historical_unavailable",
      message:
        "Past flight lookup requires the AirLabs Historical API (v10) on your account. Your current API key does not have access. Contact AirLabs to enable it, or check a flight from today only.",
    };
  }

  const schedulesFlight = await fetchSchedulesFlight(
    flightIata,
    flightDate,
    apiKey
  );
  if (schedulesFlight) {
    const mismatch = assertFlightMatchesDate(schedulesFlight, flightDate);
    if (mismatch) return mismatch;
    return { flight: schedulesFlight };
  }

  if (isToday) {
    const liveFlight = await fetchLiveFlight(flightIata, flightDate, apiKey);
    if (liveFlight) {
      const mismatch = assertFlightMatchesDate(liveFlight, flightDate);
      if (mismatch) return mismatch;
      return { flight: liveFlight };
    }
  }

  if (!isToday) {
    return {
      flight: null,
      errorCode: "not_found",
      message: `No record found for ${flightIata} on ${flightDate}. Past flights are searched via the AirLabs Historical API — verify the date on your ticket (not today's date).`,
    };
  }

  return {
    flight: null,
    errorCode: "not_found",
    message: `No record found for ${flightIata} on ${flightDate}. The flight may not have departed yet, or data is not yet available.`,
  };
}

export function formatRoute(flight: FlightData): string | null {
  if (!flight.dep_iata && !flight.arr_iata) return null;
  return `${flight.dep_iata ?? "?"} → ${flight.arr_iata ?? "?"}`;
}
