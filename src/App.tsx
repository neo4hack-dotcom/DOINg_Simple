import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import ProjectTracker from './components/ProjectTracker';
import KPIDashboard from './components/KPIDashboard';
import MeetingManager from './components/MeetingManager';
import SettingsPanel from './components/SettingsPanel';
import BookOfWork from './components/BookOfWork';
import WeeklyReport from './components/WeeklyReport'; 
import ManagementDashboard from './components/ManagementDashboard'; 
import Login from './components/Login'; 
import AIChatSidebar from './components/AIChatSidebar';
import NotesManager from './components/NotesManager'; 

import { loadState, saveState, subscribeToStoreUpdates, updateAppState, fetchFromServer } from './services/storage';
import { AppState, User, Team, UserRole, Meeting, LLMConfig, WeeklyReport as WeeklyReportType, ProjectRole, Note } from './types';
import { Search, Bell, Sun, Moon, Bot, AlertTriangle, RefreshCw, Radio, Cloud, CloudOff } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleReload = () => window.location.reload();
  handleReset = () => {
      if(window.confirm("Reset local data?")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-red-100 dark:border-red-900/30 p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">App Error</h1>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.toString()}</p>
            <button onClick={this.handleReload} className="bg-indigo-600 text-white px-4 py-2 rounded">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children; 
  }
}

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appState, setAppState] = useState<AppState | null>(null);
  const [reportNotification, setReportNotification] = useState(false);
  
  // Sync Status
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [showSyncToast, setShowSyncToast] = useState(false);

  // AI Sidebar
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  // --- INITIAL LOAD & POLLING ---
  useEffect(() => {
    // 1. Load Local first (Instant UI)
    const localData = loadState();
    setAppState(localData);
    applyTheme(localData.theme);

    // 2. Fetch Server Data Immediately (Central Truth)
    const initServerSync = async () => {
        const serverData = await fetchFromServer();
        if (serverData) {
            // If server is newer than local, use server
            if ((serverData.lastUpdated || 0) > (localData.lastUpdated || 0)) {
                console.log("📥 Initial Load: Server data is newer. Updating.");
                setAppState(serverData);
                // Update local storage to match server without triggering save loop
                localStorage.setItem('teamsync_data_v15', JSON.stringify(serverData));
            }
            setIsOnline(true);
        } else {
            setIsOnline(false);
        }
    };
    initServerSync();

    // 3. Polling Interval (Every 10 seconds check for updates from colleagues)
    const intervalId = setInterval(async () => {
        const serverData = await fetchFromServer();
        if (serverData) {
            setIsOnline(true);
            setLastSyncTime(new Date());
            
            setAppState(currentState => {
                if (!currentState) return serverData;
                // Only update if server is strictly newer than what we have in memory
                if ((serverData.lastUpdated || 0) > (currentState.lastUpdated || 0)) {
                    console.log("🔄 Auto-Sync: New data received from server.");
                    setShowSyncToast(true);
                    setTimeout(() => setShowSyncToast(false), 4000);
                    // Persist to local for offline backup
                    localStorage.setItem('teamsync_data_v15', JSON.stringify(serverData));
                    return serverData;
                }
                return currentState;
            });
        } else {
            setIsOnline(false);
        }
    }, 10000); // 10 seconds

    // 4. Subscribe to Local Tab Updates
    const unsubscribe = subscribeToStoreUpdates(() => {
        const freshState = loadState();
        setAppState(freshState);
    });

    return () => {
        unsubscribe();
        clearInterval(intervalId);
    };
  }, []);

  const applyTheme = (theme: 'light' | 'dark') => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  // Check reports logic
  useEffect(() => {
      if (appState && appState.currentUser) {
          const userReports = appState.weeklyReports.filter(r => r.userId === appState.currentUser?.id);
          if (userReports.length === 0) {
              setReportNotification(true);
          } else {
              const sorted = userReports.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
              const daysDiff = (new Date().getTime() - new Date(sorted[0].updatedAt).getTime()) / (1000 * 3600 * 24);
              setReportNotification(daysDiff > 6);
          }
      }
  }, [appState?.weeklyReports, appState?.currentUser]);

  const toggleTheme = () => {
      const newState = updateAppState(current => ({
          ...current,
          theme: current.theme === 'light' ? 'dark' : 'light'
      }));
      setAppState(newState);
      applyTheme(newState.theme);
  };

  const handleLogin = (user: User) => {
      // Sync latest before login
      fetchFromServer().then(serverData => {
          if (serverData) {
              localStorage.setItem('teamsync_data_v15', JSON.stringify(serverData));
              setAppState(curr => ({...serverData, currentUser: user})); // Optimistic update
          }
      });
      
      const newState = updateAppState(current => ({ ...current, currentUser: user }));
      setAppState(newState);
      setActiveTab('dashboard');
  }

  const handleLogout = () => {
      updateAppState(current => ({ ...current, currentUser: null }));
      window.location.reload(); 
  }

  // --- Handlers Wrappers ---
  // We use updateAppState to ensure we write to disk/server
  
  const createHandler = <T,>(updater: (current: AppState, payload: T) => AppState) => {
      return (payload: T) => {
          const newState = updateAppState(curr => updater(curr, payload));
          setAppState(newState);
      };
  };

  const handleUpdateUser = createHandler((curr, u: User) => ({...curr, users: curr.users.map(us => us.id === u.id ? u : us)}));
  const handleAddUser = createHandler((curr, u: User) => ({...curr, users: [...curr.users, u]}));
  const handleDeleteUser = createHandler((curr, id: string) => ({...curr, users: curr.users.filter(u => u.id !== id)}));
  
  const handleUpdateTeam = createHandler((curr, t: Team) => {
      const teams = curr.teams.map(team => team.id === t.id ? t : team);
      // If team doesn't exist (newly created in some flows), add it
      if (!curr.teams.find(team => team.id === t.id)) teams.push(t);
      return {...curr, teams};
  });
  const handleAddTeam = createHandler((curr, t: Team) => ({...curr, teams: [...curr.teams, t]}));
  const handleDeleteTeam = createHandler((curr, id: string) => ({...curr, teams: curr.teams.filter(t => t.id !== id)}));

  const handleUpdateReport = createHandler((curr, r: WeeklyReportType) => {
      const idx = curr.weeklyReports.findIndex(rep => rep.id === r.id);
      const newReports = [...curr.weeklyReports];
      if (idx >= 0) newReports[idx] = r; else newReports.push(r);
      return {...curr, weeklyReports: newReports};
  });

  const handleUpdateMeeting = createHandler((curr, m: Meeting) => {
      const idx = curr.meetings.findIndex(mt => mt.id === m.id);
      const newMeetings = [...curr.meetings];
      if (idx >= 0) newMeetings[idx] = m; else newMeetings.push(m);
      return {...curr, meetings: newMeetings};
  });
  const handleDeleteMeeting = createHandler((curr, id: string) => ({...curr, meetings: curr.meetings.filter(m => m.id !== id)}));

  const handleUpdateNote = createHandler((curr, n: Note) => {
      const idx = curr.notes.findIndex(nt => nt.id === n.id);
      const newNotes = [...curr.notes];
      if (idx >= 0) newNotes[idx] = n; else newNotes.push(n);
      return {...curr, notes: newNotes};
  });
  const handleDeleteNote = createHandler((curr, id: string) => ({...curr, notes: curr.notes.filter(n => n.id !== id)}));

  const handleUpdateLLMConfig = (config: LLMConfig, prompts?: Record<string, string>) => {
      const newState = updateAppState(curr => ({...curr, llmConfig: config, prompts: prompts || curr.prompts}));
      setAppState(newState);
  };

  const handleUpdateUserPassword = (userId: string, newPass: string) => {
      const newState = updateAppState(curr => ({
          ...curr, 
          users: curr.users.map(u => u.id === userId ? { ...u, password: newPass } : u)
      }));
      setAppState(newState);
  };

  // Import State (Merge Logic could be placed here if needed)
  const handleImportState = (newState: AppState) => {
      setAppState(newState);
      saveState(newState);
      window.location.reload(); 
  }

  // --- View Helper ---
  const getVisibleTeams = () => {
      if (!appState?.currentUser) return [];
      if (appState.currentUser.role === UserRole.ADMIN) return appState.teams;
      // Basic visibility logic: Manager sees own teams, Employees see teams they are in
      return appState.teams; // Simplified for now to allow visibility
  };

  if (!appState) return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">Loading Smart System...</div>;

  if (!appState.currentUser) {
      return <Login users={appState.users} onLogin={handleLogin} />;
  }

  const getPageTitle = () => {
      return activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ');
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen font-sans transition-colors duration-200">
      
      {/* Smart Sync Toast */}
      {showSyncToast && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <div className="flex flex-col">
                  <span className="text-sm font-bold">Data Updated</span>
                  <span className="text-[10px] opacity-80">Synced from server changes</span>
              </div>
          </div>
      )}

      <AIChatSidebar 
        isOpen={isAiSidebarOpen} 
        onClose={() => setIsAiSidebarOpen(false)} 
        llmConfig={appState.llmConfig}
        currentUser={appState.currentUser}
      />

      <Sidebar 
        currentUser={appState.currentUser} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 ml-64 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white capitalize">
                    {getPageTitle()}
                </h2>
                {/* Connection Status Indicator */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${isOnline ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {isOnline ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                    {isOnline ? 'LIVE SYNC' : 'OFFLINE'}
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <button 
                    onClick={() => setIsAiSidebarOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                    <Bot className="w-4 h-4" />
                    AI Assistant
                </button>

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        {appState.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
                    </button>
                    <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative">
                        <Bell className={`w-5 h-5 ${reportNotification ? 'text-red-500' : ''}`} />
                        {reportNotification && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>}
                    </button>
                </div>
            </div>
        </header>

        {/* Content */}
        <div className="p-8">
            {activeTab === 'dashboard' && <KPIDashboard teams={getVisibleTeams()} />}
            {activeTab === 'management' && <ManagementDashboard teams={appState.teams} users={appState.users} reports={appState.weeklyReports} llmConfig={appState.llmConfig} onUpdateReport={handleUpdateReport} onUpdateTeam={handleUpdateTeam} />}
            {activeTab === 'projects' && <ProjectTracker teams={getVisibleTeams()} users={appState.users} currentUser={appState.currentUser} llmConfig={appState.llmConfig} prompts={appState.prompts} onUpdateTeam={handleUpdateTeam} />}
            {activeTab === 'book-of-work' && <BookOfWork teams={getVisibleTeams()} users={appState.users} onUpdateTeam={handleUpdateTeam} />}
            {activeTab === 'weekly-report' && <WeeklyReport reports={appState.weeklyReports} users={appState.users} teams={appState.teams} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onSaveReport={handleUpdateReport} />}
            {activeTab === 'meetings' && <MeetingManager meetings={appState.meetings} teams={appState.teams} users={appState.users} llmConfig={appState.llmConfig} onUpdateMeeting={handleUpdateMeeting} onDeleteMeeting={handleDeleteMeeting} />}
            {activeTab === 'notes' && <NotesManager notes={appState.notes} currentUser={appState.currentUser} llmConfig={appState.llmConfig} onUpdateNote={handleUpdateNote} onDeleteNote={handleDeleteNote} />}
            {activeTab === 'admin-users' && <AdminPanel users={appState.users} teams={appState.teams} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} onAddTeam={handleAddTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam} />}
            {activeTab === 'settings' && <SettingsPanel config={appState.llmConfig} appState={appState} onSave={handleUpdateLLMConfig} onImport={handleImportState} onUpdateUserPassword={handleUpdateUserPassword} />}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AppContent />
        </ErrorBoundary>
    );
};

export default App;