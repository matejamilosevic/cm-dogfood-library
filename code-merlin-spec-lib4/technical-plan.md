# Technical plan

- Work item: LIB-4 (24a736df-ef1b-4df0-b479-e3fdb7438317)
- Category: technical_plan
- Version: 92b02d57-af20-4e93-b461-84e2439959d9
- Approval status: approved
- Approved at: 2026-10-01T18:21:01.528Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-01T18:22:01.652Z
- Source: https://staging.codemerlin.ai/work-items/24a736df-ef1b-4df0-b479-e3fdb7438317?tab=technical_plan

# Technical Plan draft

## Technical approach
**Change magnitude: LARGE**

## Current state vs target state
- **Current State**:
  - In `src/members.ts`, library members Ada Lovelace (`m-1`), Alan Turing (`m-2`), and Grace Hopper (`m-3`) are defined statically in an in-memory `Map<MemberId, Member>`. There is no persistent storage backing member records across server restarts.
  - In `src/types.ts`, `Member` is defined with only `id: MemberId`, `name: string`, and `email: string`. There are no credential structures, username fields, or password hash definitions.
  - In `src/http.ts`, `handleRequest(method, pathname, body)` routes requests for health, books, loans, reservations, holds, and member loan history. It does not provide any account registration or signup endpoint.
  - In `src/server.ts`, an HTTP server is created on port 3456 forwarding incoming payloads to `handleRequest` without persistent account storage initialization.
- **Target State (Delta)**:
  - *Reused unchanged*: Existing book catalog (`src/catalog.ts`), loans (`src/loans.ts`), reservations (`src/reservations.ts`), holds (`src/holds.ts`), and seeded demo members for checkout/loan functionality.
  - *Modified*: `src/types.ts` is updated to define `MemberAccount` and credential payload types; `src/members.ts` is expanded to manage member accounts with cryptographic password hashing, duplicate username checking, empty initial state on clean setup, and durable file-based persistence; `src/http.ts` is modified to expose `POST /signup` returning `201 Created` on success, `400 Bad Request` on invalid/empty credentials, and `409 Conflict` on duplicate usernames, while preserving existing routes.
  - *Genuinely new*: Durable account storage file (defaulting to `./data/accounts.json`), one-way password hashing routines using Node's standard `node:crypto` (`scrypt` / `pbkdf2` with salt).

## Research decisions
1. **Cryptographic hashing via built-in `node:crypto`**:
   - *Option considered*: External dependencies such as `bcrypt` or `argon2`.
   - *Decision*: Use Node's built-in `node:crypto` module (`scryptSync` or `pbkdf2Sync` with per-account cryptographically random salt). The project runs on Node >= 20, avoiding native compilation dependencies while ensuring plain text passwords cannot be recovered or read back from storage.
2. **Durable file-based persistence with atomic replacement**:
   - *Option considered*: SQLite (`better-sqlite3`) or an external relational database.
   - *Decision*: Store member accounts in a structured JSON file (`./data/accounts.json` or path from `ACCOUNTS_FILE` env var) written atomically (write to temp file then rename). This avoids introducing external database processes into this lightweight library service while ensuring accounts persist across restarts.
3. **Isolation of member accounts from seeded demo members**:
   - *Option considered*: Migrating seeded members (`m-1`, `m-2`, `m-3`) into the persistent account store.
   - *Decision*: Keep seeded members separate in `src/members.ts` for catalog and loan fixtures as specified in the out-of-scope boundaries, ensuring the persistent account store starts completely empty on clean initialization.

## Component / module ownership
- **`matejamilosevic/library`** owns the implementation across the following files:
  - `src/types.ts`: Owns domain types including `MemberAccount`.
  - `src/members.ts`: Owns member account storage, password hashing, username collision checks, and file serialization.
  - `src/http.ts`: Owns HTTP request routing, parameter validation, and status code responses for `POST /signup`.
  - `src/server.ts`: Owns server bootstrap and storage initialization.
  - *Unmodified components*: `src/catalog.ts`, `src/loans.ts`, `src/reservations.ts`, and `src/holds.ts` must not be modified.

