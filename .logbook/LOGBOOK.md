# LOGBOOK.md — seumignon-frontend

Chronological record of UI/UX design decisions, epic execution milestones, and Cloudflare Pages cutover steps.

---

## 1. Epic Roadmap

| Epic | Name | Status | Primary Focus |
| :---: | :--- | :---: | :--- |
| **E0** | **UI/UX Discovery & Design Tokens** | **IN_PROGRESS** | Analyze `visual_references/` (BBQ King logo, rubber-hose / Cuphead / CMV / Zelda mascot style, Foodpanda & Sweetgreen layouts), run `/grill-me` guided design interview, lock color palette, typography, mascot usage, and Design Tokens |
| **E1** | **Project Bootstrap & API Client** | **PENDING** | Initialize React + TypeScript + Vite + Tailwind CSS + Vitest (`low_gear`/`high_gear`) + ESLint/Prettier + `.env.example` + CI/Dependabot; implement pure `src/domain/` (centavos & `choice_groups` validation) and `src/services/api.ts` verified against `GET /health` & `GET /menu` |
| **E2** | **Catalog & Dish Customization Modal** | **PENDING** | Mobile-first menu header, sticky category tabs, dish cards, and Sweetgreen/Foodpanda-inspired meal customization modal enforcing `choice_groups` (`included_sides` 3/3 with repeat counters + `extra_sides` 0..10) and live centavos line totals |
| **E3** | **Cart Drawer, Neighborhood Delivery Fee & Checkout** | **PENDING** | Persistent cart drawer/sidebar (`localStorage`), searchable `delivery_zones` selector (`R$ 5,00` / `R$ 8,00` / `R$ 9,00` tiers), customer & address form validation, `POST /orders` submission, and Pagar.me `checkout_url` handoff |
| **E4** | **Order Status Page & Cloudflare Pages Deploy** | **PENDING** | `/orders/:orderId` live polling view (`PENDING` -> `PAID` -> `DISPATCHED` \| `CANCELLED`), Cloudflare Pages staging deploy (`seumignon-frontend.pages.dev`), mobile smoke test, and production DNS cutover |

---

## 2. Pre-Frontend Foundation: DNS & Hosting Setup (Completed)

- [x] Created Cloudflare account.
- [x] Audited legacy KingHost services (checked active email/MX records).
- [x] Migrated domain DNS to Cloudflare pointing to the legacy site (zero downtime).

---

## 3. Detailed Milestone Checklists

### Epic E0: UI/UX Discovery & Design Tokens (In Progress)

- [x] Aligned frontend governance rules (`.agents/rules/AGENT.md`), ecosystem/API contracts (`PROJECT_CONTEXT.md`), operational runbook (`RUNBOOK.md`), `README.md`, and `.logbook/` (`LOGBOOK.md` + `progress.jsonl`) inspired by `seumignon-backend`.
- [x] Inventoried visual references under `visual_references/` (`logo/{bbq-king.png,thebear.png}`, `mascot/{cmv*,cuphead*,pauls.png,zelda*}`, `webpage/pandafood/*`, `webpage/sweetgreen/*`).
- [ ] Conduct guided `/grill-me` UI/UX & Design System interview (palette, brand personality, typography, dish photography treatment, mascot placement, mobile vs. desktop layout).
- [ ] Document finalized Design Tokens (`COLORS`, `TYPOGRAPHY`, spacing/radius, mascot role) before writing Epic `E1` production code.

### Epic E1: Project Bootstrap & API Client (Pending)

- [ ] Initialize React + Vite + TypeScript + Tailwind CSS project with `.gitignore`, `.env.example`, ESLint, Prettier, and Vitest (`low_gear` / `high_gear`).
- [ ] Configure GitHub Actions CI workflow and Dependabot (`.github/dependabot.yml`).
- [ ] Implement `src/domain/` pure TypeScript modules (API DTO types, integer centavos helpers, BRL formatter, `choice_groups` validator, line-total formula) with `low_gear` unit tests.
- [ ] Implement `src/services/api.ts` typed HTTP client (`VITE_API_BASE_URL`, `{ error, detail }` normalization) with `high_gear` mocked contract tests.

### Epic E2: Catalog & Dish Customization Modal (Pending)

- [ ] Build menu navigation, brand hero/banner, and responsive dish cards (`pt-BR` copy, BRL formatting).
- [ ] Build meal assembly modal/drawer enforcing `min_choices <= sum <= max_choices`, repeated side selection (`2x` + `1x` = `3`), and live line total calculation.

### Epic E3: Cart Drawer, Neighborhood Delivery Fee & Checkout (Pending)

- [ ] Implement `CartContext` / store with `localStorage` persistence.
- [ ] Build Cart Drawer / sticky desktop cart summary + `delivery_zones` searchable neighborhood selector.
- [ ] Build Checkout form (customer details, delivery address, notes), `POST /orders` submission, `localStorage` recent order persistence, and `checkout_url` redirect/CTA.

### Epic E4: Order Status Page & Cloudflare Pages Deploy (Pending)

- [ ] Build `/orders/:orderId` polling `GET /orders/{order_id}` with clear `PENDING` / `PAID` / `DISPATCHED` / `CANCELLED` feedback and payment link recovery CTA.
- [ ] Deploy staging build to Cloudflare Pages (`https://seumignon-frontend.pages.dev`) with `VITE_API_BASE_URL` pointing to AWS API Gateway.
- [ ] Record legacy KingHost `A` record IP as rollback plan, bind `seumignon.com.br` & `www.seumignon.com.br` in Cloudflare Pages, verify SSL/CORS, and execute live mobile smoke test.

---

## 4. Planned Pre-Commit Quality Gate (From Epic E1 Onward)

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```
