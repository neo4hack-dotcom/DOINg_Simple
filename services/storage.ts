
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport, Note } from '../types';

const STORAGE_KEY = 'teamsync_data_v14'; // Version incremented for prompts

const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
};

// --- INITIAL MINIMAL DATA (Production Start) ---
const INITIAL_ADMIN: User = { 
    id: 'u1', 
    uid: 'Admin', 
    firstName: 'Mathieu', 
    lastName: 'Admin', 
    functionTitle: 'System Administrator', 
    role: UserRole.ADMIN, 
    managerId: null, 
    password: '59565956' // Keep default pass for access
};

export const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Ensure we don't have invalid LLM config
      if (!parsed.llmConfig) {
          parsed.llmConfig = DEFAULT_LLM_CONFIG;
      }
      
      if (!parsed.weeklyReports) parsed.weeklyReports = [];
      if (!parsed.notes) parsed.notes = []; 
      if (!parsed.prompts) parsed.prompts = {};
      
      // User Migration
      if (parsed.users) {
          parsed.users = parsed.users.map((u: User) => {
              // Force Update Admin if old version
              if (u.uid === 'Admin' || u.uid === 'ADM001') {
                  return { ...u, firstName: 'Mathieu', uid: 'Admin', password: '59565956', role: UserRole.ADMIN };
              }
              return {
                  ...u,
                  password: u.password || '1234'
              }
          });
      }

      return parsed;
    }
  } catch (error) {
    console.error("Failed to load state from localStorage. Reseting to default.", error);
    // Optionnel : Clear storage si corrompu pour éviter une boucle, ou laisser l'utilisateur écraser
    // localStorage.removeItem(STORAGE_KEY);
  }
  
  // RETURN BLANK STATE (Except Admin)
  return {
    users: [INITIAL_ADMIN],
    teams: [],
    meetings: [],
    weeklyReports: [],
    notes: [],
    currentUser: null, 
    theme: 'light',
    llmConfig: DEFAULT_LLM_CONFIG,
    prompts: {}
  };
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

export const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}
