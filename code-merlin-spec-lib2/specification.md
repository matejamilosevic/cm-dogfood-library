<!--
Artifact: specification
Version ID: 7209d203-5ace-435b-8e12-d4d2735ef828
Approval Status: approved
Approved At: 2026-09-23T12:52:34.319Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: a61aa991-d7cc-4f73-b12e-2e3840200f05
Work Item URL: https://staging.codemerlin.ai/work-items/a61aa991-d7cc-4f73-b12e-2e3840200f05?tab=specification
-->

## Outcome

Members can see the real-time count of copies currently on the shelf across the book catalog and individual book details. When all copies of a book are checked out, members can place a reservation to join a first-come, first-served queue; when a copy is returned, it is held exclusively for the member at the front of the line to check out manually. Members can cancel their reservation at any time, immediately passing any held copy or queue priority to the next person in line, while existing book lookup, checkout by member identifier or email, and return workflows remain fully functional.

## Current behavior

- `src/catalog.ts` (`listBooks`, `getBook`, `findBookByIsbn`): returns static `Book` objects where `copies` represents total copies owned, with no concept or reporting of on-shelf availability.
- `src/loans.ts` (`availableCopies`, `checkout`, `returnLoan`): calculates `availableCopies` purely as `book.copies - activeLoans`, allowing any member to check out a book whenever `availableCopies >= 1` without checking for reservations or held copies.
- `src/http.ts` (`handleRequest`): serves `GET /books` and `GET /books/:id-or-isbn` with total owned `copies` only; provides `POST /loans` and `POST /loans/:id/return` with no endpoints or controls for placing or cancelling book reservations.

## User Stories

### User Story 1 — View On-Shelf Book Availability (Priority: P1)

As a library member, I want to see how many copies of a book are currently on the shelf before checking out, so that I know immediately whether a copy is available without encountering checkout errors.

**Why this priority**: It solves the primary user visibility gap where members only discover a book is unavailable when checkout fails.

**Independent Test**: Fetch `GET /books` or `GET /books/:id-or-isbn` when all copies are checked out and verify that `availableCopies` (copies on shelf) reports 0 while total owned copies is preserved.

**Acceptance Scenarios**:
- `AC-001`: Given a book with 1 total copy owned and 0 active loans, When a member views the catalog (`GET /books`) or the book page (`GET /books/:id-or-isbn`), Then the response indicates that 1 copy is available on the shelf.
- `AC-002`: Given a book where all owned copies are checked out on active loans, When a member views the catalog or book details, Then the response indicates that 0 copies are available on the shelf.

### User Story 2 — Reserve a Fully Checked-Out Book (Priority: P2)

As a library member, I want to reserve a book when all its copies are checked out, so that I can get in line and wait for a copy to be returned.

**Why this priority**: It directly fulfills the core reservation journey, allowing members to join a waitlist instead of having to repeatedly retry checkout.

**Independent Test**: Check out all copies of a book, place a reservation for a member, and verify that the reservation is recorded with status pending; attempt placing a second reservation for the same member or on an available book and verify rejection.

**Acceptance Scenarios**:
- `AC-003`: Given a book with 0 copies left on the shelf, When an eligible member requests to reserve the book, Then a reservation is created in first-come, first-served order and confirmed.
- `AC-004`: Given a book that still has at least 1 copy available on the shelf, When a member requests to reserve the book, Then the request is rejected and no reservation is placed.
- `AC-005`: Given a member who already has an active reservation for a book, When that member attempts to reserve the same book again, Then the duplicate reservation request is rejected.

### User Story 3 — Exclusive Hold on Returned Copies and Checkout (Priority: P3)

As the member at the front of the reservation line, I want returned copies held exclusively for me, so that another member cannot take the returned copy before I check it out myself.

**Why this priority**: It ensures reservations are honored in FIFO order upon return, preventing non-reserved patrons or lower-priority queue members from skipping the line.

**Independent Test**: With one copy returned for a book that has an active reservation queue, verify that a checkout request by an unreserved member or a non-head member is rejected, and only the front-of-line member can complete checkout.

**Acceptance Scenarios**:
- `AC-006`: Given a book with an active reservation queue, When an active loan for that book is returned, Then the copy is marked as held for the member at the front of the line and is not converted into an automatic loan.
- `AC-007`: Given a book copy held for the member at the front of the reservation queue, When any other member attempts to check out the book, Then the checkout request is rejected.
- `AC-008`: Given a book copy held for the member at the front of the reservation queue, When that specific member checks out the book, Then the checkout succeeds, a loan is created, and their reservation is completed.

### User Story 4 — Cancel a Reservation (Priority: P4)

As a library member with a reservation, I want to cancel my reservation if I no longer need the book, so that the next person in line can claim the returned copy or advance in queue.

**Why this priority**: Allows patrons to opt out and keeps the queue moving without deadlocks when members change their minds.

**Independent Test**: Place two members in a reservation line, return a copy (holding it for member 1), cancel member 1's reservation, and verify that the hold immediately shifts to member 2.

**Acceptance Scenarios**:
- `AC-009`: Given a member with an active reservation, When the member cancels their reservation, Then the reservation is cancelled and removed from the active queue.
- `AC-010`: Given a returned copy currently held for member A and member B is next in line, When member A cancels their reservation, Then the hold on the copy transfers to member B.

### User Story 5 — Preserve Existing Lookup, Checkout, and Return Capabilities (Priority: P5)

As a library member, I want book lookup by ISBN, checkout with email or member ID, and returns to work exactly as they do today when no conflicting reservations exist, so that standard library operations are not disrupted.

