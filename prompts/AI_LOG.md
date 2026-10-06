Prisma setup flaws (AI suggested setup commands and config)

- Install command omitted @prisma/client, then the prisma CLI (6.19.3) and client (7.10.0) ended up on different majors. Generated code imported a runtime path that does not exist in 7.x. Fix: pinned prisma, @prisma/client and @prisma/adapter-pg to the same version, deleted src/generated, regenerated.
- Suggested config kept `url = env("DATABASE_URL")` in schema.prisma, which Prisma 7 rejects (P1012). Fix: removed it, URLs live in prisma.config.ts (DIRECT_URL) and the PrismaPg adapter (DATABASE_URL).
- Suggested the Direct connection string for migrations. It is IPv6 only and unreachable from my network. Fix: used the Session pooler string.

Auth and client component bundling flaws:

- Client component (`src/app/login/login-form.tsx`) imported `getRoleLandingPath` from `src/lib/auth.ts`. Because `auth.ts` imported `@/db/client` (which uses `@prisma/adapter-pg` and Node `pg`), Turbopack attempted to bundle Node native modules (`net`, `tls`, `fs`) into client bundle, causing build failure. Fix: decoupled client navigation mapping in `login-form.tsx` and eliminated server module imports from client components.

Planning API endpoints

Handling what happens in supervisor workspace when a order is rejected by verifier
