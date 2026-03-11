import { describe, it, expect } from 'vitest';
import {
  users,
  sessions,
  accounts,
  organizations,
  members,
  federatedAccounts,
  oauthClients,
  verifications,
  usersRelations,
  sessionsRelations,
  accountsRelations,
  organizationsRelations,
  membersRelations,
  federatedAccountsRelations,
} from '../auth';

describe('auth tables', () => {
  it('should export users table with expected columns', () => {
    expect(users).toBeDefined();
    const cols = Object.keys(users);
    expect(cols).toContain('id');
    expect(cols).toContain('email');
    expect(cols).toContain('username');
    expect(cols).toContain('displayName');
    expect(cols).toContain('avatarUrl');
    expect(cols).toContain('role');
    expect(cols).toContain('status');
  });

  it('should export sessions table with expected columns', () => {
    expect(sessions).toBeDefined();
    const cols = Object.keys(sessions);
    expect(cols).toContain('id');
    expect(cols).toContain('userId');
    expect(cols).toContain('token');
    expect(cols).toContain('expiresAt');
  });

  it('should export accounts table with expected columns', () => {
    expect(accounts).toBeDefined();
    const cols = Object.keys(accounts);
    expect(cols).toContain('id');
    expect(cols).toContain('userId');
    expect(cols).toContain('providerId');
    expect(cols).toContain('accountId');
  });

  it('should export organizations table', () => {
    expect(organizations).toBeDefined();
    expect(Object.keys(organizations)).toContain('slug');
  });

  it('should export members table', () => {
    expect(members).toBeDefined();
    expect(Object.keys(members)).toContain('organizationId');
    expect(Object.keys(members)).toContain('userId');
  });

  it('should export federatedAccounts table with expected columns', () => {
    expect(federatedAccounts).toBeDefined();
    const cols = Object.keys(federatedAccounts);
    expect(cols).toContain('actorUri');
    expect(cols).toContain('instanceDomain');
    expect(cols).toContain('preferredUsername');
  });

  it('should export oauthClients table with expected columns', () => {
    expect(oauthClients).toBeDefined();
    const cols = Object.keys(oauthClients);
    expect(cols).toContain('clientId');
    expect(cols).toContain('clientSecret');
    expect(cols).toContain('redirectUris');
    expect(cols).toContain('instanceDomain');
  });

  it('should export verifications table with expected columns', () => {
    expect(verifications).toBeDefined();
    const cols = Object.keys(verifications);
    expect(cols).toContain('id');
    expect(cols).toContain('identifier');
    expect(cols).toContain('value');
    expect(cols).toContain('expiresAt');
    expect(cols).toContain('createdAt');
    expect(cols).toContain('updatedAt');
  });
});

describe('auth relations', () => {
  it('should export all relation definitions', () => {
    expect(usersRelations).toBeDefined();
    expect(sessionsRelations).toBeDefined();
    expect(accountsRelations).toBeDefined();
    expect(organizationsRelations).toBeDefined();
    expect(membersRelations).toBeDefined();
    expect(federatedAccountsRelations).toBeDefined();
  });
});
