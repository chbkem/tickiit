import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/react';
import {
  LuClipboardList,
  LuCopy,
  LuExternalLink,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Spinner,
} from '../components/ui';
import { createForm } from '../actions/create-form';
import { deleteForm } from '../actions/delete-form';
import { getAllForms } from '../actions/get-all-forms';
import { updateForm } from '../actions/update-form';
import { buildFormUrl } from '../lib/constants';
import { formatTicketDate } from '../lib/format-date';

const ADMIN_ROLES = new Set(['admin', 'org:admin']);

const formUrl = (form) => form.url || buildFormUrl(form.publicId);

const Forms = () => {
  const { getToken, orgId, orgRole, isLoaded } = useAuth();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const isAdmin = ADMIN_ROLES.has(orgRole);

  const loadForms = useCallback(async () => {
    if (!orgId || !isAdmin) {
      setForms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      setForms(await getAllForms(token));
    } catch (err) {
      setError(err.message || 'Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  }, [getToken, isAdmin, orgId]);

  useEffect(() => {
    if (isLoaded) loadForms();
  }, [isLoaded, loadForms]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      const created = await createForm(token);
      setForms((prev) => [created, ...prev]);
      const url = formUrl(created);
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Form created — link copied');
      } catch (_) {
        toast.success('Form created');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (form) => {
    try {
      await navigator.clipboard.writeText(formUrl(form));
      toast.success('Link copied');
    } catch (_) {
      toast.error('Could not copy the link. Select it manually.');
    }
  };

  const handleOpen = (form) => {
    window.open(formUrl(form), '_blank', 'noopener,noreferrer');
  };

  const handleRename = async (form) => {
    const nextName = window.prompt('Form name', form.name);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === form.name) return;
    setBusyId(form.id);
    try {
      const token = await getToken();
      const updated = await updateForm(token, form.id, { name: trimmed });
      setForms((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('Form renamed');
    } catch (err) {
      toast.error(err.message || 'Failed to rename form');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (form) => {
    setBusyId(form.id);
    try {
      const token = await getToken();
      const updated = await updateForm(token, form.id, { isActive: !form.isActive });
      setForms((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.isActive ? 'Form enabled' : 'Form disabled');
    } catch (err) {
      toast.error(err.message || 'Failed to update form');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (form) => {
    if (!window.confirm(`Delete "${form.name}"? Its public link will stop working.`)) return;
    setBusyId(form.id);
    try {
      const token = await getToken();
      await deleteForm(token, form.id);
      setForms((prev) => prev.filter((item) => item.id !== form.id));
      toast.success('Form deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete form');
    } finally {
      setBusyId(null);
    }
  };

  const renderBody = () => {
    if (!isLoaded) {
      return (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      );
    }

    if (!orgId) {
      return (
        <EmptyState
          icon={<LuClipboardList className="h-6 w-6" />}
          title="Select an organization"
          description="Ticket forms are shared per organization. Choose one with the organization switcher in the sidebar to create a form."
        />
      );
    }

    if (!isAdmin) {
      return (
        <EmptyState
          icon={<LuClipboardList className="h-6 w-6" />}
          title="Admins only"
          description="Only organization admins can create and manage ticket forms. Ask an admin to share the form link with you."
        />
      );
    }

    if (loading) {
      return (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={loadForms}>
            Try again
          </Button>
        </div>
      );
    }

    if (forms.length === 0) {
      return (
        <EmptyState
          icon={<LuClipboardList className="h-6 w-6" />}
          title="No forms yet"
          description="Create a form, copy its link, and share it with your customers. Every submission becomes a ticket in this dashboard."
          action={
            <Button className="mt-4" onClick={handleCreate} loading={creating}>
              <LuPlus className="h-4 w-4" />
              Create form
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {forms.map((form) => {
          const busy = busyId === form.id;
          const url = formUrl(form);
          return (
            <Card key={form.id} className={form.isActive ? '' : 'opacity-70'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{form.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {form.description || 'Share this link with your customers to collect tickets.'}
                    </CardDescription>
                  </div>
                  <Badge variant={form.isActive ? 'success' : 'muted'}>
                    {form.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Shareable link</span>
                  <div className="flex gap-2">
                    <Input
                      id={`form-link-${form.id}`}
                      readOnly
                      value={url}
                      onFocus={(event) => event.target.select()}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(form)}
                      aria-label="Copy form link"
                    >
                      <LuCopy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Created {formatTicketDate(form.createdAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRename(form)}
                      disabled={busy}
                      aria-label={`Rename ${form.name}`}
                    >
                      <LuPencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpen(form)}
                      disabled={!form.isActive}
                    >
                      <LuExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(form)}
                      loading={busy}
                    >
                      {form.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(form)}
                      disabled={busy}
                      aria-label={`Delete ${form.name}`}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <LuTrash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ticket forms</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a shareable form, send the link to your customers, and their submissions
              appear as tickets here.
            </p>
          </div>
          {orgId && isAdmin && forms.length > 0 && (
            <Button onClick={handleCreate} loading={creating}>
              <LuPlus className="h-4 w-4" />
              Create form
            </Button>
          )}
        </div>

        {renderBody()}
      </div>
    </div>
  );
};

export default Forms;
