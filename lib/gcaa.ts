import type { FlightData } from "@/types/flight";
import type { EligibilityResult } from "@/types/eligibility";
import { formatRoute } from "@/lib/aviation-edge";

const US_DEPARTURE_AIRPORTS = new Set([
  "ATL", "BOS", "CLT", "DEN", "DFW", "DTW", "EWR", "FLL", "HNL", "IAD",
  "IAH", "JFK", "LAS", "LAX", "MCO", "MDW", "MIA", "MSP", "ORD", "PHL",
  "PHX", "SAN", "SEA", "SFO", "SLC", "TPA",
]);

const DOT_REFUND_DELAY_MINUTES = 360;

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

function getRegulatoryNotes(
  flight: FlightData,
  status: string,
  arrDelayed: number,
  dutyOfCareEligible: boolean
): string[] {
  const notes: string[] = [];

  if (status !== "cancelled" && dutyOfCareEligible) {
    notes.push(
      "A delay alone does not entitle you to a full ticket refund if you completed the journey. GCAA rules provide duty of care (meals, hotel, communication) — not automatic cash refunds for delays."
    );
  }

  const dep = flight.dep_iata?.toUpperCase();
  if (dep && US_DEPARTURE_AIRPORTS.has(dep) && status !== "cancelled") {
    if (arrDelayed < DOT_REFUND_DELAY_MINUTES) {
      notes.push(
        `This flight departed the United States (${dep}). Under U.S. DOT rules, an automatic cash refund for an international delay typically requires a delay of 6+ hours and that you choose not to travel. Your ${arrDelayed}-minute delay is below that threshold.`
      );
    } else {
      notes.push(
        `This flight departed the United States (${dep}). Under U.S. DOT rules, you may have refund rights if the delay reached 6+ hours and you chose not to travel.`
      );
    }
  }

  return notes;
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
    return "You may be able to claim reimbursement for provable out-of-pocket expenses (e.g. meals you paid for at the airport). This is not a ticket refund — keep receipts and submit to the airline.";
  }
  return null;
}

export function evaluateEligibility(
  flight: FlightData,
  flightDate: string,
  extraordinaryCircumstances: boolean,
  expenses: number,
  usedManualInput: boolean
): EligibilityResult {
  const { status, arr_delayed } = flight;
  const isCancelled = status === "cancelled";
  const dutyResult = getDutyOfCare(isCancelled ? 0 : arr_delayed);
  const dutyOfCareEligible = isCancelled || dutyResult.eligible;
  const refundEligible = isCancelled;
  const expenseReimbursementPossible =
    expenses > 0 && !extraordinaryCircumstances;

  let headline = "Not Eligible";
  let message = "";
  let dutyOfCare: string | null = null;

  if (isCancelled) {
    headline = "Cancellation — Refund or Rebooking";
    message =
      "This flight was cancelled. You may be eligible for a full ticket refund or free rebooking under GCAA passenger welfare rules.";
    dutyOfCare =
      "Hotel accommodation if an overnight stay is required due to cancellation.";
  } else if (dutyResult.eligible) {
    headline = "Duty of Care Applies";
    message = `Arrival delay of ${arr_delayed} minutes qualifies for GCAA duty of care (meals, refreshments, communication, etc.). This is not a ticket refund.`;
    dutyOfCare = dutyResult.text;
  } else {
    message = `Arrival delay of ${arr_delayed} minutes is below the 120-minute threshold required for duty of care.`;
    dutyOfCare = dutyResult.text;
  }

  if (usedManualInput) {
    message = `${message} (Based on the delay/cancellation details you provided.)`;
  }

  const financialNote = getFinancialNote(
    extraordinaryCircumstances,
    expenses,
    dutyOfCareEligible
  );

  if (expenseReimbursementPossible && !isCancelled && !dutyResult.eligible) {
    headline = "Expense Reimbursement Possible";
  }

  const regulatoryNotes = getRegulatoryNotes(
    flight,
    status ?? "unknown",
    arr_delayed,
    dutyOfCareEligible
  );

  const eligible =
    refundEligible || dutyOfCareEligible || expenseReimbursementPossible;

  return {
    eligible,
    headline,
    refundEligible,
    dutyOfCareEligible,
    expenseReimbursementPossible,
    regulatoryNotes,
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
    usedManualInput,
  };
}

export function notUaeEligibleResult(
  flight: FlightData,
  flightDate: string,
  usedManualInput: boolean
): EligibilityResult {
  return {
    eligible: false,
    headline: "Not Eligible",
    refundEligible: false,
    dutyOfCareEligible: false,
    expenseReimbursementPossible: false,
    regulatoryNotes: [],
    message: "Flight must touch a UAE airport (DXB, AUH, SHJ, DWC, RKT, or AAN).",
    delayDuration: flight.arr_delayed,
    dutyOfCare: null,
    financialNote: null,
    flightDate,
    depTime: flight.dep_time ?? null,
    arrTime: flight.arr_actual ?? flight.arr_time ?? null,
    route: formatRoute(flight),
    status: flight.status ?? null,
    dataSource: flight.source,
    usedManualInput,
  };
}
