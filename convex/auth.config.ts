/**
 * Convex auth provider: the Clerk JWT template named `convex`.
 *
 * `CLERK_JWT_ISSUER_DOMAIN` is a **Convex deployment** variable (dashboard →
 * Settings → Environment Variables, or `npx convex env set`). It is the Issuer
 * URL of the `convex` JWT template, e.g. `https://your-app.clerk.accounts.dev`.
 * `convex dev` fails when it is missing. Cloud agents and CI set it on the
 * anonymous deployment first (see `.cursor/install.sh` and
 * `.github/workflows/check.yml`).
 * See https://docs.convex.dev/auth/clerk#configuring-dev-and-prod-instances
 */
import type { AuthConfig } from 'convex/server';

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig;
