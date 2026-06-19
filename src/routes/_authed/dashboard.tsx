import { createFileRoute } from '@tanstack/react-router';
import { useUser } from '@clerk/tanstack-react-start';
import { api } from 'convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { H1, Muted } from '~/components/typography';

export const Route = createFileRoute('/_authed/dashboard')({
  component: Dashboard,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.user.profile, {}),
    );
  },
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

function Dashboard() {
  const { user } = useUser();
  const { data: profile } = useSuspenseQuery(convexQuery(api.user.profile, {}));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <H1>Dashboard</H1>
        <Muted>
          This page is protected — you only reach it while signed in.
        </Muted>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clerk session</CardTitle>
            <CardDescription>Read on the client via useUser().</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="Name" value={user?.fullName ?? '—'} />
            <Field
              label="Email"
              value={user?.primaryEmailAddress?.emailAddress ?? '—'}
            />
            <Field label="User ID" value={user?.id ?? '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convex identity</CardTitle>
            <CardDescription>
              Returned by the Convex query that reads the verified Clerk JWT —
              proof the auth token reaches the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {profile === null ? (
              <p className="text-sm text-muted-foreground">
                No identity on the Convex request.
              </p>
            ) : (
              <>
                <Field label="Email" value={profile.email ?? '—'} />
                <Field label="Subject" value={profile.subject} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>
            shadcn/ui Button + sonner toast wired up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => toast('Hello from sonner 👋')}
          >
            Show a toast
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
