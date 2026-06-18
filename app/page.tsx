import FlightCompensationForm from "@/components/FlightCompensationForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            UAE GCAA Regulations
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Flight Compensation Checker
          </h1>
          <p className="mt-2 text-slate-600">
            Determine your eligibility for duty of care and financial
            compensation under UAE aviation regulations.
          </p>
        </header>

        <FlightCompensationForm />
      </div>
    </main>
  );
}
