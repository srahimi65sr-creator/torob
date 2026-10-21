# Torob Insurance

**Torob for third-party car insurance.** Type your car the way you'd tell a friend
("پراید ۹۸ با ۲۰ درصد تخفیف"), and see the final price of every insurer, from every seller,
side by side, cheapest first.

Built as the application project for the **AI Product Engineer** role at [Torob](https://jobs.torob.com).

## The problem

Insurance comparison sites already exist, but each one shows prices under its own assumptions
(cash or installments, with or without the no-claim discount), so the numbers don't compare.
Torob already solves this for products: one product, many stores, one list sorted by price.
This project applies the same model to third-party insurance. Each **insurer** is a product,
each **seller** (Azki, BimeBazar, …) is a store, and Torob sends the user to the seller to buy.
Torob acts as a sales channel for the sellers, not a competitor.

## What it does (v1)

| Story | What the user gets |
| --- | --- |
| US1 | Free-text search is turned into fields: vehicle type, model, build year, discount |
| US2 | Only the missing fields are asked; what was already understood is kept |
| US3 | Build year (1370 to this year) and discount (0 to 70%, steps of 5) are validated and asked again if wrong |
| US4 | One card per insurer, showing its cheapest final price and how many sellers offer it |
| US5 | Two sorts: cheapest cash price, cheapest installment total |
| US6 | A card opens to show every seller's base price, discount, final price and installment plan |
| US7 | "Select" hands the user to the seller (a stand-in page in the demo) and records the click |
| US8 | Unknown vehicles get Torob's own "not found" page |

The full list of 21 test cases, each mapped to a story, is in [`tests/stories.test.ts`](tests/stories.test.ts).

## Where AI is used, and where it deliberately isn't

| Part | AI? | Why |
| --- | --- | --- |
| Understanding the user's free text | Yes (next step) | Open-ended, messy input |
| Matching vehicle and insurer names across sellers | Only for unclear cases | Most of it is a lookup table |
| Calculating and sorting prices | **No** | Must be exact and auditable |

The free-text parser is rule-based today ([`src/ai/parse-query.ts`](src/ai/parse-query.ts)): fast,
free and fully tested for the sample vehicles. An LLM fallback for sentences the rules don't
understand is the next step. Every search is already logged with what the parser understood, so
the LLM can be measured against real input before it ships.

## Architecture

Dependencies only point down; `domain` depends on nothing.

```
               web (Next.js pages)
                       |
      services: search · quote-service · selection
        /          |            |            \
   sources     normalize       ai            db
 (adapters)  (names, prices) (parser)  (Drizzle + Postgres)
        \          |            |            /
              domain: types, final price, comparison
```

```
src/
├─ domain/      Pure types and rules: request, offer, payment plan, comparison
├─ catalog/     Vehicles that have data, with each seller's id for them
├─ sources/     SourceAdapter interface + a sample adapter; a real API adapter plugs in here
├─ normalize/   Persian text, insurer names, raw quote → offer
├─ ai/          Free-text → fields
├─ services/    Search flow, multi-seller quotes with cache, seller hand-off
├─ db/          Schema, migrations, seed, Postgres-backed cache and history
├─ app/         Next.js routes: /, /search, /go/[seller]
└─ ui/          Components in Torob's visual language
```

**Sellers.** Each seller implements one interface, `SourceAdapter` (`listVehicles`, `fetchQuotes`).
v1 uses sample data. The production version gets prices from each seller's API under contract,
which means adding one adapter. Nothing else changes.

**Database.** Ten Postgres tables ([`src/db/schema.ts`](src/db/schema.ts)): sellers, insurers,
vehicles, each seller's names for them, quote requests, raw seller responses, offers, payment
plans and search logs. A seller's answer is cached for 24 hours per request, and the raw payload
is kept so mappers can be re-run without asking again. Locally it runs on
[PGlite](https://pglite.dev) (Postgres compiled to WASM, inside the app process), so no database
server is needed. Moving to a hosted Postgres only changes [`src/db/client.ts`](src/db/client.ts).

**Design.** Colors, type scale and layout follow torob.com's search page. The results page uses
Torob's product-page seller list, not its product grid.

## Sample data

Prices are **not real**. The two vehicles (Pride 131, Peugeot 206 Type 2) use the official 1405
base rates. Each seller's insurers have a made-up extra discount and installment terms:

> final price = base rate × (1 − user's no-claim discount − insurer's extra discount), rounded to 1,000 Toman

See [`src/sources/sample/data`](src/sources/sample/data).

## Run it

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The database is created in `.data/pglite` on first request; migrations and seed run automatically.

## Test it

```bash
pnpm test         # 50 tests: stories, components, database
pnpm typecheck
pnpm lint
```

Every story was also run by hand in a real browser. That pass found three bugs the automated
tests had missed (empty fields sent as `"undefined"`, years shown with a thousands separator, and
a missing data folder that broke the first request). Each now has a test.

## Next

1. LLM fallback for free text, measured on the logged searches
2. Seller APIs under contract, replacing the sample adapter
3. Claim-experience signals (insurers' solvency ratings, user reviews) as a second sort
4. Body insurance and more sellers
