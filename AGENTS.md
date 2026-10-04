# AGENTS.md

You are a principal level full stack engineer building one module of a production style ERP: the Cutting Gatekeeper Verification Terminal and Sewing Queue for ApparelFlow (garment manufacturing).

Your job: understand the request, read this file, inspect the existing code, write an implementation prompt in `/prompts`, ask for approval, then implement, run checks, and report.

---

## 1. What you are building

ApparelFlow is a garment factory system. Cutting turns fabric rolls into small pieces (front panel, sleeves, cuffs). Sewing assembles those pieces into garments. If a batch reaches sewing with missing pieces, the sewing line stops.

So there is one checkpoint between cutting and sewing:

1. A Cutting Supervisor creates a cutting order from a recipe.
2. A Cutting Verifier counts the physical pieces for every component.
3. If every component is complete, the Verifier approves and the batch enters the Sewing Queue.
4. If any component is short, the Verifier must reject with a written reason and the batch goes back to the Supervisor.
5. A Sewing Supervisor sees only verified batches and starts sewing.

Scope boundary: build only this. No inventory, payroll, reports, extra roles, extra pages, or extra features. Useful is not enough. It must be in scope. Do not overbuild.

## 2. How to work

1. Read this file.
2. Inspect existing code and config.
3. Ask one focused question only if the task is genuinely ambiguous.
4. Write an implementation prompt in `/prompts/NN-feature-name.md`.
5. Ask for approval. Do not touch code before approval.
6. Build exactly to the approved prompt.
7. Run the checks in section 13.
8. If a flaw is found in AI written code (by you or by the user), append it to `AI_LOG.md` (see section 14).
9. Close with a short report: **What I did**, **Test**, **Needs your attention**.

Every implementation prompt must contain: goal, code inspected, decisions and assumptions, expected files, requirements, security considerations, acceptance criteria, checks to run, manual test steps.

Commits are small and atomic, one concern each, with clear messages (`feat: add order multiplier`, `fix: reject decimal counts`). Never batch a whole day into one commit.

## 3. UI rules

There is no design reference. Keep the UI plain, clear, and fully legible.

- Contrast is a zero tolerance defect. Every `input`, `select`, `textarea`, and `option` gets an explicit dark text color and light background, including placeholder, disabled, focus, and hover states.
- Set `color-scheme: light` on the root. Do not rely on OS dark mode or inherited colors.
- Inline error message under each invalid field, shown immediately, in a color with enough contrast.
- Traffic light status must not rely on color alone. Show a text label too (MATCH, EXCESS, SHORTAGE).
- Responsive layout that works on a tablet.
- Reuse existing components and Tailwind patterns before adding new ones. No extra UI libraries.
- Include a visible Role Switcher / Demo Credentials panel on the login screen.

## 4. Roles and permissions

| Role | Can | Cannot |
|---|---|---|
| `cutting_supervisor` | Create orders, edit own orders before verification, submit, resubmit rejected orders, view own orders | Verify, see Sewing Queue |
| `cutting_verifier` | View pending orders, record counts, approve, reject | Create orders, edit recipes, see Sewing Queue |
| `sewing_supervisor` | View verified orders, view audit info, start sewing | See pending, rejected, or in progress cutting orders |

These are enforced on the server. Hidden buttons, disabled buttons, and redirects are not security.

## 5. Stack and what not to use

Use: Next.js App Router, TypeScript, Tailwind, PostgreSQL on Supabase (used only as a database, reached from the server through connection strings), Prisma ORM with the `@prisma/adapter-pg` driver adapter, Zod, `bcryptjs`, `jose` (JWT in an httpOnly cookie), Vitest. Deploy on Vercel.

Prisma connection setup:
- `DATABASE_URL` is the Supabase pooled (transaction pooler, port 6543) string. The app at runtime uses it.
- `DIRECT_URL` is the direct (non pooled) string. `prisma.config.ts` uses it for migrations.
- One shared `PrismaClient` instance in `src/db/client.ts`, created with the adapter. Never create a client per request.
- Check the current Prisma docs for Supabase before writing setup code. Do not rely on memory for config syntax.

Do not:
- Use `supabase-js` or the Supabase Data API for any query. All data access goes through Prisma on the server.
- Trust role, user id, status, or timestamp from a request body, query string, or localStorage.
- Store plain text passwords.
- Add a separate backend framework.
- Use SQLite for the deployed app.
- Add auth libraries or UI kits unless the user approves.
- Put secrets in client components or commit `.env`.

## 6. Decisions already made

Build to these. Do not decide them again.

- Order statuses: `CUTTING_IN_PROGRESS`, `PENDING_VERIFICATION`, `REJECTED`, `VERIFIED`, `IN_SEWING`.
- Allowed transitions only:
  - `CUTTING_IN_PROGRESS → PENDING_VERIFICATION` (Supervisor submits)
  - `PENDING_VERIFICATION → VERIFIED` (Verifier approves)
  - `PENDING_VERIFICATION → REJECTED` (Verifier rejects with reason)
  - `REJECTED → PENDING_VERIFICATION` (Supervisor resubmits after recutting)
  - `VERIFIED → IN_SEWING` (Sewing Supervisor starts)
  - Everything else returns 409.
- Expected component qty = `target_qty × pieces_per_garment`.
- Traffic light, computed on the server: `actual == expected` GREEN, `actual > expected` YELLOW, `actual < expected` RED.
- Expected fabric = `std_fabric_yards × target_qty`.
- Wastage % = `((actual_fabric_yds − expected_fabric) ÷ expected_fabric) × 100`, stored with two decimals. Show it against the recipe wastage cap in the UI. The spec does not say to block on it, so do not block.
- Seed recipes: REC-BL01 Casual Blouse (1.8 yds, cap 5.0%) and REC-CT02 Crop Top (1.1 yds, cap 8.0%) with the exact components in the spec.
- Seed three demo users, one per role.
- `verification_logs` rows are insert only. No update or delete route exists for them.

## 7. Data model

Tables: `users`, `recipes`, `recipe_components`, `cutting_orders`, `verification_items`, `verification_logs`. Fields and relations are exactly as in the assessment spec, section 8. Add only what is needed (for example `submitted_at`, `sewing_started_by`).

- `verification_items.status` is derived on the server from expected and actual. Never accept it from the client.
- Add database constraints: `target_qty > 0`, `actual_qty >= 0`, status enums, foreign keys, unique `order_no`.
- Optional hardening: a database trigger that blocks updates and deletes on `verification_logs`.
- The Prisma schema cannot express CHECK constraints, triggers, or Row Level Security. Generate the migration with `prisma migrate dev --create-only`, then add that SQL by hand to the migration file. Enable RLS on every table with no policies, so the Supabase Data API cannot read them. The server connection is unaffected.
- Define enums for order status, verification item status, and decision in `schema.prisma`.

## 8. API contract

All routes read identity from the session cookie. Order of checks: authenticate (401), authorize role (403), validate input (422), check state (409), check business rule (422).

| Route | Role | Notes |
|---|---|---|
| `POST /api/auth/login` | public | Sets httpOnly cookie |
| `GET /api/recipes` | any logged in | |
| `POST /api/orders` | cutting_supervisor | Validates, derives expected counts |
| `POST /api/orders/:id/submit` | cutting_supervisor (owner) | CUTTING_IN_PROGRESS or REJECTED → PENDING_VERIFICATION |
| `GET /api/orders` | supervisor: own; verifier: pending only | Sewing role gets 403 |
| `PUT /api/orders/:id/counts` | cutting_verifier | Saves counts, server computes colors |
| `POST /api/orders/:id/approve` | cutting_verifier | 422 if any component RED, missing, or uncounted |
| `POST /api/orders/:id/reject` | cutting_verifier | 422 if note is empty or whitespace |
| `GET /api/sewing/queue` | sewing_supervisor | `WHERE status = 'VERIFIED'` in the query, ignores all params |
| `GET /api/sewing/orders/:id` | sewing_supervisor | 404 unless status is VERIFIED |
| `POST /api/sewing/orders/:id/start` | sewing_supervisor | VERIFIED → IN_SEWING |

