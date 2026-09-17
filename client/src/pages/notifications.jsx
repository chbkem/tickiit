import { EmptyState } from '../components/ui';
import { LuBell } from 'react-icons/lu';

const Notifications = () => {
  return (
    <div className="flex min-h-full items-center justify-center">
      <EmptyState
        icon={<LuBell className="h-6 w-6" />}
        title="Notifications"
        description="Updates about your tickets and team activity will appear here."
      />
    </div>
  );
};

export default Notifications;