/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import SOSInterface from './SOSInterface';
import StaffDashboard from './StaffDashboard';
import Login from './Login';
import { User } from './types';
import { LogOut } from 'lucide-react';
import { getErrorMessage, requestJson } from './api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appNotice, setAppNotice] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      try {
        const data = await requestJson<User>('/api/me', { credentials: 'include' });
        if (isMounted) {
          setUser(data);
        }
      } catch (error) {
        if (!isMounted) return;
        const message = getErrorMessage(error, '');
        if (!message.toLowerCase().includes('401')) {
          setAppNotice(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await requestJson('/api/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setAppNotice('');
    } catch (error) {
      setAppNotice(getErrorMessage(error, 'Logout failed.'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} notice={appNotice} onNoticeClear={() => setAppNotice('')} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {appNotice ? (
        <div className="fixed left-1/2 top-3 z-50 w-[min(90vw,40rem)] -translate-x-1/2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
          {appNotice}
        </div>
      ) : null}
      <div className="fixed top-3 right-6 z-50 flex gap-3 items-center">
        <div className="flex flex-col items-end mr-2">
            <span className="text-[9px] font-black text-white px-2 py-0.5 bg-red-600/20 border border-red-600/30 rounded uppercase tracking-widest">{user.role}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{user.username} {user.room && `• Room ${user.room}`}</span>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 bg-[#141417] text-slate-500 border border-white/10 rounded-full hover:text-red-500 hover:border-red-600/50 transition-all shadow-xl"
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>

      {['ADMIN', 'STAFF'].includes(user.role?.toString().trim().toUpperCase()) ? <StaffDashboard user={user} /> : <SOSInterface user={user} />}
    </div>
  );
}

