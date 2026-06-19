import type { ComponentProps } from 'react';
import { cn } from '~/lib/utils';

/**
 * Page-level typography primitives, built on shadcn/ui's recommended classes.
 *
 * When to use these:
 * - Page headings and standalone prose (page titles, section headers, body copy).
 * - Inside a <Card>, prefer `CardTitle` / `CardDescription` instead.
 * - For form field labels, use the shadcn `label` component, not <Small>.
 *
 * Overflow is handled for you: every element includes `break-words`, so long
 * unbroken strings (URLs, IDs, tokens) wrap instead of overflowing the layout —
 * no need to add it per-usage. Headings also use `text-balance` and paragraphs
 * `text-pretty` for nicer line breaks. Caveat: inside a flex row, the flex item
 * may still need `min-w-0` for wrapping to kick in.
 *
 * All props pass through to the underlying element (id, onClick, aria-*, etc.),
 * and a `className` you pass overrides the defaults for conflicting utilities.
 */

/** Page title — one per page, the top-level heading. */
function H1({ className, ...props }: ComponentProps<'h1'>) {
  return (
    <h1
      className={cn(
        'scroll-m-20 text-4xl font-extrabold tracking-tight text-balance break-words',
        className,
      )}
      {...props}
    />
  );
}

/** Major section heading. Renders with a bottom border as a section divider. */
function H2({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn(
        'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight text-balance break-words first:mt-0',
        className,
      )}
      {...props}
    />
  );
}

/** Subsection heading within a section. */
function H3({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn(
        'scroll-m-20 text-2xl font-semibold tracking-tight text-balance break-words',
        className,
      )}
      {...props}
    />
  );
}

/** Body paragraph. Adds top margin when it follows another element. */
function P({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'leading-7 break-words text-pretty [&:not(:first-child)]:mt-6',
        className,
      )}
      {...props}
    />
  );
}

/** Intro / subtitle line, usually right under a page title. */
function Lead({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'text-xl text-muted-foreground break-words text-pretty',
        className,
      )}
      {...props}
    />
  );
}

/** De-emphasized secondary text — captions, hints, metadata. */
function Muted({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm text-muted-foreground break-words', className)}
      {...props}
    />
  );
}

/** Fine print / compact, slightly emphasized small text. */
function Small({ className, ...props }: ComponentProps<'small'>) {
  return (
    <small
      className={cn('text-sm leading-none font-medium break-words', className)}
      {...props}
    />
  );
}

export { H1, H2, H3, P, Lead, Muted, Small };
