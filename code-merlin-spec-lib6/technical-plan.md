# Technical Plan

- Work item: LIB-6 (f6b276cb-a469-4821-8db9-6fb2e17d7844)
- Category: technical_plan
- Version: 0e9252a2-f8c1-4baa-8bc3-2431039b94ac
- Approval status: approved
- Approved at: 2026-10-02T10:14:59.641Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T10:41:32.326Z
- Source: https://staging.codemerlin.ai/work-items/f6b276cb-a469-4821-8db9-6fb2e17d7844?tab=technical_plan

# Technical Plan draft

## Technical approach
## Technical Approach

**Change magnitude: LARGE**

### Current state vs target state

Currently in `src/http.ts`, desk mutation endpoints (`POST /loans`, `POST /loans/:id/return`, `POST /holds`, `POST /reservations`, `POST /reservations/:id/cancel`) and member activity query endpoints (`GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`, `GET /members/:id/notifications`) do not inspect session tokens or enforce caller identity. Request bodies and URL path parameters can name arbitrary member IDs or emails. While `src/members.ts` defines `getSession(token)` with 24-hour TTL validation and `src/http.ts` provides a `bearerToken(headers)` helper, token validation is only applied to `POST /signout`. Furthermore, `returnLoan` in `src/loans.ts` performs returns using only the loan ID without verifying which member holds the loan or exposing loan lookup for pre-validation.

In the target state:
1. All desk mutation endpoints (`POST /loans`, `POST /loans/:id/return`, `POST /holds`, `POST /reservations`, `POST /reservations/:id/cancel`) require an `Authorization: Bearer <token>` header containing a valid, unexpired session token from `getSession(token)`. Missing, malformed, or expired tokens immediately result in HTTP `401 Unauthorized` (`{ error: 'unauthorized' }`).
2. For creation operations (`POST /loans`, `POST /holds`, `POST /reservations`), the newly created entity is bound directly to the authenticated member identifier associated with the session. If the caller provides an explicit `memberId` in the JSON body that conflicts with their authenticated member ID, the server rejects the request with HTTP `403 Forbidden` (`{ error: 'forbidden' }`).
3. For member activity query endpoints (`GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`, `GET /members/:id/notifications`), an active session is required (HTTP 401 on missing/invalid token), and the route parameter `:id` must match the authenticated member's identifier. Accessing any other member's activity is rejected with HTTP `403 Forbidden` (`{ error: 'forbidden' }`).
4. For entity mutations on existing records (`POST /loans/:id/return` and `POST /reservations/:id/cancel`), the server authenticates the caller (HTTP 401), checks that the entity exists (returning HTTP `404 Not Found` if nonexistent), and validates that the loan or reservation belongs to the authenticated member. If the entity belongs to a different member, the modification is refused with HTTP `403 Forbidden` (`{ error: 'forbidden' }`). To enable this check cleanly, `src/loans.ts` exports `getLoan(loanId: LoanId): Loan | undefined`, matching `getReservation` in `src/reservations.ts`.
5. Public catalog endpoints (`GET /books`, `GET /books/:id-or-isbn`, `GET /health`, `GET /`) and public authentication endpoints (`POST /signup`, `POST /signin`) remain accessible without authentication.

### Research decisions

1. **Authentication and Authorization Helper in `src/http.ts`**:
   - *Decision*: Introduce a centralized request authentication helper in `src/http.ts` (e.g., `authenticateSession(headers)`) that parses the Bearer token using `bearerToken(headers)` and validates it against `getSession(token)`. For endpoints requiring identity matching, evaluate whether the authenticated member identifier matches the target parameter or payload.
   - *Rationale*: Reuses the existing `bearerToken` parsing and `getSession` lookup without restructuring the lightweight routing switch in `handleRequest`. Avoids duplicate token-extraction logic across all eight protected routes.

