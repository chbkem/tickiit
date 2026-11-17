import { LuAlertTriangle, LuRefreshCw } from 'react-icons/lu';
import { friendlyError } from '../../lib/error-message';
import { cn } from '../../lib/utils';
import Button from './button';
import EmptyState from './empty-state';
import Spinner from './spinner';

/**
 * One of four views for a data screen. Filtering stays in the caller so the
 * empty copy can tell no data apart from no filter match.
 */
const ViewState = ({
  state = 'ready',
  refreshing = false,
  skeleton = null,
  error = null,
  onRetry,
  empty = {},
  children,
  className,
}) => {
  if (state === 'loading') {
    return (
      <div role="status" className="h-full w-full">
        <span className="sr-only">Loading</span>
        {skeleton}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div role="alert" className="flex h-full w-full items-center justify-center p-6">
        <EmptyState
          icon={<LuAlertTriangle className="h-5 w-5 text-destructive" />}
          title="Could not load this view"
          description={friendlyError(error)}
          action={
            onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry} className="mt-4">
                <LuRefreshCw className="h-4 w-4" />
                Try again
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (state === 'empty') {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <EmptyState
          role="status"
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          action={empty.action}
        />
      </div>
    );
  }

  return (
    <div className={cn('relative h-full w-full', className)}>
      {refreshing && (
        <div
          role="status"
          className="absolute right-4 top-3 z-20 flex items-center gap-2 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm"
        >
          <Spinner className="h-3.5 w-3.5" />
          Refreshing
        </div>
      )}
      {children}
    </div>
  );
};

export default ViewState;
