export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: 'student' | 'admin';
  scannerAccess?: boolean;
}

export type ClassYear = 'First Year' | 'Second Year' | 'Third Year' | 'Fourth Year';

export interface UserProfile {
  userId: string;
  name: string;
  pnr?: string;
  division: string;
  branch?: string;
  contactEmail: string;
  phoneNumber?: string;
  bio?: string;
  avatarUrl?: string;
  avatarLocalUrl?: string; // blob URL for local preview
  role?: 'student' | 'admin';
  scannerAccess?: boolean;
  createdAt?: string;
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  color: string;
  initials: string;
}

export interface Session {
  time: string;
  title: string;
  speaker: string;
  tag: string;
  tagColor: string;
}

export interface ScheduleDay {
  day: string;
  date: string;
  color: string;
  sessions: Session[];
}

export interface EventWinner {
  teamId: string;
  teamName: string;
  position: '1st' | '2nd' | '3rd' | 'Winner';
  members: string[];
  declaredAt?: string;
}

export interface EventData {
  id: string;
  title: string;
  date: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  location: string;
  address: string;
  attendees: string;
  speakers: Speaker[];
  schedule: ScheduleDay[];
  isPast?: boolean;
  maxTeamSize?: number;
  time?: string;
  submissionsEnabled?: boolean;
  winners?: EventWinner[];
  posterUrl?: string; // custom card poster image uploaded via admin
  teamFormationLive?: boolean;
}

export interface UserTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  date: string;
  location: string;
  teamName?: string;
  status: 'Confirmed' | 'Waitlisted';
  userId?: string; // owner of this ticket
  submissionsEnabled?: boolean;
}

export interface Team {
  id: string;
  name: string;
  eventId: string;
  createdBy: string;
  memberIds: string[];
  memberCount: number;
  createdAt?: string;
  skills?: string;
  achievements?: string;
  openRoles?: string[];
  bannerUrl?: string;
  logoUrl?: string;
}

export interface JoinRequest {
  id: string;
  teamId: string;
  teamName?: string;
  userId: string;
  status: string;
  createdAt: string;
  userName?: string;
  userPnr?: string;
  userBranch?: string;
  userYear?: string;
  userDivision?: string;
  userSkills?: string;
  userPitch?: string;
  requestedRole?: string;
  userPhoneNumber?: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  eventId: string;
  eventTitle: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface PlatformUserSearchResult {
  id: string;
  name: string;
  email: string;
  pnr?: string;
  branch?: string;
  classYear?: string;
  division?: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  teamId?: string;
  teamName?: string;
  eventId?: string;
  eventTitle?: string;
  type: 'member_exit' | 'captain_promoted' | 'team_invite' | 'join_request' | 'member_kicked' | 'profile_alert' | 'warning' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}


export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPnr?: string;
  userBranch?: string;
  userDivision?: string;
  userYear?: string;
  userPhoneNumber?: string;
  joinedAt: string;
}

export interface Message {
  id: string;
  teamId: string;
  userId: string;
  content: string;
  timestamp: string;
}

export interface Submission {
  id: string;
  teamId: string;
  eventId: string;
  repoUrl: string;       // kept for API compat; stores file name in mock
  fileName?: string;     // original zip/pdf/ppt/doc file name
  fileSize?: number;     // bytes
  fileUrl?: string;      // downloadable / previewable URL
  fileData?: string;     // base64 data url for local preview / download
  description: string;
  timestamp: string;
}

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  pnr?: string;
  branch?: string;
  role: 'student' | 'admin';
  classYear: ClassYear;
  division: string;
  phoneNumber?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt?: string;
  ticketsCount: number;
  tickets: UserTicket[];
  passwordPlain?: string;
  scannerAccess?: boolean;
}

export interface EventEnrollmentView {
  id: string; // ticket / pass id
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  pnr: string;
  classYear: ClassYear;
  division: string;
  branch: string;
  phoneNumber?: string;
  bio?: string;
  avatarUrl?: string;
  teamName?: string;
  status: 'Confirmed' | 'Waitlisted';
  enrolledAt: string;
}

export interface PlatformStats {
  totalEvents: number;
  activeEvents: number;
  pastEvents: number;
  totalUsers: number;
  totalTickets: number;
}
