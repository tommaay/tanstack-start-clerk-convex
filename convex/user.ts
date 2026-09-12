/**
 * Identity of the signed-in user as seen by Convex (from the Clerk JWT).
 */
import { v } from 'convex/values';
import { query } from './_generated/server';

/** Fields the UI needs. Do not return the whole identity (custom claims vary). */
export const profileValidator = v.object({
  subject: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  pictureUrl: v.optional(v.string()),
});

/** The caller's profile, or `null` when the request has no verified identity. */
export const profile = query({
  args: {},
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    return {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      pictureUrl: identity.pictureUrl,
    };
  },
});
