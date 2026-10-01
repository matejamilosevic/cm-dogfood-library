import { getBook } from './catalog.js';
import { getMember } from './members.js';
import {
  countHeldReservations,
  fulfillHeldReservation,
  getHeldReservationForMember,
  promoteNextPending,
  resetReservationsForTests,
} from './reservations.js';
import type { BookId, Loan, LoanId, MemberId } from './types.js';

const LOAN_DAYS = 21;
const loans = new Map<LoanId, Loan>();
let sequence = 0;

function todayIsoDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function activeLoansForBook(bookId: BookId): Loan[] {
  return [...loans.values()].filter((loan) => loan.bookId === bookId && loan.returnedAt === null);
}

function createLoan(bookId: BookId, memberId: MemberId): Loan {
  sequence += 1;
  const loan: Loan = {
    id: `loan-${sequence}`,
    bookId,
    memberId,
    checkedOutAt: todayIsoDate(),
    dueAt: todayIsoDate(LOAN_DAYS),
    returnedAt: null,
  };
  loans.set(loan.id, loan);
  return loan;
}

export function availableCopies(bookId: BookId): number {
  const book = getBook(bookId);
  if (!book) return 0;
  return Math.max(0, book.copies - activeLoansForBook(bookId).length - countHeldReservations(bookId));
}

export function checkout(input: { bookId: BookId; memberId: MemberId }): Loan {
  const book = getBook(input.bookId);
  if (!book) {
    throw new Error(`unknown_book:${input.bookId}`);
  }
  const member = getMember(input.memberId);
  if (!member) {
    throw new Error(`unknown_member:${input.memberId}`);
  }

  const heldForMember = getHeldReservationForMember(input.bookId, input.memberId);
  if (heldForMember) {
    fulfillHeldReservation(input.bookId, input.memberId);
    return createLoan(input.bookId, input.memberId);
  }

  if (availableCopies(input.bookId) < 1) {
    if (countHeldReservations(input.bookId) > 0) {
      throw new Error(`copy_held_for_other_member:${input.bookId}`);
    }
    throw new Error(`no_copies_available:${input.bookId}`);
  }

  return createLoan(input.bookId, input.memberId);
}

export function returnLoan(loanId: LoanId): Loan {
  const loan = loans.get(loanId);
  if (!loan) {
    throw new Error(`unknown_loan:${loanId}`);
  }
  if (loan.returnedAt) {
    throw new Error(`already_returned:${loanId}`);
  }
  const returned: Loan = { ...loan, returnedAt: todayIsoDate() };
  loans.set(loanId, returned);
  promoteNextPending(loan.bookId);
  return returned;
}

export function listLoansForMember(memberId: MemberId): Loan[] {
  return [...loans.values()].filter((loan) => loan.memberId === memberId);
}

export function resetLoansForTests(): void {
  loans.clear();
  sequence = 0;
  resetReservationsForTests();
}
