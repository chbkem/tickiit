import { format } from 'date-fns';

const useCreateDate = () => {
  return format(new Date(), 'dd/MM/yyyy');
};

export default useCreateDate;