import { cn } from '../../lib/utils';

const Spinner = ({ className, label = 'Loading', decorative = false, ...props }) => {
  const classes = cn(
    'inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-primary',
    className
  );

  if (decorative) {
    return <span aria-hidden="true" className={classes} {...props} />;
  }

  return (
    <span
      className={classes}
      role="status"
      aria-label={label}
      {...props}
    />
  );
};

export default Spinner;
