import { cn } from '../../lib/utils';
import { buttonVariants } from '../ui/button';

export const Eyebrow = ({ children, className }) => (
  <p
    className={cn(
      'font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground',
      className
    )}
  >
    {children}
  </p>
);

export const MockAvatar = ({ initials, className }) => (
  <span
    className={cn(
      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white',
      className
    )}
  >
    {initials}
  </span>
);

export const MockChip = ({ dot, label }) => (
  <span className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground">
    <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />
    <span className="truncate font-medium">{label}</span>
  </span>
);

export const GitHubLink = ({ className, children, ...props }) => (
  <a
    className={cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      buttonVariants.variant.outline,
      buttonVariants.size.lg,
      className
    )}
    {...props}
  >
    {children}
  </a>
);