# Specification

- Work item: LIB-6 (f6b276cb-a469-4821-8db9-6fb2e17d7844)
- Category: specification
- Version: b1648c70-b542-4769-a435-3381eea2d1ea
- Approval status: approved
- Approved at: 2026-10-02T09:48:14.643Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T10:41:31.974Z
- Source: https://staging.codemerlin.ai/work-items/f6b276cb-a469-4821-8db9-6fb2e17d7844?tab=specification

# Specification: Act only as the signed-in member

## Outcome
Library desk activity—including borrowing books, returning loans, placing holds, creating reservations, and viewing personal loans, holds, and reservations—is strictly confined to the currently authenticated library member. Any request to inspect or modify desk activity without an active session is refused with HTTP 401 Unauthorized, and any attempt to view or act upon another member's activity is refused with HTTP 403 Forbidden.

## Current behavior
- `src/http.ts`: Exposes REST endpoints for `/loans`, `/loans/:id/return`, `/holds`, `/reservations`, `/reservations/:id/cancel`, `/members/:id/loans`, `/members/:id/holds`, and `/members/:id/reservations`. These endpoints accept arbitrary `memberId` or `email` fields in request bodies or path parameters without inspecting session bearer tokens, allowing unauthenticated callers to view or mutate any member's library records.
- `src/loans.ts`: Implements checkout and return business logic (`checkout`, `returnLoan`, `listLoansForMember`), but only checks book and member existence without associating operations to an authenticated caller or validating loan ownership on return.
- `src/members.ts`: Implements member credential registration, sign-in token generation (`createSession`), session lookup (`getSession`), session revocation, and seeded member records (`m-1`, `m-2`, `m-3`), but session enforcement is only applied to `POST /signout`.
- `src/desk.ts`: Serves an unauthenticated web UI with a client-side member selector allowing any visitor to switch between seeded member IDs and perform checkout, hold, reservation, and return operations on behalf of that selected identity.

## User Stories

### User Story 1 — Enforce Signed-in Identity on Desk Operations (Priority: P1)
As an authenticated library member, I want my borrowing, returning, holds, and reservations to automatically and exclusively associate with my signed-in account, so that no one else can act on my behalf or forge activity in my name.

**Why this priority**: Enforcing caller authentication and identity binding across state-changing library operations is the foundational requirement of the ticket.

**Independent Test**: Send POST requests to `/loans`, `/holds`, `/reservations`, and `/loans/:id/return` without a valid Bearer token and verify rejection with 401; then submit requests presenting a valid Bearer token and verify that created resources belong to the authenticated member.

**Acceptance Scenarios**:
- `AC-001`: Given a request to check out a book (`POST /loans`), place a hold (`POST /holds`), or make a reservation (`POST /reservations`), When no valid session Bearer token is provided in the `Authorization` header, Then the server rejects the request with HTTP status `401 Unauthorized`.
- `AC-002`: Given an authenticated member with a valid session Bearer token, When the member submits a valid checkout, hold, or reservation request without specifying a `memberId`, Then the server attributes the newly created loan, hold, or reservation to the authenticated member.
- `AC-003`: Given an authenticated member with a valid session Bearer token, When the request payload includes an explicit `memberId` that differs from the authenticated member's identifier, Then the server refuses the request with HTTP status `403 Forbidden`.

### User Story 2 — Restrict Viewing of Member Activity (Priority: P2)
As an authenticated library member, I want to view only my own loans, holds, and reservations, so that my library history and active borrowing records remain private from other members.

**Why this priority**: Member privacy requires that read operations on personal desk records be restricted exclusively to the authenticated owner.

**Independent Test**: Authenticate as member A, attempt to access `GET /members/{memberB_id}/loans`, `GET /members/{memberB_id}/holds`, and `GET /members/{memberB_id}/reservations`, and verify that the server refuses the request with 403 Forbidden.

**Acceptance Scenarios**:
- `AC-004`: Given a request to retrieve member loans (`GET /members/:id/loans`), holds (`GET /members/:id/holds`), or reservations (`GET /members/:id/reservations`), When no valid session Bearer token is provided in the `Authorization` header, Then the server rejects the request with HTTP status `401 Unauthorized`.
- `AC-005`: Given an authenticated member with a valid session Bearer token, When requesting their own loans, holds, or reservations where the path parameter matches their member identifier, Then the server returns HTTP status `200 OK` with their activity records.
- `AC-006`: Given an authenticated member with a valid session Bearer token, When attempting to read another member's loans, holds, or reservations where the path parameter does not match their authenticated member identifier, Then the server refuses the request with HTTP status `403 Forbidden`.

### User Story 3 — Protect Loan and Reservation Modifications Against Foreign Members (Priority: P3)
As an authenticated library member, I want attempts by other members to return my loans or cancel my reservations to be refused, so that another patron cannot tamper with my active library commitments.

