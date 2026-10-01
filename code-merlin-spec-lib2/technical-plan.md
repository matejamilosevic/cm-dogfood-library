<!--
Artifact: technical_plan
Version ID: 333da9ab-332b-495a-9695-cbdfe2946650
Approval Status: approved
Approved At: 2026-09-23T14:34:27.106Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: a61aa991-d7cc-4f73-b12e-2e3840200f05
Work Item URL: https://staging.codemerlin.ai/work-items/a61aa991-d7cc-4f73-b12e-2e3840200f05?tab=technical_plan
-->

# Technical Plan draft

## Technical approach
## Change magnitude
**Change magnitude: LARGE**

The implementation introduces new public HTTP API routes (`POST /reservations`, `POST /reservations/:id/cancel`), modifies existing HTTP route payloads (`GET /books`, `GET /books/:id-or-isbn`, `POST /loans`), and introduces an in-memory reservation queue domain model with hold transition management.

## Current state vs target state
### Current State
- **Catalog & Availability**: `src/catalog.ts` (`listBooks`, `getBook`, `findBookByIsbn`) stores and returns static `Book` items containing total owned `copies`. In `src/http.ts`, `GET /books` returns `{ books: Book[] }` and `GET /books/:id-or-isbn` returns `{ book: Book }` with only `copies`. Neither exposes shelf availability (`availableCopies`).
- **Loan Lifecycle**: `src/loans.ts` maintains an in-memory `Map<LoanId, Loan>`. `availableCopies(bookId)` calculates available inventory as `Math.max(0, book.copies - activeLoans.length)`. `checkout` checks only `availableCopies < 1`. `returnLoan` stamps `returnedAt` and instantly frees the copy for open checkout without hold evaluation.
- **Reservations / Waitlists**: Completely absent. `src/http.ts` lacks reservation endpoints, and there is no mechanism for queuing members when books are fully checked out.

### Target State
- **Shelf Availability Exposed**: In `src/loans.ts`, `availableCopies(bookId)` is updated to calculate real-time shelf copies: `Math.max(0, book.copies - activeLoansCount - heldReservationsCount)`. In `src/http.ts`, `GET /books` and `GET /books/:id-or-isbn` return items enriched with `availableCopies` alongside total owned `copies`.
- **Reservation Lifecycle & Queue**: A dedicated domain module `src/reservations.ts` manages in-memory reservations with statuses `'pending' | 'held' | 'fulfilled' | 'cancelled'`. Reservations are tracked in strict first-come, first-served (FIFO) sequence by `createdAt`. A member can submit a reservation via `POST /reservations` specifying `bookId` and either `memberId` or `email`. Rejections are enforced if `availableCopies >= 1` (error `copies_available`) or if the member already has an active reservation (`pending` or `held`) for that book (error `duplicate_reservation`).
- **Hold Allocation on Return**: In `src/loans.ts`, when `returnLoan` processes a returned copy, if the book has pending reservations, the returned copy is immediately held for the member at the front of the queue by transitioning their reservation to `'held'` instead of restoring open shelf availability.
- **Hold Enforcement & Manual Checkout**: In `src/loans.ts`, `checkout` verifies whether an active hold exists on the book. If held, only the member for whom the copy is held can complete checkout (other checkout attempts fail with `copy_held_for_other_member` or `no_copies_available`). Upon successful checkout by the held member, their reservation is marked `'fulfilled'` and a standard 21-day loan is generated. The reservation never becomes a loan automatically.
- **Cancellation & Hold Reallocation**: Via `POST /reservations/:id/cancel`, a member can cancel their active reservation. If the cancelled reservation was holding a returned copy, the hold immediately transfers to the next member in the queue; if no pending reservations remain, the copy reverts to open shelf availability.

## Research decisions
1. **Modular Domain Separation (`src/reservations.ts`) vs Monolithic `loans.ts`**: We introduce `src/reservations.ts` to encapsulate reservation data structures and queue mechanics, mirroring existing domain modules (`catalog.ts`, `members.ts`, `loans.ts`). `src/loans.ts` coordinates with `src/reservations.ts` during `checkout` and `returnLoan` to check hold claims and transition statuses, preventing tight coupling and maintaining clean single-responsibility boundaries.
2. **RPC-Style Endpoint Conventions**: We align reservation cancellation with the repository's established action pattern in `src/http.ts` (`POST /loans/:id/return`) by implementing `POST /reservations/:id/cancel` alongside `POST /reservations`.
3. **Availability Computation Formula**: We compute `availableCopies` as `book.copies - activeLoansCount - heldReservationsCount`. Held copies are physically in the library but reserved exclusively for the front-of-line patron, so they must not be counted as unreserved shelf copies available for general checkout or new reservations.

