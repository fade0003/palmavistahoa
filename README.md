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

Field notes are separate from the weekly Sentry file. They are stored in D1 binding `FIELD_DB` (database `palmavista-field`) and private R2 binding `FIELD_PHOTOS` (bucket `palmavista-field-photos`, no public URL). Tables are created with `CREATE TABLE IF NOT EXISTS` on the first `/violations/field` request (`migrations/0001_field.sql` is the same SQL).

| Piece | Value |
| --- | --- |
| Entries | `GET`/`POST /violations/field/entries`, `PATCH`/`DELETE /violations/field/entries/:id` |
| Photos | `GET /violations/field/photos/:id`, R2 key `field/<homeId>/<entryId>/<n>.jpg` |
| Author | `email` claim on the verified Access JWT |

A disposition is keyed by the home id plus a hash of the violation date, code, and description, so it still matches after `violations.json` is replaced. Observations that no longer match a current row stay in the history. The client downscales photos to 1600px JPEG before upload. If a save fails because the phone is offline, it stays in IndexedDB and retries. Missing `FIELD_DB` or `FIELD_PHOTOS` returns an error JSON body instead of throwing.

**Do not commit field notes, photos, or exports.** They are board records.

Local preview of the static map only (no field storage):

```bash
npm run build
npm run preview:violations
```

Local preview with the fake fixture, D1, and R2 (Access check is skipped only on localhost when `ACCESS_DEV_BYPASS=1`):

```bash
npm run build
npx wrangler pages dev out --kv VIOLATIONS_KV --d1 FIELD_DB --r2 FIELD_PHOTOS \
  --binding ACCESS_DEV_BYPASS=1 --binding ACCESS_DEV_EMAIL=board@example.test \
  --compatibility-date 2026-06-29 --ip 127.0.0.1 --port 8788
```

If local KV has no `violations.json`, copy the fake fixture where the localhost bypass can read it (this file is not part of `npm run build`):

```bash
mkdir -p out/dev-fixtures
cp fixtures/violations.sample.json out/dev-fixtures/violations.sample.json
```

On localhost, `?demoGeo=lat,lon&follow=1` simulates a GPS fix and `?home=<id>` opens that home. Those query parameters are ignored on any other host. `ACCESS_DEV_BYPASS` must not be set on the Pages project.

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
