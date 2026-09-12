/// <reference types="vite/client" />
/**
 * `user.profile` returns a picked identity, never the whole JWT.
 * Source: https://docs.convex.dev/testing/convex-test
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

describe('user.profile', () => {
  it('returns null without an identity', async () => {
    const t = convexTest({ schema, modules });
    expect(await t.query(api.user.profile, {})).toBeNull();
  });

  it('returns only the picked fields for a signed-in user', async () => {
    const t = convexTest({ schema, modules });
    const asUser = t.withIdentity({
      subject: 'user_123',
      email: 'e2e+clerk_test@example.com',
      name: 'E2E User',
      pictureUrl: 'https://img.clerk.com/avatar.png',
      // Custom claims are present on real tokens and must not leak through.
      org_role: 'admin',
    });

    expect(await asUser.query(api.user.profile, {})).toEqual({
      subject: 'user_123',
      email: 'e2e+clerk_test@example.com',
      name: 'E2E User',
      pictureUrl: 'https://img.clerk.com/avatar.png',
    });
  });
});
