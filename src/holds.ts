import { getBook } from './catalog.js';
import { physicalAvailableCopies } from './loans.js';
import { getMember } from './members.js';
import { countHeldReservations } from './reservations.js';
import type { BookId, Hold, HoldId, MemberId, Notification, NotificationId } from './types.js';

const HOLD_DAYS = 7;
const MAX_ACTIVE_HOLDS = 3;

const holds = new Map<HoldId, Hold>();
const notifications = new Map<NotificationId, Notification>();
let holdSequence = 0;
let notificationSequence = 0;

export function todayIsoDate(offsetDays = 0, baseDate?: Date): string {
  const date = baseDate ? new Date(baseDate.getTime()) : new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isActiveStatus(status: Hold['status']): boolean {
  return status === 'waiting' || status === 'notified';
}

export function getNotifiedHoldsForBook(bookId: BookId): Hold[] {
  return [...holds.values()].filter((hold) => hold.bookId === bookId && hold.status === 'notified');
}

export function countActiveNotifiedHolds(bookId: BookId): number {
  return getNotifiedHoldsForBook(bookId).length;
}

function shelfAvailableCopies(bookId: BookId): number {
  return Math.max(
    0,
    physicalAvailableCopies(bookId) - countActiveNotifiedHolds(bookId) - countHeldReservations(bookId),
  );
}

function waitingHoldsForBook(bookId: BookId): Hold[] {
  return [...holds.values()]
    .filter((hold) => hold.bookId === bookId && hold.status === 'waiting')
    .sort((a, b) => a.sequenceRank - b.sequenceRank);
}

function notifyHold(hold: Hold, notifiedDate: string): Notification {
  const expiryDate = todayIsoDate(HOLD_DAYS, new Date(`${notifiedDate}T00:00:00.000Z`));
  hold.status = 'notified';
  hold.notifiedAt = notifiedDate;
  hold.expiresAt = expiryDate;

  notificationSequence += 1;
  const notification: Notification = {
    id: `notif-${notificationSequence}`,
    memberId: hold.memberId,
    holdId: hold.id,
    bookId: hold.bookId,
    createdAt: notifiedDate,
    expiresAt: expiryDate,
    message: `Book ${hold.bookId} is reserved and ready for pickup until ${expiryDate}`,
  };
  notifications.set(notification.id, notification);
  return notification;
}

export function placeHold(input: { bookId: BookId; memberId: MemberId }): Hold {
  const book = getBook(input.bookId);
  if (!book) {
    throw new Error(`unknown_book:${input.bookId}`);
  }

  const member = getMember(input.memberId);
  if (!member) {
    throw new Error(`unknown_member:${input.memberId}`);
  }

  processHoldExpiration(input.bookId);

  if (shelfAvailableCopies(input.bookId) > 0) {
    throw new Error(`copies_available:${input.bookId}`);
  }

  const hasDuplicate = [...holds.values()].some(
    (hold) => hold.memberId === input.memberId && hold.bookId === input.bookId && isActiveStatus(hold.status),
  );
  if (hasDuplicate) {
    throw new Error(`duplicate_hold:${input.memberId}:${input.bookId}`);
  }

  const activeCount = [...holds.values()].filter(
    (hold) => hold.memberId === input.memberId && isActiveStatus(hold.status),
  ).length;
  if (activeCount >= MAX_ACTIVE_HOLDS) {
    throw new Error(`hold_limit_exceeded:${input.memberId}`);
  }

  holdSequence += 1;
  const hold: Hold = {
    id: `hold-${holdSequence}`,
    bookId: input.bookId,
    memberId: input.memberId,
    status: 'waiting',
    createdAt: todayIsoDate(),
    notifiedAt: null,
    expiresAt: null,
    sequenceRank: holdSequence,
  };
  holds.set(hold.id, hold);
  return hold;
}

export function processReturnForHolds(bookId: BookId): Hold | undefined {
  processHoldExpiration(bookId);
  const nextHold = waitingHoldsForBook(bookId)[0];
  if (!nextHold) {
    return undefined;
  }
  notifyHold(nextHold, todayIsoDate());
  return nextHold;
}

export function processHoldExpiration(bookId?: BookId, currentDate = todayIsoDate()): Hold[] {
  const expiredHolds: Hold[] = [];
  const notifiedHolds = [...holds.values()].filter((hold) => {
    if (hold.status !== 'notified') return false;
    if (bookId && hold.bookId !== bookId) return false;
    return hold.expiresAt !== null && hold.expiresAt < currentDate;
  });

  for (const hold of notifiedHolds) {
    hold.status = 'expired';
    expiredHolds.push(hold);
    const nextHold = waitingHoldsForBook(hold.bookId)[0];
    if (nextHold) {
      notifyHold(nextHold, currentDate);
    }
  }

  return expiredHolds;
}

export function fulfillHold(holdId: HoldId): Hold {
  const hold = holds.get(holdId);
  if (!hold) {
    throw new Error(`unknown_hold:${holdId}`);
  }
  hold.status = 'fulfilled';
  return hold;
}

export function listHoldsForMember(memberId: MemberId): Hold[] {
  return [...holds.values()].filter((hold) => hold.memberId === memberId);
}

export function listNotificationsForMember(memberId: MemberId): Notification[] {
  return [...notifications.values()].filter((notification) => notification.memberId === memberId);
}

export function resetHoldsForTests(): void {
  holds.clear();
  notifications.clear();
  holdSequence = 0;
  notificationSequence = 0;
}
