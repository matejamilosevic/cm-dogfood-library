# Tests

- Work item: LIB-5 (db91423c-44a6-4d6a-abe3-21f0cb869b9d)
- Category: tests
- Version: 038281c7-c773-4cfa-8276-63d526c37f5f
- Approval status: approved
- Approved at: 2026-10-02T09:15:10.332Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T09:16:02.318Z
- Source: https://staging.codemerlin.ai/work-items/db91423c-44a6-4d6a-abe3-21f0cb869b9d?tab=tests

```json
[
  {
    "order": 1,
    "steps": [
      "Given an isolated account store in `src/members.ts` with no existing users",
      "When a patron sends POST /signup to `src/http.ts` with username 'reader1' and password 'secretpass123'",
      "Then the server returns HTTP status 201 Created",
      "And the response body contains an account object with username 'reader1' and valid id and createdAt",
      "And the response body and accounts.json do not contain the plaintext password"
    ],
    "title": "Successful member account registration with unique credentials",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001"],
    "fr_anchors": [],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "happy"
  },
  {
    "order": 2,
    "steps": [
      "Given an existing registered account with username 'reader1' in `src/members.ts`",
      "When a patron sends POST /signup to `src/http.ts` with username 'READER1' and password 'differentpass456'",
      "Then the server returns HTTP status 409 Conflict",
      "And the response body contains { \"error\": \"username_already_taken\" }"
    ],
    "title": "Rejection of duplicate member registration regardless of casing",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-002"],
    "fr_anchors": [],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "error"
  },
  {
    "order": 3,
    "steps": [
      "Given the POST /signup endpoint in `src/http.ts`",
      "When a client sends POST /signup with empty or whitespace-only username { \"username\": \"   \", \"password\": \"secretpass123\" }",
      "Then the server returns HTTP status 400 Bad Request with { \"error\": \"missing_username_or_password\" }",
      "When a client sends POST /signup with missing password { \"username\": \"reader1\" }",
      "Then the server returns HTTP status 400 Bad Request with { \"error\": \"missing_username_or_password\" }",
      "When a client sends POST /signup with malformed non-JSON payload",
      "Then the server returns HTTP status 400 Bad Request with { \"error\": \"invalid_json\" }"
    ],
    "title": "Input validation rejects missing credentials or malformed JSON on sign-up",
    "repo_keys": ["matejamilosevic/library"],
    "home_repo_key": "matejamilosevic/library"
  },
  {
    "order": 4,
    "steps": [
      "Given a registered patron account with username 'reader1' and password 'secretpass123' in `src/members.ts`",
      "When the patron sends POST /signin to `src/http.ts` with { \"username\": \"reader1\", \"password\": \"secretpass123\" }",
      "Then the server returns HTTP status 200 OK",
      "And the response body contains a 64-character hexadecimal session token string and patron account details",
      "And the ephemeral session is recorded in memory with a 24-hour expiration TTL"
    ],
    "title": "Successful patron sign-in issuing active bearer session token",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-003"],
    "fr_anchors": ["FR-002", "FR-003", "SC-002"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "happy"
  },
  {
    "order": 5,
    "steps": [
      "Given a registered patron account with username 'reader1' and password 'secretpass123' in `src/members.ts`",
      "When a client sends POST /signin to `src/http.ts` with username 'reader1' and mismatched password 'wrongpassword'",
      "Then the server returns HTTP status 401 Unauthorized with response body { \"error\": \"invalid_credentials\" }",
      "When a client sends POST /signin to `src/http.ts` with non-existent username 'unknown_user' and password 'any_password'",
      "Then the server returns HTTP status 401 Unauthorized with identical response body { \"error\": \"invalid_credentials\" }"
    ],
    "title": "Rejection of sign-in with invalid credentials returning generic failure message",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-004"],
    "fr_anchors": ["FR-004", "SC-004"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "auth_401"
  },
  {
    "order": 6,
    "steps": [
      "Given the POST /signin endpoint in `src/http.ts`",
      "When a client sends POST /signin with empty or whitespace-only username { \"username\": \"   \", \"password\": \"secret123\" }",
      "Then the server returns HTTP status 400 Bad Request with { \"error\": \"missing_username_or_password\" }",
      "When a client sends POST /signin with missing password { \"username\": \"reader1\" }",
      "Then the server returns HTTP status 400 Bad Request with { \"error\": \"missing_username_or_password\" }",
      "When a client sends POST /signin with malformed non-JSON payload",
      "Then the server returns HTTP status 400 Bad Request with { \"error\": \"invalid_json\" }"
    ],
    "title": "Input validation rejects missing credentials or malformed JSON on sign-in",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-004"],
    "fr_anchors": ["FR-002"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "error"
  },
  {
    "order": 7,
    "steps": [
      "Given an authenticated patron with an active session token obtained from POST /signin",
      "When the patron sends POST /signout to `src/http.ts` with request header 'Authorization: Bearer <token>'",
      "Then the server returns HTTP status 200 OK with body { \"ok\": true }",
      "And the active session token is immediately deleted from in-memory session storage in `src/members.ts`"
    ],
    "title": "Successful patron sign-out revoking active bearer session token",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-005"],
    "fr_anchors": ["FR-005", "FR-006", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "happy"
  },
  {
    "order": 8,
    "steps": [
      "Given a previously revoked or unknown session token string",
      "When a client sends POST /signout to `src/http.ts` with request header 'Authorization: Bearer <revoked-or-unknown-token>'",
      "Then the server rejects the request with HTTP status 401 Unauthorized and body { \"error\": \"unauthorized\" }"
    ],
    "title": "Rejection of sign-out attempt presenting revoked or unknown session token",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-006"],
    "fr_anchors": ["FR-006", "SC-003"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "auth_401"
  },
  {
    "order": 9,
    "steps": [
      "Given the POST /signout endpoint in `src/http.ts`",
      "When a client sends POST /signout with no Authorization header",
      "Then the server returns HTTP status 401 Unauthorized with body { \"error\": \"unauthorized\" }",
      "When a client sends POST /signout with header 'Authorization: Basic dXNlcjpwYXNz'",
      "Then the server returns HTTP status 401 Unauthorized with body { \"error\": \"unauthorized\" }",
      "When a client sends POST /signout with header 'Authorization: Bearer ' without a token string",
      "Then the server returns HTTP status 401 Unauthorized with body { \"error\": \"unauthorized\" }"
    ],
    "title": "Sign-out endpoint rejects missing or malformed Authorization header",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-005"],
    "fr_anchors": ["FR-005"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "unit",
    "scenario_category": "auth_401"
  },
  {
    "order": 10,
    "steps": [
      "Given an active session token in `src/members.ts` created with a timestamp older than 24 hours",
      "When the client sends a request presenting the expired token in the 'Authorization: Bearer <token>' header",
      "Then the server evaluates the expiration timestamp in `src/members.ts`, prunes the expired entry, and rejects the request with HTTP status 401 Unauthorized",
      "And the response body contains { \"error\": \"unauthorized\" }"
    ],
    "title": "Rejection of sign-in session that has exceeded 24-hour TTL expiration",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-007"],
    "fr_anchors": ["FR-007"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_expired_session",
    "validation_type": "unit",
    "scenario_category": "edge"
  },
  {
    "order": 11,
    "steps": [
      "Given an account registered via POST /signup persisted to accounts.json and an active session token issued via POST /signin",
      "When the server process restarts and `src/server.ts` re-initializes account storage without loading session state",
      "Then the account remains intact and queryable from durable storage in accounts.json",
      "And the pre-restart session token is rejected upon presentation to POST /signout with HTTP status 401 Unauthorized",
      "And the patron is able to authenticate afresh via POST /signin using their existing credentials"
    ],
    "title": "Server restart clears ephemeral sessions while preserving durable accounts",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-008"],
    "fr_anchors": ["FR-008", "SC-006"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_valid_patron",
    "validation_type": "integration",
    "scenario_category": "happy"
  },
  {
    "order": 12,
    "steps": [
      "Given a patron account with username 'lockout_user' in `src/members.ts`",
      "When the client sends 5 consecutive POST /signin requests with incorrect passwords within a 15-minute window",
      "Then each of the first 5 requests returns HTTP status 401 Unauthorized with { \"error\": \"invalid_credentials\" }",
      "When the client submits a 6th sign-in request for 'lockout_user'",
      "Then the server blocks the attempt with HTTP status 429 Too Many Requests and response body { \"error\": \"rate_limited\" }"
    ],
    "title": "Sign-in rate limiting throttles requests after 5 consecutive failures",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-009"],
    "fr_anchors": ["FR-009", "SC-005"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_throttled_patron",
    "validation_type": "unit",
    "scenario_category": "happy"
  },
  {
    "order": 13,
    "steps": [
      "Given a patron account 'lockout_user' currently throttled due to 5 consecutive failed attempts in `src/members.ts`",
      "When the client sends POST /signin for 'lockout_user' with the correct password before the 15-minute cooldown elapses",
      "Then the server rejects the request with HTTP status 429 Too Many Requests and body { \"error\": \"rate_limited\" } without validating credentials"
    ],
    "title": "Sign-in rate limiter blocks valid password submissions during cooldown period",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-010"],
    "fr_anchors": ["FR-009", "SC-005"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_throttled_patron",
    "validation_type": "unit",
    "scenario_category": "edge"
  },
  {
    "order": 14,
    "steps": [
      "Given a patron account with username 'lockout_user' having 3 accumulated failed sign-in attempts recorded in `src/members.ts`",
      "When the patron submits POST /signin with matching credentials { \"username\": \"lockout_user\", \"password\": \"correct_pass_999\" }",
      "Then the server returns HTTP status 200 OK with an active session token",
      "And the in-memory failure counter for 'lockout_user' is reset to zero",
      "And subsequent incorrect sign-in attempts start a fresh failure count without prematurely triggering HTTP 429"
    ],
    "title": "Successful sign-in clears accumulated failed attempt counter",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-009"],
    "fr_anchors": ["FR-010"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_throttled_patron",
    "validation_type": "unit",
    "scenario_category": "edge"
  },
  {
    "order": 15,
    "steps": [
      "Given a running HTTP server instance from `src/server.ts` configured with an isolated accounts storage directory",
      "When a new patron sends POST /signup to register username 'reader2' with password 'secondpass456'",
      "Then the server returns HTTP 201 Created confirming durable registration",
      "When the patron signs in via POST /signin with credentials 'reader2' and 'secondpass456'",
      "Then the server returns HTTP 200 OK with bearer token 'tok_patron_session'",
      "When the patron signs out via POST /signout with 'Authorization: Bearer tok_patron_session'",
      "Then the server returns HTTP 200 OK and subsequent signout attempts with the same token return 401 Unauthorized",
      "When the patron signs back in to acquire a new active token and the server process is restarted",
      "Then the stored account 'reader2' persists durably in accounts.json while the active session token is cleared and rejected with 401 Unauthorized",
      "And the patron successfully authenticates post-restart with their preserved password"
    ],
    "title": "End-to-end patron lifecycle across registration, authentication, signout, and restart",
    "repo_keys": ["matejamilosevic/library"],
    "ac_anchors": ["AC-001", "AC-003", "AC-005", "AC-006", "AC-008"],
    "fr_anchors": ["FR-003", "FR-006", "FR-008", "SC-002", "SC-003", "SC-006"],
    "harness_class": "in_repo",
    "home_repo_key": "matejamilosevic/library",
    "test_data_ref": "fixture_second_patron",
    "validation_type": "e2e",
    "scenario_category": "e2e_chain"
  }
]
```
