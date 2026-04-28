import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Clock,
  Database,
  History,
  Languages,
  LogOut,
  MapPin,
  Send,
  ShieldCheck,
  Siren,
  UserPlus,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuditLog, EmergencyAlert, User } from './types';
import { API_BASE_URL, getErrorMessage, requestJson } from './api';

interface StaffDashboardProps {
  user: User;
  onLogout: () => void;
}

type DashboardTab = 'ALERTS' | 'GUESTS' | 'USERS' | 'AUDIT';

type StaffLogEntry = {
  id: string;
  msg: string;
  time: string;
};

type GuestLoginEntry = {
  id: string;
  username: string;
  email?: string;
  room?: string;
  timestamp: string;
};

type PersonnelCreateResponse = User & {
  tempPassword?: string;
};

type AuditLogTone = {
  badge: string;
  card: string;
  accent: string;
};

function normalizeAlert(alert: EmergencyAlert): EmergencyAlert {
  return {
    ...alert,
    room: alert.room || 'Unknown',
    floor: alert.floor || 'Unknown',
    guestCount: alert.guestCount ?? 1,
    updates: Array.isArray(alert.updates) ? alert.updates : [],
    guestInfo: alert.guestInfo || {},
  };
}

function mergeAlertList(current: EmergencyAlert[], nextAlert: EmergencyAlert) {
  const normalized = normalizeAlert(nextAlert);
  const exists = current.some((alert) => alert.id === normalized.id);
  return exists
    ? current.map((alert) => (alert.id === normalized.id ? normalized : alert))
    : [normalized, ...current];
}

function upsertUser(current: User[], nextUser: User) {
  const exists = current.some((user) => user.id === nextUser.id);
  return exists
    ? current.map((user) => (user.id === nextUser.id ? { ...user, ...nextUser } : user))
    : [nextUser, ...current];
}

function alertProtocol(type: EmergencyAlert['type']) {
  const protocolMap: Record<EmergencyAlert['type'], string[]> = {
    FIRE: [
      'Activate the alarm and verify guest evacuation routes.',
      'Keep elevators blocked and use stairwell coordination only.',
      'Meet emergency responders at the main entrance.',
    ],
    MEDICAL: [
      'Dispatch medical support and confirm room access.',
      'Keep corridors clear for stretcher movement.',
      'Track guest condition updates until resolved.',
    ],
    SECURITY: [
      'Lock down the area and separate guests from the threat.',
      'Preserve witness details and relevant evidence.',
      'Escalate to authorities if the incident widens.',
    ],
  };

  return protocolMap[type] || [];
}

function getAuditLogTone(log: AuditLog): AuditLogTone {
  const action = log.action.toUpperCase();
  const details = log.details.toUpperCase();

  if (action.startsWith('SOS_')) {
    if (action.includes('FIRE')) {
      return {
        badge: 'border-red-500/30 bg-red-500/15 text-red-300',
        card: 'border-red-500/15 bg-red-500/8',
        accent: 'bg-red-500/40',
      };
    }

    if (action.includes('MEDICAL')) {
      return {
        badge: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
        card: 'border-cyan-500/15 bg-cyan-500/8',
        accent: 'bg-cyan-500/40',
      };
    }

    return {
      badge: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
      card: 'border-amber-500/15 bg-amber-500/8',
      accent: 'bg-amber-500/40',
    };
  }

  if (action === 'ALERT_STATUS_UPDATED') {
    if (details.includes('RESOLVED')) {
      return {
        badge: 'border-green-500/30 bg-green-500/15 text-green-300',
        card: 'border-green-500/15 bg-green-500/8',
        accent: 'bg-green-500/40',
      };
    }

    if (details.includes('RESOLVING')) {
      return {
        badge: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
        card: 'border-orange-500/15 bg-orange-500/8',
        accent: 'bg-orange-500/40',
      };
    }

    if (details.includes('ACKNOWLEDGED')) {
      return {
        badge: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
        card: 'border-blue-500/15 bg-blue-500/8',
        accent: 'bg-blue-500/40',
      };
    }

    return {
      badge: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300',
      card: 'border-yellow-500/15 bg-yellow-500/8',
      accent: 'bg-yellow-500/40',
    };
  }

  if (action === 'GUEST_ROOM_UPDATED') {
    return {
      badge: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300',
      card: 'border-indigo-500/15 bg-indigo-500/8',
      accent: 'bg-indigo-500/40',
    };
  }

  if (action === 'USER_CREATED') {
    return {
      badge: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
      card: 'border-violet-500/15 bg-violet-500/8',
      accent: 'bg-violet-500/40',
    };
  }

  if (action === 'REGISTER') {
    return {
      badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
      card: 'border-emerald-500/15 bg-emerald-500/8',
      accent: 'bg-emerald-500/40',
    };
  }

  if (action === 'LOGIN') {
    return {
      badge: 'border-white/10 bg-white/5 text-slate-300',
      card: 'border-white/5 bg-black/30',
      accent: 'bg-white/20',
    };
  }

  return {
    badge: 'border-white/10 bg-white/5 text-slate-300',
    card: 'border-white/5 bg-black/30',
    accent: 'bg-white/20',
  };
}

