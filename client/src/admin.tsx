import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import AdminPanel from './pages/AdminPanel';
import './index.css';

ReactDOM.createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminPanel />
  </StrictMode>
);