2. **Exposing `getLoan` in `src/loans.ts`**:
   - *Decision*: Export `getLoan(loanId: LoanId): Loan | undefined` from `src/loans.ts`.
   - *Rationale*: Currently, `loans` is a private `Map` in `src/loans.ts` and `returnLoan` throws directly if missing. Exporting `getLoan` allows `src/http.ts` to inspect the loan's existence (returning HTTP 404 before identity checks) and verify `loan.memberId === authenticatedMemberId` (returning HTTP 403 on foreign loans), exactly mirroring how `getReservation` is already exposed and consumed in `src/reservations.ts`.

3. **Member Identity Association with Sessions**:
   - *Decision*: Treat `session.accountId` as the authoritative member identifier for authenticated operations, while ensuring compatibility with member lookups (`getMember(session.accountId)` or seeded/registered member records).
   - *Rationale*: `createSession` populates `accountId` and `username`. Binding desk operations to `session.accountId` guarantees consistent ownership verification across creation, retrieval, and mutation endpoints.

### Component / module ownership

- `matejamilosevic/library:src/http.ts`: Owns HTTP routing, request parsing, authentication checks (`401 Unauthorized`), authorization checks (`403 Forbidden`), and route-level error formatting.
- `matejamilosevic/library:src/loans.ts`: Owns loan state and lifecycle logic; exports `getLoan` to allow entity existence and ownership inspection.
- `src/catalog.ts`, `src/members.ts`, and `src/reservations.ts` require no functional modifications for this change.

### Service interaction patterns

- Requests enter `handleRequest` in `src/http.ts` synchronously from Node's HTTP server in `src/server.ts`.
- For protected routes, `handleRequest` queries `getSession(token)` from `src/members.ts` synchronously via in-memory Map lookup.
- If authentication or authorization fails, `handleRequest` immediately returns an `HttpResult` with status `401` or `403` respectively, halting any call into `src/loans.ts`, `src/holds.ts`, or `src/reservations.ts`.

### Feature-flag keys

- None. Authentication and authorization enforcement is active across all protected endpoints upon deployment.

### Multi-tenancy contract

- The library patron acts as the isolation boundary. All desk operations and queries are scoped to the authenticated member identifier (`session.accountId`). Any access or mutation request specifying a foreign member identifier or targeting a resource owned by another member is refused with HTTP 403 Forbidden.

## Affected components
- **library** — Updates `src/http.ts` to enforce Bearer token session authentication (HTTP 401) and member authorization / resource ownership (HTTP 403) across all desk mutation and activity query routes. Updates `src/loans.ts` to export `getLoan` for loan existence and ownership verification.

## Affected component allowlist
- `matejamilosevic/library:src/http.ts` (modify) `handleRequest`
- `matejamilosevic/library:src/loans.ts` (modify) `getLoan`

## Data model changes
No schema changes or persistent database migrations. All state is maintained in in-memory Maps (`loans` in `src/loans.ts`, `holds` in `src/holds.ts`, `reservations` in `src/reservations.ts`, and `sessionsByToken` in `src/members.ts`).

## API changes
### Modified Endpoints

1. `POST /loans`
   - **Authentication**: Required (`Authorization: Bearer <token>`)
   - **Authorization**: Caller must be authenticated; optional `memberId` in payload must match authenticated member ID
   - **Request body**: `{ "bookId": string, "memberId"?: string }`
   - **Response body**: `{ "loan": Loan }` (HTTP 201)
   - **Errors**: `400 missing_book_or_member` / `invalid_json`, `401 unauthorized`, `403 forbidden` (if payload `memberId` differs from session), `404 unknown_book` / `unknown_member`, `409 no_copies_available` / `queue_priority_conflict` / `copy_held_for_other_member`

2. `POST /loans/:id/return`
   - **Authentication**: Required (`Authorization: Bearer <token>`)
   - **Authorization**: Caller must own the target loan
   - **Request body**: `{}` or empty
   - **Response body**: `{ "loan": Loan }` (HTTP 200)
   - **Errors**: `401 unauthorized`, `403 forbidden` (if loan belongs to another member), `404 unknown_loan` (if loan does not exist), `409 already_returned`

