# UAE Flight Compensation App

A Next.js application for checking flight compensation eligibility under UAE GCAA regulations.

## Features

- Flight eligibility checker with Aviation Edge flight data integration
- UAE GCAA duty of care entitlement calculations based on delay duration
- Financial compensation guidance for out-of-pocket expenses
- Clean, modern UI with blue and slate aviation-themed design

## Getting Started

### Prerequisites

- Node.js 18+
- An [Aviation Edge API key](https://aviation-edge.com/premium-api/)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and add your API key:

```bash
cp .env.example .env.local
```

3. Set `AVIATION_EDGE_API_KEY` in `.env.local`.

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API

### `POST /api/check-eligibility`

**Request body:**

```json
{
  "flightIata": "EK569",
  "flightDate": "2026-06-17",
  "extraordinaryCircumstances": false,
  "expenses": 500,
  "isCancelled": false,
  "arrDelayMinutes": 150
}
```

**Response:**

```json
{
  "eligible": true,
  "message": "Arrival delay of 150 minutes qualifies for Duty of Care entitlements.",
  "delayDuration": 150,
  "dutyOfCare": "Meals and Refreshments.",
  "financialNote": "You may be entitled to claim reimbursement for provable out-of-pocket financial losses."
}
```

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Aviation Edge Historical Schedules API
