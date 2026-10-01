<!--
Artifact: technical_plan
Version ID: 9655e131-b2ce-4af3-930c-4289bb79f14d
Approval Status: approved
Approved At: 2026-09-18T14:41:25.318Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: b3272e5a-7bf5-426c-9072-54375895d5b6
Work Item URL: https://staging.codemerlin.ai/work-items/b3272e5a-7bf5-426c-9072-54375895d5b6?tab=technical_plan
-->

# Technical Plan draft

## Technical approach
**Change magnitude: MEDIUM**

## Current state vs target state
In the existing `matejamilosevic/cm-dogfood-library` repository, members can look up books by ID or ISBN (`src/catalog.ts`), check out available copies (`checkout` in `src/loans.ts`), and return loans (`returnLoan` in `src/loans.ts`). However, when all copies of a title are checked out, there is no waitlist capability (`README.md` explicitly notes that holds and waitlists do not work).

The target state introduces waitlist hold management:
1. When `availableCopies(bookId)` equals 0, members can place a hold (`POST /holds`), placing them in a strict FIFO queue for that title.
2. Members are capped at 3 active holds (`waiting` or `notified`) catalog-wide. Attempting to place a hold on a title with available copies or when the member already holds an active hold on the title is rejected.
3. When a copy of a held title is returned via `returnLoan`, the system promotes the earliest waiting member in queue to `notified` status, creates an in-app notification record, and sets a 7-day pickup deadline (`expiresAt`).
4. While a title has active `notified` holds, non-notified members attempting to check out the title are blocked to preserve queue priority. Only the notified member can check out the reserved copy.
5. If a notified hold reaches its 7-day expiration deadline without checkout, it transitions to `expired` and automatically promotes the next waiting member in line (or releases the copy to open stock if no holds remain).

Reused unchanged:
- `src/catalog.ts`: Book lookup and ISBN matching.
- `src/members.ts`: Member lookup.
- `src/server.ts`: HTTP server runner.

Modified:
- `src/types.ts`: Extended with `HoldStatus`, `Hold`, and `Notification` types.
- `src/loans.ts`: Modified `checkout` to check hold reservations and `returnLoan` to trigger hold processing.
- `src/http.ts`: Added `/holds` and notification routes, and updated error handling for queue priority conflicts.
- `src/index.ts`: Re-exported hold types and functions.

New:
- `src/holds.ts`: In-memory holds data store, FIFO queue logic, limit validation, and hold notification/expiration processing.
- `test/holds.test.ts`: Unit tests covering holds creation, 3-hold limit, FIFO priority, loan return notifications, queue priority protection during checkout, and expiration promotion.

## Research decisions
1. **In-Memory Store Reuse (`src/holds.ts`)**
   - *Option considered*: Extend `src/loans.ts` to manage holds vs create a dedicated `src/holds.ts` module.
   - *Decision*: Create `src/holds.ts` to encapsulate hold queue state, FIFO ordering, active hold counters, and expiration routines. This maintains clean separation of concerns while following the established `Map<string, Entity>` store pattern found in `src/loans.ts` and `src/catalog.ts`.
2. **Synchronous Expiration Check on Operation**
   - *Option considered*: Background timer loop vs lazy processing on store read/checkout/return.
   - *Decision*: Process hold expiration lazily during hold placement, checkout, and loan return calls. Because this is an in-memory application without persistent background workers, synchronous lazy evaluation guarantees exact temporal accuracy without timer leak risks in Vitest test runs.

## Component / module ownership
- `matejamilosevic/cm-dogfood-library`: Single deployable package owning catalog, members, loans, holds, and HTTP routing.
- Components NOT modified: `src/catalog.ts`, `src/members.ts`, `src/server.ts`.

## Service interaction patterns
- Direct synchronous function calls within the process: `http.ts` -> `loans.ts` and `holds.ts` -> `catalog.ts` / `members.ts`.
- When `returnLoan` is invoked in `src/loans.ts`, it synchronously calls `processReturnForHolds(bookId)` in `src/holds.ts`. If an active `waiting` hold exists, its status transitions to `notified`, an in-app `Notification` record is stored, and the 7-day deadline is attached.

## Feature-flag keys
- None required for this in-memory sandbox system.

## Multi-tenancy contract
- Single-tenant library desk application; isolation is enforced per `memberId` and `bookId` across all hold and loan operations.

