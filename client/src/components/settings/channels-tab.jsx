import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  LuBot,
  LuChevronDown,
  LuChevronRight,
  LuKey,
  LuMail,
  LuPlus,
  LuRefreshCw,
  LuSend,
  LuSettings,
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
  Modal,
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
    <LuBot className="h-4 w-4 text-muted-foreground" />
  );

// The bot's own status, from the server, not the manual pause. Kept separate
// because the two answer different questions: status is whether Telegram is
// working, isActive is whether this organization paused it.
const STATUS_VARIANTS = {
  ACTIVE: { variant: 'success', label: 'Active' },
  PENDING: { variant: 'info', label: 'Pending' },
  NEEDS_SETUP: { variant: 'warning', label: 'Needs setup' },
  ERROR: { variant: 'destructive', label: 'Error' },
};

const StatusBadge = ({ status }) => {
  const { variant, label } = STATUS_VARIANTS[status] ?? {
    variant: 'muted',
    label: 'Unknown',
  };
  return (
    <Badge variant={variant} className="text-[10px] font-mono uppercase">
      {label}
    </Badge>
  );
};

/**
 * BotFatherHelp — the one thing an admin needs to know about the token.
 *
 * Collapsed by default: an admin who already has a token should never have to
 * scroll past setup instructions, and the whole point of this feature is that
 * there is nothing to do in BotFather beyond copying the token.
 */
const BotFatherHelp = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:text-accent-foreground"
      >
        {open ? (
          <LuChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <LuChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <LuKey className="h-4 w-4 text-muted-foreground" />
        Where do I get the bot token?
      </button>
      {open && (
        <ol className="flex flex-col gap-1.5 border-t border-border px-3 py-2.5 pl-9 text-xs text-muted-foreground">
          <li>1. Message @BotFather on Telegram, or open t.me/BotFather.</li>
          <li>2. Send /newbot and give it a name and a username ending in bot.</li>
          <li>
            3. Copy the token it shows. It looks like <code>123456789:AA...</code> and is
            shown only once.
          </li>
          <li>
            4. Paste it here. There is no webhook step: this server points the bot at
            itself.
          </li>
        </ol>
      )}
    </div>
  );
};

