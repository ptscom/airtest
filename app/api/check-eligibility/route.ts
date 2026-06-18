import { NextRequest, NextResponse } from "next/server";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];

interface RequestBody {
  flightIata: string;
  flightDate: string;
  extraordinaryCircumstances: boolean;
  expenses: number;
}

interface FlightData {
  status?: string;
  arr_delayed: number;
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string;
}

interface AirLabsFlightResponse {
  response?: FlightData;
  error?: { message?: string };
}

interface HistoricalFlight {
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
  response?: HistoricalFlight[];
  error?: { message?: string };
}

function getDutyOfCare(delayMinutes: number): {
  eligible: boolean;
  text: string;
} {
  if (delayMinutes >= 360) {
    return {
      eligible: true,
      text: "Meals, Calls, Hotel Accommodation, and Airport Transfers.",
    };
  }
  if (delayMinutes >= 180) {
    return {
      eligible: true,
      text: "Meals, Refreshments, and access to Communication.",
    };
  }
  if (delayMinutes >= 120) {
    return {
      eligible: true,
      text: "Meals and Refreshments.",
    };
  }
  return {
    eligible: false,
    text: "Not eligible for Duty of Care.",
  };
}

function getFinancialNote(
  extraordinaryCircumstances: boolean,
  expenses: number,
  dutyOfCareEligible: boolean
): string | null {
  if (extraordinaryCircumstances) {
    if (dutyOfCareEligible) {
      return "Financial compensation is not owed due to the airline's claim of extraordinary circumstances. Duty of Care entitlements (meals, accommodation, etc.) still apply.";
    }
    return "Financial compensation is not owed due to the airline's claim of extraordinary circumstances.";
  }
  if (expenses > 0) {
    return "You may be entitled to claim reimbursement for provable out-of-pocket financial losses.";
  }
  return null;
}

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function matchesFlightDate(depTime: string | undefined, flightDate: string): boolean {
  if (!depTime) return false;
  return depTime.startsWith(flightDate);
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

async function fetchHistoricalFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
  });

  const response = await fetch(
    `https://airlabs.co/api/v10/historical?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return null;

  const data: HistoricalResponse = await response.json();
  if (data.error || !data.response?.length) return null;

  const match = data.response.find((flight) =>
    matchesFlightDate(flight.dep_time, flightDate)
  );

  if (!match) return null;

  return {
    status: match.status,
    arr_delayed: calculateArrDelay(
      match.arr_time,
      match.arr_actual,
      match.arr_delayed
    ),
    dep_iata: match.dep_iata,
    arr_iata: match.arr_iata,
    dep_time: match.dep_time,
  };
}

async function fetchLiveFlight(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
    _fields: "status,arr_delayed,dep_iata,arr_iata,dep_time",
  });

  const response = await fetch(
    `https://airlabs.co/api/v9/flight?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return null;

  const data: AirLabsFlightResponse = await response.json();
  if (data.error || !data.response) return null;

  if (!matchesFlightDate(data.response.dep_time, flightDate)) return null;

  return {
    ...data.response,
    arr_delayed: data.response.arr_delayed ?? 0,
  };
}

async function fetchFlightForDate(
  flightIata: string,
  flightDate: string,
  apiKey: string
): Promise<FlightData | null> {
  const today = new Date().toISOString().slice(0, 10);
  const isTodayOrPast = flightDate <= today;

  if (isTodayOrPast) {
    const historical = await fetchHistoricalFlight(flightIata, flightDate, apiKey);
    if (historical) return historical;
  }

  if (flightDate === today) {
    const live = await fetchLiveFlight(flightIata, flightDate, apiKey);
    if (live) return live;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { flightIata, flightDate, extraordinaryCircumstances, expenses } = body;

    if (!flightIata || typeof flightIata !== "string") {
      return NextResponse.json(
        { message: "Flight number is required." },
        { status: 400 }
      );
    }

    if (!flightDate || !isValidDateFormat(flightDate)) {
      return NextResponse.json(
        { message: "A valid flight date is required (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (flightDate > today) {
      return NextResponse.json(
        { message: "Flight date cannot be in the future." },
        { status: 400 }
      );
    }

    const apiKey = process.env.AIRLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          message:
            "Flight data service is not configured. Set AIRLABS_API_KEY in .env.local (local dev) or in Vercel Project Settings → Environment Variables (production), then redeploy.",
        },
        { status: 500 }
      );
    }

    const normalizedFlight = flightIata.trim().toUpperCase();
    let flight: FlightData | null;

    try {
      flight = await fetchFlightForDate(normalizedFlight, flightDate, apiKey);
    } catch {
      return NextResponse.json(
        { message: "Unable to reach the flight data service. Please try again." },
        { status: 502 }
      );
    }

    if (!flight) {
      return NextResponse.json(
        {
          message: `No flight data found for ${normalizedFlight} on ${flightDate}. Please verify the flight number and date.`,
        },
        { status: 404 }
      );
    }

    const { status, arr_delayed = 0, dep_iata, arr_iata } = flight;

    const touchesUae =
      (dep_iata && UAE_AIRPORTS.includes(dep_iata)) ||
      (arr_iata && UAE_AIRPORTS.includes(arr_iata));

    if (!touchesUae) {
      return NextResponse.json({
        eligible: false,
        message: "Flight must touch a UAE airport.",
        delayDuration: arr_delayed ?? null,
        dutyOfCare: null,
        financialNote: null,
        flightDate,
      });
    }

    let eligible = false;
    let message = "";
    let dutyOfCare: string | null = null;
    let dutyOfCareEligible = false;
    const delayDuration = arr_delayed ?? null;

    if (status === "cancelled") {
      eligible = true;
      dutyOfCareEligible = true;
      message =
        "This flight was cancelled. You may be eligible for a full ticket refund or free rebooking.";
      dutyOfCare =
        "Hotel accommodation if an overnight stay is required due to cancellation.";
    } else {
      const dutyResult = getDutyOfCare(arr_delayed);
      dutyOfCare = dutyResult.text;
      dutyOfCareEligible = dutyResult.eligible;
      eligible = dutyResult.eligible;

      if (dutyResult.eligible) {
        message = `Arrival delay of ${arr_delayed} minutes qualifies for Duty of Care entitlements.`;
      } else {
        message = `Arrival delay of ${arr_delayed} minutes is below the 120-minute threshold required for Duty of Care.`;
      }
    }

    const financialNote = getFinancialNote(
      extraordinaryCircumstances,
      expenses ?? 0,
      dutyOfCareEligible
    );

    if (financialNote && !extraordinaryCircumstances && expenses > 0) {
      eligible = true;
    }

    return NextResponse.json({
      eligible,
      message,
      delayDuration,
      dutyOfCare,
      financialNote,
      flightDate,
    });
  } catch {
    return NextResponse.json(
      { message: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
