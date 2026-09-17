import { Link } from 'react-router-dom';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';

const Sidebar = () => {
  return (
<div className='sidebar' style={{ width: '200px', background: '#f0f0f0', padding: '20px' , height: '100vh'}}>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li>
          <h3 className="logo">Ticket</h3>
        </li>
        <li>
          <Link to="/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link to="/create-ticket">Create Ticket</Link>
        </li>
        <li style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
          <Show when="signed-out">
            <SignInButton />
            <SignUpButton />
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
