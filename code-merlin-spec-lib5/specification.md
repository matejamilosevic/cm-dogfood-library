# Specification

- Work item: LIB-5 (db91423c-44a6-4d6a-abe3-21f0cb869b9d)
- Category: specification
- Version: 98310bfe-87d5-4a43-b678-012b0cde7a34
- Approval status: approved
- Approved at: 2026-10-02T08:44:01.276Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T09:16:00.874Z
- Source: https://staging.codemerlin.ai/work-items/db91423c-44a6-4d6a-abe3-21f0cb869b9d?tab=specification

## Outcome

Enable library patrons to register an account with a unique username and password, sign in to establish an authenticated session, sign out to revoke their session, and experience rate limiting against repeated failed sign-in attempts. Accounts persist durably across server restarts while active sessions reside in ephemeral memory and expire or clear upon restart, requiring patrons to sign in again.

## Current behavior

- `src/http.ts`: Dispatches REST routes for `/health`, `/books`, `/loans`, `/reservations`, `/holds`, and member lookups; already implements `POST /signup` for member registration, but provides no sign-in (`POST /signin`), sign-out (`POST /signout`), or session bearer token authentication.
- `src/members.ts`: Persists registered member accounts in JSON format on disk with salt-and-hash scrypt passwords and enforces unique usernames, but provides no credential verification, session lifecycle management, or sign-in rate limiting.
- `src/types.ts`: Defines domain models for books, members, loans, holds, notifications, reservations, and signup credentials, but does not define session tokens, sign-in credential payloads, or rate limit tracking models.

## User Stories

### User Story 1 — Account Registration (Priority: P1)

As a library patron, I want to create an account with a username and password so that I can authenticate with the library desk service.

**Why this priority**: Account creation is the foundation for authentication and patron identity.

**Independent Test**: Send a registration request with a valid username and password; verify the account is created successfully and persists across restarts.

**Acceptance Scenarios**:
- `AC-001`: Given an account store with no conflicting user, When a patron sends a `POST /signup` request with a valid username and password, Then a new account is registered and returned with HTTP status `201 Created`.
- `AC-002`: Given an existing account with username `reader1`, When a patron attempts to register with username `reader1` (case-insensitive), Then the system rejects the registration with HTTP status `409 Conflict`.

### User Story 2 — Sign In and Establish Session (Priority: P1)

As a registered patron, I want to sign in with my username and password so that the server recognizes my identity and issues a session token for subsequent actions.

**Why this priority**: Patrons must be able to verify their credentials and obtain an active session to authenticate requests without re-submitting passwords.

**Independent Test**: Register an account, submit matching credentials to sign in, receive a bearer session token, and verify that the server recognizes the session.

**Acceptance Scenarios**:
- `AC-003`: Given a registered account with username and password, When the patron sends a sign-in request with matching credentials, Then the server returns HTTP status `200 OK` with an active session token.
- `AC-004`: Given a sign-in request with an incorrect password or an unknown username, When the server evaluates the credentials, Then it rejects the attempt with HTTP status `401 Unauthorized` and one generic failure message.

### User Story 3 — Sign Out (Priority: P2)

As an authenticated patron, I want to sign out so that my active session is immediately terminated and cannot be reused.

**Why this priority**: Users need a reliable mechanism to terminate sessions on shared or public devices.

**Independent Test**: Sign in to obtain a session token, submit a sign-out request with that token, and verify subsequent attempts to use that token are rejected.

**Acceptance Scenarios**:
- `AC-005`: Given an active session token provided in the `Authorization: Bearer <session-token>` header, When the patron sends a sign-out request, Then the server revokes the session and returns HTTP status `200 OK`.
- `AC-006`: Given a revoked session token, When a request is made presenting that token, Then the server rejects the request with HTTP status `401 Unauthorized`.

### User Story 4 — Session Expiration and Invalidation on Server Restart (Priority: P2)

As a patron and system administrator, I want sessions to expire automatically and clear on server restarts while user accounts remain stored, so that stale sessions do not persist indefinitely.

**Why this priority**: In-memory ephemeral session storage guarantees that server restarts flush all sessions while preserving account credentials in durable storage.

**Independent Test**: Sign in to obtain a session token, restart the server process, verify that the account remains present in storage, and verify that the pre-restart session token is rejected requiring sign in again.

**Acceptance Scenarios**:
- `AC-007`: Given an active session that has reached its expiration time, When the client attempts to use that session, Then the server rejects the session as expired with HTTP status `401 Unauthorized`.
- `AC-008`: Given an active session and a durable account store, When the server process restarts, Then the account remains present and the pre-restart session token is invalid, requiring the patron to sign in again.

### User Story 5 — Rate Limiting on Failed Sign-Ins (Priority: P3)

As a system administrator, I want repeated failed sign-in attempts for a username to be rate limited so that patron accounts are protected against brute-force credential attacks.

