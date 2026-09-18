import { checkout, listLoansForMember, returnLoan } from './loans.js';
import { findBookByIsbn, getBook, listBooks } from './catalog.js';
import { findMemberByEmail, getMember } from './members.js';

export type HttpResult = {
  status: number;
  body: unknown;
};

function jsonError(status: number, code: string): HttpResult {
  return { status, body: { error: code } };
}

export function handleRequest(method: string, pathname: string, body?: unknown): HttpResult {
  if (method === 'GET' && pathname === '/health') {
    return { status: 200, body: { ok: true } };
  }

  if (method === 'GET' && pathname === '/books') {
    return { status: 200, body: { books: listBooks() } };
  }

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/);
  if (method === 'GET' && bookMatch) {
    const book = getBook(bookMatch[1] ?? '') ?? findBookByIsbn(decodeURIComponent(bookMatch[1] ?? ''));
    if (!book) return jsonError(404, 'book_not_found');
    return { status: 200, body: { book } };
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
      const code = error instanceof Error ? error.message.split(':')[0] : 'checkout_failed';
      const status = code === 'no_copies_available' ? 409 : 404;
      return jsonError(status, code ?? 'checkout_failed');
    }
  }

  const returnMatch = pathname.match(/^\/loans\/([^/]+)\/return$/);
  if (method === 'POST' && returnMatch) {
    try {
      return { status: 200, body: { loan: returnLoan(returnMatch[1] ?? '') } };
    } catch (error) {
      const code = error instanceof Error ? error.message.split(':')[0] : 'return_failed';
      return jsonError(code === 'already_returned' ? 409 : 404, code ?? 'return_failed');
    }
  }

  const memberLoans = pathname.match(/^\/members\/([^/]+)\/loans$/);
  if (method === 'GET' && memberLoans) {
    const member = getMember(memberLoans[1] ?? '');
    if (!member) return jsonError(404, 'member_not_found');
    return { status: 200, body: { loans: listLoansForMember(member.id) } };
  }

  return jsonError(404, 'not_found');
}
