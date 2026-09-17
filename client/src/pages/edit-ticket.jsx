import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { LuTrash2, LuArrowLeft } from 'react-icons/lu';
import { getTicketById } from '../actions/get-ticket-by-id';
import { Button } from '../components/ui';

const EditTicket = () => {
  const { id } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const token = await getToken();
        const data = await getTicketById(id, token);
        setTicket(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setCategory(data.category || '');
      } catch (err) {
        console.error('Failed to fetch ticket:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, [id, getToken]);

  const handleForm = (e) => {
    e.preventDefault();
    if (title && description && category) {
      navigate('/dashboard');
    }
  };

  const handleDelete = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>;
  }

  if (!ticket) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Ticket not found</div>;
  }

  return (
    <section>
      <Link to="/dashboard" className="fixed left-4 top-4 text-foreground transition-colors hover:text-primary">
        <LuArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <form className="w-full max-w-md space-y-4" onSubmit={handleForm}>
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
            <input
              type="text"
              id="title"
              placeholder="Title"
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
              placeholder="Category"
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
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              required
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button type="submit" onClick={handleForm}>Save</Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              <LuTrash2 className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default EditTicket;
