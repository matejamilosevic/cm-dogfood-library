import { findBookByIsbn, getBook, listBooks } from './catalog.js';
import { listHoldsForMember, listNotificationsForMember, placeHold } from './holds.js';
import { availableCopies, checkout, listLoansForMember, returnLoan } from './loans.js';
import { renderDeskHtml } from './desk.js';
import { findMemberByEmail, getMember, registerMemberAccount } from './members.js';
import { cancelReservation, listReservationsForMember, reserveBook } from './reservations.js';
import type { Book } from './types.js';

export type HttpResult = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

function jsonError(status: number, code: string): HttpResult {
  return { status, body: { error: code } };
}

function errorCode(error: unknown, fallback: string): string {
  return error instanceof Error ? (error.message.split(':')[0] ?? fallback) : fallback;
}

function bookAvailability(bookId: string) {
  const available = availableCopies(bookId);
  return {
    availableCopies: available,
    holdEligible: available === 0,
  };
}

function withAvailability(book: Book) {
  return { ...book, ...bookAvailability(book.id) };
}

function resolveMember(record: Record<string, unknown>): { memberId: string } | HttpResult {
  const memberId = typeof record.memberId === 'string' ? record.memberId : '';
  if (memberId) return { memberId };
  if (typeof record.email === 'string' && record.email) {
    const member = findMemberByEmail(record.email);
    if (!member) return jsonError(404, 'unknown_member');
    return { memberId: member.id };
  }
  return jsonError(400, 'missing_book_or_member');
}

