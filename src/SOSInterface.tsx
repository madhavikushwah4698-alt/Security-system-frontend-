import React, { useState } from 'react';
import { Flame, Activity, ShieldAlert, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertType, User } from './types';
import { getErrorMessage, requestJson } from './api';

interface SOSInterfaceProps {
  readonly user: User;
}

export default function SOSInterface({ user }: SOSInterfaceProps) {
  const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSOS = async (type: AlertType) => {
    setStatus('SENDING');
    setError('');
    
    const payload = {
      type,
      guestMessage: message,
      language: "Auto-detect"
    };

    try {
      await requestJson('/api/sos', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setStatus('SENT');
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to send alert right now.'));
      setStatus('IDLE');
    }
  };

  if (status === 'SENT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0A0B] p-6 text-center text-slate-200">
        <motion.div
           initial={{ scale: 0 }}
           animate={{ scale: 1 }}
           className="w-24 h-24 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center mb-6"
        >
          <CheckCircle className="text-green-500 w-16 h-16" />
        </motion.div>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tight mb-4">Alert Received</h1>
        <p className="text-lg text-slate-400 max-w-md">Staff and emergency responders have been notified. Please remain calm. Help is on the way to <span className="text-white font-bold">Room {user.room || 'Your Location'}</span>.</p>
        <button 
          onClick={() => setStatus('IDLE')}
          className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold uppercase tracking-widest text-xs transition-colors"
        >
          Send Another Update
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] p-6 text-slate-200 font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
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
          className="w-full aspect-video bg-red-600/10 border border-red-600/30 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-red-500 active:scale-95 transition-all hover:bg-red-600/20"
        >
          <Flame size={64} className="mb-2" />
          <span className="text-2xl font-black uppercase tracking-widest">Fire Emergency</span>
        </button>

        <button
          disabled={status === 'SENDING'}
          onClick={() => handleSOS('MEDICAL')}
          className="w-full aspect-video bg-blue-600/10 border border-blue-600/30 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-blue-500 active:scale-95 transition-all hover:bg-blue-600/20"
        >
          <Activity size={64} className="mb-2" />
          <span className="text-2xl font-black uppercase tracking-widest">Medical Help</span>
        </button>

        <button
          disabled={status === 'SENDING'}
          onClick={() => handleSOS('SECURITY')}
          className="w-full aspect-video bg-slate-800/40 border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center text-white active:scale-95 transition-all hover:bg-slate-800/60"
        >
          <ShieldAlert size={64} className="mb-2" />
          <span className="text-2xl font-black uppercase tracking-widest">Security Alert</span>
        </button>
      </div>

      <div className="mt-10 bg-[#141417] border border-white/10 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
          <span>Additional Details (Optional)</span>
        </div>
        
        <div className="relative">
          <textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            placeholder="Type message in your language..."
            className="w-full h-24 p-3 bg-black/40 rounded-xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-red-600 text-slate-200 placeholder:text-slate-600"
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
            className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-10"
          >
            <div className="bg-white p-8 rounded-3xl text-center shadow-2xl w-full max-w-sm">
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
