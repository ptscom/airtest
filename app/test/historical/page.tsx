"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getTodayInUae,
  shiftDateBack,
  UAE_AIRPORT_CODES,
} from "@/lib/aviation-edge";
import type { HistoricalFlightsResponse } from "@/types/historical-flight";

const today = getTodayInUae();
const defaultFrom = shiftDateBack(29);

export default function HistoricalTestPage() {
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [airport, setAirport] = useState("ALL");
  const [airlineIata, setAirlineIata] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoricalFlightsResponse | null>(null);

  const filteredFlights = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toUpperCase();
    if (!term) return data.flights;

    return data.flights.filter(
      (flight) =>
        flight.flightIata.includes(term) ||
        flight.departure?.includes(term) ||
        flight.arrival?.includes(term) ||
        flight.airline?.includes(term)
    );
  }, [data, search]);

  async function handleFetch() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    if (airport !== "ALL") params.set("airport", airport);
    if (airlineIata.trim()) params.set("airline_iata", airlineIata.trim());
    if (status) params.set("status", status);

    try {
      const response = await fetch(
        `/api/test/historical-flights?${params.toString()}`
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || "Failed to fetch flights");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-600">Developer test tool</p>
            <h1 className="text-2xl font-bold text-slate-900">
              UAE Historical Flights
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Fetches Aviation Edge <code className="text-xs">flightsHistory</code>{" "}
              for all UAE airports (max 30-day range).
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Back to checker
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                UAE Airport
              </label>
              <select
                value={airport}
                onChange={(e) => setAirport(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">All ({UAE_AIRPORT_CODES.join(", ")})</option>
                {UAE_AIRPORT_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Airline IATA (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. EY"
                value={airlineIata}
                onChange={(e) => setAirlineIata(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Status (optional)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="landed">Landed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFetch}
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Fetching…" : "Fetch flights"}
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Makes 2 API calls per airport (arrivals + departures). All 6 UAE
            airports = 12 calls. Large ranges can take 30–60 seconds and use
            many API credits.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <StatCard label="Unique flights" value={data.totalUnique} />
              <StatCard label="Cancelled" value={data.cancelledCount} />
              <StatCard label="Delayed ≥120m" value={data.delayedCount} />
              <StatCard
                label="API queries"
                value={data.queries.length}
                hint={`${data.dateFrom} → ${data.dateTo}`}
              />
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">
                Query breakdown
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.queries.map((query) => (
                  <span
                    key={`${query.airport}-${query.type}`}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      query.error
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {query.airport} {query.type}: {query.count}
                    {query.error ? ` (${query.error})` : ""}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Filter by flight, route, or airline…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Showing {filteredFlights.length} of {data.flights.length} flights
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Flight</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Dep delay</th>
                    <th className="px-4 py-3">Arr delay</th>
                    <th className="px-4 py-3">UAE query</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlights.map((flight) => (
                    <tr
                      key={`${flight.flightIata}-${flight.depScheduled}-${flight.uaeAirport}-${flight.queryType}`}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {flight.flightIata}
                        {flight.airline && (
                          <span className="ml-1 text-xs text-slate-500">
                            ({flight.airline})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {flight.flightDate ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {flight.departure ?? "?"} → {flight.arrival ?? "?"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={flight.status} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {flight.depDelay ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {flight.arrDelay ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {flight.uaeAirport} ({flight.queryType})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredFlights.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">
                  No flights match your filters.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isCancelled = status === "cancelled";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        isCancelled
          ? "bg-red-100 text-red-700"
          : "bg-green-100 text-green-700"
      }`}
    >
      {status}
    </span>
  );
}
