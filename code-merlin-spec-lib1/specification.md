<!--
Artifact: specification
Version ID: e4e62dd9-2982-4039-a2be-8cb9ca1473e8
Approval Status: approved
Approved At: 2026-09-18T10:55:40.969Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: b3272e5a-7bf5-426c-9072-54375895d5b6
Work Item URL: https://staging.codemerlin.ai/work-items/b3272e5a-7bf5-426c-9072-54375895d5b6?tab=specification
-->

# Catalog Search, Direct Checkout, and Waitlist Hold System

## Outcome
Library members can look up book availability, check out available copies for 21 days, return loans, and join a waitlist when all copies are checked out. When a copy is returned, the system automatically notifies the next person in line, reserves the returned book for them for 7 calendar days, and prevents non-priority checkouts while active holds exist.

## User Stories

### User Story 1 — Book Availability Lookup (Priority: P1)
As a member, I want to look up a book by ID or ISBN and see how many copies are currently available, so that I know whether I can borrow it immediately or need to wait.
**Why this priority**: Members need accurate live copy counts to decide whether to check out immediately or request a waitlist hold.
**Independent Test**: Look up a title with remaining physical copies and verify the count matches available stock minus unreturned loans.
**Acceptance Scenarios**:
- **AC-001**: Given a catalog book with 1 copy total and 0 active loans, when a member looks up the book by ID or ISBN, then the response displays 1 available copy.
- **AC-002**: Given a book with 0 available copies, when a member looks up the book, then the response indicates 0 available copies and indicates hold placement is eligible.

### User Story 2 — Standard Direct Checkout and Return (Priority: P2)
As a member, I want to check out an available book for 21 days and return it when finished, so that I can borrow titles off the shelf.
**Why this priority**: Standard circulation is the core primary operation for available library books.
**Independent Test**: Perform checkout on an available book, verify loan due date is set to 21 days in the future, and return the loan to restore availability.
**Acceptance Scenarios**:
- **AC-003**: Given a book with at least 1 available copy and no active holds, when a member checks out the book, then a loan is created with a due date 21 calendar days from checkout and available copies decreases by 1.
- **AC-004**: Given an active loan, when the borrowing member returns the book, then the loan is marked returned with the current date.

### User Story 3 — Waitlist Hold Queue Placement (Priority: P3)
As a member, I want to place a hold on a title when zero copies are available on the shelf, so that I get in line without repeatedly checking with front desk staff.
**Why this priority**: Resolves the main pain point where members leave empty-handed without a queue position when titles are fully checked out.
**Independent Test**: Attempt to place a hold on a book with available copies (fails), then place a hold when copies equal 0 (succeeds and records queue order).
**Acceptance Scenarios**:
- **AC-005**: Given a title with 0 available copies and a member with fewer than 3 active holds, when the member places a hold, then the hold is added to the tail of the title's queue in first-come, first-served order.
- **AC-006**: Given a title with 1 or more available copies on the shelf, when a member attempts to place a hold, then the request is rejected and the member is prompted to check out directly.
- **AC-007**: Given a member who already has 3 active holds across the catalog, when they attempt to place another hold, then the request is rejected due to the 3-hold limit.

### User Story 4 — Return Notification and Priority Checkout Allocation (Priority: P4)
As front desk staff, I want the system to notify the first person in line when a copy is returned and reserve it for them for 7 days, so that queue order is strictly respected.
**Why this priority**: Ensures fairness by preventing arbitrary queue jumping and managing hold fulfillment cleanly.
**Independent Test**: Return a copy of a title with waiting holds; verify the top hold transitions to notified status with a 7-day expiration date, and that another member cannot check it out during that window.
**Acceptance Scenarios**:
- **AC-008**: Given a title with waiting holds, when a copy is returned, then the earliest active hold is updated to notified status with a pickup deadline set to 7 calendar days from notification, and an in-app notification record is produced.
- **AC-009**: Given a title with a copy reserved for a notified member, when a different member attempts to check out the title, then the checkout request is rejected to protect queue priority.
- **AC-10**: Given a notified hold whose 7-day pickup deadline has passed without checkout, when the hold expires, then the hold passes automatically to the next member in line or returns to general availability if no holds remain.

