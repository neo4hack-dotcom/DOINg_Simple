
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport, Note } from '../types';

const STORAGE_KEY = 'teamsync_data_v15'; // Version bumped for robustness
const CHANNEL_NAME = 'teamsync_broadcast_channel';

// Channel for cross-tab synchronization
const syncChannel = new BroadcastChannel(CHANNEL_NAME);

const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
};

// --- INITIAL MINIMAL DATA ---
const INITIAL_ADMIN: User = { 
    id: 'u1', 
    uid: 'Admin', 
    firstName: 'Mathieu', 
    lastName: 'Admin', 
    functionTitle: 'System Administrator', 
    role: UserRole.ADMIN, 
    managerId: null, 
    password: '59565956' 
};

// --- ROBUST ID GENERATOR (Windows/Offline safe) ---
export const generateId = (): string => {
    // Try native crypto if available (Secure Context)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers or non-secure contexts (file://)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      if (!parsed.llmConfig) parsed.llmConfig = DEFAULT_LLM_CONFIG;
      if (!parsed.weeklyReports) parsed.weeklyReports = [];
      if (!parsed.notes) parsed.notes = []; 
      if (!parsed.prompts) parsed.prompts = {};
      
      // User Migration
      if (parsed.users) {
          parsed.users = parsed.users.map((u: User) => {
              if (u.uid === 'Admin' || u.uid === 'ADM001') {
                  return { ...u, firstName: 'Mathieu', uid: 'Admin', password: '59565956', role: UserRole.ADMIN };
              }
              return { ...u, password: u.password || '1234' }
          });
      }
      return parsed;
    }
  } catch (error) {
    console.error("Failed to load state. Reseting to default.", error);
  }
  
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
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    
    // Notify other tabs/windows about the update
    syncChannel.postMessage({ type: 'STATE_UPDATED', timestamp: Date.now() });
    
  } catch (e: any) {
    // Windows LocalStorage Quota Management
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        alert("⚠️ CRITICAL STORAGE ERROR\n\nWindows LocalStorage is full (Limit: ~5-10MB).\n\nAction required:\n1. Delete old Notes containing images.\n2. Export your data in Settings > Backup.\n3. Clear data and re-import only necessary items.");
    } else {
        console.error("Failed to save state", e);
    }
  }
};

// Subscribe to external updates (Multi-tab support)
export const subscribeToStoreUpdates = (callback: () => void) => {
    // 1. Listen to BroadcastChannel (Modern browsers)
    const channelHandler = (event: MessageEvent) => {
        if (event.data.type === 'STATE_UPDATED') {
            callback();
        }
    };
    syncChannel.addEventListener('message', channelHandler);

    // 2. Listen to StorageEvent (Fallback and different storage contexts)
    const storageHandler = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            callback();
        }
    };
    window.addEventListener('storage', storageHandler);

    // Unsubscribe function
    return () => {
        syncChannel.removeEventListener('message', channelHandler);
        window.removeEventListener('storage', storageHandler);
    };
};

export const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
    // Notify others to clear/reload
    syncChannel.postMessage({ type: 'STATE_UPDATED', timestamp: Date.now() });
    window.location.reload();
}
