# Palma Vista HOA

Static Next.js site (`output: "export"`, directory `out`) for the Palma Vista homeowners association, deployed on Cloudflare Pages at the domain root. Pages Functions live in `functions/`. Do not set `basePath`. Cloudflare Access protects only `/admin`, `/api/admin`, and `/violations`.

## Violations map

`/violations` is a board-only map for a drive through the neighborhood. Access covers the page and the data URL.

| Piece | Value |
| --- | --- |
| Page | `/violations` (static file from the Next.js export) |
| Data | `GET /violations/data`, Pages Function `functions/violations/data.ts` |
| KV binding | `VIOLATIONS_KV` |
| KV key | `violations.json` |

The data route stays under `/violations` so it is not a public `/api` endpoint. The function checks the `Cf-Access-Jwt-Assertion` header and responds with `Cache-Control: private, no-store`. `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` override the built-in team domain and application AUD tag. A missing KV binding or key returns an error JSON body instead of throwing.

**Do not commit real violation, arrears, address, or resident data.** `fixtures/violations.sample.json` is a fake local dataset only.

`status` is `red` for an open violation that is 90 days or older, `orange` for an open violation under 90 days, and `gray` when there is none. `arrears` is `null` when there is no balance, and `collection` is a string such as `"Lien (LN)"` or `null`.

```json
{
  "updated": "YYYY-MM-DD",
  "sources": { "violations": "string", "arrears": "string" },
  "summary": {
    "openItems": 0,
    "homesWithOpen": 0,
    "aging": { "0-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0 },
    "arrearsTotal": 0,
    "pastDue": 0,
    "inCollection": 0
  },
  "homes": [{
    "id": "12 hex characters",
    "address": "string",
    "lat": 0,
    "lon": 0,
    "status": "red",
    "violations": [{ "date": "YYYY-MM-DD", "code": "string", "description": "string", "ageDays": 0, "status": "O-F1P" }],
    "architectural": [],
    "arrears": { "total": 0, "pastDue": 0, "collection": null }
  }]
}
```

Local preview (localhost only; no Access check, fake fixture):

```bash
npm run build
npm run preview:violations
```

On localhost, `?demoGeo=lat,lon&follow=1` simulates a GPS fix and `?home=<id>` opens that home. Those query parameters are ignored on any other host.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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
