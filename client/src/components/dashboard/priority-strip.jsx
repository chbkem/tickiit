import { badgeVariants } from '../ui';
import { cn } from '../../lib/utils';

const ITEMS = [
  { key: 'urgent', label: 'Urgent', variant: 'destructive' },
  { key: 'high', label: 'High', variant: 'warning' },
  { key: 'medium', label: 'Medium', variant: 'info' },
  { key: 'low', label: 'Low', variant: 'muted' },
];

const PriorityStrip = ({ counts, onSelect }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const count = counts?.[item.key] ?? 0;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item.key)}
            className={cn(
              badgeVariants.variant[item.variant],
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
          >
            {item.label}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 font-mono text-[10px] leading-none">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default PriorityStrip;