# Fire Safety Products & Services Platform — Backend + Admin Console

This repo now contains two pieces:

1. **`server/`** — the TypeScript/Express/Mongoose REST API (Phases 1–5 of the spec): auth + RBAC, catalog,
   cart/checkout/orders, B2B quotes with PDF generation, GST invoicing, customer equipment tracking, AMC
   contracts, service bookings, technicians, reviews, blog/CMS, gallery/FAQ/banners, coupons, notifications,
   CRM, reports, audit logs, and a cron-based reminder engine.
2. **`admin/`** — a full React + Vite + TypeScript admin console (staff-only) that talks to that API:
   dashboard with live charts, product/category catalog management, order lifecycle management, B2B quote
   review + PDF generation + convert-to-order, service booking + technician assignment, AMC contract tracking,
   customer CRM with tags and account history, review moderation, coupons, blog/gallery/FAQ CMS, staff & role
   management, an audit log viewer, company settings, and a reports page with CSV export.

**Not yet built:** the customer-facing storefront (the third piece of the original spec), automated tests,
i18n, PWA assets, and live Razorpay/SMS/WhatsApp provider wiring (interfaces are ready on the backend).

## 1. Requirements

- Node.js 18+
- MongoDB (Atlas or local). **Checkout uses a MongoDB transaction, which requires a replica set** — a free
  Atlas cluster already qualifies, or run `mongod --replSet rs0` locally and `mongosh --eval "rs.initiate()"` once.

## 2. Setup

```bash
# Backend
cd server
cp .env.example .env      # set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET at minimum
npm install
npm run seed               # creates admin account + demo staff + categories + sample products + FAQs
npm run dev                 # API on http://localhost:5000

# Admin console (separate terminal)
cd admin
cp .env.example .env       # defaults to http://localhost:5000/api — change if your API runs elsewhere
npm install
npm run dev                  # console on http://localhost:5174
```

Or from the repo root, after both `npm install`s are done: `npm run dev` (runs both concurrently, needs
`npm install` once at the root too for the `concurrently` package).

Log in with the seeded admin credentials (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `server/.env`,
defaults to `admin@firesafety.example` / `ChangeMe123!` — **change this before any real deployment**).
Customer-role accounts are blocked from signing into this console by design.

## 3. Admin console structure

```
admin/src/
├── components/
│   ├── layout/     # Sidebar, Topbar, AppLayout, PageHeader
│   └── ui/          # Button, FormControls, Modal, DataTable, Pagination, Primitives (Card/Badge/StatCard/EmptyState)
├── lib/apiClient.ts   # axios instance with JWT attach + silent refresh-token retry on 401
├── store/authStore.ts  # zustand + localStorage-persisted session + permissions
├── routes/ProtectedRoute.tsx  # auth guard + per-route permission guard
├── types/index.ts        # TypeScript types mirroring the backend Mongoose models
└── pages/                  # one folder per domain: dashboard, products, categories, orders, quotes,
                             # services, technicians, amc, customers, reviews, coupons, blog, content
                             # (gallery/faqs), staff, settings, audit, reports
```

### Design system
Ink (`#1B2027`) sidebar, warm paper background (`#F7F5F1`), hairline card borders instead of heavy shadows,
safety red (`#C1272D`) reserved for destructive/critical actions only, amber for "due soon" states, forest
green for success/paid/completed. Inter for UI text and tables, Space Grotesk for headings and stat numbers.
Status is shown with a left accent bar on table rows in addition to badges, so scanning a long list doesn't
require reading every badge.

### RBAC on the frontend
The sidebar and route guards read `user.permissions` (returned at login, matching the backend's
`effectivePermissions()`) via `useAuthStore().hasPermission(...)`. This **only hides UI** — the backend is
the real authority and re-checks every permission server-side, so a hidden nav item is a UX nicety, not a
security boundary.

### Data fetching
TanStack Query for all server state (automatic caching, refetch-on-mutation via `invalidateQueries`).
React Hook Form + Zod for every create/edit form. Axios interceptor in `lib/apiClient.ts` attaches the
access token to every request and, on a 401, transparently calls `/auth/refresh` once and retries.

## 4. Known limitations to address before production

- `npm install` could not be verified in this sandboxed build environment (no network egress) — run it
  yourself and fix any dependency-version issues before deploying.
- The Gallery form takes an image URL directly; wire it to `POST /api/uploads/image/gallery` (already built
  on the backend) with a real file picker for a smoother staff experience.
- Password reset for staff accounts isn't exposed in this console yet — use the "Add staff" flow (emails a
  temporary password) or extend `Settings` with a change-password form.
- No automated tests yet for the admin console (Vitest + React Testing Library would be the natural choice).

## 5. Next phases

Remaining: the customer-facing React storefront, then Phase 6 (real Razorpay/SMS/WhatsApp, i18n, PWA).

---

## Appendix: original backend-only notes

### RBAC (backend)

Roles: `super_admin`, `admin`, `sales`, `technician`, `accountant`, `customer`.
Every protected route checks a specific permission (e.g. `products.update`) via
`requireAuth` + `requirePermission(...)` middleware — see `server/src/config/permissions.ts` for the full
role → permission map.

### Key business flows implemented

- **Checkout** (`POST /api/orders/checkout`): validates user → validates cart → validates stock →
  calculates GST/discount → creates the order inside a MongoDB transaction → creates a payment record →
  decrements inventory → clears the cart → sends a notification → generates the GST invoice PDF.
