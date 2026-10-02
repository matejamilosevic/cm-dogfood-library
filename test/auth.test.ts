import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/http.js';
import {
  getAccountsFilePath,
  getSession,
  resetAccountsForTests,
  resetRateLimitsForTests,
  resetSessionsForTests,
} from '../src/members.js';
import { startServer } from '../src/server.js';
import type { MemberAccountPublic, Session } from '../src/types.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const TOKEN = /^[0-9a-f]{64}$/;

type AuthBody = {
  token?: string;
  account?: MemberAccountPublic;
  error?: string;
  ok?: boolean;
};

function authBody(body: unknown): AuthBody {
  return body as AuthBody;
}

async function listen(server: Server): Promise<number> {
  if (!server.listening) {
    await new Promise<void>((resolve) => {
      server.once('listening', () => resolve());
    });
  }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('expected a tcp port');
  return address.port;
}

function startLibraryProcess(accountsFile: string): Promise<{ port: number; child: ChildProcess }> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '0', ACCOUNTS_FILE: accountsFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`timed out starting library server\n${output}`));
    }, 20000);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timeout);
      reject(new Error(`library server exited early (${code ?? signal})\n${output}`));
    };
    child.once('exit', onExit);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/library listening on http:\/\/localhost:(\d+)/);
      if (!match?.[1]) return;
      clearTimeout(timeout);
      child.off('exit', onExit);
      resolve({ port: Number(match[1]), child });
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
  });
}

