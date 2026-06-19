import { Link } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import { H1, Muted } from '~/components/typography';

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <H1>404</H1>
      <Muted>We couldn’t find that page.</Muted>
      <Button asChild>
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
