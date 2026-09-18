export type BookId = string;
export type MemberId = string;
export type LoanId = string;

export type Book = {
  id: BookId;
  isbn: string;
  title: string;
  author: string;
  copies: number;
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
