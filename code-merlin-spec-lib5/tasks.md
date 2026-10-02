# Tasks

- Work item: LIB-5 (db91423c-44a6-4d6a-abe3-21f0cb869b9d)
- Category: tasks
- Version: 394fc64e-4267-4a58-8c51-bfb9736f6ab2
- Approval status: approved
- Approved at: 2026-10-02T09:15:13.418Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T09:16:05.241Z
- Source: https://staging.codemerlin.ai/work-items/db91423c-44a6-4d6a-abe3-21f0cb869b9d?tab=tasks

# Tasks

## matejamilosevic/library

### Task 1: Preserve member account registration via POST /signup with durable storage
- Kind: Coverage Deferral
- Done when:
  - FR-001 is already satisfied in the repository (`src/http.ts` routes `POST /signup`, `src/members.ts` persists member accounts in `accounts.json` with scrypt hashing).

### Task 2: Preserve member account creation success criteria
- Kind: Coverage Deferral
- Done when:
  - SC-001 is already satisfied in the repository (patrons can register new accounts via `POST /signup` and receive HTTP 201 Created).

### Task 3: Define session, sign-in credentials, and rate-limiting domain types
- Done when:
  - Add `SignInCredentials` type (`username: string; password: string`) in `src/types.ts` (FR-002)
  - Add `SessionToken` type (`string`) and `Session` model (`token: string; accountId: string; username: string; createdAt: string; expiresAt: string`) in `src/types.ts` (FR-003, FR-008)
  - Add `RateLimitEntry` type in `src/types.ts` (FR-009)
  - Export new domain types from `src/index.ts`
  - `npm run typecheck` succeeds without compilation errors

### Task 4: Propagate request headers to handleRequest in HTTP server
- Done when:
  - Update `handleRequest` call site in `src/server.ts` to pass incoming HTTP request headers (`req.headers`) so `Authorization: Bearer <session-token>` reaches route dispatchers (FR-005)
  - Ensure `startServer` continues to parse JSON bodies while forwarding headers to `handleRequest`

### Task 5: [US2] Implement credential verification and session generation for POST /signin
- Done when:
  - Add `verifyCredentials(username: string, password: string)` in `src/members.ts` using `scryptSync` and timing-safe comparison (`crypto.timingSafeEqual`) against the stored password hash (FR-004)
  - Add ephemeral `sessionsByToken` in-memory store in `src/members.ts` with `createSession(account: MemberAccount)` generating 64-character hexadecimal random tokens via `randomBytes(32)` and 24-hour expiration TTL (FR-003, SC-002)
  - Add `POST /signin` route in `src/http.ts` that validates incoming JSON payload (`username`, `password`), returning HTTP status 400 with `{ "error": "missing_username_or_password" }` for missing/blank credentials or `{ "error": "invalid_json" }` for malformed non-JSON payloads
  - Successful sign-in returns HTTP status 200 OK with `{ "token": "...", "account": { "id": "...", "username": "...", "createdAt": "..." } }` (AC-003, FR-002, FR-003, SC-002)
  - Mismatched password or unknown username returns HTTP status 401 Unauthorized with generic failure `{ "error": "invalid_credentials" }` (AC-004, FR-004, SC-004)
  - Export session inspection helper `getSession` and test reset helper `resetSessionsForTests` from `src/members.ts` and `src/index.ts`

### Task 6: [US3] Implement session revocation for POST /signout
- Done when:
  - Update `handleRequest(method: string, pathname: string, body?: unknown, headers?: Record<string, string | string[] | undefined>)` in `src/http.ts` to inspect incoming `Authorization` header
  - Add `revokeSession(token: string): boolean` in `src/members.ts` that removes the session token from ephemeral memory (FR-006, SC-003)
  - Add `POST /signout` endpoint in `src/http.ts` requiring header `Authorization: Bearer <session-token>` (FR-005)
  - Valid active session token is revoked and returns HTTP status 200 OK with `{ "ok": true }` (AC-005, FR-005, FR-006, SC-003)
  - Missing, unparseable, malformed, unknown, or previously revoked session tokens return HTTP status 401 Unauthorized with `{ "error": "unauthorized" }` (AC-006, FR-005, FR-006, SC-003)
  - Export `revokeSession` from `src/index.ts`

