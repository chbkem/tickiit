import { cn } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui';

const Bar = ({ className }) => (
  <div aria-hidden="true" className={cn('animate-pulse rounded bg-muted', className)} />
);

const ROWS = [0, 1, 2, 3, 4, 5];

export const TicketListSkeleton = ({ orgId = false }) => (
  <div className="w-full overflow-hidden px-2" aria-hidden="true">
    <Table className={orgId ? 'min-w-[960px] table-fixed' : 'min-w-[820px] table-fixed'}>
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="bg-background hover:bg-background">
          <TableHead className="w-10 pl-4"><Bar className="h-4 w-4" /></TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead>ID</TableHead>
          <TableHead>Subject</TableHead>
          {orgId && <TableHead>Requester</TableHead>}
          <TableHead>Assignee / Group</TableHead>
          <TableHead>Last activity</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row} className="hover:bg-background">
            <TableCell className="pl-4"><Bar className="h-4 w-4" /></TableCell>
            <TableCell><Bar className="h-5 w-16" /></TableCell>
            <TableCell><Bar className="h-4 w-20" /></TableCell>
            <TableCell><Bar className="h-4 w-full" /></TableCell>
            {orgId && <TableCell><Bar className="h-4 w-24" /></TableCell>}
            <TableCell><Bar className="h-4 w-28" /></TableCell>
            <TableCell><Bar className="h-4 w-24" /></TableCell>
            <TableCell><Bar className="h-7 w-7" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const DashboardSkeleton = () => (
  <div aria-hidden="true" className="w-full space-y-8">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ROWS.slice(0, 3).map((card) => (
        <div key={card} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <Bar className="h-4 w-24" />
          <Bar className="mt-4 h-8 w-16" />
          <Bar className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <Bar className="h-5 w-40" />
      <div className="mt-5 space-y-3">
        {ROWS.slice(0, 4).map((row) => (
          <Bar key={row} className="h-10 w-full" />
        ))}
      </div>
    </div>
  </div>
);

export const FormsSkeleton = () => (
  <div aria-hidden="true" className="grid gap-4 md:grid-cols-2">
    {ROWS.slice(0, 4).map((card) => (
      <div key={card} className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <Bar className="h-5 w-40" />
          <Bar className="h-5 w-16 rounded-full" />
        </div>
        <Bar className="mt-3 h-4 w-full" />
        <Bar className="mt-2 h-4 w-2/3" />
        <div className="mt-5 flex gap-2">
          <Bar className="h-9 flex-1" />
          <Bar className="h-9 w-9" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Bar className="h-8 w-16" />
          <Bar className="h-8 w-16" />
        </div>
      </div>
    ))}
  </div>
);

export const PublicFormSkeleton = () => (
  <div aria-hidden="true" className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
    <Bar className="h-4 w-24" />
    <Bar className="mt-3 h-7 w-56" />
    <Bar className="mt-3 h-4 w-full" />
    <div className="mt-6 space-y-5">
      {ROWS.slice(0, 4).map((field) => (
        <div key={field}>
          <Bar className="h-4 w-28" />
          <Bar className="mt-2 h-10 w-full" />
        </div>
      ))}
    </div>
    <Bar className="mt-6 h-10 w-full" />
  </div>
);

export const TicketFormSkeleton = () => (
  <div aria-hidden="true" className="w-full max-w-md space-y-4">
    <Bar className="h-4 w-16" />
    <Bar className="h-10 w-full" />
    <Bar className="h-4 w-20" />
    <Bar className="h-10 w-full" />
    <Bar className="h-4 w-24" />
    <Bar className="h-20 w-full" />
    <Bar className="h-10 w-full" />
  </div>
);
