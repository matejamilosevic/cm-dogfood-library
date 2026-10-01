# LIB-3 technical plan

- Work item: LIB-3 (`9564907a-67c4-4350-85d0-a05e5fb442a9`)
- Title: Library desk in the browser
- Category: technical_plan
- Approval: approved
- Version: `f4c0e865-1548-43b7-b464-b6ef12258479`
- Approved at: 2026-10-01T10:19:06.480Z
- Approved by: Mateja Milosevic (`a60f8343-5bb4-43b1-b676-35b91cf79f72`)
- Evaluation time: 2026-10-01T10:19:57.105Z
- Member link: https://staging.codemerlin.ai/work-items/9564907a-67c4-4350-85d0-a05e5fb442a9?tab=technical_plan
- Implementation readiness: readyForHandoff=false; evaluatedAt=2026-10-01T10:19:41.003Z; rollupDigest=`5c68bc0cd31016aeae1f52c05940ebda`

---

# Technical Plan draft

## Technical approach
**Change magnitude: LARGE**

## Current state vs target state

### Current State
The library currently runs an in-memory HTTP server implemented with Node.js `node:http` on port 3456 (`src/server.ts`, `src/http.ts`). All existing endpoints return `application/json` data for catalog lookup (`GET /books`, `GET /books/:id-or-isbn`), loan transactions (`POST /loans`, `POST /loans/:id/return`), holds (`POST /holds`, `GET /members/:id/holds`, `GET /members/:id/notifications`), member loans (`GET /members/:id/loans`), and reservations (`POST /reservations`, `POST /reservations/:id/cancel`). Seeded members (`src/members.ts`) are Ada Lovelace (`m-1`), Alan Turing (`m-2`), and Grace Hopper (`m-3`). Currently, navigating to `GET /` returns a 404 JSON error (`{ "error": "not_found" }`), and `src/server.ts` hardcodes `{ 'content-type': 'application/json' }` and `JSON.stringify()` on every HTTP response. There is no web browser UI.

### Target State
The server exposes an interactive, browser-accessible desk interface directly at `GET /` returning `text/html; charset=utf-8`. The desk UI lets patrons select their active member identity (Ada Lovelace `m-1`, Alan Turing `m-2`, or Grace Hopper `m-3`), inspect live available copy counts for all seeded books (`b-1` through `b-4`), borrow available copies for 21-day loans, return active loans, submit holds or reservations when inventory is zero, track queue/fulfillment statuses (`waiting`, `pending`, `notified`, `held`), and pick up ready copies within the 7-day pickup window. Underlying business rules (21-day loan duration, 3-hold limit, FIFO queue order, 7-day pickup window, in-memory ephemeral storage) remain completely preserved.

## Research decisions

1. **Server-Generated Single-Page HTML Interface (`src/desk.ts`)**:
   - *Options considered*: (a) A multi-page application with traditional HTML form submissions and 302 redirects; (b) A separate Vite/React build pipeline; (c) A lightweight server-generated HTML document with embedded client JavaScript using native `fetch()` calls against the existing JSON API.
   - *Decision*: Option (c). The repository has zero frontend build dependencies (only TypeScript, tsx, and vitest). A self-contained HTML/client script served at `GET /` directly satisfies SC-002 (switching active member selector updates visible member loans, holds, and reservation statuses within 1 second without page refresh failure) while maintaining zero build overhead.
2. **Extending `HttpResult` with Optional Headers (`src/http.ts`, `src/server.ts`)**:
   - *Options considered*: (a) Serve static files from disk using `fs.readFile`; (b) Extend `HttpResult` in `src/http.ts` to include optional `headers?: Record<string, string>` and update `src/server.ts` to send the specified headers and stream or write string bodies directly.
   - *Decision*: Option (b). Keeps all request dispatch logic centralized in `handleRequest` in `src/http.ts`, keeps tests in `test/http.test.ts` synchronous and fast without file I/O mocking, and cleanly supports `text/html; charset=utf-8`.
3. **Exposing Member Reservations Endpoint (`GET /members/:id/reservations`)**:
   - *Options considered*: (a) Client-side tracking of reservations in LocalStorage; (b) Add `GET /members/:id/reservations` backed by `listReservationsForMember(memberId)` in `src/reservations.ts`.
   - *Decision*: Option (b). Following the established pattern of `GET /members/:id/loans` and `GET /members/:id/holds`, this provides accurate server-authoritative state across member switches and browser refreshes.

## Component / module ownership

- **`src/desk.ts`** (new): Owns the desk HTML template, UI layout, CSS styles, and client-side interaction script (DOM updates, API requests, error rendering, member state management).
- **`src/http.ts`** (modified): Owns route matching for `GET /` (dispatching to `renderDeskHtml()`) and `GET /members/:id/reservations`, as well as propagating response headers (`content-type`).
- **`src/server.ts`** (modified): Owns the Node.js HTTP listener, writing custom response headers from `HttpResult` and sending raw strings for HTML payloads without JSON serialization.
- **`src/reservations.ts`** (modified): Owns reservation queries; exports `listReservationsForMember(memberId: MemberId)`.
- **`src/loans.ts`**, **`src/holds.ts`**, **`src/catalog.ts`**, **`src/members.ts`**: Reused without business logic modification. Loan lengths (21 days), hold limits (3 active), FIFO queue ordering, and 7-day pickup expiry remain unchanged.
- **`test/http.test.ts`** (modified): Owns automated integration tests for `GET /`, `GET /members/:id/reservations`, and full browser desk workflow execution.

