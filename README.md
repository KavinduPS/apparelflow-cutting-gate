# ApparelFlow Cutting Gatekeeper

A small web app for a garment factory. Cut fabric pieces must be counted and approved by a verifier before the batch can go to the sewing floor.

**Live demo:** https://apparelflow-cutting-gate.vercel.app

## Demo credentials

All three users share one demo password: `Demo@1234`

| Role               | Email                         | What they can do                                                                      |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------------- |
| Cutting Supervisor | `supervisor@apparelflow.test` | Create cutting orders, submit them for verification, fix and resubmit rejected orders |
| Cutting Verifier   | `verifier@apparelflow.test`   | Count pieces for each component, approve or reject a batch                            |
| Sewing Supervisor  | `sewing@apparelflow.test`     | See verified batches only, read the verification details, start sewing                |

The login page also has one-click buttons for each role.

## How it works

```
CUTTING_IN_PROGRESS -> PENDING_VERIFICATION -> VERIFIED -> IN_SEWING
                              |
                           REJECTED (reason required) -> back to the supervisor
```

1. The supervisor picks a recipe, a quantity, a fabric roll and the fabric used. The system works out how many pieces of each component are expected (for example 50 blouses x 2 cuffs = 100 cuffs).
2. The verifier counts the real pieces. Each component shows a traffic light:
   - **Green:** count matches
   - **Yellow:** more than expected
   - **Red:** fewer than expected
3. If any component is red, approval is blocked. The verifier can only reject, with a written reason.
4. An approved batch moves to the sewing queue with who verified it, when, the counts, and the fabric wastage.

Fabric wastage % = (actual fabric used - expected fabric) / expected fabric x 100

## Architecture summary

| Part            | Choice                                                         |
| --------------- | -------------------------------------------------------------- |
| App             | Next.js (App Router) with TypeScript and Tailwind              |
| API             | Next.js route handlers under `src/app/api`                     |
| Database        | PostgreSQL on Supabase                                         |
| Database access | Prisma                                                         |
| Validation      | Zod                                                            |
| Login           | Signed JWT in an httpOnly cookie, passwords hashed with bcrypt |
| Tests           | Vitest                                                         |
| Hosting         | Vercel                                                         |

```
src/
  app/           Pages (login, supervisor, verifier, sewing) and API routes
  components/    Shared UI pieces
  lib/
    auth.ts      Session and role check used by every API route
    domain/      Pure business rules (expected quantities, traffic light, wastage)
    validation/  Zod schemas for request bodies
  db/            Prisma client
prisma/          Schema, migrations, seed script
prompts/         Step by step plan files used while building
```

**Rules the server enforces** (the UI is never trusted):

- Every API route checks the signed session and the user's role. The role is read from the database. A wrong role gets `403`.
- Only the verifier can approve or reject. Approving with a red, missing or uncounted component returns `422`.
- Rejecting without a reason is refused.
- The sewing queue query only returns orders with status `VERIFIED`.
- The verifier and the time of the decision come from the session and the server clock, never from the request.
- The verification log is written in the same transaction as the status change and cannot be edited afterwards.
- Request bodies are strict: unknown fields, negative numbers, decimals for counts and empty values are rejected.

## Database schema

| Table                | Purpose                                   | Main columns                                                                                                                           |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | Login accounts                            | `id`, `email`, `password_hash`, `role`, `full_name`, `created_at`                                                                      |
| `recipes`            | Garment designs (bill of materials)       | `id`, `recipe_code`, `name`, `category`, `std_fabric_yards`, `wastage_cap`                                                             |
| `recipe_components`  | Cut parts of a recipe                     | `id`, `recipe_id`, `component_name`, `pieces_per_garment`, `image_url`                                                                 |
| `cutting_orders`     | One cutting batch                         | `id`, `order_no`, `recipe_id`, `target_qty`, `fabric_roll_id`, `actual_fabric_yds`, `status`, `created_by`, `created_at`, `updated_at` |
| `verification_items` | Expected and counted pieces per component | `id`, `order_id`, `component_id`, `expected_qty`, `actual_qty`, `status`                                                               |
| `verification_logs`  | Permanent record of each decision         | `id`, `order_id`, `verifier_id`, `decision`, `rejection_note`, `wastage_pct`, `variances`, `timestamp`                                 |

