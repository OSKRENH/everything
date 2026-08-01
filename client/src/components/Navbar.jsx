import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="navbar">
      <span className="navbar-brand">Кутно</span>
      <div className="navbar-links">
        <Link to="/inventory">Инвентарь</Link>
        <Link to="/recipes">Рецепты</Link>
        <span className="navbar-user">{user.email}</span>
        <button type="button" onClick={logout}>
          Выйти
        </button>
      </div>
    </nav>
  );
}
