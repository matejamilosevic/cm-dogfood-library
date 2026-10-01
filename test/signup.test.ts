import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetHoldsForTests } from '../src/holds.js';
import { handleRequest } from '../src/http.js';
import { resetLoansForTests } from '../src/loans.js';
import {
  getAccountsFilePath,
  getMemberAccount,
  listMemberAccounts,
  listMembers,
  reloadAccountsFromDisk,
  resetAccountsForTests,
} from '../src/members.js';
import { resetReservationsForTests } from '../src/reservations.js';
import { startServer } from '../src/server.js';
import type { MemberAccountPublic } from '../src/types.js';

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function accountFrom(body: unknown): MemberAccountPublic {
  return (body as { account: MemberAccountPublic }).account;
}

async function listen(server: Server): Promise<number> {
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });
  }
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('expected a tcp port');
  }
  return address.port;
}

describe('member signup', () => {
  let directory = '';
  let server: Server | undefined;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'library-accounts-'));
    resetAccountsForTests(join(directory, 'accounts.json'));
    resetLoansForTests();
    resetReservationsForTests();
    resetHoldsForTests();
  });

  afterEach(async () => {
    if (server) {
      const closing = server;
      server = undefined;
      await new Promise<void>((resolve, reject) => {
        closing.close((error) => (error ? reject(error) : resolve()));
      });
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('registers a new member account with unique credentials', () => {
    const result = handleRequest('POST', '/signup', {
      username: 'reader1',
      password: 'secretpass123',
    });

    expect(result.status).toBe(201);
    const account = accountFrom(result.body);
    expect(account.id).toEqual(expect.any(String));
    expect(account.id.length).toBeGreaterThan(0);
    expect(account.username).toBe('reader1');
    expect(account.createdAt).toMatch(ISO_8601);
    expect(account).not.toHaveProperty('password');
    expect(account).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result.body)).not.toContain('secretpass123');
    expect(JSON.stringify(result.body)).not.toContain('passwordHash');
  });

  it('rejects duplicate usernames regardless of case', () => {
    const created = handleRequest('POST', '/signup', {
      username: 'reader1',
      password: 'secretpass123',
    });
    expect(created.status).toBe(201);

    const same = handleRequest('POST', '/signup', {
      username: 'reader1',
      password: 'anotherpass456',
    });
    expect(same.status).toBe(409);
    expect(same.body).toEqual({ error: 'username_already_taken' });

    const upper = handleRequest('POST', '/signup', {
      username: 'READER1',
      password: 'yetAnotherPass',
    });
    expect(upper.status).toBe(409);
    expect(upper.body).toEqual({ error: 'username_already_taken' });

    const mixed = handleRequest('POST', '/signup', {
      username: 'Reader1',
      password: 'yetAnotherPass',
    });
    expect(mixed.status).toBe(409);
    expect(mixed.body).toEqual({ error: 'username_already_taken' });
  });

  it('rejects signup requests missing username or password', () => {
    const emptyUsername = handleRequest('POST', '/signup', {
      username: '',
      password: 'secret123',
    });
    expect(emptyUsername.status).toBe(400);
    expect(emptyUsername.body).toEqual({ error: 'missing_username_or_password' });

    const blankUsername = handleRequest('POST', '/signup', {
      username: '   ',
      password: 'secret123',
    });
    expect(blankUsername.status).toBe(400);
    expect(blankUsername.body).toEqual({ error: 'missing_username_or_password' });

    const emptyPassword = handleRequest('POST', '/signup', {
      username: 'validuser',
      password: '',
    });
    expect(emptyPassword.status).toBe(400);
    expect(emptyPassword.body).toEqual({ error: 'missing_username_or_password' });

    const emptyObject = handleRequest('POST', '/signup', {});
    expect(emptyObject.status).toBe(400);
    expect(emptyObject.body).toEqual({ error: 'missing_username_or_password' });
  });

  it('rejects malformed JSON signup bodies', async () => {
    server = startServer(0);
    const port = await listen(server);
    const response = await fetch(`http://127.0.0.1:${port}/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });

  it('stores a one-way password hash and does not return the password', () => {
    const password = 'SuperSecret987!';
    const created = handleRequest('POST', '/signup', {
      username: 'secureuser',
      password,
    });
    expect(created.status).toBe(201);

    const raw = readFileSync(getAccountsFilePath(), 'utf8');
    expect(raw).not.toContain(password);
    const stored = JSON.parse(raw) as { accounts: Array<Record<string, unknown>> };
    expect(stored.accounts).toHaveLength(1);
    expect(stored.accounts[0]).not.toHaveProperty('password');
    expect(stored.accounts[0]?.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);

    const account = getMemberAccount('secureuser');
    expect(account).toMatchObject({ username: 'secureuser' });
    expect(account).not.toHaveProperty('password');
    expect(account).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(account)).not.toContain(password);
  });

  it('starts with an empty account store when no file exists', () => {
    expect(existsSync(getAccountsFilePath())).toBe(false);
    expect(listMemberAccounts()).toEqual([]);
    expect(listMembers()).toHaveLength(3);
    expect(listMembers().map((member) => member.id)).toEqual(['m-1', 'm-2', 'm-3']);
  });

  it('keeps registered accounts after the store is reloaded', () => {
    const created = handleRequest('POST', '/signup', {
      username: 'persistuser',
      password: 'savemepass',
    });
    expect(created.status).toBe(201);

    reloadAccountsFromDisk();

    expect(getMemberAccount('persistuser')).toMatchObject({ username: 'persistuser' });
    const duplicate = handleRequest('POST', '/signup', {
      username: 'persistuser',
      password: 'savemepass',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'username_already_taken' });
  });

  it('keeps catalog, loan, reservation, and hold routes working', () => {
    expect(handleRequest('GET', '/health')).toEqual({ status: 200, body: { ok: true } });

    const books = handleRequest('GET', '/books');
    expect(books.status).toBe(200);
    expect(books.body).toMatchObject({ books: expect.any(Array) });

    const loan = handleRequest('POST', '/loans', { bookId: 'b-1', memberId: 'm-1' });
    expect(loan.status).toBe(201);

    const checkedOut = handleRequest('POST', '/loans', { bookId: 'b-2', memberId: 'm-1' });
    expect(checkedOut.status).toBe(201);
    const reservation = handleRequest('POST', '/reservations', { bookId: 'b-2', memberId: 'm-2' });
    expect(reservation.status).toBe(201);
    const hold = handleRequest('POST', '/holds', { bookId: 'b-2', memberId: 'm-3' });
    expect(hold.status).toBe(201);
  });

  it('signs up, persists a hash, reloads, and still serves the catalog', () => {
    const password = 'Passw0rdSecure!';
    const created = handleRequest('POST', '/signup', {
      username: 'e2e_user',
      password,
    });
    expect(created.status).toBe(201);
    const account = accountFrom(created.body);
    expect(account.username).toBe('e2e_user');
    expect(account).not.toHaveProperty('password');
    expect(account).not.toHaveProperty('passwordHash');

    const raw = readFileSync(getAccountsFilePath(), 'utf8');
    expect(raw).toContain('e2e_user');
    expect(raw).not.toContain(password);
    const stored = JSON.parse(raw) as { accounts: Array<{ passwordHash: string }> };
    expect(stored.accounts[0]?.passwordHash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

    reloadAccountsFromDisk();
    const duplicate = handleRequest('POST', '/signup', {
      username: 'e2e_user',
      password,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'username_already_taken' });

    expect(handleRequest('GET', '/books').status).toBe(200);
    expect(handleRequest('GET', '/books/b-1').status).toBe(200);
  });
});
