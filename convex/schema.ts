/**
 * Convex schema. `schema.doc("table")` gives the full-document validator for
 * `returns` (see `convex/_generated/ai/guidelines.md`).
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  posts: defineTable({
    id: v.string(),
    title: v.string(),
    body: v.string(),
  }).index('id', ['id']),
});
