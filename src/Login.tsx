import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getErrorMessage, requestJson } from './api';
import { User } from './types';

interface LoginProps {
  onLogin: (user: User) => void;
  notice?: string;
  onNoticeClear?: () => void;
}

export default function Login({ onLogin, notice, onNoticeClear }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [room, setRoom] = useState('');
  const [isAdminSignup, setIsAdminSignup] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    onNoticeClear?.();

    if (!username || !password) {
      setError('Username and password are required. Please create an account first if you do not have one.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && !email) {
      setError('Please enter your email address to create an account.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && email && !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && isAdminSignup && !adminCode) {
      setError('Please enter the admin access code to create an admin account.');
      setIsLoading(false);
      return;
    }

    const endpoint = isLogin ? '/api/login' : '/api/signup';
    const body: Record<string, string | undefined> = { username: username.trim(), password };

    if (!isLogin) {
      body.email = email;
      body.room = room || undefined;
      if (isAdminSignup) {
        body.role = 'ADMIN';
        body.adminCode = adminCode;
      }
    }

    try {
      const user = await requestJson<User>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      onLogin(user);
    } catch (err) {
      setError(getErrorMessage(err, 'Connection error. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 text-slate-200">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#141417] border border-white/10 rounded-3xl p-10 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-red-600/10 border border-red-600/30 rounded-2xl flex items-center justify-center mb-6">
            <Shield className="text-red-600 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
            Crisis<span className="text-red-500">Connect</span>
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
            {isLogin ? 'Secure Authentication Node' : 'Guest Registration Node'}
          </p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-4 text-center px-4 leading-relaxed">
            Create your account first. Guest signup is supported, or login with staff/admin credentials when available.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {notice ? (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-center">
              {notice}
            </div>
          ) : null}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Username / Identifier</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all"
                placeholder="e.g. admin or john_doe"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>
          )}

          {!isLogin && !isAdminSignup && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Room Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all"
                  placeholder="e.g. 3-201"
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdminSignup(false)}
                  className={`px-4 py-2 rounded-full uppercase tracking-wide text-[10px] font-black transition ${isAdminSignup ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-red-600 text-white'}`}
                >
                  Guest Signup
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdminSignup(true)}
                  className={`px-4 py-2 rounded-full uppercase tracking-wide text-[10px] font-black transition ${isAdminSignup ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400 border border-white/10'}`}
                >
                  Admin Signup
                </button>
              </div>

              {isAdminSignup ? (
                <div className="space-y-4">
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-2">
                    Admin signup requires a valid access code. This creates an administrator account with full dashboard access.
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-2">
                    Default code in this app is <span className="text-white font-bold">CRISIS-ADMIN-2026</span> (case-insensitive).
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Access Code</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all"
                        placeholder="Enter admin access code"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Secure Passkey</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-600/10 border border-red-600/20 text-red-500 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-center"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl transition-all shadow-xl shadow-red-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <>
                <Key size={18} />
                {isLogin ? 'Login' : isAdminSignup ? 'Create Admin Account' : 'Create Guest Account'}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center px-4">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setAdminCode('');
              setIsAdminSignup(false);
              setEmail('');
              setRoom('');
            }}
            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors"
          >
            {isLogin ? 'Need an account? Sign up first' : 'Already registered? Login here'}
          </button>
        </div>

        <div className="mt-8 border-t border-white/5 pt-6 text-center">
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em] leading-relaxed px-4">
                Access to this terminal is restricted to authorized personnel and verified guests only. All attempts are monitored via AES-256 encrypted logic.
            </p>
        </div>
      </motion.div>
    </div>
  );
}
