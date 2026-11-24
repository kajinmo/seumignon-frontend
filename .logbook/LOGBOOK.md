# LOGBOOK.md — seumignon-frontend

Chronological record of UI/UX design decisions, epic execution milestones, and Cloudflare Pages cutover steps.

---

## 1. Epic Roadmap

| Epic | Name | Status | Primary Focus |
| :---: | :--- | :---: | :--- |
| **E0** | **UI/UX Discovery & Design Tokens** | **COMPLETED** | Analyze `visual_references/` (BBQ King logo, rubber-hose / Cuphead / CMV / Zelda mascot style, Foodpanda & Sweetgreen layouts), run `/grill-me` guided design interview, lock dual-theme A/B Design Tokens (`#10388B` vs. `#CB2031`), typography, photography guide, mascot usage, and UX rules |
| **E1** | **Project Bootstrap & API Client** | **COMPLETED** | Initialize React + TypeScript + Vite + Tailwind CSS + Vitest (`low_gear`/`high_gear`) + ESLint/Prettier + `.env.example` + CI/Dependabot; implement pure `src/domain/` (centavos & `choice_groups` validation) and `src/services/api.ts` verified against `GET /health` & `GET /menu` |
| **E2** | **Catalog & Dish Customization Modal** | **COMPLETED** | Mobile-first menu header, smart `WelcomePromoModal`, `BoizinhoMascot` SVG, sticky category tabs, dish cards, and Sweetgreen/Foodpanda-inspired meal customization modal enforcing `choice_groups` (`included_sides` 3/3 in a 3x4 visual photo grid with repeat counters) and live centavos line totals |
| **E3** | **Cart Drawer, Neighborhood Delivery Fee & Checkout** | **COMPLETED** | Persistent cart drawer/sidebar (`localStorage`), searchable `delivery_zones` selector (`R$ 5,00` / `R$ 8,00` / `R$ 9,00` tiers), customer & address form validation, `POST /orders` submission, and Pagar.me `checkout_url` handoff |
| **E4** | **Order Status Page & Cloudflare Pages Deploy** | **COMPLETED** | `/orders/:orderId` live polling view (`PENDING` -> `PAID` -> `DISPATCHED` \| `CANCELLED`), Cloudflare Pages staging deploy config (`public/_redirects`, `seumignon-frontend.pages.dev`), mobile smoke test, and production DNS cutover runbook |
| **E5** | **Smart CEP Delivery Fee & Local UX Polish** | **COMPLETED** | Authoritative CEP lookup (`GET /delivery-fee?cep=...`) replacing manual fee/zone selection, friendly 422 out-of-range handling, best-effort ViaCEP street autofill, "Pedir novamente", and "Limpar meus dados" privacy action |
| **E6** | **Optional Customer Cloud Account (Passwordless)** | **COMPLETED** | Optional 2-step Passwordless Email OTP (`POST /auth/request-code` -> `POST /auth/verify-code`), `AuthContext` (`access_token`), `/me/profile` autofill + persistence, `/me/orders` cloud history, and transparent 401 Guest fallback |
| **E7** | **White-Label Template & Brand Config Extraction** | **PLANNED** | Centralize brand identity (`src/config/brand.ts` / `VITE_*` env vars, logos, copy, default theme) for zero-overengineering isolated cloning (sibling restaurant & freelance projects) |

---

## 2. Pre-Frontend Foundation: DNS & Hosting Setup (Completed)

- [x] Created Cloudflare account.
- [x] Audited legacy KingHost services (checked active email/MX records).
- [x] Migrated domain DNS to Cloudflare pointing to the legacy site (zero downtime).

---

## 3. Detailed Milestone Checklists

### Epic E0: UI/UX Discovery & Design Tokens (Completed)

