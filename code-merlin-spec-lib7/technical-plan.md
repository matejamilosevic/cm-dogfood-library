# Technical Plan

- Work item: LIB-7 (f5e8cfc8-8e13-4158-9d98-72512f9925ec)
- Category: technical_plan
- Version: 1be48e9f-0ed9-44ee-9775-897f814ce691
- Approval status: approved
- Approved at: 2026-10-02T11:26:36.454Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T11:27:14.452Z
- Source: https://staging.codemerlin.ai/work-items/f5e8cfc8-8e13-4158-9d98-72512f9925ec?tab=technical_plan

# Technical Plan draft

## Technical approach
## Change Magnitude
**Change magnitude: SMALL**

## Current state vs target state
### Current State
Currently, `src/desk.ts` serves an interactive HTML5 library desk document via `renderDeskHtml()`. The header features an unauthenticated identity dropdown selector (`<select id="member">`) with hardcoded `<option>` elements for Ada Lovelace (`m-1`), Alan Turing (`m-2`), and Grace Hopper (`m-3`). Selecting an option switches the active patron context without credentials. When the page loads or when a visitor changes the selected patron, the client script invokes `refresh()`, which issues unauthenticated HTTP GET requests to `/books`, `/members/${memberId}/loans`, `/members/${memberId}/holds`, and `/members/${memberId}/reservations`. Furthermore, borrowing operations (`postJson()`) for `/loans`, `/holds`, and `/reservations` do not provide authentication tokens.

In `src/http.ts`, backend session management is already implemented: `POST /signup` registers accounts, `POST /signin` issues 64-character bearer tokens, and `POST /signout` revokes sessions. Furthermore, `requireSession()` and `readOwnActivity()` strictly enforce bearer token validation on `GET /members/:id/loans`, `GET /members/:id/holds`, and `GET /members/:id/reservations`, returning 401 Unauthorized when tokens are missing.

### Target State
In `src/desk.ts`, the static `<select id="member">` selector is eliminated. The desk renders dedicated visitor authentication forms: a sign-in form (username, password, submit button) and a sign-up form (username, password, submit button). An in-memory client session state holds the active bearer `sessionToken` and `activeMember` identity.

Submitting the sign-in form sends a JSON payload to `POST /signin`. If authentication fails (such as invalid credentials, rate limiting, or network error), the desk UI remains on the sign-in form and renders an explicit, user-friendly error message in `#error` explaining that authentication failed without navigating away. If sign-in succeeds, the client captures `body.token` and `body.account`, displays the authenticated member's identity (`#active-member`), displays an authenticated patron view with a sign-out control (`#signout-btn`), and triggers `refresh()`.

Submitting the sign-up form sends a JSON payload to `POST /signup`. Upon successful registration (201), the desk automatically signs the visitor in (or logs in using credentials) to establish the session. If registration fails (e.g. 409 `username_already_taken`), the desk remains on the form and displays the conflict explanation in `#error`.

During activity hydration (`refresh()`), the client script supplies the `Authorization: Bearer <sessionToken>` header to `/members/${activeMember.id}/loans`, `/members/${activeMember.id}/holds`, and `/members/${activeMember.id}/reservations`. Desk borrowing and return actions (`checkout`, `hold`, `reserve`, `return`, `pickup`) similarly include the bearer token header. Empty states are displayed when the member has no loans, holds, or reservations.

When an authenticated patron clicks the sign-out control, the client script issues `POST /signout` with the bearer token, clears the local session state (`sessionToken = null`, `activeMember = null`), clears loans and waitlist collections, and returns the visitor interface to the unauthenticated sign-in screen.

## Research decisions
1. **In-Memory Session State Storage**: In compliance with the out-of-scope constraint regarding persistent browser storage across restarts, the session bearer token and authenticated patron profile are retained solely within the browser execution scope of `clientScript`. No tokens are written to `localStorage` or `document.cookie`. A browser refresh safely resets the terminal to the sign-in screen.
2. **Direct Reuse of Existing HTTP Authentication Endpoints**: The client script directly integrates with the backend routes already available in `src/http.ts` (`POST /signup`, `POST /signin`, `POST /signout`) without introducing wrapper endpoints, middleware, or external dependencies.

## Component / module ownership
- **`src/desk.ts`**: Owns the markup layout in `renderDeskHtml()` (replacing `<select id="member">` with `#signin-form`, `#signup-form`, `#patron-view`, `#signout-btn`) and the embedded `clientScript` governing form submission, session token capture, error display, authenticated HTTP hydration, and sign-out.
- **`test/http.test.ts`**: Owns desk integration tests asserting the absence of the member dropdown selector, the presence of authentication form controls, and bearer-authenticated member activity rendering.
- **Unmodified components**: `src/http.ts`, `src/members.ts`, `src/catalog.ts`, `src/loans.ts`, `src/holds.ts`, `src/reservations.ts`, `src/server.ts`, and `src/types.ts` must NOT be modified as their existing functionality satisfies all backend requirements.

## Affected surfaces and verification
- `src/desk.ts`: Modified to replace `<select id="member">` markup with authentication forms, update `clientScript` event listeners for sign-up, sign-in, and sign-out, and pass bearer tokens in `refresh()` and `postJson()`.
- `test/http.test.ts`: Modified to update `deskPage()` test assertions, replacing obsolete checks for `<option value="m-1">Ada Lovelace</option>` with assertions for `#signin-form`, `#signup-form`, and authentication behavior.
- Verification: Executing `vitest run` validates that all desk tests and existing authentication suites (`test/auth.test.ts`, `test/member-access.test.ts`, `test/signup.test.ts`) pass cleanly.

