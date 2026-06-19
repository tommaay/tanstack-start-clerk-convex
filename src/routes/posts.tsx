import { useState } from 'react';
import { api } from 'convex/_generated/api';
import { convexQuery } from '@convex-dev/react-query';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useAction } from 'convex/react';
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
import { H1 } from '~/components/typography';

export const Route = createFileRoute('/posts')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      ...convexQuery(api.posts.list, {}),
      gcTime: 10000,
    });
  },
  component: PostsComponent,
});

function PostsComponent() {
  const { data: posts } = useSuspenseQuery(convexQuery(api.posts.list, {}));
  const populatePosts = useAction(api.posts.populate);
  const [isPopulating, setIsPopulating] = useState(false);

  async function handlePopulate() {
    setIsPopulating(true);
    try {
      await populatePosts();
      toast.success('Posts populated', {
        description: 'Sample posts were loaded into Convex.',
      });
    } catch {
      toast.error('Could not populate posts');
    } finally {
      setIsPopulating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <H1>Posts</H1>
        {posts.length === 0 && (
          <Button onClick={handlePopulate} disabled={isPopulating}>
            {isPopulating ? 'Populating…' : 'Populate posts'}
          </Button>
        )}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground">
            No posts yet. Use “Populate posts” to seed some from Convex.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle className="text-base">{post.title}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {post.body}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}