### Task 7: [US4] Enforce session TTL expiration and ephemeral in-memory restart invalidation
- Done when:
  - In `src/members.ts`, enforce 24-hour expiration TTL in `getSession(token: string)` such that sessions past `expiresAt` are purged and treated as invalid, returning undefined (FR-007, AC-007)
  - Ensure all session records reside strictly in `sessionsByToken` in-memory map without disk persistence so that process reload/restart clears all sessions while `accounts.json` remains intact (FR-008, SC-006, AC-008)
  - When an expired or cleared token is presented to authenticated endpoints (e.g. `POST /signout`), return HTTP status 401 Unauthorized with `{ "error": "unauthorized" }` (AC-007, AC-008, FR-007, FR-008, SC-006)

### Task 8: [US5] Implement 15-minute sliding window rate limiting for failed sign-ins
- Done when:
  - In `src/members.ts`, implement in-memory tracking of consecutive failed sign-in timestamps keyed by normalized lowercase trimmed username (FR-009, SC-005)
  - In `checkRateLimit(username: string)`, evaluate attempts within a 15-minute (900,000 ms) window: if 5 or more failed attempts occurred, block the request before credential verification with HTTP status 429 Too Many Requests and `{ "error": "rate_limited" }` (AC-009, AC-010, FR-009, SC-005)
  - In `recordFailedSignIn(username: string)`, append current timestamp to the failure list for that username on incorrect credentials or unknown username (FR-009)
  - In `clearRateLimit(username: string)`, reset accumulated failed attempts to zero upon successful sign-in (FR-010, AC-009)
  - Integrate rate limit check and recording into `POST /signin` handler in `src/http.ts`
  - Export `resetRateLimitsForTests` from `src/members.ts` and `src/index.ts`

### Task 9: Verify member account registration scenarios 1, 2, and 3
- Kind: Coverage Deferral
- Done when:
  - Scenarios 1, 2, and 3 test member registration via POST /signup, which is already satisfied in the repository under FR-001 / SC-001 in `src/http.ts` and `src/members.ts`.

### Task 10: Verify patron sign-in authentication scenarios 4, 5, and 6
- Kind: Repo Validation
- Done when:
  - Verify scenario 4: Successful patron sign-in with valid credentials returns 200 OK with 64-hex-char bearer session token in `src/http.ts`
  - Verify scenario 5: Invalid credentials (wrong password or unknown username) consistently return 401 Unauthorized with `{ "error": "invalid_credentials" }` in `src/http.ts` and `src/members.ts`
  - Verify scenario 6: Missing username/password or malformed JSON on sign-in returns 400 Bad Request in `src/http.ts`

### Task 11: Verify patron sign-out and header authorization scenarios 7, 8, and 9
- Kind: Repo Validation
- Done when:
  - Verify scenario 7: Successful sign-out presenting valid `Authorization: Bearer <token>` revokes session and returns 200 OK with `{ "ok": true }` in `src/http.ts` and `src/members.ts`
  - Verify scenario 8: Rejection of revoked or unknown session token on sign-out returns 401 Unauthorized with `{ "error": "unauthorized" }` in `src/http.ts`
  - Verify scenario 9: Missing or malformed Authorization header (e.g. Basic auth, empty bearer) returns 401 Unauthorized with `{ "error": "unauthorized" }` in `src/http.ts`

### Task 12: Verify session TTL expiration and server restart invalidation scenarios 10 and 11
- Kind: Repo Validation
- Done when:
  - Verify scenario 10: Session older than 24 hours is rejected as expired with 401 Unauthorized and purged from memory in `src/members.ts`
  - Verify scenario 11: Server restart clears active in-memory sessions while registered accounts in `accounts.json` remain intact and functional via `src/server.ts` and `src/members.ts`

### Task 13: Verify sign-in rate limiting and counter reset scenarios 12, 13, and 14
- Kind: Repo Validation
- Done when:
  - Verify scenario 12: 5 consecutive failed sign-in attempts within 15 minutes trigger 429 Too Many Requests with `{ "error": "rate_limited" }` on subsequent attempts in `src/members.ts` and `src/http.ts`
  - Verify scenario 13: Sign-in rate limiter blocks valid password submissions with 429 during cooldown without verifying credentials
  - Verify scenario 14: Successful sign-in resets accumulated failed attempts counter to zero

### Task 14: Verify end-to-end patron registration, authentication, signout, and restart lifecycle scenario 15
- Kind: Repo Validation
- Done when:
  - Verify scenario 15: Full patron lifecycle through running HTTP server instance in `src/server.ts` and `src/http.ts` across registration, signin, signout, and restart
  - Entire test suite `npm test` passes with zero regressions across catalog, holds, loans, and reservations
