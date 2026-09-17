import { cn } from '../../lib/utils';

const Label = ({ className, children, ...props }) => {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    >
      {children}
    </label>
  );
};

export default Label;
