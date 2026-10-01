import { getBook } from './catalog.js';
import { availableCopies } from './loans.js';
import { getMember } from './members.js';
import type { BookId, MemberId, Reservation, ReservationId } from './types.js';

const reservations = new Map<ReservationId, Reservation>();
let sequence = 0;

function isActive(status: Reservation['status']): boolean {
  return status === 'pending' || status === 'held';
}

function byQueueOrder(a: Reservation, b: Reservation): number {
  const created = a.createdAt.localeCompare(b.createdAt);
  if (created !== 0) return created;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

export function listReservationsForMember(memberId: MemberId): Reservation[] {
  return [...reservations.values()].filter((reservation) => reservation.memberId === memberId);
}

export function listActiveReservations(bookId: BookId): Reservation[] {
  return [...reservations.values()]
    .filter((reservation) => reservation.bookId === bookId && isActive(reservation.status))
    .sort(byQueueOrder);
}

export function countHeldReservations(bookId: BookId): number {
  return [...reservations.values()].filter(
    (reservation) => reservation.bookId === bookId && reservation.status === 'held',
  ).length;
}

export function getReservation(reservationId: ReservationId): Reservation | undefined {
  return reservations.get(reservationId);
}

export function getHeldReservationForMember(bookId: BookId, memberId: MemberId): Reservation | undefined {
  return [...reservations.values()].find(
    (reservation) =>
      reservation.bookId === bookId && reservation.memberId === memberId && reservation.status === 'held',
  );
}

function nextPending(bookId: BookId): Reservation | undefined {
  return listActiveReservations(bookId).find((reservation) => reservation.status === 'pending');
}

export function promoteNextPending(bookId: BookId): Reservation | undefined {
  const next = nextPending(bookId);
  if (!next) return undefined;
  next.status = 'held';
  return next;
}

export function fulfillHeldReservation(bookId: BookId, memberId: MemberId): Reservation | undefined {
  const held = getHeldReservationForMember(bookId, memberId);
  if (!held) return undefined;
  held.status = 'fulfilled';
  return held;
}

export function reserveBook(input: { bookId: BookId; memberId: MemberId }): Reservation {
  const book = getBook(input.bookId);
  if (!book) {
    throw new Error(`unknown_book:${input.bookId}`);
  }
  const member = getMember(input.memberId);
  if (!member) {
    throw new Error(`unknown_member:${input.memberId}`);
  }
  if (availableCopies(input.bookId) >= 1) {
    throw new Error(`copies_available:${input.bookId}`);
  }

  const duplicate = [...reservations.values()].some(
    (reservation) =>
      reservation.bookId === input.bookId &&
      reservation.memberId === input.memberId &&
      isActive(reservation.status),
  );
  if (duplicate) {
    throw new Error(`duplicate_reservation:${input.memberId}`);
  }

  sequence += 1;
  const reservation: Reservation = {
    id: `res-${sequence}`,
    bookId: input.bookId,
    memberId: input.memberId,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  reservations.set(reservation.id, reservation);
  return reservation;
}

export function cancelReservation(reservationId: ReservationId): Reservation {
  const reservation = reservations.get(reservationId);
  if (!reservation) {
    throw new Error(`reservation_not_found:${reservationId}`);
  }
  if (reservation.status === 'cancelled') {
    throw new Error(`already_cancelled:${reservationId}`);
  }
  if (reservation.status === 'fulfilled') {
    throw new Error(`already_fulfilled:${reservationId}`);
  }

  const wasHeld = reservation.status === 'held';
  reservation.status = 'cancelled';
  if (wasHeld) {
    promoteNextPending(reservation.bookId);
  }
  return reservation;
}

export function resetReservationsForTests(): void {
  reservations.clear();
  sequence = 0;
}
