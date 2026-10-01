import toast from 'react-hot-toast';
import { LuFileText, LuFolderOpen, LuRefreshCw } from 'react-icons/lu';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui';
import { useKnowledgeArticles } from '../../hooks/use-knowledge-articles';
import { formatTicketDateTime } from '../../lib/format-date';
import { formatFileSize } from '../../lib/format-file-size';
import DocumentDropZone from './document-drop-zone';

const sourceBadgeVariant = {
  ARTICLE: 'secondary',
  FILE: 'info',
  URL: 'warning',
  VIDEO: 'muted',
};

const KnowledgeBaseTab = () => {
  const { articles, loading, error, refetch, uploadDocument, uploading, uploadError } =
    useKnowledgeArticles();

  const handleFile = async (file) => {
    const article = await uploadDocument(file);
    if (article) toast.success(`Added "${article.title}" to the knowledge base.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-lg font-bold text-foreground">Knowledge base</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI reads these documents when it triages tickets and drafts replies. Only admins can
          add or change them, and nothing here is visible to other organizations.
        </p>
      </div>

      <DocumentDropZone
        onFile={handleFile}
        uploading={uploading}
        error={uploadError}
        className="w-full"
      />

      {loading && articles.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : error && articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LuFolderOpen className="h-6 w-6" />}
            title="Could not load the knowledge base"
            description={error.message || 'Something went wrong. Try again.'}
            action={
              <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : articles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LuFolderOpen className="h-6 w-6" />}
            title="No documents yet"
            description="Upload an SOP, a runbook, or a policy document and the AI will start answering from it."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 border-b border-border py-4">
            <div>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>
                {articles.length} {articles.length === 1 ? 'document' : 'documents'} in this
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
                  <TableHead className="w-[44%] pl-6">Document</TableHead>
                  <TableHead className="w-[18%]">Source</TableHead>
                  <TableHead className="w-[14%]">Size</TableHead>
                  <TableHead className="pr-6">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell className="pl-6 whitespace-normal">
                      <div className="flex min-w-0 items-start gap-2">
                        <LuFileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" title={article.title}>
                            {article.title}
                          </p>
                          {article.fileName && (
                            <p
                              className="truncate font-mono text-xs text-muted-foreground"
                              title={article.fileName}
                            >
                              {article.fileName}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sourceBadgeVariant[article.source] || 'outline'}
                        className="text-[10px] font-mono uppercase"
                      >
                        {String(article.source ?? 'article').toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatFileSize(article.fileSize) || '—'}
                    </TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground">
                      {formatTicketDateTime(article.updatedAt || article.createdAt)}
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

export default KnowledgeBaseTab;
