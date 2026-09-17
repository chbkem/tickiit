import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Show, RedirectToSignIn } from '@clerk/react'
import Landing from './pages/landing';
import AllTicket from './pages/all-ticket';
import CreateTicket from './pages/create-ticket';
import EditTicket from './pages/edit-ticket';
import Tickets from './pages/tickets';
import Notifications from './pages/notifications';
import Settings from './pages/settings';
import DashboardShell from './components/dashboard/dashboard-shell';

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Landing />} />
          <Route path='/dashboard' element={
            <Show when="signed-in">
              <DashboardShell />
            </Show>
          }>
            <Route index element={<AllTicket />} />
            <Route path='create-ticket' element={<CreateTicket />} />
            <Route path='edit-ticket/:id' element={<EditTicket />} />
            <Route path='tickets' element={<Tickets />} />
            <Route path='notifications' element={<Notifications />} />
            <Route path='settings' element={<Settings />} />
          </Route>
          <Route path='*' element={<Show when="signed-out"><RedirectToSignIn /></Show>} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
