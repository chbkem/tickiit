import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuMail, LuPlus, LuRefreshCw, LuSend, LuSettings, LuTrash2 } from 'react-icons/lu';
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
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';
import { useChannels } from '../../hooks/use-channels';
import { toApiEnumValue } from '../../lib/constants';
import { formatTicketDateTime } from '../../lib/format-date';

const CHANNEL_TYPE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
];

const channelIcon = (type) =>
  type === 'EMAIL' ? (
    <LuMail className="h-4 w-4 text-muted-foreground" />
  ) : (
    <LuSend className="h-4 w-4 text-muted-foreground" />
  );

const identifierPlaceholder = (type) =>
  type === 'email' ? 'support@example.com' : 'my_support_bot';

const ChannelsTab = () => {
  const { channels, loading, error, refetch, addChannel, editChannel, removeChannel } =
    useChannels();
  const [type, setType] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await addChannel({ channel: toApiEnumValue(type), identifier: trimmed });
      toast.success('Channel added.');
      setIdentifier('');
    } catch (err) {
      toast.error(err.message || 'Failed to add channel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (channel) => {
    try {
      await editChannel(channel.id, { isActive: !channel.isActive });
      toast.success(channel.isActive ? 'Channel deactivated.' : 'Channel activated.');
    } catch (err) {
      toast.error(err.message || 'Failed to update channel.');
    }
  };

  const handleDelete = async (channel) => {
    try {
      await removeChannel(channel.id);
      toast.success('Channel deleted.');
    } catch (err) {
      toast.error(err.message || 'Failed to delete channel.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-lg font-bold text-foreground">Channels</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inbound email addresses and Telegram bots that create tickets for this organization. Each
          endpoint maps to this organization only, and agent replies are sent back to the customer's
          channel.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-base">Add a channel</CardTitle>
          <CardDescription>
            Email uses the support address customers write to. Telegram uses the bot username.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label="Type"
              id="channel-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="sm:w-40"
            >
              {CHANNEL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Identifier"
              id="channel-identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={identifierPlaceholder(type)}
              className="flex-1"
            />
            <Button type="submit" loading={submitting}>
              <LuPlus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && channels.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : error && channels.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LuSettings className="h-6 w-6" />}
            title="Could not load channels"
            description={error.message || 'Something went wrong. Try again.'}
            action={
              <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : channels.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LuMail className="h-6 w-6" />}
            title="No channels yet"
            description="Add an email address or Telegram bot so customers can send tickets from those channels."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 border-b border-border py-4">
            <div>
              <CardTitle className="text-base">Channels</CardTitle>
              <CardDescription>
                {channels.length} {channels.length === 1 ? 'channel' : 'channels'} in this
                organization.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <LuRefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-background hover:bg-background">
                  <TableHead className="w-[34%] pl-6">Channel</TableHead>
                  <TableHead className="w-[18%]">Type</TableHead>
                  <TableHead className="w-[16%]">Status</TableHead>
                  <TableHead className="w-[16%]">Created</TableHead>
                  <TableHead className="pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="pl-6">
                      <div className="flex min-w-0 items-center gap-2">
                        {channelIcon(channel.channel)}
                        <span className="truncate font-mono text-sm" title={channel.identifier}>
                          {channel.identifier}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-mono uppercase">
                        {channel.channel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={channel.isActive ? 'success' : 'muted'}
                        className="text-[10px] font-mono uppercase"
                      >
                        {channel.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTicketDateTime(channel.createdAt)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(channel)}
                        >
                          {channel.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(channel)}
                          aria-label={`Delete ${channel.identifier}`}
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ChannelsTab;
