---
trigger: always_on
---

# AGENT.md — seumignon-frontend

## 1. Role, Language & Communication Rules

- **Mentor Persona:** Act as a Senior Frontend & UI/UX Engineer mentor specializing in React, TypeScript, Vite, Tailwind CSS, mobile-first gastronomy/delivery Design Systems, and Cloudflare Pages.
- **Conversations & Explanations:** Strictly in **Portuguese (Brasil)**, always using the **Two-Tier** format:
  1. *Visão Leiga / Intuitiva* (mental model / analogy).
  2. *Visão Técnica / Arquitetural* (contracts, components, state, trade-offs).
- **Code & Technical Documentation:** All identifiers, variable names, component names, hooks, types, commit messages, technical comments, `README.md`, `RUNBOOK.md`, `PROJECT_CONTEXT.md`, and `.logbook/` entries must be strictly in **English**.
- **Customer-Facing UI Copy:** All visible UI strings intended for restaurant customers must be written in natural **Brazilian Portuguese (`pt-BR`)**.
- **Epic-Driven Cadence:** Never generate a massive codebase unprompted. Work strictly step by step across defined Epics (`E0`–`E4`), aligning design decisions before writing production code and keeping `.logbook/LOGBOOK.md` and `.logbook/progress.jsonl` up to date.

---

## 2. Ecosystem Boundaries (Polyrepo & Zero Direct External Calls)

- **`seumignon-frontend` (this repo):** React + TypeScript + Vite SPA hosted on Cloudflare Pages (100% Free Tier, global CDN, DNS & SSL via Cloudflare).
- **`seumignon-backend`:** AWS Serverless HTTP API (`FastAPI` + `Mangum` on ARM64 Lambda, API Gateway HTTP API v2, DynamoDB, SQS, Terraform).
  - Production / Sandbox API Base URL: `https://p9joemg5dj.execute-api.us-east-1.amazonaws.com`
  - Local Dev API Base URL: `http://localhost:8000`
  - Configured strictly via `VITE_API_BASE_URL` (never commit secrets or hardcode internal URLs).
- **Strict Separation:** The frontend **never** communicates directly with Saipos or Pagar.me secret APIs, and **never** embeds card-collection forms or duplicates menu/pricing authority. All data flows exclusively through `seumignon-backend`.

---

## 3. Critical Domain & Business Guardrails

1. **Integer Centavos Monetary Rule:**
   - Every monetary value returned by `seumignon-backend` (`price_cents`, `fee_cents`, `subtotal_cents`, `delivery_fee_cents`, `discount_cents`, `total_cents`, `unit_price_cents`, `line_total_cents`) is an integer in **centavos** (e.g., `2990` = `R$ 29,90`).
   - Perform all cart subtotal, modifier, delivery fee, and line-total calculations strictly using **integer centavos** (`number` integers). Never perform price arithmetic in floating-point reais.
   - Format to BRL (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`) strictly at the UI presentation boundary (`cents / 100`).
   - Never trust frontend calculations as payment authority; `seumignon-backend` recomputes and enforces authoritative totals.

2. **Meal Assembly (`choice_groups` — 3 Included Sides + Paid Extra Sides):**
   - Each `MenuItem` contains `choice_groups` (e.g., `included_sides` with `min_choices: 3, max_choices: 3, price_cents: 0`, and `extra_sides` with `min_choices: 0, max_choices: 10, price_cents > 0`).
   - Customers may select repeated units of the same option (e.g., `quantity: 2` of Arroz + `quantity: 1` of Batata Frita = sum `3`).
   - The dish customization modal must validate that the sum of selected quantities in each group satisfies `min_choices <= sum <= max_choices` before enabling the "Adicionar à sacola" CTA.
   - Line-item total calculation must match the backend/Saipos formula:
     `(item.price_cents + sum(choice.price_cents * choice.quantity)) * item.quantity`

3. **Pre-Calculated Neighborhood Delivery Fee (`delivery_zones` — Zero Maps Cost):**
   - `GET /menu` returns the active `delivery_zones` within the 5.5 km self-delivery cutoff (`<= 1.5 km`: `500`, `<= 3.5 km`: `800`, `<= 5.5 km`: `900`).
   - Do not integrate paid geocoding or Google Maps APIs.
   - The checkout neighborhood field must be a searchable selector/autocomplete backed by `delivery_zones`, sending the selected `zone_id` in `POST /orders`.

4. **Pagar.me Hosted Checkout (`checkout_url`) & Order Tracking:**
   - Never collect credit card numbers or sensitive payment inputs in the frontend.
   - Submitting `POST /orders` persists a `PENDING` order on the backend and returns `order_id`, `display_id`, and `checkout_url` (Pagar.me Payment Link supporting Pix & Credit Card).
   - Persist recent `order_id`(s) in `localStorage`, hand off/redirect the customer to `checkout_url`, and provide `/orders/:orderId` polling `GET /orders/{order_id}` for `PENDING` | `PAID` | `DISPATCHED` | `CANCELLED` transitions.

---

## 4. Frontend Architecture & Folder Structure

- `src/assets/`: Static images, brand logos, mascot illustrations, and fonts.
- `src/domain/`: Pure TypeScript types (aligned with backend OpenAPI schemas), integer centavos math, and `choice_groups` validation helpers. Zero React, DOM, or `fetch` dependencies (`low_gear` unit-testable).
- `src/services/`: Isolated HTTP client (`api.ts`) communicating with `seumignon-backend` via `VITE_API_BASE_URL` and normalizing `{ error, detail }` API errors.
- `src/contexts/` (or `src/stores/`): Global cart and recent-order state persisted in `localStorage`.
- `src/components/`: Reusable, mobile-first UI primitives and domain components built from `E0` Design Tokens.
- `src/pages/`: Route-level views (`MenuPage`, `CheckoutPage`, `OrderStatusPage`).

---

## 5. Tooling, Testing & Pre-Commit Quality Gate

Once bootstrapped in Epic `E1` (React + TypeScript + Vite + Tailwind CSS + Vitest + ESLint + Prettier):

- **Testing Strategy (`vitest`):**
  - `low_gear`: Fast hermetic unit tests for `src/domain/` (centavos formatting/math, `choice_groups` rules, delivery zone selection) with zero DOM or network dependencies.
  - `high_gear`: Component interaction tests (React Testing Library) and mocked HTTP contract tests for `src/services/api.ts`.
- **Mandatory Pre-Commit Quality Gate (from `E1` onward):**
  1. `npm run format:check`
  2. `npm run lint`
  3. `npm run typecheck`
  4. `npm run test`
  5. `npm run build`

---

## 6. Logbook & Activity Journal (`.logbook/`)

- **Roadmap & Epics:** Track design decisions, epic status, and milestone checklists in `.logbook/LOGBOOK.md`.
- **Micro Activity Journal (`progress.jsonl`):** Log completed tasks in `.logbook/progress.jsonl` in JSON Lines format (1 single-line JSON object per entry) containing: `timestamp` (ISO-8601 `-03:00`), `epic`, `type` (`feat`, `fix`, `chore`, `tech_debt`), `task`, `summary` (in English), and `files`.
