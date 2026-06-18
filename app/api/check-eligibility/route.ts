import { NextRequest, NextResponse } from "next/server";
import {
  extractDepartureDate,
  fetchFlightByNumberAndDate,
  getTodayInUae,
  isValidFlightDate,
  touchesUaeAirport,
} from "@/lib/airlabs";
import { evaluateEligibility, notUaeEligibleResult } from "@/lib/gcaa";

interface RequestBody {
  flightIata: string;
  flightDate: string;
  extraordinaryCircumstances: boolean;
  expenses: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { flightIata, flightDate, extraordinaryCircumstances, expenses } =
      body;

    if (!flightIata || typeof flightIata !== "string") {
      return NextResponse.json(
        { message: "Flight number is required." },
        { status: 400 }
      );
    }

    if (!flightDate || !isValidFlightDate(flightDate)) {
      return NextResponse.json(
        { message: "A valid flight date is required (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    const today = getTodayInUae();
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
            "Flight data service is not configured. Set AIRLABS_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.",
        },
        { status: 500 }
      );
    }

    const normalizedFlight = flightIata.trim().toUpperCase();
    let lookup;

    try {
      lookup = await fetchFlightByNumberAndDate(
        normalizedFlight,
        flightDate,
        apiKey
      );
    } catch {
      return NextResponse.json(
        { message: "Unable to reach the flight data service. Please try again." },
        { status: 502 }
      );
    }

    if (!lookup.flight) {
      return NextResponse.json(
        {
          message:
            lookup.message ??
            `No flight found for ${normalizedFlight} on ${flightDate}.`,
        },
        { status: lookup.errorCode === "historical_unavailable" ? 503 : 404 }
      );
    }

    const flight = lookup.flight;
    const resolvedDate = extractDepartureDate(flight.dep_time) ?? flightDate;

    if (!touchesUaeAirport(flight)) {
      return NextResponse.json(
        notUaeEligibleResult(flight, resolvedDate)
      );
    }

    return NextResponse.json(
      evaluateEligibility(
        flight,
        resolvedDate,
        extraordinaryCircumstances,
        expenses ?? 0
      )
    );
  } catch {
    return NextResponse.json(
      { message: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
