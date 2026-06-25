import Link from "next/link";
import { UAE_AIRPORT_CODES } from "@/lib/aviation-edge";

const SOURCES = [
  {
    title: "GCAA Passenger Welfare Program (CAR-PWP Issue 02)",
    description: "Official UAE civil aviation regulation — duty of care, cancellation, and delay rules.",
    url: "https://www.gcaa.gov.ae/en/epublication/EPublications/Civil%20Aviation%20Regulations%20%28CARs%29/CAR%20III%20-%20GENERAL%20REGULATIONS/CAR-PWP%20-%20PASSENGER%20WELFARE%20PROGRAM%20-%20ISSUE%2002.pdf",
  },
  {
    title: "GCAA — Civil Aviation Regulations",
    description: "General index of GCAA regulations and publications.",
    url: "https://www.gcaa.gov.ae/en/epublication/EPublications/Civil%20Aviation%20Regulations%20%28CARs%29",
  },
  {
    title: "UAE Commercial Transactions Law (Federal Decree-Law No. 50 of 2022)",
    description: "Governs commercial obligations including air carriage liability for damages.",
    url: "https://uaelegislation.gov.ae/en/legislations/1542",
  },
  {
    title: "Montreal Convention 1999 (ICAO)",
    description: "International treaty on airline liability for passenger delay, baggage, and injury.",
    url: "https://www.icao.int/secretariat/legal/List%20of%20Parties/Mtl99_EN.pdf",
  },
  {
    title: "U.S. DOT — Flight delays and cancellations (U.S. departures)",
    description: "Applies when your flight originates at a U.S. airport — separate refund rules.",
    url: "https://www.transportation.gov/airconsumer/flight-delays-and-cancellations",
  },
];

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-600">Reference guide</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Passenger Rights &amp; Rules
            </h1>
            <p className="mt-2 text-slate-600">
              A plain-language summary of UAE GCAA welfare rules and how this
              app applies them. Not legal advice.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Back to checker
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Official sources</h2>
          <p className="mt-1 text-sm text-slate-600">
            Always refer to the primary documents below for the full legal text.
          </p>
          <ul className="mt-4 space-y-3">
            {SOURCES.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="font-medium text-blue-700">{source.title}</span>
                  <p className="mt-0.5 text-sm text-slate-600">{source.description}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{source.url}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <RuleSection title="When do UAE GCAA rules apply?">
          <p>
            The GCAA <strong>Passenger Welfare Program</strong> applies when your
            flight is disrupted at a <strong>UAE airport</strong> — departing from,
            arriving at, diverting to, or transiting through:
          </p>
          <p className="mt-3 font-mono text-sm text-slate-700">
            {UAE_AIRPORT_CODES.join(" · ")}
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
            <li>You must have a <strong>confirmed reservation</strong> and check in on time.</li>
            <li>Rules cover <strong>delays, cancellations, denied boarding, and diversions</strong>.</li>
            <li>Disruptions that happen entirely outside the UAE may fall under another country&apos;s rules.</li>
          </ul>
        </RuleSection>

        <RuleSection title="Three different things — don&apos;t confuse them">
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard
              title="Ticket refund"
              color="red"
              text="Getting your fare back or rebooked for free. Mainly applies when the airline cancels — not for every delay."
            />
            <InfoCard
              title="Duty of care"
              color="blue"
              text="Meals, refreshments, hotel, transport, and communication the airline must provide during a disruption."
            />
            <InfoCard
              title="Expense reimbursement"
              color="green"
              text="Claiming back money you spent (e.g. meals at the airport) with receipts. Not the same as a ticket refund."
            />
          </div>
        </RuleSection>

        <RuleSection title="Cancellation">
          <p>
            If the <strong>airline cancels</strong> your flight (within 48 hours of
            scheduled departure), GCAA rules require:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            <li>Early information about the cancellation</li>
            <li>
              <strong>Care</strong> — meals, refreshments, hotel, airport–hotel
              transport, and communication as appropriate
            </li>
            <li>
              <strong>Rebooking</strong> on the next available flight (ticket
              validity extended if needed)
            </li>
            <li>
              <strong>Alternative routing</strong> — return to your first
              departure point or re-route within a reasonable time, including on
              another airline if available
            </li>
          </ul>
          <Callout variant="info">
            A <strong>full cash refund</strong> is typically available under the
            airline&apos;s conditions of carriage and UAE consumer law for
            involuntary cancellations — even when caused by weather or airspace
            closures. Welfare and rebooking obligations still apply.
          </Callout>
          <p className="mt-3 text-sm text-slate-600">
            <strong>This app:</strong> marks <em>Ticket refund: Yes</em> only for
            cancelled flights.
          </p>
        </RuleSection>

        <RuleSection title="Delays — official GCAA thresholds">
          <p>
            Under <strong>CAR-PWP Issue 02</strong>, delay welfare is measured from
            the <strong>scheduled departure time</strong> while you are at the
            airport (terminal delay):
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Departure delay</th>
                  <th className="px-4 py-3">Airline must provide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-800">1–3 hours</td>
                  <td className="px-4 py-3 text-slate-600">Up-to-date flight information</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-800">3–8 hours</td>
                  <td className="px-4 py-3 text-slate-600">
                    Information, meals &amp; refreshments, communication; hotel if
                    you missed a connection and the next flight is 8+ hours away
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-800">More than 8 hours</td>
                  <td className="px-4 py-3 text-slate-600">
                    Hotel, meals, communication, and airport–hotel transport
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="warning">
            A <strong>delay does not automatically entitle you to a ticket refund</strong> if
            you completed your journey. Welfare (duty of care) is separate from
            getting your fare back.
          </Callout>
        </RuleSection>

        <RuleSection title="How this app estimates delay welfare">
          <p>
            For simplicity, the checker uses <strong>arrival delay</strong> (not
            official departure-delay timing) with these thresholds:
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Arrival delay</th>
                  <th className="px-4 py-3">App shows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="px-4 py-3 font-medium">≥ 2 hours (120 min)</td>
                  <td className="px-4 py-3 text-slate-600">Meals and refreshments</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">≥ 3 hours (180 min)</td>
                  <td className="px-4 py-3 text-slate-600">+ Access to communication</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">≥ 6 hours (360 min)</td>
                  <td className="px-4 py-3 text-slate-600">
                    + Hotel accommodation and airport transfers
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Official GCAA timing is based on <em>departure</em> delay at the
            airport. If your result matters legally, compare against the official
            table above.
          </p>
        </RuleSection>

        <RuleSection title="U.S. departures (e.g. ORD, JFK, LAX)">
          <p>
            If your flight <strong>originates in the United States</strong>, U.S.
            Department of Transportation rules may also apply — separately from
            UAE GCAA welfare:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            <li>
              For international flights, an automatic <strong>cash refund</strong> for
              a delay typically requires a delay of <strong>6+ hours</strong> and
              that you <strong>choose not to travel</strong>.
            </li>
            <li>
              If you flew despite the delay, you generally cannot claim a statutory
              ticket refund — but duty of care and expense reimbursement may still
              apply.
            </li>
            <li>
              <strong>Downgrades</strong> (e.g. Business → Economy) may entitle you
              to a partial refund of the fare difference.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            <strong>This app</strong> shows a U.S. DOT advisory when the departure
            airport is a major U.S. hub.
          </p>
        </RuleSection>

        <RuleSection title="Extraordinary circumstances">
          <p>
            When an airline cites <strong>weather, ATC, or airspace closures</strong>:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            <li>
              <strong>Duty of care still applies</strong> if delay thresholds are met
            </li>
            <li>
              Fixed <strong>financial compensation</strong> for inconvenience may not
              be owed
            </li>
            <li>
              <strong>Cancellation welfare and rebooking/refund options</strong> still
              apply for airline cancellations
            </li>
          </ul>
        </RuleSection>

        <RuleSection title="Out-of-pocket expenses">
          <p>
            Beyond welfare, you may claim <strong>provable financial losses</strong> under
            UAE commercial law and the Montreal Convention — for example meals you
            paid for when the airline failed to provide vouchers.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            <li>Keep receipts, boarding passes, and booking confirmations</li>
            <li>Submit a written complaint to the airline first</li>
            <li>Montreal Convention claims generally must be filed within <strong>2 years</strong></li>
          </ul>
        </RuleSection>

        <RuleSection title="How to escalate a complaint">
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-slate-700">
            <li>
              <strong>Contact the airline</strong> in writing with your flight
              number, date, and what you are claiming.
            </li>
            <li>
              If unresolved, escalate to the{" "}
              <strong>GCAA Consumer Protection Unit</strong> via{" "}
              <a
                href="https://www.gcaa.gov.ae"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                gcaa.gov.ae
              </a>
              .
            </li>
            <li>
              For significant financial damages, consider legal advice under UAE
              Commercial Transactions Law and the Montreal Convention.
            </li>
          </ol>
        </RuleSection>

        <RuleSection title="Quick examples">
          <Example
            flight="EY654 · KWI → AUH · Cancelled"
            outcome="Ticket refund or rebooking + duty of care (hotel if overnight)."
          />
          <Example
            flight="EY12 · ORD → AUH · 259 min arrival delay"
            outcome="Duty of care (meals, communication). No ticket refund if you flew. U.S. DOT 6-hour refund rule not met."
          />
          <Example
            flight="EK569 · BLR → DXB · 150 min arrival delay"
            outcome="Duty of care (meals & refreshments). No automatic ticket refund."
          />
        </RuleSection>

        <p className="mt-8 text-center text-xs text-slate-500">
          This page is a summary for educational use. Regulations change — verify
          with the official sources listed above.
        </p>
      </div>
    </main>
  );
}

function RuleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function InfoCard({
  title,
  text,
  color,
}: {
  title: string;
  text: string;
  color: "red" | "blue" | "green";
}) {
  const styles = {
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[color]}`}>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function Callout({
  variant,
  children,
}: {
  variant: "info" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${styles[variant]}`}>
      {children}
    </div>
  );
}

function Example({ flight, outcome }: { flight: string; outcome: string }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="font-medium text-slate-800">{flight}</p>
      <p className="mt-1 text-sm text-slate-600">{outcome}</p>
    </div>
  );
}
