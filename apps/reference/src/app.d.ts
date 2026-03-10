/// <reference types="@sveltejs/kit" />

import type { AuthUser, AuthSession } from '@snaplify/auth';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@snaplify/schema';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: AuthUser | null;
      session: AuthSession | null;
      db: NodePgDatabase<typeof schema>;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
