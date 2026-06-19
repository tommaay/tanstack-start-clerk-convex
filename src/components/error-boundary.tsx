import { Link, useRouter } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import { H1, Muted } from '~/components/typography';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <H1>Something went wrong</H1>
      <Muted>{error.message}</Muted>
      <div className="flex gap-2">
        <Button onClick={() => router.invalidate()}>Try again</Button>
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
