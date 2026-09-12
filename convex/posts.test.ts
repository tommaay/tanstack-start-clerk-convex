/// <reference types="vite/client" />
/**
 * `posts.list` and the `populate` seed action.
 * Source: https://docs.convex.dev/testing/convex-test
 */
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

/** Fake JSONPlaceholder response with more rows than the seed keeps. */
function fakeSeedResponse() {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    userId: 1,
    id: index + 1,
    title: `Title ${index + 1}`,
    body: `Body ${index + 1}`,
  }));
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('posts.list', () => {
  it('is empty on a fresh deployment', async () => {
    const t = convexTest({ schema, modules });
    expect(await t.query(api.posts.list, {})).toEqual([]);
  });

  it('returns inserted posts with system fields', async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(internal.posts.insert, {
      post: { id: '1', title: 'Hello', body: 'World' },
    });

    const posts = await t.query(api.posts.list, {});
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ id: '1', title: 'Hello', body: 'World' });
    expect(posts[0]?._id).toBeTypeOf('string');
    expect(posts[0]?._creationTime).toBeTypeOf('number');
  });
});

describe('posts.populate', () => {
  it('seeds ten posts when the table is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fakeSeedResponse()),
    );
    const t = convexTest({ schema, modules });

    await t.action(api.posts.populate, {});

    const posts = await t.query(api.posts.list, {});
    expect(posts).toHaveLength(10);
    expect(posts.map((post) => post.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => String(index + 1)),
    );
  });

  it('does nothing when posts already exist', async () => {
    const fetchMock = vi.fn(async () => fakeSeedResponse());
    vi.stubGlobal('fetch', fetchMock);
    const t = convexTest({ schema, modules });
    await t.mutation(internal.posts.insert, {
      post: { id: 'existing', title: 'Keep', body: 'Me' },
    });

    await t.action(api.posts.populate, {});

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.query(api.posts.list, {})).toHaveLength(1);
  });

  it('fails loudly when the seed fetch is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    const t = convexTest({ schema, modules });

    await expect(t.action(api.posts.populate, {})).rejects.toThrow(/HTTP 503/);
  });
});
