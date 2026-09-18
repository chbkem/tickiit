import Logo from '../logo';

const Footer = () => (
  <footer className="border-t border-border">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
      <div className="flex items-center gap-2">
        <Logo className="h-8 w-auto" />
        <span className="font-serif text-lg font-bold tracking-tight">tickiit</span>
      </div>
      <p className="font-mono text-xs text-muted-foreground">Open source · MIT license · Built in the open</p>
      <p className="font-mono text-xs text-muted-foreground">© {new Date().getFullYear()} tickiit</p>
    </div>
  </footer>
);

export default Footer;