# Seu Mignon Frontend — Operational Runbook

> **Status:** **Epics E0, E1, E2, E3 & E4 Completed**. All quality gate tooling scripts (`npm run ...`), SPA deep-link routing (`public/_redirects`), and live order tracking (`/orders/:orderId`) are active and verified.

---

## 1. Environment Variables (`VITE_API_BASE_URL`)

The SPA reads its backend origin exclusively from `VITE_API_BASE_URL` (never hardcode internal keys or direct Saipos/Pagar.me credentials):

| Target Environment | `VITE_API_BASE_URL` | CORS Authorized in AWS |
| :--- | :--- | :--- |
| **Local Backend (`uvicorn`)** | `http://localhost:8000` | `http://localhost:5173`, `http://localhost:3000` |
| **AWS Sandbox / Production API** | `https://p9joemg5dj.execute-api.us-east-1.amazonaws.com` | `https://seumignon-frontend.pages.dev`, `https://seumignon.com.br`, `https://www.seumignon.com.br` |

Local development uses `.env.local` (git-ignored), created from `.env.example` during Epic `E1`.

---

## 2. Local Development & Quality Gate (Active Starting Epic E1)

```powershell
# Install dependencies
npm install

# Run local Vite dev server (http://localhost:5173)
npm run dev

# Mandatory Pre-Commit Quality Gate
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## 3. Cloudflare Pages Staging Deploy (`seumignon-frontend.pages.dev`)

1. Connect the `seumignon-frontend` GitHub repository to **Cloudflare Pages** (Free Tier).
2. Configure build settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Set Environment Variables in Cloudflare Pages (Preview & Production):
   - `VITE_API_BASE_URL=https://p9joemg5dj.execute-api.us-east-1.amazonaws.com`
4. Validate end-to-end ordering on `https://seumignon-frontend.pages.dev` (Menu load -> 3 Included Sides validation -> Neighborhood delivery fee -> `POST /orders` -> Pagar.me `checkout_url` -> `/orders/:orderId` status tracking).

---

## 4. Production Cutover & Rollback Checklist (`pages.dev` -> `seumignon.com.br`)

1. **Record Rollback Target:** Document the legacy KingHost server `A` record IP in Cloudflare DNS before changing domain routing (MX/email records remain untouched in Cloudflare).
2. **Verify Backend Readiness:** Confirm `seumignon-backend` live credentials (`sk_live_...`, production Saipos `cod_store`, production webhooks) are active per `seumignon-backend/RUNBOOK.md`.
3. **Bind Custom Domain in Cloudflare Pages:**
   - Add `seumignon.com.br` and `www.seumignon.com.br` under **Custom Domains** in Cloudflare Pages.
   - Confirm automatic DNS CNAME flattening and active Universal SSL certificate.
4. **Live Smoke Test:** Complete a real mobile order from `https://seumignon.com.br`, verify Pagar.me payment link redirect and `/orders/:orderId` transition (`PENDING` -> `PAID` -> `DISPATCHED`).
5. **Instant Rollback (if critical issue occurs):** Revert the root `A` record in Cloudflare DNS to the documented KingHost IP to restore the legacy site within minutes.
