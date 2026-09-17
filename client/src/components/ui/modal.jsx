import { useEffect } from 'react';
import { LuX } from 'react-icons/lu';
import { cn } from '../../lib/utils';
import Button from './button';

const Modal = ({
  open = false,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md',
}) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
<div
          className={cn(
            'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg',
            sizes[size],
            className
          )}
        >
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              {title && <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
export { Button as ModalClose };
