import { useAuth, useOrganization } from '@clerk/react';
import { LuBookOpen, LuSettings } from 'react-icons/lu';
import { EmptyState, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui';
import KnowledgeBaseTab from '../components/settings/knowledge-base-tab';

const Settings = () => {
  const { orgId, orgRole, isLoaded } = useAuth();
  const { organization } = useOrganization();

  const isAdmin = !!orgId && (orgRole === 'admin' || orgRole === 'org:admin' || orgRole === 'owner');

  if (!isLoaded) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <EmptyState
          icon={<LuSettings className="h-6 w-6" />}
          title="Settings"
          description={
            orgId
              ? 'Only organization admins can manage these settings.'
              : 'Select an active organization to manage its settings.'
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto px-6 py-8">
      <header>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuration for {organization?.name ?? 'your organization'}.
        </p>
      </header>

      <Tabs defaultValue="knowledge" className="flex-1">
        <TabsList
          variant="line"
          className="border-b border-border"
          style={{ '--tabs-indicator-color': 'hsl(var(--primary))' }}
        >
          <TabsTrigger value="knowledge" className="px-3 py-2">
            <LuBookOpen className="h-4 w-4" />
            Knowledge base
          </TabsTrigger>
        </TabsList>
        <TabsContent value="knowledge" className="p-0 pt-6">
          <KnowledgeBaseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
