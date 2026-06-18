"use client";

import { useState, FormEvent } from "react";
import type { EligibilityResult } from "@/types/eligibility";

export default function FlightCompensationForm() {
  const [flightNumber, setFlightNumber] = useState("");
  const [extraordinaryCircumstances, setExtraordinaryCircumstances] =
    useState(false);
  const [expenses, setExpenses] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/check-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightIata: flightNumber.trim().toUpperCase(),
          extraordinaryCircumstances,
          expenses: parseFloat(expenses) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to check eligibility");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="flightNumber"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Flight Number
            </label>
            <input
              id="flightNumber"
              type="text"
              required
              placeholder="e.g., EK1"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <label
              htmlFor="extraordinaryCircumstances"
              className="text-sm font-medium text-slate-700"
            >
              Did the airline claim weather or ATC issues?
            </label>
            <button
              id="extraordinaryCircumstances"
              type="button"
              role="switch"
              aria-checked={extraordinaryCircumstances}
              onClick={() =>
                setExtraordinaryCircumstances(!extraordinaryCircumstances)
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 ${
                extraordinaryCircumstances ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  extraordinaryCircumstances ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div>
            <label
              htmlFor="expenses"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Out of Pocket Expenses (AED)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-slate-500">
                AED
              </span>
              <input
                id="expenses"
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount of financial loss incurred"
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-14 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg
                  className="h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Checking Eligibility…
              </>
            ) : (
              "Check Eligibility"
            )}
          </button>
        </form>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`rounded-2xl border p-6 ${
            result.eligible
              ? "border-green-200 bg-green-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            {result.eligible ? (
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
            <h2
              className={`text-lg font-semibold ${
                result.eligible ? "text-green-800" : "text-amber-800"
              }`}
            >
              {result.eligible ? "Eligible" : "Not Eligible"}
            </h2>
          </div>

          <p
            className={`text-sm leading-relaxed ${
              result.eligible ? "text-green-700" : "text-amber-700"
            }`}
          >
            {result.message}
          </p>

          {result.delayDuration !== null && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Delay Duration
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {result.delayDuration} minutes
              </p>
            </div>
          )}

          {result.dutyOfCare && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Duty of Care Entitlements
              </h3>
              <p className="mt-1 text-sm text-slate-600">{result.dutyOfCare}</p>
            </div>
          )}

          {result.financialNote && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Financial Compensation
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {result.financialNote}
              </p>
            </div>
          )}
        </div>
      )}

      {!result && !error && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
          <svg
            className="mx-auto h-10 w-10 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-3 text-sm text-slate-500">
            Submit your flight details to see eligibility status, duty of care
            entitlements, and financial compensation notes.
          </p>
        </div>
      )}
    </div>
  );
}
