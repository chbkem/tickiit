export const STATUS_DOT = {
  open: 'bg-info',
  'in-progress': 'bg-warning',
  'on-hold': 'bg-muted',
  resolved: 'bg-success',
  closed: 'bg-muted-foreground',
};

export const PRIORITY_DOT = {
  low: 'bg-muted-foreground',
  medium: 'bg-info',
  high: 'bg-warning',
  urgent: 'bg-destructive',
};

export const TYPE_DOT = {
  task: 'bg-secondary',
  request: 'bg-info',
  bug: 'bg-destructive',
  incident: 'bg-warning',
};

export const AVATAR_COLORS = ['bg-primary', 'bg-info', 'bg-secondary', 'bg-warning'];

export const chipClasses =
  'inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground';

export const chevronClass =
  'h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-data-[popup-open]:rotate-180';
