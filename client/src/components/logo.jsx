import { cn } from '../lib/utils';

const Logo = ({ className, alt = 'tickiit', ...props }) => {
  return (
    <img
      src={`${process.env.PUBLIC_URL || ''}/logo.svg`}
      alt={alt}
      className={cn('block h-8 w-auto', className)}
      {...props}
    />
  );
};

export default Logo;