const ChannelsTab = () => {
  const {
    channels,
    loading,
    error,
    refetch,
    addChannel,
    rotateToken,
    sendTest,
    editChannel,
    removeChannel,
  } = useChannels();

  const [type, setType] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [botToken, setBotToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // One modal drives all three row actions. `rotating` and `testing` hold the
  // channel it applies to, so a single set of inputs serves each.
  const [rotating, setRotating] = useState(null);
  const [testing, setTesting] = useState(null);
  const [rotateValue, setRotateValue] = useState('');
  const [testChatId, setTestChatId] = useState('');
  const [rowSubmitting, setRowSubmitting] = useState(false);

  const isTelegram = type === 'telegram';

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = isTelegram ? botToken.trim() : identifier.trim();
    if (!value) return;

    setSubmitting(true);
    try {
      if (isTelegram) {
        const channel = await addChannel({
          channel: toApiEnumValue(type),
          botToken: value,
        });
        toast.success(
          channel.reclaimedWebhook
            ? `${channel.displayName || channel.identifier} connected. It was pointed at another URL, which this deployment has taken over.`
            : `${channel.displayName || channel.identifier} connected and ready.`
        );
        setBotToken('');
      } else {
        await addChannel({ channel: toApiEnumValue(type), identifier: value });
        toast.success('Channel added.');
        setIdentifier('');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to add channel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotateSubmit = async (event) => {
    event.preventDefault();
    const value = rotateValue.trim();
    if (!value || !rotating) return;

    setRowSubmitting(true);
    try {
      const channel = await rotateToken(rotating.id, value);
      toast.success(
        channel.reclaimedWebhook
          ? 'Token replaced. This deployment took the bot over from another URL.'
          : 'Token replaced.'
      );
      setRotating(null);
      setRotateValue('');
    } catch (err) {
      toast.error(err.message || 'Failed to replace the token.');
    } finally {
      setRowSubmitting(false);
    }
  };

  const handleTestSubmit = async (event) => {
    event.preventDefault();
    const value = testChatId.trim();
    if (!value || !testing) return;

    setRowSubmitting(true);
    try {
      const result = await sendTest(testing.id, value);
      toast.success(
        result.sent
          ? `Message sent through ${testing.identifier}.`
          : 'Telegram accepted the request but reported no message id.'
      );
      setTesting(null);
      setTestChatId('');
    } catch (err) {
      toast.error(err.message || 'Failed to send the test message.');
    } finally {
      setRowSubmitting(false);
    }
  };

  const handleToggle = async (channel) => {
    try {
      await editChannel(channel.id, { isActive: !channel.isActive });
      toast.success(channel.isActive ? 'Channel paused.' : 'Channel resumed.');
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
          Inbound email addresses and Telegram bots that create tickets for this organization.
          Each endpoint maps to this organization only, and agent replies are sent back to the
          customer&apos;s channel, through the bot they wrote to.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-base">Add a channel</CardTitle>
          <CardDescription>
            Email uses the support address customers write to. Telegram uses your own bot: paste
            the token and this server does the rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
              {isTelegram ? (
                <Input
                  label="Bot token"
                  id="channel-bot-token"
                  type="password"
                  autoComplete="off"
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder="123456789:AA..."
                  className="flex-1"
                />
              ) : (
                <Input
                  label="Identifier"
                  id="channel-identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="support@example.com"
                  className="flex-1"
                />
              )}
              <Button type="submit" loading={submitting}>
                <LuPlus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {isTelegram && <BotFatherHelp />}
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
            description="Add an email address or a Telegram bot so customers can send tickets from those channels."
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
                  <TableHead className="w-[30%] pl-6">Channel</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[14%]">Token</TableHead>
                  <TableHead className="w-[14%]">State</TableHead>
                  <TableHead className="w-[12%]">Created</TableHead>
                  <TableHead className="pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="pl-6">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2">
                          {channelIcon(channel.channel)}
                          <span
                            className="truncate font-mono text-sm"
                            title={channel.identifier}
                          >
                            {channel.identifier}
                          </span>
                        </div>
                        {channel.displayName && (
                          <span className="truncate pl-6 text-xs text-muted-foreground">
                            {channel.displayName}
                          </span>
                        )}
                        {channel.status === 'ERROR' && channel.statusMessage && (
                          <span className="pl-6 text-xs text-destructive">
                            {channel.statusMessage}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {channel.channel === 'TELEGRAM' ? (
                        <StatusBadge status={channel.status} />
                      ) : (
                        <Badge variant="muted" className="text-[10px] font-mono uppercase">
                          n/a
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {channel.tokenMask || (channel.channel === 'TELEGRAM' ? 'not set' : 'n/a')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={channel.isActive ? 'success' : 'muted'}
                        className="text-[10px] font-mono uppercase"
                      >
                        {channel.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTicketDateTime(channel.createdAt)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center gap-1">
                        {channel.channel === 'TELEGRAM' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTesting(channel);
                              setTestChatId('');
                            }}
                            aria-label={`Send a test message through ${channel.identifier}`}
                            title="Send a test message"
                          >
                            <LuSend className="h-4 w-4" />
                          </Button>
                        )}
                        {channel.channel === 'TELEGRAM' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRotating(channel);
                              setRotateValue('');
                            }}
                            aria-label={`Replace the token for ${channel.identifier}`}
                            title="Replace the token"
                          >
                            <LuKey className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(channel)}
                        >
                          {channel.isActive ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(channel)}
                          aria-label={`Delete ${channel.identifier}`}
                          title="Delete"
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

      <Modal
        open={Boolean(rotating)}
        onClose={() => setRotating(null)}
        title="Replace the bot token"
        description={
          rotating
            ? `Paste a new token for ${rotating.identifier}. The bot keeps its tickets and its inbound URL.`
            : ''
        }
      >
        <form onSubmit={handleRotateSubmit} className="flex flex-col gap-3">
          <Input
            label="New bot token"
            id="rotate-bot-token"
            type="password"
            autoComplete="off"
            value={rotateValue}
            onChange={(event) => setRotateValue(event.target.value)}
            placeholder="123456789:AA..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRotating(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={rowSubmitting}>
              Replace token
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(testing)}
        onClose={() => setTesting(null)}
        title="Send a test message"
        description={
          testing
            ? `Sends one message through ${testing.identifier} so you can confirm the bot works.`
            : ''
        }
      >
        <form onSubmit={handleTestSubmit} className="flex flex-col gap-3">
          <Input
            label="Chat id"
            id="test-chat-id"
            value={testChatId}
            onChange={(event) => setTestChatId(event.target.value)}
            placeholder="123456789"
          />
          <p className="text-xs text-muted-foreground">
            The chat id is the number in the bot&apos;s Telegram URL, for example
            t.me/MySupportBot/123456789. Start a chat with the bot first, or Telegram will
            refuse the message.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTesting(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={rowSubmitting}>
              <LuSend className="h-4 w-4" />
              Send
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ChannelsTab;