# LIB-3 tests

- Work item: LIB-3 (`9564907a-67c4-4350-85d0-a05e5fb442a9`)
- Title: Library desk in the browser
- Category: tests
- Approval: approved
- Version: `d9f2a295-9d1f-45ff-9f06-0d7d188b767f`
- Approved at: 2026-10-01T10:19:10.522Z
- Approved by: Mateja Milosevic (`a60f8343-5bb4-43b1-b676-35b91cf79f72`)
- Evaluation time: 2026-10-01T10:19:57.862Z
- Member link: https://staging.codemerlin.ai/work-items/9564907a-67c4-4350-85d0-a05e5fb442a9?tab=tests
- Implementation readiness: readyForHandoff=false; evaluatedAt=2026-10-01T10:19:41.003Z; rollupDigest=`5c68bc0cd31016aeae1f52c05940ebda`

---

## Scenario 1 — Patron opens library desk at root route and browses catalog with initial member selected

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-001
- fr_anchors: FR-001, FR-002, FR-003, SC-001
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: happy

1. Given the library server is running with standard seeded catalog and member data in memory
2. When an HTTP GET request is sent to route '/' on the library server
3. Then the response status code is 200 with content-type 'text/html; charset=utf-8'
4. And the HTML body renders the interactive library desk layout
5. And the identity selector presents Ada Lovelace ('m-1'), Alan Turing ('m-2'), and Grace Hopper ('m-3')
6. And the catalog table displays all 4 seeded titles: The Odyssey (2 copies available), Pride and Prejudice (1 copy available), A Short History of Nearly Everything (3 copies available), and Frankenstein (1 copy available)

## Scenario 2 — Active member switch updates context and member loans and holds within 1 second

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-002
- fr_anchors: FR-002, SC-002
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: perf

1. Given the library desk is loaded in the browser with active member Ada Lovelace ('m-1')
2. When the patron switches the active member selector to Alan Turing ('m-2')
3. Then the desk updates the active member context to Alan Turing without requiring login credentials
4. And visible member loans, holds, and reservation status sections refresh for Alan Turing ('m-2')
5. And the context switch and view update complete in under 1 second without page refresh failure

## Scenario 3 — Desk displays empty loan and hold states for a patron with no active borrowings

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-001, AC-002
- fr_anchors: FR-002, FR-005, FR-007
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: alt

1. Given a clean library state where member Grace Hopper ('m-3') has zero active loans and zero holds or reservations
2. When Grace Hopper is selected in the desk member selector
3. Then the member active loans container displays an empty message indicating no current loans
4. And the holds and reservations container displays an empty message indicating no active waitlist items

## Scenario 4 — Member checks out available title creating a 21-day loan and decrements catalog copy count

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-003
- fr_anchors: FR-004, SC-003
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: happy

1. Given member Ada Lovelace ('m-1') is selected at the desk and 'b-1' (The Odyssey) has 2 copies available
2. When Ada submits a checkout action for 'b-1' from the desk UI
3. Then a new loan is recorded for Ada with due date set to exactly 21 days from today
4. And the remaining available copies count for The Odyssey in the catalog view decreases from 2 to 1
5. And Ada's active loans list at the desk immediately displays The Odyssey with its 21-day due date

## Scenario 5 — Member returns active loan from the desk restoring catalog copy availability

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-004
- fr_anchors: FR-005, SC-004
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: happy

1. Given member Ada Lovelace ('m-1') holds an active loan for 'b-1' (The Odyssey) and available copies is 1
2. When Ada clicks the return action button for that loan on the desk interface
3. Then the loan is marked as returned with today's date and removed from active loans
4. And the catalog view reflects that available copies for The Odyssey increases back to 2

## Scenario 6 — Member places a hold on an exhausted title and tracks waiting queue status

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-005
- fr_anchors: FR-006, FR-007
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: happy

1. Given 'b-2' (Pride and Prejudice) has 0 available copies due to an active loan by Ada Lovelace ('m-1')
2. And Alan Turing ('m-2') is the active member selected at the desk
3. When Alan clicks the hold button for 'b-2' on the desk UI
4. Then the hold request is accepted and recorded in the queue with status 'waiting'
5. And Alan's desk view displays the active hold card for Pride and Prejudice showing status 'waiting'