export function handleRequest(method: string, pathname: string, body?: unknown): HttpResult {
  if (method === 'GET' && pathname === '/') {
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: renderDeskHtml(),
    };
  }

  if (method === 'GET' && pathname === '/health') {
    return { status: 200, body: { ok: true } };
  }

  if (method === 'POST' && pathname === '/signup') {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      if (body === undefined) return jsonError(400, 'missing_username_or_password');
      return jsonError(400, 'invalid_json');
    }
    const record = body as Record<string, unknown>;
    const username = typeof record.username === 'string' ? record.username.trim() : '';
    const password = typeof record.password === 'string' ? record.password : '';
    if (!username || password.length === 0) return jsonError(400, 'missing_username_or_password');
    try {
      const account = registerMemberAccount({ username, password });
      return { status: 201, body: { account } };
    } catch (error) {
      const code = errorCode(error, 'signup_failed');
      if (code === 'username_already_taken') {
        return jsonError(409, code);
      }
      if (code === 'missing_username_or_password') {
        return jsonError(400, code);
      }
      process.stderr.write('signup failed\n');
      return jsonError(500, 'signup_failed');
    }
  }

  if (method === 'GET' && pathname === '/books') {
    return { status: 200, body: { books: listBooks().map(withAvailability) } };
  }

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/);
  if (method === 'GET' && bookMatch) {
    const raw = decodeURIComponent(bookMatch[1] ?? '');
    const book = getBook(raw) ?? findBookByIsbn(raw);
    if (!book) return jsonError(404, 'book_not_found');
    const availability = bookAvailability(book.id);
    return {
      status: 200,
      body: {
        book: { ...book, ...availability },
        ...availability,
      },
    };
  }

  if (method === 'POST' && pathname === '/loans') {
    if (!body || typeof body !== 'object') return jsonError(400, 'invalid_json');
    const record = body as Record<string, unknown>;
    const bookId = typeof record.bookId === 'string' ? record.bookId : '';
    const memberId =
      typeof record.memberId === 'string'
        ? record.memberId
        : typeof record.email === 'string'
          ? (findMemberByEmail(record.email)?.id ?? '')
          : '';
    if (!bookId || !memberId) return jsonError(400, 'missing_book_or_member');
    try {
      return { status: 201, body: { loan: checkout({ bookId, memberId }) } };
    } catch (error) {
      const code = errorCode(error, 'checkout_failed');
      const status =
        code === 'no_copies_available' ||
        code === 'queue_priority_conflict' ||
        code === 'copy_held_for_other_member'
          ? 409
          : 404;
      return jsonError(status, code);
    }
  }

  const returnMatch = pathname.match(/^\/loans\/([^/]+)\/return$/);
  if (method === 'POST' && returnMatch) {
    try {
      return { status: 200, body: { loan: returnLoan(returnMatch[1] ?? '') } };
    } catch (error) {
      const code = errorCode(error, 'return_failed');
      return jsonError(code === 'already_returned' ? 409 : 404, code);
    }
  }

  if (method === 'POST' && pathname === '/reservations') {
    if (!body || typeof body !== 'object') return jsonError(400, 'invalid_json');
    const record = body as Record<string, unknown>;
    const bookId = typeof record.bookId === 'string' ? record.bookId : '';
    if (!bookId) return jsonError(400, 'missing_book_or_member');
    const resolved = resolveMember(record);
    if ('status' in resolved) return resolved;
    try {
      return { status: 201, body: { reservation: reserveBook({ bookId, memberId: resolved.memberId }) } };
    } catch (error) {
      const code = errorCode(error, 'reservation_failed');
      if (code === 'unknown_book' || code === 'unknown_member') return jsonError(404, code);
      if (code === 'copies_available' || code === 'duplicate_reservation') return jsonError(409, code);
      return jsonError(400, code);
    }
  }

  const cancelMatch = pathname.match(/^\/reservations\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    try {
      return { status: 200, body: { reservation: cancelReservation(cancelMatch[1] ?? '') } };
    } catch (error) {
      const code = errorCode(error, 'cancel_failed');
      if (code === 'reservation_not_found') return jsonError(404, code);
      if (code === 'already_cancelled' || code === 'already_fulfilled') return jsonError(409, code);
      return jsonError(400, code);
    }
  }

  if (method === 'POST' && pathname === '/holds') {
    if (!body || typeof body !== 'object') return jsonError(400, 'invalid_json');
    const record = body as Record<string, unknown>;
    const bookId = typeof record.bookId === 'string' ? record.bookId : '';
    const memberId =
      typeof record.memberId === 'string'
        ? record.memberId
        : typeof record.email === 'string'
          ? (findMemberByEmail(record.email)?.id ?? '')
          : '';
    if (!bookId || !memberId) return jsonError(400, 'missing_book_or_member');
    try {
      return { status: 201, body: { hold: placeHold({ bookId, memberId }) } };
    } catch (error) {
      const code = error instanceof Error ? error.message.split(':')[0] : 'hold_failed';
      let status = 400;
      if (code === 'copies_available' || code === 'duplicate_hold' || code === 'hold_limit_exceeded') {
        status = 409;
      } else if (code === 'unknown_book' || code === 'unknown_member') {
        status = 404;
      }
      return jsonError(status, code ?? 'hold_failed');
    }
  }

  const memberHolds = pathname.match(/^\/members\/([^/]+)\/holds$/);
  if (method === 'GET' && memberHolds) {
    const member = getMember(memberHolds[1] ?? '');
    if (!member) return jsonError(404, 'member_not_found');
    return { status: 200, body: { holds: listHoldsForMember(member.id) } };
  }

  const memberNotifications = pathname.match(/^\/members\/([^/]+)\/notifications$/);
  if (method === 'GET' && memberNotifications) {
    const member = getMember(memberNotifications[1] ?? '');
    if (!member) return jsonError(404, 'member_not_found');
    return { status: 200, body: { notifications: listNotificationsForMember(member.id) } };
  }

  const memberLoans = pathname.match(/^\/members\/([^/]+)\/loans$/);
  if (method === 'GET' && memberLoans) {
    const member = getMember(memberLoans[1] ?? '');
    if (!member) return jsonError(404, 'member_not_found');
    return { status: 200, body: { loans: listLoansForMember(member.id) } };
  }

  const memberReservations = pathname.match(/^\/members\/([^/]+)\/reservations$/);
  if (method === 'GET' && memberReservations) {
    const member = getMember(memberReservations[1] ?? '');
    if (!member) return jsonError(404, 'member_not_found');
    return { status: 200, body: { reservations: listReservationsForMember(member.id) } };
  }

  return jsonError(404, 'not_found');
}