**Why this priority**: Protects patron credentials and system availability by throttling abusive authentication traffic.

**Independent Test**: Submit repeated incorrect sign-in attempts for a username until exceeding the allowed failure limit; verify subsequent attempts return a rate-limit error response.

**Acceptance Scenarios**:
- `AC-009`: Given repeated failed sign-in attempts for a specific username exceeding the failure threshold, When another sign-in attempt is made for that username, Then the server returns HTTP status `429 Too Many Requests`.
- `AC-010`: Given a username currently throttled by rate limiting, When a sign-in request is sent with the correct password before the cooldown period elapses, Then the server rejects the request with HTTP status `429 Too Many Requests` without validating the password.

## Functional Requirements

- `FR-001` [US1, AC-001, AC-002]: Preserved: The system must allow creating an account via `POST /signup` with a unique username and password, persisting member records to disk and rejecting duplicate usernames.
- `FR-002` [US2, AC-003]: New: The system must expose a sign-in endpoint `POST /signin` in `src/http.ts` that accepts JSON containing `username` and `password`.
- `FR-003` [US2, AC-003]: New: When valid matching credentials are submitted to `POST /signin`, the system must generate a cryptographically random session token, record an active session in memory, and return HTTP status `200 OK` with the token.
- `FR-004` [US2, AC-004]: New: When sign-in credentials do not match an existing account or the password does not match, the system must return HTTP status `401 Unauthorized` with a generic failure message `invalid_credentials`.
- `FR-005` [US3, AC-005]: New: The system must expose a sign-out endpoint `POST /signout` in `src/http.ts` that authenticates requests using the `Authorization: Bearer <session-token>` header.
- `FR-006` [US3, AC-005, AC-006]: New: Upon receiving a valid sign-out request, the system must delete the corresponding session from memory and return HTTP status `200 OK`.
- `FR-007` [US4, AC-007]: New: The system must enforce session expiration such that sessions older than the configured TTL (default 24 hours) are rejected with HTTP status `401 Unauthorized`.
- `FR-008` [US4, AC-008]: Changed: Session records must be stored strictly in memory so that restarting the server clears all active sessions while registered accounts in `accounts.json` remain intact.
- `FR-009` [US5, AC-009, AC-010]: New: The system must track consecutive failed sign-in attempts by username in memory and block further attempts for that username with HTTP status `429 Too Many Requests` once the failure threshold (5 failed attempts within 15 minutes) is exceeded.
- `FR-010` [US5, AC-009]: New: Successful sign-in for a username must clear any accumulated failed attempt count for that username.

## Success Criteria

- `SC-001`: A person can register a new account with a username and password and receive a successful response.
- `SC-002`: A person can sign in with valid credentials and receive a session token.
- `SC-003`: A person presenting an active session token can sign out, after which that session token is rejected.
- `SC-004`: A wrong username or password consistently returns one generic failure message.
- `SC-005`: Repeated failed sign-ins for a username exceeding the limit are blocked with a rate-limiting response.
- `SC-006`: After a server restart, registered accounts remain accessible in persistent storage and pre-restart session tokens are rejected, requiring sign in again.

## Edge Cases

- Missing or empty credentials: A `POST /signin` request with missing, empty, or whitespace-only username or missing password returns HTTP status `400 Bad Request` with an appropriate error code.
- Non-existent username: Sign-in attempts with a non-existent username increment the rate limiter for that submitted username and return the identical generic `invalid_credentials` message as a wrong password.
- Malformed authorization header: Requests to `POST /signout` with missing, unparseable, or empty `Authorization` headers return HTTP status `401 Unauthorized`.
- Expired session reuse: Presenting an expired session token returns HTTP status `401 Unauthorized` and prompts the user to sign in again.
- Server restart during active sessions: Ephemeral session maps reset to empty on process restart without requiring file cleanup or causing unhandled exceptions.

## Out of Scope

- Password reset, email verification, or forgotten password workflows.
- Refresh tokens or multi-device sliding session synchronization.
- Persistent distributed session storage across multiple node cluster instances.
- Role-based access control or permission tiering for library staff versus regular patrons.

## Source Requirement Coverage

| Source AC | Covered by |
|---|---|
| A person can register with a username and password | AC-001, AC-002, FR-001, SC-001 |
| A person can sign in with that username and password | AC-003, FR-002, FR-003, SC-002 |
| A person can sign out | AC-005, AC-006, FR-005, FR-006, SC-003 |
| A wrong username or password shows one generic failure message | AC-004, FR-004, SC-004 |
| Repeated failed sign-ins are limited | AC-009, AC-010, FR-009, FR-010, SC-005 |
| After a restart, the account remains and the person must sign in again | AC-007, AC-008, FR-007, FR-008, SC-006 |
