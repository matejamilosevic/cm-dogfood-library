# Tasks

- Work item: LIB-7 (f5e8cfc8-8e13-4158-9d98-72512f9925ec)
- Category: tasks
- Version: 4b2d461b-45a1-495d-8963-bd587fbb8339
- Approval status: approved
- Approved at: 2026-10-02T11:26:41.618Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T11:27:15.452Z
- Source: https://staging.codemerlin.ai/work-items/f5e8cfc8-8e13-4158-9d98-72512f9925ec?tab=tasks

# Tasks

## matejamilosevic/library

### Task 1: [US1] Replace member dropdown with patron sign-up and sign-in forms in desk UI
- Done when:
  - Independent Test: Navigate to the desk UI in a browser, verify no member picker select dropdown exists, fill out the sign-up form to register a new account, and sign in with those credentials to see the authenticated view.
  - `renderDeskHtml()` in `src/desk.ts` eliminates the `<select id="member">` element and static patron `<option>` elements for `m-1`, `m-2`, and `m-3` (FR-001, SC-001)
  - `renderDeskHtml()` renders visitor sign-in form `#signin-form` with username and password input fields and submit button (FR-001, AC-001)
  - `renderDeskHtml()` renders visitor sign-up form `#signup-form` with username and password input fields and submit button (FR-001, AC-001)
  - Submitting `#signin-form` issues a POST request to `/signin` with `{ "username": string, "password": string }`
  - When sign-in fails (e.g. HTTP 401 with `invalid_credentials` or HTTP 429), the desk UI remains on `#signin-form` and displays an explicit error message in `#error` explaining that authentication failed without navigating away (FR-002, SC-002, AC-002)
  - Submitting `#signup-form` issues a POST request to `/signup` with `{ "username": string, "password": string }`; if registration encounters a conflict (HTTP 409 `username_already_taken`), the desk remains on the form and displays the explanation in `#error`
  - Upon successful sign-in or sign-up, client script captures the session bearer token (`body.token`), updates `#active-member` with the authenticated patron's display name or username, reveals `#patron-view`, and triggers activity refresh (FR-003, AC-003)

### Task 2: [US2] Add bearer token authorization for patron activity hydration in desk UI
- Done when:
  - Independent Test: Sign in as a member with known loans, holds, and reservations, and verify that the desk renders those specific loans, holds, and reservations.
  - `refresh()` in `src/desk.ts` supplies the authenticated session bearer token header `Authorization: Bearer <sessionToken>` when fetching `/members/${activeMember.id}/loans`, `/members/${activeMember.id}/holds`, and `/members/${activeMember.id}/reservations` (FR-004, SC-003, AC-004)
  - Borrowing and return operations (`checkout`, `hold`, `reserve`, `return`, `pickup`) in `src/desk.ts` pass the session bearer token header and query using the authenticated member ID (FR-004)
  - Active loans are rendered in `#loans`, and active waitlist holds and reservations are rendered in `#queue` (SC-003, AC-004)
  - When an authenticated patron has no current borrowings or waitlists, explicit empty state notices `#loans-empty` ('No current loans.') and `#queue-empty` ('No active waitlist items.') are displayed (AC-005)
  - If a request returns HTTP 401 Unauthorized during hydration or action dispatch, the client script clears local session state and resets the desk to the sign-in form

### Task 3: [US3] Add patron sign-out action and session teardown in desk UI
- Done when:
  - Independent Test: From an authenticated desk view, click the sign-out button and verify that the session ends and the view returns to the sign-in screen.
  - `renderDeskHtml()` in `src/desk.ts` includes sign-out action button `#signout-btn` within the authenticated patron view (FR-005, SC-004)
  - Clicking `#signout-btn` dispatches a POST request to `/signout` supplying the bearer token header `Authorization: Bearer <sessionToken>` (FR-005)
  - Sign-out handler clears client in-memory session state (`sessionToken = null`, `activeMember = null`), clears rendered collections in `#loans` and `#queue`, hides `#patron-view`, and displays `#signin-form` (FR-005, SC-004, AC-006)

