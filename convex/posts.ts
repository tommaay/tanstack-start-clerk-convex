/**
 * Demo `posts` table: public list query and a one-time seed action.
 */
import { v } from 'convex/values';
import { api, internal } from './_generated/api.js';
import type { Doc } from './_generated/dataModel';
import { action, internalMutation, query } from './_generated/server';
import schema from './schema';

/** Shape of one seed record fetched by `populate`. */
const seedPostValidator = v.object({
  id: v.string(),
  title: v.string(),
  body: v.string(),
});

/** All posts, oldest first. Public and unauthenticated by design (demo data). */
export const list = query({
  args: {},
  returns: v.array(schema.doc('posts')),
  handler: async (ctx) => {
    return await ctx.db.query('posts').collect();
  },
});

/** Insert one seed post. Internal: only `populate` calls it. */
export const insert = internalMutation({
  args: { post: seedPostValidator },
  returns: v.id('posts'),
  handler: async (ctx, { post }) => {
    return await ctx.db.insert('posts', post);
  },
});

/** Load ten sample posts from JSONPlaceholder when the table is empty. */
export const populate = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Type annotation avoids TS circularity when calling a sibling function.
    const existing: Array<Doc<'posts'>> = await ctx.runQuery(
      api.posts.list,
      {},
    );
    if (existing.length > 0) {
      return null;
    }
    const response = await fetch('https://jsonplaceholder.typicode.com/posts');
    if (!response.ok) {
      throw new Error(`Seed fetch failed (HTTP ${response.status})`);
    }
    const posts = (await response.json()) as Array<{
      userId: number;
      id: number;
      title: string;
      body: string;
    }>;
    await Promise.all(
      posts.slice(0, 10).map((post) =>
        ctx.runMutation(internal.posts.insert, {
          post: {
            id: post.id.toString(),
            body: post.body,
            title: post.title,
          },
        }),
      ),
    );
    return null;
  },
});
