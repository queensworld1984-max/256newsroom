import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Chat from './pages/Chat.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Resume from './pages/Resume.jsx';
import Contract from './pages/Contract.jsx';
import Logo from './pages/Logo.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import PesapalCallback from './pages/PesapalCallback.jsx';
import CodeDashboard from './pages/CodeDashboard.jsx';
import News from './pages/News.jsx';
import Capabilities from './pages/Capabilities.jsx';

const ADMIN_EMAIL = 'queensworld1984@gmail.com';

function Protected({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!user?.email || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Navigate to="/chat" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/news" element={<News />} />
          <Route path="/capabilities" element={<Capabilities />} />
          <Route path="/chat" element={<Protected><Chat /></Protected>} />
          <Route path="/resume" element={<Protected><Resume /></Protected>} />
          <Route path="/contract" element={<Protected><Contract /></Protected>} />
          <Route path="/logo" element={<Protected><Logo /></Protected>} />
          <Route path="/code" element={<Protected><CodeDashboard /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
          <Route path="/payment/callback" element={<PesapalCallback />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