## Affected components
- **library** — Modify `src/desk.ts` to replace the member dropdown with visitor authentication forms and authenticated activity hydration, and update `test/http.test.ts` to verify the new desk interface and absence of the member selector.

## Affected component allowlist
- `matejamilosevic/library:src/desk.ts` (modify) `renderDeskHtml`
- `matejamilosevic/library:test/http.test.ts` (modify) `library desk`

## Data model changes
No database schema or persisted data model changes are required. Member account records and session tokens continue to be managed by `src/members.ts`.

## API changes
No new or modified backend HTTP endpoints are required. The desk client script interfaces with existing endpoints in `src/http.ts`: 
- `POST /signup`: Body `{ "username": string, "password": string }`, returns 201 with `{ "account": { "id": string, "username": string, "createdAt": string } }` or 400/409.
- `POST /signin`: Body `{ "username": string, "password": string }`, returns 200 with `{ "token": string, "account": { "id": string, "username": string, "createdAt": string } }` or 400/401/429.
- `POST /signout`: Header `Authorization: Bearer <token>`, returns 200 with `{ "ok": true }` or 401.
- `GET /members/:id/loans`, `GET /members/:id/holds`, `GET /members/:id/reservations`: Header `Authorization: Bearer <token>`, returns 200 with member activity collections or 401/403/404.

## Migration / rollout
No database migration or feature flag is involved. Rollout is a direct deployment of the updated `src/desk.ts` template and client script. Rollback consists of reverting `src/desk.ts` and `test/http.test.ts` to the previous commit.

## Operational considerations
- Observability: Failed sign-in attempts and rate-limit triggers continue to log warnings to stderr (`WARN sign-in failed`, `WARN rate limit triggered for user: ...`). Tokens and credentials are never logged.
- Background processing: None; all operations are synchronous HTTP requests.
- Terminal privacy: Session tokens exist solely in client memory; closing or refreshing the tab resets the terminal to the sign-in state.

## Repository Matrix
| Repository Name | Needs Change | Role | Suggested Ship Order |
| --- | --- | --- | --- |
| matejamilosevic/library | Yes | Single deployable library service providing the in-memory library desk HTML UI, patron account authentication, loans, holds, and reservations. | 1 |

## Repository scope
All changes are strictly contained within `matejamilosevic/library`. No other repositories are involved or impacted.

## Risks
1. UI State Desynchronization on Token Expiry: If a patron's session token expires or is revoked while using the desk, subsequent requests return 401 Unauthorized. Mitigation: The client script catches 401 Unauthorized responses during `refresh()` or action dispatches, clears local session state, and prompts the visitor to sign in again.
2. Residual Data Visibility on Shared Terminals: If previous loan or hold items remain rendered in the DOM after signing out, the next visitor might view private patron activity. Mitigation: The sign-out handler immediately clears the innerHTML of `#loans` and `#queue`, resets empty notices, and hides the patron dashboard before returning to the sign-in view.
3. Existing Integration Test Regressions: Existing tests in `test/http.test.ts` assert on `<option value="m-1">Ada Lovelace</option>` in desk HTML. Mitigation: Update `test/http.test.ts` in lockstep to assert on authentication form controls and verify the absence of `<select id="member">`.

## Alternatives considered
1. Persistent Web Storage (`localStorage`/`sessionStorage`): Considered persisting bearer tokens in browser web storage to survive page reloads. Rejected because the approved specification explicitly places persistent browser storage across restarts out of scope, and storing tokens on shared library desk terminals creates identity exposure risks.
2. Hybrid Identity Picker with Password Prompt: Considered retaining the patron dropdown list and prompting only for a password. Rejected because the ticket and specification explicitly require removing the member picker (`SC-001: No member picker or identity dropdown is present anywhere on the desk interface`) to preserve patron privacy.

## Requirement mapping
- **FR-001** — addressed: Planned: In src/desk.ts, the desk UI shall replace the static member select element (`<select id="member">`) with visitor authentication forms offering sign-up (username and password) and sign-in (username and password).
- **FR-002** — addressed: Planned: When sign-in fails (such as invalid credentials, rate limiting, or network error), the desk UI shall remain on the sign-in form and display an explicit error message explaining that authentication failed.
- **FR-003** — addressed: Planned: Upon successful sign-up or sign-in, the desk UI shall capture the session bearer token and display the authenticated member's identity.
- **FR-004** — addressed: Planned: In src/desk.ts, member activity hydration for loans (`GET /members/:id/loans`), holds (`GET /members/:id/holds`), and reservations (`GET /members/:id/reservations`) shall supply the authenticated session bearer token and query only the authenticated member's ID.
- **FR-005** — addressed: Planned: The desk UI shall provide a sign-out control for authenticated members that triggers `POST /signout` (with session token), clears local session state, and returns the patron interface to the sign-in form.
- **SC-001** — addressed: Planned: No member picker or identity dropdown is present anywhere on the desk interface.
- **SC-002** — addressed: Planned: Failed sign-in attempts remain on the sign-in form and display a descriptive failure explanation without navigating away.
- **SC-003** — addressed: Planned: An authenticated patron successfully views their own active loans, holds, and reservations loaded from the authenticated endpoints.
- **SC-004** — addressed: Planned: Clicking the sign-out action terminates the active session and restores the unauthenticated sign-in view.

## ADR references
