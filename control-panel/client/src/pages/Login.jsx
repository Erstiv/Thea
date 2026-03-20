import { useState } from 'react';
import { Film } from 'lucide-react';
import { loginWithInvite } from '../lib/api.js';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Login() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState('main'); // 'main' | 'invite'
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginWithInvite(inviteCode, displayName, email);
      setUser(data.user);
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check for OAuth error in URL
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-thea-bg px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-thea-accent/5 via-transparent to-purple-900/5" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-thea-accent mx-auto flex items-center justify-center mb-4">
            <Film className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Thea</h1>
          <p className="text-thea-muted text-sm mt-1">Your media, your way</p>
        </div>

        {oauthError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 text-center">
            Sign-in failed. Please try again.
          </div>
        )}

        {mode === 'main' ? (
          <div className="space-y-3">
            {/* Google OAuth */}
            <a
              href="/auth/google"
              className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-white text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>

            {/* Plex OAuth */}
            <a
              href="/auth/plex"
              className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-[#e5a00d] text-black font-medium rounded-xl hover:bg-[#f0b020] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.643 0H4.68l7.679 12-7.679 12h6.963L19.32 12z"/>
              </svg>
              Continue with Plex
            </a>

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-thea-border" />
              <span className="text-xs text-thea-muted">or</span>
              <div className="flex-1 h-px bg-thea-border" />
            </div>

            {/* Invite code */}
            <button
              onClick={() => setMode('invite')}
              className="w-full py-3 px-4 bg-thea-card border border-thea-border text-thea-text font-medium rounded-xl hover:bg-thea-surface hover:border-thea-accent/30 transition-colors"
            >
              I have an invite code
            </button>
          </div>
        ) : (
          <form onSubmit={handleInviteSubmit} className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Invite code"
              required
              className="w-full py-3 px-4 bg-thea-card border border-thea-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-thea-accent/50 focus:border-thea-accent"
            />
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full py-3 px-4 bg-thea-card border border-thea-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-thea-accent/50 focus:border-thea-accent"
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full py-3 px-4 bg-thea-card border border-thea-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-thea-accent/50 focus:border-thea-accent"
            />

            {error && (
              <p className="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-thea-accent hover:bg-thea-accent-hover text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Join Thea'}
            </button>

            <button
              type="button"
              onClick={() => setMode('main')}
              className="w-full py-2 text-sm text-thea-muted hover:text-thea-text transition-colors"
            >
              Back to sign-in options
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
