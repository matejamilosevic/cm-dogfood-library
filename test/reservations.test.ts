import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest } from '../src/http.js';
import { resetLoansForTests } from '../src/loans.js';
import { authHeaders } from './session.js';
import { getReservation, listActiveReservations } from '../src/reservations.js';

type ReservationView = { id: string; bookId: string; memberId: string; status: string };
type BookView = { id: string; availableCopies: number };

function reservationFrom(body: unknown): ReservationView {
  return (body as { reservation: ReservationView }).reservation;
}

function loanIdFrom(body: unknown): string {
  return (body as { loan: { id: string } }).loan.id;
}

function availableCopiesOf(bookId: string): number {
  const detail = handleRequest('GET', `/books/${bookId}`);
  return (detail.body as { book: BookView }).book.availableCopies;
}

describe('reservations', () => {
  beforeEach(() => {
    resetLoansForTests();
  });

  it('places a reservation when no copies remain on the shelf', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));

    const created = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    expect(created.status).toBe(201);
    expect(reservationFrom(created.body)).toMatchObject({
      bookId: 'b-2',
      memberId: 'm-2',
      status: 'pending',
    });
  });

  it('rejects a reservation when shelf copies are still available', () => {
    const rejected = handleRequest('POST', '/reservations', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({ error: 'copies_available' });
  });

  it('rejects a duplicate reservation for the same member and book', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    const first = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    expect(first.status).toBe(201);

    const duplicate = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({ error: 'duplicate_reservation' });
  });

  it('places a reservation for the signed-in member', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));

    const created = handleRequest(
      'POST',
      '/reservations',
      {
        bookId: 'b-2',
        email: 'alan@library.test',
      },
      authHeaders('m-2'),
    );

    expect(created.status).toBe(201);
    expect(reservationFrom(created.body)).toMatchObject({
      bookId: 'b-2',
      memberId: 'm-2',
      status: 'pending',
    });
  });

  it('cancels a pending reservation and removes it from the queue', () => {
    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    const created = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    const reservation = reservationFrom(created.body);

    const cancelled = handleRequest('POST', `/reservations/${reservation.id}/cancel`, undefined, authHeaders('m-2'));

    expect(cancelled.status).toBe(200);
    expect(reservationFrom(cancelled.body).status).toBe('cancelled');
    expect(listActiveReservations('b-2').some((item) => item.memberId === 'm-2')).toBe(false);
  });

  it('transfers a held copy to the next member when the holder cancels', () => {
    const firstLoan = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1'));
    handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-2' }, authHeaders('m-2'));
    const firstReservation = reservationFrom(
      handleRequest('POST', '/reservations', { bookId: 'b-1', memberId: 'm-1' }, authHeaders('m-1')).body,
    );
    const secondReservation = reservationFrom(
      handleRequest('POST', '/reservations', { bookId: 'b-1', memberId: 'm-2' }, authHeaders('m-2')).body,
    );
    handleRequest('POST', `/loans/${loanIdFrom(firstLoan.body)}/return`, undefined, authHeaders('m-1'));
    expect(getReservation(firstReservation.id)?.status).toBe('held');
    expect(availableCopiesOf('b-1')).toBe(0);

    const cancelled = handleRequest(
      'POST',
      `/reservations/${firstReservation.id}/cancel`,
      undefined,
      authHeaders('m-1'),
    );

    expect(cancelled.status).toBe(200);
    expect(reservationFrom(cancelled.body).status).toBe('cancelled');
    expect(getReservation(secondReservation.id)?.status).toBe('held');
  });

  it('returns the only held copy to the shelf when that reservation is cancelled', () => {
    const loan = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    const reservation = reservationFrom(
      handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1')).body,
    );
    handleRequest('POST', `/loans/${loanIdFrom(loan.body)}/return`, undefined, authHeaders('m-2'));
    expect(getReservation(reservation.id)?.status).toBe('held');
    expect(availableCopiesOf('b-2')).toBe(0);

    const cancelled = handleRequest(
      'POST',
      `/reservations/${reservation.id}/cancel`,
      undefined,
      authHeaders('m-1'),
    );

    expect(cancelled.status).toBe(200);
    expect(availableCopiesOf('b-2')).toBe(1);
  });

  it('rejects cancellation of a missing or already cancelled reservation', () => {
    const missing = handleRequest('POST', '/reservations/res-nonexistent/cancel', undefined, authHeaders('m-1'));
    expect(missing.status).toBe(404);

    handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' }, authHeaders('m-1'));
    const created = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' }, authHeaders('m-2'));
    const reservation = reservationFrom(created.body);
    expect(reservation.id).toBe('res-1');
    expect(handleRequest('POST', `/reservations/${reservation.id}/cancel`, undefined, authHeaders('m-2')).status).toBe(200);

    const again = handleRequest('POST', '/reservations/res-1/cancel', undefined, authHeaders('m-2'));
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: 'already_cancelled' });
  });
});
