# LIB-3 tasks

- Work item: LIB-3 (`9564907a-67c4-4350-85d0-a05e5fb442a9`)
- Title: Library desk in the browser
- Category: tasks
- Approval: approved
- Version: `b48a25d4-39c0-40af-8bd7-023b984d5479`
- Approved at: 2026-10-01T10:19:15.360Z
- Approved by: Mateja Milosevic (`a60f8343-5bb4-43b1-b676-35b91cf79f72`)
- Evaluation time: 2026-10-01T10:19:58.703Z
- Member link: https://staging.codemerlin.ai/work-items/9564907a-67c4-4350-85d0-a05e5fb442a9?tab=tasks
- Implementation readiness: readyForHandoff=false; evaluatedAt=2026-10-01T10:19:41.003Z; rollupDigest=`5c68bc0cd31016aeae1f52c05940ebda`

---

# Tasks

## matejamilosevic/library

### Task 1: Support optional headers in HttpResult, raw string response handling, and member reservations lookup
- Done when:
  - `src/http.ts` extends `HttpResult` with optional `headers?: Record<string, string>` and exports it
  - `src/server.ts` writes custom headers from `result.headers` when present (defaulting to `application/json`), writing string bodies directly without `JSON.stringify`
  - `src/reservations.ts` exports `listReservationsForMember(memberId: MemberId): Reservation[]`
  - `src/http.ts` handles `GET /members/:id/reservations`, returning 200 with `{ reservations }` or 404 `{ error: 'member_not_found' }`

### Task 2: [US1] Implement browser library desk layout, member selector, and catalog availability display
- Done when:
  - `src/desk.ts` implements and exports `renderDeskHtml(): string` returning an interactive HTML5 document
  - `src/http.ts` dispatches `GET /` to `renderDeskHtml()` returning status 200 with header `'content-type': 'text/html; charset=utf-8'`
  - Desk UI presents an identity selector for Ada Lovelace (`m-1`), Alan Turing (`m-2`), and Grace Hopper (`m-3`), establishing the active member without login credentials
  - Catalog view lists all seeded titles (The Odyssey, Pride and Prejudice, A Short History of Nearly Everything, Frankenstein) alongside their available copy counts
  - Switching members updates the active context without page reload failure

### Task 3: [US2] Add checkout and loan return workflows to the browser desk UI
- Done when:
  - When a book has at least 1 copy available, the desk UI allows the selected member to trigger checkout via `POST /loans` creating a 21-day loan
  - Active loans for the selected member are displayed with title and 21-day due date
  - Active loans render a return action button invoking `POST /loans/:id/return`
  - Returning a loan updates loan status and immediately restores catalog copy availability

### Task 4: [US3] Add hold/reservation placement, status tracking, and copy pickup fulfillment to desk UI
- Done when:
  - When available copies reach 0, desk UI allows placing a hold (`POST /holds`) or reservation (`POST /reservations`)
  - Holds and reservations for the active member are rendered showing active status (`waiting`, `pending`, `notified`, `held`)
  - For ready items (`notified` or `held`), the UI presents the 7-day pickup deadline and an action button to execute pickup
  - Pickup triggers `POST /loans` to convert the ready item into a new 21-day loan
  - Policy rejections (such as 3-hold limit `hold_limit_exceeded` or `duplicate_hold`) display user-visible feedback

### Task 5: Verify GET / root desk HTML serving and catalog display (Scenario 1)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` sends `GET /` and verifies status 200 with `'content-type': 'text/html; charset=utf-8'`
  - Verifies HTML body contains member identities Ada Lovelace (`m-1`), Alan Turing (`m-2`), Grace Hopper (`m-3`)
  - Verifies HTML body includes seeded catalog titles and available copy counts

### Task 6: [P] Verify active member switch context and loans/holds update (Scenario 2)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` validates that switching member context to Alan Turing (`m-2`) resolves active loans and holds for `m-2` without login
  - Verifies operation and response dispatch execute without error

### Task 7: [P] Verify empty loan and hold states for member with no borrowings (Scenario 3)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies querying loans, holds, and reservations for member Grace Hopper (`m-3`) returns empty collections
  - Confirms desk structure accommodates empty state display

### Task 8: [P] Verify desk checkout creating 21-day loan and decrementing available copies (Scenario 4)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` validates checkout of 'b-1' for Ada Lovelace (`m-1`)
  - Asserts loan due date is 21 days from today and available copies decreases from 2 to 1

### Task 9: [P] Verify active loan return restoring copy availability (Scenario 5)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` validates returning an active loan for 'b-1'
  - Asserts loan is returned and available copies increments back to 2

### Task 10: [P] Verify hold placement and waiting queue tracking on exhausted book (Scenario 6)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` depletes available copies of 'b-2' and places hold for Alan Turing (`m-2`)
  - Asserts hold status is 'waiting'

### Task 11: [P] Verify hold status transition to notified with 7-day pickup deadline upon copy return (Scenario 7)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` returns active loan satisfying waiting hold for Alan Turing (`m-2`)
  - Asserts hold transitions to 'notified' with 7-day expiration deadline

### Task 12: [P] Verify member pickup converting notified hold into active loan (Scenario 8)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` executes pickup for Alan Turing's notified hold
  - Asserts hold is 'fulfilled' and new 21-day loan is created

### Task 13: [P] Verify hold rejection on reaching 3-hold limit (Scenario 9)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` places 3 active holds for Ada Lovelace (`m-1`) and attempts a fourth
  - Asserts response status is 409 with error code 'hold_limit_exceeded'

### Task 14: [P] Verify rejection of duplicate hold for same title by same member (Scenario 10)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` attempts duplicate hold on 'b-2' for member with active hold
  - Asserts response status is 409 with error code 'duplicate_hold'

### Task 15: [P] Verify GET /members/:id/reservations endpoint and unknown member rejection (Scenario 11)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` tests `GET /members/m-1/reservations` returning 200 with reservations array
  - Tests `GET /members/m-999/reservations` returning 404 with error code 'member_not_found'

### Task 16: Verify complete browser desk end-to-end journey (Scenario 12)
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` executes end-to-end workflow: desk load, checkout, exhaustion, Alan hold placement, Ada return, notification, and pickup fulfillment
  - Asserts end-to-end state consistency across all stages
