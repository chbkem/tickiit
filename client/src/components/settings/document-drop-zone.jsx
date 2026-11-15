import { useRef, useState } from 'react';
import { LuFileUp, LuUpload } from 'react-icons/lu';
import { Button, Spinner } from '../ui';
import { KB_ACCEPTED_EXTENSIONS, KB_MAX_UPLOAD_BYTES, KB_UPLOAD_ACCEPT } from '../../lib/constants';
import { formatFileSize } from '../../lib/format-file-size';
import { cn } from '../../lib/utils';

const DocumentDropZone = ({ onFile, uploading, error, className }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState(null);

  const accept = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!KB_ACCEPTED_EXTENSIONS.includes(extension)) {
      setLocalError(
        extension === file.name.toLowerCase()
          ? `"${file.name}" has no file extension. Upload a txt, md, pdf, or docx file.`
          : `".${extension}" is not supported. Upload a txt, md, pdf, or docx file.`
      );
      return;
    }
    if (file.size > KB_MAX_UPLOAD_BYTES) {
      setLocalError(
        `That file is larger than the ${formatFileSize(KB_MAX_UPLOAD_BYTES)} upload limit.`
      );
      return;
    }
    setLocalError(null);
    onFile(file);
  };

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) accept(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && !uploading) accept(file);
  };

  const message = localError || error?.message;

  return (
    <div className={className}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
          uploading && 'opacity-60'
        )}
      >
        {uploading ? (
          <>
            <Spinner />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Uploading and indexing</p>
              <p className="text-sm text-muted-foreground">
                Extracting the text, splitting it into chunks, and embedding each one. The first
                upload can take a while while the model loads.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LuFileUp className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Drop a document here</p>
              <p className="text-sm text-muted-foreground">
                One txt, md, pdf, or docx file at a time, up to{' '}
                {formatFileSize(KB_MAX_UPLOAD_BYTES)}. Scanned PDFs with no text layer are rejected.
              </p>
            </div>
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <LuUpload className="h-4 w-4" />
              Choose a file
            </Button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={KB_UPLOAD_ACCEPT}
        onChange={handleChange}
        className="hidden"
        aria-label="Knowledge base document"
      />
      {message && <p className="mt-2 text-xs text-destructive">{message}</p>}
    </div>
  );
};

export default DocumentDropZone;
