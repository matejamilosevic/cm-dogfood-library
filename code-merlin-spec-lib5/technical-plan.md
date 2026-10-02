# Technical plan

- Work item: LIB-5 (db91423c-44a6-4d6a-abe3-21f0cb869b9d)
- Category: technical_plan
- Version: b7ca2a02-2b6e-4a93-b3f8-0699276ead7f
- Approval status: approved
- Approved at: 2026-10-02T09:15:04.479Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T09:16:01.622Z
- Source: https://staging.codemerlin.ai/work-items/db91423c-44a6-4d6a-abe3-21f0cb869b9d?tab=technical_plan

# Technical Plan draft

## Technical approach
## Technical Approach

**Change magnitude: LARGE**

### Current state vs target state

- **Current State**:
  - The library service is a Node.js TypeScript application (`matejamilosevic/library`) providing catalog lookups, checkouts, holds, reservations, and account registration.
  - `src/http.ts` processes incoming HTTP requests via `handleRequest(method, pathname, body)` and implements `POST /signup` for account creation, but does not implement `POST /signin`, `POST /signout`, or request header evaluation for authenticated operations.
  - `src/members.ts` stores member accounts in an in-memory map backed by a durable JSON file (`accounts.json`) using scrypt hashing (`salt:hash`). However, it contains no credential verification logic, no session lifecycle tracking, and no failed sign-in throttling mechanism.
  - `src/server.ts` creates the Node HTTP server and calls `handleRequest(req.method ?? 'GET', url.pathname, body)` without forwarding HTTP headers (such as `Authorization: Bearer <token>`).
  - `src/types.ts` defines domain types for members, books, and registration inputs (`SignupCredentials`), but lacks session and rate limiting definitions.

- **Target State**:
  - `POST /signup` behavior is preserved unchanged, persisting registered user accounts durably in `accounts.json` with scrypt hashing and enforcing case-insensitive username uniqueness (`FR-001`, `SC-001`).
  - `POST /signin` is introduced in `src/http.ts` to accept `username` and `password`. It verifies credentials against the stored scrypt password hash using timing-safe comparison. Upon success, it generates a cryptographically random session token (hex-encoded `randomBytes(32)`), stores the active session in an ephemeral in-memory map with a 24-hour expiration TTL, clears any accumulated rate-limiting failures for that username, and returns `200 OK` with the session token (`FR-002`, `FR-003`, `FR-010`, `SC-002`).
  - Invalid credentials (unknown username or mismatched password) reject with HTTP `401 Unauthorized` and one generic error payload `{ "error": "invalid_credentials" }`, recording a failed attempt against the submitted username (`FR-004`, `SC-004`).
  - In-memory rate limiting tracks failed sign-in attempts by normalized username over a 15-minute sliding window. After 5 consecutive failed attempts, sign-in requests for that username are blocked with HTTP `429 Too Many Requests` (`{ "error": "rate_limited" }`) before credential verification is attempted (`FR-009`, `SC-005`).
  - `POST /signout` is added to `src/http.ts`, authenticating incoming calls via `Authorization: Bearer <session-token>`. Valid requests remove the session from memory and return HTTP `200 OK` (`{ "ok": true }`). Missing, invalid, expired, or previously revoked tokens return HTTP `401 Unauthorized` (`FR-005`, `FR-006`, `SC-003`).
  - Active sessions reside strictly in memory and are never written to disk. On server reload/restart, all active sessions clear while persisted accounts in `accounts.json` remain intact, forcing patrons to sign in again (`FR-007`, `FR-008`, `SC-006`).
  - `src/server.ts` is updated to forward `req.headers` into `handleRequest(method, pathname, body, headers)` so headers can be inspected by route handlers.

### Research decisions

1. **Ephemeral in-memory session store vs. durable session tokens / JWTs**:
   - *Decision*: Use an in-memory `Map<string, Session>` where the key is a 256-bit cryptographically secure random token string (`randomBytes(32).toString('hex')`).
   - *Rationale*: `FR-008` and `SC-006` explicitly mandate that session records reside strictly in memory and clear across server restarts, while registered accounts in `accounts.json` remain intact. JWTs would remain valid across server restarts unless tracked in a blacklist, violating the requirement of zero session persistence.

2. **Password verification using timing-safe comparisons**:
   - *Decision*: In `src/members.ts`, implement `verifyCredentials(username, password)` extracting the 16-byte salt from the stored `passwordHash`, re-computing `scryptSync(password, salt, 32)`, and comparing hashes using `crypto.timingSafeEqual`.
   - *Rationale*: Defends against side-channel timing attacks while maintaining complete compatibility with existing scrypt parameters (`scryptSync(password, salt, 32)`).

