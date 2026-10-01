# LIB-3 specification

- Work item: LIB-3 (`9564907a-67c4-4350-85d0-a05e5fb442a9`)
- Title: Library desk in the browser
- Category: specification
- Approval: approved
- Version: `d7a0ca83-4460-4e66-a9ce-303a7bc94f4f`
- Approved at: 2026-10-01T10:00:00.087Z
- Approved by: Mateja Milosevic (`a60f8343-5bb4-43b1-b676-35b91cf79f72`)
- Evaluation time: 2026-10-01T10:19:56.352Z
- Member link: https://staging.codemerlin.ai/work-items/9564907a-67c4-4350-85d0-a05e5fb442a9?tab=specification
- Implementation readiness: readyForHandoff=false; evaluatedAt=2026-10-01T10:19:41.003Z; rollupDigest=`5c68bc0cd31016aeae1f52c05940ebda`

---

# Specification: Library Desk in the Browser

## Outcome
Provide an interactive, browser-accessible desk interface served directly by the library server so that members can choose their identity (Ada, Alan, or Grace), view catalog titles with available copy counts, check out available copies for 21-day loan periods, return active loans, place holds or reservations when inventory is exhausted, track hold/reservation status, and pick up ready copies.

## Current behavior
- The library runs an in-memory Node.js HTTP service on port 3456 (`src/server.ts`, `src/http.ts`) that handles JSON API requests (`GET /books`, `GET /books/:id-or-isbn`, `POST /loans`, `POST /loans/:id/return`, `POST /holds`, `GET /members/:id/holds`, `GET /members/:id/notifications`, `GET /members/:id/loans`, `POST /reservations`, `POST /reservations/:id/cancel`).
- Three seeded members exist (`src/members.ts`): Ada Lovelace (`m-1`), Alan Turing (`m-2`), and Grace Hopper (`m-3`).
- Checkout enforces 21-day due dates and decreases available copies (`src/loans.ts`).
- Holds and reservations allow queueing when zero copies are available, enforcing a 3-hold limit per member, queue ordering, and a 7-day pickup window upon notification (`src/holds.ts`, `src/reservations.ts`).
- Today, no web page or desk HTML UI is served; non-API web browser navigation to `/` or other routes returns `404` (`src/http.ts`, `src/server.ts`).

## User Stories

### User Story 1 — Browse Catalog & Select Active Member (Priority: P1)
As a library patron visiting the library desk in a browser, I want to choose my member identity from Ada, Alan, or Grace and view all titles with their live available copy counts so that I can see what I can borrow.
- **Why this priority**: Choosing identity and viewing real-time availability is the prerequisite for all borrowing and queueing interactions.
- **Independent Test**: Open the desk URL in a browser, select member Ada Lovelace, and verify that all catalog titles and their current remaining copies are displayed.
- **Acceptance Scenarios**:
  - AC-001: Given a browser navigating to the desk route on the server, When the page loads, Then an identity selector presents the three seeded members (Ada, Alan, Grace) and a catalog view renders each book's title and remaining available copy count.
  - AC-002: Given the desk view, When the selected member changes from Ada to Alan, Then the desk updates the active member context for subsequent checkout, return, hold, or pickup actions without requiring server login.

### User Story 2 — Borrow and Return Books from the Desk (Priority: P2)
As an active library patron at the browser desk, I want to check out an available book copy for a 21-day loan and return an active loan so that I can manage my physical reading materials directly in the browser.
- **Why this priority**: Checking out and returning items are the primary transactions of the library service.
- **Independent Test**: With Ada selected, initiate checkout on a title with available copies, verify the copy count decreases and loan is recorded, then return the loan and verify availability increments.
- **Acceptance Scenarios**:
  - AC-003: Given a book with at least 1 copy available, When the selected member submits a checkout request from the desk, Then a new loan is created for 21 days, the book's remaining copy count decreases, and the member's active loan list displays the borrowed title and due date.
  - AC-004: Given an active loan belonging to the selected member, When the member clicks return on that loan in the desk UI, Then the loan is marked returned, the book's available inventory increases, and the loan moves out of active status.

### User Story 3 — Place Holds, Track Status, and Pick Up Ready Copies (Priority: P3)
As a library patron viewing a book with zero copies available, I want to place a hold or reservation, view its queue/readiness status, and pick up the copy when it becomes ready for me so that I do not miss out on borrowed materials.
- **Why this priority**: When stock is depleted, patrons need waitlist access and fulfillment workflows to obtain books as soon as they are returned.
- **Independent Test**: Deplete all copies of a book, place a hold or reservation for Alan, return a copy from another member's loan, verify Alan's status changes to ready/notified with an expiration date, and pick up the ready copy.
- **Acceptance Scenarios**:
  - AC-005: Given a book with 0 copies available, When the selected member requests a hold or reservation from the desk, Then the request is accepted, and the member's desk view displays the hold/reservation with its active queue status (`waiting` or `pending`).
  - AC-006: Given a returned copy that satisfies a member's waiting hold or reservation, When the member views the desk, Then the status indicates the copy is ready for pickup with its 7-day pickup deadline.
  - AC-007: Given a hold or reservation marked ready for pickup for the selected member, When the member triggers pickup from the desk, Then the copy is checked out to that member, fulfilling the hold/reservation.

