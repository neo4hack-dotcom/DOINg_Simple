
export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  EMPLOYEE = 'Employee'
}

export enum TaskStatus {
  TODO = 'To Do',
  ONGOING = 'In Progress',
  BLOCKED = 'Blocked',
  DONE = 'Done'
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent'
}

export enum ProjectStatus {
  PLANNING = 'Planning',
  ACTIVE = 'Active',
  PAUSED = 'Paused',
  DONE = 'Done'
}

export enum ProjectRole {
  OWNER = 'Owner',
  LEAD = 'Lead',
  CONTRIBUTOR = 'Contributor'
}

export enum ActionItemStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed'
}

export type LLMProvider = 'ollama' | 'local_http';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl?: string; 
  apiKey?: string; 
  model: string; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { name: string, type: string, data?: string }[]; // Pour images/fichiers
  timestamp: Date;
}

export interface User {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  functionTitle: string;
  role: UserRole;
  managerId?: string | null;
  avatarUrl?: string;
  password?: string; 
  location?: string; // New: Country/City
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

// Nouvelle interface pour les dépendances externes avec statut RAG
export interface ExternalDependency {
  id: string;
  label: string; // Nom du système ou de la personne
  status: 'Red' | 'Amber' | 'Green';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string; 
  eta: string; 
  dependencies?: string[]; // Internal dependencies (Task IDs)
  externalDependencies?: ExternalDependency[]; // New: External systems/people
  weight: number; 
  isImportant: boolean; 
  checklist?: ChecklistItem[]; 
  order?: number; 
}

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  managerId?: string; 
  deadline: string; 
  members: ProjectMember[];
  tasks: Task[];
  isImportant: boolean; 
  docUrls?: string[]; 
  dependencies?: string[]; // Internal Project IDs
  externalDependencies?: ExternalDependency[]; // New: External systems/people
  additionalDescriptions?: string[]; // New: Context fields for AI (3 x 2000 chars)
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  projects: Project[];
}

export interface Meeting {
  id: string;
  teamId: string;
  projectId?: string; 
  date: string;
  title: string;
  attendees: string[];
  minutes: string;
  actionItems: ActionItem[];
}

export interface ActionItem {
  id: string;
  description: string;
  ownerId: string;
  dueDate: string;
  status: ActionItemStatus;
}

export type HealthStatus = 'Green' | 'Amber' | 'Red'; 

export interface WeeklyReport {
  id: string;
  userId: string;
  weekOf: string; 
  mainSuccess: string;
  mainIssue: string;
  incident: string;
  orgaPoint: string;
  otherSection?: string; 
  teamHealth?: HealthStatus; 
  projectHealth?: HealthStatus; 
  updatedAt: string;
  managerCheck?: boolean; 
  managerAnnotation?: string; 
}

// --- NOUVEAUX TYPES POUR LES NOTES (CANVAS) ---

export type NoteBlockType = 'text' | 'image' | 'rectangle' | 'circle' | 'line' | 'drawing';

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  content?: string; // Texte, Base64 Image, ou SVG Path Data (pour drawing)
  position: { x: number, y: number }; // Coordonnées absolues dans le canvas
  style?: {
    width?: string;
    height?: string;
    color?: string; // Background color or Border color or Stroke color
  };
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  blocks: NoteBlock[];
}

export interface AppState {
  users: User[];
  teams: Team[];
  meetings: Meeting[];
  weeklyReports: WeeklyReport[];
  notes: Note[]; 
  currentUser: User | null;
  theme: 'light' | 'dark';
  llmConfig: LLMConfig;
  prompts?: Record<string, string>; // New: Custom prompt templates
}
