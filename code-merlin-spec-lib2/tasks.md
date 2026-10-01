<!--
Artifact: tasks
Version ID: 852b20e0-e5c9-4edb-9d04-1f4c0bc6f6b4
Approval Status: approved
Approved At: 2026-09-23T14:34:30.759Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: a61aa991-d7cc-4f73-b12e-2e3840200f05
Work Item URL: https://staging.codemerlin.ai/work-items/a61aa991-d7cc-4f73-b12e-2e3840200f05?tab=tasks
-->

# Tasks

## matejamilosevic/cm-dogfood-library

### Task 1: Define Reservation types and availability extensions in domain contracts
- Done when:
  - `src/types.ts` defines `ReservationId`, `ReservationStatus` (`'pending' | 'held' | 'fulfilled' | 'cancelled'`), and `Reservation` entity contract
  - `Book` in `src/types.ts` supports optional or enriched `availableCopies: number`
  - `npm run typecheck` passes with no type errors

### Task 2: [US1] Expose on-shelf availability in catalog lookups and loans calculation
- Done when:
  - `src/loans.ts:availableCopies` calculates available copies as `Math.max(0, book.copies - activeLoansCount - heldReservationsCount)`
  - `src/http.ts` enriches `GET /books` list entries with `availableCopies` alongside `copies`
  - `src/http.ts` enriches `GET /books/:id-or-isbn` response with `availableCopies` alongside `copies`
  - When Pride and Prejudice (`b-2`) has an active loan, `availableCopies` reports `0` while `copies` remains `1`

### Task 3: [US2] Implement reservation creation and queue management in reservations module and HTTP API
- Done when:
  - `src/reservations.ts` implements `reserveBook({ bookId, memberId })` maintaining FIFO ordering by creation time
  - `reserveBook` rejects with `copies_available` when `availableCopies(bookId) >= 1` (AC-004, FR-003, SC-002)
  - `reserveBook` rejects with `duplicate_reservation` when the member already has a pending or held reservation for that book (AC-005, FR-004, SC-002)
  - `src/http.ts` routes `POST /reservations` parsing `bookId` and resolving `memberId` or `email`
  - `src/index.ts` re-exports public reservation functions and types

### Task 4: [US3] Allocate exclusive hold on returned loans and enforce manual checkout authorization
- Done when:
  - `src/loans.ts:returnLoan` allocates returned copies to the front-of-line pending reservation as `'held'` instead of auto-creating a loan (AC-006, FR-006, FR-007)
  - `src/loans.ts:checkout` rejects checkout attempts with `copy_held_for_other_member` when another member holds the reservation (AC-007, FR-008, SC-003)
  - `src/loans.ts:checkout` succeeds when called by the held member, transitions the reservation to `'fulfilled'`, and generates a 21-day loan (AC-008, FR-009)

### Task 5: [US4] Implement reservation cancellation and hold reallocation
- Done when:
  - `src/reservations.ts:cancelReservation` transitions an active reservation to status `'cancelled'`
  - If the cancelled reservation was holding a copy, the hold immediately transfers to the next member in the FIFO queue, or reverts to shelf inventory if no reservations remain (AC-010, FR-011, SC-004)
  - `src/http.ts` implements `POST /reservations/:id/cancel` returning `200 OK` with updated reservation or appropriate error (`404 reservation_not_found`, `409 already_cancelled`)

### Task 6: Coverage deferral: Preserved catalog lookup by ISBN and unreserved checkout baseline
- Kind: Coverage Deferral
- Done when:
  - FR-012 (catalog lookup by id or isbn) and FR-013 (unreserved checkout and return) are already satisfied in existing repository implementation (`src/catalog.ts`, `src/loans.ts`, `src/http.ts`) per approved technical plan mapping
  - Existing behavior is preserved with zero breaking changes to baseline lookup and checkout

### Task 7: Verify shelf availability reporting in HTTP catalog and book detail endpoints
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` executes Scenario 1: `GET /books` and `GET /books/b-1` return status 200 with `copies: 2` and `availableCopies: 2`
  - `test/http.test.ts` executes Scenario 2: When `b-2` has an active loan, `GET /books` and `GET /books/b-2` return status 200 with `copies: 1` and `availableCopies: 0`
  - `npm test` passes for availability assertions (SC-001)

### Task 8: Verify reservation placement, validation rejections, and email resolution
- Kind: Repo Validation
- Done when:
  - `test/reservations.test.ts` executes Scenario 3: `POST /reservations` for `b-2` with `memberId` returns 201 with status `pending`
  - `test/reservations.test.ts` executes Scenario 4: `POST /reservations` for available book `b-1` returns 409 `copies_available`
  - `test/reservations.test.ts` executes Scenario 5: Duplicate reservation attempt returns 409 `duplicate_reservation`
  - `test/reservations.test.ts` executes Scenario 6: Reservation with `email: alan@library.test` returns 201 with resolved `memberId`

### Task 9: Verify hold allocation on return and checkout enforcement in loans module
- Kind: Repo Validation
- Done when:
  - `test/loans.test.ts` executes Scenario 7: Returning loan transitions front reservation to `held` without auto-loan and keeps `availableCopies` at 0
  - `test/loans.test.ts` executes Scenario 8: Checkout by non-front member rejects with 409 `copy_held_for_other_member`
  - `test/loans.test.ts` executes Scenario 9: Checkout by held member succeeds (201 Created), generates loan, and sets reservation to `fulfilled`

### Task 10: Verify cancellation, hold reallocation, and cancellation error handling
- Kind: Repo Validation
- Done when:
  - `test/reservations.test.ts` executes Scenario 10: Member cancels pending reservation returning 200 with status `cancelled`
  - `test/reservations.test.ts` executes Scenario 11: Cancelling held reservation transfers hold immediately to next person in queue
  - `test/reservations.test.ts` executes Scenario 12: Cancelling sole held reservation returns copy to shelf (`availableCopies` increments to 1)
  - `test/reservations.test.ts` executes Scenario 13: Nonexistent reservation cancel returns 404, duplicate cancel returns 409 `already_cancelled`
