import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  Member,
  MemberAccount,
  MemberAccountPublic,
  MemberId,
  RateLimitEntry,
  Session,
  SignupCredentials,
} from './types.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SIGN_IN_FAILURE_LIMIT = 5;
const SIGN_IN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

const members = new Map<MemberId, Member>([
  ['m-1', { id: 'm-1', name: 'Ada Lovelace', email: 'ada@library.test' }],
  ['m-2', { id: 'm-2', name: 'Alan Turing', email: 'alan@library.test' }],
  ['m-3', { id: 'm-3', name: 'Grace Hopper', email: 'grace@library.test' }],
]);

// Registered desk accounts can borrow, but they stay out of the seeded directory.
const accountMembers = new Map<MemberId, Member>();

const accountsByUsername = new Map<string, MemberAccount>();
const sessionsByToken = new Map<string, Session>();
const failedAttemptsByUsername = new Map<string, RateLimitEntry>();
let accountsFilePath: string | undefined;
let accountsInitialized = false;

function defaultAccountsFile(): string {
  return process.env.ACCOUNTS_FILE ?? join(process.cwd(), 'data', 'accounts.json');
}

function usernameKey(username: string): string {
  return username.trim().toLowerCase();
}

function toPublicAccount(account: MemberAccount): MemberAccountPublic {
  return {
    id: account.id,
    username: account.username,
    createdAt: account.createdAt,
  };
}

function memberFromAccount(account: MemberAccount): Member {
  return {
    id: account.id,
    name: account.username,
    email: `${account.id}@accounts.library`,
  };
}

function syncAccountMembers(): void {
  accountMembers.clear();
  for (const account of accountsByUsername.values()) {
    accountMembers.set(account.id, memberFromAccount(account));
  }
}

function isStoredAccount(value: unknown): value is MemberAccount {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.username === 'string' &&
    typeof record.passwordHash === 'string' &&
    record.passwordHash.includes(':') &&
    typeof record.createdAt === 'string' &&
    !('password' in record)
  );
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function persistAccounts(): void {
  if (!accountsFilePath) {
    throw new Error('persistence_failed');
  }
  const directory = dirname(accountsFilePath);
  mkdirSync(directory, { recursive: true });
  const tempPath = `${accountsFilePath}.${process.pid}.tmp`;
  const payload = { accounts: [...accountsByUsername.values()] };
  try {
    writeFileSync(tempPath, `${JSON.stringify(payload)}\n`, 'utf8');
    renameSync(tempPath, accountsFilePath);
  } catch (error) {
    if (existsSync(tempPath)) unlinkSync(tempPath);
    if (error instanceof Error && error.message === 'persistence_failed') throw error;
    throw new Error('persistence_failed');
  }
}

function loadAccounts(): void {
  accountsByUsername.clear();
  accountMembers.clear();
  if (!accountsFilePath || !existsSync(accountsFilePath)) {
    process.stdout.write('accounts store initialized: empty\n');
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(accountsFilePath, 'utf8')) as unknown;
  } catch {
    throw new Error('accounts_store_unreadable');
  }

  const accounts = (parsed as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts) || !accounts.every(isStoredAccount)) {
    throw new Error('accounts_store_unreadable');
  }

  for (const account of accounts) {
    accountsByUsername.set(usernameKey(account.username), account);
  }
  syncAccountMembers();
  process.stdout.write(`accounts store initialized: ${accountsByUsername.size} accounts loaded\n`);
}

export function getAccountsFilePath(): string {
  return accountsFilePath ?? defaultAccountsFile();
}

export function initializeAccountStore(filePath?: string): void {
  accountsFilePath = filePath ?? accountsFilePath ?? defaultAccountsFile();
  loadAccounts();
  accountsInitialized = true;
}

function ensureAccountsInitialized(): void {
  if (!accountsInitialized) initializeAccountStore();
}

export function getMember(memberId: MemberId): Member | undefined {
  return members.get(memberId) ?? accountMembers.get(memberId);
}

export function findMemberByEmail(email: string): Member | undefined {
  const needle = email.trim().toLowerCase();
  return [...members.values()].find((member) => member.email.toLowerCase() === needle);
}

export function listMembers(): Member[] {
  return [...members.values()];
}