3. **Normalized username-keyed rate limiting**:
   - *Decision*: Rate limiting tracks consecutive failed sign-in attempts per normalized username (`usernameKey(username)` = `username.trim().toLowerCase()`). Each entry tracks failed timestamps within 15 minutes (900,000 ms). If the count reaches 5, attempts are blocked with HTTP status 429 until the cooldown elapses.
   - *Rationale*: Aligns with `FR-009` and prevents brute-force attacks against individual patron accounts, regardless of character casing used in failed submissions.

4. **Header propagation via optional parameter in `handleRequest`**:
   - *Decision*: Extend `handleRequest(method: string, pathname: string, body?: unknown, headers?: Record<string, string | string[] | undefined>): HttpResult` in `src/http.ts` and pass `req.headers` from `src/server.ts`.
   - *Rationale*: Keeps `handleRequest` ergonomic for existing unit tests (which call it with 2 or 3 arguments) while enabling real HTTP server instances and integration tests to provide HTTP headers such as `Authorization`.

### Component / module ownership

- **`matejamilosevic/library` (sole package)**:
  - `src/types.ts`: Owns domain models (`Session`, `SessionToken`, `SignInCredentials`, `RateLimitEntry`).
  - `src/members.ts`: Owns account credential verification, in-memory session lifecycle (`createSession`, `getSession`, `revokeSession`, `resetSessionsForTests`), and sign-in rate limiting (`checkRateLimit`, `recordFailedSignIn`, `clearRateLimit`, `resetRateLimitsForTests`).
  - `src/http.ts`: Owns HTTP endpoint routing, parameter validation, header extraction, and error translation for `POST /signin`, `POST /signout`, and `POST /signup`.
  - `src/server.ts`: Owns Node HTTP server lifecycle and forwards incoming HTTP request headers to `handleRequest`.
  - `src/index.ts`: Public API export entry point.
- **Components that must NOT be modified**: `src/catalog.ts`, `src/loans.ts`, `src/holds.ts`, `src/reservations.ts`, and `src/desk.ts`.

### Service interaction patterns

- Synchronous in-process calls: `src/server.ts` parses request headers and body, synchronously delegating to `handleRequest` in `src/http.ts`.
- `src/http.ts` calls `verifyCredentials`, `createSession`, `revokeSession`, and `checkRateLimit` in `src/members.ts`.
- Failure modes:
  - Rate limit triggered: Synchronously returns HTTP 429 without querying member accounts or validating passwords.
  - Unknown user or password mismatch: Synchronously records failed attempt in rate limiter and returns HTTP 401 with `{ "error": "invalid_credentials" }`.
  - Missing/invalid bearer token: Synchronously returns HTTP 401 with `{ "error": "unauthorized" }`.

### Feature-flag keys

- No feature flags exist or are required in this single-tenant in-memory library desk service.

### Multi-tenancy contract

- Single-tenant library desk architecture. Isolation is patron-level: patrons identify themselves by unique username, and active sessions map strictly to the authenticated `MemberAccount.id`. Patrons cannot access or revoke sessions belonging to other accounts.

## Affected components
- **library** (`matejamilosevic/library`) — Add `POST /signin` and `POST /signout` routes in `src/http.ts`, implement ephemeral session tracking and failed sign-in rate limiting in `src/members.ts`, extend domain models in `src/types.ts`, propagate headers from `src/server.ts`, and export auth utilities in `src/index.ts`.

## Affected component allowlist
- `matejamilosevic/library:src/types.ts` (modify) `SignInCredentials, SessionToken, Session, RateLimitEntry`
- `matejamilosevic/library:src/members.ts` (modify) `verifyCredentials, createSession, getSession, revokeSession, checkRateLimit, recordFailedSignIn, clearRateLimit, resetSessionsForTests, resetRateLimitsForTests`
- `matejamilosevic/library:src/http.ts` (modify) `handleRequest`
- `matejamilosevic/library:src/server.ts` (modify) `startServer`
- `matejamilosevic/library:src/index.ts` (modify) `index exports`

## Data model changes
### In-Memory Entities

1. **`Session`** (`src/types.ts`, `src/members.ts`):
   - Stored in ephemeral map `sessionsByToken = new Map<string, Session>()`.
   - Fields:
     - `token`: `string` (primary key, 64-character hex string generated via `randomBytes(32)`).
     - `accountId`: `string` (foreign key pointing to `MemberAccount.id`).
     - `username`: `string` (canonical account username).
     - `createdAt`: `string` (ISO 8601 timestamp).
     - `expiresAt`: `string` (ISO 8601 timestamp, default `Date.now() + 24 * 60 * 60 * 1000`).
   - Lifecycle: Cleared completely on process termination or restart. No persistence artifact.

