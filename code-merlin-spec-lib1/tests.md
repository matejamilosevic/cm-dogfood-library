<!--
Artifact: tests
Version ID: 310c399e-3dbd-464a-821c-10ca125126ef
Approval Status: approved
Approved At: 2026-09-18T14:41:28.624Z
Approved By: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
Work Item: b3272e5a-7bf5-426c-9072-54375895d5b6
Work Item URL: https://staging.codemerlin.ai/work-items/b3272e5a-7bf5-426c-9072-54375895d5b6?tab=tests
-->

# Test Plan

```json
[
  {
    "order": 1,
    "steps": [
      "Given a catalog book with ID 'b-1' and ISBN '978-0-14-044913-6' having total copies 2 and 0 active loans in `src/catalog.ts`",
      "When a member looks up the book by ID 'b-1' or dashed ISBN '978-0-14-044913-6' via `GET /books/978-0-14-044913-6` in `src/http.ts`",
      "Then the catalog response returns 2 total copies and 2 available copies"
    ],
    "title": "Look up book by ID or ISBN with available copies",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-001"
    ],
    "fr_anchors": [
      "FR-001"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Catalog book b-1 (The Odyssey) with total copies 2 and 0 active loans",
    "validation_type": "unit",
    "scenario_category": "happy"
  },
  {
    "order": 2,
    "steps": [
      "Given a catalog book 'b-2' with 1 total copy that is currently checked out in `src/loans.ts`",
      "When a member looks up the book availability for 'b-2' via `GET /books/b-2` in `src/http.ts`",
      "Then the lookup response returns 0 available copies and indicates that hold placement is eligible"
    ],
    "title": "Look up book with zero available copies indicating hold eligibility",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-002"
    ],
    "fr_anchors": [
      "FR-001",
      "FR-004"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Catalog book b-2 (Pride and Prejudice) fully checked out",
    "validation_type": "unit",
    "scenario_category": "alt"
  },
  {
    "order": 3,
    "steps": [
      "Given member 'm-1' and catalog book 'b-1' with available copies in `src/loans.ts`",
      "When member 'm-1' checks out book 'b-1' via `POST /loans` in `src/http.ts`",
      "Then a loan record is created with a due date exactly 21 calendar days from checkout and available copies decreases by 1",
      "When member 'm-1' returns the active loan for book 'b-1' via `POST /loans/:id/return` in `src/http.ts`",
      "Then the loan is marked returned with the current timestamp and available copies increases by 1"
    ],
    "title": "Check out available book creating 21-day loan and return loan to restore availability",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-003",
      "AC-004"
    ],
    "fr_anchors": [
      "FR-002",
      "FR-003"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Member m-1 (Ada) and catalog book b-1 (The Odyssey)",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 4,
    "steps": [
      "Given catalog book 'b-2' with 0 available copies in `src/loans.ts`",
      "When member 'm-1' places a hold on book 'b-2' via `POST /holds` in `src/holds.ts`",
      "And member 'm-2' places a hold on book 'b-2' via `POST /holds` in `src/holds.ts`",
      "Then both holds are successfully created with timestamped sequence ranks maintaining FIFO order for 'm-1' followed by 'm-2'"
    ],
    "title": "Place hold on fully checked out title entering FIFO queue",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-005"
    ],
    "fr_anchors": [
      "FR-004",
      "FR-006",
      "SC-001"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Book b-2 with 0 available copies and members m-1 and m-2",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 5,
    "steps": [
      "Given catalog book 'b-1' with at least 1 copy available on shelf in `src/catalog.ts`",
      "When member 'm-1' attempts to place a hold on book 'b-1' via `POST /holds` in `src/holds.ts`",
      "Then the hold request is rejected with an error prompting direct checkout instead"
    ],
    "title": "Reject hold placement when copies are available on shelf",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-006"
    ],
    "fr_anchors": [
      "FR-004"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Book b-1 with 2 available copies and member m-1",
    "validation_type": "unit",
    "scenario_category": "error"
  },
  {
    "order": 6,
    "steps": [
      "Given member 'm-1' has 3 active holds (waiting or notified) across catalog titles in `src/holds.ts`",
      "When member 'm-1' attempts to place a 4th hold on another zero-availability title",
      "Then the hold request is rejected due to exceeding the 3-hold active limit"
    ],
    "title": "Enforce maximum limit of 3 active holds per member",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-007"
    ],
    "fr_anchors": [
      "FR-005",
      "SC-004"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Member m-1 with 3 active holds across titles b-1, b-2, b-3",
    "validation_type": "integration",
    "scenario_category": "edge"
  },
  {
    "order": 7,
    "steps": [
      "Given book 'b-2' is checked out and member 'm-1' holds the earliest waiting hold in queue in `src/holds.ts`",
      "When the active loan for book 'b-2' is returned via `returnLoan` in `src/loans.ts`",
      "Then the hold for member 'm-1' is updated to notified status with a pickup deadline set to 7 calendar days from notification within 500ms processing latency and an in-app desk notification record is generated"
    ],
    "title": "Notify first member in queue with 7-day pickup deadline upon book return",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-008"
    ],
    "fr_anchors": [
      "FR-007",
      "SC-003"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Book b-2 checked out with member m-1 waiting at top of hold queue",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 8,
    "steps": [
      "Given book 'b-2' has a copy reserved for notified member 'm-1' in `src/holds.ts`",
      "When non-notified member 'm-2' attempts to check out book 'b-2' via `POST /loans` in `src/loans.ts`",
      "Then the checkout request is rejected to protect queue priority"
    ],
    "title": "Reject checkout attempt by non-notified member when copy is reserved for hold",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-009"
    ],
    "fr_anchors": [
      "FR-008",
      "SC-002"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Book b-2 reserved for notified member m-1, checkout attempted by member m-2",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 9,
    "steps": [
      "Given book 'b-2' has a notified hold for member 'm-1' whose 7-day pickup deadline has passed without checkout, and member 'm-2' is next in queue in `src/holds.ts`",
      "When the hold expiration processing runs",
      "Then member 'm-1''s hold transitions to expired and member 'm-2''s hold is automatically promoted to notified status with a new 7-day pickup deadline"
    ],
    "title": "Expire pickup deadline and automatically promote next waiting member",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-10"
    ],
    "fr_anchors": [
      "FR-009"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Book b-2 with notified hold for m-1 past 7 days and waiting hold for m-2",
    "validation_type": "integration",
    "scenario_category": "edge"
  },
  {
    "order": 10,
    "steps": [
      "Given member 'm-1' checks out the last copy of book 'b-2' in `src/loans.ts`",
      "When member 'm-2' searches for 'b-2', sees 0 available copies via `src/catalog.ts`, and places a waitlist hold in `src/holds.ts`",
      "And member 'm-3' attempts to check out 'b-2' and is rejected",
      "And member 'm-1' returns book 'b-2'",
      "Then member 'm-2' is notified with a 7-day pickup reservation, and successfully completes checkout of 'b-2'"
    ],
    "title": "Complete end-to-end user journey from search to hold placement return and priority checkout",
    "repo_keys": [
      "matejamilosevic/cm-dogfood-library"
    ],
    "ac_anchors": [
      "AC-001",
      "AC-002",
      "AC-005",
      "AC-008",
      "AC-009"
    ],
    "fr_anchors": [
      "FR-001",
      "FR-004",
      "FR-007",
      "FR-008"
    ],
    "home_repo_key": "matejamilosevic/cm-dogfood-library",
    "test_data_ref": "Lifecycle fixture: members m-1, m-2, m-3 and book b-2",
    "validation_type": "e2e",
    "scenario_category": "e2e_chain"
  }
]
```
