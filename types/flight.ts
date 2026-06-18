export interface FlightData {
  status: string;
  arr_delayed: number;
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string;
  arr_time?: string;
  arr_actual?: string;
  source: "historical" | "live";
}

export interface AirLabsError {
  message?: string;
  code?: string;
}