**Why this priority**: Preserves existing functionality and regression-free backward compatibility.

**Independent Test**: Look up a book using an ISBN string with dashes, check out an unreserved book using an email address, and return the loan, verifying all responses match current baseline behavior.

**Acceptance Scenarios**:
- `AC-011`: Given an existing book in the catalog, When a member looks up the book by ISBN with or without hyphens, Then the book details and shelf availability are returned.
- `AC-012`: Given a book with available copies and no reservations, When a member checks out using their email address or member ID, Then the loan is created with a 21-day due date.
- `AC-013`: Given an active loan, When the loan is returned via its loan ID, Then the return is recorded with the return date and the copy is returned to inventory.

## Functional Requirements

- `FR-001`: Changed: The catalog list endpoint (`GET /books`) and single book lookup endpoint (`GET /books/:id-or-isbn`) must expose the count of copies currently available on the shelf (`availableCopies`), reflecting deductions from active loans and held reservations, alongside total copies owned (`copies`). [US1, AC-001, AC-002]
- `FR-002`: New: A member can submit a reservation request for a book specifying `bookId` and either `memberId` or `email`. [US2, AC-003, US5, AC-012]
- `FR-003`: New: Reserving a book is permitted only when zero unreserved copies remain on the shelf; if any copy is available, the reservation attempt must be rejected with an error. [US2, AC-004]
- `FR-004`: New: A member can place at most one active reservation for a given book; duplicate active reservation attempts by the same member for the same book must be rejected. [US2, AC-005]
- `FR-005`: New: Reservations for each book must be ordered and served in strict first-come, first-served (FIFO) sequence based on creation time. [US2, AC-003, US3, AC-006]
- `FR-006`: Changed: When a book loan is returned, if that book has pending reservations, the returned copy must be allocated as held for the member at the head of the reservation queue rather than made freely available. [US3, AC-006]
- `FR-007`: New: A held reservation must not automatically become a loan; the reserved member must explicitly check out the copy themselves. [US3, AC-006, AC-008]
- `FR-008`: Changed: Book checkout must reject checkout attempts by any member other than the member for whom the copy is currently held while an active hold exists on the copy. [US3, AC-007]
- `FR-009`: Changed: When the member with the active hold checks out the book, their reservation is marked fulfilled and a standard loan is created. [US3, AC-008]
- `FR-010`: New: A member can cancel their active reservation using the reservation identifier. [US4, AC-009]
- `FR-011`: New: If a cancelled reservation had an active hold on a returned copy, the hold must immediately transfer to the next member in the reservation queue, or revert to shelf inventory if no further reservations exist. [US4, AC-010]
- `FR-012`: Preserved: Looking up books by catalog identifier or formatted/unformatted ISBN must continue to return matched book data without breaking changes. [US5, AC-011]
- `FR-013`: Preserved: Checking out an unreserved available book using either `memberId` or `email`, and returning loans via `POST /loans/:id/return`, must maintain current functionality and date calculations. [US5, AC-012, AC-013]

## Success Criteria

- `SC-001`: 100% of responses from `GET /books` and `GET /books/:id-or-isbn` report accurate `availableCopies` matching total copies minus active loans and held reservations.
- `SC-002`: 100% of reservation attempts for books with available shelf copies or from members with existing active reservations for that book are rejected.
- `SC-003`: When a copy is returned for a reserved book, 100% of checkout attempts by non-front-of-line members are rejected until the hold is fulfilled or cancelled.
- `SC-004`: 100% of reservation cancellations immediately reallocate held copies to the subsequent queue member in order or release the copy to open shelf availability when the queue is empty.

## Edge Cases

- Attempting to reserve an unknown `bookId` or with an unknown `memberId`/`email` returns a 404 not found error.
- Attempting to cancel a reservation ID that does not exist or has already been fulfilled/cancelled returns a 404 or 409 error.
- Concurrent or back-to-back reservation cancellations when multiple copies are held maintain strict queue ordering without dropping or double-allocating holds.
- Returning multiple copies of a book with fewer pending reservations holds copies for each reserved member in queue order, with remaining returned copies becoming freely available on the shelf.

## Out of Scope

- Overdue fees, calculating fines, or tracking late returns.
- Email, push notifications, or external alerts when a held copy becomes available.
- Member account authentication, password management, or profile editing.
- Persistent disk, database storage, or saving data beyond the in-memory desk lifecycle.

## Source Requirement Coverage

| Source AC | Covered by |
|---|---|
| The catalog and the book page show how many copies are on the shelf right now, not how many the library owns. | AC-001, AC-002, FR-001, SC-001 |
| A member can reserve a book that has nothing left on the shelf. They can reserve it once. Reserving a book that is still available is not allowed. | AC-003, AC-004, AC-005, FR-002, FR-003, FR-004, SC-002 |
| Reservations are served in the order they were placed. | AC-003, FR-005 |
| When a copy comes back, it is held for the person at the front of the line. It is not loaned out to whoever asks next. That member still has to check it out themselves. The reservation does not become a loan on its own. | AC-006, AC-007, AC-008, FR-006, FR-007, FR-008, FR-009, SC-003 |
| A member can cancel their reservation. The next person in line then has the claim on the returned copy. | AC-009, AC-010, FR-010, FR-011, SC-004 |
| Looking up a book, checking one out, and returning it keep working as they do today, including finding a book by ISBN and checking out with an email address. | AC-011, AC-012, AC-013, FR-012, FR-013 |
| Overdue fees, email or push notifications, accounts, and saving anything beyond the current in-memory desk. | OUT OF SCOPE — Explicitly excluded by ticket source requirements |
