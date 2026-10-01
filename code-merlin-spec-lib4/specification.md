# Specification

- Work item: LIB-4 (24a736df-ef1b-4df0-b479-e3fdb7438317)
- Category: specification
- Version: d81d939d-3dd2-42db-9178-55130218b560
- Approval status: approved
- Approved at: 2026-10-01T15:12:51.857Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-01T18:22:00.843Z
- Source: https://staging.codemerlin.ai/work-items/24a736df-ef1b-4df0-b479-e3fdb7438317?tab=specification

# Specification: Save member accounts

## Outcome

Enable new members to register library accounts with a unique username and a password via an HTTP signup endpoint, persisting their member accounts across server restarts in an initially empty account store without exposing stored passwords in plain text.

## Current behavior

- `src/members.ts` defines in-memory seed members (Ada Lovelace, Alan Turing, Grace Hopper) in a static `Map` keyed by `MemberId`, with lookup helpers by id and email.
- `src/types.ts` defines member records consisting solely of `id`, `name`, and `email`, with no representation for credentials, account usernames, or password hashes.
- `src/http.ts` handles REST routes for health, books, loans, reservations, and member lookups, but does not provide an account creation or signup route.
- `src/server.ts` bootstraps the Node.js HTTP server without any backing persistent storage for account records across restarts.

## User Stories

### User Story 1 — Register Member Account (Priority: P1)

As a new library member, I want to create an account with my unique username and password so that I can establish a member identity with the library.

**Why this priority**: Account creation is the core capability requested by the ticket and the prerequisite for member authentication and persistence.
**Independent Test**: Send a `POST /signup` request with a valid unique username and password; verify that a successful response is returned confirming account registration.
**Acceptance Scenarios**:
- `AC-001`: Given the account storage starts empty or contains no conflicting user, When a client sends a `POST /signup` request with a unique username and a password, Then a new member account is created and a success response status (`201 Created`) is returned.
- `AC-002`: Given an existing account registered with username `"reader1"`, When another client sends a `POST /signup` request with username `"reader1"`, Then the registration request is rejected with a conflict status (`409 Conflict`) indicating the username is already taken.

### User Story 2 — Secure Non-Readable Password Storage (Priority: P2)

As a security-conscious member, I want my password to never be stored or readable in plain text so that credentials cannot be exposed from persistent storage or API responses.

**Why this priority**: Preserves user credential confidentiality and complies with the explicit ticket requirement that passwords cannot be read back from storage.
**Independent Test**: Inspect the saved storage data after account creation and verify that plain text passwords are not present and cannot be read back.
**Acceptance Scenarios**:
- `AC-003`: Given an account registered with a plain text password, When storage contents or account retrieval records are inspected, Then the plain text password is not readable and cannot be recovered from storage.

### User Story 3 — Account Persistence Across Restarts (Priority: P3)

As a library system operator, I want member accounts to persist across server restarts while starting empty on initial clean setup, so that registered members retain their accounts when the server is restarted.

**Why this priority**: Eliminates loss of registered account data across server lifecycles, satisfying the persistence requirements of the ticket.
**Independent Test**: Register an account, stop and restart the server process against the configured storage path, and verify the registered account remains present and duplicate signup for that username remains rejected.
**Acceptance Scenarios**:
- `AC-004`: Given a new clean environment without prior saved account data, When the system initializes, Then the member account store starts empty.
- `AC-005`: Given one or more accounts registered during a server run, When the server process restarts, Then all previously registered member accounts remain preserved in storage.

## Functional Requirements

- `FR-001` [US1, AC-001]: New: The system must expose a `POST /signup` endpoint accepting a unique username and password payload in JSON format.
- `FR-002` [US1, AC-001]: New: When a `POST /signup` request is received with a valid, non-empty username and password, the system must save the new member account and return HTTP status `201 Created`.
- `FR-003` [US1, AC-002]: New: When a `POST /signup` request contains a username that matches an already existing account, the system must reject the request with HTTP status `409 Conflict` and an error indicating duplicate username.
- `FR-004` [US2, AC-003]: New: The system must store credentials in an irreversible one-way format (such as a cryptographic hash or salt-and-hash representation) such that the plain text password cannot be read back from storage or returned in API responses.
- `FR-005` [US3, AC-004]: New: On fresh system initialization with no prior persisted data file or record store, the member account repository must start empty.
- `FR-006` [US3, AC-005]: New: Member account data must be written to durable persistent storage so that stopping and restarting the server preserves all existing member accounts.
- `FR-007` [US1, AC-001]: Preserved: Existing book catalog, loan, hold, and reservation endpoints in `src/http.ts` must continue functioning normally alongside the new signup capability.

## Success Criteria

- `SC-001`: A new member can be saved with a unique username and a password.
- `SC-002`: The password cannot be read back from storage.
- `SC-003`: A second account with the same username is rejected.
- `SC-004`: Restarting the server does not remove existing accounts.
- `SC-005`: The account list starts empty on fresh initial configuration.

## Edge Cases

- Empty username or password strings provided in `POST /signup` payload must be rejected with HTTP status `400 Bad Request`.
- Malformed JSON payloads to `POST /signup` must return HTTP status `400 Bad Request` consistent with the existing server error handling.
- Case-sensitivity of usernames: usernames must either be normalized or uniquely evaluated consistently during both creation and duplicate checking.
- Persistent storage directory/file absence on initial start: the system must handle the absence of a pre-existing storage file gracefully by initializing an empty account store without throwing unhandled exceptions.

## Out of Scope

- Full session management, login tokens, or JWT issuance (the ticket scope is restricted to saving member accounts upon signup and persisting them).
- Password reset, recovery, or change workflows.
- Modifying legacy seeded demo members (`ada@library.test`, etc.) in `src/members.ts` unless migrating them into the persistent member store.

## Source Requirement Coverage

| Source AC | Covered by |
| --- | --- |
| A new member can be saved with a unique username and a password | AC-001, FR-001, FR-002, SC-001 |
| The password cannot be read back from storage | AC-003, FR-004, SC-002 |
| A second account with the same username is rejected | AC-002, FR-003, SC-003 |
| Restarting the server does not remove existing accounts | AC-005, FR-006, SC-004 |
| the list starts empty | AC-004, FR-005, SC-005 |
