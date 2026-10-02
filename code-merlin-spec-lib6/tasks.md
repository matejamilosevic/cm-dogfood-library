# Tasks

- Work item: LIB-6 (f6b276cb-a469-4821-8db9-6fb2e17d7844)
- Category: tasks
- Version: f3153cb1-8f85-45ab-a025-b22dd3298ce1
- Approval status: approved
- Approved at: 2026-10-02T10:15:05.145Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T10:41:32.885Z
- Source: https://staging.codemerlin.ai/work-items/f6b276cb-a469-4821-8db9-6fb2e17d7844?tab=tasks

# Tasks

## matejamilosevic/library

### Task 1: Export getLoan lookup helper from loans module
- Done when:
  - `src/loans.ts` exports `getLoan(loanId: LoanId): Loan | undefined`
  - `getLoan` returns the loan entity from the internal `loans` Map when present, or `undefined` when missing
  - Existing loan functions (`checkout`, `returnLoan`, `listLoansForMember`, `resetLoansForTests`) continue to compile and operate as expected

### Task 2: [US1] Enforce Bearer token authentication and member binding on desk mutation endpoints
- Done when:
  - `src/http.ts` verifies Bearer token against `getSession(token)` for `POST /loans`, `POST /holds`, and `POST /reservations`
  - Requests without a valid unexpired session token fail immediately with HTTP status 401 and body `{"error": "unauthorized"}` (FR-001, SC-004, AC-001)
  - When no `memberId` is passed in request payload, the operation binds to `session.accountId` (FR-002, SC-001, AC-002)
  - When an explicit `memberId` is provided that differs from `session.accountId`, request is rejected with HTTP status 403 and body `{"error": "forbidden"}` (FR-002, SC-003, AC-003)

### Task 3: [US2] Enforce session authentication and caller identity matching on member activity queries
- Done when:
  - `src/http.ts` validates session Bearer token for `GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`, and `GET /members/:id/notifications` (FR-003, AC-004)
  - Missing or invalid Bearer token fails with HTTP status 401 and body `{"error": "unauthorized"}` (FR-003, SC-004, AC-004)
  - If path parameter `:id` matches `session.accountId`, returns HTTP status 200 with caller's activity records (FR-004, SC-002, AC-005)
  - If path parameter `:id` does not match `session.accountId`, rejects with HTTP status 403 and body `{"error": "forbidden"}` (FR-004, SC-003, AC-006)

### Task 4: [US3] Guard loan return and reservation cancellation by session authentication and ownership
- Done when:
  - `src/http.ts` requires valid session Bearer token for `POST /loans/:id/return` and `POST /reservations/:id/cancel`, returning HTTP status 401 and body `{"error": "unauthorized"}` if missing or invalid (FR-001, SC-004, AC-007)
  - When loan or reservation does not exist, returns HTTP status 404 (`{"error": "unknown_loan"}` or `{"error": "reservation_not_found"}`) before checking ownership
  - Verifies target entity `memberId` matches `session.accountId` using `getLoan` from `src/loans.ts` or `getReservation`; if mismatched, rejects with HTTP status 403 and body `{"error": "forbidden"}` (FR-005, SC-003, AC-008)
  - If target entity belongs to authenticated member, processes mutation and returns HTTP status 200 (FR-005, SC-001, AC-009)

### Task 5: Verify unauthenticated desk mutations and malformed auth headers reject with 401
- Kind: Repo Validation
- Done when:
  - Scenario 2 passes: POST `/loans`, `/holds`, and `/reservations` without Authorization header return 401 with `{"error": "unauthorized"}`
  - Scenario 9 passes: POST `/loans/:id/return` and `/reservations/:id/cancel` without Authorization header return 401 with `{"error": "unauthorized"}`
  - Scenario 12 passes: Requests with Basic auth, empty Bearer token, or expired token return 401 with `{"error": "unauthorized"}`
  - `handleRequest` in `src/http.ts` conforms to all unauthenticated rejection assertions

### Task 6: Verify authenticated desk operations bind to caller identity and reject conflicting payloads
- Kind: Repo Validation
- Done when:
  - Scenario 1 passes: Authenticated POST `/loans`, `/holds`, and `/reservations` without `memberId` create entities attributed to `m-1` with status 201
  - Scenario 3 passes: Authenticated requests with conflicting `memberId: "m-2"` fail with status 403 and body `{"error": "forbidden"}`
  - `handleRequest` in `src/http.ts` conforms to identity binding and conflict rejection requirements

### Task 7: Verify member activity queries enforce authentication, identity matching, and empty record isolation
- Kind: Repo Validation
- Done when:
  - Scenario 4 passes: Authenticated member retrieves own loans, holds, and reservations with status 200
  - Scenario 5 passes: Unauthenticated GET `/members/:id/loans`, `/holds`, `/reservations`, `/notifications` reject with status 401
  - Scenario 6 passes: Authenticated member attempting to inspect another member's activity rejects with status 403
  - Scenario 7 passes: Authenticated member with no activity receives empty arrays with status 200
  - `handleRequest` in `src/http.ts` conforms to member query access controls

### Task 8: Verify loan return, reservation cancellation, and end-to-end patron journey
- Kind: Repo Validation
- Done when:
  - Scenario 8 passes: Authenticated member returns own loan and cancels own reservation with status 200
  - Scenario 10 passes: Foreign member attempting to return another's loan or cancel another's reservation fails with status 403
  - Scenario 11 passes: Non-existent loan return (404 `unknown_loan`) or reservation cancellation (404 `reservation_not_found`) return 404
  - Scenario 13 passes: Full desk journey from signin to checkout, query, foreign rejection, and return executes end-to-end
  - Verification conforms across `src/http.ts` and `src/loans.ts`

### Task 9: Coverage deferral for already-satisfied public catalog and authentication endpoints
- Kind: Coverage Deferral
- Done when:
  - Public read endpoints (GET /books, GET /books/:id-or-isbn, GET /health, GET /) and public authentication endpoints (POST /signup, POST /signin) operate without session token requirements in src/http.ts.