### Task 4: Verify desk renders sign-up and sign-in forms without patron member picker
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` updates `deskPage()` tests to verify `GET /` returns status 200 with content-type `text/html; charset=utf-8`
  - Response HTML body contains `#signin-form` with username and password input fields
  - Response HTML body contains `#signup-form` with username and password input fields
  - Response HTML body does not contain `<select id="member">`
  - Response HTML body does not contain patron picker options for `m-1`, `m-2`, or `m-3`
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 5: Verify failed sign-in attempt remains on sign-in form and displays visible error
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that submitting sign-in credentials with username `reader1` and incorrect password `wrongpassword` receives HTTP 401 with error code `invalid_credentials`
  - Desk client script logic asserts that the interface remains on `#signin-form` without navigating away
  - Desk client script displays a visible error alert message in `#error` explaining that authentication failed
  - Patron dashboard `#patron-view` and sign-out control `#signout-btn` remain hidden
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 6: Verify successful patron sign-in establishes session and transitions to patron dashboard
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that submitting valid credentials for registered patron `reader1` (`secretpass123`) via `#signin-form` returns HTTP 200 with 64-character bearer token and account payload
  - Desk client script captures session token and displays authenticated member identity in `#active-member`
  - Desk view transitions from `#signin-form` to `#patron-view` with `#signout-btn` visible
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 7: Verify authenticated patron views their active loans, holds, and reservations
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that activity hydration queries `GET /members/:id/loans`, `GET /members/:id/holds`, and `GET /members/:id/reservations` with authenticated member ID and bearer token header `Authorization: Bearer <sessionToken>`
  - Desk renders active loans in `#loans` and active holds/reservations in `#queue`
  - Empty state notices `#loans-empty` and `#queue-empty` are hidden when activity records exist
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 8: Verify empty state notices for patron with no active borrowings or waitlists
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that an authenticated patron session with zero loans, holds, and reservations receives `{ loans: [] }`, `{ holds: [] }`, and `{ reservations: [] }`
  - `#loans-empty` is visible with text 'No current loans.'
  - `#queue-empty` is visible with text 'No active waitlist items.'
  - Activity lists `#loans` and `#queue` remain empty
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 9: Verify patron sign-out terminates session and restores unauthenticated sign-in view
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that clicking `#signout-btn` triggers `POST /signout` with `Authorization: Bearer <sessionToken>` and receives HTTP 200 `{ ok: true }`
  - Local bearer token and authenticated patron identity are cleared
  - Rendered collections `#loans` and `#queue` are emptied, and `#patron-view` is hidden
  - Visitor interface returns to `#signin-form`
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 10: Verify duplicate username registration conflict remains on sign-up form
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that attempting to register an existing username via `#signup-form` receives HTTP 409 with error code `username_already_taken`
  - Desk interface remains on `#signup-form` without navigating away
  - Explicit error message explaining the registration conflict is displayed in `#error`
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 11: Verify expired or revoked session resets desk interface to sign-in view
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that when a patron session token expires or is revoked, subsequent activity requests return HTTP 401 `unauthorized`
  - Client script catches HTTP 401 response during activity hydration or action dispatch
  - In-memory session state is cleared and the desk interface resets to `#signin-form`
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 12: Verify cross-patron activity access is rejected with HTTP 403 forbidden
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` verifies that supplying a session token for patron A while requesting activity endpoints (`/members/:id/loans`, `/members/:id/holds`, `/members/:id/reservations`) or actions for patron B returns HTTP 403 `forbidden`
  - Desk UI enforces querying and updating only the authenticated patron's own ID
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly

### Task 13: Verify complete patron desk lifecycle from registration and sign-in to activity and sign-out
- Kind: Repo Validation
- Done when:
  - `test/http.test.ts` executes an end-to-end integration flow: registers a new account via `#signup-form`, signs in via `#signin-form`, retrieves authenticated member loans, holds, and reservations, performs a loan checkout, and executes sign-out via `#signout-btn`
  - Verifies the desk cleanly transitions through unauthenticated, authenticated dashboard, and restored sign-in states
  - Focused test suite `npx vitest run test/http.test.ts` passes cleanly