2. **`RateLimitEntry`** (`src/types.ts`, `src/members.ts`):
   - Stored in ephemeral map `failedAttemptsByUsername = new Map<string, number[]>()`.
   - Fields:
     - Key: `string` (normalized lowercase trimmed username).
     - `timestamps`: `number[]` (timestamps of consecutive failed attempts within 15 minutes).
   - Lifecycle: Ephemeral in-memory only. Cleared on successful sign-in (`FR-010`) or process restart.

### Persistent Entity (Preserved)

- **`MemberAccount`** (`src/members.ts`, `data/accounts.json`):
  - Fields: `id: string`, `username: string`, `passwordHash: string` (`<salt>:<hash>`), `createdAt: string`.
  - Preserved without modification or migration (`FR-001`, `SC-001`).

## API changes
### New and Modified Routes

1. **`POST /signin`** (New):
   - **Contract**: `POST /signin`
   - **Authentication**: None (public credential submission).
   - **Request Body**:
     ```json
     {
       "username": "string",
       "password": "string"
     }
     ```
   - **Response**:
     - `200 OK`:
       ```json
       {
         "token": "string",
         "account": {
           "id": "string",
           "username": "string",
           "createdAt": "string"
         }
       }
       ```
   - **Error Codes**:
     - `400 Bad Request` `{ "error": "missing_username_or_password" }`: username missing, empty, or whitespace-only, or password missing.
     - `400 Bad Request` `{ "error": "invalid_json" }`: malformed request JSON.
     - `401 Unauthorized` `{ "error": "invalid_credentials" }`: unknown username or mismatched password.
     - `429 Too Many Requests` `{ "error": "rate_limited" }`: 5 or more failed sign-in attempts within 15 minutes for the requested username.

2. **`POST /signout`** (New):
   - **Contract**: `POST /signout`
   - **Authentication**: `Authorization: Bearer <session-token>` header required.
   - **Request Body**: None (ignored if provided).
   - **Response**:
     - `200 OK`:
       ```json
       {
         "ok": true
       }
       ```
   - **Error Codes**:
     - `401 Unauthorized` `{ "error": "unauthorized" }`: header missing, malformed (not starting with `Bearer `), or session token unknown / expired / already revoked.

3. **`POST /signup`** (Preserved):
   - **Contract**: `POST /signup`
   - **Authentication**: None.
   - **Request Body**: `{ "username": "string", "password": "string" }`
   - **Response**: `201 Created` with `{ "account": { "id": "string", "username": "string", "createdAt": "string" } }`.
   - **Error Codes**: `400 missing_username_or_password`, `400 invalid_json`, `409 username_already_taken`.

## Migration / rollout
1. **Rollout Sequence**:
   - This is an in-memory single-process service without an external database or feature gate flag.
   - Phase 1: Deploy code changes containing updated `src/types.ts`, `src/members.ts`, `src/http.ts`, and `src/server.ts`.
   - Phase 2: Start server process. `src/server.ts` calls `initializeAccountStore()`, loading existing durable accounts from `accounts.json`.
   - Phase 3: In-memory session and rate-limit maps initialize empty. All prior sessions are invalid by design (`FR-008`, `SC-006`), requiring users to sign in.

2. **Rollback Strategy**:
   - Revert application binaries/code to the previous release.
   - The durable file `accounts.json` retains the identical schema (`id`, `username`, `passwordHash`, `createdAt`) used before the change, ensuring zero rollback data loss.

## Operational considerations
- **Observability & Logging**:
  - Standard error logging for failed sign-ins, rate limit activations (`WARN rate limit triggered for user: <username>`), and persistence errors.
  - Avoid logging plain-text passwords or full bearer session tokens to `process.stdout`/`process.stderr`.
- **Background Processing**:
  - Lazy cleanup of expired sessions: expired sessions are rejected and pruned upon inspection in `getSession(token)`.
  - Periodic cleanup or sliding-window eviction of stale rate limiter timestamps older than 15 minutes.
- **Process Restart Semantics**:
  - Ephemeral session maps reset naturally when Node.js restarts. No tmp file cleanup is required.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/library | Yes | Single deployable service hosting library desk API, member store, session lifecycle, and sign-in rate limiting. | 1 |

## Repository scope
The entire change is confined to single repository `matejamilosevic/library`. No cross-repository coordination or multi-package deployments are required.