3. `POST /holds`
   - **Authentication**: Required (`Authorization: Bearer <token>`)
   - **Authorization**: Caller must be authenticated; optional `memberId` in payload must match authenticated member ID
   - **Request body**: `{ "bookId": string, "memberId"?: string }`
   - **Response body**: `{ "hold": Hold }` (HTTP 201)
   - **Errors**: `400 missing_book_or_member` / `invalid_json`, `401 unauthorized`, `403 forbidden` (if payload `memberId` differs), `404 unknown_book` / `unknown_member`, `409 copies_available` / `duplicate_hold` / `hold_limit_exceeded`

4. `POST /reservations`
   - **Authentication**: Required (`Authorization: Bearer <token>`)
   - **Authorization**: Caller must be authenticated; optional `memberId` in payload must match authenticated member ID
   - **Request body**: `{ "bookId": string, "memberId"?: string }`
   - **Response body**: `{ "reservation": Reservation }` (HTTP 201)
   - **Errors**: `400 missing_book_or_member` / `invalid_json`, `401 unauthorized`, `403 forbidden` (if payload `memberId` differs), `404 unknown_book` / `unknown_member`, `409 copies_available` / `duplicate_reservation`

5. `POST /reservations/:id/cancel`
   - **Authentication**: Required (`Authorization: Bearer <token>`)
   - **Authorization**: Caller must own the target reservation
   - **Request body**: `{}` or empty
   - **Response body**: `{ "reservation": Reservation }` (HTTP 200)
   - **Errors**: `401 unauthorized`, `403 forbidden` (if reservation belongs to another member), `404 reservation_not_found` (if reservation does not exist), `409 already_cancelled` / `already_fulfilled`

6. `GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`, `GET /members/:id/notifications`
   - **Authentication**: Required (`Authorization: Bearer <token>`)
   - **Authorization**: Target path `:id` must match authenticated member ID
   - **Response body**: `{ "loans": Loan[] }` / `{ "holds": Hold[] }` / `{ "reservations": Reservation[] }` / `{ "notifications": Notification[] }` (HTTP 200)
   - **Errors**: `401 unauthorized`, `403 forbidden` (if path `:id` does not match session member ID), `404 member_not_found`

### Preserved Endpoints (Unauthenticated)
- `GET /health`, `GET /`, `GET /books`, `GET /books/:id-or-isbn`, `POST /signup`, `POST /signin` remain public and accessible without bearer tokens.

## Migration / rollout
1. **Rollout order**: Deploy the updated application service (`src/http.ts` and `src/loans.ts`). Because the service uses in-memory session and desk state, updates take effect immediately upon server start.
2. **Compatibility notice**: Unauthenticated callers to mutation and member query routes will receive HTTP 401 Unauthorized immediately. API clients must authenticate via `POST /signin` and pass `Authorization: Bearer <token>` on all desk operations.
3. **Rollback strategy**: Revert the deploy to the prior version tag if unexpected 401/403 rejections occur during verification.

## Operational considerations
- **Observability & Logging**: Ensure `handleRequest` writes warnings to `process.stderr` for repeated HTTP 401 unauthorized or 403 forbidden attempts without logging secret token values.
- **Error Uniformity**: Maintain consistent JSON error responses (`{ error: 'unauthorized' }` for 401, `{ error: 'forbidden' }` for 403) across all protected routes.
- **Memory Lifecycle**: Sessions continue to expire according to their 24-hour TTL in `src/members.ts`.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/library | Yes | Core library desk service implementing HTTP endpoints, session authorization checks, and loan lifecycle tracking. | 1 |

## Repository scope
Single repository: `matejamilosevic/library`. All changes are localized to `src/http.ts` and `src/loans.ts` without multi-service deployment coordination.

