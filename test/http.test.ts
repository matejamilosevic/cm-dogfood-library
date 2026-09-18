import { beforeEach, describe, expect, it } from 'vitest';
import { handleRequest } from '../src/http.js';
import { resetLoansForTests } from '../src/loans.js';

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
});