- [x] Aligned frontend governance rules (`.agents/rules/AGENT.md`), ecosystem/API contracts (`PROJECT_CONTEXT.md`), operational runbook (`RUNBOOK.md`), `README.md`, and `.logbook/` (`LOGBOOK.md` + `progress.jsonl`) inspired by `seumignon-backend`.
- [x] Inventoried visual references under `visual_references/` (`logo/{bbq-king.png,thebear.png}`, `mascot/{cmv*,cuphead*,pauls.png,zelda*}`, `webpage/pandafood/*`, `webpage/sweetgreen/*`).
- [x] Conduct guided `/grill-me` UI/UX & Design System interview (palette, brand personality, typography, dish photography treatment, mascot placement, mobile vs. desktop layout).
- [x] Document finalized Design Tokens (`COLORS`, `TYPOGRAPHY`, spacing/radius, mascot role, dual-theme A/B switcher specification) before writing Epic `E1` production code.
- [x] Lock visual identity to Theme B (`#CB2031` on `#F5EFE2` oat kraft cream) combined with Theme A typography (`Oswald` + `Plus Jakarta Sans`), remove the header theme switcher, and organize catalog navigation into curated category shortcuts (`Os mais pedidos`, `Grelhados`, `Clássicos da Cozinha`, `Acompanhamentos`, `Sobremesa`, `Bebidas`, `Todos`).

### Epic E1: Project Bootstrap & API Client (Completed)

- [x] Initialize React + Vite + TypeScript + Tailwind CSS project with `.gitignore`, `.env.example`, ESLint, Prettier, and Vitest (`low_gear` / `high_gear`).
- [x] Configure GitHub Actions CI workflow (`.github/workflows/ci.yml`) and Dependabot (`.github/dependabot.yml`).
- [x] Implement `src/domain/` pure TypeScript modules (API DTO types, integer centavos helpers, BRL formatter, `choice_groups` validator, line-total formula, neighborhood `delivery_zones` filter) with `low_gear` unit tests (`tests/low_gear/`).
- [x] Implement `src/services/api.ts` typed HTTP client (`VITE_API_BASE_URL`, `{ error, detail }` normalization) and dual-theme A/B app shell (`src/App.tsx`) with `high_gear` mocked contract tests (`tests/high_gear/`).

### Epic E2: Catalog & Dish Customization Modal (Completed)

- [x] Build menu navigation (`CategoryTabs.tsx`), smart `WelcomePromoModal.tsx` (`welcomeConfig.ts`), 1930s rubber-hose `BoizinhoMascot.tsx` SVG, and responsive horizontal dish cards (`DishCard.tsx`, `pt-BR` copy, BRL formatting).
- [x] Build Sweetgreen/Foodpanda-inspired meal assembly modal (`DishCustomizationModal.tsx`) enforcing `min_choices <= sum <= max_choices` (`3/3` included sides in a `3x4` visual photo grid with central repeat counters `2x + 1x = 3`, zero paid extra clutter inside the modal, and live centavos line total calculation).

### Epic E3: Cart Drawer, Neighborhood Delivery Fee & Checkout (Completed)

- [x] Implement `CartContext` / store with `localStorage` persistence (`seumignon:cart:v1`, `seumignon:selected-zone:v1`, `seumignon:checkout-draft:v1`, `seumignon:recent-orders:v1`).
- [x] Build Cart Drawer / sticky desktop cart summary (`CartPanel.tsx`) + `delivery_zones` searchable neighborhood selector (`NeighborhoodSelector.tsx`) with zero Google Maps API cost.
- [x] Build Checkout form (`CheckoutModal.tsx`: customer details, delivery address, notes), `POST /orders` submission, `localStorage` recent order persistence, and Pagar.me `checkout_url` redirect/CTA.

### Epic E4: Order Status Page & Cloudflare Pages Deploy (Completed)

- [x] Build `/orders/:orderId` (`OrderStatusPage.tsx` + `src/domain/orderStatus.ts`) polling `GET /orders/{order_id}` with clear `PENDING` / `PAID` / `DISPATCHED` / `CANCELLED` feedback, Touchpoint #4 of `BoizinhoMascot`, and payment link recovery CTA.
- [x] Configure Cloudflare Pages SPA routing (`public/_redirects` -> `/* /index.html 200`) and deployment checklist (`https://seumignon-frontend.pages.dev`) with `VITE_API_BASE_URL` pointing to AWS API Gateway.
- [x] Document legacy KingHost `A` record IP rollback procedure, custom domain binding (`seumignon.com.br` & `www.seumignon.com.br`), SSL/CORS verification, and live mobile smoke test in `RUNBOOK.md`.

### Epic E5: Smart CEP Delivery Fee & Local UX Polish (Completed)

- [x] Replace manual neighborhood fee selection with authoritative CEP lookup (`GET /delivery-fee?cep=...` + best-effort ViaCEP street autofill) and `POST /orders` `district` + `postal_code` contract.
- [x] Handle out-of-range (`422 DeliveryOutOfRangeError`), not-found (`CepNotFoundError`), and invalid (`InvalidCepError`) CEPs with clear pt-BR feedback.
- [x] Add "Pedir novamente" shortcut from orders and "Limpar meus dados" privacy button for shared devices.

### Epic E6: Optional Customer Cloud Account — Passwordless (Completed)

- [x] Add optional 2-step Passwordless Email OTP (`POST /auth/request-code` -> `POST /auth/verify-code`) without blocking Guest Checkout, keeping OTP challenge `session` strictly in memory.
- [x] Build `AuthContext` & `AccountModal` ("Já tenho conta" vs. upfront "Criar minha conta" registration + Email OTP verification, "Meus Pedidos" via `GET /me/orders`, and "Meu Perfil & Endereço" via `GET/PUT /me/profile`) using `Authorization: Bearer <access_token>` and automatic `401` session cleanup with Guest fallback.

### Epic E7: White-Label Template & Brand Config Extraction (Planned)

- [ ] Extract all restaurant-specific identity (brand name, logo assets, WhatsApp/social links, welcome modal copy, default theme) into `src/config/brand.ts` / `VITE_*` variables for isolated sibling restaurant and freelance deployments.

---

## 4. Planned Pre-Commit Quality Gate (From Epic E1 Onward)

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## 5. Epic E0 Final Specification: Brand Identity, UI/UX Architecture & Dual-Theme Design Tokens

### 5.1. Modular Responsive Brand System (Logo + Stamp + Mascot)

- **Architectural Decision:** Decouple the wordmark from the mascot illustration so the brand scales cleanly from a `56px` mobile sticky navbar to a `35cm` kraft delivery box.
  1. **Primary Wordmark (Compact Header):** Bold, condensed, high-impact blocky typography inspired by *The Original Beef of Chicagoland* (`visual_references/logo/thebear.png`) reading **`SEU MIGNON`**. Used in the sticky top header to save vertical screen space.
  2. **Circular Stamp / Seal Badge (Avatar & Favicon):** Vintage rubber-stamp circular/square seal inspired by `visual_references/logo/bbq-king.png` and `visual_references/mascot/cuphead3.png`, framing the cheeky bull mascot's head. Used for browser favicon, social avatars, packaging sticker seals, and small header emblem.
  3. **Full-Body Mascot ("Boizinho Debochado" — 1930s Rubber-Hose Butcher/Chef):**
     - **Visual Style:** 1930s rubber-hose cartoon (`visual_references/mascot/pauls.png`, `cmv1..4.png`, `cuphead1..4.png`) combined with the half-lidded, smug, wide toothy mischievous grin of the Zelda Wind Waker Moblin (`visual_references/mascot/zelda1..3.png`).
     - **Attire & Pose:** Classic butcher apron, neckerchief/tilted chef cap, 1930s white cartoon gloves, holding a silver platter with a thick sizzling filet mignon in one hand and a two-prong carving fork (held like a spear) in the other.
     - **Print Constraint:** Designed strictly in **1 to 3 flat ink colors** (Charcoal + Primary Brand Accent `#10388B` or `#CB2031` + Cream paper background) for low-cost, high-impact screenprinting on kraft delivery boxes (`pauls.png`).
     - **Strict UI Placement (4 Touchpoints Only — Never Inside Dish Cards):**
       1. `WelcomePromoModal` (onboarding / campaign popup).
       2. Header stamp emblem & browser `favicon`.
       3. Empty Cart Drawer state (*"Essa sacola tá muito leve... escolhe logo seu Mignon!"*).
       4. Order Tracking page (`/orders/:orderId`) & physical kraft delivery packaging.

### 5.2. Dual-Theme A/B Design Tokens (Live Theme Switcher for E1/E2 Prototyping)

To test both visual directions live against real food photography, the frontend CSS variables (`src/index.css` / Tailwind theme tokens) will support two switchable presets (`data-theme="blue-bistro"` and `data-theme="red-kraft"`):

#### Theme A — `"The Original Mignon"` (Royal Blue `#10388B` Lead on Warm Cream)

| Token Role | CSS Variable | HEX | Usage |
| :--- | :--- | :---: | :--- |
| **Page Background** | `--color-bg-canvas` | `#F7F3EA` | Warm buttered cream paper base (replaces clinical white) |
| **Card / Modal Surface** | `--color-bg-surface` | `#FFFDF9` | Warm ivory surface for dish cards, sticky cart, and modals |
| **Card Hover / Secondary** | `--color-bg-Subtle` | `#EFE9DC` | Almond cream hover state and section pill background |
| **Border / Divider** | `--color-border` | `#E2D9C8` | Subtle warm paper border |
| **Text Primary** | `--color-text-primary` | `#1C1917` | Warm charcoal for dish titles, prices, and headings |
| **Text Secondary** | `--color-text-secondary` | `#57534E` | Medium coffee gray for 2-line dish descriptions |
| **Primary Brand Accent** | `--color-brand-primary` | `#10388B` | Deep Royal Blue for CTAs, active tabs, price highlights, and `1/3` counters |
| **Primary Hover** | `--color-brand-primary-hover` | `#0C2B6B` | Darker navy hover/active state |
| **Secondary Accent** | `--color-brand-secondary` | `#CB2031` | Crimson Red reserved for small stamp details / promo badges |
| **Success** | `--color-status-success` | `#1F7A4C` | Sage green (`3/3` sides completed badge, `PAID` order status) |
| **Danger / Error** | `--color-status-error` | `#B91C1C` | Brick red for validation errors and `CANCELLED` status |
| **Font Heading / Display** | `--font-display` | `'Oswald', sans-serif` | Weight `700` uppercase blocky display (*The Bear* aesthetic) |
| **Font Body / UI** | `--font-sans` | `'Plus Jakarta Sans', sans-serif` | Weights `400`, `600`, `700` for high-legibility mobile cards and BRL prices |

#### Theme B — `"Clube da Brasa & Kraft"` (Crimson Red `#CB2031` Lead on Oat Kraft Cream)

| Token Role | CSS Variable | HEX | Usage |
| :--- | :--- | :---: | :--- |
| **Page Background** | `--color-bg-canvas` | `#F5EFE2` | Soft oat/kraft cream base inspired by `pauls.png` & `sweetgreen2.png` |
| **Card / Modal Surface** | `--color-bg-surface` | `#FAF7F0` | Luminous warm cream surface for dish cards and modals |
| **Card Hover / Secondary** | `--color-bg-subtle` | `#EBE2D0` | Kraft-tinted hover state and secondary badges |
| **Border / Divider** | `--color-border` | `#DDD2BE` | Warm kraft divider line |
| **Text Primary** | `--color-text-primary` | `#231F20` | Espresso stamp ink charcoal for headings and dish titles |
| **Text Secondary** | `--color-text-secondary` | `#5C5346` | Warm brownish-gray for 2-line dish descriptions |
| **Primary Brand Accent** | `--color-brand-primary` | `#CB2031` | Crimson Red for CTAs, active category pills, and `1/3` counters |
| **Primary Hover** | `--color-brand-primary-hover` | `#A81826` | Deep ruby hover/active state |
| **Secondary Accent** | `--color-brand-secondary` | `#10388B` | Royal Blue reserved for tooltip hints (`panda2.png` style) and stamp accents |
| **Success** | `--color-status-success` | `#2E6F40` | Forest green (`3/3` sides completed badge, `PAID` order status) |
| **Danger / Error** | `--color-status-error` | `#991B1B` | Deep red alert state |
| **Font Heading / Display** | `--font-display` | `'Fraunces', serif` (or `'Syne', sans-serif`) | Weight `800/900` warm artisanal display typography |
| **Font Body / UI** | `--font-sans` | `'DM Sans', sans-serif` | Weights `400`, `500`, `700` for friendly, fast mobile scanning |

### 5.3. Core UX & Layout Rules (Sweetgreen <> Foodpanda Synthesis)

1. **Direct-to-Menu Landing + Smart `WelcomePromoModal`:**
   - No separate institutional homepage before the menu. The root route (`/`) loads the menu directly.
   - On first visit (or when a new campaign ID is active), a dismissible **`WelcomePromoModal`** opens featuring an appetizing hero photo, the cheeky bull mascot, and a 3-step visual guide (*"1. Escolha seu prato principal -> 2. Escolha o tamanho/ponto -> 3. Escolha seus 3 acompanhamentos inclusos"*).
   - Dismissed with a single tap on `(X)`, backdrop click, or primary CTA (`"Bora montar meu prato"`). State is persisted in `localStorage` by `campaign_id` so returning users are not spammed, and the modal configuration can be toggled off or swapped for a promotion banner at any time.
2. **Main Menu Catalog (Foodpanda Efficiency on Warm Cream):**
   - Sticky horizontal category navigation bar (`Pratos com Mignon`, `Outras Carnes`, `Acompanhamentos`, `Bebidas`).
   - Compact horizontal dish cards: left column with dish title, concise description (strictly max 2 lines, no calorie/nutritional tables), and integer-centavos BRL price; right column with square `1:1` dish photo and quick `+` action button.
   - Desktop view (`>= 1024px`) keeps a sticky right-hand Cart Sidebar (`panda3.png`); mobile view uses a sticky bottom summary bar opening a smooth Cart Drawer.
3. **Focused Dish Customization Modal (Sweetgreen Visual Counters — 3 Included Sides Only):**
   - Clicking a main dish opens an agile modal/sheet (`panda4.png`) dedicated **exclusively** to selecting the **3 included sides (`0/3` -> `3/3`)** (`choice_groups` with `min_choices: 3, max_choices: 3`).
   - **Zero Upsell Clutter Inside the Modal:** Paid extra sides are **not** stacked inside the main dish modal; customers who want standalone extra sides select them directly from the `Acompanhamentos` category in the main menu.
   - **3-to-4 Column Photo Grid with Repeat Badges:** Included sides are displayed as visual photo cards (`grid-cols-3` on mobile, `grid-cols-4` on desktop) inspired by `sweetgreen3.png` and `sweetgreen4.png`. Tapping a side overlays a bold circular quantity badge (`1`, `2`, `3`) directly on the photo with quick `+`/`-` adjustment so customers can easily repeat sides (e.g., `2x Arroz` + `1x Batata Frita` = `3/3`).
4. **Anti-Clutter Guardrails:**
   - No Pick-up / Retirada toggle (Delivery only).
   - No Group Order button.
   - No nutritional tables or long-form paragraphs on dish cards.

### 5.4. Professional Food Photography Brief

- **Main Dishes (Filet Mignon Plates):** Shot at a **45-degree diner's angle** to showcase meat thickness, sear crust, juicy interior doneness, and sauce glaze.
- **Individual Sides (for the `3x4` modal grid):** Shot at a **90-degree overhead flat-lay (Zenital)** zoomed into ceramic bowls or textures (`sweetgreen3.png` / `sweetgreen4.png`).
- **Surface & Plating:** Matte warm cream, light stone, raw linen, or warm light wood surfaces (`#EFE9DC` range) with off-white/stone matte ceramic plates — strictly avoid harsh pure white (`#FFFFFF`) or pitch-black backgrounds.
- **Safe Cropping Margin:** Leave breathing room around plates to support both `1:1` square card crops and `16:9` / `4:3` modal hero crops.

### 5.5. Reference AI / Illustrator Prompts for the Mascot & Logo

- **Prompt A (Theme A — Blue Bistro `#10388B`):**
  `"1930s rubber-hose vintage cartoon mascot of a smug, cheeky bull chef character, inspired by Cuphead and Wind Waker Moblin facial expression. Half-closed confident eyes, wide toothy mischievous grin, large snout, wearing a vintage butcher apron, a neckerchief, and classic 1930s white cartoon gloves. One hand holds a silver platter with a sizzling thick filet mignon steak, the other hand holds a large two-prong barbecue fork like a spear. Thick ink outlines, flat vector screenprint texture for kraft cardboard packaging, strictly 3 colors: Deep Royal Blue (#10388B), Charcoal Black (#1C1917), and a small splash of Crimson Red (#CB2031) on the neckerchief, isolated on a warm cream paper background (#F7F3EA), no gradients, bold retro typography 'SEU MIGNON'."`
- **Prompt B (Theme B — Red Kraft `#CB2031`):**
  `"1930s rubber-hose cartoon illustration of a cheeky, arrogant bull butcher mascot inspired by Cuphead and Zelda Wind Waker Moblin grin, printed on a kraft delivery box style like Paul's Boutique pizza box. Half-lidded smug eyes, huge mischievous toothy smile, wearing a classic butcher apron, chef cap tilted to the side, and white cartoon gloves, proudly carrying a tray with a thick filet mignon and holding a carving fork. Bold vintage ink lines, distressed rubber-stamp texture, 2-color screenprint palette: Crimson Red (#CB2031) and Espresso Charcoal (#231F20) on a warm oat kraft cream background (#F5EFE2), framed by a retro red checkered border."`