## Functional Requirements
- FR-001 (New): The server must serve an interactive library desk web interface at `GET /` (or designated desk URL) returning an HTML document usable from standard web browsers [US1, AC-001].
- FR-002 (New): The desk UI must provide a member selector allowing the user to select between Ada Lovelace (`m-1`), Alan Turing (`m-2`), and Grace Hopper (`m-3`), establishing the active member for all desk actions without requiring authentication credentials [US1, AC-001, AC-002].
- FR-003 (New): The desk UI must list every catalog title alongside its current number of available copies, updating when inventory changes [US1, AC-001, AC-003, AC-004].
- FR-004 (New): When a book has at least one available copy, the desk UI must allow the selected member to trigger a checkout, invoking the existing loan creation with a standard 21-day duration and updating copy counts [US2, AC-003].
- FR-005 (New): The desk UI must display active loans for the selected member and provide a return action for each active loan, invoking the return operation and restoring copy availability [US2, AC-004].
- FR-006 (New): When a book has zero available copies, the desk UI must allow the selected member to submit a hold or reservation, respecting existing constraints (including the 3-hold limit and queue order) [US3, AC-005].
- FR-007 (New): The desk UI must display the selected member's active holds and reservations, showing current status (such as `waiting`, `pending`, or ready for pickup / `notified` / `held`) along with any applicable pickup deadline within the 7-day window [US3, AC-005, AC-006].
- FR-008 (New): When a copy is ready for pickup for the selected member, the desk UI must allow the member to complete the pickup, converting the ready hold/reservation into a completed checkout [US3, AC-007].

## Success Criteria
- SC-001: 100% of seeded catalog titles and their available copy counts are visible in a web browser without manual API calls [FR-001, FR-003].
- SC-002: Switching the active member selector in the browser updates visible member loans, holds, and reservation statuses within 1 second without page refresh failure [FR-002, FR-005, FR-007].
- SC-003: Completing a checkout action from the desk produces a loan with a due date exactly 21 days from the checkout date and decrements available copies by 1 [FR-004].
- SC-004: Returning an active loan from the desk restores book availability or promotes the next waiting hold/reservation immediately [FR-005, FR-007].
- SC-005: Members cannot place more than 3 active holds, and duplicate holds for the same title by the same member are rejected with user-visible feedback [FR-006].
- SC-006: A patron with a ready/notified hold can execute a pickup within the 7-day window directly from the desk UI, receiving an active loan [FR-008].

## Edge Cases
- Zero copies available: Checkout buttons are disabled or replaced with hold/reservation options when remaining copies reach 0.
- Hold limit exceeded: If a member already has 3 active holds, attempts to place a fourth hold from the desk display an error explaining the 3-hold limit.
- Duplicate holds/reservations: Placing a second hold or reservation on the same book by the same member displays an error without creating duplicate entries.
- Expired pickup window: Holds not picked up within the 7-day window transition to expired upon expiration processing, and the desk displays the updated status.
- Concurrent / race conditions: If another member claims the last available copy before a checkout click finishes, the desk receives the conflict and refreshes the title's status to 0 copies available.

## Out of Scope
- User authentication, passwords, or login workflows.
- Overdue fines, fee tracking, or payment processing.
- Email, SMS, or external notification dispatches.
- Persistent storage or database migration (state resets when the server stops).
- Altering existing loan lengths (21 days), hold limits (3 active holds), queue order algorithms, or the 7-day pickup window.

## Source Requirement Coverage

| Source AC | Covered by |
|---|---|
| FR-001 A member can open the desk and see each title with how many copies are still available. | AC-001, FR-001, FR-003, SC-001 |
| FR-002 A member can choose who they are (Ada, Alan, or Grace), check out a free copy for 21 days, and return it. | AC-001, AC-002, AC-003, AC-004, FR-002, FR-004, FR-005, SC-002, SC-003, SC-004 |
| FR-003 When nothing is left, a member can place a hold or a reservation from the desk, see that status, and pick up a copy when it is ready for them. | AC-005, AC-006, AC-007, FR-006, FR-007, FR-008, SC-005, SC-006 |
| Checkout, return, holds, and reservations already work in the API. This ticket only adds the desk. Do not change loan length, the 3-hold limit, queue order, or the 7-day pickup window. | FR-004, FR-005, FR-006, FR-007, FR-008, SC-003, SC-005, SC-006 |
| Out of scope: login, fines, email, and keeping data after the server stops. | OUT OF SCOPE — Explicitly excluded in Out of Scope section |
