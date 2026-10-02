# Tests

- Work item: LIB-7 (f5e8cfc8-8e13-4158-9d98-72512f9925ec)
- Category: tests
- Version: 017db4dc-a797-4b3e-a136-1b8aefca3627
- Approval status: approved
- Approved at: 2026-10-02T11:26:39.061Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T11:27:14.989Z
- Source: https://staging.codemerlin.ai/work-items/f5e8cfc8-8e13-4158-9d98-72512f9925ec?tab=tests

```json
[
  {
    "order": 1,
    "steps": [
      "Given the library desk service is running",
      "When a visitor issues an HTTP GET request to `/`",
      "Then the response status is 200 with content-type `text/html; charset=utf-8`",
      "And the response body contains `#signin-form` with username and password input fields",
      "And the response body contains `#signup-form` with username and password input fields",
      "And the response body does not contain `<select id=\\\"member\\\">`",
      "And the response body does not contain patron picker options for `m-1`, `m-2`, or `m-3`"
    ],
    "title": "Desk renders sign-up and sign-in forms without patron member picker",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-001", "SC-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_desk_page",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 2,
    "steps": [
      "Given a visitor views the desk sign-in form at `/`",
      "When the visitor submits sign-in credentials with username `reader1` and incorrect password `wrongpassword`",
      "Then the server returns HTTP 401 with error code `invalid_credentials`",
      "And the desk interface remains on `#signin-form` without navigating away",
      "And the desk displays a visible alert message in `#error` explaining that authentication failed",
      "And the patron dashboard `#patron-view` and sign-out control `#signout-btn` remain hidden"
    ],
    "title": "Failed sign-in attempt remains on sign-in form and displays visible error",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-002"],
    "fr_anchors": ["FR-002", "SC-002"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_registered_patron_reader1",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 3,
    "steps": [
      "Given an existing patron account `reader1` registered with password `secretpass123`",
      "When the visitor submits username `reader1` and password `secretpass123` via `#signin-form`",
      "Then the server returns HTTP 200 with a 64-character bearer token and account details",
      "And the desk captures the session token in client execution memory",
      "And the desk transitions from unauthenticated forms to the patron dashboard",
      "And `#active-member` displays the authenticated patron username `reader1`",
      "And `#signout-btn` is visible and enabled"
    ],
    "title": "Successful sign-in establishes patron session and displays authenticated member identity",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-003"],
    "fr_anchors": ["FR-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_registered_patron_reader1",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 4,
    "steps": [
      "Given an authenticated session for patron Alan (`m-2`) with an active loan on `b-1` and a waiting hold on `b-4`",
      "When the desk client invokes activity hydration for member `m-2`",
      "Then requests to `GET /members/m-2/loans`, `GET /members/m-2/holds`, and `GET /members/m-2/reservations` supply the Authorization Bearer header",
      "And `#loans` renders the active loan for `b-1` with book title The Odyssey and Due date",
      "And `#queue` renders the active waiting hold for `b-4` with book title Frankenstein and waiting status",
      "And `#loans-empty` and `#queue-empty` are hidden"
    ],
    "title": "Authenticated patron dashboard displays personal loans, holds, and reservations",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-004"],
    "fr_anchors": ["FR-004", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_patron_alan_active_activity",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 5,
    "steps": [
      "Given an authenticated session for patron Grace (`m-3`) who has no loans, holds, or reservations",
      "When the desk client hydrates activity via `GET /members/m-3/loans`, `GET /members/m-3/holds`, and `GET /members/m-3/reservations`",
      "Then the server returns empty collection arrays for loans, holds, and reservations",
      "And `#loans` contains no loan item elements",
      "And `#loans-empty` is visible with text `No current loans.`",
      "And `#queue` contains no waitlist item elements",
      "And `#queue-empty` is visible with text `No active waitlist items.`"
    ],
    "title": "Authenticated patron with zero activity renders explicit empty-state notices",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-005"],
    "fr_anchors": ["FR-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_patron_grace_zero_activity",
    "validation_type": "integration",
    "scenario_category": "alt"
  },
  {
    "order": 6,
    "steps": [
      "Given an authenticated patron session with active token and activity loaded on the desk",
      "When the member clicks the sign-out control `#signout-btn`",
      "Then the client dispatches `POST /signout` with the Authorization Bearer header",
      "And the server invalidates the session and returns HTTP 200 with `{ ok: true }`",
      "And the client clears in-memory session token and active member identity",
      "And `#loans` and `#queue` lists are emptied so previous patron data is removed",
      "And the desk returns to the unauthenticated `#signin-form` view with patron dashboard hidden"
    ],
    "title": "Patron sign-out revokes session and restores unauthenticated sign-in view",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-006"],
    "fr_anchors": ["FR-005", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_authenticated_session",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 7,
    "steps": [
      "Given an existing patron account registered with username `reader1`",
      "When a visitor attempts to register via `#signup-form` with username `reader1` and password `newpassword999`",
      "Then the server returns HTTP 409 with error code `username_already_taken`",
      "And the desk remains on the sign-up form",
      "And `#error` displays a visible conflict message indicating the username is already taken",
      "And no session token is issued or established"
    ],
    "title": "Sign-up with duplicate username remains on form with conflict error",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_registered_patron_reader1",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 8,
    "steps": [
      "Given an authenticated patron session whose session token has expired or been revoked",
      "When the desk attempts activity hydration or a borrowing action with the expired bearer token",
      "Then the server responds with HTTP 401 and error code `unauthorized`",
      "And the desk catches the 401 response and clears the invalid local session state",
      "And the desk resets the view to `#signin-form` and displays an authentication expiration message in `#error`",
      "And private patron activity lists are cleared from display"
    ],
    "title": "Activity hydration with expired session token triggers unauthorized error and resets to sign-in",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-002", "AC-004"],
    "fr_anchors": ["FR-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_expired_session_patron",
    "validation_type": "integration",
    "scenario_category": "auth_401"
  },
  {
    "order": 9,
    "steps": [
      "Given patron Ada is authenticated with valid bearer session token for member ID `m-1`",
      "When a request is dispatched to `/members/m-2/loans` or `/members/m-2/holds` supplying Ada's bearer token",
      "Then the server returns HTTP 403 with error code `forbidden`",
      "And no activity items belonging to member `m-2` are exposed or returned to the client",
      "And Ada's desk interface continues to display only Ada's own borrowing activity"
    ],
    "title": "Patron session rejects foreign member activity request with forbidden response",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-004"],
    "fr_anchors": ["FR-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_patrons_ada_and_alan",
    "validation_type": "integration",
    "scenario_category": "auth_403"
  },
  {
    "order": 10,
    "steps": [
      "Given an unauthenticated visitor loads the library desk at `/`",
      "When the visitor registers with username `lifecycle_patron` and password `lifecycle_pass_123` via `#signup-form`",
      "Then account registration succeeds (201 Created) and the desk establishes an authenticated session",
      "And the desk transitions to the authenticated view displaying `#active-member` as `lifecycle_patron`",
      "When the patron checks out book `b-1` (The Odyssey)",
      "Then the loan is created (201 Created) and appears in `#loans` with Due date",
      "When the patron clicks `#signout-btn`",
      "Then the session is revoked via `POST /signout`",
      "And the desk returns to `#signin-form` with `#loans` emptied and patron dashboard hidden"
    ],
    "title": "Full patron journey from registration and authentication to activity review and sign-out",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001", "AC-003", "AC-004", "AC-006"],
    "fr_anchors": ["FR-001", "FR-003", "FR-004", "FR-005", "SC-001", "SC-003", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_lifecycle_patron",
    "validation_type": "integration",
    "scenario_category": "e2e_chain"
  }
]
```
