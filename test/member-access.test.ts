import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIsoDate } from '../src/holds.js';
import { handleRequest } from '../src/http.js';
import { checkout, getLoan, physicalAvailableCopies, resetLoansForTests } from '../src/loans.js';
import { createSession, getAccountsFilePath, reloadAccountsFromDisk, resetAccountsForTests, resetSessionsForTests } from '../src/members.js';
import { getReservation } from '../src/reservations.js';
import type { Hold, Loan, Reservation } from '../src/types.js';

type Headers = { authorization: string };

function loanFrom(body: unknown): Loan {
  return (body as { loan: Loan }).loan;
}

function holdFrom(body: unknown): Hold {
  return (body as { hold: Hold }).hold;
}

function reservationFrom(body: unknown): Reservation {
  return (body as { reservation: Reservation }).reservation;
}

function signInPatron(username: string, password: string, memberId: string): Headers {
  const created = handleRequest('POST', '/signup', { username, password });
  expect(created.status).toBe(201);
  const stored = JSON.parse(readFileSync(getAccountsFilePath(), 'utf8')) as {
    accounts: Array<{ id: string; username: string }>;
  };
  const account = stored.accounts.find((item) => item.username === username);
  expect(account).toBeDefined();
  account!.id = memberId;
  writeFileSync(getAccountsFilePath(), `${JSON.stringify(stored)}\n`);
  reloadAccountsFromDisk();
  const signedIn = handleRequest('POST', '/signin', { username, password });
  expect(signedIn.status).toBe(200);
  const body = signedIn.body as { token: string; account: { id: string } };
  expect(body.account.id).toBe(memberId);
  expect(body.token).toMatch(/^[0-9a-f]{64}$/);
  return { authorization: `Bearer ${body.token}` };
}