## Service interaction patterns
- Synchronous HTTP request dispatch: Node's HTTP server in `src/server.ts` parses incoming request bodies and calls `handleRequest(method, pathname, body)` in `src/http.ts`.
- `POST /signup` invokes `registerMemberAccount({ username, password })` in `src/members.ts`.
- Failure modes:
  - Malformed JSON: returns `400 Bad Request` with `{ error: 'invalid_json' }`.
  - Missing or empty username/password: returns `400 Bad Request` with `{ error: 'missing_username_or_password' }`.
  - Duplicate username: `src/members.ts` raises a conflict, translated by `src/http.ts` into `409 Conflict` with `{ error: 'username_already_taken' }`.
  - Persistence write failure: caught and logged, returning `500 Internal Server Error`.

## Feature-flag keys
- No feature flags are configured in this repository; all capabilities are active by default.

## Multi-tenancy contract
- Single-tenant library system. Account isolation is enforced by strictly unique usernames across the account repository. Plain text passwords are never stored or exposed via any read path or API response.

## Affected components
- **library** — Adds member account registration and persistence: defines MemberAccount types in src/types.ts, implements salt-and-hash password storage and durable file persistence in src/members.ts, routes POST /signup in src/http.ts, and bootstraps persistence in src/server.ts.

## Affected component allowlist
- `matejamilosevic/library:src/http.ts` (modify) `handleRequest`
- `matejamilosevic/library:src/members.ts` (modify) `registerMemberAccount`
- `matejamilosevic/library:src/types.ts` (modify) `MemberAccount`
- `matejamilosevic/library:src/server.ts` (modify) `server`

## Data model changes
- **Persisted Entity**: `MemberAccount`
- **Storage Mechanism**: Durable JSON storage file (default `./data/accounts.json` or path configured via `ACCOUNTS_FILE`), created idempotently with parent directories.
- **Schema Fields**:
  - `id`: string (unique identifier `m-acc-<sequence>` or UUID v4, non-null, primary key)
  - `username`: string (unique, non-empty, evaluated case-insensitively, indexed in memory)
  - `passwordHash`: string (cryptographic salt-and-hash format `salt:hash`, non-null, irreversible)
  - `createdAt`: string (ISO 8601 UTC timestamp, non-null)
- **Security Guarantee**: Plain text passwords are never written to disk or held in the persistent data model.
- **Repository Definition Path**: `src/types.ts` and `src/members.ts`.

## API changes
- **Route**: `POST /signup`
  - **Authentication / Authorization**: Public unauthenticated route.
  - **Request Body**:
    ```json
    {
      "username": "string (required, non-empty)",
      "password": "string (required, non-empty)"
    }
    ```
  - **Response Body & Status Codes**:
    - `201 Created`:
      ```json
      {
        "account": {
          "id": "string",
          "username": "string",
          "createdAt": "string"
        }
      }
      ```
    - `400 Bad Request`:
      ```json
      {
        "error": "invalid_json" | "missing_username_or_password"
      }
      ```
    - `409 Conflict`:
      ```json
      {
        "error": "username_already_taken"
      }
      ```
- **Preserved Existing Routes**:
  - `GET /health` (200)
  - `GET /books`, `GET /books/:id-or-isbn` (200 / 404)
  - `POST /loans`, `POST /loans/:id/return` (201 / 200 / 400 / 404 / 409)
  - `POST /reservations`, `POST /reservations/:id/cancel` (201 / 200 / 400 / 404 / 409)
  - `POST /holds` (201 / 400 / 404 / 409)
  - `GET /members/:id/holds`, `GET /members/:id/notifications`, `GET /members/:id/loans` (200 / 404)

## Migration / rollout
1. **Rollout Controls**: Ensure the persistent storage directory (`./data` or configured path) is writable by the process. No database migration runners are needed.
2. **Rollout Order**:
   - Deploy updated code with `MemberAccount` types, hashing, persistence routines, and signup route.
   - On startup, `src/server.ts` / `src/members.ts` checks for the persistent accounts file: if missing, initialize an empty in-memory store without error; if present, load existing accounts.
   - Start HTTP listener on port 3456 serving both legacy endpoints and `POST /signup`.