export function getMemberAccount(username: string): MemberAccountPublic | undefined {
  ensureAccountsInitialized();
  const account = accountsByUsername.get(usernameKey(username));
  return account ? toPublicAccount(account) : undefined;
}

export function listMemberAccounts(): MemberAccountPublic[] {
  ensureAccountsInitialized();
  return [...accountsByUsername.values()].map(toPublicAccount);
}

export function registerMemberAccount(input: SignupCredentials): MemberAccountPublic {
  ensureAccountsInitialized();
  const username = input.username.trim();
  const password = input.password;
  if (!username || password.length === 0) {
    throw new Error('missing_username_or_password');
  }

  const key = usernameKey(username);
  if (accountsByUsername.has(key)) {
    process.stderr.write(`WARN duplicate username: ${username}\n`);
    throw new Error('username_already_taken');
  }

  const account: MemberAccount = {
    id: `m-acc-${randomUUID()}`,
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  accountsByUsername.set(key, account);
  accountMembers.set(account.id, memberFromAccount(account));
  try {
    persistAccounts();
  } catch {
    accountsByUsername.delete(key);
    accountMembers.delete(account.id);
    process.stderr.write('account persistence failed\n');
    throw new Error('persistence_failed');
  }

  process.stdout.write(`account registered: ${username}\n`);
  return toPublicAccount(account);
}

export function reloadAccountsFromDisk(): void {
  const filePath = getAccountsFilePath();
  accountsInitialized = false;
  initializeAccountStore(filePath);
}

export function resetAccountsForTests(filePath: string): void {
  accountsByUsername.clear();
  accountsInitialized = false;
  initializeAccountStore(filePath);
}

function passwordsMatch(password: string, passwordHash: string): boolean {
  const separator = passwordHash.indexOf(':');
  if (separator <= 0) return false;
  const salt = passwordHash.slice(0, separator);
  const storedHex = passwordHash.slice(separator + 1);
  const stored = Buffer.from(storedHex, 'hex');
  const computed = scryptSync(password, salt, 32);
  if (stored.length === 0 || stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

export function verifyCredentials(username: string, password: string): MemberAccount | undefined {
  ensureAccountsInitialized();
  const account = accountsByUsername.get(usernameKey(username));
  if (!account || !passwordsMatch(password, account.passwordHash)) return undefined;
  return account;
}

export function createSession(account: MemberAccount): Session {
  const createdAtMs = Date.now();
  const session: Session = {
    token: randomBytes(32).toString('hex'),
    accountId: account.id,
    username: account.username,
    createdAt: new Date(createdAtMs).toISOString(),
    expiresAt: new Date(createdAtMs + SESSION_TTL_MS).toISOString(),
  };
  sessionsByToken.set(session.token, session);
  return session;
}

export function getSession(token: string): Session | undefined {
  const session = sessionsByToken.get(token);
  if (!session) return undefined;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessionsByToken.delete(token);
    return undefined;
  }
  return session;
}

export function revokeSession(token: string): boolean {
  return sessionsByToken.delete(token);
}

export function resetSessionsForTests(): void {
  sessionsByToken.clear();
}

function failureTimestamps(username: string, now: number): number[] {
  const entry = failedAttemptsByUsername.get(usernameKey(username));
  if (!entry) return [];
  return entry.timestamps.filter((timestamp) => now - timestamp < SIGN_IN_FAILURE_WINDOW_MS);
}

export function checkRateLimit(username: string): boolean {
  const now = Date.now();
  const recent = failureTimestamps(username, now);
  const key = usernameKey(username);
  if (recent.length === 0) {
    failedAttemptsByUsername.delete(key);
    return false;
  }
  failedAttemptsByUsername.set(key, { timestamps: recent });
  return recent.length >= SIGN_IN_FAILURE_LIMIT;
}

export function recordFailedSignIn(username: string): void {
  const now = Date.now();
  const key = usernameKey(username);
  const timestamps = failureTimestamps(username, now);
  timestamps.push(now);
  failedAttemptsByUsername.set(key, { timestamps });
}

export function clearRateLimit(username: string): void {
  failedAttemptsByUsername.delete(usernameKey(username));
}

export function resetRateLimitsForTests(): void {
  failedAttemptsByUsername.clear();
}
