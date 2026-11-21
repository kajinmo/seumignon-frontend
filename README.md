# seumignon-frontend

Customer-facing mobile-first delivery SPA for **Seu Mignon**, built with React, TypeScript, Vite, and Tailwind CSS, hosted on **Cloudflare Pages** (100% Free Tier) and integrated with the serverless AWS backend ([`seumignon-backend`](../seumignon-backend)).

---

## Architecture & Ecosystem Boundaries

- **Decoupled SPA:** Communicates exclusively with `seumignon-backend` over HTTPS/JSON (`VITE_API_BASE_URL`). Zero direct calls to Saipos or Pagar.me secret APIs.
- **Integer Centavos Guardrail:** All monetary calculations run in integer centavos and format to `BRL` (`R$`) strictly at the UI layer.
- **Domain-Faithful Meal Assembly:** Enforces `choice_groups` rules (e.g., 3 included sides with repeatable quantities + paid extra sides) matching backend/Saipos line-total calculations.
- **Zero-Cost Neighborhood Delivery Fee:** Uses backend-provided `delivery_zones` within the 5.5 km radius without paid Maps/Geocoding APIs.
- **Hosted Payment Checkout:** Delegates Pix & Credit Card collection to Pagar.me `checkout_url` and tracks order lifecycle at `/orders/:orderId`.

---

## Epic Roadmap

| Epic | Name | Status |
| :---: | :--- | :---: |
| **E0** | UI/UX Discovery & Design Tokens | **COMPLETED** |
| **E1** | Project Bootstrap & API Client | **COMPLETED** |
| **E2** | Catalog & Dish Customization Modal | **COMPLETED** |
| **E3** | Cart Drawer, Neighborhood Delivery Fee & Checkout | **COMPLETED** |
| **E4** | Order Status Page & Cloudflare Pages Deploy | **COMPLETED** |

---

## Project Documentation

- **[`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md):** API contracts, CORS matrix, business rules, visual references inventory, and cutover strategy.
- **[`.agents/rules/AGENT.md`](.agents/rules/AGENT.md):** Engineering standards, communication rules, and quality gate guardrails.
- **[`.logbook/LOGBOOK.md`](.logbook/LOGBOOK.md):** Detailed epic checklists and progress milestones.
- **[`RUNBOOK.md`](RUNBOOK.md):** Environment configuration, Cloudflare Pages deployment, and zero-downtime cutover/rollback checklist.
