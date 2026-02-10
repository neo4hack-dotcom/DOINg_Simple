
import { User, Team, Meeting, UserRole, TaskStatus, TaskPriority, ProjectStatus, ProjectRole, ActionItemStatus, AppState, LLMConfig, WeeklyReport, Note } from '../types';

const STORAGE_KEY = 'teamsync_data_v15';
// L'URL relative permet de fonctionner quel que soit le nom de domaine ou l'IP du serveur
const API_URL = '/api/data'; 

const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3'
};

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

// --- Générateur d'ID Robuste ---
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- Lecture Locale (Cache Rapide) ---
export const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure defaults
      if (!parsed.llmConfig) parsed.llmConfig = DEFAULT_LLM_CONFIG;
      if (!parsed.weeklyReports) parsed.weeklyReports = [];
      if (!parsed.notes) parsed.notes = []; 
      return parsed;
    }
  } catch (error) {
    console.error("Local load failed", error);
  }
  
  // Default State
  return {
    users: [INITIAL_ADMIN],
    teams: [],
    meetings: [],
    weeklyReports: [],
    notes: [],
    currentUser: null, 
    theme: 'light',
    llmConfig: DEFAULT_LLM_CONFIG,
    prompts: {},
    lastUpdated: Date.now()
  };
};

// --- Lecture Serveur (Fichier Central) ---
export const fetchFromServer = async (): Promise<AppState | null> => {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            // Basic validation
            if (data && (data.users || data.teams)) {
                return data as AppState;
            }
        }
    } catch (e) {
        console.warn("Mode Hors-Ligne: Impossible de joindre le fichier central.");
    }
    return null;
};

// --- Écriture Centralisée ---
export const updateAppState = (updater: (currentState: AppState) => AppState): AppState => {
    const latestState = loadState();
    const newState = updater(latestState);
    saveState(newState);
    return newState;
};

export const saveState = (state: AppState) => {
  try {
    const timestamp = Date.now();
    const stateWithTimestamp = { ...state, lastUpdated: timestamp };
    
    // 1. Sauvegarde Locale (Instantané)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithTimestamp));
    
    // 2. Sauvegarde Serveur (Asynchrone / Fichier Central)
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stateWithTimestamp)
    }).catch(err => console.error("Échec sauvegarde serveur:", err));

    // 3. Notification inter-onglets
    const event = new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(stateWithTimestamp)
    });
    window.dispatchEvent(event);
    
  } catch (e: any) {
    console.error("Erreur de sauvegarde", e);
    if (e.name === 'QuotaExceededError') {
        alert("⚠️ Mémoire Locale Pleine. Veuillez nettoyer vos Notes ou exporter vos données.");
    }
  }
};

// --- Abonnement aux mises à jour ---
export const subscribeToStoreUpdates = (callback: () => void) => {
    const handler = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY) {
            callback();
        }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
};

export const clearState = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}
