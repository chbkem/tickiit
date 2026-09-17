import { EmptyState, Button } from '../components/ui';
import { UserButton } from '@clerk/react';
import { LuTicket } from 'react-icons/lu';

const AllTicket = () => {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-6 top-6">
        <UserButton />
      </div>
      <EmptyState
        icon={<LuTicket className="h-6 w-6" />}
        title="Welcome to your dashboard"
        description="Your support tickets will appear here once you create them. Manage, assign, and track everything from this view."
        action={
          <Button className="mt-4">Create ticket</Button>
        }
      />
    </div>
  );
};

export default AllTicket;