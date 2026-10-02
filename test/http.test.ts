import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { todayIsoDate } from '../src/holds.js';
import { handleRequest } from '../src/http.js';
import { checkout, physicalAvailableCopies, resetLoansForTests } from '../src/loans.js';
import {
  resetAccountsForTests,
  resetRateLimitsForTests,
  resetSessionsForTests,
  revokeSession,
} from '../src/members.js';
import { authHeaders } from './session.js';
import type { Hold, Loan, Reservation } from '../src/types.js';

type BookView = { id: string; copies: number; availableCopies: number };

function listedBook(body: unknown, bookId: string): BookView | undefined {
  const books = (body as { books: BookView[] }).books;
  return books.find((book) => book.id === bookId);
}

function detailBook(body: unknown): BookView {
  return (body as { book: BookView }).book;
}

describe('http', () => {
  beforeEach(() => {
    resetLoansForTests();
  });

  it('lists books', () => {
    const result = handleRequest('GET', '/books');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ books: expect.any(Array) });
  });

  it('checks out and returns through HTTP', () => {
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    expect(created.status).toBe(201);
    const loanId = (created.body as { loan: { id: string } }).loan.id;
    const returned = handleRequest('POST', `/loans/${loanId}/return`, undefined, authHeaders('m-1'));
    expect(returned.status).toBe(200);
  });

  it('checks out for the signed-in member when the body includes her email', () => {
    const created = handleRequest(
      'POST',
      '/loans',
      {
        bookId: 'b-3',
        email: 'ada@library.test',
      },
      authHeaders('m-1'),
    );
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ loan: { bookId: 'b-3', memberId: 'm-1' } });
  });

  it('reports on-shelf copies when every copy is present', () => {
    const list = handleRequest('GET', '/books');
    const detail = handleRequest('GET', '/books/b-1');

    expect(list.status).toBe(200);
    expect(listedBook(list.body, 'b-1')).toMatchObject({ copies: 2, availableCopies: 2 });
    expect(detail.status).toBe(200);
    expect(detailBook(detail.body)).toMatchObject({ id: 'b-1', copies: 2, availableCopies: 2 });
  });

  it('reports zero available copies when every owned copy is checked out', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    expect(loan.status).toBe(201);

    const list = handleRequest('GET', '/books');
    const detail = handleRequest('GET', '/books/b-2');

    expect(list.status).toBe(200);
    expect(listedBook(list.body, 'b-2')).toMatchObject({ copies: 1, availableCopies: 0 });
    expect(detail.status).toBe(200);
    expect(detailBook(detail.body)).toMatchObject({ id: 'b-2', copies: 1, availableCopies: 0 });
  });
});

function drainCopies(bookId: string, memberId = 'm-2') {
  while (physicalAvailableCopies(bookId) > 0) {
    checkout({ bookId, memberId });
  }
}

function deskPage() {
  const result = handleRequest('GET', '/');
  expect(result.status).toBe(200);
  expect(result.headers).toEqual({ 'content-type': 'text/html; charset=utf-8' });
  return result.body as string;
}

function loanFrom(body: unknown): Loan {
  return (body as { loan: Loan }).loan;
}

function holdFrom(body: unknown): Hold {
  return (body as { hold: Hold }).hold;
}

function reservationFrom(body: unknown): Reservation {
  return (body as { reservation: Reservation }).reservation;
}

