import { cn } from '../../lib/utils';

const badgeVariants = {
  variant: {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'text-foreground',
    success: 'border-transparent bg-success text-success-foreground',
    warning: 'border-transparent bg-warning text-warning-foreground',
    info: 'border-transparent bg-info text-info-foreground',
    muted: 'border-transparent bg-muted text-muted-foreground',
  },
};

const Badge = ({ variant = 'default', className, ...props }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        badgeVariants.variant[variant],
        className
      )}
      {...props}
    />
  );
};

export default Badge;
export { badgeVariants };
