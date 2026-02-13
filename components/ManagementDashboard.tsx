
import React, { useState, useEffect, useMemo } from 'react';
import { Team, User, WeeklyReport, Task, TaskStatus, ProjectStatus, LLMConfig, Project, TaskPriority, HealthStatus, Meeting, WorkingGroup, ActionItemStatus, AppNotification, UserRole } from '../types';
import { generateManagementInsight, generateRiskAssessment } from '../services/llmService';
import FormattedText from './FormattedText';
import { AlertTriangle, Clock, CheckCircle2, FileText, ChevronDown, ChevronRight, MessageSquare, Check, X, Bot, Loader2, Plus, Zap, Briefcase, Download, Copy, ShieldAlert, Activity, LayoutList, Target, Layers, Bell, BarChart3 } from 'lucide-react';

interface ManagementDashboardProps {
  teams: Team[];
  users: User[];
  reports: WeeklyReport[];
  meetings: Meeting[];
  workingGroups: WorkingGroup[];
  llmConfig?: LLMConfig;
  notifications: AppNotification[]; 
  currentUser: User | null; 
  onUpdateReport: (report: WeeklyReport) => void;
  onUpdateTeam?: (team: Team) => void; 
  onMarkNotificationRead: (id: string) => void; 
}

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ teams, users, reports, meetings, workingGroups, llmConfig, notifications, currentUser, onUpdateReport, onUpdateTeam, onMarkNotificationRead }) => {
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [annotation, setAnnotation] = useState('');

  // AI Insights State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [insightType, setInsightType] = useState<'synthesis' | 'risk'>('synthesis');
  const [aiLang, setAiLang] = useState<'en'|'fr'>('en');

  // Quick Create State
  const [showQuickCreate, setShowQuickCreate] = useState<'none' | 'project' | 'task'>('none');
  const [quickTeamId, setQuickTeamId] = useState(teams[0]?.id || '');
  const [quickProjectId, setQuickProjectId] = useState(''); 
  
  // Quick Project Form
  const [newProjectName, setNewProjectName] = useState('');
  
  // Quick Task Form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskOrder, setNewTaskOrder] = useState(1);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const adminNotifications = notifications;

  // ... (KPI Aggregation code remains same) ...
  const kpis = useMemo(() => {
      // 1. Projects & Tasks
      const allTasks = teams.flatMap(t => t.projects.filter(p => !p.isArchived).flatMap(p => p.tasks));
      const totalTasks = allTasks.length;
      const blockedTasks = allTasks.filter(t => t.status === TaskStatus.BLOCKED).length;
      const openTasks = allTasks.filter(t => t.status !== TaskStatus.DONE).length;
      const overdueProjects = teams.flatMap(t => t.projects.filter(p => !p.isArchived)).filter(p => p.status !== ProjectStatus.DONE && new Date(p.deadline) < new Date()).length;

      // 2. Meetings
      const allMeetingActions = meetings.flatMap(m => m.actionItems);
      const openMeetingActions = allMeetingActions.filter(a => a.status !== ActionItemStatus.DONE).length;
      const blockedMeetingActions = allMeetingActions.filter(a => a.status === ActionItemStatus.BLOCKED).length;
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const meetingsThisWeek = meetings.filter(m => new Date(m.date) >= oneWeekAgo).length;

      // 3. Working Groups
      const activeGroups = workingGroups.filter(g => !g.archived);
      const allWGSessions = activeGroups.flatMap(g => g.sessions);
      const allWGActions = allWGSessions.flatMap(s => s.actionItems);
      const openWGActions = allWGActions.filter(a => a.status !== ActionItemStatus.DONE).length;
      const blockedWGActions = allWGActions.filter(a => a.status === ActionItemStatus.BLOCKED).length;
      const sessionsThisWeek = allWGSessions.filter(s => new Date(s.date) >= oneWeekAgo).length;

      // 4. Reports
      const pendingReports = reports.filter(r => !r.managerCheck).length;

      // Total Calculations
      const totalOpenActions = openTasks + openMeetingActions + openWGActions;
      const totalBlocked = blockedTasks + blockedMeetingActions + blockedWGActions;
      const totalActivity = meetingsThisWeek + sessionsThisWeek;

      return {
          totalOpenActions,
          totalBlocked,
          totalActivity,
          pendingReports,
          breakdown: {
              tasks: openTasks,
              meetingActions: openMeetingActions,
              wgActions: openWGActions
          },
          alerts: {
              overdueProjects,
              blockedTasks
          }
      };
  }, [teams, meetings, workingGroups, reports]);

  // Handle Escape Key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowAiModal(false);
            setShowQuickCreate('none');
            setSelectedReport(null);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenReport = (report: WeeklyReport) => {
      setSelectedReport(report);
      setAnnotation(report.managerAnnotation || '');
  };

  const handleValidateReport = () => {
      if (!selectedReport) return;
      onUpdateReport({
          ...selectedReport,
          managerCheck: true,
          managerAnnotation: annotation
      });
      setSelectedReport(null);
  };

  const handleGenerateInsight = async () => {
      if (!llmConfig) return alert("AI not configured");
      setIsAiLoading(true);
      setShowAiModal(true);
      setInsightType('synthesis');
      setAiInsight('');
      
      const activeTeams = teams.map(t => ({
          ...t,
          projects: t.projects.filter(p => !p.isArchived)
      }));

      const insight = await generateManagementInsight(activeTeams, reports, users, llmConfig, undefined, aiLang);
      setAiInsight(insight);
      setIsAiLoading(false);
  };

  const handleManagerAdvice = async () => {
      if (!llmConfig) return alert("AI not configured");
      setIsAiLoading(true);
      setShowAiModal(true);
      setInsightType('risk');
      setAiInsight('');

      const activeTeams = teams.map(t => ({
          ...t,
          projects: t.projects.filter(p => !p.isArchived)
      }));

      const insight = await generateRiskAssessment(activeTeams, reports, users, llmConfig, aiLang);
      setAiInsight(insight);
      setIsAiLoading(false);
  }

  // ... (Clipboard & Quick Create functions remain same) ...
  const cleanTextForClipboard = (text: string) => {
      return text.trim();
  };

  const copyToClipboard = () => {
      const plainText = cleanTextForClipboard(aiInsight);
      navigator.clipboard.writeText(plainText);
      alert("Copied to clipboard (Plain Text)!");
  };

  const exportToDoc = () => {
      const element = document.createElement("a");
      const file = new Blob([aiInsight], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "Management_Insight.doc"; 
      document.body.appendChild(element);
      element.click();
  };

  const handleCreateProject = () => {
      if (!onUpdateTeam || !newProjectName) return;
      const team = teams.find(t => t.id === quickTeamId);
      if (!team) return;

      const newProject: Project = {
          id: Date.now().toString(),
          name: newProjectName,
          description: 'Created via Quick Action',
          status: ProjectStatus.PLANNING,
          managerId: team.managerId,
          deadline: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(), 
          members: [],
          tasks: [],
          isImportant: false,
          isArchived: false,
          docUrls: [],
          dependencies: [],
          externalDependencies: [],
          additionalDescriptions: []
      };

      onUpdateTeam({ ...team, projects: [...team.projects, newProject] });
      setNewProjectName('');
      setShowQuickCreate('none');
      alert(`Project "${newProjectName}" created in ${team.name}`);
  };

  const handleCreateTask = () => {
      if (!onUpdateTeam || !newTaskTitle || !quickProjectId) return;
      const team = teams.find(t => t.id === quickTeamId);
      if (!team) return;
      const project = team.projects.find(p => p.id === quickProjectId);
      if (!project) return;

      const newTask: Task = {
          id: Date.now().toString(),
          title: newTaskTitle,
          description: '',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assigneeId: newTaskAssignee || undefined,
          eta: '',
          weight: 1,
          isImportant: false,
          checklist: [],
          actions: [],
          externalDependencies: [],
          docUrls: [],
          order: newTaskOrder || project.tasks.length + 1
      };

      const updatedProjects = team.projects.map(p => {
          if (p.id === quickProjectId) {
              return { ...p, tasks: [...p.tasks, newTask] };
          }
          return p;
      });

      onUpdateTeam({ ...team, projects: updatedProjects });
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setNewTaskOrder(1);
      setShowQuickCreate('none');
      alert(`Task assigned to ${users.find(u => u.id === newTaskAssignee)?.firstName || 'Unassigned'}`);
  };

  const getHealthColor = (status?: HealthStatus) => {
      switch(status) {
          case 'Red': return 'bg-red-500';
          case 'Amber': return 'bg-amber-500';
          case 'Green': return 'bg-emerald-500';
          default: return 'bg-slate-300';
      }
  };

  // ... (Chart Component) ...
  const ActionDistribution = () => {
      const total = kpis.totalOpenActions || 1; 
      const pTasks = (kpis.breakdown.tasks / total) * 100;
      const pMeet = (kpis.breakdown.meetingActions / total) * 100;
      const pWG = (kpis.breakdown.wgActions / total) * 100;

      return (
          <div className="mt-2 w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
              <div style={{ width: `${pTasks}%` }} className="bg-blue-500" title={`Project Tasks: ${kpis.breakdown.tasks}`} />
              <div style={{ width: `${pMeet}%` }} className="bg-purple-500" title={`Meeting Actions: ${kpis.breakdown.meetingActions}`} />
              <div style={{ width: `${pWG}%` }} className="bg-orange-500" title={`WG Actions: ${kpis.breakdown.wgActions}`} />
          </div>
      );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in relative pb-10">
        
        {/* ... (Admin Notifications) ... */}
        {isAdmin && adminNotifications.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-indigo-100 dark:border-indigo-900/30 overflow-hidden">
                {/* ... existing notification code ... */}
                <div className="p-4 bg-indigo-600 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Bell className="w-5 h-5" /> Admin Notifications
                    </h3>
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{adminNotifications.length} New</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {adminNotifications.map(notif => (
                        <div key={notif.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${notif.type === 'REPORT_SUBMITTED' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {notif.type === 'REPORT_SUBMITTED' ? <FileText className="w-4 h-4"/> : <Briefcase className="w-4 h-4"/>}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{notif.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{notif.subtitle}</p>
                                    <span className="text-[10px] text-slate-400">{new Date(notif.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => onMarkNotificationRead(notif.id)}
                                className="text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center gap-1"
                            >
                                <Check className="w-3 h-3" /> Mark Seen
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* CROSS-FUNCTIONAL KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* ... (KPI Cards same as before) ... */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Total Active Work</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{kpis.totalOpenActions}</h3>
                    </div>
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Target className="w-5 h-5" />
                    </div>
                </div>
                <ActionDistribution />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                    <span className="flex items-center"><div className="w-2 h-2 bg-blue-500 rounded-full mr-1"/>Projects</span>
                    <span className="flex items-center"><div className="w-2 h-2 bg-purple-500 rounded-full mr-1"/>Meetings</span>
                    <span className="flex items-center"><div className="w-2 h-2 bg-orange-500 rounded-full mr-1"/>WG</span>
                </div>
            </div>
            
            {/* ... Other KPI Cards ... */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Total Blocked</p>
                        <h3 className={`text-3xl font-black mt-1 ${kpis.totalBlocked > 0 ? 'text-red-600' : 'text-emerald-500'}`}>{kpis.totalBlocked}</h3>
                    </div>
                    <div className={`p-2 rounded-lg ${kpis.totalBlocked > 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>
                <p className="text-xs text-slate-500">
                    <span className="font-bold">{kpis.alerts.blockedTasks}</span> from tasks, <span className="font-bold">{kpis.totalBlocked - kpis.alerts.blockedTasks}</span> from meetings/WGs.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Weekly Activity</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{kpis.totalActivity}</h3>
                    </div>
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>
                <p className="text-xs text-slate-500">
                    Sessions & Meetings held in the last 7 days.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">Pending Reports</p>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-1">{kpis.pendingReports}</h3>
                    </div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                        <FileText className="w-5 h-5" />
                    </div>
                </div>
                <p className="text-xs text-slate-500">
                    Reports waiting for manager validation.
                </p>
            </div>
        </div>

        {/* ALERTS & RISKS SECTION (Consolidated) */}
        {(kpis.alerts.overdueProjects > 0 || kpis.totalBlocked > 0) && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Critical Attention Required</h4>
                    <ul className="mt-1 text-xs text-red-700 dark:text-red-400 list-disc list-inside">
                        {kpis.alerts.overdueProjects > 0 && <li><strong>{kpis.alerts.overdueProjects}</strong> Projects are Overdue.</li>}
                        {kpis.totalBlocked > 0 && <li><strong>{kpis.totalBlocked}</strong> Action items are currently Blocked.</li>}
                    </ul>
                </div>
            </div>
        )}

        {/* Quick Actions & AI Bar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between">
             <div className="flex items-center gap-2">
                 <span className="text-sm font-bold text-slate-500 uppercase tracking-wide mr-2">Quick Actions:</span>
                 <button 
                    onClick={() => setShowQuickCreate('project')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-sm font-medium"
                 >
                     <Briefcase className="w-4 h-4" /> New Project
                 </button>
                 <button 
                    onClick={() => setShowQuickCreate('task')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-sm font-medium"
                 >
                     <CheckCircle2 className="w-4 h-4" /> New Task
                 </button>
             </div>

             <div className="flex gap-3 items-center">
                {/* Language Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 border border-slate-200 dark:border-slate-600">
                    <button 
                        onClick={() => setAiLang('en')}
                        className={`px-2 py-1 text-xs font-bold rounded ${aiLang === 'en' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                    >EN</button>
                    <button 
                        onClick={() => setAiLang('fr')}
                        className={`px-2 py-1 text-xs font-bold rounded ${aiLang === 'fr' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                    >FR</button>
                </div>

                <button 
                    onClick={handleManagerAdvice}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-bold"
                >
                    <ShieldAlert className="w-4 h-4 fill-current" />
                    Manager Advise
                </button>

                <button 
                    onClick={handleGenerateInsight}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm font-bold"
                >
                    <Zap className="w-4 h-4 fill-current" />
                    AI Team Synthesis
                </button>
             </div>
        </div>

        {/* ... (Chart) ... */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    Team Workload Distribution
                </h3>
                {/* Legend */}
                <div className="flex gap-4">
                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>Done</div>
                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>In Progress</div>
                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>Blocked</div>
                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-300"><span className="w-3 h-3 bg-slate-300 dark:bg-slate-600 rounded-full mr-2"></span>To Do</div>
                </div>
            </div>

            <div className="space-y-8">
                {teams.map(team => {
                    // Sort projects by active status first, then name
                    const sortedProjects = [...team.projects].sort((a,b) => {
                        if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
                        return a.name.localeCompare(b.name);
                    });

                    return (
                        <div key={team.id} className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                                {team.name}
                            </h4>
                            {sortedProjects.map(project => {
                                // Filter out archived projects if needed, or keep them with a visual cue
                                if (project.isArchived) return null;

                                let tDone = 0, tProg = 0, tBlock = 0, tTodo = 0;
                                project.tasks.forEach(t => {
                                    if(t.status === TaskStatus.DONE) tDone++;
                                    else if(t.status === TaskStatus.ONGOING) tProg++;
                                    else if(t.status === TaskStatus.BLOCKED) tBlock++;
                                    else tTodo++;
                                });
                                const tTotal = tDone + tProg + tBlock + tTodo;

                                return (
                                    <div key={project.id} className="grid grid-cols-12 gap-4 items-center group">
                                        <div className="col-span-3">
                                            <span className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate block" title={project.name}>
                                                {project.name}
                                            </span>
                                        </div>
                                        <div className="col-span-8">
                                            {tTotal > 0 ? (
                                                <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">
                                                    {tDone > 0 && <div style={{width: `${(tDone/tTotal)*100}%`}} className="bg-emerald-500 h-full" title={`Done: ${tDone}`}></div>}
                                                    {tProg > 0 && <div style={{width: `${(tProg/tTotal)*100}%`}} className="bg-blue-500 h-full" title={`In Progress: ${tProg}`}></div>}
                                                    {tBlock > 0 && <div style={{width: `${(tBlock/tTotal)*100}%`}} className="bg-red-500 h-full" title={`Blocked: ${tBlock}`}></div>}
                                                    {tTodo > 0 && <div style={{width: `${(tTodo/tTotal)*100}%`}} className="bg-slate-300 dark:bg-slate-600 h-full" title={`Todo: ${tTodo}`}></div>}
                                                </div>
                                            ) : (
                                                <div className="h-3 w-full bg-slate-50 dark:bg-slate-800 rounded-full border border-dashed border-slate-200 dark:border-slate-700"></div>
                                            )}
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <span className="text-xs font-mono text-slate-400">{tTotal} tasks</span>
                                        </div>
                                    </div>
                                )
                            })}
                            {sortedProjects.filter(p => !p.isArchived).length === 0 && (
                                <p className="text-xs text-slate-400 italic pl-2">No active projects.</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* ... (AI Modal, Quick Create Modal, Report Modal logic remains same) ... */}
        
        {/* AI Insight Modal */}
        {showAiModal && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className={`p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${insightType === 'risk' ? 'bg-red-600' : 'bg-indigo-600'} rounded-t-2xl`}>
                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            {insightType === 'risk' ? <ShieldAlert className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                            {insightType === 'risk' ? 'Critical Risk Assessment' : 'AI Management Synthesis'}
                        </h3>
                        <button onClick={() => setShowAiModal(false)} className="text-white hover:text-slate-200">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-8 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                        {isAiLoading ? (
                            <div className="flex flex-col items-center justify-center h-64">
                                <Loader2 className={`w-12 h-12 animate-spin mb-4 ${insightType === 'risk' ? 'text-red-500' : 'text-indigo-500'}`} />
                                <p className="text-slate-500 font-medium">
                                    {insightType === 'risk' ? 'Auditing project risks and resource health...' : 'Analyzing team dynamics and reports...'}
                                </p>
                            </div>
                        ) : (
                            <div className="prose prose-slate dark:prose-invert max-w-none">
                                <FormattedText text={aiInsight} />
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 rounded-b-2xl">
                         <button onClick={() => setShowAiModal(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-medium transition-colors">Close</button>
                         <div className="flex gap-2">
                            <button 
                                onClick={exportToDoc}
                                disabled={isAiLoading}
                                className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                Export (.doc)
                            </button>
                            <button 
                                onClick={copyToClipboard}
                                disabled={isAiLoading}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${insightType === 'risk' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                <Copy className="w-4 h-4" />
                                Copy
                            </button>
                         </div>
                    </div>
                </div>
             </div>
        )}

        {/* ... (Quick Create Modal and Review Report Modal same as before) ... */}
        
        {/* Quick Create Modal */}
        {showQuickCreate !== 'none' && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                 <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 p-6">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                             {showQuickCreate === 'project' ? <Briefcase className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
                             {showQuickCreate === 'project' ? 'New Project' : 'New Task'}
                         </h3>
                         <button onClick={() => setShowQuickCreate('none')}><X className="w-5 h-5 text-slate-400"/></button>
                     </div>

                     <div className="space-y-4">
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Team</label>
                             <select 
                                value={quickTeamId} 
                                onChange={e => { setQuickTeamId(e.target.value); setQuickProjectId(''); }}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                             >
                                 {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                             </select>
                         </div>

                         {showQuickCreate === 'project' && (
                             <div>
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                                 <input 
                                    type="text" 
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    placeholder="e.g. Website Redesign"
                                 />
                             </div>
                         )}

                         {showQuickCreate === 'task' && (
                             <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Project</label>
                                    <select 
                                        value={quickProjectId} 
                                        onChange={e => setQuickProjectId(e.target.value)}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="">-- Choose Project --</option>
                                        {teams.find(t => t.id === quickTeamId)?.projects.filter(p => !p.isArchived).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                                        <input 
                                            type="text" 
                                            value={newTaskTitle}
                                            onChange={e => setNewTaskTitle(e.target.value)}
                                            className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            placeholder="e.g. Fix login bug"
                                        />
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order</label>
                                        <input 
                                            type="number" 
                                            value={newTaskOrder}
                                            onChange={e => setNewTaskOrder(parseInt(e.target.value))}
                                            className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign To</label>
                                     <select 
                                        value={newTaskAssignee}
                                        onChange={e => setNewTaskAssignee(e.target.value)}
                                        className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="">-- Unassigned --</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                    </select>
                                </div>
                             </>
                         )}

                         <button 
                            onClick={showQuickCreate === 'project' ? handleCreateProject : handleCreateTask}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors mt-4"
                         >
                             Create
                         </button>
                     </div>
                 </div>
             </div>
        )}
        
        {/* Modal Review Report */}
        {selectedReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl">
                        <div>
                             <h3 className="font-bold text-lg text-slate-900 dark:text-white">Review Report</h3>
                             <p className="text-xs text-slate-500">
                                 Employee: {users.find(u => u.id === selectedReport.userId)?.firstName} | Week: {selectedReport.weekOf}
                             </p>
                        </div>
                        <button onClick={() => setSelectedReport(null)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        {/* ... (Report Content) ... */}
                        <div className="flex gap-4 mb-2">
                            {selectedReport.teamHealth && (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getHealthColor(selectedReport.teamHealth)}`}>
                                    Team: {selectedReport.teamHealth}
                                </div>
                            )}
                            {selectedReport.projectHealth && (
                                <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getHealthColor(selectedReport.projectHealth)}`}>
                                    Projects: {selectedReport.projectHealth}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                <span className="text-xs font-bold text-emerald-700 uppercase">Success</span>
                                <p className="text-sm mt-1">{selectedReport.mainSuccess}</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                                <span className="text-xs font-bold text-red-700 uppercase">Issues</span>
                                <p className="text-sm mt-1">{selectedReport.mainIssue}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-500 uppercase">Incidents / Orga</span>
                            <p className="text-sm mt-1">{selectedReport.incident} / {selectedReport.orgaPoint}</p>
                        </div>
                        {selectedReport.otherSection && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-500 uppercase">Other</span>
                                <p className="text-sm mt-1">{selectedReport.otherSection}</p>
                            </div>
                        )}

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Manager Annotation
                            </label>
                            <textarea 
                                value={annotation}
                                onChange={e => setAnnotation(e.target.value)}
                                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Add your feedback here..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                        <button 
                            onClick={() => setSelectedReport(null)}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleValidateReport}
                            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            Validate & Save
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default ManagementDashboard;