## Functional Requirements

- **FR-001** (`Preserved`): The system shall allow looking up catalog books by ID or ISBN (ignoring dashes) and return current total and available copy counts. [US1, AC-001, AC-002]
- **FR-002** (`Preserved`): The system shall permit checking out a copy when available copies exist and no prioritizing holds exist, creating a loan due 21 calendar days from checkout. [US2, AC-003]
- **FR-003** (`Preserved`): The system shall record loan returns, marking the loan returned date and releasing the copy. [US2, AC-004]
- **FR-004** (`New`): The system shall permit a member to place a hold on a book if and only if available copies for that title equal 0. [US3, AC-005, AC-006]
- **FR-005** (`New`): The system shall enforce a strict maximum limit of 3 active holds (waiting or notified) per member across all catalog titles. [US3, AC-007]
- **FR-006** (`New`): The system shall maintain holds in strict FIFO (first-come, first-served) order per book title. [US3, AC-005]
- **FR-007** (`New`): Upon return of a loan for a book with active holds, the system shall assign the returned copy to the longest-waiting active hold, update its status to notified, generate an in-app desk/member notification record, and set a pickup expiration date 7 calendar days from notification. [US4, AC-008]
- **FR-008** (`New`): The system shall restrict checkout of a hold-reserved copy exclusively to the notified member until their 7-day hold window expires or is fulfilled. [US4, AC-009]
- **FR-009** (`New`): If a hold notification reaches its 7-calendar-day deadline without checkout, the system shall mark the hold expired and immediately promote the next waiting member in line (or release the copy to open inventory if no holds remain). [US4, AC-10]

## Success Criteria

- **SC-001**: 100% of hold creation attempts on titles with 0 available copies successfully enter the hold queue with a unique timestamped sequence rank.
- **SC-002**: 100% of checkout requests by non-notified members on titles with active notified holds are blocked from jumping the queue.
- **SC-003**: Loan returns for held titles generate notification records and assign a 7-day pickup deadline within less than 500ms processing latency.
- **SC-004**: 100% of members reaching 3 active holds are prevented from placing additional holds until existing holds are fulfilled, cancelled, or expired.

## Edge Cases

- **Zero Available Copies**: Attempting checkout when available copies count is 0 returns an error informing the user that all copies are out and holds are available.
- **Hold Request When Copies Available**: Attempting hold creation when at least 1 copy is free returns an error directing the user to perform direct checkout instead.
- **Duplicate Hold Placement**: Attempting to place a hold on a title for which the member already has an active hold (waiting or notified) is rejected with a conflict error.
- **Limit Exceeded**: Attempting to place a hold when the member already holds 3 active holds across any titles returns a hold-limit-exceeded error.
- **Queue Jump Attempt**: A non-notified member attempting to check out a title that has 0 unreserved copies available returns a queue-priority conflict error.
- **Expired Pickup Window**: When a notified hold exceeds 7 calendar days, the hold state transitions to expired and triggers automatic notification of the next member in queue.

## Out of Scope

- Overdue fines, late charges, lost book billing, or paid priority queue skipping.
- External email or SMS gateway integration (in-app desk notification record only for v1).
- Placing holds on titles the member currently has checked out.
- Purchasing additional physical book copies or automated reading recommendations.

## Source Requirement Coverage

| Source AC | Covered by |
| --- | --- |
| A member can find a book (including by the number on the back) and see how many copies are left. | AC-001, FR-001, SC-001 |
| If at least one copy is in, they can check it out. The loan lasts 21 days. They can return it. | AC-003, AC-004, FR-002, FR-003 |
| If no copies are in, they can place a hold instead of being told to try again later. | AC-002, AC-005, AC-006, FR-004 |
| Holds are served in the order people signed up. The first person waiting is the first person we contact when a copy is returned. | AC-005, AC-008, FR-006, FR-007, SC-001 |
| A member should not be able to check out a book that is fully on hold for other people — the waitlist has to mean something. | AC-009, FR-008, SC-002 |
| We do not need overdue fines, billing, or “pay to skip the line” for this. | OUT OF SCOPE — Explicitly excluded per ticket boundaries |
