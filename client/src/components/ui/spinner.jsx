import { cn } from '../../lib/utils';

const Spinner = ({ className, ...props }) => {
  return (
    <span
      className={cn(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-primary',
        className
      )}
      role="status"
      aria-label="Loading"
      {...props}
    />
  );
};

export default Spinner;
