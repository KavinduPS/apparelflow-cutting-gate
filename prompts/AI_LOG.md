Prisma setup flaws (AI suggested setup commands and config)

- Install command omitted @prisma/client, then the prisma CLI (6.19.3) and client (7.10.0) ended up on different majors. Generated code imported a runtime path that does not exist in 7.x. Fix: pinned prisma, @prisma/client and @prisma/adapter-pg to the same version, deleted src/generated, regenerated.
- Suggested config kept `url = env("DATABASE_URL")` in schema.prisma, which Prisma 7 rejects (P1012). Fix: removed it, URLs live in prisma.config.ts (DIRECT_URL) and the PrismaPg adapter (DATABASE_URL).
- Suggested the Direct connection string for migrations. It is IPv6 only and unreachable from my network. Fix: used the Session pooler string.