- **Equipment reminders** (`server/src/jobs/reminderJob.ts`): scans `nextRefillDate` / `nextInspectionDate`,
  resolves the milestone (30/15/7/1 days, due today, overdue), and uses `NotificationLog`'s unique index to
  guarantee no duplicate is ever sent for the same milestone.
- **AMC expiry scan**: same milestone/dedup pattern against `AMCContract.endDate`, auto-flips contract
  status to `expiring_soon` / `expired`.
- **B2B quotes**: `POST /api/quotes` (guest or logged-in) → admin reviews/edits → `POST /api/quotes/:id/pdf`
  generates a PDFKit quotation → `POST /api/quotes/:id/convert` turns an approved quote into a real order.

### API surface

Base path: `/api`. See `server/src/routes/index.ts` for the full mount list.

---

## Appendix: customer storefront (`client/`)

A full React + Vite + TypeScript public storefront, sharing the same brand tokens as the admin console but
with a warmer, marketing-forward layout (rounded-lg cards, hero sections, a sticky WhatsApp button).

### Setup
```bash
cd client
cp .env.example .env    # defaults to http://localhost:5000/api
npm install
npm run dev               # storefront on http://localhost:5173
```

### Pages implemented
- **Home** — hero, category grid, featured products, services overview, best sellers, trust stats, blog
  preview, quote CTA.
- **Catalog** — `/products` (filters, sort, pagination), `/products/:category`, `/product/:slug` (gallery,
  specs, features, reviews with submit-a-review, related products), `/search`.
- **Cart & checkout** — `/cart` (quantity edit, coupon), `/checkout` (saved or new address, COD or test
  payment, live order summary), `/order-success`.
- **Wishlist** — `/wishlist`.
- **Services** — `/services` overview, `/services/:slug` detail pages (installation, refilling, inspection,
  fire-safety-audit, amc), `/book-service`, `/request-quote` (multi-product B2B quote form, works for guests).
- **Account** (auth-gated, own sidebar layout) — overview, orders + order detail with cancel, quotes,
  **my equipment** (register/track refill & inspection dates — the core reminder-system-facing feature),
  service history, invoices with PDF download, addresses, notifications, profile.
- **Content** — `/blog`, `/blog/:slug`, `/gallery`, `/faq`, `/contact`, `/about`, `/privacy-policy`, `/terms`,
  and a branded 404.
- **Auth** — `/login`, `/register` (individual/business toggle).

### How cart/wishlist auth works
The backend requires authentication on all `/cart`, `/wishlist`, `/orders`, `/services`, `/equipment` and
`/amc` routes — there's no guest cart on the server. `useCart` / `useWishlist` (in `src/hooks/`) redirect an
anonymous visitor to `/login` (preserving the page they came from) the moment they try to add something,
rather than faking a local cart that would have to be reconciled with the server later.

### Known gaps
- The Contact page's form doesn't hit a backend endpoint yet — add `POST /api/contact` server-side (or route
  it through `/api/quotes` as a general enquiry) and wire it up.
- No i18n (Hindi/Marathi) or service worker yet, though `public/manifest.webmanifest` and `robots.txt` are in
  place as a PWA/SEO starting point.
- `npm install` could not be verified in this sandboxed environment — run it yourself and fix any
  dependency-version issues before deploying.

---

## Appendix: email OTP verification (security)

New accounts — individual and business alike — are created **unverified** and cannot sign in until they
confirm a 6-digit code sent to their email. This is enforced on the backend, not just hidden in the UI.

**Flow:** `POST /api/auth/register` creates the account and emails a code, but returns no session tokens —
there's nothing to log into yet. `POST /api/auth/verify-otp` checks the code and, only on success, marks the
account verified and issues the JWT pair. `POST /api/auth/resend-otp` requests a new code. If someone tries
`POST /api/auth/login` before verifying, the server returns `403` with `errors: [{ code: 'EMAIL_NOT_VERIFIED' }]`
— the storefront's Login page detects that exact code and redirects to `/verify-email` instead of dead-ending.

**Security properties (`server/src/services/otpService.ts`):**
- Codes are generated with `crypto.randomInt` (CSPRNG), never `Math.random()`.
- Only an HMAC-SHA256 hash of the code is stored (`User.emailOtpHash`, `select: false` so it can never leak
  into an API response) — the plaintext code exists only in the outgoing email.
- Comparison uses `crypto.timingSafeEqual`, not `===`, so response timing can't leak how many digits matched.
- Codes expire after 10 minutes and are single-use — a successful verify clears the hash immediately.
- Verification is capped at 5 wrong attempts before the code is invalidated and a fresh one is required.
- Resending is cooldown-limited (60s) at the application level, plus a dedicated `express-rate-limit` of
  5 requests / 15 minutes specifically on `/api/auth/resend-otp` (tighter than the general `/api/auth` limit)
  since it's the endpoint most exposed to inbox-spam abuse.

**Frontend:** `client/src/pages/auth/VerifyEmail.tsx` is a dedicated page (not a modal) with a 6-box code
input (`components/ui/OtpInput.tsx` — auto-advance, backspace-to-previous, paste support), a live resend
countdown, and clear expiry messaging. Both `/register` and a blocked `/login` route here.

In development, `EMAIL_MODE=development` means the OTP is printed to the server console instead of actually
emailed — check the terminal running `npm run dev` in `server/` for the code. Switch to a real SMTP provider
via `EMAIL_MODE=production` + `EMAIL_HOST`/`EMAIL_USER`/`EMAIL_PASSWORD` when you're ready to send real email.
