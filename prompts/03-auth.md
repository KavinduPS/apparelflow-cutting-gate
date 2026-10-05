# Prompt 03: Login, session, and role guard

Status: APPROVED and IMPLEMENTED.

## Goal

Add real authentication and the server side role guard that every later API route will use. Add a minimal login page with the demo credentials panel the spec requires, plus three empty landing pages (one per role) so each persona can be tested.

Out of scope: order creation, verification, sewing logic, any real role screens.

## Skills read and code inspected

- `AGENTS.md` (sections 3, 4, 5, 8, 9, 10, 12)
- Assessment spec sections 5 and 9
- `prisma/seed.ts`, `src/db/client.ts`, `prisma/schema.prisma`
- Next.js docs inside `node_modules/next/dist/docs` (or the current official docs). Check how `cookies()` works in the installed version before writing any cookie code. In recent versions it is async.

## Decisions and assumptions

1. **Session is a signed JWT (HS256, `jose`) in an httpOnly cookie** named `af_session`. It carries only the user id (`sub`) and an expiry of 8 hours.
2. **The role is never read from the token.** After verifying the token, the guard loads the user from the database by id and uses the role stored there. A tampered, expired, or orphaned token gives 401.
3. **Cookie flags:** `httpOnly`, `sameSite: "lax"`, `path: "/"`, `secure` when `NODE_ENV` is production.
4. **No middleware.** Pages are server components that call the session helper and `redirect()`. Redirects are a convenience only. Every API route checks the role itself.
5. **One guard helper** in `src/lib/auth.ts` is the only way routes get the current user. Routes never read cookies directly.
6. **Role landing pages:** `/supervisor`, `/verifier`, `/sewing`. Each shows the user's name, role, and a logout button, nothing more. Opening another role's page redirects to that user's own page.
7. **Demo credentials panel on the login page** with three buttons, one per persona. Clicking one signs in as that user through the normal login endpoint. This is the spec's "Role Switcher / Demo Credential Panel". It also shows the three emails and the demo password in plain text on screen.
8. **No rate limiting, no password reset, no registration.** Not in the spec.
9. **Generic login errors.** A wrong email and a wrong password return the same message and status.

## Expected files

- `src/lib/auth.ts` (token sign and verify, `getSessionUser`, `requireRole`)
- `src/lib/validation/auth.ts` (Zod schema for login)
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/login/page.tsx` and one small client component for the form and demo buttons
- `src/app/page.tsx` (redirect to the user's landing page, or to `/login`)
- `src/app/supervisor/page.tsx`, `src/app/verifier/page.tsx`, `src/app/sewing/page.tsx`
- `vitest.config.ts` and `src/lib/auth.test.ts`
- `.env.example` (confirm `JWT_SECRET` is listed)

Nothing else changes.

## Requirements

**Login endpoint `POST /api/auth/login`**
- Validate the body with Zod: `email` (valid format, trimmed, lowercased) and `password` (non empty string). Invalid input returns 422 with field messages.
- Look up the user by email. Compare the password with `bcrypt.compare`. If the user does not exist, still run a `bcrypt.compare` against a fixed dummy hash, so response time does not reveal which emails exist.
- Wrong email or password returns 401 with the message "Invalid email or password".
- Success sets the cookie and returns `{ id, fullName, role }`. Never return `passwordHash`. Select only the fields needed.

**Logout endpoint `POST /api/auth/logout`** clears the cookie and returns 200.

**Guard helper (`src/lib/auth.ts`)**
- `getSessionUser()`: reads the cookie, verifies the token, loads the user, returns the user or `null`.
- `requireRole(allowed: Role[])`: returns `{ ok: true, user }` on success, or `{ ok: false, response }` where `response` is 401 when there is no valid session and 403 when the role is not allowed. Routes use it like this:
  ```ts
  const auth = await requireRole(["cutting_verifier"]);
  if (!auth.ok) return auth.response;
  ```
- The module fails fast with a clear error if `JWT_SECRET` is missing or shorter than 32 characters.

**Login page (UI rules from AGENTS.md section 3)**
- Email and password fields with explicit dark text on a white background, visible labels, visible focus ring, `color-scheme: light`.
- Inline error message under the form on failure.
- Demo panel lists the three personas with a button each. Plain readable text, not color alone.
- Layout works on a tablet width.

**Tests (`src/lib/auth.test.ts`, Vitest)**
1. A token signed with the secret verifies and returns the user id.
2. A token signed with a different secret is rejected.
3. An expired token is rejected.
4. `requireRole` returns 401 when there is no session, 403 when the role is not allowed, and ok when it is.

Mock the database call in these tests. They must run without a network connection.

## Security considerations

- Password hashes never leave the server or appear in any response or log.
- Role comes from the database, not from the cookie or any request body.
- The cookie is httpOnly, so page scripts cannot read it. `sameSite: "lax"` stops other sites from sending it on cross site POST requests.
- The login error does not reveal whether an email exists.
- `JWT_SECRET` is read from the environment and never logged or committed.
- The demo password is public on purpose and is a demo only.

## Acceptance criteria

1. Logging in with each of the three demo users lands on that role's page and shows the right name and role.
2. A wrong password and an unknown email both return the same 401 response.
3. After logout, opening `/supervisor` redirects to `/login`.
4. With curl, a request with no cookie to any page guarded by the helper gets 401 or a redirect, never data.
5. Editing the cookie value by hand makes the session invalid.
6. The login form fields are clearly readable in normal and focus states.
7. `npm test` passes the four auth tests.

## Checks to run

```
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Report the real output of each.

## Manual test steps

1. Run `npm run dev` and open `/login`. Click each demo button and confirm the landing page for each role.
2. Log out. Open `/verifier` directly and confirm you are sent to `/login`.
3. Try a wrong password. Confirm the generic error message appears under the form.
4. Log in, open browser dev tools, Application, Cookies. Confirm `af_session` is marked HttpOnly. Change one character of its value and refresh. Confirm you are logged out.
5. Check the contrast of every input in normal, focus, and error states.

## Commit

Use small commits, for example:
- `feat: session token and role guard`
- `feat: login and logout endpoints`
- `feat: login page with demo credentials`
- `test: auth guard unit tests`

Then add any AI mistakes found during this step to `AI_LOG.md`.