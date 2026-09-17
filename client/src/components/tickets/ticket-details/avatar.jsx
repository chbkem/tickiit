import { cn } from '../../../lib/utils';
import { colorFor, initialsFor } from './utils';

const Avatar = ({ name, className, fallback = '?' }) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
      colorFor(name),
      className
    )}
  >
    {initialsFor(name, fallback)}
  </span>
);

export default Avatar;