## Affected components
- **matejamilosevic/cm-dogfood-library** — Add hold waitlist queue, 3-hold limit enforcement, return notification allocation, priority checkout protection, and expiration handling across `src/types.ts`, `src/holds.ts`, `src/loans.ts`, `src/http.ts`, `src/index.ts`, and `test/holds.test.ts`.

## Affected component allowlist
- `matejamilosevic/cm-dogfood-library:src/types.ts` (modify) `Hold, HoldStatus, Notification`
- `matejamilosevic/cm-dogfood-library:src/holds.ts` (create) `placeHold, processReturnForHolds, processHoldExpiration, listHoldsForMember`
- `matejamilosevic/cm-dogfood-library:src/loans.ts` (modify) `checkout, returnLoan`
- `matejamilosevic/cm-dogfood-library:src/http.ts` (modify) `handleRequest`
- `matejamilosevic/cm-dogfood-library:src/index.ts` (modify) `holds module exports`
- `matejamilosevic/cm-dogfood-library:test/holds.test.ts` (create) `holds test suite`

## Data model changes
Data store updates in `src/types.ts` and `src/holds.ts` (In-Memory Maps):

1. **`Hold` Entity** (`src/types.ts`):
   - `id`: `string` (`hold-1`, `hold-2`, ...)
   - `bookId`: `BookId`
   - `memberId`: `MemberId`
   - `status`: `'waiting' | 'notified' | 'fulfilled' | 'expired' | 'cancelled'`
   - `createdAt`: `string` (ISO date string)
   - `notifiedAt`: `string | null` (ISO date string when copy returned)
   - `expiresAt`: `string | null` (ISO date string, 7 calendar days after notification)

2. **`Notification` Entity** (`src/types.ts`):
   - `id`: `string` (`notif-1`, `notif-2`, ...)
   - `memberId`: `MemberId`
   - `holdId`: `string`
   - `bookId`: `BookId`
   - `createdAt`: `string` (ISO date string)
   - `expiresAt`: `string` (ISO date string, 7 calendar days from notification)
   - `message`: `string`

3. **In-Memory Holds Map** (`src/holds.ts`):
   - Map key: `HoldId` (`string`), Value: `Hold`
   - Map key: `NotificationId` (`string`), Value: `Notification`
   - Storage definition path: `matejamilosevic/cm-dogfood-library:src/holds.ts`

## API changes
1. **`POST /holds`** (New Route in `src/http.ts`):
   - *Auth*: None (uses `memberId` or `email` in body).
   - *Request body*: `{ "bookId": "b-2", "memberId": "m-1" }` or `{ "bookId": "b-2", "email": "ada@library.test" }`
   - *Response*: Status 201 `{ "hold": { "id": "hold-1", "bookId": "b-2", "memberId": "m-1", "status": "waiting", "createdAt": "2026-09-18" } }`
   - *Error status codes*:
     - 400 `invalid_json` / `missing_book_or_member`
     - 404 `unknown_book` / `unknown_member`
     - 409 `copies_available` (when `availableCopies > 0`)
     - 409 `duplicate_hold` (when member already has an active hold on this title)
     - 409 `hold_limit_exceeded` (when member reaches 3 active holds catalog-wide)

2. **`GET /members/:id/holds`** (New Route in `src/http.ts`):
   - *Response*: Status 200 `{ "holds": [ ... ] }` or 404 `member_not_found`.

3. **`GET /members/:id/notifications`** (New Route in `src/http.ts`):
   - *Response*: Status 200 `{ "notifications": [ ... ] }` or 404 `member_not_found`.

4. **`POST /loans`** (Modified Behavior in `src/loans.ts` and `src/http.ts`):
   - *Response*: Status 201 `{ "loan": ... }` when valid.
   - *Error status codes*:
     - 409 `queue_priority_conflict` when a non-notified member attempts to check out a title reserved for a notified hold.

## Migration / rollout
Deployment Sequence:
1. Update type definitions and create `src/holds.ts` with reset and lookup exports.
2. Update `src/loans.ts` to integrate priority checkout validation and return notification triggers.
3. Expose `/holds` and member notification routes in `src/http.ts` and `src/index.ts`.
4. Run full Vitest suite (`npm test`) to verify all new and existing tests pass.

Rollback Strategy:
- In-memory application state; reverting code changes and restarting the process clean-resets state.

