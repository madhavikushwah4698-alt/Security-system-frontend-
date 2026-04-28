import React, { useState, useEffect } from 'react';
import { Flame, Activity, ShieldAlert, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { AlertType, User, EmergencyAlert } from './types';
import { getErrorMessage, requestJson, API_BASE_URL } from './api';

interface SOSInterfaceProps {
  readonly user: User;
}

interface AlertUpdate {
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVING' | 'RESOLVED';
  message?: string;
  time?: string;
}

export default function SOSInterface({ user }: SOSInterfaceProps) {
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [alertId, setAlertId] = useState<string | null>(null);
  const [alertStatus, setAlertStatus] = useState<AlertUpdate | null>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [alertRoom, setAlertRoom] = useState<string | null>(user.room || null);

  // Setup Socket.IO for real-time updates
  useEffect(() => {
    if (!alertId) return;

    const socket = io(API_BASE_URL || undefined, { withCredentials: true });

    const handleAlertUpdate = (updatedAlert: EmergencyAlert) => {
      if (updatedAlert.id === alertId) {
        setAlertStatus({
          status: updatedAlert.status,
          message: `Alert status: ${updatedAlert.status}`,
          time: new Date().toLocaleTimeString(),
        });
        setUpdates(updatedAlert.updates || []);
      }
    };

    socket.on('alert_updated', handleAlertUpdate);

    return () => {
      socket.off('alert_updated', handleAlertUpdate);
      socket.disconnect();
    };
  }, [alertId]);

  // Load guest's active alert on mount (for re-login scenario)
  useEffect(() => {
    const loadGuestAlert = async () => {
      try {
        const alerts = await requestJson<EmergencyAlert[]>('/api/sos', { 
          credentials: 'include' 
        });
        
        // Find the guest's active alert (not resolved)
        if (Array.isArray(alerts) && alerts.length > 0) {
          const activeAlert = alerts.find(a => a.userId === user.id && a.status !== 'RESOLVED');
          if (activeAlert) {
            setAlertId(activeAlert.id);
            setAlertRoom(activeAlert.room || user.room || null);
            setAlertStatus({
              status: activeAlert.status,
              message: `Alert status: ${activeAlert.status}`,
              time: new Date().toLocaleTimeString(),
            });
            setUpdates(activeAlert.updates || []);
            setStatus('SENT');
          }
        }
      } catch (error) {
        console.error('Failed to load guest alert:', error);
      }
    };

    if (user.role === 'USER' && !alertId) {
      loadGuestAlert();
    }
  }, [user.id, user.role, alertId]);

  const handleSOS = async (type: AlertType) => {
    setStatus('SENDING');
    setError('');
    
    const payload = {
      type,
      guestMessage: message,
      language: "Auto-detect"
    };

    try {
      const response = await requestJson<EmergencyAlert>('/api/sos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setAlertId(response.id);
      setAlertRoom(response.room || user.room || null);
      setAlertStatus({
        status: 'PENDING',
        message: 'Alert sent to staff',
        time: new Date().toLocaleTimeString(),
      });
      setStatus('SENT');
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to send alert right now.'));
      setStatus('IDLE');
    }
  };

  if (status === 'SENT') {
    const statusConfig = {
      PENDING: { color: 'text-yellow-500', bg: 'bg-yellow-500/20', border: 'border-yellow-500', icon: Clock, message: 'Waiting for staff response...' },
      ACKNOWLEDGED: { color: 'text-blue-500', bg: 'bg-blue-500/20', border: 'border-blue-500', icon: AlertCircle, message: 'Staff has acknowledged your alert!' },
      RESOLVING: { color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500', icon: Activity, message: 'Staff is actively responding...' },
      RESOLVED: { color: 'text-green-500', bg: 'bg-green-500/20', border: 'border-green-500', icon: CheckCircle, message: 'Alert resolved. Thank you for your patience.' },
    };

    const currentConfig = statusConfig[alertStatus?.status || 'PENDING'];
    const CurrentIcon = currentConfig.icon;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] p-4 text-center text-slate-200 sm:p-6">
        <motion.div
          key={alertStatus?.status}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 ${currentConfig.bg} ${currentConfig.border} sm:h-24 sm:w-24`}
        >
          <CurrentIcon className={`${currentConfig.color} h-12 w-12 sm:h-16 sm:w-16`} />
        </motion.div>
        
        <h1 className="mb-2 text-2xl font-black uppercase italic tracking-tight text-white sm:text-3xl">
          {alertStatus?.status === 'PENDING' && 'Alert Sent'}
          {alertStatus?.status === 'ACKNOWLEDGED' && 'Alert Acknowledged'}
          {alertStatus?.status === 'RESOLVING' && 'Being Handled'}
          {alertStatus?.status === 'RESOLVED' && 'Resolved'}
        </h1>
        
        <p className={`mb-4 text-base ${currentConfig.color} sm:text-lg`}>{currentConfig.message}</p>
        
        <p className="text-slate-400 max-w-md mb-6">
          Help has been dispatched to <span className="text-white font-bold">Room {alertRoom || user.room || 'Your Location'}</span>.
        </p>

        {/* Show staff updates */}
        {updates.length > 0 && (
          <div className="mb-6 w-full max-w-md rounded-2xl border border-white/10 bg-[#141417] p-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Staff Updates</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {updates.map((update, idx) => (
                <div key={idx} className="text-xs text-slate-300 bg-black/20 p-2 rounded-lg">
                  <div className="text-[10px] text-slate-500 mb-1">{update.staffName || 'Staff'} • {new Date(update.time).toLocaleTimeString()}</div>
                  <div>{update.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {alertStatus?.status !== 'RESOLVED' && (
          <button 
            onClick={() => {
              setStatus('IDLE');
              setMessage('');
              setAlertId(null);
              setAlertStatus(null);
              setAlertRoom(user.room || null);
              setUpdates([]);
            }}
            className="w-full rounded-full bg-white/10 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/20 sm:w-auto sm:px-8"
          >
            Send Another Alert
          </button>
        )}

        {alertStatus?.status === 'RESOLVED' && (
          <button 
            onClick={() => {
              setStatus('IDLE');
              setMessage('');
              setAlertId(null);
              setAlertStatus(null);
              setAlertRoom(user.room || null);
              setUpdates([]);
            }}
            className="w-full rounded-full bg-green-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-green-700 sm:w-auto sm:px-8"
          >
            Return to Main Menu
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0B] p-4 font-sans text-slate-200 sm:p-6">
      <header className="mb-8 text-center sm:mb-10">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white sm:text-3xl">
          Crisis<span className="text-red-600">Connect</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Emergency Guest Interface</p>
      </header>

      <div className="flex-1 space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-600/20 bg-red-600/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.25em] text-red-200">
            {error}
          </div>
        ) : null}
        <button
          disabled={status === 'SENDING'}
          onClick={() => handleSOS('FIRE')}
          className="flex aspect-[1.15/1] w-full flex-col items-center justify-center rounded-3xl border border-red-600/30 bg-red-600/10 text-red-500 shadow-2xl transition-all hover:bg-red-600/20 active:scale-95 sm:aspect-video"
        >
          <Flame size={52} className="mb-2 sm:h-16 sm:w-16" />
          <span className="text-center text-xl font-black uppercase tracking-widest sm:text-2xl">Fire Emergency</span>
        </button>

        <button
          disabled={status === 'SENDING'}
          onClick={() => handleSOS('MEDICAL')}
          className="flex aspect-[1.15/1] w-full flex-col items-center justify-center rounded-3xl border border-blue-600/30 bg-blue-600/10 text-blue-500 shadow-2xl transition-all hover:bg-blue-600/20 active:scale-95 sm:aspect-video"
        >
          <Activity size={52} className="mb-2 sm:h-16 sm:w-16" />
          <span className="text-center text-xl font-black uppercase tracking-widest sm:text-2xl">Medical Help</span>
        </button>

        <button
          disabled={status === 'SENDING'}
          onClick={() => handleSOS('SECURITY')}
          className="flex aspect-[1.15/1] w-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-800/40 text-white shadow-2xl transition-all hover:bg-slate-800/60 active:scale-95 sm:aspect-video"
        >
          <ShieldAlert size={52} className="mb-2 sm:h-16 sm:w-16" />
          <span className="text-center text-xl font-black uppercase tracking-widest sm:text-2xl">Security Alert</span>
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-[#141417] p-4 shadow-sm sm:mt-10">
        <div className="flex items-center gap-2 mb-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
          <span>Additional Details (Optional)</span>
        </div>
        
        <div className="relative">
          <textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            placeholder="Type message in your language..."
            className="h-24 w-full rounded-xl border border-white/5 bg-black/40 p-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-600"
          ></textarea>
          
          <div className="absolute right-2 bottom-2 flex gap-2">
            {/* Mic recording feature removed for MVP */}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">
        Connected to Venue Network: CrisisConnect
      </footer>

      <AnimatePresence>
        {status === 'SENDING' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/40 px-4 backdrop-blur-sm sm:px-10"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8">
                <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-bold text-slate-900">Broadcasting SOS...</h3>
                <p className="text-slate-500 mt-2">Connecting to Staff and Local Channels</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