**Why this priority**: Preventing unauthorized state mutations across members ensures operational integrity and protects individual patron accountability.

**Independent Test**: Issue a loan or reservation for member A, authenticate as member B, send a return request for member A's loan or a cancellation for member A's reservation, and verify that the server refuses with 403 Forbidden.

**Acceptance Scenarios**:
- `AC-007`: Given an unauthenticated caller or an invalid session Bearer token, When attempting to return a loan (`POST /loans/:id/return`) or cancel a reservation (`POST /reservations/:id/cancel`), Then the server rejects the request with HTTP status `401 Unauthorized`.
- `AC-008`: Given an authenticated member with a valid session Bearer token, When attempting to return a loan or cancel a reservation that belongs to a different member, Then the server refuses the request with HTTP status `403 Forbidden`.
- `AC-009`: Given an authenticated member with a valid session Bearer token, When returning their own active loan (`POST /loans/:id/return`) or cancelling their own reservation (`POST /reservations/:id/cancel`), Then the server completes the modification and returns HTTP status `200 OK`.

## Functional Requirements
- `FR-001` (Changed): The server must require a valid session token via the `Authorization: Bearer <token>` header for all desk mutation endpoints (`POST /loans`, `POST /loans/:id/return`, `POST /holds`, `POST /reservations`, `POST /reservations/:id/cancel`), rejecting requests missing or carrying an invalid/expired token with HTTP status `401 Unauthorized`. [US1, AC-001; US3, AC-007]
- `FR-002` (Changed): When creating a loan (`POST /loans`), placing a hold (`POST /holds`), or making a reservation (`POST /reservations`), the server must bind the operation to the authenticated member's identifier. If a payload explicitly supplies a `memberId` that differs from the authenticated member, the server must refuse the request with HTTP status `403 Forbidden`. [US1, AC-002, AC-003]
- `FR-003` (Changed): The server must require a valid session token via the `Authorization: Bearer <token>` header for all member activity query endpoints (`GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`, `GET /members/:id/notifications`), rejecting unauthenticated requests with HTTP status `401 Unauthorized`. [US2, AC-004]
- `FR-004` (New): When a member activity query endpoint (`GET /members/:id/*`) is requested, the server must verify that the target `:id` matches the authenticated member's identifier. If the requested `:id` does not match, the server must refuse the request with HTTP status `403 Forbidden`. [US2, AC-005, AC-006]
- `FR-005` (New): When mutating an existing loan (`POST /loans/:id/return`) or reservation (`POST /reservations/:id/cancel`), the server must verify that the target entity belongs to the authenticated member. If the entity belongs to another member, the server must refuse the request with HTTP status `403 Forbidden`. [US3, AC-008, AC-009]
- `FR-006` (Preserved): Public read endpoints for catalog browsing (`GET /books`, `GET /books/:id-or-isbn`, `GET /health`, `GET /`) and public authentication endpoints (`POST /signup`, `POST /signin`) must remain accessible without requiring an active session token. [US1, AC-001]

## Success Criteria
- `SC-001`: Pass or fail: All checkout, return, hold, and reservation requests execute strictly under the identity of the signed-in member.
- `SC-002`: Pass or fail: A member can view only their own loans, holds, and reservations.
- `SC-003`: Pass or fail: Any attempt by a caller to view or change another member's activity is refused with HTTP 403 Forbidden.
- `SC-004`: Pass or fail: Any attempt by a person who is not signed in to perform checkout, return, hold, reservation, or activity viewing is refused with HTTP 401 Unauthorized.

## Edge Cases
- Missing Authorization header: Request to protected endpoints without an `Authorization` header returns HTTP status `401 Unauthorized`.
- Malformed or expired token: Request presenting a malformed header or expired Bearer token returns HTTP status `401 Unauthorized`.
- Target resource not found: When a loan or reservation ID does not exist in the system during return or cancellation, the server returns HTTP status `404 Not Found` before or without leaking information about other members' records.
- Mismatched member payload: When a checkout, hold, or reservation request body includes an explicit `memberId` conflicting with the authenticated session, the server consistently refuses the request with HTTP status `403 Forbidden`.

## Out of Scope
- Role-based permissions, library staff/librarian administrative overrides, and delegation mechanisms.
- Changes to password hashing, session TTL duration, or rate limiting rules established in `src/members.ts`.
- Persistent database migration or external session cache providers.

## Source Requirement Coverage

| Source AC | Covered by |
|---|---|
| Checkout, return, hold, and reservation use the signed-in member | AC-002, AC-009, FR-002, FR-005, SC-001 |
| A member can see only their own loans, holds, and reservations | AC-005, FR-004, SC-002 |
| Trying to view or change another member's activity is refused | AC-003, AC-006, AC-008, FR-002, FR-004, FR-005, SC-003 |
| A person who is not signed in cannot perform these actions | AC-001, AC-004, AC-007, FR-001, FR-003, SC-004 |