## Component / module ownership
- **`cm-dogfood-library` (`matejamilosevic/cm-dogfood-library`)**:
  - `src/types.ts`: Owns data contract definitions for `ReservationId`, `ReservationStatus`, `Reservation`, and `Book` extensions.
  - `src/reservations.ts`: Owns reservation storage, FIFO queue ordering, hold assignments, duplicate checks, and cancellation hold reallocation.
  - `src/loans.ts`: Owns loan lifecycle, checkout hold enforcement, reservation fulfillment upon checkout, and triggering hold allocation upon return.
  - `src/http.ts`: Owns request dispatching, parameter parsing, route matching for `/reservations` and `/reservations/:id/cancel`, error code mapping, and injecting `availableCopies` into `/books` payloads.
  - `src/index.ts`: Re-exports public domain functions and types.
  - `src/catalog.ts` & `src/members.ts`: Must NOT be modified; existing catalog lookup and member lookup are preserved unchanged.

## Service interaction patterns
- **Synchronous In-Memory Calls**: All interactions between `http.ts`, `reservations.ts`, `loans.ts`, `catalog.ts`, and `members.ts` are synchronous in-memory TypeScript function invocations within the single Node.js process.
- **Error Propagation**: Domain functions throw standard `Error` objects formatted as `<error_code>:<detail>` (e.g., `unknown_book:b-1`, `copies_available:b-1`, `duplicate_reservation:m-1`), which `http.ts` parses into standard HTTP error responses (`400`, `404`, `409`).

## Feature-flag keys
None. All capabilities are active immediately upon process deployment.

## Multi-tenancy contract
Single-tenant in-memory prototype. There is no multi-tenancy, workspace, organization partitioning, or user authentication in scope.

## Affected components
- **cm-dogfood-library** — Implements in-memory reservation tracking in `src/reservations.ts`, hold validation in `src/loans.ts`, `availableCopies` reporting and reservation endpoints in `src/http.ts`, types in `src/types.ts`, public exports in `src/index.ts`, and test coverage across `test/reservations.test.ts`, `test/loans.test.ts`, and `test/http.test.ts`.

## Affected component allowlist
- `matejamilosevic/cm-dogfood-library:src/types.ts` (modify) `Reservation`
- `matejamilosevic/cm-dogfood-library:src/reservations.ts` (create) `reserveBook`
- `matejamilosevic/cm-dogfood-library:src/loans.ts` (modify) `availableCopies`
- `matejamilosevic/cm-dogfood-library:src/http.ts` (modify) `handleRequest`
- `matejamilosevic/cm-dogfood-library:src/index.ts` (modify) `reserveBook`
- `matejamilosevic/cm-dogfood-library:test/reservations.test.ts` (create) `reservations`
- `matejamilosevic/cm-dogfood-library:test/loans.test.ts` (modify) `loans`
- `matejamilosevic/cm-dogfood-library:test/http.test.ts` (modify) `http`

## Data model changes
No persistent storage, SQL database, or schema migrations exist in this service. In-memory data structures are extended as follows:

1. **`Reservation` entity** (in `src/types.ts` and managed in `src/reservations.ts` via `Map<ReservationId, Reservation>`):
   - `id`: string (`ReservationId`, e.g., `"res-1"`)
   - `bookId`: string (`BookId`)
   - `memberId`: string (`MemberId`)
   - `createdAt`: string (ISO-8601 timestamp string)
   - `status`: `'pending' | 'held' | 'fulfilled' | 'cancelled'`

2. **`Book` availability attribute**:
   - `availableCopies`: number (calculated dynamically in `availableCopies(bookId)` and exposed in HTTP book representations).

## API changes
### 1. `GET /books`
- **Contract**: `GET /books`
- **Authentication / Authorization**: None (public)
- **Request body**: None
- **Response body**: Status 200 OK
  ```json
  {
    "books": [
      {
        "id": "b-1",
        "isbn": "9780140449136",
        "title": "The Odyssey",
        "author": "Homer",
        "copies": 2,
        "availableCopies": 2
      }
    ]
  }
  ```
- **Error codes**: None

### 2. `GET /books/:id-or-isbn`
- **Contract**: `GET /books/:id-or-isbn`
- **Authentication / Authorization**: None (public)
- **Request body**: None
- **Response body**: Status 200 OK
  ```json
  {
    "book": {
      "id": "b-2",
      "isbn": "9780141439518",
      "title": "Pride and Prejudice",
      "author": "Jane Austen",
      "copies": 1,
      "availableCopies": 0
    }
  }
  ```
- **Error codes**:
  - 404 `book_not_found`: When no book matches the ID or ISBN.