## Service interaction patterns

1. **Browser Navigation (`GET /`)**: The patron's browser issues an HTTP GET to `/`. `src/server.ts` forwards the request to `handleRequest` in `src/http.ts`, which calls `renderDeskHtml()` and returns status 200 with `{ 'content-type': 'text/html; charset=utf-8' }`. `src/server.ts` writes the headers and sends the HTML string.
2. **Catalog & Member State Hydration**: On page load or member selector change, the client script issues concurrent asynchronous `fetch()` requests to `GET /books`, `GET /members/:id/loans`, `GET /members/:id/holds`, and `GET /members/:id/reservations`. The desk UI updates the DOM within milliseconds.
3. **Borrowing & Returns**: When checkout is clicked, client sends `POST /loans` with `{ bookId, memberId }`. When return is clicked, client sends `POST /loans/:id/return`. Available copy counts and member loan lists refresh immediately.
4. **Holds, Reservations, and Pickup**: When stock is 0, client submits `POST /holds` or `POST /reservations`. When a copy is ready (`status === 'notified'` or `status === 'held'`), the pickup action triggers `POST /loans` for that book and member, completing the checkout and fulfilling the hold/reservation.

## Feature-flag keys

No feature flags are introduced. The desk UI is exposed directly upon server deployment on the root route `GET /`.

## Multi-tenancy contract

This application is a single-organization in-memory library service. Member isolation is maintained per request by requiring the explicit `memberId` parameter on member-scoped routes (`GET /members/:id/...`) and transaction payloads (`POST /loans`, `POST /holds`, `POST /reservations`). The browser desk stores the selected member ID in client memory and ensures patron actions execute strictly within that member's context.

## Affected components
- **library** — Adds interactive library desk browser interface served at GET /, updates HTTP dispatch in server.ts and http.ts to support HTML content types, adds member reservation endpoint in reservations.ts and http.ts, and adds integration tests in test/http.test.ts.

## Affected component allowlist
- `matejamilosevic/library:src/server.ts` (modify) `server`
- `matejamilosevic/library:src/http.ts` (modify) `handleRequest`
- `matejamilosevic/library:src/desk.ts` (create) `renderDeskHtml`
- `matejamilosevic/library:src/reservations.ts` (modify) `listReservationsForMember`
- `matejamilosevic/library:test/http.test.ts` (modify) `http`

## Data model changes
No persistent storage or database schema changes are introduced. State remains strictly in-memory within the Node.js process (`books` Map in `src/catalog.ts`, `members` Map in `src/members.ts`, `loans` Map in `src/loans.ts`, `holds` Map in `src/holds.ts`, and `reservations` Map in `src/reservations.ts`). A new in-memory accessor `listReservationsForMember(memberId: MemberId)` is added to `src/reservations.ts` to filter active and historical reservations by member ID.

## API changes
1. `GET /`
   - Method: `GET`
   - Route: `/`
   - Auth: None (public web interface)
   - Request Body: None
   - Response Headers: `content-type: text/html; charset=utf-8`
   - Response Body: Complete HTML5 document containing desk UI structure, styles, and client interaction script.
   - Status Codes: 200 OK.
   - Error Codes: None (always renders fallback desk page).

2. `GET /members/:id/reservations`
   - Method: `GET`
   - Route: `/members/:id/reservations`
   - Auth: None
   - Request Body: None
   - Response Headers: `content-type: application/json`
   - Response Body: `{ "reservations": Reservation[] }` where each reservation contains `id: string`, `bookId: string`, `memberId: string`, `createdAt: string`, `status: 'pending' | 'held' | 'fulfilled' | 'cancelled'`.
   - Status Codes: 200 OK, 404 Not Found.
   - Error Codes: 404 `{ "error": "member_not_found" }` if `:id` does not match an existing member (`m-1`, `m-2`, `m-3`).

## Migration / rollout
1. Deployment configuration: No migrations or staged flags are needed. The service is a stateless in-memory service.
2. Rollout sequence: Deploy updated application build to target environment; server process restarts and begins serving `GET /` immediately.
3. Rollback sequence: Revert to previous application build if any runtime regression occurs; no database or schema reversal required.

## Operational considerations
- Telemetry and logs: `src/server.ts` logs listener start `library listening on http://localhost:${port}`. Operators should monitor HTTP error responses, particularly 409 conflicts on `/loans`, `/holds`, and `/reservations` which indicate expected concurrency or policy enforcement (e.g. 3-hold limit, duplicate hold).
- Background processing: No async queues, workers, or timers are added. Pickup expiration is handled deterministically via `processHoldExpiration()` during availability queries and checkout operations.
- Privacy: No patron credentials or sensitive data are collected or logged.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/library | Yes | Single-repository hosting in-memory library API and serving interactive browser desk UI | 1 |

