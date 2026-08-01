import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="status-message">Загрузка…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
