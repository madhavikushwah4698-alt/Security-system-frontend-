export type AlertType = 'FIRE' | 'MEDICAL' | 'SECURITY';

export interface EmergencyAlert {
  id: string;
  type: AlertType;
  room: string;
  floor: string;
  guestCount: number;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVING' | 'RESOLVED';
  timestamp: string;
  assignedRoles?: {
    role: string;
    suggestion: string;
    assignee?: string;
  }[];
  updates: {
    time: string;
    message: string;
    staffName: string;
  }[];
  guestInfo?: {
    language?: string;
    detectedLanguage?: string;
    translatedMessage?: string;
    aiSummary?: string;
    originalMessage?: string;
  };
}

export interface CrisisTemplate {
  type: AlertType;
  title: string;
  steps: string[];
}

export type UserRole = 'USER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  room?: string; // Users might be assigned to a room
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  details: string;
}