export default function StaffDashboard({ user, onLogout }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('ALERTS');
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null);
  const [staffLog, setStaffLog] = useState<StaffLogEntry[]>([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [guests, setGuests] = useState<User[]>([]);
  const [guestLogins, setGuestLogins] = useState<GuestLoginEntry[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [newUserData, setNewUserData] = useState({ username: '', email: '', role: 'STAFF' as const });
  const [guestRoomDrafts, setGuestRoomDrafts] = useState<Record<string, string>>({});
  const [savingRoom, setSavingRoom] = useState<Record<string, boolean>>({});
  const [provisionedPassword, setProvisionedPassword] = useState('');

  useEffect(() => {
    let isMounted = true;
    const socket = io(API_BASE_URL || undefined, { withCredentials: true });

    const loadDashboard = async () => {
      try {
        setDashboardError('');
        const alertData = await requestJson<EmergencyAlert[]>('/api/sos', { credentials: 'include' });
        if (!isMounted) return;
        const normalizedAlerts = Array.isArray(alertData) ? alertData.map(normalizeAlert) : [];
        setAlerts(normalizedAlerts);
        setSelectedAlert((current) => current || normalizedAlerts[0] || null);

        if (user.role === 'ADMIN') {
          const [personnelData, guestData, auditData] = await Promise.all([
            requestJson<User[]>('/api/personnel', { credentials: 'include' }),
            requestJson<User[]>('/api/guests', { credentials: 'include' }),
            requestJson<AuditLog[]>('/api/audit-logs', { credentials: 'include' }),
          ]);

          if (!isMounted) return;
          setSystemUsers(Array.isArray(personnelData) ? personnelData : []);
          setGuests(Array.isArray(guestData) ? guestData : []);
          setAuditLogs(Array.isArray(auditData) ? auditData : []);
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError(getErrorMessage(error, 'Unable to load dashboard data.'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const handleNewAlert = async (incoming: EmergencyAlert) => {
      const translatedAlert = normalizeAlert(incoming);
      setAlerts((prev) => mergeAlertList(prev, translatedAlert));
      setSelectedAlert((current) => current || translatedAlert);
      setStaffLog((prev) => [
        {
          id: `${translatedAlert.id}-new`,
          msg: `ALERT: ${translatedAlert.type} in room ${translatedAlert.room}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    };

    const handleUpdatedAlert = (incoming: EmergencyAlert) => {
      const updatedAlert = normalizeAlert(incoming);
      setAlerts((prev) => mergeAlertList(prev, updatedAlert));
      setSelectedAlert((current) => (current?.id === updatedAlert.id ? updatedAlert : current));
      setStaffLog((prev) => [
        {
          id: `${updatedAlert.id}-status`,
          msg: `${updatedAlert.type} updated to ${updatedAlert.status}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    };

    loadDashboard();

    socket.on('new_alert', handleNewAlert);
    socket.on('alert_updated', handleUpdatedAlert);
    socket.on('guest_logged_in', (guest: GuestLoginEntry) => {
      setGuestLogins((prev) => [guest, ...prev.filter((entry) => entry.id !== guest.id)].slice(0, 20));
      if (user.role === 'ADMIN') {
        setGuests((prev) =>
          upsertUser(prev, {
            id: guest.id,
            username: guest.username,
            email: guest.email,
            role: 'USER',
            room: guest.room,
          })
        );
      }
    });

    if (user.role === 'ADMIN') {
      socket.on('new_audit_log', (log: AuditLog) => {
        setAuditLogs((prev) => [log, ...prev.filter((entry) => entry.id !== log.id)]);
      });
      socket.on('guest_room_updated', (guest: User) => {
        setGuests((prev) => upsertUser(prev, { ...guest, role: 'USER' }));
      });
      socket.on('personnel_created', (member: User) => {
        setSystemUsers((prev) => upsertUser(prev, member));
      });
    }

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [user.role]);

  const updateAlertStatus = async (id: string, status: EmergencyAlert['status']) => {
    try {
      setDashboardError('');
      const updatedAlert = normalizeAlert(
        await requestJson<EmergencyAlert>(`/api/sos/${id}/status`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      );
      setAlerts((prev) => mergeAlertList(prev, updatedAlert));
      setSelectedAlert((current) => (current?.id === updatedAlert.id ? updatedAlert : current));
    } catch (error) {
      setDashboardError(getErrorMessage(error, 'Unable to update alert status.'));
    }
  };

  const addUpdate = async () => {
    if (!selectedAlert || !newUpdate.trim()) return;

    try {
      setIsSubmittingUpdate(true);
      setDashboardError('');
      const updatedAlert = normalizeAlert(
        await requestJson<EmergencyAlert>(`/api/sos/${selectedAlert.id}/updates`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: newUpdate.trim(), staffName: user.username }),
        })
      );
      setAlerts((prev) => mergeAlertList(prev, updatedAlert));
      setSelectedAlert(updatedAlert);
      setNewUpdate('');
      setStaffLog((prev) => [
        {
          id: `${updatedAlert.id}-note`,
          msg: `${user.username} posted an update for room ${updatedAlert.room}`,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (error) {
      setDashboardError(getErrorMessage(error, 'Unable to post alert update.'));
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserData.username.trim() || !newUserData.email.trim()) {
      setDashboardError('Username and email are required to create a staff account.');
      return;
    }

    try {
      setIsCreatingUser(true);
      setDashboardError('');
      const newUser = await requestJson<PersonnelCreateResponse>('/api/personnel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUserData.username.trim(),
          email: newUserData.email.trim(),
          role: newUserData.role,
        }),
      });
      setSystemUsers((prev) => [...prev, newUser]);
      setNewUserData({ username: '', email: '', role: 'STAFF' });
      setProvisionedPassword(newUser.tempPassword || '');
    } catch (error) {
      setDashboardError(getErrorMessage(error, 'Unable to create staff account.'));
    } finally {
      setIsCreatingUser(false);
    }
  };

  const updateGuestRoom = async (guestId: string) => {
    const room = (guestRoomDrafts[guestId] || '').trim();
    if (!room) {
      setDashboardError('Room number is required before assigning a guest.');
      return;
    }

    try {
      setSavingRoom((prev) => ({ ...prev, [guestId]: true }));
      setDashboardError('');
      const updatedUser = await requestJson<User>(`/api/users/${guestId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
      });
      setGuests((prev) => prev.map((guest) => (guest.id === updatedUser.id ? updatedUser : guest)));
      setGuestRoomDrafts((prev) => ({ ...prev, [guestId]: updatedUser.room || '' }));
    } catch (error) {
      setDashboardError(getErrorMessage(error, 'Unable to update guest room.'));
    } finally {
      setSavingRoom((prev) => ({ ...prev, [guestId]: false }));
    }
  };

  const protocolSteps = selectedAlert ? alertProtocol(selectedAlert.type) : [];

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0B] text-slate-200">
      <nav className="z-40 flex shrink-0 flex-col gap-4 border-b border-white/10 bg-[#0F0F12] px-4 py-4 shadow-2xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex items-center gap-3">
            <div className="rounded bg-red-600 p-2 text-white shadow-lg shadow-red-600/20">
              <Siren size={20} />
            </div>
            <span className="text-lg font-black uppercase italic tracking-tight text-white sm:text-xl">
              Crisis<span className="text-red-500">Connect</span>
            </span>
          </div>

          <div className="-mx-1 flex overflow-x-auto border-white/10 pb-1 lg:mx-0 lg:border-l lg:pl-8 lg:pb-0">
            {(['ALERTS', 'GUESTS', 'USERS', 'AUDIT'] as DashboardTab[])
              .filter((tab) => user.role === 'ADMIN' || tab === 'ALERTS')
              .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all sm:px-4 ${
                    activeTab === tab
                      ? 'border border-white/10 bg-white/10 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'GUESTS' ? 'Manage Guests' : tab === 'USERS' ? 'Personnel' : tab === 'AUDIT' ? 'Audit Logs' : 'Alerts'}
                </button>
              ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="flex max-w-[min(15rem,70vw)] items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 sm:max-w-[min(16rem,42vw)]">
            <div className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
            <span className="truncate text-[10px] font-bold uppercase tracking-widest text-green-500">
              Node Active: {user.username}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="shrink-0 rounded-full border border-white/10 bg-[#141417] p-2 text-slate-500 shadow-xl transition-all hover:border-red-600/50 hover:text-red-500"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {dashboardError ? (
        <div className="border-b border-red-600/20 bg-red-600/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-red-200 sm:px-6">
          {dashboardError}
        </div>
      ) : null}

      <main className="relative flex flex-1 flex-col overflow-hidden xl:flex-row">
        <AnimatePresence mode="wait">
          {activeTab === 'ALERTS' ? (
            <motion.div
              key="alerts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full flex-1 flex-col overflow-hidden xl:flex-row"
            >
              <aside className="flex max-h-[16rem] w-full shrink-0 flex-col border-b border-white/10 bg-[#0F0F12] xl:max-h-none xl:w-80 xl:border-b-0 xl:border-r">
                <div className="border-b border-white/5 bg-black/20 p-4">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Active Emergency Stream ({alerts.filter((alert) => alert.status !== 'RESOLVED').length})
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex h-full items-center justify-center p-8 text-center text-xs uppercase tracking-widest text-slate-600">
                      Loading alerts...
                    </div>
                  ) : alerts.length === 0 ? (
                    <div className="flex h-full items-center justify-center bg-black/10 p-8 text-center text-xs uppercase tracking-widest text-slate-600">
                      No Active Threats
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <button
                        key={alert.id}
                        onClick={() => setSelectedAlert(alert)}
                        className={`w-full border-b border-white/5 p-4 text-left transition-all ${
                          selectedAlert?.id === alert.id ? 'border-l-4 border-red-600 bg-red-500/10' : 'hover:bg-white/5'
                        } ${alert.status === 'RESOLVED' ? 'opacity-40 grayscale' : ''}`}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest ${
                              alert.type === 'FIRE'
                                ? 'text-red-500'
                                : alert.type === 'MEDICAL'
                                  ? 'text-blue-500'
                                  : 'text-slate-200'
                            }`}
                          >
                            {alert.type} Incident
                          </span>
                          <span className="font-mono text-[10px] italic text-slate-500">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">Room {alert.room} | {alert.guestCount} Guests</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-500">
                          Floor {alert.floor} | {alert.status}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden bg-[#0A0A0B] p-4 sm:gap-6 sm:p-6">
                {selectedAlert ? (
                  <motion.div
                    key={selectedAlert.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-6"
                  >
                    <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#141417] p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                            Critical
                          </span>
                          <h1 className="text-2xl font-light uppercase italic tracking-tight text-white sm:text-3xl">
                            {selectedAlert.type}: <span className="font-bold">Room {selectedAlert.room}</span>
                          </h1>
                        </div>
                        <p className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 sm:text-xs">
                          Dispatch Origin: ID-{selectedAlert.id.substring(0, 8)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {selectedAlert.status !== 'ACKNOWLEDGED' ? (
                          <button
                            onClick={() => updateAlertStatus(selectedAlert.id, 'ACKNOWLEDGED')}
                            className="rounded-xl border border-blue-600/30 bg-blue-600/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-blue-400"
                          >
                            Acknowledge
                          </button>
                        ) : null}
                        <button
                          onClick={() => updateAlertStatus(selectedAlert.id, 'RESOLVED')}
                          className="rounded-xl border border-green-600/30 bg-green-600/10 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-green-500"
                        >
                          Resolve Alert
                        </button>
                      </div>
                    </header>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
                      {[
                        { label: 'Latency', value: '00:04', icon: Clock },
                        { label: 'Response', value: selectedAlert.status, icon: Siren },
                        { label: 'Integrity', value: 'Secure', icon: ShieldCheck },
                        { label: 'Origin', value: `Rm ${selectedAlert.room}`, icon: MapPin },
                        { label: 'Operator', value: user.username, icon: Users },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-white/5 bg-[#141417] p-4 text-center">
                          <stat.icon size={16} className="mx-auto mb-2 text-slate-600" />
                          <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{stat.label}</div>
                          <div className="text-xs font-bold uppercase text-white">{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                      <section className="rounded-2xl border border-white/10 bg-[#141417] p-4 shadow-2xl sm:p-6">
                        <h3 className="mb-6 border-b border-white/5 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Intelligence Intercept
                        </h3>
                        <div className="mb-4 rounded-xl border border-white/5 bg-black/40 p-4 text-sm italic text-slate-400">
                          "{selectedAlert.guestInfo?.originalMessage || 'No voice or text data captured.'}"
                        </div>
                        {selectedAlert.guestInfo?.translatedMessage ? (
                          <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm font-bold text-blue-100">
                            <Languages size={14} className="mt-1 shrink-0 text-blue-500" />
                            <div className="space-y-2">
                              <span className="block">"{selectedAlert.guestInfo.translatedMessage}"</span>
                              {selectedAlert.guestInfo.detectedLanguage ? (
                                <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300/80">
                                  Detected: {selectedAlert.guestInfo.detectedLanguage}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {selectedAlert.guestInfo?.aiSummary ? (
                          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">
                              AI Summary
                            </div>
                            <p className="text-sm font-bold text-emerald-100">{selectedAlert.guestInfo.aiSummary}</p>
                          </div>
                        ) : null}
                      </section>

                      <section className="rounded-2xl border border-white/10 bg-[#141417] p-4 shadow-2xl sm:p-6">
                        <h3 className="mb-6 border-b border-white/5 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Action Protocol
                        </h3>
                        <div className="space-y-4">
                          {(protocolSteps.length ? protocolSteps : ['No protocol available for this alert type.']).map(
                            (step, idx) => (
                              <div key={`${selectedAlert.id}-${idx}`} className="rounded-2xl border border-white/5 bg-black/30 p-4">
                                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500">
                                  Step {idx + 1}
                                </div>
                                <p className="text-sm leading-6 text-slate-200">{step}</p>
                              </div>
                            )
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141417] shadow-2xl">
                      <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={newUpdate}
                            onChange={(e) => setNewUpdate(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !isSubmittingUpdate && void addUpdate()}
                            placeholder="Type incident update..."
                            className="w-full rounded-xl border border-white/5 bg-black/40 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                        <button
                          onClick={() => void addUpdate()}
                          disabled={isSubmittingUpdate || !newUpdate.trim()}
                          className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-4 text-white shadow-lg shadow-red-600/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {isSubmittingUpdate ? 'Posting' : 'Post'}
                          </span>
                          <Send size={14} />
                        </button>
                      </div>
                      <div className="max-h-48 space-y-4 overflow-y-auto bg-black/20 p-4 sm:p-6">
                        {selectedAlert.updates.length === 0 ? (
                          <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-xs uppercase tracking-widest text-slate-500">
                            No updates posted yet.
                          </div>
                        ) : (
                          selectedAlert.updates.map((upd, idx) => (
                            <div key={`${selectedAlert.id}-${idx}`} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6">
                              <span className="pt-1 font-mono text-[9px] uppercase text-slate-700">{upd.time}</span>
                              <div className="flex-1 rounded-xl border border-white/5 bg-white/5 p-4">
                                <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                                  {upd.staffName || 'Staff'}
                                </span>
                                <p className="text-xs font-bold uppercase tracking-tight text-slate-300">{upd.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-800">
                    <Siren size={120} className="mb-8 opacity-20" />
                    <h2 className="text-6xl font-black uppercase italic tracking-tighter opacity-10 leading-none">Command</h2>
                    <h2 className="text-6xl font-black uppercase italic tracking-tighter opacity-10 leading-none">Node</h2>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'USERS' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-4 sm:p-8"
            >
              <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
                <div className="lg:col-span-2">
                  <h2 className="mb-8 flex items-center gap-3 text-2xl font-black uppercase italic tracking-tighter text-white">
                    <Users className="text-red-500" />
                    Authorized Personnel
                  </h2>
                  <div className="space-y-4">
                    {systemUsers.map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-[#141417] p-4 sm:flex-row sm:items-center sm:p-6"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl font-black ${
                              member.role === 'ADMIN' ? 'bg-red-600/10 text-red-500' : 'bg-blue-600/10 text-blue-500'
                            }`}
                          >
                            {member.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold uppercase tracking-widest text-white">{member.username}</div>
                            <div className="mt-1 flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span className={member.role === 'ADMIN' ? 'text-red-600' : 'text-blue-500'}>{member.role}</span>
                              {member.room ? <span>Room {member.room}</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!systemUsers.length && !isLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-[#141417] p-6 text-xs uppercase tracking-widest text-slate-500">
                        No personnel records available.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="rounded-3xl border border-red-600/20 bg-[#141417] p-6 shadow-2xl sm:p-8 lg:sticky lg:top-0">
                    <h3 className="mb-6 flex items-center gap-3 text-sm font-black uppercase italic tracking-widest text-white">
                      <UserPlus className="text-red-500" size={18} />
                      Provision New Personnel
                    </h3>
                    <p className="mb-4 text-[10px] uppercase tracking-[0.35em] text-slate-500">
                      Staff accounts are created here with a temporary password.
                    </p>
                    {provisionedPassword ? (
                      <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.3em] text-green-400">
                          Temporary Password
                        </div>
                        <div className="break-all font-mono text-sm text-white">{provisionedPassword}</div>
                      </div>
                    ) : null}
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Username / Employee ID"
                        value={newUserData.username}
                        onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                        className="w-full rounded-xl border border-white/5 bg-black px-4 py-3 text-xs font-bold text-white placeholder:text-slate-700"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        className="w-full rounded-xl border border-white/5 bg-black px-4 py-3 text-xs font-bold text-white placeholder:text-slate-700"
                      />
                      <select
                        value={newUserData.role}
                        onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as 'STAFF' })}
                        className="w-full rounded-xl border border-white/5 bg-black px-4 py-3 text-xs font-bold text-slate-400"
                      >
                        <option value="STAFF">Staff Member</option>
                      </select>
                      <button
                        disabled={isCreatingUser}
                        className="w-full rounded-xl bg-red-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isCreatingUser ? 'Authorizing...' : 'Authorize Member'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'GUESTS' ? (
            <motion.div
              key="guests"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-4 sm:p-8"
            >
              <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-3 text-xl font-black uppercase italic tracking-tighter text-white sm:text-2xl">
                    <Users className="text-red-500" />
                    Manage Guests
                  </h2>
                  <div className="flex w-full justify-between gap-4 rounded-xl border border-white/5 bg-[#141417] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:w-auto sm:justify-start">
                    <span>Live guest activity</span>
                    <span className="text-green-500">Online</span>
                  </div>
                </div>

                <div className="mb-8 grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141417] shadow-2xl">
                    <div className="border-b border-white/10 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Guest Accounts</h3>
                          <p className="mt-1 text-[10px] text-slate-500">Registered guest accounts available for review.</p>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {guests.length} guests
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="border-b border-white/10 bg-black/40">
                          <tr>
                            <th className="px-5 py-4 uppercase tracking-widest text-slate-500">Username</th>
                            <th className="px-5 py-4 uppercase tracking-widest text-slate-500">Email</th>
                            <th className="px-5 py-4 uppercase tracking-widest text-slate-500">Assigned Room</th>
                            <th className="px-5 py-4 uppercase tracking-widest text-slate-500">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {guests.map((guest) => (
                            <tr key={guest.id} className="transition-colors hover:bg-white/5">
                              <td className="px-5 py-4 font-bold uppercase tracking-tight text-white">{guest.username}</td>
                              <td className="px-5 py-4 lowercase text-slate-400">{guest.email || '-'}</td>
                              <td className="px-5 py-4">
                                <input
                                  type="text"
                                  value={guestRoomDrafts[guest.id] ?? guest.room ?? ''}
                                  onChange={(e) => setGuestRoomDrafts((prev) => ({ ...prev, [guest.id]: e.target.value }))}
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                                  placeholder="Enter room"
                                />
                              </td>
                              <td className="px-5 py-4">
                                <button
                                  onClick={() => void updateGuestRoom(guest.id)}
                                  disabled={savingRoom[guest.id]}
                                  className="rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {savingRoom[guest.id] ? 'Saving...' : 'Assign'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#141417] p-6 shadow-2xl">
                    <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-400">Recent Guest Logins</h3>
                    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                      {guestLogins.length === 0 ? (
                        <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-center text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          Waiting for guest logins...
                        </div>
                      ) : (
                        guestLogins.slice(0, 8).map((login) => (
                          <div key={login.id} className="rounded-3xl border border-white/5 bg-black/30 p-4 text-[11px] text-slate-200">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="font-black uppercase tracking-wider text-slate-400">{login.username}</span>
                              <span className="text-[9px] uppercase tracking-[0.3em] text-slate-500">
                                {new Date(login.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300">{login.email || 'No email'}</div>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-slate-500">
                              Room: {login.room || 'N/A'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="audit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-4 sm:p-8"
            >
              <div className="mx-auto max-w-4xl">
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="flex items-center gap-3 text-2xl font-black uppercase italic tracking-tighter text-white">
                    <History className="text-red-500" />
                    System Audit Trail
                  </h2>
                  <div className="flex gap-4 rounded-xl border border-white/5 bg-[#141417] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Encryption: AES-256</span>
                    <span className="text-green-500">Active</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141417] shadow-2xl">
                  <div className="divide-y divide-white/5 md:hidden">
                    {auditLogs.map((log) => {
                      const tone = getAuditLogTone(log);
                      return (
                        <div key={log.id} className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Timestamp</div>
                              <div className="mt-1 font-mono text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</div>
                            </div>
                            <span className={`shrink-0 rounded border px-2 py-1 text-[9px] font-black uppercase tracking-tighter ${tone.badge}`}>
                              {log.action}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Operator</div>
                              <div className="mt-1 text-sm font-bold uppercase tracking-tight text-white">{log.username}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">Details</div>
                              <div className="mt-1 text-xs uppercase tracking-tight text-slate-300">{log.details}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <table className="hidden w-full text-left md:table">
                    <thead className="border-b border-white/5 bg-black/40">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Timestamp</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Operator</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Action</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-500">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 italic">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="transition-colors hover:bg-white/5">
                          {(() => {
                            const tone = getAuditLogTone(log);
                            return (
                              <>
                                <td className="px-6 py-4 font-mono text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 text-xs font-bold uppercase tracking-tight text-white">{log.username}</td>
                                <td className="px-6 py-4">
                                  <span className={`rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter ${tone.badge}`}>
                                    {log.action}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs uppercase tracking-tighter text-slate-300">{log.details}</td>
                              </>
                            );
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!auditLogs.length && !isLoading ? (
                    <div className="p-6 text-xs uppercase tracking-widest text-slate-500">No audit activity available.</div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <aside className="relative z-10 flex w-full shrink-0 flex-col border-t border-white/10 bg-[#0F0F12] p-4 sm:p-6 xl:w-80 xl:border-l xl:border-t-0">
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full flex-col overflow-hidden">
              <h3 className="mb-6 flex items-center gap-2 border-b border-white/5 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Database size={12} />
                Live Event Intercept
              </h3>
              <div className="space-y-4 overflow-y-auto pr-2">
                {staffLog.map((log) => (
                  <div
                    key={log.id}
                    className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-4 text-[9px] font-bold uppercase tracking-widest text-red-500/80"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-red-600/30" />
                    <div className="mb-2 flex justify-between font-mono italic text-slate-600">
                      <span className="text-[8px] font-black uppercase">Sys Packet</span>
                      <span>{log.time}</span>
                    </div>
                    {log.msg}
                  </div>
                ))}

                {user.role === 'ADMIN' ? (
                  <div className="rounded-2xl border border-white/10 bg-[#141417] p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">User Activity</h3>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[8px] uppercase tracking-[0.35em] text-slate-400">
                        {auditLogs.length} events
                      </span>
                    </div>
                    <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
                      {auditLogs.slice(0, 5).map((log) => (
                        (() => {
                          const tone = getAuditLogTone(log);
                          return (
                            <div key={log.id} className={`relative overflow-hidden rounded-2xl border p-3 text-[10px] ${tone.card}`}>
                              <div className={`absolute left-0 top-0 h-full w-1 ${tone.accent}`} />
                              <div className="mb-1 pl-2 font-black uppercase tracking-[0.25em] text-slate-400">{log.username}</div>
                              <div className="mb-2 pl-2">
                                <span className={`rounded border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.25em] ${tone.badge}`}>
                                  {log.action}
                                </span>
                              </div>
                              <p className="pl-2 text-xs leading-snug text-slate-200">{log.details}</p>
                              <div className="mt-2 pl-2 text-[8px] uppercase tracking-[0.35em] text-slate-600">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          );
                        })()
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="grid grid-cols-1 gap-1">
              {[
                { label: 'Fire', number: '101', caption: 'Fire Emergency', color: 'text-orange-400' },
                { label: 'Ambulance', number: '108', caption: 'Medical Response', color: 'text-cyan-400' },
                { label: 'Emergency', number: '112', caption: 'General Emergency', color: 'text-red-500' },
              ].map((entry) => (
                <div key={entry.number} className="rounded-2xl border border-white/10 bg-slate-900/50 p-2.5 text-center">
                  <div className={`mb-1 text-[7px] font-black uppercase tracking-widest ${entry.color}`}>{entry.label}</div>
                  <div className="mb-0.5 text-xl font-black tracking-tighter text-white">{entry.number}</div>
                  <p className="text-[7px] uppercase tracking-widest text-slate-500">{entry.caption}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
