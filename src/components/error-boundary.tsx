/**
 * Default error boundary for route errors (`defaultErrorComponent`).
 *
 * Shows a generic message to users. The raw error is rendered only in
 * development so internals do not leak in production. The error is always
 * logged to the browser console for debugging.
 */
import type { ErrorComponentProps } from '@tanstack/react-router';
import { ErrorComponent, Link, useRouter } from '@tanstack/react-router';
import { H1, Muted } from '~/components/typography';
import { Button } from '~/components/ui/button';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  // biome-ignore lint/suspicious/noConsole: error boundary runs in the browser; the server logger is Node-only
  console.error('DefaultCatchBoundary Error:', error);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <H1>Something went wrong</H1>
      <Muted>Please try again. If the problem continues, go back home.</Muted>
      {import.meta.env.DEV ? (
        <div className="max-w-2xl text-left">
          <ErrorComponent error={error} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={() => router.invalidate()}>Try again</Button>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
