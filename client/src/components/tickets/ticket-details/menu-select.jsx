import { Select as SelectPrimitive } from '@base-ui/react/select';
import { LuCheck } from 'react-icons/lu';
import { cn } from '../../../lib/utils';
import { chipClasses } from './constants';

const MenuSelect = ({ value, onChange, ariaLabel, disabled, saving, items, children }) => (
  <SelectPrimitive.Root
    value={value}
    onValueChange={(next) => onChange(next)}
    disabled={disabled}
    modal={false}
  >
    <SelectPrimitive.Trigger
      aria-label={ariaLabel}
      className={cn(
        chipClasses,
        'group outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[popup-open]:bg-muted/50 data-[disabled]:cursor-not-allowed',
        saving && 'opacity-70'
      )}
    >
      {children}
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={6} align="start" className="z-50">
        <SelectPrimitive.Popup className="min-w-[var(--anchor-width)] max-w-[280px] rounded-lg border border-border bg-popover p-1 shadow-lg outline-none transition-[opacity,transform] duration-100 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
          {items.map((item) => (
            <SelectPrimitive.Item
              key={item.value}
              value={item.value}
              label={item.label}
              className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors data-[highlighted]:bg-muted"
            >
              {item.dot ? (
                <span className={cn('h-2 w-2 shrink-0 rounded-full', item.dot)} />
              ) : item.icon ? (
                <span className="shrink-0">{item.icon}</span>
              ) : null}
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  !item.dot && !item.icon && 'pl-1'
                )}
              >
                {item.label}
              </span>
              <SelectPrimitive.ItemIndicator>
                <LuCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);

export default MenuSelect;
