import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest } from '../src/http.js';
import { authHeaders } from './session.js';
import {
  availableCopies,
  checkout,
  physicalAvailableCopies,
  resetLoansForTests,
  returnLoan,
} from '../src/loans.js';
import {
  listHoldsForMember,
  listNotificationsForMember,
  placeHold,
  processHoldExpiration,
  todayIsoDate,
} from '../src/holds.js';
import type { Hold, Loan, Notification } from '../src/types.js';

function drainCopies(bookId: string, memberId = 'm-2') {
  while (physicalAvailableCopies(bookId) > 0) {
    checkout({ bookId, memberId });
  }
}

function loanFrom(result: { body: unknown }): Loan {
  return (result.body as { loan: Loan }).loan;
}

function holdFrom(result: { body: unknown }): Hold {
  return (result.body as { hold: Hold }).hold;
}

describe('holds', () => {
  beforeEach(() => {
    resetLoansForTests();
  });

  it('looks up a book by ID or ISBN with available copies (AC-001)', () => {
    const byId = handleRequest('GET', '/books/b-1');
    expect(byId.status).toBe(200);
    expect(byId.body).toMatchObject({
      book: { id: 'b-1', copies: 2 },
      availableCopies: 2,
      holdEligible: false,
    });

    const byIsbn = handleRequest('GET', '/books/978-0-14-044913-6');
    expect(byIsbn.status).toBe(200);
    expect(byIsbn.body).toMatchObject({
      book: { id: 'b-1', copies: 2 },
      availableCopies: 2,
    });
  });

  it('indicates hold eligibility when a title has zero available copies (AC-002)', () => {
    checkout({ bookId: 'b-2', memberId: 'm-1' });
    const result = handleRequest('GET', '/books/b-2');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      availableCopies: 0,
      holdEligible: true,
      book: { id: 'b-2', availableCopies: 0, holdEligible: true },
    });
  });

  it('checks out an available book for 21 days and restores availability on return (AC-003, AC-004)', () => {
    expect(availableCopies('b-1')).toBe(2);
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    expect(created.status).toBe(201);
    const loan = loanFrom(created);
    expect(loan.dueAt).toBe(todayIsoDate(21));
    expect(availableCopies('b-1')).toBe(1);

    const returned = handleRequest('POST', `/loans/${loan.id}/return`, undefined, authHeaders('m-1'));
    expect(returned.status).toBe(200);
    expect(loanFrom(returned).returnedAt).toBe(todayIsoDate());
    expect(availableCopies('b-1')).toBe(2);
  });

  it('places holds on a fully checked-out title in FIFO order (AC-005)', () => {
    drainCopies('b-2', 'm-3');
    const first = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    const second = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const hold1 = holdFrom(first);
    const hold2 = holdFrom(second);
    expect(hold1.status).toBe('waiting');
    expect(hold2.status).toBe('waiting');
    expect(hold1.sequenceRank).toBeLessThan(hold2.sequenceRank);
    expect(hold1.createdAt).toBeTruthy();
    expect(hold2.createdAt).toBeTruthy();
  });

  it('rejects hold placement when copies are available on the shelf (AC-006)', () => {
    const result = handleRequest('POST', '/holds', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: 'copies_available' });
    expect(() => placeHold({ bookId: 'b-1', memberId: 'm-1' })).toThrow(/copies_available/);
  });

  it('enforces a maximum of 3 active holds per member (AC-007)', () => {
    drainCopies('b-1');
    drainCopies('b-2');
    drainCopies('b-3');
    drainCopies('b-4');

    expect(placeHold({ bookId: 'b-1', memberId: 'm-1' }).status).toBe('waiting');
    expect(placeHold({ bookId: 'b-2', memberId: 'm-1' }).status).toBe('waiting');
    expect(placeHold({ bookId: 'b-3', memberId: 'm-1' }).status).toBe('waiting');
    expect(() => placeHold({ bookId: 'b-4', memberId: 'm-1' })).toThrow(/hold_limit_exceeded/);

    const httpResult = handleRequest('POST', '/holds', { bookId: 'b-4', memberId: 'm-1' }, authHeaders('m-1'));
    expect(httpResult.status).toBe(409);
    expect(httpResult.body).toEqual({ error: 'hold_limit_exceeded' });
  });

  it('notifies the first waiting member with a 7-day pickup deadline on return (AC-008)', () => {
    const loan = checkout({ bookId: 'b-2', memberId: 'm-2' });
    placeHold({ bookId: 'b-2', memberId: 'm-1' });

    const started = Date.now();
    const returned = returnLoan(loan.id);
    const elapsed = Date.now() - started;

    expect(returned.returnedAt).toBeTruthy();
    expect(elapsed).toBeLessThan(500);

    const holds = listHoldsForMember('m-1');
    expect(holds).toHaveLength(1);
    expect(holds[0]?.status).toBe('notified');
    expect(holds[0]?.notifiedAt).toBe(todayIsoDate());
    expect(holds[0]?.expiresAt).toBe(todayIsoDate(7));

    const notifications = listNotificationsForMember('m-1');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      memberId: 'm-1',
      bookId: 'b-2',
      holdId: holds[0]?.id,
      expiresAt: todayIsoDate(7),
    });
    expect(notifications[0]?.message).toContain('b-2');
  });

  it('rejects checkout by a non-notified member while a copy is reserved (AC-009)', () => {
    const loan = checkout({ bookId: 'b-2', memberId: 'm-2' });
    placeHold({ bookId: 'b-2', memberId: 'm-1' });
    returnLoan(loan.id);

    expect(() => checkout({ bookId: 'b-2', memberId: 'm-2' })).toThrow(/queue_priority_conflict/);
    const result = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-3' }, authHeaders('m-3'));
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: 'queue_priority_conflict' });
  });

  it('expires a pickup window and promotes the next waiting member (AC-10)', () => {
    const loan = checkout({ bookId: 'b-2', memberId: 'm-3' });
    placeHold({ bookId: 'b-2', memberId: 'm-1' });
    placeHold({ bookId: 'b-2', memberId: 'm-2' });
    returnLoan(loan.id);

    expect(listHoldsForMember('m-1')[0]?.status).toBe('notified');
    expect(listHoldsForMember('m-2')[0]?.status).toBe('waiting');

    const afterDeadline = todayIsoDate(8);
    processHoldExpiration('b-2', afterDeadline);

    expect(listHoldsForMember('m-1')[0]?.status).toBe('expired');
    const promoted = listHoldsForMember('m-2')[0];
    expect(promoted?.status).toBe('notified');
    expect(promoted?.notifiedAt).toBe(afterDeadline);
    expect(promoted?.expiresAt).toBe(todayIsoDate(7, new Date(`${afterDeadline}T00:00:00.000Z`)));
  });

  it('completes search, hold, return, and priority checkout (e2e)', () => {
    const checkoutResult = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    expect(checkoutResult.status).toBe(201);
    const loanId = loanFrom(checkoutResult).id;

    const lookup = handleRequest('GET', '/books/b-2');
    expect(lookup.body).toMatchObject({ availableCopies: 0, holdEligible: true });

    const holdResult = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    expect(holdResult.status).toBe(201);
    expect(holdFrom(holdResult).status).toBe('waiting');

    const blocked = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-3' }, authHeaders('m-3'));
    expect(blocked.status).toBe(409);
    expect(blocked.body).toEqual({ error: 'no_copies_available' });

    const returned = handleRequest('POST', `/loans/${loanId}/return`, undefined, authHeaders('m-1'));
    expect(returned.status).toBe(200);

    const memberHolds = handleRequest('GET', '/members/m-2/holds', undefined, authHeaders('m-2'));
    expect(memberHolds.status).toBe(200);
    const holds = (memberHolds.body as { holds: Hold[] }).holds;
    expect(holds[0]?.status).toBe('notified');
    expect(holds[0]?.expiresAt).toBe(todayIsoDate(7));

    const notifications = handleRequest('GET', '/members/m-2/notifications', undefined, authHeaders('m-2'));
    expect(notifications.status).toBe(200);
    expect((notifications.body as { notifications: Notification[] }).notifications).toHaveLength(1);

    const stillBlocked = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-3' }, authHeaders('m-3'));
    expect(stillBlocked.status).toBe(409);
    expect(stillBlocked.body).toEqual({ error: 'queue_priority_conflict' });

    const priorityCheckout = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    expect(priorityCheckout.status).toBe(201);
    expect(loanFrom(priorityCheckout).memberId).toBe('m-2');
    expect(listHoldsForMember('m-2')[0]?.status).toBe('fulfilled');
  });

  it('rejects a duplicate active hold on the same title', () => {
    drainCopies('b-2', 'm-3');
    placeHold({ bookId: 'b-2', memberId: 'm-1' });
    const result = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ error: 'duplicate_hold' });
  });
});
