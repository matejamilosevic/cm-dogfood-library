<!--
Artifact: tasks
Version ID: 97706b4a-bf62-463c-81fd-7a769a7e1912
Approval Status: approved
Approved At: 2026-09-18T14:41:30.888Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: b3272e5a-7bf5-426c-9072-54375895d5b6
Work Item URL: https://staging.codemerlin.ai/work-items/b3272e5a-7bf5-426c-9072-54375895d5b6?tab=tasks
-->

# Tasks

## matejamilosevic/library

### Task 1: Preserved catalog lookup behavior is already satisfied in the repository
- Kind: Coverage Deferral
- Done when:
  - FR-001 is already satisfied in the repository (`src/catalog.ts`, `src/loans.ts`, `GET /books`, `GET /books/:id-or-isbn`). No implementation change required.

### Task 2: Preserved standard loan checkout behavior is already satisfied in the repository
- Kind: Coverage Deferral
- Done when:
  - FR-002 is already satisfied in the repository (`src/loans.ts`, `POST /loans`). Standard 21-day loan checkout when copies exist is already implemented.

### Task 3: Preserved loan return behavior is already satisfied in the repository
- Kind: Coverage Deferral
- Done when:
  - FR-003 is already satisfied in the repository (`src/loans.ts`, `POST /loans/:id/return`). Returning loans and restoring basic availability is already implemented.

### Task 4: Add Hold, HoldStatus, and Notification type contracts
- Done when:
  - Define `HoldStatus` union type (`'waiting' | 'notified' | 'fulfilled' | 'expired' | 'cancelled'`) in `src/types.ts`
  - Define `Hold` interface with `id`, `bookId`, `memberId`, `status`, `createdAt`, `notifiedAt`, and `expiresAt` in `src/types.ts`
  - Define `Notification` interface with `id`, `memberId`, `holdId`, `bookId`, `createdAt`, `expiresAt`, and `message` in `src/types.ts`
  - Export hold and notification types from `src/index.ts`
  - Type check passes via `npm run typecheck`

### Task 5: [US3] Implement in-memory hold queue management, 3-hold limit, and FIFO ordering
- Done when:
  - Create `src/holds.ts` containing in-memory stores for holds and notifications
  - Implement `placeHold({ bookId, memberId })` enforcing hold creation if and only if available copies for that title equal 0 (AC-005, AC-006, FR-004)
  - Reject hold creation with 409 `copies_available` when available copies > 0 (AC-006, FR-004)
  - Enforce strict maximum limit of 3 active holds (`waiting` or `notified`) per member across catalog titles, rejecting additions with 409 `hold_limit_exceeded` (AC-007, FR-005, SC-004)
  - Maintain holds in strict FIFO sequence order per book title with timestamped sequence rank (FR-006, SC-001)
  - Reject duplicate hold placement when member already has an active hold on the title with 409 `duplicate_hold`
  - Implement `listHoldsForMember(memberId)` and `resetHoldsForTests()` in `src/holds.ts`
  - Re-export hold functions from `src/index.ts`

### Task 6: [US4] Implement return notification allocation, 7-day pickup deadline, expiration promotion, and priority checkout protection
- Done when:
  - Implement `processReturnForHolds(bookId)` in `src/holds.ts` assigning returned copy to longest-waiting active hold, setting status to `notified`, setting `expiresAt` to 7 calendar days from notification, and creating in-app `Notification` record (AC-008, FR-007, SC-003)
  - Update `returnLoan` in `src/loans.ts` to invoke `processReturnForHolds(bookId)` upon return of a held book (FR-007, SC-003)
  - Update `checkout` in `src/loans.ts` to restrict checkout of hold-reserved copies exclusively to the notified member, rejecting non-notified members with `queue_priority_conflict` (AC-009, FR-008, SC-002)
  - Mark hold `fulfilled` upon successful checkout by notified member
  - Implement `processHoldExpiration(bookId)` in `src/holds.ts` transitioning expired 7-day notified holds to `expired` and immediately promoting next waiting member or releasing copy (AC-10, FR-009)
  - Implement `listNotificationsForMember(memberId)` in `src/holds.ts` and re-export from `src/index.ts`

