# Review-pass changes

This file lists every problem found in the AI-built version, what was changed, and how it was checked.
"Test" names point to files in `server/tests/`.

**Verified with:** `npm ci` (all four lockfiles) -> `npm run lint` -> `npm run typecheck` -> `npm test` ->
`npm run build`, all run from a clean copy. 258 server tests: 252 pass, 6 are skipped on the MongoDB look-alike used
for local checking and are meant to run on real MongoDB in CI (listed at the end).

## Fix first

| # | Problem | Fix | Test |
|---|---|---|---|
| 1 | Any logged-in user could check in / complete any job | Only admins or the technician the job is assigned to may act; completion is an atomic claim (double-tap cannot complete twice) | `technicianFlow` |
| 2 | Any logged-in user could write into any equipment record | Admins, or the assigned technician with a `bookingId` for that exact equipment on an open job; technician name comes from the server; audited | `equipment` |
| 3 | Public passport leaked owner name/phone/email | Anonymous view has equipment facts only (no owner contact, address, notes, report links). Owner/admin/assigned technician get the full record. Rate-limited | `equipment` |
| 4 | Booking status calls hit the catalog route | Frontends now call `/api/bookings/*`; booking and catalog routes are separate; the conflicting `/services/:id/...` aliases were removed | `bookings`, `technicianFlow` |
| 5 | Dashboard v2 returned 500 | Removed `populate('plan')` (field is `planName`) and the invented technician fields; frontend aligned | `misc` |
| 6 | Hyphenated catalog slugs broke job completion | Equipment history type is derived by keyword and always valid; unknown services become `maintenance` | `bookingRules`, `technicianFlow` |

## High

**Audit chain.** HMAC-sealed (needs `AUDIT_HMAC_SECRET`) over every field including before/after values; explicit
sequence numbers so forks, gaps and reordering are detected; writes are serialised and the unique `seq` index makes
simultaneous writes safe; old unsealed entries are counted, not failed; `account_locked`, `login_blocked` and
`password_reset` are now actually recorded (system events); IP comes from `req.ip` through `TRUST_PROXY`, not a raw
header. Tests: `audit`, `unit/auditSeal`.

**Sessions.** Logout now revokes the refresh token on the server (both frontends call it). Rotation is one atomic
claim; replaying a just-used token (two tabs) is refused without ending the session; replay after the grace window
ends only that login (token families); legacy rows without a family can never trigger a mass sign-out; refresh
lifetime follows `JWT_REFRESH_EXPIRES_IN` (it was hard-coded to 7 days); a password change also rejects access tokens
issued before it; tabs share tokens and a network blip no longer signs anyone out. Tests: `authSecurity`.

**Logs.** Authorization/cookies/passwords/tokens are redacted and only method + path (no query string) are logged;
caller request ids are validated (log injection). Tests: `unit/requestLogging`, `unit/logging`.

**Login.** One generic error for unknown email / wrong password / blocked (no 423, no "attempts remaining"), unknown
emails are throttled too, timing equalised. Failure counters are atomic. **A stranger can no longer lock the owner
out**: 5 failures from one IP block that IP for that email only; 20 failures across many IPs lock the account (the
botnet case); the owner is emailed once; a password reset or successful login clears it. Staff get a new-device alert
and a new-IP alert, customers a new-device alert; the browser string is HTML-escaped in every email. Tests: `authSecurity`.

**Uploads.** Dependency-free magic-byte check; the stored extension comes from the content, never the client name
(a fake `.html` is saved as `.png`); `file-type` and its advisory are gone; `/uploads` is served with `nosniff` and a
sandbox CSP; technicians can upload only to `service-reports`. Tests: `misc`, `unit/helpers`.

**User input in regex.** Every user-supplied pattern is escaped (bookings, service/blog/FAQ/customer search, Ctrl+K).
`serviceType` must resolve to a live catalog service. The unused service text index was removed. Tests: `bookings`, `misc`.

**Service worker.** Never touches `/api/`; pages are network-first so deploys appear at once; only hashed build assets
are cached; old caches (which held API data) are deleted on activate; everything is wiped at sign-out; the missing
favicon and icons were added; an offline page exists. Tests: `unit/serviceWorker` (runs the real `sw.js` in a sandbox).

**Invoices and totals.** GST is charged on the discounted amount (discount spread across lines, cart and checkout use
the same function); the PDF shows subtotal, discount, taxable value, GST and shipping; amount in words includes paise;
no placeholder GSTIN is ever printed (production refuses to invoice without one, the order is unaffected); an
invoice failure no longer undoes a paid order or returns its stock. Tests: `orders`, `unit/pricing`.

**Ctrl+K search.** Links go to pages that exist and open pre-filtered; each result group needs its own read
permission; technicians only find their own jobs.

**Bookings.** Capacity enforced on create and reschedule (with a re-check against simultaneous bookings); inactive,
unpublished and deleted services cannot be booked; equipment must belong to the customer; a real status flow
(no completing without a report, no reviving cancelled jobs); `adminNotes` never reach customers and customer
reschedule/cancel notes go to a customer-visible `timeline`; technicians no longer have `services.update`. Tests: `bookings`.

## Medium and low

- Product text index change: `npm run db:sync-indexes` (see README, section 6).
- Reviews: rating must be a whole number 1-5; one review per booking (unique index); text and image links validated.
- Technician list: overdue jobs shown, cancelled jobs not "upcoming", completed sorted by `completedAt`.
- CI: `NODE_ENV=test` only on the test step, `npm ci` with no fallback, correct env names, real MongoDB 6 service.
- Tests: checkout is tested through the real endpoint; the suite refuses to run on a database without "test" in its
  name; test settings are applied before anything loads, so a developer's real `.env` can never be used.
- Frontend Sentry: 10% traces, no replay unless an error occurs, text and media masked, personal fields scrubbed;
  variables documented in `.env.example`.
- Dark mode is applied before first paint (also on the login pages). Removed explanatory comments were restored.

## Also fixed along the way

- Checkout accepted expired or used-up coupons; it now applies the same rules as the cart, claims a use atomically and
  gives it back if the order fails.
- Customer phone/email in the dashboard's AMC list are hidden from users without `customers.read`.
- Staff invites: the response says whether the email was sent; new "Resend invite" button and endpoint.

## One correction

The earlier review said any admin could edit settings. The original code already limited company/identity/security
keys to super admin; the AI widened it to all keys, which is fine.

## Not verified here (please check)

- **6 tests need real MongoDB** and were skipped locally; CI runs them: double-submit completion, product `$text`
  search, parallel wrong guesses, simultaneous refresh, duplicate-review race, dashboard revenue (`$dateToString`).
- **`npm run db:sync-indexes`** was only run against the local look-alike, which lacks text/TTL/partial indexes. Run
  it on a copy of your database first.
- The GitHub Actions workflow was validated as YAML and each of its commands was run locally, but it has not run on GitHub.
- Nothing was clicked through in a browser; the frontends were linted, type-checked and built.
- Not built: queuing offline check-ins/reports (the PWA caches only the app shell), a per-technician capacity field,
  detection of deleted *newest* audit entries (copy the latest hash somewhere external).
- Shipping is added after tax and not itself taxed; confirm with your accountant.
- `react-router` has two moderate advisories in admin/client; the fix is a major-version upgrade, not done here.
