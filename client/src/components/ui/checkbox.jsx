import { cn } from '../../lib/utils';

const Checkbox = ({ className, label, id, ...props }) => {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-border bg-background text-primary accent-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
      {label && (
        <span className="text-sm text-foreground">{label}</span>
      )}
    </label>
  );
};

export default Checkbox;
