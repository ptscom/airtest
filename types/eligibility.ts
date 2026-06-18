export interface EligibilityResult {
  eligible: boolean;
  message: string;
  delayDuration: number | null;
  dutyOfCare: string | null;
  financialNote: string | null;
  flightDate?: string | null;
  depTime?: string | null;
}
