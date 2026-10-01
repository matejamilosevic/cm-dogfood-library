# library

Personal sandbox for dogfooding [CodeMerlin](https://github.com/AmulentTech/EngIntelligence) persist remainder lints (DC-497). It is a tiny in-memory library desk: catalog, members, checkout, and return already work. Holds, overdue fees, and waitlists do **not**.

## Run

```bash
npm install
npm test
npm run dev
```

Server defaults to `http://localhost:3456`.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | `{ ok: true }` |
| GET | `/books` | Seeded catalog |
| GET | `/books/:id-or-isbn` | One title |
| POST | `/loans` | Body `{ "bookId": "b-1", "memberId": "m-1" }` or `{ "email": "ada@library.test" }` |
| POST | `/loans/:id/return` | Return a copy |
| GET | `/members/:id/loans` | Open + past loans |

Seeded members: Ada (`m-1`, `ada@library.test`), Alan (`m-2`, `alan@library.test`). Pride and Prejudice (`b-2`) has a single copy, so a second checkout 409s.

## Suggested CodeMerlin ticket

Paste something like this into Jira/Linear after you connect this repo and select it on the work item:

**Title:** Hold a title when every copy is out

**Description:**

```
## Requirements
- FR-001 Members can check out a copy when one is available, for 21 days, and return it.
- FR-002 Members can look up a book by ISBN (dashes optional) and see remaining copies.
- FR-003 When no copies remain, a member can place a hold and is notified in order when a copy is returned.

FR-001 and FR-002 are already true in this repository (`src/loans.ts`, `src/catalog.ts`, `GET /books`, `POST /loans`).
FR-003 is new: add holds (do not pretend checkout already queues people).
```

On Tech Plan, FR-001 / FR-002 should come back `already_satisfied` with notes citing those files. FR-003 should be `addressed` with an allowlist path such as `matejamilosevic/library:src/holds.ts` (or similar). Tasks should defer the satisfied FRs (`coverage_deferral` + `already_true_in_repo`) and only implement the hold files the plan named.

## Connect in CodeMerlin

1. Install the CodeMerlin GitHub App on **this personal repo** (or your personal account, with this repo selected).
2. In the CodeMerlin org, add `matejamilosevic/library` and select it on the work item.
3. Generate Spec → Tech Plan → Tests → Tasks.
