import { Card } from '../ui';
import { cn } from '../../lib/utils';

const StatCard = ({ icon: Icon, label, value, caption, accent, onClick }) => {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label}: ${value}`}
        className="flex w-full flex-col gap-1 p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-serif text-3xl font-bold text-foreground">{value}</p>
          </div>
          {Icon && (
            <span
              className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-full', accent)}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </button>
    </Card>
  );
};

export default StatCard;