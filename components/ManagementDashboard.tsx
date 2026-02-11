
import React, { useState, useEffect } from 'react';
import { Team, User, WeeklyReport, Task, TaskStatus, ProjectStatus, LLMConfig, Project, TaskPriority, HealthStatus } from '../types';
import { generateManagementInsight, generateRiskAssessment } from '../services/llmService';
import FormattedText from './FormattedText';
import { AlertTriangle, Clock, CheckCircle2, FileText, ChevronDown, ChevronRight, MessageSquare, Check, X, Bot, Loader2, Plus, Zap, Briefcase, Download, Copy, ShieldAlert } from 'lucide-react';

interface ManagementDashboardProps {
  teams: Team[];
  users: User[];
  reports: WeeklyReport[];
  llmConfig?: LLMConfig;
  onUpdateReport: (report: WeeklyReport) => void;
  onUpdateTeam?: (team: Team) => void; // Added to support task creation
}

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ teams, users, reports, llmConfig, onUpdateReport, onUpdateTeam }) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(teams[0]?.id || null);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [annotation, setAnnotation] = useState('');

  // AI Insights State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [insightType, setInsightType] = useState<'synthesis' | 'risk'>('synthesis');

  // Quick Create State
  const [showQuickCreate, setShowQuickCreate] = useState<'none' | 'project' | 'task'>('none');
  const [quickTeamId, setQuickTeamId] = useState(teams[0]?.id || '');
  const [quickProjectId, setQuickProjectId] = useState(''); // Only for task
  
  // Quick Project Form
  const [newProjectName, setNewProjectName] = useState('');
  
  // Quick Task Form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskOrder, setNewTaskOrder] = useState(1);

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

  // --- Helpers for Alerts ---
  const getAlerts = () => {
    let blockedTasks = 0;
    let overdueProjects = 0;
    let pendingReports = 0;

    const today = new Date();
    
    // Check Tasks & Projects
    teams.forEach(t => {
        t.projects.forEach(p => {
            if (p.status !== ProjectStatus.DONE && new Date(p.deadline) < today) overdueProjects++;
            p.tasks.forEach(task => {
                if (task.status === TaskStatus.BLOCKED) blockedTasks++;
            });
        });
    });

    // Check Reports (Current Week)
    // Simplified: Pending if not checked by manager
    pendingReports = reports.filter(r => !r.managerCheck).length;

    return { blockedTasks, overdueProjects, pendingReports };
  };

  const alerts = getAlerts();

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
      const insight = await generateManagementInsight(teams, reports, users, llmConfig);
      setAiInsight(insight);
      setIsAiLoading(false);
  };

  const handleManagerAdvice = async () => {
      if (!llmConfig) return alert("AI not configured");
      setIsAiLoading(true);
      setShowAiModal(true);
      setInsightType('risk');
      setAiInsight('');
      const insight = await generateRiskAssessment(teams, reports, users, llmConfig);
      setAiInsight(insight);
      setIsAiLoading(false);
  }

  const cleanTextForClipboard = (text: string) => {
      return text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/###\s?/g, '') // Remove headers
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links keeping text
          .trim();
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
          members: [],
          tasks: [],
          isImportant: false,
          docUrls: [],
          dependencies: []
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

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in relative">
        
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
                                        {teams.find(t => t.id === quickTeamId)?.projects.map(p => (
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
        
        {/* Top Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800 flex items-center justify-between">
                <div>
                    <p className="text-red-600 dark:text-red-400 font-bold uppercase text-xs tracking-wider">Blocked Tasks</p>
                    <p className="text-3xl font-black text-red-700 dark:text-red-300 mt-1">{alerts.blockedTasks}</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-400 opacity-50" />
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800 flex items-center justify-between">
                <div>
                    <p className="text-amber-600 dark:text-amber-400 font-bold uppercase text-xs tracking-wider">Overdue Projects</p>
                    <p className="text-3xl font-black text-amber-700 dark:text-amber-300 mt-1">{alerts.overdueProjects}</p>
                </div>
                <Clock className="w-10 h-10 text-amber-400 opacity-50" />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                <div>
                    <p className="text-blue-600 dark:text-blue-400 font-bold uppercase text-xs tracking-wider">Reports to Review</p>
                    <p className="text-3xl font-black text-blue-700 dark:text-blue-300 mt-1">{alerts.pendingReports}</p>
                </div>
                <FileText className="w-10 h-10 text-blue-400 opacity-50" />
            </div>
        </div>

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

             <div className="flex gap-3">
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

        {/* ... Rest of the component (Grid, etc.) ... */}
        
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
