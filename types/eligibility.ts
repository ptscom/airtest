export interface EligibilityResult {
  eligible: boolean;
  message: string;
  delayDuration: number | null;
  dutyOfCare: string | null;
  financialNote: string | null;
  flightDate: string;
  depTime: string | null;
  arrTime: string | null;
  route: string | null;
  status: string | null;
  dataSource: "historical" | "schedules" | "live" | null;
}
