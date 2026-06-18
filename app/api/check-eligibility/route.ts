import { NextRequest, NextResponse } from "next/server";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];

interface RequestBody {
  flightIata: string;
  flightDate?: string;
  extraordinaryCircumstances: boolean;
  expenses: number;
}

interface AirLabsFlight {
  status?: string;
  arr_delayed?: number | null;
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string;
}

interface AirLabsResponse {
  response?: AirLabsFlight;
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

function extractDateFromDepTime(depTime: string | undefined): string | null {
  if (!depTime) return null;
  return depTime.slice(0, 10);
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

    if (flightDate && !isValidDateFormat(flightDate)) {
      return NextResponse.json(
        { message: "Flight date must be in YYYY-MM-DD format." },
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

    const params = new URLSearchParams({
      api_key: apiKey,
      flight_iata: flightIata.trim().toUpperCase(),
      _fields: "status,arr_delayed,dep_iata,arr_iata,dep_time",
    });

    let airLabsData: AirLabsResponse;

    try {
      const airLabsResponse = await fetch(
        `https://airlabs.co/api/v9/flight?${params.toString()}`,
        { next: { revalidate: 0 } }
      );

      if (!airLabsResponse.ok) {
        return NextResponse.json(
          {
            message: `Flight data service returned an error (${airLabsResponse.status}).`,
          },
          { status: 502 }
        );
      }

      airLabsData = await airLabsResponse.json();
    } catch {
      return NextResponse.json(
        { message: "Unable to reach the flight data service. Please try again." },
        { status: 502 }
      );
    }

    if (airLabsData.error) {
      return NextResponse.json(
        {
          message:
            airLabsData.error.message ||
            "Flight not found. Please check the flight number and try again.",
        },
        { status: 404 }
      );
    }

    const flight = airLabsData.response;
    if (!flight) {
      return NextResponse.json(
        { message: "No flight data returned. Please verify the flight number." },
        { status: 404 }
      );
    }

    const returnedDate = extractDateFromDepTime(flight.dep_time);

    if (flightDate && returnedDate && returnedDate !== flightDate) {
      return NextResponse.json(
        {
          message: `AirLabs returned ${flightIata.trim().toUpperCase()} departing on ${returnedDate}, which does not match your entered date (${flightDate}). The /flight API returns one flight and cannot search by date — try a flight that is currently active or adjust the date.`,
        },
        { status: 404 }
      );
    }

    const { status, dep_iata, arr_iata } = flight;
    const arr_delayed = flight.arr_delayed ?? 0;
    const resolvedFlightDate = flightDate ?? returnedDate ?? null;

    const touchesUae =
      (dep_iata && UAE_AIRPORTS.includes(dep_iata)) ||
      (arr_iata && UAE_AIRPORTS.includes(arr_iata));

    if (!touchesUae) {
      return NextResponse.json({
        eligible: false,
        message: "Flight must touch a UAE airport.",
        delayDuration: arr_delayed,
        dutyOfCare: null,
        financialNote: null,
        flightDate: resolvedFlightDate,
        depTime: flight.dep_time ?? null,
      });
    }

    let eligible = false;
    let message = "";
    let dutyOfCare: string | null = null;
    let dutyOfCareEligible = false;
    const delayDuration = arr_delayed;

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
      flightDate: resolvedFlightDate,
      depTime: flight.dep_time ?? null,
    });
  } catch {
    return NextResponse.json(
      { message: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