async function stopLibraryProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function postJson(
  port: number,
  pathname: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

describe('patron authentication', () => {
  let directory = '';
  let server: Server | undefined;
  let child: ChildProcess | undefined;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'library-auth-'));
    resetAccountsForTests(join(directory, 'accounts.json'));
    resetSessionsForTests();
    resetRateLimitsForTests();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (server) {
      const closing = server;
      server = undefined;
      await new Promise<void>((resolve, reject) => {
        closing.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await stopLibraryProcess(child);
    child = undefined;
    rmSync(directory, { recursive: true, force: true });
  });

  it('issues a 64-character session token for matching credentials', () => {
    expect(handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' }).status).toBe(201);

    const signedIn = handleRequest('POST', '/signin', { username: 'reader1', password: 'secretpass123' });
    expect(signedIn.status).toBe(200);
    const body = authBody(signedIn.body);
    expect(body.token).toMatch(TOKEN);
    expect(body.account).toMatchObject({ username: 'reader1' });
    expect(body.account?.id).toEqual(expect.any(String));
    expect(body.account?.createdAt).toEqual(expect.any(String));
    expect(body.account).not.toHaveProperty('password');
    expect(body.account).not.toHaveProperty('passwordHash');

    const session = getSession(body.token ?? '') as Session;
    expect(session.username).toBe('reader1');
    expect(session.accountId).toBe(body.account?.id);
    expect(Date.parse(session.expiresAt) - Date.parse(session.createdAt)).toBe(SESSION_TTL_MS);
    expect(readFileSync(getAccountsFilePath(), 'utf8')).not.toContain(body.token);
  });

  it('rejects a wrong password and an unknown username with the same message', () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });

    const wrongPassword = handleRequest('POST', '/signin', { username: 'reader1', password: 'wrongpassword' });
    const unknownUser = handleRequest('POST', '/signin', { username: 'unknown_user', password: 'any_password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual({ error: 'invalid_credentials' });
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('rejects missing sign-in credentials and malformed JSON', async () => {
    const blankUsername = handleRequest('POST', '/signin', { username: '   ', password: 'secret123' });
    expect(blankUsername.status).toBe(400);
    expect(blankUsername.body).toEqual({ error: 'missing_username_or_password' });

    const missingPassword = handleRequest('POST', '/signin', { username: 'reader1' });
    expect(missingPassword.status).toBe(400);
    expect(missingPassword.body).toEqual({ error: 'missing_username_or_password' });

    const notJson = handleRequest('POST', '/signin', 'not-json');
    expect(notJson.status).toBe(400);
    expect(notJson.body).toEqual({ error: 'invalid_json' });

    server = startServer(0);
    const port = await listen(server);
    const response = await fetch(`http://127.0.0.1:${port}/signin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });

  it('revokes an active session on sign-out', () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const signedIn = handleRequest('POST', '/signin', { username: 'reader1', password: 'secretpass123' });
    const token = authBody(signedIn.body).token ?? '';

    const signedOut = handleRequest('POST', '/signout', undefined, { authorization: `Bearer ${token}` });
    expect(signedOut.status).toBe(200);
    expect(signedOut.body).toEqual({ ok: true });
    expect(getSession(token)).toBeUndefined();
  });

  it('rejects sign-out with a revoked or unknown token', () => {
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const signedIn = handleRequest('POST', '/signin', { username: 'reader1', password: 'secretpass123' });
    const token = authBody(signedIn.body).token ?? '';
    expect(handleRequest('POST', '/signout', undefined, { authorization: `Bearer ${token}` }).status).toBe(200);

    const revoked = handleRequest('POST', '/signout', undefined, { authorization: `Bearer ${token}` });
    expect(revoked.status).toBe(401);
    expect(revoked.body).toEqual({ error: 'unauthorized' });

    const unknown = handleRequest('POST', '/signout', undefined, {
      authorization: `Bearer ${'ab'.repeat(32)}`,
    });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects sign-out when the Authorization header is missing or malformed', () => {
    const missing = handleRequest('POST', '/signout');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'unauthorized' });

    const basic = handleRequest('POST', '/signout', undefined, { authorization: 'Basic dXNlcjpwYXNz' });
    expect(basic.status).toBe(401);
    expect(basic.body).toEqual({ error: 'unauthorized' });

    const emptyBearer = handleRequest('POST', '/signout', undefined, { authorization: 'Bearer ' });
    expect(emptyBearer.status).toBe(401);
    expect(emptyBearer.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects and prunes a session older than 24 hours', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    handleRequest('POST', '/signup', { username: 'reader1', password: 'secretpass123' });
    const signedIn = handleRequest('POST', '/signin', { username: 'reader1', password: 'secretpass123' });
    const token = authBody(signedIn.body).token ?? '';

    vi.setSystemTime(new Date(Date.parse('2026-01-01T00:00:00.000Z') + SESSION_TTL_MS - 1));
    expect(getSession(token)?.token).toBe(token);

    vi.setSystemTime(new Date(Date.parse('2026-01-01T00:00:00.000Z') + SESSION_TTL_MS));
    const expired = handleRequest('POST', '/signout', undefined, { authorization: `Bearer ${token}` });
    expect(expired.status).toBe(401);
    expect(expired.body).toEqual({ error: 'unauthorized' });
    expect(getSession(token)).toBeUndefined();
  });

  it('keeps the account and drops the session when the server process restarts', async () => {
    const accountsFile = join(directory, 'accounts.json');
    const first = await startLibraryProcess(accountsFile);
    child = first.child;

    const created = await postJson(first.port, '/signup', { username: 'reader1', password: 'secretpass123' });
    expect(created.status).toBe(201);
    const signedIn = await postJson(first.port, '/signin', { username: 'reader1', password: 'secretpass123' });
    expect(signedIn.status).toBe(200);
    const token = authBody(signedIn.body).token ?? '';
    expect(token).toMatch(TOKEN);

    await stopLibraryProcess(child);
    child = undefined;

    const second = await startLibraryProcess(accountsFile);
    child = second.child;
    const stored = readFileSync(accountsFile, 'utf8');
    expect(stored).toContain('reader1');
    expect(stored).not.toContain('secretpass123');
    expect(stored).not.toContain(token);

    const rejected = await postJson(second.port, '/signout', undefined, { authorization: `Bearer ${token}` });
    expect(rejected.status).toBe(401);
    expect(rejected.body).toEqual({ error: 'unauthorized' });

    const again = await postJson(second.port, '/signin', { username: 'reader1', password: 'secretpass123' });
    expect(again.status).toBe(200);
    expect(authBody(again.body).token).toMatch(TOKEN);
    expect(authBody(again.body).token).not.toBe(token);
  }, 30000);

  it('counts failed sign-ins for an unknown username toward the rate limit', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = handleRequest('POST', '/signin', { username: 'missing_patron', password: 'any_password' });
      expect(failed.status).toBe(401);
      expect(failed.body).toEqual({ error: 'invalid_credentials' });
    }
    const blocked = handleRequest('POST', '/signin', { username: 'missing_patron', password: 'any_password' });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'rate_limited' });
  });

  it('blocks sign-in after five failed attempts within 15 minutes', () => {
    handleRequest('POST', '/signup', { username: 'lockout_user', password: 'correct_pass_999' });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' });
      expect(failed.status).toBe(401);
      expect(failed.body).toEqual({ error: 'invalid_credentials' });
    }

    const blocked = handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'rate_limited' });

    const sameUserDifferentCase = handleRequest('POST', '/signin', {
      username: 'LOCKOUT_USER',
      password: 'wrongpassword',
    });
    expect(sameUserDifferentCase.status).toBe(429);
    expect(sameUserDifferentCase.body).toEqual({ error: 'rate_limited' });
  });

  it('blocks a correct password while the username is rate limited', () => {
    handleRequest('POST', '/signup', { username: 'lockout_user', password: 'correct_pass_999' });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' });
    }

    const blocked = handleRequest('POST', '/signin', { username: 'lockout_user', password: 'correct_pass_999' });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'rate_limited' });
    expect(getSession(authBody(blocked.body).token ?? '')).toBeUndefined();
  });

  it('clears the failure count after a successful sign-in', () => {
    handleRequest('POST', '/signup', { username: 'lockout_user', password: 'correct_pass_999' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' }).status).toBe(401);
    }

    const signedIn = handleRequest('POST', '/signin', { username: 'lockout_user', password: 'correct_pass_999' });
    expect(signedIn.status).toBe(200);
    expect(authBody(signedIn.body).token).toMatch(TOKEN);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' });
      expect(failed.status).toBe(401);
      expect(failed.body).toEqual({ error: 'invalid_credentials' });
    }
  });

  it('ignores failed attempts that are older than 15 minutes', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    handleRequest('POST', '/signup', { username: 'lockout_user', password: 'correct_pass_999' });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' }).status).toBe(401);
    }

    vi.setSystemTime(new Date(Date.parse('2026-03-01T00:00:00.000Z') + FAILURE_WINDOW_MS + 1));
    const afterWindow = handleRequest('POST', '/signin', { username: 'lockout_user', password: 'wrongpassword' });
    expect(afterWindow.status).toBe(401);
    expect(afterWindow.body).toEqual({ error: 'invalid_credentials' });
  });

  it('runs registration, sign-in, sign-out, and a restart through the HTTP server', async () => {
    const accountsFile = join(directory, 'accounts.json');
    const first = await startLibraryProcess(accountsFile);
    child = first.child;

    const created = await postJson(first.port, '/signup', { username: 'reader2', password: 'secondpass456' });
    expect(created.status).toBe(201);
    expect(authBody(created.body).account?.username).toBe('reader2');

    const signedIn = await postJson(first.port, '/signin', { username: 'reader2', password: 'secondpass456' });
    expect(signedIn.status).toBe(200);
    const token = authBody(signedIn.body).token ?? '';
    expect(token).toMatch(TOKEN);

    const signedOut = await postJson(first.port, '/signout', undefined, { authorization: `Bearer ${token}` });
    expect(signedOut.status).toBe(200);
    expect(signedOut.body).toEqual({ ok: true });

    const reused = await postJson(first.port, '/signout', undefined, { authorization: `Bearer ${token}` });
    expect(reused.status).toBe(401);
    expect(reused.body).toEqual({ error: 'unauthorized' });

    const refreshed = await postJson(first.port, '/signin', { username: 'reader2', password: 'secondpass456' });
    expect(refreshed.status).toBe(200);
    const nextToken = authBody(refreshed.body).token ?? '';
    expect(nextToken).toMatch(TOKEN);

    await stopLibraryProcess(child);
    child = undefined;

    const second = await startLibraryProcess(accountsFile);
    child = second.child;
    const stored = readFileSync(accountsFile, 'utf8');
    expect(stored).toContain('reader2');
    expect(stored).not.toContain('secondpass456');

    const rejected = await postJson(second.port, '/signout', undefined, { authorization: `Bearer ${nextToken}` });
    expect(rejected.status).toBe(401);
    expect(rejected.body).toEqual({ error: 'unauthorized' });

    const afterRestart = await postJson(second.port, '/signin', { username: 'reader2', password: 'secondpass456' });
    expect(afterRestart.status).toBe(200);
    expect(authBody(afterRestart.body).token).toMatch(TOKEN);
    expect(authBody(afterRestart.body).account?.username).toBe('reader2');
  }, 30000);
});
