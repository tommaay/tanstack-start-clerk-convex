import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router';
import {
  ClerkProvider,
  Show,
  SignInButton,
  useAuth,
} from '@clerk/tanstack-react-start';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createServerFn } from '@tanstack/react-start';
import * as React from 'react';
import { auth } from '@clerk/tanstack-react-start/server';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import type { ConvexQueryClient } from '@convex-dev/react-query';
import type { ConvexReactClient } from 'convex/react';
import type { QueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Toaster } from '~/components/ui/sonner';
import { ContentContainer } from '~/components/content-container';
import { UserMenu } from '~/components/user-menu';
import appCss from '~/styles/app.css?url';

const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { getToken, userId } = await auth();
  const token = await getToken({ template: 'convex' });

  return {
    userId,
    token,
  };
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
      {
        name: 'theme-color',
        content: '#ffffff',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    const clerkAuth = await fetchClerkAuth();
    const { userId, token } = clerkAuth;
    // During SSR only (the only time serverHttpClient exists),
    // set the Clerk auth token to make HTTP queries with.
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return {
      userId,
      token,
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });

  return (
    <ClerkProvider
      appearance={{
        // Match Clerk's prebuilt components to the shadcn theme by pointing
        // Clerk's variables at our shadcn CSS tokens (no @clerk/ui dependency).
        variables: {
          colorBackground: 'var(--card)',
          colorForeground: 'var(--card-foreground)',
          colorPrimary: 'var(--primary)',
          colorPrimaryForeground: 'var(--primary-foreground)',
          colorInput: 'var(--input)',
          colorMuted: 'var(--muted)',
          colorMutedForeground: 'var(--muted-foreground)',
          colorNeutral: 'var(--foreground)',
          colorDanger: 'var(--destructive)',
          colorBorder: 'var(--border)',
          borderRadius: 'var(--radius)',
        },
      }}
    >
      <ConvexProviderWithClerk client={context.convexClient} useAuth={useAuth}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link
        to={to}
        activeProps={{ className: 'bg-accent text-accent-foreground' }}
        activeOptions={{ exact: to === '/' }}
      >
        {label}
      </Link>
    </Button>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="border-b">
          <ContentContainer asChild>
            <nav className="flex items-center gap-1 py-3">
              <Link to="/" className="mr-3 text-base font-semibold">
                Start · Clerk · Convex
              </Link>
              <NavLink to="/" label="Home" />
              <NavLink to="/posts" label="Posts" />
              <Show when="signed-in">
                <NavLink to="/dashboard" label="Dashboard" />
              </Show>
              <div className="ml-auto">
                <Show when="signed-in">
                  <UserMenu />
                </Show>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <Button size="sm">Sign in</Button>
                  </SignInButton>
                </Show>
              </div>
            </nav>
          </ContentContainer>
        </header>
        <ContentContainer asChild>
          <main className="py-8">{children}</main>
        </ContentContainer>
        <Toaster />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
