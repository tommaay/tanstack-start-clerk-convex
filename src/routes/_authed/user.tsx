import { createFileRoute } from '@tanstack/react-router';
import { api } from 'convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

export const Route = createFileRoute('/_authed/user')({
  component: RouteComponent,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.user.profile, {}),
    );
  },
});

function RouteComponent() {
  const { data: profile } = useSuspenseQuery(convexQuery(api.user.profile, {}));

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your Convex-visible identity.</CardDescription>
      </CardHeader>
      <CardContent>
        {profile === null ? (
          <p className="text-muted-foreground">You are not logged in.</p>
        ) : (
          <p>
            Welcome! Your email address is{' '}
            <span className="font-medium">{profile.email}</span>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
