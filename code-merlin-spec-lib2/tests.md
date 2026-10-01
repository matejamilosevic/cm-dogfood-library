<!--
Artifact: tests
Version ID: 0888ee43-c1ac-4c10-bf58-0464b2212608
Approval Status: approved
Approved At: 2026-09-23T14:34:29.003Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: a61aa991-d7cc-4f73-b12e-2e3840200f05
Work Item URL: https://staging.codemerlin.ai/work-items/a61aa991-d7cc-4f73-b12e-2e3840200f05?tab=tests
-->

# Test Plan

```json
[
  {
    "order": 1,
    "steps": [
      "Given a clean library desk with book b-1 having 2 owned copies and 0 active loans",
      "When a client sends a GET request to /books",
      "And a client sends a GET request to /books/b-1",
      "Then the /books response status is 200 and book b-1 has copies 2 and availableCopies 2",
      "And the /books/b-1 response status is 200 and book b-1 has copies 2 and availableCopies 2"
    ],
    "title": "Catalog and book detail report available on-shelf copies when all copies are present",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-001"
    ],
    "fr_anchors": [
      "FR-001",
      "SC-001"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-1",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 2,
    "steps": [
      "Given book b-2 has 1 total copy and member m-1 has an active loan for b-2",
      "When a client sends a GET request to /books",
      "And a client sends a GET request to /books/b-2",
      "Then the /books response status is 200 and book b-2 has copies 1 and availableCopies 0",
      "And the /books/b-2 response status is 200 and book b-2 has copies 1 and availableCopies 0"
    ],
    "title": "Catalog and book detail report zero available copies when all owned copies are checked out",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-002"
    ],
    "fr_anchors": [
      "FR-001",
      "SC-001"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-1",
    "validation_type": "integration",
    "scenario_category": "alt"
  },
  {
    "order": 3,
    "steps": [
      "Given all copies of book b-2 are checked out so availableCopies is 0",
      "When member m-2 submits a POST request to /reservations with bookId b-2 and memberId m-2",
      "Then the response status is 201 Created",
      "And the response body contains a reservation with bookId b-2, memberId m-2, and status pending"
    ],
    "title": "Member places reservation when no copies remain on shelf",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-003"
    ],
    "fr_anchors": [
      "FR-002",
      "FR-005"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-2",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 4,
    "steps": [
      "Given book b-1 has 2 copies available on the shelf",
      "When member m-1 submits a POST request to /reservations with bookId b-1 and memberId m-1",
      "Then the response status is 409 Conflict",
      "And the response body error is copies_available"
    ],
    "title": "Reserving a book that still has shelf copies available is rejected",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-004"
    ],
    "fr_anchors": [
      "FR-003",
      "SC-002"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-1, m-1",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 5,
    "steps": [
      "Given book b-2 has 0 available shelf copies and member m-2 already has a pending reservation for b-2",
      "When member m-2 submits a POST request to /reservations with bookId b-2 and memberId m-2",
      "Then the response status is 409 Conflict",
      "And the response body error is duplicate_reservation"
    ],
    "title": "Duplicate reservation attempt by same member on same book is rejected",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-005"
    ],
    "fr_anchors": [
      "FR-004",
      "SC-002"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-2",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 6,
    "steps": [
      "Given book b-2 has 0 available copies",
      "When a client submits a POST request to /reservations with bookId b-2 and email alan@library.test",
      "Then the response status is 201 Created",
      "And the response body contains a reservation with bookId b-2, memberId m-2, and status pending"
    ],
    "title": "Member places reservation using email address",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-003"
    ],
    "fr_anchors": [
      "FR-002"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, alan@library.test",
    "validation_type": "integration",
    "scenario_category": "alt"
  },
  {
    "order": 7,
    "steps": [
      "Given book b-2 has an active loan for member m-1 and a pending reservation for member m-2",
      "When the loan for member m-1 is returned via POST to /loans/:id/return",
      "Then the return response status is 200",
      "And member m-2's reservation transitions to status held",
      "And no new loan is created for member m-2",
      "And the availableCopies for book b-2 remains 0 because the copy is held"
    ],
    "title": "Returned loan holds copy for front-of-line reservation without auto-creating loan",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-006"
    ],
    "fr_anchors": [
      "FR-006",
      "FR-007"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-1, m-2",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 8,
    "steps": [
      "Given book b-2 has a copy held for member m-2",
      "When member m-1 attempts to check out book b-2 via POST /loans",
      "Then the response status is 409 Conflict",
      "And the response error indicates copy_held_for_other_member"
    ],
    "title": "Checkout by non-front member is rejected while copy is held",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-007"
    ],
    "fr_anchors": [
      "FR-008",
      "SC-003"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-1, m-2",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 9,
    "steps": [
      "Given book b-2 has a copy held for member m-2",
      "When member m-2 checks out book b-2 via POST /loans with memberId m-2",
      "Then the response status is 201 Created",
      "And a new loan is returned for member m-2",
      "And member m-2's reservation status is updated to fulfilled"
    ],
    "title": "Member with held copy checks out book successfully and fulfills reservation",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-008"
    ],
    "fr_anchors": [
      "FR-007",
      "FR-009"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-2",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 10,
    "steps": [
      "Given member m-2 has a pending reservation for book b-2",
      "When member m-2 submits a POST request to /reservations/:id/cancel",
      "Then the response status is 200 OK",
      "And the reservation status is cancelled",
      "And member m-2 is removed from the active queue for b-2"
    ],
    "title": "Member cancels active pending reservation",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-009"
    ],
    "fr_anchors": [
      "FR-010"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-2",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 11,
    "steps": [
      "Given book b-1 has 0 open copies, member m-1 has a held reservation, and member m-2 has a pending reservation",
      "When member m-1 cancels their reservation via POST /reservations/:id/cancel",
      "Then the response status is 200 OK",
      "And member m-1's reservation status becomes cancelled",
      "And member m-2's reservation status immediately transitions to held"
    ],
    "title": "Cancelling held reservation transfers hold to next person in queue",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-010"
    ],
    "fr_anchors": [
      "FR-011",
      "SC-004"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-1, m-1, m-2",
    "validation_type": "integration",
    "scenario_category": "alt"
  },
  {
    "order": 12,
    "steps": [
      "Given book b-2 has 1 held copy for member m-1 and no further pending reservations in queue",
      "When member m-1 cancels their reservation via POST /reservations/:id/cancel",
      "Then the response status is 200 OK",
      "And availableCopies for book b-2 increases from 0 to 1"
    ],
    "title": "Cancelling sole held reservation returns copy to available shelf copies",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-010"
    ],
    "fr_anchors": [
      "FR-011",
      "SC-004"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "b-2, m-1",
    "validation_type": "integration",
    "scenario_category": "alt"
  },
  {
    "order": 13,
    "steps": [
      "Given a reservation ID res-nonexistent",
      "When a client sends a POST request to /reservations/res-nonexistent/cancel",
      "Then the response status is 404 Not Found",
      "And when a client cancels an already cancelled reservation res-1",
      "Then the response status is 409 Conflict with error already_cancelled"
    ],
    "title": "Cancelling non-existent or already cancelled reservation returns error",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-009"
    ],
    "fr_anchors": [
      "FR-010"
    ],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "res-nonexistent",
    "validation_type": "integration",
    "scenario_category": "error"
  }
]
```