## Risks
1. **Rate Limiting DoS / Account Lockout Risk**: An attacker could intentionally submit 5 incorrect passwords for a known target username to trigger a 15-minute lockout against legitimate patrons. *Mitigation*: The lockout window is bounded to 15 minutes, successful sign-ins immediately clear failure counters, and generic error messages prevent confirmation of whether an account exists prior to lockout.
2. **In-Memory Leak / Unbounded Memory Growth**: High numbers of unique usernames targeted in brute-force attacks or millions of created sessions could grow memory indefinitely in long-running processes. *Mitigation*: Implement lazy eviction of expired sessions during validation checks and prune rate limiter entries whose timestamps have expired past 15 minutes.
3. **Timing Attack on Credential Verification**: String comparison of hashes could leak timing differences between correct and incorrect password hashes. *Mitigation*: Use `crypto.timingSafeEqual` with fixed-size buffers for all hash comparisons.
4. **Migration & Rollback Risk**: Risk of schema incompatibility or data loss in `accounts.json`. *Mitigation*: Zero schema changes are made to `MemberAccount` or `accounts.json`. Sessions are entirely ephemeral in memory, ensuring immediate and clean rollback if necessary.
5. **Multi-Tenancy / Patron Isolation Risk**: Token collision or session confusion between patrons. *Mitigation*: Generate tokens using 256-bit entropy (`randomBytes(32)`), guaranteeing uniqueness, and map sessions strictly to the authenticated `MemberAccount.id`.

## Alternatives considered
1. **Stateless JWTs (JSON Web Tokens) instead of in-memory session store**: Evaluated issuing signed HMAC JWTs containing patron IDs. Rejected because `FR-008` and `SC-006` strictly require sessions to be cleared and invalidated immediately upon server restart without relying on distributed token revoking or sliding expiration lists.
2. **Durable Session Persistence in `accounts.json`**: Evaluated storing active session tokens alongside accounts in `accounts.json`. Rejected because `FR-008` explicitly requires session records to reside strictly in memory and clear across server restarts, keeping only registered accounts durable.
3. **IP-Address-Based Rate Limiting instead of Username-Based**: Evaluated throttling failed attempts by client remote IP. Rejected because `FR-009` and `FR-010` explicitly specify tracking and limiting consecutive failed attempts by username, and NAT proxies in shared environments (e.g. university/library campus networks) would cause collateral lockouts for innocent patrons.

## Requirement mapping
- **FR-001** — already_satisfied: Already satisfied in repository. Citing current_behavior at src/http.ts (routes POST /signup) and src/members.ts (registerMemberAccount persists unique accounts in accounts.json using scrypt hashing).
- **FR-002** — addressed: Planned: In src/http.ts, the system must expose a sign-in endpoint `POST /signin` in `src/http.ts` that accepts JSON containing `username` and `password`.
- **FR-003** — addressed: Planned: In src/http.ts and src/members.ts, when valid matching credentials are submitted to `POST /signin`, the system must generate a cryptographically random session token, record an active session in memory, and return HTTP status `200 OK` with the token.
- **FR-004** — addressed: Planned: In src/http.ts and src/members.ts, when sign-in credentials do not match an existing account or the password does not match, the system must return HTTP status `401 Unauthorized` with a generic failure message `invalid_credentials`.
- **FR-005** — addressed: Planned: In src/http.ts and src/server.ts, the system must expose a sign-out endpoint `POST /signout` in `src/http.ts` that authenticates requests using the `Authorization: Bearer <session-token>` header.
- **FR-006** — addressed: Planned: In src/http.ts and src/members.ts, upon receiving a valid sign-out request, the system must delete the corresponding session from memory and return HTTP status `200 OK`.
- **FR-007** — addressed: Planned: In src/members.ts, the system must enforce session expiration such that sessions older than the configured TTL (default 24 hours) are rejected with HTTP status `401 Unauthorized`.
- **FR-008** — addressed: Planned: In src/members.ts, session records must be stored strictly in memory so that restarting the server clears all active sessions while registered accounts in `accounts.json` remain intact.
- **FR-009** — addressed: Planned: In src/members.ts and src/http.ts, the system must track consecutive failed sign-in attempts by username in memory and block further attempts for that username with HTTP status `429 Too Many Requests` once the failure threshold (5 failed attempts within 15 minutes) is exceeded.
- **FR-010** — addressed: Planned: In src/members.ts, successful sign-in for a username must clear any accumulated failed attempt count for that username.
- **SC-001** — already_satisfied: Already satisfied in repository. Citing current_behavior at src/http.ts and src/members.ts where account registration with unique credentials returns 201 Created.
- **SC-002** — addressed: Planned: In src/http.ts and src/members.ts, verify that a person can sign in with valid credentials and receive a session token.
- **SC-003** — addressed: Planned: In src/http.ts and src/members.ts, verify that a person presenting an active session token can sign out, after which that session token is rejected.
- **SC-004** — addressed: Planned: In src/http.ts and src/members.ts, verify that a wrong username or password consistently returns one generic failure message.
- **SC-005** — addressed: Planned: In src/members.ts and src/http.ts, verify that repeated failed sign-ins for a username exceeding the limit are blocked with a rate-limiting response.
- **SC-006** — addressed: Planned: In src/members.ts and src/server.ts, verify that after a server restart, registered accounts remain accessible in persistent storage and pre-restart session tokens are rejected, requiring sign in again.

## ADR references