### 3. `POST /reservations`
- **Contract**: `POST /reservations`
- **Authentication / Authorization**: None
- **Request body**:
  ```json
  {
    "bookId": "b-2",
    "memberId": "m-1",
    "email": "ada@library.test"
  }
  ```
  *(Either `memberId` or `email` is required alongside `bookId`)*
- **Response body**: Status 201 Created
  ```json
  {
    "reservation": {
      "id": "res-1",
      "bookId": "b-2",
      "memberId": "m-1",
      "createdAt": "2026-09-23T12:00:00.000Z",
      "status": "pending"
    }
  }
  ```
- **Error codes**:
  - 400 `invalid_json`: Unparseable request payload.
  - 400 `missing_book_or_member`: `bookId` missing or neither `memberId` nor `email` provided.
  - 404 `unknown_book`: `bookId` does not match any catalog book.
  - 404 `unknown_member`: Member cannot be found by ID or email.
  - 409 `copies_available`: Book has one or more unreserved copies on shelf (`availableCopies >= 1`).
  - 409 `duplicate_reservation`: Member already has an active (`pending` or `held`) reservation for this book.

### 4. `POST /reservations/:id/cancel`
- **Contract**: `POST /reservations/:id/cancel`
- **Authentication / Authorization**: None
- **Request body**: None
- **Response body**: Status 200 OK
  ```json
  {
    "reservation": {
      "id": "res-1",
      "bookId": "b-2",
      "memberId": "m-1",
      "createdAt": "2026-09-23T12:00:00.000Z",
      "status": "cancelled"
    }
  }
  ```
- **Error codes**:
  - 404 `reservation_not_found`: Reservation ID not found.
  - 409 `already_cancelled`: Reservation is already in `cancelled` status.
  - 409 `already_fulfilled`: Reservation is already in `fulfilled` status.

### 5. `POST /loans` (Modified)
- **Contract**: `POST /loans`
- **Authentication / Authorization**: None
- **Request body**: `{ "bookId": "b-1", "memberId": "m-1" }` or `{ "bookId": "b-1", "email": "ada@library.test" }`
- **Response body**: Status 201 Created `{ "loan": Loan }`
- **Error codes**:
  - 400 `invalid_json`, `missing_book_or_member`
  - 404 `unknown_book`, `unknown_member`
  - 409 `no_copies_available`: All copies checked out or held.
  - 409 `copy_held_for_other_member`: Returned copy is held for a different member at the head of the reservation line.

### 6. `POST /loans/:id/return` (Modified)
- **Contract**: `POST /loans/:id/return`
- **Authentication / Authorization**: None
- **Request body**: None
- **Response body**: Status 200 OK `{ "loan": Loan }`
- **Error codes**:
  - 404 `unknown_loan`
  - 409 `already_returned`

## Migration / rollout
1. **Rollout Controls**: No feature flags or storage migration locks are required. The in-memory desk deploys atomically upon process restart.
2. **Rollout Sequence**: Build TypeScript with `npm run build` and launch process via `npm start`. All in-memory structures initialize clean.
3. **Rollback Strategy**: If regressions occur, revert the commit and restart the service. Because state is in-memory only, no storage rollbacks or migration reversions are needed.

## Operational considerations
- **Observability / Telemetry**: Server startup emits port binding information to standard output (`cm-dogfood-library listening on http://localhost:${port}`). HTTP status codes should be monitored: 201 for reservations and checkouts; 409 for reservation rejections (when shelf copies are available or duplicate reservations occur) and checkout conflicts.
- **Background Processing**: None. All queue mutations, hold evaluations, and transfers occur synchronously within request handling.
- **Error Handling**: Missing books/members return 404; state validation failures (e.g. reserving an available book or duplicate reservations) return 409.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/cm-dogfood-library | Yes | Single in-memory library service owning catalog, loans, reservations, and HTTP API. | 1 |

## Repository scope
Single repository: `matejamilosevic/cm-dogfood-library`. All changes are self-contained within this repository.

## Risks
1. **Condition**: An active hold is not properly fulfilled when the designated member completes checkout.
   **Blast Radius**: The member obtains a loan while their reservation remains in 'held' status, permanently locking the next copy or causing incorrect availability calculations.
   **Mitigation**: In `src/loans.ts:checkout`, query `getHeldReservationForMember(bookId, memberId)` and mark it 'fulfilled' atomically before completing the loan.

2. **Condition**: A member cancels a held reservation when another member is waiting in line.
   **Blast Radius**: The held returned copy could erroneously revert to shelf availability instead of transferring to the next member in the FIFO queue.
   **Mitigation**: Implement explicit hold reallocation in `src/reservations.ts:cancelReservation` that reassigns the hold to the next 'pending' reservation in FIFO queue order before returning.

