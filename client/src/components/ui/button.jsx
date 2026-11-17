import { useId } from 'react';
import { cn } from '../../lib/utils';
import Spinner from './spinner';

const buttonVariants = {
  variant: {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-border bg-background hover:bg-muted hover:text-accent-foreground',
    ghost: 'hover:bg-muted hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10',
  },
};

const Button = ({
  variant = 'default',
  size = 'default',
  className,
  type = 'button',
  loading = false,
  disabled,
  children,
  ...props
}) => {
  const labelId = useId();

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      aria-labelledby={loading ? labelId : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        buttonVariants.variant[variant],
        buttonVariants.size[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="h-4 w-4" />
          <span id={labelId} className="sr-only">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
export { buttonVariants };
