import type { Member, MemberId } from './types.js';

const members = new Map<MemberId, Member>([
  ['m-1', { id: 'm-1', name: 'Ada Lovelace', email: 'ada@library.test' }],
  ['m-2', { id: 'm-2', name: 'Alan Turing', email: 'alan@library.test' }],
]);

export function getMember(memberId: MemberId): Member | undefined {
  return members.get(memberId);
}

export function findMemberByEmail(email: string): Member | undefined {
  const needle = email.trim().toLowerCase();
  return [...members.values()].find((member) => member.email.toLowerCase() === needle);
}

export function listMembers(): Member[] {
  return [...members.values()];
}
