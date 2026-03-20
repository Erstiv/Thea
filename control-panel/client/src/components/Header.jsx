import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Film, LayoutDashboard, LogOut, Menu, X, Bell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Film },
    { to: '/requests', label: 'My Requests', icon: Bell },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: LayoutDashboard }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-thea-bg via-thea-bg/95 to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-thea-accent flex items-center justify-center">
            <Film className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight hidden sm:block">Thea</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                location.pathname === to
                  ? 'bg-thea-accent/20 text-thea-accent'
                  : 'text-thea-muted hover:text-thea-text hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-thea-muted" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search movies & TV..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-thea-border rounded-xl text-sm text-thea-text placeholder:text-thea-muted focus:outline-none focus:ring-2 focus:ring-thea-accent/50 focus:border-thea-accent transition-all"
            />
          </div>
        </form>

        {/* User menu */}
        <div className="hidden md:flex items-center gap-3">
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
          )}
          <span className="text-sm text-thea-muted">{user?.displayName}</span>
          <button onClick={logout} className="p-2 rounded-lg text-thea-muted hover:text-thea-text hover:bg-white/5 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-thea-muted hover:text-thea-text"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-thea-surface border-t border-thea-border px-4 py-3 space-y-2">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-thea-muted hover:text-thea-text hover:bg-white/5"
            >
              <Icon className="w-4 h-4" /> {label}
            </Link>
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-thea-muted hover:text-red-400 hover:bg-white/5 w-full"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
