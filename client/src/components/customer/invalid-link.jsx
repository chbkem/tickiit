import { LuLink2Off, LuMail } from 'react-icons/lu';
import { Card, CardContent } from '../ui';

const InvalidLink = () => (
  <Card className="mx-auto w-full max-w-lg">
    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <LuLink2Off className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">This link is no longer valid</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        It may have expired after seven days, or the support team may have revoked it for your
        safety. The ticket itself is still open with the team.
      </p>
      <p className="mt-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        <LuMail className="h-4 w-4 shrink-0" />
        Ask the support team for a fresh link by replying to your email thread.
      </p>
    </CardContent>
  </Card>
);

export default InvalidLink;
