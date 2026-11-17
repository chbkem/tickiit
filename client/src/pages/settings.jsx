import { LuSettings } from 'react-icons/lu';
import { EmptyState } from '../components/ui';

const Settings = () => (
  <div className="flex min-h-full items-center justify-center">
    <EmptyState
      icon={<LuSettings className="h-6 w-6" />}
      title="Settings"
      description="Organization settings are not available right now."
    />
  </div>
);

export default Settings;