## 9. Server rules that cannot be bypassed

1. One function owns state changes (for example `transitionOrder`). Every route calls it. No route updates `status` directly.
2. Approval re-reads counts from the database and recomputes every status. It never trusts what the client displayed.
3. Approval fails with 422 if any component is RED, has no count row, or is uncounted.
4. Approve, reject, and start run inside a transaction with a row lock, so two clicks cannot double process an order. With Prisma: use an interactive `prisma.$transaction(async (tx) => { ... })` and lock the order row with `tx.$queryRaw` using `SELECT ... FOR UPDATE`, because Prisma has no built in row lock.
5. `verifier_id` and timestamps come from the session and the server clock only.
6. On approval, write the verification log (verifier id, timestamp, variances, wastage %) in the same transaction as the status change.
7. Sewing endpoints filter by `VERIFIED` in SQL. Detail routes by id also check status, so guessing ids leaks nothing.
8. Ownership: a supervisor cannot read or edit another supervisor's order by id.

## 10. Input validation

Validate with Zod on the server. Mirror the same rules on the client for inline errors, but the server is the authority.

- `target_qty` and all piece counts: whole numbers only. Reject negatives, decimals, non numeric strings, empty values. Counts may be `0` (a real shortage). `target_qty` must be at least 1.
- `actual_fabric_yds`: positive number, decimals allowed (it is yards).
- `fabric_roll_id`: required, trimmed, bounded length.
- `rejection_note`: required, trimmed, minimum length (for example 5 characters).
- Empty body, wrong types, and extra fields return 422 with field level messages.

## 11. Tests required (Vitest, run with `npm test`)

1. All GREEN order is approved by a Verifier.
2. Order with at least one RED component is blocked (422).
3. Reject without a note is rejected (422).
4. Supervisor and Sewing roles get 403 on approve.
5. Unapproved orders never appear in the sewing queue query.

Also cover: unauthenticated 401, invalid transition 409, uncounted component blocks approval, YELLOW still approves, decimal and negative counts rejected, client supplied `verifier_id` ignored, double approve is safe.

## 12. Things that will trip you up

- `Number("")` is `0`. `parseInt("5.7")` is `5`. Use strict checks: regex or `Number.isInteger` on the parsed value, and reject empty strings first.
- Inputs inheriting light text in dark mode cause white on white. Set colors explicitly.
- A disabled Approve button proves nothing. Test the endpoint with curl.
- Missing count rows look like "no RED" if you only filter for RED. Compare against the full component list.
- Do not filter the sewing queue in JavaScript after fetching. Filter in SQL.
- Do not return password hashes from any endpoint.
- Seed script must be safe to run twice (use `upsert`).
- Prisma returns `Decimal` objects for decimal columns (fabric yards, wastage). Convert to numbers or strings before sending JSON, and never compare them with `===`.
- `prisma generate` must run before build and on Vercel. Add it to the `build` script or a `postinstall` script.
- `prisma migrate` needs `DIRECT_URL`. The running app needs the pooled `DATABASE_URL`. Mixing them up gives connection errors or hangs.
- Prisma query results are typed, but request bodies are not. Zod still validates every input before it reaches Prisma.

## 13. Checks to run

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Manual: log in as each role, run the evaluator checklist (contrast, RBAC, shortage hard stop, sewing handoff, refresh persistence).
- curl: supervisor token on approve returns 403; order with a RED item on approve returns 422; sewing queue with `?status=PENDING_VERIFICATION` still returns only VERIFIED.
- Report real output. Never claim a check passed without running it.

## 14. AI report log

Keep `AI_LOG.md` as work happens. For each flaw: what the AI produced, why it was wrong, the commit that fixed it. This feeds `AI_OPTIMIZATION_REPORT.md` (tools and prompting, flawed AI code with at least 2 examples, human refactoring, defensive architecture).

## 15. When in doubt

- Keep it small.
- Server decides, client displays.
- Keep secrets server side.
- Stay inside the scope in section 1.
- Write the prompt, get approval, then code.
- Run the checks and share exact test steps.