## Risks
1. **Breaking Change for Unauthenticated API Consumers**: Unauthenticated requests to `/loans`, `/holds`, `/reservations`, and `/members/:id/*` will now fail with HTTP 401 instead of succeeding. Mitigation: Ensure client applications sign in first and provide Bearer session tokens.
2. **Information Disclosure via Error Status Codes**: Checking ownership before entity existence could reveal the existence of another member's loan or reservation through a 403 instead of a 404. Mitigation: Look up the entity first and return HTTP 404 if not found before performing member ownership comparison.
3. **Mismatched Member Payloads**: Clients might pass both an authenticated session and an explicit `memberId` in the request body. Mitigation: If an explicit `memberId` is present in the payload and does not match the session member ID, refuse the request with HTTP 403 Forbidden as specified in FR-002.
4. **Session Loss Across Restarts**: Active sessions are stored in memory and cleared on server restart. Mitigation: Documented as existing behavior; clients re-authenticate via `POST /signin` on restart.

## Alternatives considered
1. **Middleware Pipeline Pattern vs Inline Handler Checks**: Considered introducing an Express-style middleware pipeline for token inspection. Not chosen because `handleRequest` in `src/http.ts` is a lightweight pure dispatch function; adding a middleware abstraction would introduce unnecessary architectural complexity when an inline helper function satisfies all requirements.
2. **Ignoring Explicit `memberId` Payloads and Overriding with Session ID**: Considered silently ignoring any `memberId` or `email` field provided in the JSON body and always overriding it with the authenticated caller's ID. Not chosen because FR-002 explicitly mandates returning HTTP 403 Forbidden when a conflicting `memberId` is provided.

## Requirement mapping
- **FR-001** — addressed: Planned: The server must require a valid session token via the `Authorization: Bearer <token>` header for all desk mutation endpoints (`POST /loans`, `POST /loans/:id/return`, `POST /holds`, `POST /reservations`, `POST /reservations/:id/cancel`), rejecting requests missing or carrying an invalid/expired token with HTTP status `401 Unauthorized`.
- **FR-002** — addressed: Planned: When creating a loan (`POST /loans`), placing a hold (`POST /holds`), or making a reservation (`POST /reservations`), the server must bind the operation to the authenticated member's identifier. If a payload explicitly supplies a `memberId` that differs from the authenticated member, the server must refuse the request with HTTP status `403 Forbidden`.
- **FR-003** — addressed: Planned: The server must require a valid session token via the `Authorization: Bearer <token>` header for all member activity query endpoints (`GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`, `GET /members/:id/notifications`), rejecting unauthenticated requests with HTTP status `401 Unauthorized`.
- **FR-004** — addressed: Planned: When a member activity query endpoint (`GET /members/:id/*`) is requested, the server must verify that the target `:id` matches the authenticated member's identifier. If the requested `:id` does not match, the server must refuse the request with HTTP status `403 Forbidden`.
- **FR-005** — addressed: Planned: When mutating an existing loan (`POST /loans/:id/return`) or reservation (`POST /reservations/:id/cancel`), the server must verify that the target entity belongs to the authenticated member. If the entity belongs to another member, the server must refuse the request with HTTP status `403 Forbidden`.
- **FR-006** — already_satisfied: Already satisfied in repository: Public read endpoints (GET /books, GET /books/:id-or-isbn, GET /health, GET /) and public authentication endpoints (POST /signup, POST /signin) operate without session token requirements in src/http.ts (handleRequest, ev-http-ts).
- **SC-001** — addressed: Planned: All checkout, return, hold, and reservation requests execute strictly under the identity of the signed-in member.
- **SC-002** — addressed: Planned: A member can view only their own loans, holds, and reservations.
- **SC-003** — addressed: Planned: Any attempt by a caller to view or change another member's activity is refused with HTTP 403 Forbidden.
- **SC-004** — addressed: Planned: Any attempt by a person who is not signed in to perform checkout, return, hold, reservation, or activity viewing is refused with HTTP 401 Unauthorized.

## ADR references
