import { cn } from '../../lib/utils';

const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 p-10 text-center', className)}>
      {icon && (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      {title && <p className="text-base font-semibold text-foreground">{title}</p>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
};

export default EmptyState;
