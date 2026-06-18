import { NextRequest, NextResponse } from "next/server";
import {
  buildManualFlightData,
  fetchRouteAirports,
  getTodayInUae,
  isValidFlightDate,
  resolveFlightData,
  touchesUaeAirport,
} from "@/lib/airlabs";
import { evaluateEligibility, notUaeEligibleResult } from "@/lib/gcaa";
import type { FlightData } from "@/types/flight";

interface RequestBody {
  flightIata: string;
  flightDate: string;
  extraordinaryCircumstances: boolean;
  expenses: number;
  isCancelled?: boolean;
  arrDelayMinutes?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const {
      flightIata,
      flightDate,
      extraordinaryCircumstances,
      expenses,
      isCancelled = false,
      arrDelayMinutes,
    } = body;

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
      lookup = await resolveFlightData(
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

    let flight: FlightData | null = lookup.flight;
    let usedManualInput = false;

    if (!flight) {
      const hasManualInput =
        isCancelled ||
        (arrDelayMinutes !== undefined && arrDelayMinutes !== null);

      if (!hasManualInput) {
        return NextResponse.json(
          {
            message:
              lookup.message ??
              `No flight record found for ${normalizedFlight} on ${flightDate}. EK569 departs BLR at 04:45 local time (June 18) but June 17 in UTC — try both dates. You can also enter your delay manually below.`,
          },
          { status: 404 }
        );
      }

      const delay = isCancelled ? 0 : Math.max(0, Number(arrDelayMinutes) || 0);
      const route = await fetchRouteAirports(normalizedFlight, apiKey);

      flight = buildManualFlightData({
        flightDate,
        isCancelled,
        arrDelayMinutes: delay,
        depIata: route?.dep_iata,
        arrIata: route?.arr_iata,
      });
      usedManualInput = true;
    }

    if (!touchesUaeAirport(flight)) {
      return NextResponse.json(
        notUaeEligibleResult(flight, flightDate, usedManualInput)
      );
    }

    return NextResponse.json(
      evaluateEligibility(
        flight,
        flightDate,
        extraordinaryCircumstances,
        expenses ?? 0,
        usedManualInput
      )
    );
  } catch {
    return NextResponse.json(
      { message: "An unexpected error occurred while processing your request." },
      { status: 500 }
    );
  }
}
