import { createSession } from '../src/members.js';
import type { MemberAccount } from '../src/types.js';

export function authHeaders(memberId: string): { authorization: string } {
  const account: MemberAccount = {
    id: memberId,
    username: memberId,
    passwordHash: 'unused:00',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  return { authorization: `Bearer ${createSession(account).token}` };
}
