import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Header from './components/Header.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Detail from './pages/Detail.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import Requests from './pages/Requests.jsx';
import Person from './pages/Person.jsx';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-thea-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-thea-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-thea-muted text-sm">Loading Thea...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-thea-bg">
      {user && <Header />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/movie/:id" element={<ProtectedRoute><Detail type="movie" /></ProtectedRoute>} />
        <Route path="/tv/:id" element={<ProtectedRoute><Detail type="tv" /></ProtectedRoute>} />
        <Route path="/person/:id" element={<ProtectedRoute><Person /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}
