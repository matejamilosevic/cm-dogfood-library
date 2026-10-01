import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest } from '../src/http.js';
import { resetLoansForTests } from '../src/loans.js';

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