3. **Rollback Strategy**: Revert to the previous application binary. Existing book catalog and loan operations continue functioning without modification, and existing `accounts.json` data remains intact on disk.

## Operational considerations
- **Observability & Logging**: Log `accounts store initialized: [empty | N accounts loaded]` during server start. Log successful signup events with username only; never log plain text passwords or password hashes. Log `WARN` on duplicate username conflicts.
- **Async / Background Processing**: File persistence writes execute atomically via `fs.promises` or synchronous atomic write-rename. No queue or external worker process is added.
- **Privacy & Security Constraints**: Plain text passwords must never be logged, cached, or returned in HTTP response bodies.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/library | Yes | Single-repository service providing HTTP API, member account storage, password hashing, and persistent account state across restarts. | 1 |

## Repository scope
The implementation is strictly scoped to matejamilosevic/library. Changes are localized to src/types.ts, src/members.ts, src/http.ts, and src/server.ts, with regression test coverage in test/http.test.ts.

## Risks
1. **Storage File Corruption on Concurrent Writes or Process Crashes**: If multiple signups occur concurrently or the process terminates abruptly mid-write, a naive `fs.writeFile` could corrupt `accounts.json`. *Mitigation*: Write to a temporary file (`accounts.json.tmp`) and atomically rename it (`fs.rename`), ensuring readers always see a complete file.
2. **Performance Latency from Password Hashing**: Computing cryptographic hashes (scrypt or PBKDF2) synchronously on the event loop could delay other requests during high signup volume. *Mitigation*: Use asynchronous hashing methods from `node:crypto` with balanced iteration counts.
3. **Rollback Safety**: Reverting to earlier application revisions could make newly registered accounts inaccessible if the file format changes. *Mitigation*: Maintain standard JSON structure with forward-compatible optional fields.
4. **Credential Leakage in Logs or Errors**: Unhandled errors during signup might print request bodies containing plain text passwords into stdout/stderr. *Mitigation*: Sanitize all error reporting and log statements to exclude payload credential properties.

## Alternatives considered
1. **In-Memory Storage Flushed on Process Exit**: Keep accounts strictly in memory and flush to disk only during `process.on('SIGINT')` / `process.on('SIGTERM')`. *Why not chosen*: Abrupt process termination (`SIGKILL`, container eviction, power loss) would lose accounts created since server start, violating FR-006 and SC-004.
2. **SQLite or External Database Service**: Introduce SQLite or an external database engine. *Why not chosen*: The repository currently operates with zero external database dependencies. Adding native build modules or external database infrastructure adds disproportionate operational complexity for the library's current scope.

## Requirement mapping
- **FR-001** — addressed: Planned: The system must expose a `POST /signup` endpoint accepting a unique username and password payload in JSON format.
- **FR-002** — addressed: Planned: When a `POST /signup` request is received with a valid, non-empty username and password, the system must save the new member account and return HTTP status `201 Created`.
- **FR-003** — addressed: Planned: When a `POST /signup` request contains a username that matches an already existing account, the system must reject the request with HTTP status `409 Conflict` and an error indicating duplicate username.
- **FR-004** — addressed: Planned: The system must store credentials in an irreversible one-way format (such as a cryptographic hash or salt-and-hash representation) such that the plain text password cannot be read back from storage or returned in API responses.
- **FR-005** — addressed: Planned: On fresh system initialization with no prior persisted data file or record store, the member account repository must start empty.
- **FR-006** — addressed: Planned: Member account data must be written to durable persistent storage so that stopping and restarting the server preserves all existing member accounts.
- **FR-007** — addressed: Planned: Existing book catalog, loan, hold, and reservation endpoints in `src/http.ts` must continue functioning normally alongside the new signup capability.
- **SC-001** — addressed: Planned: A new member can be saved with a unique username and a password.
- **SC-002** — addressed: Planned: The password cannot be read back from storage.
- **SC-003** — addressed: Planned: A second account with the same username is rejected.
- **SC-004** — addressed: Planned: Restarting the server does not remove existing accounts.
- **SC-005** — addressed: Planned: The account list starts empty on fresh initial configuration.

## ADR references
