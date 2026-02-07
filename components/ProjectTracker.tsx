
import React, { useState } from 'react';
import { Team, Project, Task, TaskStatus, TaskPriority, ProjectStatus, User, LLMConfig, ChecklistItem, ExternalDependency } from '../types';
import { generateTeamReport } from '../services/llmService';
import FormattedText from './FormattedText';
import { 
    CheckCircle2, Clock, AlertCircle, PlayCircle, PauseCircle, Plus, 
    ChevronDown, Bot, Calendar, Users as UsersIcon, MoreHorizontal, 
    Flag, UserCircle2, Pencil, AlertTriangle, X, Save, Trash2, Scale, ListTodo, ArrowUpAz, Download, Copy, Eye, EyeOff, Sparkles, Briefcase, Link2
} from 'lucide-react';

interface ProjectTrackerProps {
  teams: Team[];
  users: User[];
  currentUser: User | null;
  llmConfig: LLMConfig;
  prompts?: Record<string, string>; // New Prop for Prompts
  onUpdateTeam: (team: Team) => void;
}

const ProjectTracker: React.FC<ProjectTrackerProps> = ({ teams, users, currentUser, llmConfig, prompts, onUpdateTeam }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Modals state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<{ projectId: string, task: Task } | null>(null);
  
  // New Checklist Item State
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // New Dependency State
  const [newDepLabel, setNewDepLabel] = useState('');
  const [newDepStatus, setNewDepStatus] = useState<'Green' | 'Amber' | 'Red'>('Green');

  // View Context State
  const [showContextForProject, setShowContextForProject] = useState<string | null>(null);

  const currentTeam = teams.find(t => t.id === selectedTeamId);
  const teamManager = users.find(u => u.id === currentTeam?.managerId);

  // --- Helper Functions ---

  const getStatusColor = (status: TaskStatus | ProjectStatus) => {
    switch (status) {
      case ProjectStatus.DONE:
      case TaskStatus.DONE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
      case ProjectStatus.ACTIVE:
      case TaskStatus.ONGOING: return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
      case TaskStatus.BLOCKED: return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20';
      case ProjectStatus.PAUSED: return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
      case ProjectStatus.PLANNING: return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
      switch(priority) {
          case TaskPriority.URGENT: return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
          case TaskPriority.HIGH: return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
          case TaskPriority.MEDIUM: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
          case TaskPriority.LOW: return 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';
      }
  };

  const getRagColor = (status: 'Red' | 'Amber' | 'Green') => {
      switch(status) {
          case 'Red': return 'bg-red-500 text-white';
          case 'Amber': return 'bg-amber-500 text-white';
          case 'Green': return 'bg-emerald-500 text-white';
          default: return 'bg-slate-400';
      }
  };

  const handleGenerateReport = async () => {
    if (!currentTeam) return;
    setLoadingAi(true);
    setAiReport(null);
    // Pass prompts prop
    const report = await generateTeamReport(currentTeam, teamManager, llmConfig, prompts);
    setAiReport(report);
    setLoadingAi(false);
  };

  const copyToClipboard = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport);
    alert("Copied to clipboard!");
  };

  const exportToDoc = () => {
      if (!aiReport) return;
      const element = document.createElement("a");
      const file = new Blob([aiReport], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = "Team_Report_AI.doc"; 
      document.body.appendChild(element);
      element.click();
  };

  const updateTeamData = (fn: (t: Team) => void) => {
      if(!currentTeam) return;
      const updatedTeam = { ...currentTeam };
      fn(updatedTeam);
      onUpdateTeam(updatedTeam);
  }

  const handleCreateProject = () => {
      // Default new project structure
      const newProject: Project = {
          id: Date.now().toString(),
          name: '',
          description: '',
          status: ProjectStatus.PLANNING,
          managerId: currentUser?.id,
          deadline: new Date().toISOString().split('T')[0],
          members: [],
          tasks: [],
          isImportant: false,
          docUrls: [],
          dependencies: [],
          externalDependencies: [],
          additionalDescriptions: []
      };
      setEditingProject(newProject);
  };

  const handleDeleteProject = (projectId: string) => {
      if(!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;
      updateTeamData(team => {
          team.projects = team.projects.filter(p => p.id !== projectId);
      });
      if(expandedProjectId === projectId) setExpandedProjectId(null);
  };

  const handleAddTask = (projectId: string) => {
      const newTask: Task = {
          id: Date.now().toString(),
          title: '',
          description: '',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          assigneeId: '',
          eta: '',
          weight: 1,
          isImportant: false,
          checklist: [],
          externalDependencies: [],
          order: 1
      };
      setEditingTask({ projectId, task: newTask });
  };

  const handleDeleteTask = (projectId: string, taskId: string) => {
      if(!window.confirm("Delete this task?")) return;
      updateTeamData(team => {
          const project = team.projects.find(p => p.id === projectId);
          if(project) {
              project.tasks = project.tasks.filter(t => t.id !== taskId);
          }
      });
  };

  const handleTaskUpdate = (projectId: string, taskId: string, field: keyof Task, value: any) => {
    updateTeamData(team => {
        const project = team.projects.find(p => p.id === projectId);
        if(project) {
            const task = project.tasks.find(t => t.id === taskId);
            if(task) (task as any)[field] = value;
        }
    });
  };

  const handleProjectUpdate = (projectId: string, field: keyof Project, value: any) => {
    updateTeamData(team => {
        const project = team.projects.find(p => p.id === projectId);
        if(project) (project as any)[field] = value;
    });
  };

  const handleSaveProject = () => {
      if (!editingProject) return;
      updateTeamData(team => {
          const idx = team.projects.findIndex(p => p.id === editingProject.id);
          if (idx !== -1) {
              team.projects[idx] = editingProject;
          } else {
              // New Project
              team.projects.push(editingProject);
          }
      });
      setEditingProject(null);
  };

  const handleSaveTask = () => {
      if (!editingTask) return;
      updateTeamData(team => {
        const project = team.projects.find(p => p.id === editingTask.projectId);
        if(project) {
            const idx = project.tasks.findIndex(t => t.id === editingTask.task.id);
            if(idx !== -1) {
                project.tasks[idx] = editingTask.task;
            } else {
                project.tasks.push(editingTask.task);
            }
        }
      });
      setEditingTask(null);
  };

  // Checklist Handlers
  const handleAddChecklistItem = () => {
      if (!editingTask || !newChecklistItem.trim()) return;
      const newItem: ChecklistItem = {
          id: Date.now().toString(),
          text: newChecklistItem,
          done: false
      };
      setEditingTask({
          ...editingTask,
          task: { ...editingTask.task, checklist: [...(editingTask.task.checklist || []), newItem] }
      });
      setNewChecklistItem('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
      if (!editingTask) return;
      const updatedList = (editingTask.task.checklist || []).map(item => 
        item.id === itemId ? { ...item, done: !item.done } : item
      );
      setEditingTask({ ...editingTask, task: { ...editingTask.task, checklist: updatedList } });
  };

  const handleDeleteChecklistItem = (itemId: string) => {
      if (!editingTask) return;
      const updatedList = (editingTask.task.checklist || []).filter(item => item.id !== itemId);
      setEditingTask({ ...editingTask, task: { ...editingTask.task, checklist: updatedList } });
  };

  // --- External Dependency Handlers ---
  const addExternalDependency = (type: 'project' | 'task') => {
      if (!newDepLabel.trim()) return;
      const newDep: ExternalDependency = {
          id: Date.now().toString(),
          label: newDepLabel,
          status: newDepStatus
      };

      if (type === 'project' && editingProject) {
          setEditingProject({
              ...editingProject,
              externalDependencies: [...(editingProject.externalDependencies || []), newDep]
          });
      } else if (type === 'task' && editingTask) {
          setEditingTask({
              ...editingTask,
              task: {
                  ...editingTask.task,
                  externalDependencies: [...(editingTask.task.externalDependencies || []), newDep]
              }
          });
      }
      setNewDepLabel('');
      setNewDepStatus('Green');
  };

  const removeExternalDependency = (id: string, type: 'project' | 'task') => {
      if (type === 'project' && editingProject) {
          setEditingProject({
              ...editingProject,
              externalDependencies: (editingProject.externalDependencies || []).filter(d => d.id !== id)
          });
      } else if (type === 'task' && editingTask) {
          setEditingTask({
              ...editingTask,
              task: {
                  ...editingTask.task,
                  externalDependencies: (editingTask.task.externalDependencies || []).filter(d => d.id !== id)
              }
          });
      }
  };

  const updateExternalDependencyStatus = (id: string, status: 'Red'|'Amber'|'Green', type: 'project'|'task') => {
      if (type === 'project' && editingProject) {
          const updated = (editingProject.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d);
          setEditingProject({ ...editingProject, externalDependencies: updated });
      } else if (type === 'task' && editingTask) {
          const updated = (editingTask.task.externalDependencies || []).map(d => d.id === id ? { ...d, status } : d);
          setEditingTask({ ...editingTask, task: { ...editingTask.task, externalDependencies: updated } });
      }
  };
  
  // Context Descriptions Handler
  const updateAdditionalDescription = (index: number, value: string) => {
      if (!editingProject) return;
      const newDescriptions = [...(editingProject.additionalDescriptions || ['', '', ''])];
      newDescriptions[index] = value;
      setEditingProject({ ...editingProject, additionalDescriptions: newDescriptions });
  };

  const calculateWeightedProgress = (tasks: Task[]) => {
      if (tasks.length === 0) return 0;
      const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
      const doneWeight = tasks.filter(t => t.status === TaskStatus.DONE).reduce((sum, t) => sum + (t.weight || 1), 0);
      return totalWeight > 0 ? (doneWeight / totalWeight) * 100 : 0;
  };

  const getProjectHealth = (project: Project) => {
      const blocked = project.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
      const today = new Date();
      const deadline = new Date(project.deadline);
      const isOverdue = today > deadline && project.status !== ProjectStatus.DONE;
      
      if (isOverdue || blocked > 2) return { label: 'Off Track', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' };
      if (blocked > 0 || (deadline.getTime() - today.getTime()) < 604800000) return { label: 'At Risk', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' };
      return { label: 'On Track', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' };
  };

  if (!currentTeam) return <div className="p-8 text-center text-slate-500">Please select a team.</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto relative">
      
      {/* Project Edit Modal */}
      {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                      <h3 className="text-lg font-bold dark:text-white">{editingProject.id && editingProject.name ? 'Edit Project' : 'Create New Project'}</h3>
                      <button onClick={() => setEditingProject(null)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                          <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                          <textarea value={editingProject.description} onChange={e => setEditingProject({...editingProject, description: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select value={editingProject.status} onChange={e => setEditingProject({...editingProject, status: e.target.value as ProjectStatus})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deadline</label>
                            <input type="date" value={editingProject.deadline} onChange={e => setEditingProject({...editingProject, deadline: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                      </div>

                      {/* Project Dependencies */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Link2 className="w-4 h-4" /> External Dependencies (System/Person)
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingProject.externalDependencies || []).map(dep => (
                                  <div key={dep.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                      <select 
                                        value={dep.status} 
                                        onChange={(e) => updateExternalDependencyStatus(dep.id, e.target.value as any, 'project')}
                                        className={`w-4 h-4 rounded-full appearance-none cursor-pointer ${getRagColor(dep.status)} border-none focus:ring-0`}
                                      >
                                          <option value="Green">Green</option>
                                          <option value="Amber">Amber</option>
                                          <option value="Red">Red</option>
                                      </select>
                                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{dep.label}</span>
                                      <button onClick={() => removeExternalDependency(dep.id, 'project')} className="text-slate-400 hover:text-red-500">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={newDepLabel}
                                onChange={e => setNewDepLabel(e.target.value)}
                                placeholder="Dependency Name (e.g. API Team)"
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              />
                              <select 
                                value={newDepStatus}
                                onChange={e => setNewDepStatus(e.target.value as any)}
                                className="p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              >
                                  <option value="Green">Green</option>
                                  <option value="Amber">Amber</option>
                                  <option value="Red">Red</option>
                              </select>
                              <button onClick={() => addExternalDependency('project')} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">Add</button>
                          </div>
                      </div>

                      {/* AI Context Fields (Hidden by default logic handled in rendering, here we show inputs) */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                          <label className="block text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-2 flex items-center">
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI Context Layers (Hidden & Optional)
                          </label>
                          <p className="text-xs text-slate-500 mb-3">
                              These fields are hidden from the main view but used by the AI to understand the project better (e.g., technical debt details, political context, client specificities).
                          </p>
                          <div className="space-y-3">
                              {[0, 1, 2].map(i => (
                                  <div key={i}>
                                      <label className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Context Layer {i+1}</label>
                                      <textarea 
                                          value={(editingProject.additionalDescriptions && editingProject.additionalDescriptions[i]) || ''}
                                          onChange={e => updateAdditionalDescription(i, e.target.value)}
                                          maxLength={2000}
                                          rows={2}
                                          className="w-full p-2 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 focus:ring-1 focus:ring-indigo-500"
                                          placeholder={`Add private context for AI... (Max 2000 chars)`}
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                          <input type="checkbox" id="projImp" checked={editingProject.isImportant} onChange={e => setEditingProject({...editingProject, isImportant: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                          <label htmlFor="projImp" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Mark as Important</label>
                      </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                      <button onClick={handleSaveProject} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Save Changes</button>
                  </div>
              </div>
          </div>
      )}

      {/* Task Edit Modal */}
      {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h3 className="text-lg font-bold dark:text-white">Edit Task</h3>
                      <button onClick={() => setEditingTask(null)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
                              <input type="text" value={editingTask.task.title} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, title: e.target.value}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                          <div className="w-20">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Order</label>
                              <input type="number" value={editingTask.task.order || 0} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, order: parseInt(e.target.value)}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <select value={editingTask.task.status} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, status: e.target.value as TaskStatus}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                            <select value={editingTask.task.priority} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, priority: e.target.value as TaskPriority}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                {Object.values(TaskPriority).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Weight (Impact)</label>
                            <input type="number" min="1" max="10" value={editingTask.task.weight || 1} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, weight: parseInt(e.target.value) || 1}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label>
                            <select value={editingTask.task.assigneeId || ''} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, assigneeId: e.target.value}})} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                                <option value="">Unassigned</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                            </select>
                          </div>
                      </div>

                      {/* Task Dependencies (External) */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <Link2 className="w-4 h-4" /> External Dependencies (System/Person)
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingTask.task.externalDependencies || []).map(dep => (
                                  <div key={dep.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                      <select 
                                        value={dep.status} 
                                        onChange={(e) => updateExternalDependencyStatus(dep.id, e.target.value as any, 'task')}
                                        className={`w-4 h-4 rounded-full appearance-none cursor-pointer ${getRagColor(dep.status)} border-none focus:ring-0`}
                                      >
                                          <option value="Green">Green</option>
                                          <option value="Amber">Amber</option>
                                          <option value="Red">Red</option>
                                      </select>
                                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{dep.label}</span>
                                      <button onClick={() => removeExternalDependency(dep.id, 'task')} className="text-slate-400 hover:text-red-500">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={newDepLabel}
                                onChange={e => setNewDepLabel(e.target.value)}
                                placeholder="Dependency Name (e.g. Legal Check)"
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              />
                              <select 
                                value={newDepStatus}
                                onChange={e => setNewDepStatus(e.target.value as any)}
                                className="p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                              >
                                  <option value="Green">Green</option>
                                  <option value="Amber">Amber</option>
                                  <option value="Red">Red</option>
                              </select>
                              <button onClick={() => addExternalDependency('task')} className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">Add</button>
                          </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                          <input type="checkbox" id="taskImp" checked={editingTask.task.isImportant} onChange={e => setEditingTask({...editingTask, task: {...editingTask.task, isImportant: e.target.checked}})} className="w-4 h-4 text-indigo-600 rounded" />
                          <label htmlFor="taskImp" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-red-500" /> Mark as Important</label>
                      </div>

                      {/* Checklist Section */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                              <ListTodo className="w-4 h-4" /> Checklist
                          </label>
                          <div className="space-y-2 mb-2">
                              {(editingTask.task.checklist || []).map(item => (
                                  <div key={item.id} className="flex items-center gap-2 group">
                                      <input 
                                        type="checkbox" 
                                        checked={item.done} 
                                        onChange={() => handleToggleChecklistItem(item.id)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer" 
                                      />
                                      <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                          {item.text}
                                      </span>
                                      <button onClick={() => handleDeleteChecklistItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={newChecklistItem}
                                onChange={e => setNewChecklistItem(e.target.value)}
                                placeholder="New item..."
                                className="flex-1 p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
                              />
                              <button onClick={handleAddChecklistItem} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium">Add</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-between pt-4">
                      <button onClick={() => handleDeleteTask(editingTask.projectId, editingTask.task.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium flex items-center transition-colors">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </button>
                      <button onClick={handleSaveTask} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium">Save Task</button>
                  </div>
              </div>
          </div>
      )}

      {/* Team Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="relative">
             <select 
                value={selectedTeamId} 
                onChange={(e) => { setSelectedTeamId(e.target.value); setAiReport(null); }}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-2xl font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 block w-full py-2 pl-4 pr-10 shadow-sm transition-all cursor-pointer"
             >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <ChevronDown className="w-5 h-5" />
             </div>
           </div>
           
           <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
           
           <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                   {teamManager?.firstName[0]}{teamManager?.lastName[0]}
               </div>
               <div className="hidden md:block">
                   <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide">Lead</p>
                   <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{teamManager ? `${teamManager.firstName} ${teamManager.lastName}` : 'Unassigned'}</p>
               </div>
           </div>
        </div>

        <div className="flex gap-2">
            <button 
                onClick={handleCreateProject}
                className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-all font-medium text-sm"
            >
                <Briefcase className="w-4 h-4 mr-2" /> New Project
            </button>

            <button 
                onClick={handleGenerateReport}
                disabled={loadingAi}
                className="flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
                {loadingAi ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"/> : <Bot className="w-4 h-4 mr-2" />}
                {loadingAi ? 'Analyzing...' : `AI Report`}
            </button>
        </div>
      </div>

      {/* AI Report */}
      {aiReport && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-500/30 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-4">
            <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 pointer-events-none">
                <Bot className="w-32 h-32 text-indigo-600" />
            </div>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 flex items-center">
                    <Bot className="w-5 h-5 mr-2" />
                    Executive Summary
                </h3>
                <div className="flex gap-2">
                    <button 
                        onClick={exportToDoc}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                        title="Export to Doc"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={copyToClipboard}
                        className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                        title="Copy to Clipboard"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => setAiReport(null)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <ChevronDown className="w-5 h-5 rotate-180" />
                    </button>
                </div>
            </div>
            
            {/* UTILISATION DE FORMATTED TEXT ICI */}
            <FormattedText text={aiReport} />
        </div>
      )}

      {/* Projects Grid */}
      <div className="space-y-6">
        {currentTeam.projects.map(project => {
            const health = getProjectHealth(project);
            const isExpanded = expandedProjectId === project.id;
            const progress = calculateWeightedProgress(project.tasks);
            const projectManager = users.find(u => u.id === project.managerId);
            const sortedTasks = [...project.tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
            const hasContext = project.additionalDescriptions && project.additionalDescriptions.some(d => d.trim().length > 0);
            const isContextVisible = showContextForProject === project.id;

            return (
              <div key={project.id} className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-indigo-200 dark:border-indigo-500/30 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                
                {/* Project Card Header */}
                <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-6 md:items-center">
                        <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                {project.isImportant && (
                                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" fill="currentColor" fillOpacity={0.2} />
                                )}
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{project.name}</h3>
                                
                                {/* Quick Status Change Project */}
                                <div onClick={(e) => e.stopPropagation()}>
                                    <select 
                                        value={project.status}
                                        onChange={(e) => handleProjectUpdate(project.id, 'status', e.target.value)}
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 cursor-pointer appearance-none ${getStatusColor(project.status)}`}
                                    >
                                        {Object.values(ProjectStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${health.color}`}>
                                    {health.label}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{project.description}</p>
                            
                            {/* Display Project Dependencies RAG */}
                            {project.externalDependencies && project.externalDependencies.length > 0 && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {project.externalDependencies.map(dep => (
                                        <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                            <span className={`w-2 h-2 rounded-full mr-1.5 ${getRagColor(dep.status).split(' ')[0]}`}></span>
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{dep.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Meta Stats */}
                        <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                             <div className="flex flex-col items-end min-w-[100px]">
                                <span className="text-xs uppercase font-semibold text-slate-400 mb-1">Timeline</span>
                                <span className="font-medium text-slate-900 dark:text-slate-200 flex items-center">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                                    {project.deadline}
                                </span>
                             </div>
                             
                             <div className="flex flex-col items-end w-32">
                                 <div className="flex justify-between w-full mb-1">
                                    <span className="text-xs font-semibold">Weighted Progress</span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                                 </div>
                                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                                     <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                 </div>
                             </div>

                             <button 
                                onClick={(e) => { e.stopPropagation(); setEditingProject(project); }}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                 <Pencil className="w-4 h-4" />
                             </button>

                             {/* Project Delete Button */}
                             {isExpanded && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Delete Project"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                             )}

                             <div 
                                onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                                className="cursor-pointer"
                             >
                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                             </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 p-6">
                        
                        {/* Hidden Context Button & Section */}
                        {hasContext && (
                            <div className="mb-6">
                                <button 
                                    onClick={() => setShowContextForProject(isContextVisible ? null : project.id)}
                                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 hover:underline mb-2"
                                >
                                    {isContextVisible ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                                    {isContextVisible ? 'Hide AI Context' : 'Show AI Context'}
                                </button>
                                
                                {isContextVisible && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                                        {project.additionalDescriptions?.map((desc, i) => (
                                            desc.trim() && (
                                                <div key={i} className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                                                    <span className="text-[10px] uppercase font-bold text-indigo-400 mb-1 block">Context Layer {i+1}</span>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{desc}</p>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tasks Header */}
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center">
                                Tasks ({project.tasks.length})
                                <span className="ml-2 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 font-normal normal-case flex items-center">
                                    <ArrowUpAz className="w-3 h-3 mr-1" /> Sorted by Order
                                </span>
                            </h4>
                            <button 
                                onClick={() => handleAddTask(project.id)}
                                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add Task
                            </button>
                        </div>

                        {/* Task List Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-3 w-16 text-center">#</th>
                                        <th className="px-6 py-3">Task Name</th>
                                        <th className="px-6 py-3 w-32">Status (Click)</th>
                                        <th className="px-6 py-3 w-32">Priority</th>
                                        <th className="px-6 py-3 w-24">Weight</th>
                                        <th className="px-6 py-3 w-40">Assignee</th>
                                        <th className="px-6 py-3 w-20 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {sortedTasks.map(task => {
                                        const checklistDone = task.checklist ? task.checklist.filter(i => i.done).length : 0;
                                        const checklistTotal = task.checklist ? task.checklist.length : 0;
                                        return (
                                        <tr key={task.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${task.isImportant ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-6 py-4 text-center font-mono text-slate-400 text-xs">
                                                {task.order}
                                            </td>
                                            <td className="px-6 py-4 relative">
                                                {task.isImportant && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
                                                <div className="flex items-center gap-2">
                                                    {task.isImportant && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                    <div className="font-medium text-slate-900 dark:text-white">{task.title}</div>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{task.description}</div>
                                                
                                                {/* Task Dependencies Display */}
                                                {task.externalDependencies && task.externalDependencies.length > 0 && (
                                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                                        {task.externalDependencies.map(dep => (
                                                            <div key={dep.id} className="flex items-center text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                                                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${getRagColor(dep.status).split(' ')[0]}`}></span>
                                                                <span className="text-slate-600 dark:text-slate-300">{dep.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-3 mt-1.5">
                                                    {task.eta && (
                                                        <div className="flex items-center text-xs text-slate-400">
                                                            <Calendar className="w-3 h-3 mr-1" /> {task.eta}
                                                        </div>
                                                    )}
                                                    {checklistTotal > 0 && (
                                                        <div className="flex items-center text-xs text-slate-400" title={`${checklistDone}/${checklistTotal} items completed`}>
                                                            <ListTodo className="w-3 h-3 mr-1" /> {checklistDone}/{checklistTotal}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* Quick Status Change */}
                                                <select 
                                                    value={task.status}
                                                    onChange={(e) => handleTaskUpdate(project.id, task.id, 'status', e.target.value)}
                                                    className={`text-xs font-bold px-2 py-1 rounded-md border-0 ring-1 ring-inset focus:ring-2 focus:ring-indigo-500 cursor-pointer w-full appearance-none ${getStatusColor(task.status).replace('border', 'ring')}`}
                                                >
                                                    {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4">
                                                 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                                     <Flag className="w-3 h-3 mr-1" />
                                                     {task.priority}
                                                 </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center text-slate-600 dark:text-slate-400 text-xs font-mono font-bold">
                                                    <Scale className="w-3 h-3 mr-1.5" />
                                                    {task.weight || 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {task.assigneeId ? (
                                                        <>
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                {users.find(u => u.id === task.assigneeId)?.firstName[0]}
                                                            </div>
                                                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                                                {users.find(u => u.id === task.assigneeId)?.firstName}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 italic flex items-center"><UserCircle2 className="w-4 h-4 mr-1"/> Unassigned</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button 
                                                        onClick={() => setEditingTask({projectId: project.id, task: task})}
                                                        className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteTask(project.id, task.id)}
                                                        className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                    {project.tasks.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No tasks created yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
              </div>
            );
        })}

        {currentTeam.projects.length === 0 && (
             <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                 <p className="text-lg font-medium">No active projects</p>
                 <p className="text-sm">Get started by creating a new project for this team.</p>
                 <button 
                    onClick={handleCreateProject}
                    className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-medium text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                 >
                     Create Project
                 </button>
             </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTracker;