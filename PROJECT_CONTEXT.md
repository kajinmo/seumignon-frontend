# PROJECT_CONTEXT.md — Seu Mignon (Frontend SPA & Ecosystem Contracts)

## 1. Overview & FinOps Philosophy

`seumignon-frontend` is the customer-facing mobile-first delivery web application for **Seu Mignon** (~1,000 monthly visits). The business goal is to convert customers via a fast, tailored direct ordering experience with zero third-party marketplace commissions and near-zero fixed hosting cost:

- **Frontend Hosting (100% Free Tier):** Cloudflare Pages (`seumignon-frontend.pages.dev` during staging/homologation, then custom domain `seumignon.com.br`), leveraging Cloudflare's global CDN, automatic SSL, and existing DNS management.
- **Backend API (`seumignon-backend`):** Scale-to-zero AWS Serverless stack in `us-east-1` (API Gateway HTTP API v2 + ARM64 FastAPI/Mangum Lambda + DynamoDB + SQS + Pagar.me V5 + Saipos Order API).

---

## 2. Ecosystem Boundaries & CORS Matrix

The frontend communicates exclusively over HTTPS/JSON with `seumignon-backend` configured via `VITE_API_BASE_URL`:

| Environment | `VITE_API_BASE_URL` | Notes |
| :--- | :--- | :--- |
| **Local Development** | `http://localhost:8000` | Local `uvicorn` FastAPI server (`bootstrap_local`) |
| **AWS Sandbox / Production** | `https://p9joemg5dj.execute-api.us-east-1.amazonaws.com` | Deployed API Gateway HTTP API v2 in `us-east-1` |

**Pre-Authorized CORS Origins on `seumignon-backend`:**

- `http://localhost:5173` (Vite default dev server)
- `http://localhost:3000` (Alternative local port)
- `https://seumignon-frontend.pages.dev` (Cloudflare Pages staging)
- `https://seumignon.com.br` and `https://www.seumignon.com.br` (Production domain)

The frontend **never** calls Saipos or Pagar.me secret APIs directly and **never** stores secrets in browser bundles.

---

## 3. Exact Backend API Contracts (`seumignon-backend`)

### 3.1. `GET /health`

```json
{
  "status": "ok",
  "environment": "prod"
}
```

### 3.2. `GET /menu`

Returns active menu items (with `choice_groups`) and pre-calculated `delivery_zones`:

```json
{
  "updated_at_iso": "2026-11-21T12:00:00+00:00",
  "items": [
    {
      "item_id": "item_mignon_1",
      "name": "Parmegiana de Mignon",
      "category": "Pratos Executivos",
      "size": "Individual",
      "price_cents": 6890,
      "description": "Filé mignon empanado com molho artesanal e gratinado.",
      "image_url": "https://...",
      "choice_groups": [
        {
          "group_id": "included_sides",
          "name": "Acompanhamentos Inclusos",
          "min_choices": 3,
          "max_choices": 3,
          "items": [
            {
              "choice_item_id": "side_arroz",
              "name": "Arroz Branco",
              "price_cents": 0,
              "enabled": true
            }
          ]
        },
        {
          "group_id": "extra_sides",
          "name": "Acompanhamentos Extras",
          "min_choices": 0,
          "max_choices": 10,
          "items": [
            {
              "choice_item_id": "extra_fritas",
              "name": "Porção Extra Batata Frita",
              "price_cents": 1200,
              "enabled": true
            }
          ]
        }
      ]
    }
  ],
  "delivery_zones": [
    {
      "zone_id": "zone_jardins",
      "name": "Jardins",
      "distance_km": 1.2,
      "fee_cents": 500
    }
  ]
}
```

### 3.3. `GET /delivery-fee?cep={cep}`

Calculates authoritative delivery distance and fee within the 5.5 km cutoff:

```json
{
  "cep": "03195000",
  "distance_km": 0.0,
  "fee_cents": 500,
  "district": "Alto da Mooca",
  "source": "local_index"
}
```

Returns `422 Unprocessable Content` (`DeliveryOutOfRangeError`, `CepNotFoundError`, `InvalidCepError`) when invalid or outside the 5.5 km delivery radius.

### 3.4. `POST /orders` (Request `201 Created` — Guest or Authenticated `Bearer <access_token>`)

```json
{
  "customer": {
    "name": "Maria Silva",
    "phone": "11999998888",
    "email": "maria@example.com",
    "document_number": "12345678909",
    "customer_id": ""
  },
  "delivery_address": {
    "postal_code": "03195-000",
    "street_name": "Rua Exemplo",
    "street_number": "123",
    "district": "Alto da Mooca",
    "city": "São Paulo",
    "state": "SP",
    "complement": "Apto 42",
    "reference": "Próximo ao metrô",
    "country": "BR"
  },
  "items": [
    {
      "item_id": "item_mignon_1",
      "quantity": 1,
      "choices": [
        {
          "group_id": "included_sides",
          "choice_item_id": "side_arroz",
          "quantity": 3,
          "notes": ""
        }
      ],
      "notes": "Carne ao ponto"
    }
  ],
  "notes": "Interfone 42"
}
```

### 3.5. `OrderResponse` (Returned by `POST /orders`, `GET /orders/{order_id}`, and `GET /me/orders`)

Possible `status` values: `"PENDING"` | `"PAID"` | `"DISPATCHED"` | `"CANCELLED"`.

```json
{
  "order_id": "ord_e24dd227043c47b3",
  "display_id": "4821",
  "status": "PENDING",
  "created_at_iso": "2026-11-21T12:05:00+00:00",
  "subtotal_cents": 6890,
  "delivery_fee_cents": 500,
  "discount_cents": 0,
  "total_cents": 7390,
  "payment_link_id": "pl_...",
  "checkout_url": "https://payment-link.pagar.me/pl_...",
  "payment_method": "",
  "items": [
    {
      "item_id": "item_mignon_1",
      "name": "Parmegiana de Mignon",
      "size": "Individual",
      "unit_price_cents": 6890,
      "quantity": 1,
      "line_total_cents": 6890,
      "choices": [
        {
          "choice_item_id": "side_arroz",
          "group_id": "included_sides",
          "name": "Arroz Branco",
          "unit_price_cents": 0,
          "quantity": 3,
          "notes": ""
        }
      ],
      "notes": "Carne ao ponto"
    }
  ],
  "notes": "Interfone 42"
}
```

### 3.6. Passwordless Email OTP & Customer Routes (`Authorization: Bearer <access_token>`)

- `POST /auth/request-code` (`{ "email": "..." }`) -> `{ "email", "challenge_name": "EMAIL_OTP", "session" }`
- `POST /auth/verify-code` (`{ "email", "code", "session" }`) -> `{ "user_id", "email", "access_token", "id_token", "refresh_token", "expires_in_seconds" }`
- `GET /me/profile` / `PUT /me/profile` -> saved customer details and `default_address`
- `GET /me/orders` -> `OrderResponse[]`

### 3.7. Standard HTTP Error Envelope

Domain/business errors (`404`, `422`, `502`) return:

```json
{
  "error": "ChoiceValidationError",
  "detail": "Group 'Acompanhamentos Inclusos' for 'Parmegiana de Mignon' requires between 3 and 3 selections, got 2."
}
```

---

## 4. Core Frontend Business Rules

1. **Integer Centavos Rule:** All prices (`price_cents`, `fee_cents`, `subtotal_cents`, `total_cents`) are integer centavos. Format using `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` strictly in presentation components (`cents / 100`).
2. **Meal Assembly (`choice_groups`):**
   - `included_sides`: typically `min_choices: 3`, `max_choices: 3`, `price_cents: 0`. Customers can repeat options (e.g., `2x Arroz + 1x Fritas = 3`).
   - `extra_sides`: typically `min_choices: 0`, `max_choices: 10`, `price_cents > 0`.
   - Validate `min_choices <= sum(quantities) <= max_choices` per group before enabling "Adicionar à sacola".
   - Exact line total formula: `(item.price_cents + sum(choice.price_cents * choice.quantity)) * item.quantity`.
3. **Authoritative CEP Delivery Fee (`GET /delivery-fee?cep=...`):**
   - Customers enter their 8-digit CEP; `seumignon-backend` returns the authoritative `fee_cents`, `distance_km`, and `district` within the 5.5 km cutoff (returning `422` if out of range or invalid), with optional best-effort ViaCEP street autofill and zero Google Maps cost.
   - Checkout submits `postal_code` and `district` in `POST /orders`.
4. **Pagar.me Hosted Checkout (`checkout_url`), Optional Email OTP Account & Order Tracking:**
   - Zero card data collected in the SPA.
   - Guest Checkout remains the default; optional Passwordless Email OTP (`access_token`) unlocks saved profile/address autofill and cloud order history (`GET /me/orders`).
   - Save created `order_id` in `localStorage`, navigate/redirect to `checkout_url`, and provide `/orders/:orderId` polling `GET /orders/{order_id}`.

---

## 5. Visual References Inventory & Cutover Strategy

### 5.1. Visual References (`visual_references/`)

Collected brand, mascot, and digital menu UI inspirations to be synthesized during `E0` (`/grill-me` design interview):

- **Logo inspiration:**
  - `visual_references/logo/bbq-king.png` (expressive red brush emblem & stamp seal)
  - `visual_references/logo/thebear.png` ("The Original Beef of Chicagoland" — bold blocky display typography with editorial script/sans contrast)
- **Mascot & character style:**
  - `visual_references/mascot/cmv1.png` – `cmv4.png` (retro rubber-hose / vintage cartoon beverage mascot attitude)
  - `visual_references/mascot/cuphead1.png` – `cuphead4.png` (1930s rubber-hose illustration, bold outlines, warm vintage palette)
  - `visual_references/mascot/pauls.png` ("Paul's Boutique" — vintage line-art chef mascot on kraft/cream background with red checkerboard border)
  - `visual_references/mascot/zelda1.png` – `zelda3.png` (expressive toon shading & stylized character silhouettes)
- **Webpage & ordering UX patterns:**
  - `visual_references/webpage/pandafood/panda1.png` – `panda4.png` (delivery address bar, category tabs, item quick-add cards, sticky cart summary sidebar, dish customization modal)
  - `visual_references/webpage/sweetgreen/sweetgreen1.png` – `sweetgreen4.png` (editorial warm surfaces, pill navigation, step-by-step side-dish builder with visual quantity badges like `2/2` and live left-hand summary)

### 5.2. Zero-Downtime Cutover Strategy

- **Legacy State:** `seumignon.com.br` currently points to KingHost; DNS is already managed in Cloudflare with active MX/email records audited and preserved.
- **Staging Validation:** Deploy and validate `seumignon-frontend` on `https://seumignon-frontend.pages.dev` against the AWS backend.
- **Cutover & Rollback:** Bind custom domains (`seumignon.com.br`, `www.seumignon.com.br`) in Cloudflare Pages (automatic SSL). Retain the legacy KingHost `A` record IP as an instant rollback target.