3. **Condition**: High frequency concurrent checkout and reservation requests in a single Node.js event tick.
   **Blast Radius**: Race condition causing two members to reserve when 1 copy becomes available or checkout conflicts.
   **Mitigation**: Because Node.js executes JavaScript on a single thread and all mutations are synchronous in-memory Map operations, state transitions are inherently serialized and atomic.

## Alternatives considered
1. **Embedding Reservation Logic Directly in `src/loans.ts`**:
   - *Approach*: Add reservation maps and helper methods directly inside `src/loans.ts` without creating `src/reservations.ts`.
   - *Rejection Reason*: Violates separation of concerns. `loans.ts` manages active and historical loan agreements; waitlist queues and reservation state transitions represent a distinct business domain.
   - *Residual Risk*: None; creating `src/reservations.ts` provides clearer testing and modularity.

2. **Automatic Loan Generation on Return (`FR-007` alternative)**:
   - *Approach*: When a book is returned, automatically convert the front-of-line reservation into an active loan for that member without requiring manual checkout.
   - *Rejection Reason*: Explicitly prohibited by `FR-007` and ticket requirements: 'That member still has to check it out themselves. The reservation does not become a loan on its own.'
   - *Residual Risk*: Members who have held copies must be informed/checked out manually, but notifications and account automation are explicitly out of scope.

## Requirement mapping
- **FR-001** — addressed: Planned: Update `src/http.ts` (`GET /books` and `GET /books/:id-or-isbn`) and `src/loans.ts` (`availableCopies`) to compute and expose `availableCopies` reflecting deductions from active loans and held reservations alongside total copies owned `copies`.
- **FR-002** — addressed: Planned: Create `POST /reservations` in `src/http.ts` and `reserveBook` in `src/reservations.ts` accepting `bookId` and either `memberId` or `email`.
- **FR-003** — addressed: Planned: In `src/reservations.ts:reserveBook`, reject reservation attempts with error `copies_available` when `availableCopies(bookId) >= 1`.
- **FR-004** — addressed: Planned: In `src/reservations.ts:reserveBook`, verify that the member has no active (`pending` or `held`) reservation for the book; reject duplicates with error `duplicate_reservation`.
- **FR-005** — addressed: Planned: In `src/reservations.ts`, maintain reservations in strict FIFO order by setting `createdAt` timestamp and serving pending reservations in insertion order.
- **FR-006** — addressed: Planned: In `src/loans.ts:returnLoan`, check for pending reservations upon return; if present, allocate the returned copy as held for the front-of-line reservation.
- **FR-007** — addressed: Planned: In `src/loans.ts:returnLoan` and `src/reservations.ts`, set reservation status to `'held'` on return without creating an active loan; require explicit checkout via `POST /loans`.
- **FR-008** — addressed: Planned: In `src/loans.ts:checkout`, reject checkout attempts by any member other than the member for whom the copy is currently held while an active hold exists.
- **FR-009** — addressed: Planned: In `src/loans.ts:checkout`, when the member holding the reservation checks out the book, mark their reservation `'fulfilled'` and create a standard loan.
- **FR-010** — addressed: Planned: Implement `POST /reservations/:id/cancel` in `src/http.ts` and `cancelReservation` in `src/reservations.ts` to cancel an active reservation by ID.
- **FR-011** — addressed: Planned: In `src/reservations.ts:cancelReservation`, if the cancelled reservation had an active hold, reallocate the hold to the next member in the queue or release to shelf inventory if queue is empty.
- **FR-012** — already_satisfied: Already satisfied in `src/catalog.ts` (`findBookByIsbn`, `getBook`) and `src/http.ts` where book lookup by ID or formatted/unformatted ISBN is implemented.
- **FR-013** — already_satisfied: Already satisfied in `src/loans.ts` (`checkout`, `returnLoan`) and `src/http.ts` (`POST /loans`, `POST /loans/:id/return`) where unreserved checkout supports memberId or email and 21-day loan calculation.
- **SC-001** — addressed: Planned: Verify through tests in `test/http.test.ts` that 100% of responses from `GET /books` and `GET /books/:id-or-isbn` report accurate `availableCopies` matching total copies minus active loans and held reservations.
- **SC-002** — addressed: Planned: Verify through tests in `test/reservations.test.ts` that 100% of reservation attempts for books with available shelf copies or from members with existing active reservations are rejected.
- **SC-003** — addressed: Planned: Verify through tests in `test/loans.test.ts` that when a copy is returned for a reserved book, 100% of checkout attempts by non-front-of-line members are rejected until hold is fulfilled or cancelled.
- **SC-004** — addressed: Planned: Verify through tests in `test/reservations.test.ts` that 100% of reservation cancellations immediately reallocate held copies to the subsequent queue member or release the copy to open shelf availability.

## ADR references
