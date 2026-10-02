import { findBookByIsbn, getBook, listBooks } from './catalog.js';
import { listHoldsForMember, listNotificationsForMember, placeHold } from './holds.js';
import { availableCopies, checkout, getLoan, listLoansForMember, returnLoan } from './loans.js';
import { renderDeskHtml } from './desk.js';
import {
  checkRateLimit,
  clearRateLimit,
  createSession,
  getMember,
  getSession,
  recordFailedSignIn,
  registerMemberAccount,
  revokeSession,
  verifyCredentials,
} from './members.js';
import { cancelReservation, getReservation, listReservationsForMember, reserveBook } from './reservations.js';
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

function bearerToken(headers?: Record<string, string | string[] | undefined>): string | undefined {
  if (!headers) return undefined;
  const raw = headers.authorization ?? headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return undefined;
  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
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

type SessionAuth = { accountId: string };

function requireSession(headers?: Record<string, string | string[] | undefined>): SessionAuth | HttpResult {
  const token = bearerToken(headers);
  const session = token ? getSession(token) : undefined;
  if (!session) {
    process.stderr.write('WARN unauthorized\n');
    return jsonError(401, 'unauthorized');
  }
  return { accountId: session.accountId };
}

function isRefusal<T extends object>(result: T | HttpResult): result is HttpResult {
  return 'status' in result;
}

function refuseForeignMember(): HttpResult {
  process.stderr.write('WARN forbidden\n');
  return jsonError(403, 'forbidden');
}

function requireActingMember(
  headers: Record<string, string | string[] | undefined> | undefined,
  body: unknown,
): { accountId: string; record: Record<string, unknown> } | HttpResult {
  const session = requireSession(headers);
  if (isRefusal(session)) return session;
  if (!body || typeof body !== 'object') return jsonError(400, 'invalid_json');
  const record = body as Record<string, unknown>;
  const memberId = typeof record.memberId === 'string' ? record.memberId : '';
  if (memberId && memberId !== session.accountId) return refuseForeignMember();
  return { accountId: session.accountId, record };
}

function readOwnActivity(
  headers: Record<string, string | string[] | undefined> | undefined,
  memberId: string,
  present: (id: string) => HttpResult,
): HttpResult {
  const session = requireSession(headers);
  if (isRefusal(session)) return session;
  if (memberId !== session.accountId) return refuseForeignMember();
  const member = getMember(memberId);
  if (!member) return jsonError(404, 'member_not_found');
  return present(member.id);
}

export function handleRequest(
  method: string,
  pathname: string,
  body?: unknown,
  headers?: Record<string, string | string[] | undefined>,
): HttpResult {
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

  if (method === 'POST' && pathname === '/signin') {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      if (body === undefined) return jsonError(400, 'missing_username_or_password');
      return jsonError(400, 'invalid_json');
    }
    const record = body as Record<string, unknown>;
    const username = typeof record.username === 'string' ? record.username.trim() : '';
    const password = typeof record.password === 'string' ? record.password : '';
    if (!username || password.length === 0) return jsonError(400, 'missing_username_or_password');
    if (checkRateLimit(username)) {
      process.stderr.write(`WARN rate limit triggered for user: ${username}\n`);
      return jsonError(429, 'rate_limited');
    }
    const account = verifyCredentials(username, password);
    if (!account) {
      recordFailedSignIn(username);
      process.stderr.write('WARN sign-in failed\n');
      return jsonError(401, 'invalid_credentials');
    }
    clearRateLimit(username);
    const session = createSession(account);
    return {
      status: 200,
      body: {
        token: session.token,
        account: {
          id: account.id,
          username: account.username,
          createdAt: account.createdAt,
        },
      },
    };
  }

  if (method === 'POST' && pathname === '/signout') {
    const token = bearerToken(headers);
    if (!token || !getSession(token) || !revokeSession(token)) return jsonError(401, 'unauthorized');
    return { status: 200, body: { ok: true } };
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
    const acting = requireActingMember(headers, body);
    if (isRefusal(acting)) return acting;
    const bookId = typeof acting.record.bookId === 'string' ? acting.record.bookId : '';
    if (!bookId) return jsonError(400, 'missing_book_or_member');
    try {
      return { status: 201, body: { loan: checkout({ bookId, memberId: acting.accountId }) } };
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
    const session = requireSession(headers);
    if (isRefusal(session)) return session;
    const loanId = returnMatch[1] ?? '';
    const loan = getLoan(loanId);
    if (!loan) return jsonError(404, 'unknown_loan');
    if (loan.memberId !== session.accountId) return refuseForeignMember();
    try {
      return { status: 200, body: { loan: returnLoan(loanId) } };
    } catch (error) {
      const code = errorCode(error, 'return_failed');
      return jsonError(code === 'already_returned' ? 409 : 404, code);
    }
  }

  if (method === 'POST' && pathname === '/reservations') {
    const acting = requireActingMember(headers, body);
    if (isRefusal(acting)) return acting;
    const bookId = typeof acting.record.bookId === 'string' ? acting.record.bookId : '';
    if (!bookId) return jsonError(400, 'missing_book_or_member');
    try {
      return { status: 201, body: { reservation: reserveBook({ bookId, memberId: acting.accountId }) } };
    } catch (error) {
      const code = errorCode(error, 'reservation_failed');
      if (code === 'unknown_book' || code === 'unknown_member') return jsonError(404, code);
      if (code === 'copies_available' || code === 'duplicate_reservation') return jsonError(409, code);
      return jsonError(400, code);
    }
  }

  const cancelMatch = pathname.match(/^\/reservations\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const session = requireSession(headers);
    if (isRefusal(session)) return session;
    const reservationId = cancelMatch[1] ?? '';
    const reservation = getReservation(reservationId);
    if (!reservation) return jsonError(404, 'reservation_not_found');
    if (reservation.memberId !== session.accountId) return refuseForeignMember();
    try {
      return { status: 200, body: { reservation: cancelReservation(reservationId) } };
    } catch (error) {
      const code = errorCode(error, 'cancel_failed');
      if (code === 'reservation_not_found') return jsonError(404, code);
      if (code === 'already_cancelled' || code === 'already_fulfilled') return jsonError(409, code);
      return jsonError(400, code);
    }
  }

  if (method === 'POST' && pathname === '/holds') {
    const acting = requireActingMember(headers, body);
    if (isRefusal(acting)) return acting;
    const bookId = typeof acting.record.bookId === 'string' ? acting.record.bookId : '';
    if (!bookId) return jsonError(400, 'missing_book_or_member');
    try {
      return { status: 201, body: { hold: placeHold({ bookId, memberId: acting.accountId }) } };
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
    return readOwnActivity(headers, memberHolds[1] ?? '', (id) => ({
      status: 200,
      body: { holds: listHoldsForMember(id) },
    }));
  }

  const memberNotifications = pathname.match(/^\/members\/([^/]+)\/notifications$/);
  if (method === 'GET' && memberNotifications) {
    return readOwnActivity(headers, memberNotifications[1] ?? '', (id) => ({
      status: 200,
      body: { notifications: listNotificationsForMember(id) },
    }));
  }

  const memberLoans = pathname.match(/^\/members\/([^/]+)\/loans$/);
  if (method === 'GET' && memberLoans) {
    return readOwnActivity(headers, memberLoans[1] ?? '', (id) => ({
      status: 200,
      body: { loans: listLoansForMember(id) },
    }));
  }

  const memberReservations = pathname.match(/^\/members\/([^/]+)\/reservations$/);
  if (method === 'GET' && memberReservations) {
    return readOwnActivity(headers, memberReservations[1] ?? '', (id) => ({
      status: 200,
      body: { reservations: listReservationsForMember(id) },
    }));
  }

  return jsonError(404, 'not_found');
}
