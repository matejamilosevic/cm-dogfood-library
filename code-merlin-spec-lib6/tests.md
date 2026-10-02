# Tests

- Work item: LIB-6 (f6b276cb-a469-4821-8db9-6fb2e17d7844)
- Category: tests
- Version: 9e59ae1c-73cb-41e1-9d6c-d96fbb8b4d0b
- Approval status: approved
- Approved at: 2026-10-02T10:15:02.760Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T10:41:32.557Z
- Source: https://staging.codemerlin.ai/work-items/f6b276cb-a469-4821-8db9-6fb2e17d7844?tab=tests

```json
[
  {
    "order": 1,
    "title": "Authenticated Checkout and Desk Creation Binds to Signed-in Patron",
    "steps": [
      "Given patron Ada has an active session token \"token-ada\" with account ID \"m-1\"",
      "And book \"b-1\" has available copies in the catalog",
      "When Ada sends POST \"/loans\" with body '{\"bookId\": \"b-1\"}' and header \"Authorization: Bearer token-ada\"",
      "Then the response status is 201 Created",
      "And the response body contains a loan with \"bookId\" \"b-1\" and \"memberId\" \"m-1\"",
      "When Ada sends POST \"/holds\" with body '{\"bookId\": \"b-2\"}' and header \"Authorization: Bearer token-ada\" after copies of \"b-2\" are checked out",
      "Then the response status is 201 Created",
      "And the created hold has \"memberId\" \"m-1\"",
      "When Ada sends POST \"/reservations\" with body '{\"bookId\": \"b-2\"}' and header \"Authorization: Bearer token-ada\"",
      "Then the response status is 201 Created",
      "And the created reservation has \"memberId\" \"m-1\""
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-002"],
    "fr_anchors": ["FR-002", "SC-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 2,
    "title": "Unauthenticated Desk Mutation Rejected with 401 Unauthorized",
    "steps": [
      "Given an unauthenticated request without an Authorization header",
      "When a request is sent to POST \"/loans\" with body '{\"bookId\": \"b-1\"}'",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to POST \"/holds\" with body '{\"bookId\": \"b-2\"}'",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to POST \"/reservations\" with body '{\"bookId\": \"b-2\"}'",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-001", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "unauthenticated-session",
    "validation_type": "integration",
    "scenario_category": "auth_401"
  },
  {
    "order": 3,
    "title": "Creation Request with Conflicting Member ID Refused with 403 Forbidden",
    "steps": [
      "Given patron Ada has an active session token \"token-ada\" with account ID \"m-1\"",
      "When Ada sends POST \"/loans\" with body '{\"bookId\": \"b-1\", \"memberId\": \"m-2\"}' and header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Ada sends POST \"/holds\" with body '{\"bookId\": \"b-2\", \"memberId\": \"m-2\"}' and header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Ada sends POST \"/reservations\" with body '{\"bookId\": \"b-2\", \"memberId\": \"m-2\"}' and header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-003"],
    "fr_anchors": ["FR-002", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "integration",
    "scenario_category": "auth_403"
  },
  {
    "order": 4,
    "title": "Authenticated Member Queries Own Activity Records",
    "steps": [
      "Given patron Ada has an active session token \"token-ada\" with account ID \"m-1\"",
      "And Ada has an active loan for book \"b-1\"",
      "When Ada sends GET \"/members/m-1/loans\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the response body contains a \"loans\" array containing Ada's loan for \"b-1\"",
      "When Ada sends GET \"/members/m-1/holds\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the response body contains a \"holds\" array",
      "When Ada sends GET \"/members/m-1/reservations\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the response body contains a \"reservations\" array"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-005"],
    "fr_anchors": ["FR-004", "SC-002"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 5,
    "title": "Unauthenticated Activity Query Rejected with 401 Unauthorized",
    "steps": [
      "Given an unauthenticated request without an Authorization header",
      "When a request is sent to GET \"/members/m-1/loans\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to GET \"/members/m-1/holds\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to GET \"/members/m-1/reservations\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to GET \"/members/m-1/notifications\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-004"],
    "fr_anchors": ["FR-003", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "unauthenticated-session",
    "validation_type": "integration",
    "scenario_category": "auth_401"
  },
  {
    "order": 6,
    "title": "Member Attempting to View Another Member Activity Refused with 403 Forbidden",
    "steps": [
      "Given patron Ada has an active session token \"token-ada\" with account ID \"m-1\"",
      "When Ada sends GET \"/members/m-2/loans\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Ada sends GET \"/members/m-2/holds\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Ada sends GET \"/members/m-2/reservations\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Ada sends GET \"/members/m-2/notifications\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-006"],
    "fr_anchors": ["FR-004", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "integration",
    "scenario_category": "auth_403"
  },
  {
    "order": 7,
    "title": "Member with No Active Records Receives Empty Collections",
    "steps": [
      "Given patron Grace has an active session token \"token-grace\" with account ID \"m-3\"",
      "And Grace has no active loans, holds, or reservations",
      "When Grace sends GET \"/members/m-3/loans\" with header \"Authorization: Bearer token-grace\"",
      "Then the response status is 200 OK",
      "And the response body is '{\"loans\": []}'",
      "When Grace sends GET \"/members/m-3/holds\" with header \"Authorization: Bearer token-grace\"",
      "Then the response status is 200 OK",
      "And the response body is '{\"holds\": []}'",
      "When Grace sends GET \"/members/m-3/reservations\" with header \"Authorization: Bearer token-grace\"",
      "Then the response status is 200 OK",
      "And the response body is '{\"reservations\": []}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-005"],
    "fr_anchors": ["FR-004", "SC-002"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-grace-session",
    "validation_type": "integration",
    "scenario_category": "alt"
  },
  {
    "order": 8,
    "title": "Authenticated Member Modifies Own Loan and Reservation",
    "steps": [
      "Given patron Ada has an active session token \"token-ada\" with account ID \"m-1\"",
      "And Ada has checked out a loan \"loan-ada-1\" for book \"b-1\"",
      "When Ada sends POST \"/loans/loan-ada-1/return\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the returned loan has a non-null \"returnedAt\" timestamp",
      "And physical copy availability for book \"b-1\" is restored",
      "When Ada creates a reservation \"res-ada-1\" for book \"b-2\"",
      "And Ada sends POST \"/reservations/res-ada-1/cancel\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the cancelled reservation has \"status\" set to \"cancelled\""
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-009"],
    "fr_anchors": ["FR-005", "SC-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 9,
    "title": "Unauthenticated Return and Cancellation Rejected with 401 Unauthorized",
    "steps": [
      "Given an existing loan \"loan-1\" and reservation \"res-1\" in the system",
      "When an unauthenticated request without an Authorization header is sent to POST \"/loans/loan-1/return\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When an unauthenticated request without an Authorization header is sent to POST \"/reservations/res-1/cancel\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-007"],
    "fr_anchors": ["FR-001", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "unauthenticated-session",
    "validation_type": "integration",
    "scenario_category": "auth_401"
  },
  {
    "order": 10,
    "title": "Member Attempting to Return or Cancel Another Member Entity Refused with 403 Forbidden",
    "steps": [
      "Given patron Ada has an active loan \"loan-ada-1\" and reservation \"res-ada-1\"",
      "And patron Alan has an active session token \"token-alan\" with account ID \"m-2\"",
      "When Alan sends POST \"/loans/loan-ada-1/return\" with header \"Authorization: Bearer token-alan\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "And the loan \"loan-ada-1\" remains active with \"returnedAt\" null",
      "When Alan sends POST \"/reservations/res-ada-1/cancel\" with header \"Authorization: Bearer token-alan\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "And the reservation \"res-ada-1\" remains active"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-008"],
    "fr_anchors": ["FR-005", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-alan-session",
    "validation_type": "integration",
    "scenario_category": "auth_403"
  },
  {
    "order": 11,
    "title": "Non-Existent Loan Return or Reservation Cancellation Returns 404 Not Found",
    "steps": [
      "Given patron Ada has an active session token \"token-ada\" with account ID \"m-1\"",
      "When Ada sends POST \"/loans/loan-nonexistent-999/return\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 404 Not Found",
      "And the response body is '{\"error\": \"unknown_loan\"}'",
      "When Ada sends POST \"/reservations/res-nonexistent-999/cancel\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 404 Not Found",
      "And the response body is '{\"error\": \"reservation_not_found\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-007", "AC-008"],
    "fr_anchors": ["FR-005"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 12,
    "title": "Malformed or Missing Authorization Header Rejected with 401 Unauthorized",
    "steps": [
      "When a request is sent to POST \"/loans\" with body '{\"bookId\": \"b-1\"}' and header \"Authorization: Basic dXNlcjpwYXNz\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to GET \"/members/m-1/loans\" with header \"Authorization: Bearer \"\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'",
      "When a request is sent to POST \"/loans/loan-1/return\" with header \"Authorization: Bearer expired-token\"",
      "Then the response status is 401 Unauthorized",
      "And the response body is '{\"error\": \"unauthorized\"}'"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001", "AC-004", "AC-007"],
    "fr_anchors": ["FR-001", "FR-003", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "unauthenticated-session",
    "validation_type": "integration",
    "scenario_category": "edge"
  },
  {
    "order": 13,
    "title": "Full Desk Journey From Sign-in to Checkout, Inspection, Foreign Rejection, and Return",
    "steps": [
      "Given library member Ada signs in with valid credentials and obtains session token \"token-ada\" for account \"m-1\"",
      "And library member Alan signs in with valid credentials and obtains session token \"token-alan\" for account \"m-2\"",
      "When Ada sends POST \"/loans\" with body '{\"bookId\": \"b-1\"}' and header \"Authorization: Bearer token-ada\"",
      "Then the response status is 201 Created",
      "And the returned loan record has \"memberId\" \"m-1\"",
      "When Ada sends GET \"/members/m-1/loans\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And Ada's loans list contains the newly created loan for book \"b-1\"",
      "When Alan sends GET \"/members/m-1/loans\" with header \"Authorization: Bearer token-alan\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Alan sends POST \"/loans/{loan_id}/return\" with header \"Authorization: Bearer token-alan\"",
      "Then the response status is 403 Forbidden",
      "And the response body is '{\"error\": \"forbidden\"}'",
      "When Ada sends POST \"/loans/{loan_id}/return\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the loan \"returnedAt\" timestamp is set to today's ISO date",
      "When Ada sends GET \"/members/m-1/loans\" with header \"Authorization: Bearer token-ada\"",
      "Then the response status is 200 OK",
      "And the returned loan reflects \"returnedAt\" as closed"
    ],
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-002", "AC-005", "AC-006", "AC-008", "AC-009"],
    "fr_anchors": ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "SC-001", "SC-002", "SC-003", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "patron-ada-session",
    "validation_type": "e2e",
    "scenario_category": "e2e_chain"
  }
]
```
