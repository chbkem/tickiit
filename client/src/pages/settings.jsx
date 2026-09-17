import { EmptyState } from '../components/ui';
import { LuSettings } from 'react-icons/lu';

const Settings = () => {
  return (
    <div className="flex min-h-full items-center justify-center">
      <EmptyState
        icon={<LuSettings className="h-6 w-6" />}
        title="Settings"
        description="Manage your organization preferences here."
      />
    </div>
  );
};

export default Settings;