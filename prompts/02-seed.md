# Prompt 02: Seed data

Status: APPROVED and IMPLEMENTED.

## Goal

Add a seed script that fills the database with the two production recipes (with their components) and three demo users, one per role, so the evaluator can test everything immediately. The script must be safe to run more than once.

Out of scope: login, sessions, API routes, UI.

## Skills read and code inspected

- `AGENTS.md` (sections 5, 6, 12)
- Assessment spec sections 5 and 7.1
- `prisma/schema.prisma` (final field names), `prisma.config.ts`, `src/db/client.ts`
- Current Prisma 7 docs on seeding (check how the seed command is configured in `prisma.config.ts` before writing it)

## Decisions and assumptions

1. **Recipes and components are exactly as in spec section 7.1.** No extra recipes, no renamed parts.
2. **Idempotent seeding.** Running the script twice must not create duplicates.
   - Recipes: `upsert` by `recipe_code`.
   - Users: `upsert` by `email`.
   - Components: the schema has no unique key on (recipe, component name), so the script looks each one up by recipe and name, then updates it if found or creates it if missing. It never deletes components, because order items will reference them later.
3. **Demo users** use the `.test` email domain so they can never be real addresses. All three share one demo password, stored only as a bcrypt hash in the database. The plain demo password is written in the README on purpose, because the spec requires visible demo credentials. It must never be reused anywhere else.
4. **The seed script connects with `DIRECT_URL`** (session pooler), through the `PrismaPg` adapter, because it runs from the developer machine like a migration.
5. **Run command:** `npm run seed`, which calls `tsx prisma/seed.ts`. If Prisma 7 requires the seed command to be registered in `prisma.config.ts`, register it there as well.
6. **Pieces per garment are whole numbers** and match the spec exactly.

## Data

**Recipe A**
- Code `REC-BL01`, name `Casual Blouse`, category `Blouse`
- Standard fabric 1.8 yards per piece, wastage cap 5.0
- Components: Front Body Panel 1, Back Body Panel 1, Sleeves (Left & Right) 2, Collar & Stand 1, Sleeve Cuffs 2

**Recipe B**
- Code `REC-CT02`, name `Crop Top`, category `Crop Top`
- Standard fabric 1.1 yards per piece, wastage cap 8.0
- Components: Front Chest Panel 1, Back Support Panel 1, Neck Binding Strip 1, Hem Elastic Casing 1, Side Strap Accents 2

**Users**

| Role | Email | Full name |
|---|---|---|
| `cutting_supervisor` | `supervisor@apparelflow.test` | Cutting Supervisor |
| `cutting_verifier` | `verifier@apparelflow.test` | Cutting Verifier |
| `sewing_supervisor` | `sewing@apparelflow.test` | Sewing Supervisor |

Demo password for all three: `Demo@1234`, hashed with bcrypt (cost 10 or higher) before saving.

## Expected files

- `prisma/seed.ts` (new)
- `package.json` (add the `seed` script)
- `prisma.config.ts` (only if Prisma 7 needs the seed command registered there)

Nothing else changes.

## Requirements

- No plain text password is written to the database, to logs, or to any output.
- The script prints a short summary at the end: how many recipes, components, and users exist.
- The script exits with a non zero code if anything fails.
- The script disconnects the Prisma client when it finishes.
- Use the same field names as `schema.prisma`. If a name does not match, stop and report it instead of guessing.

## Security considerations

- Only the bcrypt hash is stored in `users.password_hash`.
- The demo password is a demo only. The README must say so.
- The script reads `DIRECT_URL` from `.env` and does not log it.

## Acceptance criteria

1. `npm run seed` completes with no errors.
2. Running `npm run seed` a second time completes with no errors and the counts do not change: 2 recipes, 10 components, 3 users.
3. Supabase Table Editor shows the correct recipes, components, and users.
4. `users.password_hash` values start with `$2` (bcrypt) and contain no readable password.
5. REC-BL01 has 5 components and REC-CT02 has 5 components, with the exact names and quantities above.

## Checks to run

```
npm run seed
npm run seed
npm run lint
npm run build
```

Report the real output of each.

## Manual test steps

1. Open Supabase, Table Editor, `recipes`: two rows with the right yards and caps.
2. Open `recipe_components`: ten rows. Spot check that Sleeve Cuffs is 2 for the blouse and Side Strap Accents is 2 for the crop top.
3. Open `users`: three rows with the three roles and long hashed values in `password_hash`.
4. Run the seed a third time and confirm the row counts did not grow.

## Commit

`feat: seed recipes and demo users`

Then add any AI mistakes found during this step to `AI_LOG.md`.