## Operational considerations
- Telemetry: In-memory application logs console messages on startup (`src/server.ts`).
- Processing Latency: Synchronous in-memory queue promotion on loan return processes in under 1ms, satisfying SC-003 (<500ms requirement).
- Reset for Tests: Expose `resetHoldsForTests()` in `src/holds.ts` and invoke it inside `beforeEach` in test files.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/cm-dogfood-library | Yes | In-memory library desk server managing catalog, members, loans, holds, and HTTP endpoints. | 1 |

## Repository scope
Single repository scope: `matejamilosevic/cm-dogfood-library`. All changes are in-memory TypeScript module additions and updates.

## Risks
1. **Queue Priority Bypass Risk**: Non-notified members might check out a copy reserved for a hold holder. *Mitigation*: `checkout()` in `src/loans.ts` explicitly inspects active notified holds for the title and rejects non-notified borrowers with `queue_priority_conflict`.
2. **Stale Notified Hold Reservation Lockout**: A notified member fails to collect their copy within 7 days, locking the copy indefinitely. *Mitigation*: `processHoldExpiration()` automatically expires 7-calendar-day notified holds and promotes the next waiting member upon any hold/loan/checkout inspection.
3. **Over-Limit Hold Placement**: A member could place more than 3 active holds across titles. *Mitigation*: `placeHold()` counts active (`waiting` or `notified`) holds across all titles for the member and rejects additions when count >= 3.

## Alternatives considered
1. **Auto-converting failed checkout into a hold**: Considered automatically creating a hold when `POST /loans` fails with 0 copies available. *Rejected*: The specification requires explicit user intent and distinct endpoints (`POST /loans` vs `POST /holds`) to prevent accidental queue entry.
2. **Background interval process for expiration**: Considered `setInterval` worker for 7-day hold expiration. *Rejected*: Lazy synchronous expiration check during store operations is simpler, avoids timer handle leaks in test runners, and guarantees immediate state consistency.

## Requirement mapping
- **FR-001** — already_satisfied: Requirement is already satisfied in the repository (`src/catalog.ts`, `src/loans.ts`, `GET /books`, `GET /books/:id-or-isbn`). Members can look up catalog books by ID or ISBN (ignoring dashes) and view current total and available copy counts.
- **FR-002** — already_satisfied: Requirement is already satisfied in the repository (`src/loans.ts`, `POST /loans`). Members can check out an available book for 21 days when copies exist and no prioritizing holds block checkout.
- **FR-003** — already_satisfied: Requirement is already satisfied in the repository (`src/loans.ts`, `POST /loans/:id/return`). Members can return a loan, recording the return date and restoring availability.
- **FR-004** — addressed: Planned: Implement `placeHold` in `src/holds.ts` and `POST /holds` route in `src/http.ts` to allow hold placement if and only if available copies equal 0.
- **FR-005** — addressed: Planned: Implement 3 active holds per member enforcement in `src/holds.ts` (`placeHold`), rejecting requests exceeding the limit.
- **FR-006** — addressed: Planned: Maintain holds in strict FIFO queue order sorted by timestamp/sequence in `src/holds.ts`.
- **FR-007** — addressed: Planned: Update `returnLoan` in `src/loans.ts` to trigger `processReturnForHolds` in `src/holds.ts`, promoting the longest-waiting hold to `notified`, emitting an in-app notification, and setting a 7-day pickup deadline.
- **FR-008** — addressed: Planned: Update `checkout` in `src/loans.ts` to verify hold queue reservation, allowing checkout only for the notified member and blocking queue jumping by other members.
- **FR-009** — addressed: Planned: Implement `processHoldExpiration` in `src/holds.ts` to expire 7-day notified holds and automatically promote the next waiting member or release copy.
- **SC-001** — addressed: Planned: Verify 100% of hold creations on 0-copy titles enter the hold queue with unique timestamped sequence rank via unit tests in `test/holds.test.ts`.
- **SC-002** — addressed: Planned: Verify 100% of checkout attempts by non-notified members on held titles return a queue priority error in `test/loans.test.ts` and `test/http.test.ts`.
- **SC-003** — addressed: Planned: Verify loan returns trigger notification creation and 7-day pickup assignment synchronously in `test/holds.test.ts`.
- **SC-004** — addressed: Planned: Verify members reaching 3 active holds are blocked from placing further holds in `test/holds.test.ts`.

## ADR references