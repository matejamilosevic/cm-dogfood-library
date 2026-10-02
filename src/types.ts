export type BookId = string;
export type MemberId = string;
export type LoanId = string;
export type HoldId = string;
export type NotificationId = string;
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

export type SignupCredentials = {
  username: string;
  password: string;
};

export type MemberAccount = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
};

export type MemberAccountPublic = Pick<MemberAccount, 'id' | 'username' | 'createdAt'>;

export type SignInCredentials = {
  username: string;
  password: string;
};

export type SessionToken = string;

export type Session = {
  token: SessionToken;
  accountId: string;
  username: string;
  createdAt: string;
  expiresAt: string;
};

export type RateLimitEntry = {
  timestamps: number[];
};

export type Loan = {
  id: LoanId;
  bookId: BookId;
  memberId: MemberId;
  checkedOutAt: string;
  dueAt: string;
  returnedAt: string | null;
};

export type HoldStatus = 'waiting' | 'notified' | 'fulfilled' | 'expired' | 'cancelled';

export type Hold = {
  id: HoldId;
  bookId: BookId;
  memberId: MemberId;
  status: HoldStatus;
  createdAt: string;
  notifiedAt: string | null;
  expiresAt: string | null;
  sequenceRank: number;
};

export type Notification = {
  id: NotificationId;
  memberId: MemberId;
  holdId: HoldId;
  bookId: BookId;
  createdAt: string;
  expiresAt: string;
  message: string;
};

export type Reservation = {
  id: ReservationId;
  bookId: BookId;
  memberId: MemberId;
  createdAt: string;
  status: ReservationStatus;
};
