# Tests

- Work item: LIB-4 (24a736df-ef1b-4df0-b479-e3fdb7438317)
- Category: tests
- Version: be205947-4a90-4518-8376-852cec9630d7
- Approval status: approved
- Approved at: 2026-10-01T18:21:03.456Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-01T18:22:02.447Z
- Source: https://staging.codemerlin.ai/work-items/24a736df-ef1b-4df0-b479-e3fdb7438317?tab=tests

```json
[
  {
    "order": 1,
    "steps": [
      "Given an empty member account store in `src/members.ts`",
      "When a client sends a POST request to `/signup` via `src/http.ts` with body `{\"username\", \"reader1\", \"password\": \"secretpass123\"}`",
      "Then the response status code is 201 Created",
      "And the response body contains an account object with a non-empty string `id`, username `\"reader1\"`, and an ISO 8601 string `createdAt`",
      "And the response body does not contain a `password` or `passwordHash` field"
    ],
    "title": "Register a new member account with unique credentials returns 201 Created",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-001", "FR-002", "SC-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_new_member_signup",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 2,
    "steps": [
      "Given an account registered with username `\"reader1\"` exists in `src/members.ts`",
      "When another client sends a POST request to `/signup` via `src/http.ts` with body `{\"username\": \"reader1\", \"password\": \"anotherpass456\"}`",
      "Then the response status code is 409 Conflict",
      "And the response body contains error code `\"username_already_taken\"`",
      "When another client sends a POST request to `/signup` via `src/http.ts` with body `{\"username\": \"READER1\", \"password\": \"yetAnotherPass\"}`",
      "Then the response status code is 409 Conflict",
      "And the response body contains error code `\"username_already_taken\"`"
    ],
    "title": "Reject duplicate username registration with 409 Conflict",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-002"],
    "fr_anchors": ["FR-003", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_duplicate_member_signup",
    "validation_type": "integration",
    "scenario_category": "edge"
  },
  {
    "order": 3,
    "steps": [
      "Given the library service running with `handleRequest` in `src/http.ts`",
      "When a client sends a POST request to `/signup` with body `{\"username\": \"\", \"password\": \"secret123\"}`",
      "Then the response status code is 400 Bad Request",
      "And the response body contains error code `\"missing_username_or_password\"`",
      "When a client sends a POST request to `/signup` with body `{\"username\": \"validuser\", \"password\": \"\"}`",
      "Then the response status code is 400 Bad Request",
      "And the response body contains error code `\"missing_username_or_password\"`",
      "When a client sends a POST request to `/signup` with body `{}`",
      "Then the response status code is 400 Bad Request",
      "And the response body contains error code `\"missing_username_or_password\"`"
    ],
    "title": "Reject signup requests missing username or password with 400 Bad Request",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_invalid_signup_payloads",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 4,
    "steps": [
      "Given the library HTTP server in `src/server.ts` forwarding requests to `src/http.ts`",
      "When a client sends a POST request to `/signup` with a malformed non-JSON body string `\"{invalid-json\"`",
      "Then the response status code is 400 Bad Request",
      "And the response body contains error code `\"invalid_json\"`"
    ],
    "title": "Reject signup requests with malformed JSON body with 400 Bad Request",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-001"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_malformed_json",
    "validation_type": "integration",
    "scenario_category": "error"
  },
  {
    "order": 5,
    "steps": [
      "Given a member account registered with username `\"secureuser\"` and plain text password `\"SuperSecret987!\"`",
      "When the persistent account storage file at `./data/accounts.json` is read and parsed",
      "Then the plain text string `\"SuperSecret987!\"` is not present anywhere in the stored file content",
      "And the stored record contains a `passwordHash` field in cryptographic format `salt:hash`",
      "And calling `getMemberAccount` in `src/members.ts` does not expose the plain text password in any returned property"
    ],
    "title": "Verify stored account credentials do not expose plain text password",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-003"],
    "fr_anchors": ["FR-004", "SC-002"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_secure_account_record",
    "validation_type": "unit",
    "scenario_category": "happy"
  },
  {
    "order": 6,
    "steps": [
      "Given a fresh test environment where no persistent storage file exists at `./data/accounts.json`",
      "When the account repository module `src/members.ts` initializes",
      "Then the account list starts empty with 0 accounts",
      "And no file access error or unhandled exception is thrown"
    ],
    "title": "Verify clean environment initializes an empty member account store",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-004"],
    "fr_anchors": ["FR-005", "SC-005"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_empty_account_store",
    "validation_type": "unit",
    "scenario_category": "alt"
  },
  {
    "order": 7,
    "steps": [
      "Given a member account registered with username `\"persistuser\"` and password `\"savemepass\"` during a running server session",
      "And the account data has been flushed to persistent storage file `./data/accounts.json`",
      "When the server process simulates a restart by re-initializing `src/members.ts` and `src/server.ts` from `./data/accounts.json`",
      "Then the account for username `\"persistuser\"` remains present in storage",
      "And a new signup attempt for username `\"persistuser\"` returns status code 409 Conflict"
    ],
    "title": "Preserve registered member accounts across server restart",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-005"],
    "fr_anchors": ["FR-006", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_restart_persistence",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 8,
    "steps": [
      "Given the library service with `POST /signup` enabled alongside existing endpoints in `src/http.ts`",
      "When a client sends a GET request to `/health`",
      "Then the response status code is 200 and body is `{\"ok\": true}`",
      "When a client sends a GET request to `/books`",
      "Then the response status code is 200 returning the seeded book catalog",
      "When a client sends a POST request to `/loans` with body `{\"bookId\": \"b-1\", \"memberId\": \"m-1\"}`",
      "Then the response status code is 201 Created and the loan is created successfully"
    ],
    "title": "Verify existing catalog and loan routes remain fully operational alongside signup",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": ["FR-007"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_catalog_and_loans",
    "validation_type": "regression",
    "scenario_category": "edge"
  },
  {
    "order": 9,
    "steps": [
      "Given a clean initialized library service with an empty account repository",
      "When a user signs up via POST to `/signup` with username `\"e2e_user\"` and password `\"Passw0rdSecure!\"`",
      "Then the response status code is 201 Created and the account object is returned without password credentials",
      "When inspecting the backing storage file `./data/accounts.json`",
      "Then the stored record contains `\"e2e_user\"` and a hashed credential, with no plain text password present",
      "When the server instance is reloaded against `./data/accounts.json`",
      "And a subsequent POST to `/signup` is sent with username `\"e2e_user\"`",
      "Then the response status code is 409 Conflict with error `\"username_already_taken\"`",
      "And existing catalog endpoints `GET /books` and `GET /books/b-1` in `src/http.ts` respond with status 200"
    ],
    "title": "Complete end-to-end member signup persistence and catalog interaction journey",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001", "AC-002", "AC-003", "AC-005"],
    "fr_anchors": ["FR-001", "FR-002", "FR-003", "FR-004", "FR-006", "FR-007", "SC-001", "SC-002", "SC-003", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_full_lifecycle_chain",
    "validation_type": "e2e",
    "scenario_category": "e2e_chain"
  }
]
```