## Repository scope
Single repository matejamilosevic/library contains all changes: modifying src/server.ts, src/http.ts, and src/reservations.ts; adding src/desk.ts; and expanding test/http.test.ts.

## Risks
1. Risk from migration: No schema migration is required as the data store is in-memory; condition of zero persistent migrations ensures zero risk of data loss, table lock, or constraint violation.
2. Multi-tenancy risk: Patrons accessing the shared desk in a single browser session could inadvertently execute actions under another member's name if identity is improperly tracked. Blast radius is confined to in-memory loans and holds for that session. Mitigation: The desk UI maintains an explicit active member selector, displays the active member prominently, and sends explicit `memberId` fields in every API mutation.
3. Performance risk: Excessive client polling for availability or queue updates could saturate the single-threaded Node event loop. Blast radius is degraded response latency. Mitigation: The desk UI avoids polling loops and updates state on demand during explicit user actions (member switch, checkout, return, hold, pickup).
4. Rollback risk: Reverting the server deployment to the prior revision involves zero state rollback because state is stored in Node memory and resets upon restart.
5. Concurrency / race condition risk: Two patrons in different browser windows attempting to check out the final available copy simultaneously. Blast radius: One checkout succeeds with 201, the second fails with 409 `no_copies_available` or `queue_priority_conflict`. Mitigation: The desk UI catches 409 responses, displays user-friendly error banners, and triggers an immediate refresh of book availability.

## Alternatives considered
1. Separate Frontend Single-Page Application (SPA) with Vite/React: Considered building a dedicated client app in a `frontend/` directory with bundler build steps. Rejected because the ticket explicitly asks to 'Add a page on the same server so a member can do that from a browser' without adding heavy build toolchains or deployment artifacts to this minimal Node.js repo. Residual risk is writing plain HTML/JS in `src/desk.ts` without JSX.
2. Multi-Page Server-Side Form Submissions with 302 Redirects: Considered using traditional HTML `<form method="POST">` actions with page reloads for each checkout or return. Rejected because SC-002 requires switching the active member selector to update visible loans, holds, and reservations within 1 second without page refresh failure. Residual risk is reliance on client-side `fetch()` APIs.

## Requirement mapping
- **FR-001** — addressed: Planned: In src/http.ts and src/desk.ts, the server must serve an interactive library desk web interface at GET / (or designated desk URL) returning an HTML document usable from standard web browsers.
- **FR-002** — addressed: Planned: In src/desk.ts, the desk UI must provide a member selector allowing the user to select between Ada Lovelace (m-1), Alan Turing (m-2), and Grace Hopper (m-3), establishing the active member for all desk actions without requiring authentication credentials.
- **FR-003** — addressed: Planned: In src/desk.ts, the desk UI must list every catalog title alongside its current number of available copies, updating when inventory changes.
- **FR-004** — addressed: Planned: In src/desk.ts, when a book has at least one available copy, the desk UI must allow the selected member to trigger a checkout, invoking the existing loan creation with a standard 21-day duration and updating copy counts.
- **FR-005** — addressed: Planned: In src/desk.ts, the desk UI must display active loans for the selected member and provide a return action for each active loan, invoking the return operation and restoring copy availability.
- **FR-006** — addressed: Planned: In src/desk.ts, when a book has zero available copies, the desk UI must allow the selected member to submit a hold or reservation, respecting existing constraints (including the 3-hold limit and queue order).
- **FR-007** — addressed: Planned: In src/desk.ts, the desk UI must display the selected member's active holds and reservations, showing current status (such as `waiting`, `pending`, or ready for pickup / `notified` / `held`) along with any applicable pickup deadline within the 7-day window.
- **FR-008** — addressed: Planned: In src/desk.ts, when a copy is ready for pickup for the selected member, the desk UI must allow the member to complete the pickup, converting the ready hold/reservation into a completed checkout.
- **SC-001** — addressed: Planned: In test/http.test.ts, verify that 100% of seeded catalog titles and their available copy counts are visible in a web browser without manual API calls.
- **SC-002** — addressed: Planned: In test/http.test.ts, verify that switching the active member selector in the browser updates visible member loans, holds, and reservation statuses within 1 second without page refresh failure.
- **SC-003** — addressed: Planned: In test/http.test.ts, verify that completing a checkout action from the desk produces a loan with a due date exactly 21 days from the checkout date and decrements available copies by 1.
- **SC-004** — addressed: Planned: In src/desk.ts, returning an active loan from the desk restores book availability or promotes the next waiting hold/reservation immediately.
- **SC-005** — addressed: Planned: In test/http.test.ts, verify that members cannot place more than 3 active holds, and duplicate holds for the same title by the same member are rejected with user-visible feedback.
- **SC-006** — addressed: Planned: In src/desk.ts, a patron with a ready/notified hold can execute a pickup within the 7-day window directly from the desk UI, receiving an active loan.

## ADR references
