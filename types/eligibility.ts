export interface EligibilityResult {
  eligible: boolean;
  headline: string;
  refundEligible: boolean;
  dutyOfCareEligible: boolean;
  expenseReimbursementPossible: boolean;
  regulatoryNotes: string[];
  message: string;
  delayDuration: number | null;
  dutyOfCare: string | null;
  financialNote: string | null;
  flightDate: string;
  depTime: string | null;
  arrTime: string | null;
  route: string | null;
  status: string | null;
  dataSource: "historical" | "live" | "manual" | null;
  usedManualInput: boolean;
}
