import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

const TabsContext = createContext(null);
const TabsVariantContext = createContext('default');

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within <Tabs>');
  }
  return context;
};

function Tabs({
  value: controlledValue,
  onValueChange,
  defaultValue,
  orientation = 'horizontal',
  className,
  ...props
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const baseId = useId();

  const setValue = useCallback(
    (next) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange]
  );

  const contextValue = useMemo(
    () => ({ value, setValue, orientation, baseId }),
    [value, setValue, orientation, baseId]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          'group/tabs flex gap-2',
          orientation === 'horizontal' && 'flex-col',
          className
        )}
        {...props}
      />
    </TabsContext.Provider>
  );
}

function TabsList({ className, variant = 'default', ...props }) {
  const { orientation } = useTabsContext();
  const listRef = useRef(null);

  const handleKeyDown = (event) => {
    const tabs = Array.from(listRef.current?.querySelectorAll('[role="tab"]') ?? []);
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(document.activeElement);
    const isNext =
      orientation === 'vertical' ? event.key === 'ArrowDown' : event.key === 'ArrowRight';
    const isPrev =
      orientation === 'vertical' ? event.key === 'ArrowUp' : event.key === 'ArrowLeft';

    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else if (isNext) nextIndex = (currentIndex + 1) % tabs.length;
    else if (isPrev) nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else return;

    event.preventDefault();
    const next = tabs[nextIndex];
    next.focus();
    next.click();
  };

  return (
    <TabsVariantContext.Provider value={variant}>
      <div
        ref={listRef}
        role="tablist"
        aria-orientation={orientation}
        data-slot="tabs-list"
        data-variant={variant}
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground',
          variant === 'default' && 'bg-muted',
          variant === 'line' && 'gap-1 rounded-none bg-transparent',
          className
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

function TabsTrigger({ value, className, ...props }) {
  const { value: selectedValue, setValue, baseId } = useTabsContext();
  const variant = useContext(TabsVariantContext);
  const isActive = String(value) === String(selectedValue);
  const tabId = `${baseId}-tab-${String(value)}`;
  const panelId = `${baseId}-panel-${String(value)}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      data-slot="tabs-trigger"
      data-active={isActive || undefined}
      onClick={() => setValue(value)}
      className={cn(
        'relative inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        variant === 'default' &&
          cn(isActive && 'shadow-sm', isActive ? 'bg-background text-primary' : ''),
        variant === 'line' &&
          'after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:rounded-full after:bg-[var(--tabs-indicator-color,hsl(var(--primary)))] after:transition-opacity',
        variant === 'line' && (isActive ? 'after:opacity-100' : 'after:opacity-0'),
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ value, className, children, ...props }) {
  const { value: selectedValue, baseId } = useTabsContext();
  const isActive = String(value) === String(selectedValue);
  const tabId = `${baseId}-tab-${String(value)}`;
  const panelId = `${baseId}-panel-${String(value)}`;

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      data-slot="tabs-content"
      hidden={!isActive}
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };