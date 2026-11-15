import { format } from 'date-fns';

const useCreateDate = () => {
  return format(new Date(), 'dd MMM yy');
};

export default useCreateDate;