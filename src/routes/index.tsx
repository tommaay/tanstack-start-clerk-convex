import { Link, createFileRoute } from '@tanstack/react-router';
import { Show, SignInButton } from '@clerk/tanstack-react-start';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          TanStack Start + Clerk + Convex
        </CardTitle>
        <CardDescription>
          A starter wired with Clerk authentication, a reactive Convex backend,
          and shadcn/ui components.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button>Get started</Button>
          </SignInButton>
          <Button asChild variant="outline">
            <Link to="/posts">Browse posts</Link>
          </Button>
        </Show>
        <Show when="signed-in">
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/posts">Browse posts</Link>
          </Button>
        </Show>
      </CardContent>
    </Card>
  );
}
