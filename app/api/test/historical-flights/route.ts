import { NextRequest, NextResponse } from "next/server";
import {
  fetchUaeHistoricalFlights,
  getDateRangeDays,
  getTodayInUae,
  isValidFlightDate,
  UAE_AIRPORT_CODES,
} from "@/lib/aviation-edge";

const MAX_RANGE_DAYS = 30;
const MAX_RANGE_ALL_AIRPORTS = 7;

export async function GET(request: NextRequest) {
  const apiKey = process.env.AVIATION_EDGE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        message:
          "AVIATION_EDGE_API_KEY is not configured. Add it in Vercel Environment Variables.",
      },
      { status: 500 }
    );
  }

  const params = request.nextUrl.searchParams;
  const today = getTodayInUae();
  let dateTo = params.get("date_to") ?? today;
  if (dateTo > today) dateTo = today;

  let dateFrom =
    params.get("date_from") ??
    (() => {
      const start = new Date(`${dateTo}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 6);
      return start.toISOString().slice(0, 10);
    })();

  if (!isValidFlightDate(dateFrom) || !isValidFlightDate(dateTo)) {
    return NextResponse.json(
      { message: "date_from and date_to must be YYYY-MM-DD." },
      { status: 400 }
    );
  }

  if (dateFrom > dateTo) {
    return NextResponse.json(
      { message: "date_from must be on or before date_to." },
      { status: 400 }
    );
  }

  if (dateTo > today) {
    return NextResponse.json(
      { message: "date_to cannot be in the future." },
      { status: 400 }
    );
  }

  const airportParam = params.get("airport");
  const airports = airportParam
    ? airportParam
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter((code) =>
          (UAE_AIRPORT_CODES as readonly string[]).includes(code)
        )
    : [...UAE_AIRPORT_CODES];

  if (!airports.length) {
    return NextResponse.json(
      {
        message: `airport must be one or more of: ${UAE_AIRPORT_CODES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const maxRange =
    airports.length === 1 ? MAX_RANGE_DAYS : MAX_RANGE_ALL_AIRPORTS;
  const rangeDays = getDateRangeDays(dateFrom, dateTo);
  if (rangeDays > maxRange) {
    return NextResponse.json(
      {
        message:
          airports.length === 1
            ? `Date range cannot exceed ${MAX_RANGE_DAYS} days.`
            : `When querying all UAE airports, use at most ${MAX_RANGE_ALL_AIRPORTS} days (or select a single airport for up to 30 days).`,
      },
      { status: 400 }
    );
  }

  const airlineIata = params.get("airline_iata")?.trim().toUpperCase() || undefined;
  const status = params.get("status")?.trim().toLowerCase() || undefined;

  if (status && !["landed", "cancelled"].includes(status)) {
    return NextResponse.json(
      { message: "status must be 'landed' or 'cancelled'." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchUaeHistoricalFlights({
      dateFrom,
      dateTo,
      apiKey,
      airports,
      airlineIata,
      status,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Failed to fetch historical flights from Aviation Edge." },
      { status: 502 }
    );
  }
}