### Task 7: [US3] [US4] Expose holds and notifications HTTP routes and queue priority error handling
- Done when:
  - In `src/http.ts`, handle `POST /holds` with body `{ "bookId": "...", "memberId": "..." }` or `{ "email": "..." }`, returning 201 `{ "hold": ... }` or errors (400, 404, 409 `copies_available`, `duplicate_hold`, `hold_limit_exceeded`)
  - In `src/http.ts`, handle `GET /members/:id/holds` returning 200 `{ "holds": [ ... ] }` or 404
  - In `src/http.ts`, handle `GET /members/:id/notifications` returning 200 `{ "notifications": [ ... ] }` or 404
  - In `src/http.ts`, update `POST /loans` error handling to return 409 for `queue_priority_conflict`

### Task 8: Verify book lookup by ID or ISBN with available copies
- Kind: Repo Validation
- Done when:
  - Execute scenario 1: Verify catalog book b-1 lookup by ID and ISBN returns 2 total copies and 2 available copies (AC-001, FR-001)
  - Focused tests pass

### Task 9: Verify book lookup with zero available copies indicates hold eligibility
- Kind: Repo Validation
- Done when:
  - Execute scenario 2: Look up fully checked out book b-2 via `GET /books/b-2` and verify response returns 0 available copies and indicates hold placement is eligible (AC-002, FR-001, FR-004)
  - Focused tests pass

### Task 10: Verify standard checkout creates 21-day loan and return restores availability
- Kind: Repo Validation
- Done when:
  - Execute scenario 3: Member m-1 checks out book b-1, verify 21-day due date and copy decrement, then return loan and verify availability is restored (AC-003, AC-004, FR-002, FR-003)
  - Focused tests pass

### Task 11: Verify hold placement on 0-availability title enters FIFO queue
- Kind: Repo Validation
- Done when:
  - Execute scenario 4: Place holds for member m-1 and m-2 on 0-availability book b-2 and verify timestamped sequence ranks maintaining FIFO order (AC-005, FR-004, FR-006, SC-001)
  - Focused tests pass

### Task 12: Verify hold placement is rejected when copies are available on shelf
- Kind: Repo Validation
- Done when:
  - Execute scenario 5: Attempt hold placement on book b-1 with 2 available copies and verify rejection prompting direct checkout (AC-006, FR-004)
  - Focused tests pass

### Task 13: Verify maximum limit of 3 active holds per member enforcement
- Kind: Repo Validation
- Done when:
  - Execute scenario 6: Given member m-1 has 3 active holds across titles, attempt 4th hold and verify rejection due to active hold limit (AC-007, FR-005, SC-004)
  - Focused tests pass

### Task 14: Verify loan return notifies first member in queue with 7-day pickup deadline
- Kind: Repo Validation
- Done when:
  - Execute scenario 7: Return loan for held book b-2 and verify earliest waiting hold is updated to notified with 7-day pickup deadline and in-app notification record is produced within 500ms (AC-008, FR-007, SC-003)
  - Focused tests pass

### Task 15: Verify rejection of checkout attempt by non-notified member during hold reservation
- Kind: Repo Validation
- Done when:
  - Execute scenario 8: Attempt checkout of hold-reserved book b-2 by non-notified member m-2 and verify rejection with queue priority conflict error (AC-009, FR-008, SC-002)
  - Focused tests pass

### Task 16: Verify hold expiration and automatic promotion of next waiting member
- Kind: Repo Validation
- Done when:
  - Execute scenario 9: Expire 7-day pickup deadline for notified member m-1 on book b-2 and verify hold transitions to expired and next waiting member m-2 is promoted to notified with new 7-day deadline (AC-10, FR-009)
  - Focused tests pass

### Task 17: Verify end-to-end journey from search to hold placement, return notification, and priority checkout
- Kind: Repo Validation
- Done when:
  - Execute scenario 10: Complete lifecycle journey where member m-1 checks out book b-2, member m-2 searches b-2 seeing 0 copies and places waitlist hold, member m-3 is blocked from checkout, m-1 returns b-2, m-2 is notified with 7-day window and successfully checks out b-2 (AC-001, AC-002, AC-005, AC-008, AC-009, FR-001, FR-004, FR-007, FR-008)
  - All tests in test suite pass (`npm test`)