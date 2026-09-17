import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/react';
import { LuArrowLeft } from 'react-icons/lu';
import { Link, useNavigate } from 'react-router-dom';
import { createTicket } from '../actions/create-ticket';
import { Button } from '../components/ui';

const CreateTicket = () => {
  const { getToken, userId } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = await getToken();
      await createTicket({ subject: title, description, type: category, assigneeId: userId }, token);
      toast.success('Ticket created successfully');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <Link to="/dashboard" className="fixed left-4 top-4 text-foreground transition-colors hover:text-primary">
        <LuArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Create a New Ticket</h1>
        <form onSubmit={handleCreateTicket} className="w-full max-w-md space-y-4">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              required
            />
          </div>
          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
            <input
              type="text"
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              required
            />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating...' : 'Create Ticket'}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default CreateTicket;