describe('library desk', () => {
  beforeEach(() => {
    resetLoansForTests();
  });

  it('serves sign-in and sign-up forms with live copy counts', () => {
    const html = deskPage();

    expect(html).toContain('id="signin-form"');
    expect(html).toContain('id="signin-username"');
    expect(html).toContain('id="signin-password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('id="signup-form"');
    expect(html).toContain('id="signup-username"');
    expect(html).toContain('id="signup-password"');
    expect(html).not.toContain('<select id="member">');
    expect(html).not.toContain('value="m-1"');
    expect(html).not.toContain('value="m-2"');
    expect(html).not.toContain('value="m-3"');
    expect(html).not.toContain('Ada Lovelace');
    expect(html).not.toContain('Alan Turing');
    expect(html).not.toContain('Grace Hopper');
    expect(html).not.toContain('localStorage');
    expect(html).toContain('The Odyssey');
    expect(html).toContain('data-book-id="b-1"');
    expect(html).toContain('data-available="2"');
    expect(html).toContain('2 copies available');
    expect(html).toContain('Pride and Prejudice');
    expect(html).toContain('data-book-id="b-2"');
    expect(html).toContain('1 copy available');
    expect(html).toContain('A Short History of Nearly Everything');
    expect(html).toContain('data-book-id="b-3"');
    expect(html).toContain('data-available="3"');
    expect(html).toContain('Frankenstein');
    expect(html).toContain('data-book-id="b-4"');
    expect(html).toContain('No current loans.');
    expect(html).toContain('No active waitlist items.');
    expect(html).toContain('You can have at most 3 active holds.');
    expect(html).toContain('You already have a hold on this title.');
    expect(html).toContain('You already have a reservation on this title.');
    expect(html).toContain('hold.expiresAt');
    expect(html).not.toContain('reservation.expiresAt');
  });

  it('loads the signed-in member loans and holds', () => {
    handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-2' }, authHeaders('m-2'));
    drainCopies('b-4', 'm-3');
    handleRequest('POST', '/holds', { bookId: 'b-4', memberId: 'm-2' }, authHeaders('m-2'));

    const loans = handleRequest('GET', '/members/m-2/loans', undefined, authHeaders('m-2'));
    const holds = handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2'));
    const reservations = handleRequest('GET', '/members/m-2/reservations', undefined, authHeaders('m-2'));

    expect(loans.status).toBe(200);
    expect(loans.body).toMatchObject({ loans: [expect.objectContaining({ bookId: 'b-1', memberId: 'm-2' })] });
    expect(holds.status).toBe(200);
    expect(holds.body).toMatchObject({ holds: [expect.objectContaining({ bookId: 'b-4', status: 'waiting' })] });
    expect(reservations.status).toBe(200);
    expect(reservations.body).toEqual({ reservations: [] });
    expect(deskPage()).toContain("fetch('/members/' + memberId + '/loans', { headers: activityHeaders })");
    expect(deskPage()).toContain("Authorization: 'Bearer ' + authToken");
  });

  it('returns empty loans, holds, and reservations for a member with none', () => {
    expect(handleRequest('GET', '/members/m-3/loans', undefined, authHeaders('m-3')).body).toEqual({ loans: [] });
    expect(handleRequest('GET', '/members/m-3/holds', undefined, authHeaders('m-3')).body).toEqual({ holds: [] });
    expect(handleRequest('GET', '/members/m-3/reservations', undefined, authHeaders('m-3')).body).toEqual({ reservations: [] });
  });

  it('checks out a copy for 21 days and decrements availability', () => {
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    const loan = loanFrom(created.body);

    expect(created.status).toBe(201);
    expect(loan.dueAt).toBe(todayIsoDate(21));
    expect(handleRequest('GET', '/books/b-1').body).toMatchObject({ availableCopies: 1 });
    expect(handleRequest('GET', '/members/m-1/loans', undefined, authHeaders('m-1')).body).toMatchObject({
      loans: [expect.objectContaining({ id: loan.id, bookId: 'b-1', dueAt: todayIsoDate(21), returnedAt: null })],
    });
    expect(deskPage()).toContain('data-available="1"');
  });

  it('returns a loan and restores availability', () => {
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    const returned = handleRequest('POST', `/loans/${loanFrom(created.body).id}/return`, undefined, authHeaders('m-1'));

    expect(returned.status).toBe(200);
    expect(loanFrom(returned.body).returnedAt).toBe(todayIsoDate());
    expect(handleRequest('GET', '/books/b-1').body).toMatchObject({ availableCopies: 2 });
  });

  it('places a waiting hold when no copies remain', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));

    const created = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    expect(created.status).toBe(201);
    expect(holdFrom(created.body).status).toBe('waiting');
    expect(handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2')).body).toMatchObject({
      holds: [expect.objectContaining({ bookId: 'b-2', status: 'waiting' })],
    });
  });

  it('notifies a waiting hold with a 7-day pickup deadline when the copy is returned', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    const returned = handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`, undefined, authHeaders('m-1'));

    expect(returned.status).toBe(200);
    expect(handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2')).body).toMatchObject({
      holds: [expect.objectContaining({ bookId: 'b-2', status: 'notified', expiresAt: todayIsoDate(7) })],
    });
  });

  it('picks up a notified hold as a 21-day loan', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`, undefined, authHeaders('m-1'));

    const pickup = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    expect(pickup.status).toBe(201);
    expect(loanFrom(pickup.body)).toMatchObject({
      bookId: 'b-2',
      memberId: 'm-2',
      dueAt: todayIsoDate(21),
      returnedAt: null,
    });
    expect(handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2')).body).toMatchObject({
      holds: [expect.objectContaining({ status: 'fulfilled' })],
    });
  });

  it('rejects a fourth active hold', () => {
    drainCopies('b-1');
    drainCopies('b-2');
    drainCopies('b-3');
    drainCopies('b-4');
    handleRequest('POST', '/holds', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    handleRequest('POST', '/holds', { bookId: 'b-3', memberId: 'm-1' }, authHeaders('m-1'));

    const rejected = handleRequest('POST', '/holds', { bookId: 'b-4', memberId: 'm-1' }, authHeaders('m-1'));

    expect(rejected.status).toBe(409);
    expect(rejected.body).toEqual({ error: 'hold_limit_exceeded' });
  });

  it('rejects a duplicate hold', () => {
    drainCopies('b-2');
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    const rejected = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    expect(rejected.status).toBe(409);
    expect(rejected.body).toEqual({ error: 'duplicate_hold' });
  });

  it('lists a member reservations and rejects an unknown member', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));

    const listed = handleRequest('GET', '/members/m-1/reservations', undefined, authHeaders('m-1'));
    const missing = handleRequest('GET', '/members/m-999/reservations', undefined, authHeaders('m-999'));

    expect(listed.status).toBe(200);
    expect(listed.headers).toBeUndefined();
    expect(listed.body).toMatchObject({
      reservations: [expect.objectContaining({ bookId: 'b-2', memberId: 'm-1', status: 'pending' })],
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'member_not_found' });
  });

  it('picks up a held reservation without inventing a pickup deadline', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    const reserved = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    expect(reservationFrom(reserved.body).status).toBe('pending');
    handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`, undefined, authHeaders('m-2'));

    const held = handleRequest('GET', '/members/m-1/reservations', undefined, authHeaders('m-1'));
    const reservation = (held.body as { reservations: Reservation[] }).reservations[0];
    expect(reservation).toMatchObject({ bookId: 'b-2', status: 'held' });
    expect(reservation).not.toHaveProperty('expiresAt');

    const pickup = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));

    expect(pickup.status).toBe(201);
    expect(loanFrom(pickup.body).dueAt).toBe(todayIsoDate(21));
    expect(handleRequest('GET', '/members/m-1/reservations', undefined, authHeaders('m-1')).body).toMatchObject({
      reservations: [expect.objectContaining({ status: 'fulfilled' })],
    });
  });

  it('walks checkout, hold, return, and pickup from the desk routes', () => {
    expect(deskPage()).toContain('Library desk');

    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    expect(loan.status).toBe(201);
    expect(loanFrom(loan.body).dueAt).toBe(todayIsoDate(21));
    expect(handleRequest('GET', '/books/b-2').body).toMatchObject({ availableCopies: 0 });

    const hold = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    expect(holdFrom(hold.body).status).toBe('waiting');

    handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`, undefined, authHeaders('m-1'));
    expect(handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2')).body).toMatchObject({
      holds: [expect.objectContaining({ status: 'notified', expiresAt: todayIsoDate(7) })],
    });

    const pickup = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    expect(loanFrom(pickup.body)).toMatchObject({ memberId: 'm-2', bookId: 'b-2', dueAt: todayIsoDate(21) });
    expect(handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2')).body).toMatchObject({
      holds: [expect.objectContaining({ status: 'fulfilled' })],
    });
    expect(handleRequest('GET', '/members/m-2/loans', undefined, authHeaders('m-2')).body).toMatchObject({
      loans: [expect.objectContaining({ bookId: 'b-2', returnedAt: null })],
    });
  });
});