describe('signed-in member access', () => {
  let accountsDir: string | undefined;

  beforeEach(() => {
    resetLoansForTests();
    resetSessionsForTests();
  });

  afterEach(() => {
    if (!accountsDir) return;
    rmSync(accountsDir, { recursive: true, force: true });
    accountsDir = undefined;
  });

  it('binds checkout, hold, and reservation to the signed-in patron', () => {
    const ada = signInAs('m-1');
    const loan = handleRequest('POST', '/loans', { bookId: 'b-1' }, ada);
    expect(loan.status).toBe(201);
    expect(loanFrom(loan.body)).toMatchObject({ bookId: 'b-1', memberId: 'm-1' });

    checkout({ bookId: 'b-2', memberId: 'm-2' });
    const hold = handleRequest('POST', '/holds', { bookId: 'b-2' }, ada);
    expect(hold.status).toBe(201);
    expect(holdFrom(hold.body).memberId).toBe('m-1');

    const reservation = handleRequest('POST', '/reservations', { bookId: 'b-2' }, ada);
    expect(reservation.status).toBe(201);
    expect(reservationFrom(reservation.body).memberId).toBe('m-1');
  });

  it('rejects unauthenticated desk mutations', () => {
    expect(handleRequest('POST', '/loans', { bookId: 'b-1' })).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(handleRequest('POST', '/holds', { bookId: 'b-2' })).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(handleRequest('POST', '/reservations', { bookId: 'b-2' })).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
  });

  it('refuses a creation payload that names another member', () => {
    const ada = signInAs('m-1');
    expect(handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-2' }, ada)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, ada)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' }, ada)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(getLoan('loan-1')).toBeUndefined();
  });

  it('returns the signed-in member activity', () => {
    const ada = signInAs('m-1');
    const created = handleRequest('POST', '/loans', { bookId: 'b-1' }, ada);
    const loan = loanFrom(created.body);

    const loans = handleRequest('GET', '/members/m-1/loans', undefined, ada);
    const holds = handleRequest('GET', '/members/m-1/holds', undefined, ada);
    const reservations = handleRequest('GET', '/members/m-1/reservations', undefined, ada);

    expect(loans.status).toBe(200);
    expect(loans.body).toMatchObject({ loans: [expect.objectContaining({ id: loan.id, bookId: 'b-1' })] });
    expect(holds.status).toBe(200);
    expect(holds.body).toEqual({ holds: [] });
    expect(reservations.status).toBe(200);
    expect(reservations.body).toEqual({ reservations: [] });
  });

  it('rejects unauthenticated activity queries', () => {
    for (const path of ['/members/m-1/loans', '/members/m-1/holds', '/members/m-1/reservations', '/members/m-1/notifications']) {
      expect(handleRequest('GET', path)).toEqual({ status: 401, body: { error: 'unauthorized' } });
    }
  });

  it('refuses a member reading another member activity', () => {
    const ada = signInAs('m-1');
    for (const path of ['/members/m-2/loans', '/members/m-2/holds', '/members/m-2/reservations', '/members/m-2/notifications']) {
      expect(handleRequest('GET', path, undefined, ada)).toEqual({ status: 403, body: { error: 'forbidden' } });
    }
  });

  it('returns empty collections when the signed-in member has no activity', () => {
    const grace = signInAs('m-3');
    expect(handleRequest('GET', '/members/m-3/loans', undefined, grace).body).toEqual({ loans: [] });
    expect(handleRequest('GET', '/members/m-3/holds', undefined, grace).body).toEqual({ holds: [] });
    expect(handleRequest('GET', '/members/m-3/reservations', undefined, grace).body).toEqual({ reservations: [] });
  });

  it('lets a member return their own loan and cancel their own reservation', () => {
    const ada = signInAs('m-1');
    const alan = signInAs('m-2');
    const created = handleRequest('POST', '/loans', { bookId: 'b-1' }, ada);
    const loan = loanFrom(created.body);

    const returned = handleRequest('POST', `/loans/${loan.id}/return`, undefined, ada);
    expect(returned.status).toBe(200);
    expect(loanFrom(returned.body).returnedAt).toBe(todayIsoDate());
    expect(physicalAvailableCopies('b-1')).toBe(2);

    handleRequest('POST', '/loans', { bookId: 'b-2' }, alan);
    const reserved = handleRequest('POST', '/reservations', { bookId: 'b-2' }, ada);
    const reservation = reservationFrom(reserved.body);
    const cancelled = handleRequest('POST', `/reservations/${reservation.id}/cancel`, undefined, ada);
    expect(cancelled.status).toBe(200);
    expect(reservationFrom(cancelled.body).status).toBe('cancelled');
  });

  it('rejects unauthenticated return and cancellation', () => {
    const ada = signInAs('m-1');
    const created = handleRequest('POST', '/loans', { bookId: 'b-1' }, ada);
    const loan = loanFrom(created.body);
    checkout({ bookId: 'b-2', memberId: 'm-2' });
    const reserved = handleRequest('POST', '/reservations', { bookId: 'b-2' }, ada);
    const reservation = reservationFrom(reserved.body);

    expect(handleRequest('POST', `/loans/${loan.id}/return`)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(handleRequest('POST', `/reservations/${reservation.id}/cancel`)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(getLoan(loan.id)?.returnedAt).toBeNull();
    expect(getReservation(reservation.id)?.status).toBe('pending');
  });

  it('refuses returning or cancelling another member record', () => {
    const ada = signInAs('m-1');
    const alan = signInAs('m-2');
    const created = handleRequest('POST', '/loans', { bookId: 'b-1' }, ada);
    const loan = loanFrom(created.body);
    checkout({ bookId: 'b-2', memberId: 'm-3' });
    const reserved = handleRequest('POST', '/reservations', { bookId: 'b-2' }, ada);
    const reservation = reservationFrom(reserved.body);

    expect(handleRequest('POST', `/loans/${loan.id}/return`, undefined, alan)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(getLoan(loan.id)?.returnedAt).toBeNull();
    expect(handleRequest('POST', `/reservations/${reservation.id}/cancel`, undefined, alan)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(getReservation(reservation.id)?.status).toBe('pending');
  });

  it('returns not found for a missing loan or reservation before checking ownership', () => {
    const ada = signInAs('m-1');
    expect(handleRequest('POST', '/loans/loan-nonexistent-999/return', undefined, ada)).toEqual({
      status: 404,
      body: { error: 'unknown_loan' },
    });
    expect(handleRequest('POST', '/reservations/res-nonexistent-999/cancel', undefined, ada)).toEqual({
      status: 404,
      body: { error: 'reservation_not_found' },
    });
  });

  it('rejects malformed or missing authorization', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(handleRequest('POST', '/loans', { bookId: 'b-1' }, { authorization: 'Basic dXNlcjpwYXNz' })).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(handleRequest('GET', '/members/m-1/loans', undefined, { authorization: 'Bearer ' })).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    expect(handleRequest('POST', '/loans/loan-1/return', undefined, { authorization: 'Bearer expired-token' })).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    });
    const logged = stderr.mock.calls.map((call) => String(call[0])).join('');
    expect(logged).toContain('WARN unauthorized');
    expect(logged).not.toContain('expired-token');
    expect(logged).not.toContain('dXNlcjpwYXNz');
    stderr.mockRestore();
  });

  it('walks sign-in, checkout, inspection, foreign rejection, and return', () => {
    accountsDir = mkdtempSync(join(tmpdir(), 'library-lib6-'));
    resetAccountsForTests(join(accountsDir, 'accounts.json'));
    const ada = signInPatron('ada', 'ada-secret', 'm-1');
    const alan = signInPatron('alan', 'alan-secret', 'm-2');

    const created = handleRequest('POST', '/loans', { bookId: 'b-1' }, ada);
    expect(created.status).toBe(201);
    const loan = loanFrom(created.body);
    expect(loan.memberId).toBe('m-1');

    const ownLoans = handleRequest('GET', '/members/m-1/loans', undefined, ada);
    expect(ownLoans.status).toBe(200);
    expect(ownLoans.body).toMatchObject({
      loans: [expect.objectContaining({ id: loan.id, bookId: 'b-1', returnedAt: null })],
    });

    expect(handleRequest('GET', '/members/m-1/loans', undefined, alan)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });
    expect(handleRequest('POST', `/loans/${loan.id}/return`, undefined, alan)).toEqual({
      status: 403,
      body: { error: 'forbidden' },
    });

    const returned = handleRequest('POST', `/loans/${loan.id}/return`, undefined, ada);
    expect(returned.status).toBe(200);
    expect(loanFrom(returned.body).returnedAt).toBe(todayIsoDate());

    const closed = handleRequest('GET', '/members/m-1/loans', undefined, ada);
    expect(closed.status).toBe(200);
    expect(closed.body).toMatchObject({
      loans: [expect.objectContaining({ id: loan.id, returnedAt: todayIsoDate() })],
    });
  });

  it('keeps catalog and sign-in routes open without a session', () => {
    expect(handleRequest('GET', '/health').status).toBe(200);
    expect(handleRequest('GET', '/books').status).toBe(200);
    expect(handleRequest('GET', '/books/b-1').status).toBe(200);
    expect(handleRequest('GET', '/').status).toBe(200);
  });
});

function signInAs(memberId: string): Headers {
  const session = createSession({
    id: memberId,
    username: memberId,
    passwordHash: 'unused:00',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  return { authorization: `Bearer ${session.token}` };
}
