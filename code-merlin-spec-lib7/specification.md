# Specification

- Work item: LIB-7 (f5e8cfc8-8e13-4158-9d98-72512f9925ec)
- Category: specification
- Version: 9bc18986-4c6f-499e-ba53-88e3033ad099
- Approval status: approved
- Approved at: 2026-10-02T11:04:00.869Z
- Approved by: Mateja Milosevic (a60f8343-5bb4-43b1-b676-35b91cf79f72)
- Evaluation time: 2026-10-02T11:27:14.182Z
- Source: https://staging.codemerlin.ai/work-items/f5e8cfc8-8e13-4158-9d98-72512f9925ec?tab=specification

# Specification: Sign-up and Sign-in on the Desk

## Outcome
Visitors navigating to the browser-based library desk can register a new account or authenticate with an existing account via dedicated sign-up and sign-in forms without an unauthenticated member picker dropdown. Upon successful sign-in, the desk displays the authenticated member's personal loans, holds, and reservations, and allows them to sign out back to the sign-in form.

## Current behavior
- `src/desk.ts`: Serves an HTML page via `renderDeskHtml()` featuring an unauthenticated identity dropdown selector (`#member`) hardcoded with options `m-1` (Ada Lovelace), `m-2` (Alan Turing), and `m-3` (Grace Hopper) that immediately switches active patron context without authentication.
- `src/http.ts`: Exposes backend session and account endpoints `POST /signup`, `POST /signin`, and `POST /signout`, and enforces session bearer token authentication on `GET /members/:id/loans`, `GET /members/:id/holds`, and `GET /members/:id/reservations` while serving `GET /` publicly.

## User Stories

### User Story 1 — Patron Sign-up and Sign-in without Member Picker (Priority: P1)
As a library visitor accessing the desk, I want to create an account or sign in with my credentials rather than picking from a member list so that my account and activity remain private.
**Why this priority**: Core authentication entry point requested by the ticket; removes open identity impersonation from the desk.
**Independent Test**: Navigate to the desk UI in a browser, verify no member picker select dropdown exists, fill out the sign-up form to register a new account, and sign in with those credentials to see the authenticated view.
**Acceptance Scenarios**:
- AC-001: Given a visitor loads the desk interface at `GET /`, When the initial page renders, Then the desk displays sign-up and sign-in forms and does not render a member selector or dropdown picker.
- AC-002: Given a visitor submits the sign-in form with invalid credentials or when sign-in fails, When the server responds with an error, Then the desk stays on the sign-in form and displays a visible error explaining that sign-in failed.
- AC-003: Given an existing or newly registered account, When the visitor submits valid credentials via the sign-in form, Then the desk authenticates the session and transitions to the authenticated patron dashboard.

### User Story 2 — Patron Activity Display for Authenticated Member (Priority: P2)
As a signed-in library member, I want to see my current loans, holds, and reservations on the desk so that I can monitor all my borrowing activity in one place.
**Why this priority**: Delivers the patron value of checking personal borrowings and waitlists once authenticated.
**Independent Test**: Sign in as a member with known loans, holds, and reservations, and verify that the desk renders those specific loans, holds, and reservations.
**Acceptance Scenarios**:
- AC-004: Given an authenticated patron session, When the desk view loads activity data, Then the desk displays that member's active loans, holds, and reservations.
- AC-005: Given an authenticated patron session for a member with no current borrowings or waitlists, When the desk activity loads, Then empty state notices are displayed for loans, holds, and reservations.

### User Story 3 — Patron Sign-out (Priority: P3)
As a signed-in library member, I want to sign out from the desk when I finish my session so that the next visitor cannot view my loans, holds, or reservations.
**Why this priority**: Essential session lifecycle completion and privacy boundary for shared desk terminals.
**Independent Test**: From an authenticated desk view, click the sign-out button and verify that the session ends and the view returns to the sign-in screen.
**Acceptance Scenarios**:
- AC-006: Given an authenticated desk view, When the member triggers sign-out, Then the desk invalidates the session and returns the visitor to the sign-in screen with member activity hidden.

## Functional Requirements

- FR-001: Changed: In `src/desk.ts`, the desk UI shall replace the static member select element (`<select id="member">`) with visitor authentication forms offering sign-up (username and password) and sign-in (username and password). [US1, AC-001]
- FR-002: New: When sign-in fails (such as invalid credentials, rate limiting, or network error), the desk UI shall remain on the sign-in form and display an explicit error message explaining that authentication failed. [US1, AC-002]
- FR-003: New: Upon successful sign-up or sign-in, the desk UI shall capture the session bearer token and display the authenticated member's identity. [US1, AC-003]
- FR-004: Changed: In `src/desk.ts`, member activity hydration for loans (`GET /members/:id/loans`), holds (`GET /members/:id/holds`), and reservations (`GET /members/:id/reservations`) shall supply the authenticated session bearer token and query only the authenticated member's ID. [US2, AC-004, AC-005]
- FR-005: New: The desk UI shall provide a sign-out control for authenticated members that triggers `POST /signout` (with session token), clears local session state, and returns the patron interface to the sign-in form. [US3, AC-006]

## Success Criteria

- SC-001: No member picker or identity dropdown is present anywhere on the desk interface. [FR-001]
- SC-002: Failed sign-in attempts remain on the sign-in form and display a descriptive failure explanation without navigating away. [FR-002]
- SC-003: An authenticated patron successfully views their own active loans, holds, and reservations loaded from the authenticated endpoints. [FR-003, FR-004]
- SC-004: Clicking the sign-out action terminates the active session and restores the unauthenticated sign-in view. [FR-005]

## Edge Cases
- Empty / not-found states: When an authenticated member has no active loans, holds, or reservations, the desk renders explicit empty-state text for each section rather than breaking the layout.
- Unauthenticated direct actions: If a session token expires or is revoked while on the desk page, subsequent activity requests return an authentication failure and the UI resets to the sign-in screen.
- Duplicate username during sign-up: If a visitor attempts to register an existing username, the desk stays on the sign-up form and presents a conflict explanation.

## Out of Scope
- Password recovery, reset emails, or self-service password modification workflows.
- Multi-factor authentication (MFA) or OAuth/third-party identity providers.
- Persistent browser storage across browser restarts beyond in-memory desk session management.

## Source Requirement Coverage

| Source AC | Covered by |
|---|---|
| The desk offers sign-up and sign-in, with no member picker | AC-001, FR-001, SC-001 |
| A failed sign-in stays on the form and explains that it failed | AC-002, FR-002, SC-002 |
| After sign-in, the desk shows that member's loans, holds, and reservations | AC-003, AC-004, AC-005, FR-003, FR-004, SC-003 |
| Sign-out returns the visitor to the sign-in screen | AC-006, FR-005, SC-004 |