**Relations**

- A recipe has many components and many orders.
- An order belongs to one recipe and one supervisor (`users`), and has many verification items and logs.
- A verification item links one order to one recipe component. Each pair appears once.
- A verification log belongs to one order and one verifier (`users`).

**Enums**

- Role: `cutting_supervisor`, `cutting_verifier`, `sewing_supervisor`
- Order status: `CUTTING_IN_PROGRESS`, `PENDING_VERIFICATION`, `REJECTED`, `VERIFIED`, `IN_SEWING`
- Item status: `GREEN`, `YELLOW`, `RED` (empty until counted)
- Decision: `APPROVED`, `REJECTED`

**Database level protection** (in the migration, not only in code):

- Checks: quantities above zero, counts zero or more, a rejection must have a note.
- `verification_logs` rows cannot be updated or deleted.
- `variances` is a JSON snapshot of the counts at decision time, so the audit record stays correct even if the item rows are reset when a rejected order is resubmitted.

**Seed data:** two recipes, `REC-BL01` Casual Blouse (1.8 yds per piece, 5% wastage cap) and `REC-CT02` Crop Top (1.1 yds per piece, 8% wastage cap), with their components, plus the three demo users.

## API routes

| Method and path                        | Who                | Purpose                                           |
| -------------------------------------- | ------------------ | ------------------------------------------------- |
| `POST /api/auth/login`                 | Anyone             | Sign in                                           |
| `POST /api/auth/logout`                | Signed in          | Sign out                                          |
| `GET /api/recipes`                     | Signed in          | Recipes and components for the order form         |
| `GET /api/orders`                      | Cutting Supervisor | List orders                                       |
| `POST /api/orders`                     | Cutting Supervisor | Create an order                                   |
| `POST /api/orders/:id/submit`          | Cutting Supervisor | Send an order to the verifier                     |
| `POST /api/orders/:id/resubmit`        | Cutting Supervisor | Return a rejected order to the cutting step       |
| `GET /api/orders/pending-verification` | Cutting Verifier   | Orders waiting for counts                         |
| `POST /api/orders/:id/verification`    | Cutting Verifier   | Approve or reject with the counted quantities     |
| `GET /api/orders/sewing-queue`         | Sewing Supervisor  | Verified orders with counts, verifier and wastage |
| `POST /api/orders/:id/start-sewing`    | Sewing Supervisor  | Move a verified order into sewing                 |

Errors use one shape: `{ "error": "message" }`, with `fields` when specific inputs are wrong.
Status codes: `401` not signed in, `403` wrong role, `404` not found, `409` order is in the wrong state, `422` invalid input or a rule blocks the action.

## Run it locally

1. Install Node.js 22 or newer and create a PostgreSQL database (a free Supabase project works).
2. Create a `.env` file **before** installing (the install step generates the Prisma client and needs these values). Copy `.env.example` and fill in:
   ```
   DATABASE_URL=   pooled connection string (transaction pooler, port 6543)
   DIRECT_URL=     session pooler or direct connection string (port 5432), used for migrations
   JWT_SECRET=     a random string of 32 characters or more
   ```
3. Run:
   ```
   npm install
   npx prisma migrate deploy
   npm run seed
   npm run dev
   ```
4. Open http://localhost:3000 and sign in with a demo user.

## Tests

```
npm test
```

Covers: all-green approval, red components blocking approval, rejection without a note, wrong roles getting `403`, the sewing queue returning only verified orders, and input validation.
