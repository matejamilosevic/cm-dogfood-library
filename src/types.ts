export type BookId = string;
export type MemberId = string;
export type LoanId = string;
export type ReservationId = string;

export type ReservationStatus = 'pending' | 'held' | 'fulfilled' | 'cancelled';

export type Book = {
  id: BookId;
  isbn: string;
  title: string;
  author: string;
  copies: number;
  availableCopies?: number;
};

export type Member = {
  id: MemberId;
  name: string;
  email: string;
};

export type Loan = {
  id: LoanId;
  bookId: BookId;
  memberId: MemberId;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
};

export type Reservation = {
  id: ReservationId;
  bookId: BookId;
  memberId: MemberId;
  createdAt: string;
  status: ReservationStatus;
};