## Scenario 7 — Desk displays ready status and 7-day pickup deadline when returned book satisfies waiting hold

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-006
- fr_anchors: FR-007, SC-004
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: happy

1. Given Alan Turing ('m-2') has a hold in status 'waiting' for 'b-2' (Pride and Prejudice)
2. When Ada Lovelace ('m-1') returns her loan for 'b-2' through the library service
3. Then the hold transitions to status 'notified' with a pickup deadline set to exactly 7 days from today
4. And Alan's holds section on the desk displays status ready for pickup with the 7-day pickup expiration date

## Scenario 8 — Member picks up ready copy from the desk converting hold into an active loan

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-007
- fr_anchors: FR-008, SC-006
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: happy

1. Given Alan Turing ('m-2') has a notified hold for 'b-2' (Pride and Prejudice) ready for pickup
2. When Alan clicks the pickup button for that hold from the desk UI
3. Then the copy is checked out to Alan with a new 21-day loan
4. And the hold status is marked as 'fulfilled'
5. And Pride and Prejudice appears in Alan's active loans list at the desk

## Scenario 9 — Desk rejects hold placement when member reaches the 3-hold limit

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-005
- fr_anchors: FR-006, SC-005
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: error

1. Given Ada Lovelace ('m-1') already has 3 active holds on books 'b-1', 'b-2', and 'b-3' where copies are 0
2. And book 'b-4' (Frankenstein) has 0 copies available
3. When Ada attempts to place a fourth hold on 'b-4' from the desk UI
4. Then the request is rejected with status 409 and error code 'hold_limit_exceeded'
5. And the desk displays user-visible feedback explaining the 3-hold policy limit

## Scenario 10 — Desk rejects duplicate hold for the same title by the same member

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-005
- fr_anchors: FR-006, SC-005
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: edge

1. Given Alan Turing ('m-2') has an active hold on 'b-2' (Pride and Prejudice)
2. When Alan attempts to place another hold on 'b-2' from the desk UI
3. Then the request is rejected with status 409 and error code 'duplicate_hold'
4. And the desk UI presents an error banner indicating a duplicate hold cannot be created

## Scenario 11 — Desk queries member reservations endpoint and rejects unknown member queries

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-005
- fr_anchors: FR-007
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: integration
- scenario_category: edge

1. Given member Ada Lovelace ('m-1') has placed a reservation on 'b-2'
2. When an HTTP GET request is sent to '/members/m-1/reservations'
3. Then the response status is 200 with content-type 'application/json'
4. And the payload includes an array of reservations containing 'b-2' with status 'pending'
5. When an HTTP GET request is sent to '/members/m-999/reservations'
6. Then the response status is 404 with error code 'member_not_found'

## Scenario 12 — Complete browser desk journey: catalog inspection, checkout, exhaustion, hold placement, return, notification, and pickup

- repo_keys: `matejamilosevic/library`
- ac_anchors: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007
- fr_anchors: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, SC-001, SC-002, SC-003, SC-004, SC-005, SC-006
- harness_class: in_repo
- home_repo_key: matejamilosevic/library
- test_data_ref: catalog-members-fixture
- validation_type: e2e
- scenario_category: e2e_chain

1. Given the library server serves the desk UI at 'GET /'
2. When patron Ada Lovelace ('m-1') visits the desk and checks out the single available copy of 'b-2' (Pride and Prejudice)
3. Then the catalog copy count drops to 0 and Ada has an active 21-day loan
4. When Alan Turing ('m-2') is selected in the desk member selector within 1 second
5. And Alan places a hold on 'b-2' observing status 'waiting'
6. When Ada returns her loan for 'b-2' from the desk UI
7. Then Alan's hold transitions to 'notified' with a 7-day pickup deadline visible on the desk
8. When Alan executes pickup for 'b-2' from the desk
9. Then the hold transitions to 'fulfilled', a 21-day loan is created for Alan, and 'b-2' is listed in Alan's active loans
