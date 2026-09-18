import { beforeEach, describe, expect, it } from 'vitest';
import { availableCopies, checkout, listLoansForMember, resetLoansForTests, returnLoan } from '../src/loans.js';

describe('loans', () => {
  beforeEach(() => {
    resetLoansForTests();
  });

  it('checks out a copy and decrements availability', () => {
    expect(availableCopies('b-2')).toBe(1);
    const loan = checkout({ bookId: 'b-2', memberId: 'm-1' });
    expect(loan.memberId).toBe('m-1');
    expect(availableCopies('b-2')).toBe(0);
    expect(listLoansForMember('m-1')).toHaveLength(1);
  });

  it('refuses checkout when no copies remain', () => {
    checkout({ bookId: 'b-2', memberId: 'm-1' });
    expect(() => checkout({ bookId: 'b-2', memberId: 'm-2' })).toThrow(/no_copies_available/);
  });

  it('returns a loan and restores availability', () => {
    const loan = checkout({ bookId: 'b-2', memberId: 'm-1' });
    const returned = returnLoan(loan.id);
    expect(returned.returnedAt).toBeTruthy();
    expect(availableCopies('b-2')).toBe(1);
  });
});
