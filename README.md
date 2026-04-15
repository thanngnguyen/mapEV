This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Traffic-Aware Routing Setup

This project supports API routing providers:

- `mapbox` for traffic-aware ETA (recommended)
- `osrm` as fallback

### 1. Create local env file

Copy `.env.example` to `.env.local` and set your token:

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local`.

### 2. Provider selection

- `NEXT_PUBLIC_ROUTING_PROVIDER=mapbox` forces Mapbox Directions (profile `driving-traffic`).
- `NEXT_PUBLIC_ROUTING_PROVIDER=osrm` forces OSRM.
- If `NEXT_PUBLIC_ROUTING_PROVIDER` is not set, app auto-selects Mapbox when token exists, otherwise OSRM.

When Mapbox is selected but unavailable (invalid token/network issue), the app automatically falls back to OSRM.

## Real Charging Stations API Setup

This project can fetch real charging stations using the server route `GET /api/charging-stations`.

### 1. Configure provider

In `.env.local`:

- `NEXT_PUBLIC_STATION_DATA_PROVIDER=openchargemap` to fetch real stations.
- `NEXT_PUBLIC_STATION_DATA_PROVIDER=mock` to force local generated stations.

### 2. Optional API key

Set `OPENCHARGEMAP_API_KEY` in `.env.local` for OpenChargeMap data.

Optional coverage boost:

- `SERPAPI_API_KEY` to enable SerpApi enrichment.
- When `SERPAPI_API_KEY` exists, the API uses hybrid aggregation (OpenChargeMap + SerpApi), filters noisy results, and de-duplicates nearby duplicates.

Optional SerpApi tuning:

- `SERPAPI_CHARGING_QUERY` (default: `tram sac xe dien`)
- `SERPAPI_LANGUAGE` (default: `vi`)
- `SERPAPI_COUNTRY` (default: `vn`)

### 3. Tune search window

- `NEXT_PUBLIC_STATION_SEARCH_RADIUS_KM` (default: `12`)
- `NEXT_PUBLIC_STATION_MAX_RESULTS` (default: `24`)

Fallback behavior:

- If at least one real provider succeeds, the API returns real data (including `stations: []` when no station is found).
- The app falls back to local generated stations only when no external provider is available.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
