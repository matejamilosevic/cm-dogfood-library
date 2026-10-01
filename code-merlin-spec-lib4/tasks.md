# Tasks

- Work item: LIB-4 (24a736df-ef1b-4df0-b479-e3fdb7438317)
- Category: tasks
- Version: 7f2dee4f-1a0d-41e2-8c9f-f2eeb7cabe53
- Approval status: approved
- Approved at: 2026-10-01T18:21:20.968Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-01T18:22:03.357Z
- Source: https://staging.codemerlin.ai/work-items/24a736df-ef1b-4df0-b479-e3fdb7438317?tab=tasks

# Tasks

## matejamilosevic/library

### Task 1: Define MemberAccount and credential types in src/types.ts
- Done when:
  - Define and export `MemberAccount` type in `src/types.ts` containing `id: string`, `username: string`, `passwordHash: string`, and `createdAt: string`
  - Ensure credential data types guarantee plain text passwords are never stored in the account model (FR-004)

### Task 2: [US3] Implement durable account persistence and clean store initialization in src/members.ts and src/server.ts
- Done when:
  - Register an account, stop and restart the server process against configured storage path, and verify registered account remains present and duplicate signup for that username remains rejected (FR-006, SC-004, AC-005)
  - Initialize member account store as empty on clean startup when no persistence file exists (FR-005, SC-005, AC-004)
  - Implement atomic file writing using temporary file rename defaulting to `./data/accounts.json` or `ACCOUNTS_FILE` env var path
  - In `src/server.ts`, initialize member account persistence on startup, loading existing accounts from durable storage file if present
  - Ensure legacy seeded demo members (`m-1`, `m-2`, `m-3`) remain isolated from the persistent account store

### Task 3: [US1] Implement POST /signup endpoint and member account registration in src/http.ts and src/members.ts
- Done when:
  - Send a `POST /signup` request with a valid unique username and password; verify that a successful response is returned confirming account registration
  - `POST /signup` with valid username and password creates account and returns status `201 Created` with body `{ "account": { "id": string, "username": string, "createdAt": string } }` (FR-001, FR-002, SC-001, AC-001)
  - Duplicate username registration returns status `409 Conflict` with `{ "error": "username_already_taken" }` (FR-003, SC-003, AC-002)
  - Missing or empty username or password returns status `400 Bad Request` with `{ "error": "missing_username_or_password" }`
  - Malformed JSON body returns status `400 Bad Request` with `{ "error": "invalid_json" }`
  - Existing catalog, loan, reservation, and hold routes continue functioning without regressions (FR-007)

### Task 4: [US2] Implement one-way cryptographic password hashing in src/members.ts
- Done when:
  - Inspect saved storage data after account creation and verify plain text passwords are not present and cannot be read back
  - Use built-in `node:crypto` (`scryptSync` or `pbkdf2Sync` with per-account salt) to store passwords in irreversible format `salt:hash` (FR-004, SC-002, AC-003)
  - Plain text passwords and password hashes are never returned in API responses or leaked to error logs

### Task 5: Verify member account registration returns 201 Created and excludes password fields
- Kind: Repo Validation
- Done when:
  - Given an empty member account store, `POST /signup` with body `{"username": "reader1", "password": "secretpass123"}` returns status `201 Created`
  - Response body contains an account object with non-empty string `id`, username `"reader1"`, and ISO 8601 string `createdAt`
  - Response body does not contain a `password` or `passwordHash` field

### Task 6: Verify duplicate username registration is rejected with 409 Conflict
- Kind: Repo Validation
- Done when:
  - When account with username `"reader1"` exists, a subsequent `POST /signup` with body `{"username": "reader1", "password": "anotherpass456"}` returns status `409 Conflict`
  - Response body contains `{ "error": "username_already_taken" }`
  - `POST /signup` with uppercase variant `{"username": "READER1", "password": "yetAnotherPass"}` returns status `409 Conflict` and `{ "error": "username_already_taken" }`

### Task 7: Verify missing or empty username or password returns 400 Bad Request
- Kind: Repo Validation
- Done when:
  - `POST /signup` with missing or empty `username` returns status `400 Bad Request` with `{ "error": "missing_username_or_password" }`
  - `POST /signup` with missing or empty `password` returns status `400 Bad Request` with `{ "error": "missing_username_or_password" }`

### Task 8: Verify password cannot be read back from persistent storage or API responses
- Kind: Repo Validation
- Done when:
  - Inspect persistent storage JSON file after registration; confirm plain text password is not stored and password is saved only as cryptographic `salt:hash`
  - Verify that account lookup functions and API responses do not expose plain text password or allow its recovery (FR-004, SC-002, AC-003)

### Task 9: Verify member account list starts empty on fresh initial configuration
- Kind: Repo Validation
- Done when:
  - On fresh system initialization with no prior persisted data file, verify member account list starts completely empty (FR-005, SC-005, AC-004)
  - Absence of pre-existing storage file does not throw unhandled exceptions or error on startup

### Task 10: Verify member accounts persist across server restart and maintain uniqueness
- Kind: Repo Validation
- Done when:
  - Register a member account, simulate server restart by reloading storage from the persisted file, and verify all registered accounts remain intact (FR-006, SC-004, AC-005)
  - Subsequent registration attempts with previously registered usernames continue to be rejected with status `409 Conflict`

### Task 11: Verify existing catalog, loan, hold, and reservation endpoints continue functioning
- Kind: Repo Validation
- Done when:
  - `GET /books` returns status 200 with catalog entries
  - `POST /loans` succeeds with status 201 for valid book checkout
  - `POST /reservations` and `POST /holds` operate without regression alongside member signup (FR-007)

### Task 12: Verify malformed JSON signup requests return 400 Bad Request
- Kind: Repo Validation
- Done when:
  - Send non-JSON or syntactically invalid payload to `POST /signup`; confirm response status is `400 Bad Request`
  - Response body contains `{ "error": "invalid_json" }`

### Task 13: Verify case-insensitive duplicate username registration is rejected with 409 Conflict
- Kind: Repo Validation
- Done when:
  - Given an account registered with `"reader1"`, sending `POST /signup` with `"READER1"` or `"Reader1"` returns status `409 Conflict`
  - Response body contains `{ "error": "username_already_taken" }`