type FetchCall = {
  method: string;
  pathname: string;
  headers: Record<string, string>;
  body?: unknown;
  status: number;
};

type DeskWindow = {
  window: Window;
  calls: FetchCall[];
};

function headerRecord(init: HeadersInit | undefined): Record<string, string> {
  if (!init) return {};
  if (Array.isArray(init)) return Object.fromEntries(init);
  if (typeof (init as Headers).forEach === 'function' && typeof (init as Headers).get === 'function') {
    const headers: Record<string, string> = {};
    (init as Headers).forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(init as Record<string, unknown>)) {
    if (typeof value === 'string') headers[key] = value;
  }
  return headers;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function openDesk(signIn?: (body: unknown) => { status: number; body: unknown }): DeskWindow {
  const calls: FetchCall[] = [];
  const window = new Window({ url: 'http://localhost/' });
  windows.push(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = new URL(requestUrl(input), 'http://localhost').pathname;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = headerRecord(init?.headers);
    let body: unknown;
    if (typeof init?.body === 'string' && init.body.length > 0) body = JSON.parse(init.body) as unknown;
    const outcome = method === 'POST' && pathname === '/signin' && signIn
      ? signIn(body)
      : handleRequest(method, pathname, body, headers);
    calls.push({ method, pathname, headers, body, status: outcome.status });
    const payload = typeof outcome.body === 'string' ? outcome.body : JSON.stringify(outcome.body);
    return new window.Response(payload, {
      status: outcome.status,
      headers: { 'content-type': outcome.headers?.['content-type'] ?? 'application/json' },
    });
  };

  const html = deskPage();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('desk script missing');
  window.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  window.eval(script);
  return { window, calls };
}

async function settle(window: Window): Promise<void> {
  await window.happyDOM.waitUntilComplete();
  await window.happyDOM.whenAsyncComplete();
}

function field(window: Window, selector: string): HTMLInputElement {
  const input = window.document.querySelector(selector);
  if (!input) throw new Error(`missing ${selector}`);
  return input as HTMLInputElement;
}

function control(window: Window, selector: string): HTMLElement {
  const element = window.document.querySelector(selector);
  if (!element) throw new Error(`missing ${selector}`);
  return element as HTMLElement;
}

async function submitForm(window: Window, selector: string): Promise<void> {
  const form = control(window, selector) as HTMLFormElement;
  form.requestSubmit();
  await settle(window);
}

function sessionFor(memberId: string, username: string): { status: number; body: unknown } {
  const authorization = authHeaders(memberId).authorization;
  return {
    status: 200,
    body: {
      token: authorization.slice('Bearer '.length),
      account: { id: memberId, username, createdAt: '2026-01-01T00:00:00.000Z' },
    },
  };
}

const windows: Window[] = [];
let accountsDirectory = '';

describe('desk authentication', () => {
  beforeEach(() => {
    accountsDirectory = mkdtempSync(join(tmpdir(), 'library-desk-auth-'));
    resetAccountsForTests(join(accountsDirectory, 'accounts.json'));
    resetSessionsForTests();
    resetRateLimitsForTests();
    resetLoansForTests();
  });

  afterEach(() => {
    for (const window of windows.splice(0)) window.happyDOM.abort();
    rmSync(accountsDirectory, { recursive: true, force: true });
  });

  it('keeps a failed sign-in on the form and explains the failure', async () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const rejected = handleRequest('POST', '/signin', { username: 'reader1', password: 'wrongpassword' });
    expect(rejected.status).toBe(401);
    expect(rejected.body).toEqual({ error: 'invalid_credentials' });

    const { window } = openDesk();
    field(window, '#signin-username').value = 'reader1';
    field(window, '#signin-password').value = 'wrongpassword';
    await submitForm(window, '#signin-form');

    const error = control(window, '#error');
    expect(control(window, '#signin-form').hidden).toBe(false);
    expect(control(window, '#patron-view').hidden).toBe(true);
    expect(control(window, '#signout-btn').hidden).toBe(true);
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('Sign-in failed');
  });

  it('signs in an existing patron and shows that username', async () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const signedIn = handleRequest('POST', '/signin', { username: 'reader1', password: 'secretpass123' });
    const body = signedIn.body as { token: string; account: { username: string } };
    expect(signedIn.status).toBe(200);
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.account.username).toBe('reader1');

    const { window } = openDesk();
    field(window, '#signin-username').value = 'reader1';
    field(window, '#signin-password').value = 'secretpass123';
    await submitForm(window, '#signin-form');

    const signout = control(window, '#signout-btn') as HTMLButtonElement;
    expect(control(window, '#signin-form').hidden).toBe(true);
    expect(control(window, '#signup-form').hidden).toBe(true);
    expect(control(window, '#patron-view').hidden).toBe(false);
    expect(signout.hidden).toBe(false);
    expect(signout.disabled).toBe(false);
    expect(control(window, '#active-member').textContent).toBe('reader1');
  });

  it('shows the signed-in patron loans, holds, and reservations', async () => {
    handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-2' }, authHeaders('m-2'));
    drainCopies('b-4', 'm-3');
    handleRequest('POST', '/holds', { bookId: 'b-4', memberId: 'm-2' }, authHeaders('m-2'));

    const { window, calls } = openDesk(() => sessionFor('m-2', 'alan'));
    field(window, '#signin-username').value = 'alan';
    field(window, '#signin-password').value = 'secretpass123';
    await submitForm(window, '#signin-form');

    const bearer = /^Bearer [0-9a-f]{64}$/;
    for (const pathname of ['/members/m-2/loans', '/members/m-2/holds', '/members/m-2/reservations']) {
      const call = calls.find((entry) => entry.method === 'GET' && entry.pathname === pathname);
      expect(call?.headers.Authorization).toMatch(bearer);
    }
    expect(control(window, '#loans').innerHTML).toContain('The Odyssey');
    expect(control(window, '#loans').innerHTML).toContain('Due ');
    expect(control(window, '#queue').innerHTML).toContain('Frankenstein');
    expect(control(window, '#queue').innerHTML).toContain('waiting');
    expect(control(window, '#loans-empty').hidden).toBe(true);
    expect(control(window, '#queue-empty').hidden).toBe(true);
  });

  it('shows empty notices when the patron has no loans, holds, or reservations', async () => {
    const { window } = openDesk(() => sessionFor('m-3', 'grace'));
    field(window, '#signin-username').value = 'grace';
    field(window, '#signin-password').value = 'secretpass123';
    await submitForm(window, '#signin-form');

    expect(control(window, '#loans').querySelector('li')).toBeNull();
    expect(control(window, '#queue').querySelector('li')).toBeNull();
    expect(control(window, '#loans-empty').hidden).toBe(false);
    expect(control(window, '#loans-empty').textContent).toBe('No current loans.');
    expect(control(window, '#queue-empty').hidden).toBe(false);
    expect(control(window, '#queue-empty').textContent).toBe('No active waitlist items.');
  });

  it('signs out, revokes the session, and clears patron activity', async () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const { window, calls } = openDesk();
    field(window, '#signin-username').value = 'reader1';
    field(window, '#signin-password').value = 'secretpass123';
    await submitForm(window, '#signin-form');
    control(window, '#loans').innerHTML = '<li>Private loan</li>';
    control(window, '#queue').innerHTML = '<li>Private hold</li>';

    control(window, '#signout-btn').click();
    await settle(window);

    const signout = calls.find((entry) => entry.method === 'POST' && entry.pathname === '/signout');
    expect(signout?.status).toBe(200);
    expect(signout?.headers.Authorization).toMatch(/^Bearer [0-9a-f]{64}$/);
    expect(control(window, '#loans').innerHTML).toBe('');
    expect(control(window, '#queue').innerHTML).toBe('');
    expect(control(window, '#patron-view').hidden).toBe(true);
    expect(control(window, '#signin-form').hidden).toBe(false);
    expect(control(window, '#signout-btn').hidden).toBe(true);
  });

  it('stays on sign-up when the username is already taken', async () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const conflict = handleRequest('POST', '/signup', { username: 'reader1', password: 'newpassword999' });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ error: 'username_already_taken' });

    const { window, calls } = openDesk();
    field(window, '#signup-username').value = 'reader1';
    field(window, '#signup-password').value = 'newpassword999';
    await submitForm(window, '#signup-form');

    const error = control(window, '#error');
    expect(calls.some((entry) => entry.pathname === '/signin')).toBe(false);
    expect(control(window, '#signup-form').hidden).toBe(false);
    expect(control(window, '#patron-view').hidden).toBe(true);
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('already taken');
  });

  it('returns to sign-in when the session expires', async () => {
    const session = sessionFor('m-1', 'ada');
    const token = (session.body as { token: string }).token;
    const { window } = openDesk(() => session);
    field(window, '#signin-username').value = 'ada';
    field(window, '#signin-password').value = 'secretpass123';
    await submitForm(window, '#signin-form');
    expect(control(window, '#patron-view').hidden).toBe(false);

    revokeSession(token);
    control(window, 'button[data-action="checkout"][data-book-id="b-1"]').click();
    await settle(window);

    const error = control(window, '#error');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('session has expired');
    expect(control(window, '#signin-form').hidden).toBe(false);
    expect(control(window, '#patron-view').hidden).toBe(true);
    expect(control(window, '#loans').innerHTML).toBe('');
    expect(control(window, '#queue').innerHTML).toBe('');
  });

  it('refuses another patron activity and only loads the signed-in patron', async () => {
    handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-2' }, authHeaders('m-2'));
    handleRequest('POST', '/loans', { bookId: 'b-3', memberId: 'm-1' }, authHeaders('m-1'));
    const ada = authHeaders('m-1');
    expect(handleRequest('GET', '/members/m-2/loans', undefined, ada).status).toBe(403);
    expect(handleRequest('GET', '/members/m-2/holds', undefined, ada).body).toEqual({ error: 'forbidden' });
    expect(handleRequest('GET', '/members/m-2/reservations', undefined, ada).body).toEqual({ error: 'forbidden' });

    const { window, calls } = openDesk(() => sessionFor('m-1', 'ada'));
    field(window, '#signin-username').value = 'ada';
    field(window, '#signin-password').value = 'secretpass123';
    await submitForm(window, '#signin-form');

    expect(calls.some((entry) => entry.pathname.startsWith('/members/m-2/'))).toBe(false);
    expect(control(window, '#loans').innerHTML).toContain('A Short History of Nearly Everything');
    expect(control(window, '#loans').innerHTML).not.toContain('The Odyssey');
  });

  it('registers, signs in, checks out a book, and signs out', async () => {
    const { window, calls } = openDesk();
    field(window, '#signup-username').value = 'lifecycle_patron';
    field(window, '#signup-password').value = 'lifecycle_pass_123';
    await submitForm(window, '#signup-form');

    expect(calls.find((entry) => entry.method === 'POST' && entry.pathname === '/signup')?.status).toBe(201);
    expect(control(window, '#active-member').textContent).toBe('lifecycle_patron');
    expect(control(window, '#patron-view').hidden).toBe(false);

    control(window, 'button[data-action="checkout"][data-book-id="b-1"]').click();
    await settle(window);

    const checkoutCall = calls.find((entry) => entry.method === 'POST' && entry.pathname === '/loans');
    expect(checkoutCall?.status).toBe(201);
    expect(control(window, '#loans').innerHTML).toContain('The Odyssey');
    expect(control(window, '#loans').innerHTML).toContain('Due ');

    const activity = calls.find((entry) => entry.method === 'GET' && entry.pathname.endsWith('/loans'));
    control(window, '#signout-btn').click();
    await settle(window);

    expect(calls.find((entry) => entry.method === 'POST' && entry.pathname === '/signout')?.status).toBe(200);
    expect(control(window, '#signin-form').hidden).toBe(false);
    expect(control(window, '#patron-view').hidden).toBe(true);
    expect(control(window, '#loans').innerHTML).toBe('');
    expect(handleRequest('GET', activity?.pathname ?? '', undefined, {
      authorization: activity?.headers.Authorization,
    }).status).toBe(401);
  });
});
