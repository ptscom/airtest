import type { FlightData } from "@/types/flight";
import type { EligibilityResult } from "@/types/eligibility";
import { formatRoute } from "@/lib/airlabs";

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

export function evaluateEligibility(
  flight: FlightData,
  flightDate: string,
  extraordinaryCircumstances: boolean,
  expenses: number
): EligibilityResult {
  const { status, arr_delayed } = flight;
  let eligible = false;
  let message = "";
  let dutyOfCare: string | null = null;
  let dutyOfCareEligible = false;

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
    expenses,
    dutyOfCareEligible
  );

  if (financialNote && !extraordinaryCircumstances && expenses > 0) {
    eligible = true;
  }

  return {
    eligible,
    message,
    delayDuration: arr_delayed,
    dutyOfCare,
    financialNote,
    flightDate,
    depTime: flight.dep_time ?? null,
    arrTime: flight.arr_actual ?? flight.arr_time ?? null,
    route: formatRoute(flight),
    status: flight.status ?? null,
    dataSource: flight.source,
  };
}

export function notUaeEligibleResult(
  flight: FlightData,
  flightDate: string
): EligibilityResult {
  return {
    eligible: false,
    message: "Flight must touch a UAE airport.",
    delayDuration: flight.arr_delayed,
    dutyOfCare: null,
    financialNote: null,
    flightDate,
    depTime: flight.dep_time ?? null,
    arrTime: flight.arr_actual ?? flight.arr_time ?? null,
    route: formatRoute(flight),
    status: flight.status ?? null,
    dataSource: flight.source,
  };
}
