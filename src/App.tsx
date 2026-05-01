/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import SOSInterface from './SOSInterface';
import StaffDashboard from './StaffDashboard';
import Login from './Login';
import { User } from './types';
import { LogOut } from 'lucide-react';
import { API_BASE_URL, ApiError, getErrorMessage, requestJson } from './api';

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
        
        // Log error for debugging
        console.log('[App] Error loading user:', error instanceof ApiError ? `${error.status} - ${error.message}` : error);
        
        // Only show error if it's not a 401 (Unauthorized - expected when not logged in)
        if (error instanceof ApiError && error.status === 401) {
          console.log('[App] User not logged in (401) - showing login page');
          return; // Expected - user just not logged in yet
        }
        
        // Show other errors
        const message = getErrorMessage(error, '');
        if (message) {
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

  useEffect(() => {
    if (!user || user.role !== 'USER') return;

    const socket = io(API_BASE_URL || undefined, { withCredentials: true });

    const handleRoomUpdate = (payload: { id: string; room?: string }) => {
      if (payload.id !== user.id) return;
      setUser((current) => (current ? { ...current, room: payload.room } : current));
    };

    socket.on('guest_room_updated', handleRoomUpdate);

    return () => {
      socket.off('guest_room_updated', handleRoomUpdate);
      socket.disconnect();
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await requestJson('/api/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setAppNotice('');
    } catch (error) {
      setAppNotice(getErrorMessage(error, 'Logout failed.'));
    }
  };

  // Clear notice when user successfully logs in
  useEffect(() => {
    if (user) {
      setAppNotice('');
    }
  }, [user]);

  // Auto-clear errors/notices after 6 seconds
  useEffect(() => {
    if (!appNotice) return;
    const timer = setTimeout(() => setAppNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [appNotice]);

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

  const isStaffView = ['ADMIN', 'STAFF'].includes(user.role?.toString().trim().toUpperCase());

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {appNotice ? (
        <div className="fixed left-1/2 top-3 z-50 w-[min(90vw,40rem)] -translate-x-1/2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
          {appNotice}
        </div>
      ) : null}

      {isStaffView ? (
        <StaffDashboard user={user} onLogout={handleLogout} />
      ) : (
        <>
          <div className="fixed right-4 top-3 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/10 bg-[#141417]/95 px-3 py-2 shadow-xl backdrop-blur sm:right-6">
            <div className="min-w-0 text-right">
              <span className="inline-flex rounded border border-red-600/30 bg-red-600/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                {user.role}
              </span>
              <div className="mt-1 truncate text-[10px] font-bold uppercase tracking-tight text-slate-500">
                {user.username} {user.room ? `• Room ${user.room}` : ''}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-full border border-white/10 bg-[#141417] p-2 text-slate-500 shadow-xl transition-all hover:border-red-600/50 hover:text-red-500"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
          <SOSInterface user={user} />
        </>
      )}
    </div>
  );
}
