import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';

/**
 * Page-width container: owns max-width, horizontal centering, and side gutters
 * so pages don't repeat `mx-auto max-w-* px-4`. Use it for the page <main> and
 * the header <nav> so they share one width and stay aligned.
 *
 * Horizontal only by design — vertical spacing (`py-*`) belongs on the element,
 * since it varies per page. Pass `asChild` to render as the semantic element
 * (e.g. <main>/<nav>) instead of wrapping a <div>.
 */
const containerVariants = cva('mx-auto w-full px-4', {
  variants: {
    size: {
      sm: 'max-w-2xl', // forms, focused/reading content
      default: 'max-w-5xl', // standard pages
      lg: 'max-w-7xl', // wide dashboards / tables
      full: 'max-w-none', // full-bleed
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

function ContentContainer({
  className,
  size,
  asChild = false,
  ...props
}: ComponentProps<'div'> &
  VariantProps<typeof containerVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'div';

  return (
    <Comp className={cn(containerVariants({ size, className }))} {...props} />
  );
}

export { ContentContainer, containerVariants };
