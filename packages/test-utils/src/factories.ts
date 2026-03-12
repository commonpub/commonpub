function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface TestUser {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  socialLinks: Record<string, string> | null;
  role: 'member' | 'pro' | 'verified' | 'staff' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  profileVisibility: 'public' | 'members' | 'private';
  skills: string[] | null;
  theme: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface TestFederatedAccount {
  id: string;
  userId: string;
  actorUri: string;
  instanceDomain: string;
  preferredUsername: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

export interface TestOAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  instanceDomain: string;
  createdAt: Date;
}

let counter = 0;

function nextId(): number {
  return ++counter;
}

export function resetFactoryCounter(): void {
  counter = 0;
}

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const n = nextId();
  return {
    id: generateId(),
    email: `user${n}@test.example.com`,
    emailVerified: true,
    username: `testuser${n}`,
    displayName: `Test User ${n}`,
    bio: null,
    headline: null,
    location: null,
    website: null,
    avatarUrl: null,
    bannerUrl: null,
    socialLinks: null,
    role: 'member',
    status: 'active',
    profileVisibility: 'public',
    skills: null,
    theme: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestSession(overrides?: Partial<TestSession>): TestSession {
  const n = nextId();
  return {
    id: generateId(),
    userId: generateId(),
    token: `test-token-${n}-${generateId()}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestFederatedAccount(
  overrides?: Partial<TestFederatedAccount>,
): TestFederatedAccount {
  const n = nextId();
  const domain = overrides?.instanceDomain ?? `instance${n}.example.com`;
  return {
    id: generateId(),
    userId: generateId(),
    actorUri: `https://${domain}/users/user${n}`,
    instanceDomain: domain,
    preferredUsername: `user${n}`,
    displayName: `Federated User ${n}`,
    avatarUrl: null,
    lastSyncedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createTestOAuthClient(overrides?: Partial<TestOAuthClient>): TestOAuthClient {
  const n = nextId();
  const domain = overrides?.instanceDomain ?? `client${n}.example.com`;
  return {
    id: generateId(),
    clientId: `client-id-${n}`,
    clientSecret: `client-secret-${n}`,
    redirectUris: [`https://${domain}/api/auth/callback/cpub-sso`],
    instanceDomain: domain,
    createdAt: new Date(),
    ...overrides,
  };
}
