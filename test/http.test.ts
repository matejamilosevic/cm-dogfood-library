import { beforeEach, describe, expect, it } from 'vitest';
import { todayIsoDate } from '../src/holds.js';
import { handleRequest } from '../src/http.js';
import { checkout, physicalAvailableCopies, resetLoansForTests } from '../src/loans.js';
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
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' });
    expect(created.status).toBe(201);
    const loanId = (created.body as { loan: { id: string } }).loan.id;
    const returned = handleRequest('POST', `/loans/${loanId}/return`);
    expect(returned.status).toBe(200);
  });

  it('looks up a member by email on checkout', () => {
    const created = handleRequest('POST', '/loans', {
      bookId: 'b-3',
      email: 'ada@library.test',
    });
    expect(created.status).toBe(201);
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
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });
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

  it('serves the desk with members and live copy counts', () => {
    const html = deskPage();

    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('value="m-1"');
    expect(html).toContain('Alan Turing');
    expect(html).toContain('value="m-2"');
    expect(html).toContain('Grace Hopper');
    expect(html).toContain('value="m-3"');
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

  it('loads another member loans and holds without login', () => {
    handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-2' });
    drainCopies('b-4', 'm-3');
    handleRequest('POST', '/holds', { bookId: 'b-4', memberId: 'm-2' });

    const loans = handleRequest('GET', '/members/m-2/loans');
    const holds = handleRequest('GET', '/members/m-2/holds');
    const reservations = handleRequest('GET', '/members/m-2/reservations');

    expect(loans.status).toBe(200);
    expect(loans.body).toMatchObject({ loans: [expect.objectContaining({ bookId: 'b-1', memberId: 'm-2' })] });
    expect(holds.status).toBe(200);
    expect(holds.body).toMatchObject({ holds: [expect.objectContaining({ bookId: 'b-4', status: 'waiting' })] });
    expect(reservations.status).toBe(200);
    expect(reservations.body).toEqual({ reservations: [] });
    expect(deskPage()).toContain("fetch('/members/' + memberId + '/loans')");
  });

  it('returns empty loans, holds, and reservations for a member with none', () => {
    expect(handleRequest('GET', '/members/m-3/loans').body).toEqual({ loans: [] });
    expect(handleRequest('GET', '/members/m-3/holds').body).toEqual({ holds: [] });
    expect(handleRequest('GET', '/members/m-3/reservations').body).toEqual({ reservations: [] });
  });

  it('checks out a copy for 21 days and decrements availability', () => {
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' });
    const loan = loanFrom(created.body);

    expect(created.status).toBe(201);
    expect(loan.dueAt).toBe(todayIsoDate(21));
    expect(handleRequest('GET', '/books/b-1').body).toMatchObject({ availableCopies: 1 });
    expect(handleRequest('GET', '/members/m-1/loans').body).toMatchObject({
      loans: [expect.objectContaining({ id: loan.id, bookId: 'b-1', dueAt: todayIsoDate(21), returnedAt: null })],
    });
    expect(deskPage()).toContain('data-available="1"');
  });

  it('returns a loan and restores availability', () => {
    const created = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' });
    const returned = handleRequest('POST', `/loans/${loanFrom(created.body).id}/return`);

    expect(returned.status).toBe(200);
    expect(loanFrom(returned.body).returnedAt).toBe(todayIsoDate());
    expect(handleRequest('GET', '/books/b-1').body).toMatchObject({ availableCopies: 2 });
  });

  it('places a waiting hold when no copies remain', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });

    const created = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' });

    expect(created.status).toBe(201);
    expect(holdFrom(created.body).status).toBe('waiting');
    expect(handleRequest('GET', '/members/m-2/holds').body).toMatchObject({
      holds: [expect.objectContaining({ bookId: 'b-2', status: 'waiting' })],
    });
  });

  it('notifies a waiting hold with a 7-day pickup deadline when the copy is returned', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' });

    const returned = handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`);

    expect(returned.status).toBe(200);
    expect(handleRequest('GET', '/members/m-2/holds').body).toMatchObject({
      holds: [expect.objectContaining({ bookId: 'b-2', status: 'notified', expiresAt: todayIsoDate(7) })],
    });
  });

  it('picks up a notified hold as a 21-day loan', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' });
    handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`);

    const pickup = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' });

    expect(pickup.status).toBe(201);
    expect(loanFrom(pickup.body)).toMatchObject({
      bookId: 'b-2',
      memberId: 'm-2',
      dueAt: todayIsoDate(21),
      returnedAt: null,
    });
    expect(handleRequest('GET', '/members/m-2/holds').body).toMatchObject({
      holds: [expect.objectContaining({ status: 'fulfilled' })],
    });
  });

  it('rejects a fourth active hold', () => {
    drainCopies('b-1');
    drainCopies('b-2');
    drainCopies('b-3');
    drainCopies('b-4');
    handleRequest('POST', '/holds', { bookId: 'b-1', memberId: 'm-1' });
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-1' });
    handleRequest('POST', '/holds', { bookId: 'b-3', memberId: 'm-1' });

    const rejected = handleRequest('POST', '/holds', { bookId: 'b-4', memberId: 'm-1' });

    expect(rejected.status).toBe(409);
    expect(rejected.body).toEqual({ error: 'hold_limit_exceeded' });
  });

  it('rejects a duplicate hold', () => {
    drainCopies('b-2');
    handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' });

    const rejected = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' });

    expect(rejected.status).toBe(409);
    expect(rejected.body).toEqual({ error: 'duplicate_hold' });
  });

  it('lists a member reservations and rejects an unknown member', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' });
    handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-1' });

    const listed = handleRequest('GET', '/members/m-1/reservations');
    const missing = handleRequest('GET', '/members/m-999/reservations');

    expect(listed.status).toBe(200);
    expect(listed.headers).toBeUndefined();
    expect(listed.body).toMatchObject({
      reservations: [expect.objectContaining({ bookId: 'b-2', memberId: 'm-1', status: 'pending' })],
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'member_not_found' });
  });

  it('picks up a held reservation without inventing a pickup deadline', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' });
    const reserved = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-1' });
    expect(reservationFrom(reserved.body).status).toBe('pending');
    handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`);

    const held = handleRequest('GET', '/members/m-1/reservations');
    const reservation = (held.body as { reservations: Reservation[] }).reservations[0];
    expect(reservation).toMatchObject({ bookId: 'b-2', status: 'held' });
    expect(reservation).not.toHaveProperty('expiresAt');

    const pickup = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });

    expect(pickup.status).toBe(201);
    expect(loanFrom(pickup.body).dueAt).toBe(todayIsoDate(21));
    expect(handleRequest('GET', '/members/m-1/reservations').body).toMatchObject({
      reservations: [expect.objectContaining({ status: 'fulfilled' })],
    });
  });

  it('walks checkout, hold, return, and pickup from the desk routes', () => {
    expect(deskPage()).toContain('Library desk');

    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });
    expect(loan.status).toBe(201);
    expect(loanFrom(loan.body).dueAt).toBe(todayIsoDate(21));
    expect(handleRequest('GET', '/books/b-2').body).toMatchObject({ availableCopies: 0 });

    const hold = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-2' });
    expect(holdFrom(hold.body).status).toBe('waiting');

    handleRequest('POST', `/loans/${loanFrom(loan.body).id}/return`);
    expect(handleRequest('GET', '/members/m-2/holds').body).toMatchObject({
      holds: [expect.objectContaining({ status: 'notified', expiresAt: todayIsoDate(7) })],
    });

    const pickup = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' });
    expect(loanFrom(pickup.body)).toMatchObject({ memberId: 'm-2', bookId: 'b-2', dueAt: todayIsoDate(21) });
    expect(handleRequest('GET', '/members/m-2/holds').body).toMatchObject({
      holds: [expect.objectContaining({ status: 'fulfilled' })],
    });
    expect(handleRequest('GET', '/members/m-2/loans').body).toMatchObject({
      loans: [expect.objectContaining({ bookId: 'b-2', returnedAt: null })],
    });
  });
});
