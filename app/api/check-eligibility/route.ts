import { NextRequest, NextResponse } from "next/server";

const UAE_AIRPORTS = ["DXB", "AUH", "SHJ", "DWC", "RKT", "AAN"];

interface RequestBody {
  flightIata: string;
  extraordinaryCircumstances: boolean;
  expenses: number;
}

interface AirLabsFlight {
  status?: string;
  arr_delayed?: number;
  dep_iata?: string;
  arr_iata?: string;
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
  expenses: number
): string | null {
  if (extraordinaryCircumstances) {
    return "Financial damages are not owed due to the airline's claim of extraordinary circumstances, but Duty of Care still applies.";
  }
  if (expenses > 0) {
    return "You are entitled to claim reimbursement for provable financial losses.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { flightIata, extraordinaryCircumstances, expenses } = body;

    if (!flightIata || typeof flightIata !== "string") {
      return NextResponse.json(
        { message: "Flight number is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.AIRLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "Flight data service is not configured." },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      flight_iata: flightIata.trim().toUpperCase(),
      _fields: "status,arr_delayed,dep_iata,arr_iata",
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
      });
    }

    let eligible = false;
    let message = "";
    let dutyOfCare: string | null = null;
    const delayDuration = arr_delayed ?? null;

    if (status === "cancelled") {
      eligible = true;
      message =
        "Eligible for Full Ticket Refund OR Free Rebooking, plus Hotel Accommodation if overnight stay is required.";
      dutyOfCare =
        "Hotel Accommodation if an overnight stay is required due to cancellation.";
    } else {
      const dutyResult = getDutyOfCare(arr_delayed);
      dutyOfCare = dutyResult.text;
      eligible = dutyResult.eligible;

      if (dutyResult.eligible) {
        message = `Eligible for Duty of Care: ${dutyResult.text}`;
      } else {
        message = dutyResult.text;
      }
    }

    const financialNote = getFinancialNote(
      extraordinaryCircumstances,
      expenses ?? 0
    );

    if (financialNote) {
      if (!extraordinaryCircumstances && expenses > 0) {
        eligible = true;
      }
      message = message ? `${message} ${financialNote}` : financialNote;
    }

    return NextResponse.json({
      eligible,
      message,
      delayDuration,
      dutyOfCare,
      financialNote,
    });
  } catch {
    return NextResponse.json(
      { message: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
