import { cn } from '../../../lib/utils';

const InfoItem = ({ label, className, children }) => (
  <div className={cn('flex items-center justify-between gap-4 py-2', className)}>
    <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
    <div className="flex min-w-0 items-center justify-end">{children}</div>
  </div>
);

export default InfoItem;