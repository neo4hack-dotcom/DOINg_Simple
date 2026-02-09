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

import { loadState, saveState } from './services/storage';
import { AppState, User, Team, UserRole, Meeting, LLMConfig, WeeklyReport as WeeklyReportType, ProjectRole, Note } from './types';
import { Search, Bell, Sun, Moon, Bot, AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// --- Error Boundary for Robustness ---
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

  handleReload = () => {
      window.location.reload();
  }

  handleReset = () => {
      if(window.confirm("This will reset local data to fix the crash. Continue?")) {
          localStorage.clear();
          window.location.reload();
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-red-100 dark:border-red-900/30 p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Application Error</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Something went wrong in the application. This might be due to a data conflict or a temporary glitch.
            </p>
            <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs font-mono text-left overflow-auto max-h-32 mb-6 text-red-800 dark:text-red-300">
                {this.state.error?.toString()}
            </div>
            <div className="flex gap-3 justify-center">
                <button 
                    onClick={this.handleReload}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Reload App
                </button>
                <button 
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                >
                    Reset Data
                </button>
            </div>
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
  
  // AI Sidebar State
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  useEffect(() => {
    // Load initial data
    const data = loadState();
    setAppState(data);
    // Apply theme
    if (data.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    // Save on change
    if (appState) {
      saveState(appState);
    }
  }, [appState]);

  // Check for stale reports
  useEffect(() => {
      if (appState && appState.currentUser) {
          const userReports = appState.weeklyReports.filter(r => r.userId === appState.currentUser?.id);
          if (userReports.length === 0) {
              setReportNotification(true);
          } else {
              // Find most recent
              const sorted = userReports.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
              const lastReport = sorted[0];
              const daysDiff = (new Date().getTime() - new Date(lastReport.updatedAt).getTime()) / (1000 * 3600 * 24);
              setReportNotification(daysDiff > 6);
          }
      }
  }, [appState?.weeklyReports, appState?.currentUser]);

  const toggleTheme = () => {
      if (!appState) return;
      const newTheme = appState.theme === 'light' ? 'dark' : 'light';
      setAppState({ ...appState, theme: newTheme });
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
  };

  const handleLogin = (user: User) => {
      if (!appState) return;
      setAppState({ ...appState, currentUser: user });
      // Reset tab on login
      setActiveTab('dashboard');
  }

  const handleLogout = () => {
      if (!appState) return;
      setAppState({ ...appState, currentUser: null });
      window.location.reload(); 
  }

  const handleUpdateUserPassword = (userId: string, newPass: string) => {
      if (!appState) return;
      setAppState({
          ...appState,
          users: appState.users.map(u => u.id === userId ? { ...u, password: newPass } : u)
      });
  }

  // --- CRUD Handlers ---

  const handleAddUser = (user: User) => {
    if (!appState) return;
    setAppState({
      ...appState,
      users: [...appState.users, user]
    });
  };

  const handleUpdateUser = (updatedUser: User) => {
      if (!appState) return;
      setAppState({
          ...appState,
          users: appState.users.map(u => u.id === updatedUser.id ? updatedUser : u)
      });
  };

  const handleDeleteUser = (userId: string) => {
    if (!appState) return;
    setAppState({
        ...appState,
        users: appState.users.filter(u => u.id !== userId)
    })
  }

  const handleAddTeam = (team: Team) => {
      if (!appState) return;
      setAppState({
          ...appState,
          teams: [...appState.teams, team]
      });
  };

  const handleDeleteTeam = (teamId: string) => {
      if (!appState) return;
      setAppState({
          ...appState,
          teams: appState.teams.filter(t => t.id !== teamId)
      });
  };

  const handleUpdateTeam = (updatedTeam: Team) => {
    if (!appState) return;
    const newTeams = appState.teams.map(t => t.id === updatedTeam.id ? updatedTeam : t);
    setAppState({
      ...appState,
      teams: newTeams
    });
  };

  const handleUpdateMeeting = (updatedMeeting: Meeting) => {
    if (!appState) return;
    const exists = appState.meetings.find(m => m.id === updatedMeeting.id);
    let newMeetings;
    if (exists) {
        newMeetings = appState.meetings.map(m => m.id === updatedMeeting.id ? updatedMeeting : m);
    } else {
        newMeetings = [...appState.meetings, updatedMeeting];
    }
    // Sort by date desc
    newMeetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setAppState({
        ...appState,
        meetings: newMeetings
    });
  };

  const handleDeleteMeeting = (id: string) => {
      if (!appState) return;
      setAppState({
          ...appState,
          meetings: appState.meetings.filter(m => m.id !== id)
      });
  };

  const handleUpdateReport = (report: WeeklyReportType) => {
      if (!appState) return;
      const existingIndex = appState.weeklyReports.findIndex(r => r.id === report.id);
      let newReports;
      if (existingIndex >= 0) {
          newReports = [...appState.weeklyReports];
          newReports[existingIndex] = report;
      } else {
          newReports = [...appState.weeklyReports, report];
      }
      setAppState({
          ...appState,
          weeklyReports: newReports
      });
  }

  const handleUpdateNote = (note: Note) => {
      if (!appState) return;
      const existingIndex = appState.notes.findIndex(n => n.id === note.id);
      let newNotes;
      if (existingIndex >= 0) {
          newNotes = [...appState.notes];
          newNotes[existingIndex] = note;
      } else {
          newNotes = [...appState.notes, note];
      }
      setAppState({ ...appState, notes: newNotes });
  };

  const handleDeleteNote = (id: string) => {
      if (!appState) return;
      setAppState({
          ...appState,
          notes: appState.notes.filter(n => n.id !== id)
      });
  };

  const handleUpdateLLMConfig = (newConfig: LLMConfig, newPrompts?: Record<string, string>) => {
      if (!appState) return;
      setAppState({
          ...appState,
          llmConfig: newConfig,
          prompts: newPrompts || appState.prompts
      });
  };

  const handleImportState = (newState: AppState) => {
      setAppState(newState);
      saveState(newState); // Force save
      window.location.reload(); 
  }

  // --- RECURSIVE HIERARCHY LOGIC ---
  const getAllSubordinateIds = (managerId: string, allUsers: User[]): string[] => {
      const subordinates: string[] = [];
      const directs = allUsers.filter(u => u.managerId === managerId);
      
      directs.forEach(d => {
          subordinates.push(d.id);
          // Recursive call
          subordinates.push(...getAllSubordinateIds(d.id, allUsers));
      });
      
      return subordinates;
  };

  // --- Filtering Logic for Views ---
  const getVisibleTeams = () => {
      if (!appState || !appState.currentUser) return [];
      const { currentUser, teams, users } = appState;
      if (currentUser.role === UserRole.ADMIN) return teams;
      return teams.filter(t => 
          t.managerId === currentUser.id || 
          getAllSubordinateIds(currentUser.id, users).includes(t.managerId) ||
          t.projects.some(p => p.members.some(m => m.userId === currentUser.id) || p.managerId === currentUser.id)
      );
  };

  const getVisibleReports = () => {
      if (!appState || !appState.currentUser) return [];
      const { currentUser, weeklyReports, users } = appState;
      if (currentUser.role === UserRole.ADMIN) return weeklyReports;
      const subIds = getAllSubordinateIds(currentUser.id, users);
      return weeklyReports.filter(r => r.userId === currentUser.id || subIds.includes(r.userId));
  };

  const getVisibleMeetings = () => {
      if (!appState || !appState.currentUser) return [];
      const { currentUser, meetings, teams, users } = appState;
      if (currentUser.role === UserRole.ADMIN) return meetings;
      const subIds = getAllSubordinateIds(currentUser.id, users);
      return meetings.filter(m => {
          const isAttendee = m.attendees.includes(currentUser.id);
          const team = teams.find(t => t.id === m.teamId);
          const isTeamManager = team && (team.managerId === currentUser.id || subIds.includes(team.managerId));
          return isAttendee || isTeamManager;
      });
  };


  if (!appState) return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500">Loading Workspace...</div>;

  // Not Logged In
  if (!appState.currentUser) {
      return <Login users={appState.users} onLogin={handleLogin} />;
  }

  const renderContent = () => {
    const visibleTeams = getVisibleTeams();
    const visibleReports = getVisibleReports();
    const visibleMeetings = getVisibleMeetings();

    switch (activeTab) {
      case 'dashboard':
        return <KPIDashboard teams={visibleTeams} />;
      case 'management':
         if (appState.currentUser?.role !== UserRole.ADMIN) return <div className="p-8 text-red-500">Access Restricted. Admins Only.</div>;
         return <ManagementDashboard 
            teams={appState.teams} 
            users={appState.users} 
            reports={appState.weeklyReports} 
            llmConfig={appState.llmConfig}
            onUpdateReport={handleUpdateReport}
            onUpdateTeam={handleUpdateTeam}
         />;
      case 'projects':
        return <ProjectTracker 
            teams={visibleTeams} 
            users={appState.users} 
            currentUser={appState.currentUser} 
            llmConfig={appState.llmConfig}
            prompts={appState.prompts}
            onUpdateTeam={handleUpdateTeam} 
        />;
      case 'book-of-work': 
        return <BookOfWork teams={visibleTeams} users={appState.users} onUpdateTeam={handleUpdateTeam} />;
      case 'weekly-report': 
        return <WeeklyReport 
            reports={visibleReports} 
            users={appState.users} 
            currentUser={appState.currentUser}
            llmConfig={appState.llmConfig} 
            onSaveReport={handleUpdateReport}
        />;
      case 'meetings':
        return <MeetingManager 
                    meetings={visibleMeetings} 
                    teams={visibleTeams} 
                    users={appState.users}
                    llmConfig={appState.llmConfig} 
                    onUpdateMeeting={handleUpdateMeeting}
                    onDeleteMeeting={handleDeleteMeeting}
                />;
      case 'notes': 
        return <NotesManager 
                    notes={appState.notes || []} 
                    currentUser={appState.currentUser}
                    llmConfig={appState.llmConfig}
                    onUpdateNote={handleUpdateNote}
                    onDeleteNote={handleDeleteNote}
                />;
      case 'admin-users':
         if (appState.currentUser?.role !== UserRole.ADMIN) return <div className="p-8 text-red-500">Access Restricted. Admins Only.</div>;
        return <AdminPanel 
            users={appState.users} 
            teams={appState.teams}
            onAddUser={handleAddUser} 
            onUpdateUser={handleUpdateUser} 
            onDeleteUser={handleDeleteUser}
            onAddTeam={handleAddTeam}
            onDeleteTeam={handleDeleteTeam}
        />;
      case 'settings': 
         if (appState.currentUser?.role !== UserRole.ADMIN) return <div className="p-8 text-red-500">Access Restricted. Admins Only.</div>;
         return <SettingsPanel 
            config={appState.llmConfig} 
            appState={appState} 
            onSave={handleUpdateLLMConfig} 
            onImport={handleImportState} 
            onUpdateUserPassword={handleUpdateUserPassword}
        />;
      default:
        return <KPIDashboard teams={visibleTeams} />;
    }
  };

  const getPageTitle = () => {
      switch(activeTab) {
          case 'dashboard': return 'Dashboard';
          case 'management': return 'Management Console';
          case 'projects': return 'Project Portfolio';
          case 'book-of-work': return 'Book of Work';
          case 'weekly-report': return 'Weekly Report';
          case 'meetings': return 'Meeting Minutes';
          case 'notes': return 'Notes & Canvas';
          case 'admin-users': return 'System Administration';
          case 'settings': return 'Configuration';
          default: return 'Workspace';
      }
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen font-sans transition-colors duration-200">
      
      {/* AI Sidebar */}
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
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-40">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {getPageTitle()}
            </h2>
            
            <div className="flex items-center gap-6">
                {/* AI Assistant Toggle */}
                <button 
                    onClick={() => setIsAiSidebarOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                    <Bot className="w-4 h-4" />
                    AI Assistant
                </button>

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button 
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        {appState.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
                    </button>
                    <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative" title={reportNotification ? "Missing Report (>6 days)" : "Notifications"}>
                        <Bell className={`w-5 h-5 ${reportNotification ? 'text-red-500' : ''}`} />
                        {reportNotification ? (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                        ) : null}
                    </button>
                </div>
            </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
            {renderContent()}
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