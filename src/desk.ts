import { listBooks } from './catalog.js';
import { availableCopies } from './loans.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function availabilityLabel(available: number): string {
  return available === 1 ? '1 copy available' : `${available} copies available`;
}

const clientScript = `
var signinForm = document.querySelector('#signin-form');
var signupForm = document.querySelector('#signup-form');
var signinUsername = document.querySelector('#signin-username');
var signinPassword = document.querySelector('#signin-password');
var signupUsername = document.querySelector('#signup-username');
var signupPassword = document.querySelector('#signup-password');
var patronView = document.querySelector('#patron-view');
var activeMemberEl = document.querySelector('#active-member');
var signoutBtn = document.querySelector('#signout-btn');
var catalog = document.querySelector('#catalog');
var loansEl = document.querySelector('#loans');
var loansEmpty = document.querySelector('#loans-empty');
var queueEl = document.querySelector('#queue');
var queueEmpty = document.querySelector('#queue-empty');
var errorEl = document.querySelector('#error');
var sessionToken = null;
var activeMember = null;
var refreshToken = 0;
var busy = false;

var messages = {
  hold_limit_exceeded: 'You can have at most 3 active holds.',
  duplicate_hold: 'You already have a hold on this title.',
  duplicate_reservation: 'You already have a reservation on this title.',
  copies_available: 'A copy is still available. Check it out instead.',
  no_copies_available: 'That copy is no longer available.',
  queue_priority_conflict: 'That copy is reserved for another member.',
  copy_held_for_other_member: 'That copy is reserved for another member.',
  unauthorized: 'Your session has expired. Sign in again.'
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function availabilityLabel(available) {
  return available === 1 ? '1 copy available' : available + ' copies available';
}

function showError(code) {
  errorEl.hidden = false;
  errorEl.textContent = messages[code] || code;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

function bookTitle(books, bookId) {
  var match = books.find(function (book) { return book.id === bookId; });
  return match ? match.title : bookId;
}

function signInFailureMessage(status, code) {
  if (status === 429 || code === 'rate_limited') {
    return 'Sign-in failed because too many attempts were made. Try again later.';
  }
  return 'Sign-in failed. Check your username and password and try again.';
}

function signUpFailureMessage(status, code) {
  if (status === 409 || code === 'username_already_taken') {
    return 'That username is already taken. Choose a different username.';
  }
  return 'Sign-up failed. Check the form and try again.';
}

function showSignedOut() {
  refreshToken += 1;
  sessionToken = null;
  activeMember = null;
  loansEl.innerHTML = '';
  queueEl.innerHTML = '';
  loansEmpty.hidden = true;
  queueEmpty.hidden = true;
  activeMemberEl.textContent = '';
  signinForm.hidden = false;
  signupForm.hidden = false;
  patronView.hidden = true;
  signoutBtn.hidden = true;
}

function showSignedIn(account) {
  activeMember = account;
  activeMemberEl.textContent = account.username || account.name || account.id;
  signinForm.hidden = true;
  signupForm.hidden = true;
  patronView.hidden = false;
  signoutBtn.hidden = false;
}

function jsonHeaders() {
  var headers = { 'content-type': 'application/json' };
  if (sessionToken) headers.Authorization = 'Bearer ' + sessionToken;
  return headers;
}

async function readJson(response) {
  return response.json().catch(function () { return {}; });
}

async function postJson(url, payload) {
  var response = await fetch(url, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload)
  });
  var body = await readJson(response);
  if (!response.ok) {
    var error = new Error(body.error || 'request_failed');
    error.code = body.error || 'request_failed';
    error.status = response.status;
    throw error;
  }
  return body;
}

function renderCatalog(books) {
  catalog.innerHTML = books.map(function (book) {
    var available = book.availableCopies;
    var actions = available > 0
      ? '<button type="button" data-action="checkout" data-book-id="' + book.id + '">Check out</button>'
      : '<button type="button" data-action="hold" data-book-id="' + book.id + '">Hold</button><button type="button" data-action="reserve" data-book-id="' + book.id + '">Reserve</button>';
    return '<tr data-book-id="' + book.id + '"><td>' + escapeHtml(book.title) + '</td><td class="available" data-available="' + available + '">' + availabilityLabel(available) + '</td><td class="actions">' + actions + '</td></tr>';
  }).join('');
}

function renderLoans(loans, books) {
  var active = loans.filter(function (loan) { return loan.returnedAt === null; });
  loansEmpty.hidden = active.length > 0;
  loansEl.innerHTML = active.map(function (loan) {
    return '<li data-loan-id="' + loan.id + '"><span class="loan-title">' + escapeHtml(bookTitle(books, loan.bookId)) + '</span><span class="due">Due ' + loan.dueAt + '</span><button type="button" data-action="return" data-loan-id="' + loan.id + '">Return</button></li>';
  }).join('');
}

function renderQueue(holds, reservations, books) {
  var items = [];
  holds.forEach(function (hold) {
    if (hold.status !== 'waiting' && hold.status !== 'notified' && hold.status !== 'expired') return;
    var detail = hold.status;
    if (hold.status === 'notified' && hold.expiresAt) {
      detail = 'notified, ready for pickup. Pickup by ' + hold.expiresAt;
    }
    var pickup = hold.status === 'notified'
      ? '<button type="button" data-action="pickup" data-book-id="' + hold.bookId + '">Pick up</button>'
      : '';
    items.push('<li data-kind="hold" data-status="' + hold.status + '" data-book-id="' + hold.bookId + '"><span class="queue-title">' + escapeHtml(bookTitle(books, hold.bookId)) + '</span><span class="status">' + detail + '</span>' + pickup + '</li>');
  });
  reservations.forEach(function (reservation) {
    if (reservation.status !== 'pending' && reservation.status !== 'held') return;
    var detail = reservation.status === 'held' ? 'held, ready for pickup' : reservation.status;
    var pickup = reservation.status === 'held'
      ? '<button type="button" data-action="pickup" data-book-id="' + reservation.bookId + '">Pick up</button>'
      : '';
    items.push('<li data-kind="reservation" data-status="' + reservation.status + '" data-book-id="' + reservation.bookId + '"><span class="queue-title">' + escapeHtml(bookTitle(books, reservation.bookId)) + '</span><span class="status">' + detail + '</span>' + pickup + '</li>');
  });
  queueEmpty.hidden = items.length > 0;
  queueEl.innerHTML = items.join('');
}

async function refresh() {
  if (!sessionToken || !activeMember) return;
  var token = ++refreshToken;
  var memberId = activeMember.id;
  var authToken = sessionToken;
  loansEl.innerHTML = '';
  queueEl.innerHTML = '';
  loansEmpty.hidden = true;
  queueEmpty.hidden = true;
  try {
    var activityHeaders = { Authorization: 'Bearer ' + authToken };
    var responses = await Promise.all([
      fetch('/books'),
      fetch('/members/' + memberId + '/loans', { headers: activityHeaders }),
      fetch('/members/' + memberId + '/holds', { headers: activityHeaders }),
      fetch('/members/' + memberId + '/reservations', { headers: activityHeaders })
    ]);
    if (token !== refreshToken) return;
    var unauthorized = responses.slice(1).some(function (response) { return response.status === 401; });
    if (unauthorized) {
      showSignedOut();
      showError('Your session has expired. Sign in again.');
      return;
    }
    var failed = responses.slice(1).find(function (response) { return !response.ok; });
    if (failed) {
      var failure = await readJson(failed);
      if (token !== refreshToken) return;
      showError(failure.error || 'request_failed');
      return;
    }
    var books = await readJson(responses[0]);
    var loans = await readJson(responses[1]);
    var holds = await readJson(responses[2]);
    var reservations = await readJson(responses[3]);
    if (token !== refreshToken) return;
    renderCatalog(books.books || []);
    renderLoans(loans.loans || [], books.books || []);
    renderQueue(holds.holds || [], reservations.reservations || [], books.books || []);
  } catch (error) {
    if (token !== refreshToken) return;
    showError('Sign-in failed. Check your username and password and try again.');
  }
}

async function enterSession(token, account) {
  sessionToken = token;
  showSignedIn(account);
  clearError();
  await refresh();
}

signinForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  if (busy) return;
  busy = true;
  clearError();
  try {
    var response = await fetch('/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: signinUsername.value,
        password: signinPassword.value
      })
    });
    var body = await readJson(response);
    if (!response.ok) {
      showError(signInFailureMessage(response.status, body.error));
      showSignedOut();
      return;
    }
    await enterSession(body.token, body.account);
  } catch (error) {
    showError('Sign-in failed. Check your username and password and try again.');
    showSignedOut();
  } finally {
    busy = false;
  }
});

signupForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  if (busy) return;
  busy = true;
  clearError();
  try {
    var username = signupUsername.value;
    var password = signupPassword.value;
    var response = await fetch('/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    var body = await readJson(response);
    if (!response.ok) {
      showError(signUpFailureMessage(response.status, body.error));
      showSignedOut();
      return;
    }
    await enterSessionFromCredentials(username, password);
  } catch (error) {
    showError('Sign-up failed. Check the form and try again.');
    showSignedOut();
  } finally {
    busy = false;
  }
});

async function enterSessionFromCredentials(username, password) {
  var response = await fetch('/signin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: username, password: password })
  });
  var body = await readJson(response);
  if (!response.ok) {
    showError(signInFailureMessage(response.status, body.error));
    showSignedOut();
    return;
  }
  await enterSession(body.token, body.account);
}

signoutBtn.addEventListener('click', async function () {
  if (busy) return;
  busy = true;
  clearError();
  var token = sessionToken;
  try {
    if (token) {
      await fetch('/signout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
    }
  } finally {
    showSignedOut();
    busy = false;
  }
});

document.body.addEventListener('click', async function (event) {
  var button = event.target.closest('button[data-action]');
  if (!button || busy || !activeMember || !sessionToken) return;
  var action = button.dataset.action;
  var memberId = activeMember.id;
  busy = true;
  clearError();
  try {
    if (action === 'checkout' || action === 'pickup') {
      await postJson('/loans', { bookId: button.dataset.bookId, memberId: memberId });
    } else if (action === 'return') {
      await postJson('/loans/' + button.dataset.loanId + '/return', {});
    } else if (action === 'hold') {
      await postJson('/holds', { bookId: button.dataset.bookId, memberId: memberId });
    } else if (action === 'reserve') {
      await postJson('/reservations', { bookId: button.dataset.bookId, memberId: memberId });
    }
    await refresh();
  } catch (error) {
    if (error.status === 401 || error.code === 'unauthorized') {
      showSignedOut();
      showError('Your session has expired. Sign in again.');
      return;
    }
    showError(error.code || 'request_failed');
    await refresh();
  } finally {
    busy = false;
  }
});
`;

export function renderDeskHtml(): string {
  const catalogRows = listBooks()
    .map((book) => {
      const available = availableCopies(book.id);
      return `<tr data-book-id="${escapeHtml(book.id)}"><td>${escapeHtml(book.title)}</td><td class="available" data-available="${available}">${availabilityLabel(available)}</td><td class="actions"></td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Library desk</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1d1914;
      --muted: #5e564c;
      --paper: #f6f1e8;
      --card: #fffaf3;
      --line: #e2d8c8;
      --stamp: #8d3428;
      --stamp-ink: #fff8f4;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--paper);
      color: var(--ink);
      font: 16px/1.45 "Iowan Old Style", Palatino, "Palatino Linotype", serif;
    }
    main {
      width: min(920px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    header { margin-bottom: 28px; }
    h1 {
      margin: 0 0 4px;
      font-size: 40px;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 22px;
    }
    p { margin: 0; }
    .lede { color: var(--muted); }
    label { display: block; margin-bottom: 6px; color: var(--muted); }
    input, button { font: inherit; color: inherit; }
    input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--line);
      background: var(--card);
      margin-bottom: 12px;
    }
    .auth-forms {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    form, section, .patron-bar {
      background: var(--card);
      border: 1px solid var(--line);
    }
    form, section { padding: 18px 18px 8px; }
    section { margin-bottom: 16px; }
    .patron-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px 8px; border-top: 1px solid var(--line); vertical-align: middle; }
    th { color: var(--muted); font-weight: 500; border-top: 0; }
    .actions, .due, .status { white-space: nowrap; }
    button {
      margin: 0 8px 8px 0;
      padding: 7px 12px;
      border: 0;
      background: var(--stamp);
      color: var(--stamp-ink);
      cursor: pointer;
    }
    button:hover { filter: brightness(1.08); }
    ul { list-style: none; padding: 0; margin: 0 0 12px; }
    li {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-top: 1px solid var(--line);
    }
    .loan-title, .queue-title { flex: 1; }
    .empty { color: var(--muted); margin: 0 0 12px; }
    #error {
      margin-bottom: 16px;
      padding: 12px 14px;
      background: #f8e4df;
      border: 1px solid #e3b2a8;
    }
    @media (max-width: 640px) {
      h1 { font-size: 32px; }
      .auth-forms, .patron-bar { display: block; }
      li { display: block; }
      .loan-title, .queue-title, .due, .status { display: block; margin: 0 0 6px; white-space: normal; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Library desk</h1>
      <p class="lede">Sign in to borrow, return, and wait for a copy.</p>
    </header>
    <p id="error" role="alert" hidden></p>
    <div class="auth-forms">
      <form id="signin-form">
        <h2>Sign in</h2>
        <label for="signin-username">Username</label>
        <input id="signin-username" name="username" type="text" autocomplete="username" required>
        <label for="signin-password">Password</label>
        <input id="signin-password" name="password" type="password" autocomplete="current-password" required>
        <button type="submit">Sign in</button>
      </form>
      <form id="signup-form">
        <h2>Create an account</h2>
        <label for="signup-username">Username</label>
        <input id="signup-username" name="username" type="text" autocomplete="username" required>
        <label for="signup-password">Password</label>
        <input id="signup-password" name="password" type="password" autocomplete="new-password" required>
        <button type="submit">Create account</button>
      </form>
    </div>
    <div id="patron-view" hidden>
      <div class="patron-bar">
        <p>Signed in as <span id="active-member"></span></p>
        <button type="button" id="signout-btn" hidden>Sign out</button>
      </div>
      <section>
        <h2>Catalog</h2>
        <table>
          <thead>
            <tr><th>Title</th><th>Available</th><th></th></tr>
          </thead>
          <tbody id="catalog">
            ${catalogRows}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Loans</h2>
        <p id="loans-empty" class="empty">No current loans.</p>
        <ul id="loans"></ul>
      </section>
      <section>
        <h2>Holds and reservations</h2>
        <p id="queue-empty" class="empty">No active waitlist items.</p>
        <ul id="queue"></ul>
      </section>
    </div>
  </main>
  <script>
${clientScript}
  </script>
</body>
</html>
`;
}
