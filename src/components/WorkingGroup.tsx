
import React, { useState } from 'react';
import { WorkingGroup, WorkingGroupSession, User, Team, ActionItem, ActionItemStatus, WorkingGroupChecklistItem, UserRole, LLMConfig, TaskPriority } from '../types';
import { Plus, Folder, Calendar, CheckSquare, Trash2, X, Save, Edit, UserPlus, Clock, Layout, AlertTriangle, MessageSquare, Siren, FileText, Sparkles, Bot, Loader2, Download, Copy, Flag, Layers, List } from 'lucide-react';
import { generateId } from '../services/storage';
import { generateWorkingGroupFullReport, generateWorkingGroupSessionReport } from '../services/llmService';
import FormattedText from './FormattedText';

interface WorkingGroupProps {
    groups: WorkingGroup[];
    users: User[];
    teams: Team[];
    currentUser: User | null;
    llmConfig?: LLMConfig; // Added for AI features
    onUpdateGroup: (group: WorkingGroup) => void;
    onDeleteGroup: (id: string) => void;
}

const WorkingGroupModule: React.FC<WorkingGroupProps> = ({ groups, users, teams, currentUser, llmConfig, onUpdateGroup, onDeleteGroup }) => {
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [editingGroup, setEditingGroup] = useState<WorkingGroup | null>(null);
    const [editingSession, setEditingSession] = useState<{groupId: string, session: WorkingGroupSession} | null>(null);
    
    // View State
    const [groupByFamily, setGroupByFamily] = useState(false);

    // AI Modal State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiContent, setAiContent] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiModalTitle, setAiModalTitle] = useState('');

    // Helpers
    const getProjectName = (id?: string) => {
        if (!id) return null;
        for (const t of teams) {
            const p = t.projects.find(proj => proj.id === id);
            if (p) return p.name;
        }
        return null;
    };

    const hasBlockedItems = (group: WorkingGroup) => {
        if(group.sessions.length === 0) return false;
        // Check latest session
        const latestSession = group.sessions[0]; // Assuming sorted new -> old
        return latestSession.actionItems.some(a => a.status === ActionItemStatus.BLOCKED);
    };

    // Extract all unique categories used in this group for datalist
    const getGroupCategories = (group: WorkingGroup) => {
        const categories = new Set<string>();
        group.sessions.forEach(s => {
            s.actionItems.forEach(a => {
                if (a.category) categories.add(a.category);
            });
        });
        return Array.from(categories);
    };

    const handleCreateGroup = () => {
        const newGroup: WorkingGroup = {
            id: generateId(),
            title: 'New Working Group',
            memberIds: currentUser ? [currentUser.id] : [],
            sessions: [],
            archived: false
        };
        setEditingGroup(newGroup);
    };

    const handleSaveGroup = () => {
        if (editingGroup) {
            onUpdateGroup(editingGroup);
            setEditingGroup(null);
            setSelectedGroupId(editingGroup.id);
        }
    };

    // --- SMART SESSION CREATION (Carry-Over) ---
    const handleCreateSession = (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        const previousSession = group.sessions.length > 0 ? group.sessions[0] : null; // Get most recent
        
        let carryOverActions: ActionItem[] = [];
        let carryOverChecklist: WorkingGroupChecklistItem[] = [];

        if (previousSession) {
            // Carry over NOT DONE actions
            carryOverActions = previousSession.actionItems
                .filter(a => a.status !== ActionItemStatus.DONE)
                .map(a => ({...a, id: generateId()})); // New ID to decouple status history

            // Carry over NOT DONE checklist items
            if(previousSession.checklist) {
                carryOverChecklist = previousSession.checklist
                    .filter(c => !c.done)
                    .map(c => ({...c, id: generateId()})); // New ID
            }
        }

        const newSession: WorkingGroupSession = {
            id: generateId(),
            date: new Date().toISOString().split('T')[0],
            notes: '',
            actionItems: carryOverActions,
            checklist: carryOverChecklist
        };
        setEditingSession({ groupId, session: newSession });
    };

    const handleSaveSession = () => {
        if (editingSession) {
            const group = groups.find(g => g.id === editingSession.groupId);
            if (group) {
                const sessionIndex = group.sessions.findIndex(s => s.id === editingSession.session.id);
                let newSessions = [...group.sessions];
                if (sessionIndex >= 0) {
                    newSessions[sessionIndex] = editingSession.session;
                } else {
                    newSessions = [editingSession.session, ...newSessions]; // Newest first
                }
                onUpdateGroup({ ...group, sessions: newSessions });
            }
            setEditingSession(null);
        }
    };

    // --- AI HANDLERS ---
    const handleGenerateFullReport = async () => {
        if (!selectedGroup || !llmConfig) return;
        setIsAiLoading(true);
        setAiContent('');
        setAiModalTitle(`Working Group Report: ${selectedGroup.title}`);
        setShowAiModal(true);

        const report = await generateWorkingGroupFullReport(selectedGroup, teams, users, llmConfig);
        setAiContent(report);
        setIsAiLoading(false);
    };

    const handleGenerateSessionReport = async () => {
        if (!selectedGroup || !llmConfig) return;
        if (selectedGroup.sessions.length === 0) return alert("No sessions to analyze.");
        
        setIsAiLoading(true);
        setAiContent('');
        setAiModalTitle(`Last Session Summary: ${selectedGroup.title}`);
        setShowAiModal(true);

        const report = await generateWorkingGroupSessionReport(selectedGroup, teams, users, llmConfig);
        setAiContent(report);
        setIsAiLoading(false);
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(aiContent);
        alert("Copied!");
    };

    const exportToDoc = () => {
        const element = document.createElement("a");
        const file = new Blob([aiContent], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "Working_Group_Report.doc"; 
        document.body.appendChild(element);
        element.click();
    };

    const getStatusColor = (status: ActionItemStatus) => {
        switch(status) {
            case ActionItemStatus.DONE: return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case ActionItemStatus.BLOCKED: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case ActionItemStatus.ONGOING: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    const getPriorityColor = (priority: TaskPriority) => {
        switch(priority) {
            case TaskPriority.URGENT: return 'text-red-600 dark:text-red-400';
            case TaskPriority.HIGH: return 'text-orange-500 dark:text-orange-400';
            case TaskPriority.MEDIUM: return 'text-blue-500 dark:text-blue-400';
            default: return 'text-slate-400';
        }
    };

    const selectedGroup = groups.find(g => g.id === selectedGroupId);
    
    // Permission check: Can Edit? (Admin OR Member)
    const canEdit = currentUser && (
        currentUser.role === UserRole.ADMIN || 
        selectedGroup?.memberIds.includes(currentUser.id)
    );

    // Render Edit Session Modal
    const renderSessionModal = () => {
        if (!editingSession) return null;
        const { session } = editingSession;
        const groupCategories = selectedGroup ? getGroupCategories(selectedGroup) : [];

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Session</h3>
                        <button onClick={() => setEditingSession(null)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                        
                        {/* Datalist for Categories */}
                        <datalist id="group-categories">
                            {groupCategories.map(c => <option key={c} value={c} />)}
                        </datalist>

                        {/* Header Info */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Session Date</label>
                            <input 
                                type="date" 
                                value={session.date}
                                onChange={e => setEditingSession({...editingSession, session: {...session, date: e.target.value}})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Minutes / Notes</label>
                            <textarea 
                                value={session.notes}
                                onChange={e => setEditingSession({...editingSession, session: {...session, notes: e.target.value}})}
                                rows={4}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                placeholder="Key points discussed..."
                            />
                        </div>

                        {/* ACTIONS */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Actions</label>
                                <button 
                                    onClick={() => {
                                        const newAction: ActionItem = { 
                                            id: generateId(), 
                                            description: '', 
                                            ownerId: '', 
                                            dueDate: '', 
                                            status: ActionItemStatus.TO_START, 
                                            eta: '',
                                            priority: TaskPriority.MEDIUM,
                                            category: ''
                                        };
                                        setEditingSession({...editingSession, session: {...session, actionItems: [...session.actionItems, newAction]}});
                                    }}
                                    className="text-xs text-indigo-600 hover:underline font-bold"
                                >+ Add Action</button>
                            </div>
                            <div className="space-y-3">
                                {session.actionItems.map((action, idx) => {
                                    // Check if ownerId matches a real user, otherwise it is free text
                                    const isKnownUser = users.some(u => u.id === action.ownerId);
                                    const isFreeText = action.ownerId && !isKnownUser;

                                    return (
                                    <div key={action.id} className="flex flex-col md:flex-row gap-2 items-start bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <div className="flex-1 space-y-2 w-full">
                                            {/* Top Row: Description */}
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="Action description"
                                                    value={action.description}
                                                    onChange={(e) => {
                                                        const newActions = [...session.actionItems];
                                                        newActions[idx].description = e.target.value;
                                                        setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                    }}
                                                    className="flex-1 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-sm dark:text-white font-medium placeholder-slate-400"
                                                />
                                            </div>

                                            {/* Bottom Row: Metadata Controls */}
                                            <div className="flex flex-wrap gap-2 items-center">
                                                
                                                {/* Owner Selection (Mixed ID/Text) */}
                                                <div className="relative min-w-[140px]">
                                                    {isFreeText ? (
                                                        <div className="flex items-center">
                                                            <input 
                                                                type="text"
                                                                value={action.ownerId}
                                                                onChange={(e) => {
                                                                    const newActions = [...session.actionItems];
                                                                    newActions[idx].ownerId = e.target.value;
                                                                    setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                                }}
                                                                className="w-full text-xs p-1.5 rounded border border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700 dark:text-amber-100"
                                                                placeholder="Ext. Name"
                                                                autoFocus
                                                            />
                                                            <button 
                                                                onClick={() => {
                                                                    const newActions = [...session.actionItems];
                                                                    newActions[idx].ownerId = ''; // Reset to allow dropdown
                                                                    setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                                }}
                                                                className="ml-1 text-slate-400 hover:text-red-500"
                                                                title="Clear / Use List"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select 
                                                            value={action.ownerId}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === 'FREE_TEXT') {
                                                                    const newActions = [...session.actionItems];
                                                                    newActions[idx].ownerId = 'External Contact'; // Default text to trigger input mode
                                                                    setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                                } else {
                                                                    const newActions = [...session.actionItems];
                                                                    newActions[idx].ownerId = val;
                                                                    setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                                }
                                                            }}
                                                            className="w-full text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white bg-slate-50"
                                                        >
                                                            <option value="">Assignee...</option>
                                                            {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                                            <option value="FREE_TEXT" className="font-bold text-indigo-600">-- External / Free Text --</option>
                                                        </select>
                                                    )}
                                                </div>

                                                {/* Category / Family */}
                                                <input 
                                                    type="text"
                                                    list="group-categories"
                                                    value={action.category || ''}
                                                    onChange={(e) => {
                                                        const newActions = [...session.actionItems];
                                                        newActions[idx].category = e.target.value;
                                                        setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                    }}
                                                    className="w-32 text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white bg-slate-50 placeholder-slate-400"
                                                    placeholder="Family/Cat..."
                                                />

                                                {/* Priority */}
                                                <select 
                                                    value={action.priority || TaskPriority.MEDIUM}
                                                    onChange={(e) => {
                                                        const newActions = [...session.actionItems];
                                                        newActions[idx].priority = e.target.value as TaskPriority;
                                                        setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                    }}
                                                    className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white bg-slate-50"
                                                >
                                                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>

                                                {/* ETA Field */}
                                                <input 
                                                    type="date"
                                                    value={action.eta || ''}
                                                    onChange={(e) => {
                                                        const newActions = [...session.actionItems];
                                                        newActions[idx].eta = e.target.value;
                                                        setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                    }}
                                                    className="text-xs p-1.5 rounded border dark:bg-slate-800 dark:border-slate-600 dark:text-white bg-slate-50"
                                                    title="ETA"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 md:flex-col md:w-24">
                                            <select 
                                                value={action.status}
                                                onChange={(e) => {
                                                    const newActions = [...session.actionItems];
                                                    newActions[idx].status = e.target.value as ActionItemStatus;
                                                    setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                }}
                                                className={`text-xs p-1 rounded border-none font-bold cursor-pointer w-full text-center ${getStatusColor(action.status)}`}
                                            >
                                                {Object.values(ActionItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>

                                            <button 
                                                onClick={() => {
                                                    const newActions = session.actionItems.filter((_, i) => i !== idx);
                                                    setEditingSession({...editingSession, session: {...session, actionItems: newActions}});
                                                }}
                                                className="text-slate-300 hover:text-red-500 pt-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )})}
                                {session.actionItems.length === 0 && <p className="text-xs text-slate-400 italic">No actions.</p>}
                            </div>
                        </div>

                        {/* CHECKLIST */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Checklist</label>
                                <button 
                                    onClick={() => {
                                        const newItem: WorkingGroupChecklistItem = { id: generateId(), text: '', isUrgent: false, comment: '', done: false };
                                        setEditingSession({...editingSession, session: {...session, checklist: [...(session.checklist || []), newItem]}});
                                    }}
                                    className="text-xs text-indigo-600 hover:underline font-bold"
                                >+ Add Item</button>
                            </div>
                            <div className="space-y-2">
                                {(session.checklist || []).map((item, idx) => (
                                    <div key={item.id} className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input 
                                                type="checkbox" 
                                                checked={item.done}
                                                onChange={(e) => {
                                                    const newList = [...(session.checklist || [])];
                                                    newList[idx].done = e.target.checked;
                                                    setEditingSession({...editingSession, session: {...session, checklist: newList}});
                                                }}
                                                className="w-4 h-4 text-indigo-600 rounded"
                                            />
                                            <input 
                                                type="text"
                                                value={item.text}
                                                onChange={(e) => {
                                                    const newList = [...(session.checklist || [])];
                                                    newList[idx].text = e.target.value;
                                                    setEditingSession({...editingSession, session: {...session, checklist: newList}});
                                                }}
                                                placeholder="Checklist item..."
                                                className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm dark:text-white ${item.done ? 'line-through text-slate-400' : ''}`}
                                            />
                                            <button 
                                                onClick={() => {
                                                    const newList = [...(session.checklist || [])];
                                                    newList[idx].isUrgent = !newList[idx].isUrgent;
                                                    setEditingSession({...editingSession, session: {...session, checklist: newList}});
                                                }}
                                                className={`p-1 rounded transition-colors ${item.isUrgent ? 'text-red-500 bg-red-100' : 'text-slate-300 hover:text-red-400'}`}
                                                title="Toggle Urgent"
                                            >
                                                <Siren className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const newList = (session.checklist || []).filter((_, i) => i !== idx);
                                                    setEditingSession({...editingSession, session: {...session, checklist: newList}});
                                                }}
                                                className="text-slate-300 hover:text-red-500"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {/* Comment Line */}
                                        <div className="flex items-center gap-2 ml-6">
                                            <MessageSquare className="w-3 h-3 text-slate-400" />
                                            <input 
                                                type="text"
                                                value={item.comment}
                                                onChange={(e) => {
                                                    const newList = [...(session.checklist || [])];
                                                    newList[idx].comment = e.target.value;
                                                    setEditingSession({...editingSession, session: {...session, checklist: newList}});
                                                }}
                                                placeholder="Add comment..."
                                                className="flex-1 bg-slate-50 dark:bg-slate-800 text-xs p-1 rounded border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {(session.checklist || []).length === 0 && <p className="text-xs text-slate-400 italic">No items.</p>}
                            </div>
                        </div>

                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        <button onClick={handleSaveSession} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700">Save Session</button>
                    </div>
                </div>
            </div>
        );
    };

    // Render Edit Group Modal
    const renderGroupModal = () => {
        if (!editingGroup) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Configure Working Group</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Group Title</label>
                            <input 
                                type="text" 
                                value={editingGroup.title}
                                onChange={e => setEditingGroup({...editingGroup, title: e.target.value})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Linked Project (Optional)</label>
                            <select 
                                value={editingGroup.projectId || ''}
                                onChange={e => setEditingGroup({...editingGroup, projectId: e.target.value})}
                                className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            >
                                <option value="">-- Standalone Group --</option>
                                {teams.flatMap(t => t.projects).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Members (Can Edit)</label>
                            <div className="max-h-32 overflow-y-auto border rounded p-2 dark:bg-slate-800 dark:border-slate-700">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center gap-2 mb-1">
                                        <input 
                                            type="checkbox"
                                            checked={editingGroup.memberIds.includes(u.id)}
                                            onChange={() => {
                                                const ids = editingGroup.memberIds.includes(u.id) 
                                                    ? editingGroup.memberIds.filter(id => id !== u.id)
                                                    : [...editingGroup.memberIds, u.id];
                                                setEditingGroup({...editingGroup, memberIds: ids});
                                            }}
                                        />
                                        <span className="text-sm dark:text-slate-300">{u.firstName} {u.lastName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">Cancel</button>
                            <button onClick={handleSaveGroup} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- EMPTY STATE HANDLING ---
    if (!groups || groups.length === 0) {
        return (
            <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto items-center justify-center p-4">
                {renderGroupModal()}
                <div className="text-center bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-lg w-full">
                    <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-in zoom-in duration-500">
                        <Folder className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Working Groups</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-base">
                        Organize your continuous work sessions, track long-term topics, and keep a history of decisions.
                    </p>
                    <button 
                        onClick={handleCreateGroup}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-1 flex items-center justify-center mx-auto w-full sm:w-auto"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create First Group
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto gap-6 relative">
            {renderSessionModal()}
            {renderGroupModal()}

            {/* AI Report Modal */}
            {showAiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
                            <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                <Bot className="w-6 h-6" />
                                {aiModalTitle}
                            </h3>
                            <button onClick={() => setShowAiModal(false)} className="text-white hover:text-indigo-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                            {isAiLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                                    <p className="font-medium">AI is analyzing sessions & context...</p>
                                </div>
                            ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <FormattedText text={aiContent} />
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                            <button 
                                onClick={exportToDoc}
                                disabled={isAiLoading}
                                className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" /> Export Doc
                            </button>
                            <button 
                                onClick={copyToClipboard}
                                disabled={isAiLoading}
                                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Copy className="w-4 h-4" /> Copy
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar List */}
            <div className="w-1/4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white">Working Groups</h2>
                    <button onClick={handleCreateGroup} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {groups.map(group => {
                        const isBlocked = hasBlockedItems(group);
                        return (
                            <div 
                                key={group.id} 
                                onClick={() => setSelectedGroupId(group.id)}
                                className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedGroupId === group.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <h3 className={`font-bold text-sm mb-1 ${selectedGroupId === group.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{group.title}</h3>
                                    {isBlocked && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
                                </div>
                                {group.projectId && (
                                    <p className="text-[10px] text-slate-400 flex items-center truncate">
                                        <Folder className="w-3 h-3 mr-1" />
                                        {getProjectName(group.projectId)}
                                    </p>
                                )}
                                <p className="text-[10px] text-slate-400 mt-1">{group.sessions.length} sessions</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                {selectedGroup ? (
                    <>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-950">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{selectedGroup.title}</h2>
                                <div className="flex gap-4 text-sm text-slate-500">
                                    {selectedGroup.projectId && <span className="flex items-center"><Folder className="w-4 h-4 mr-1"/> {getProjectName(selectedGroup.projectId)}</span>}
                                    <span className="flex items-center"><UserPlus className="w-4 h-4 mr-1"/> {selectedGroup.memberIds.length} members</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {/* Sort/Group Toggle */}
                                <button 
                                    onClick={() => setGroupByFamily(!groupByFamily)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center transition-colors shadow-sm border ${groupByFamily ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 border-indigo-200' : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200'}`}
                                    title="Toggle Group by Family"
                                >
                                    {groupByFamily ? <Layers className="w-4 h-4 mr-1.5"/> : <List className="w-4 h-4 mr-1.5"/>}
                                    {groupByFamily ? 'Grouped' : 'List'}
                                </button>

                                <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>

                                {/* AI Action Buttons */}
                                {llmConfig && (
                                    <>
                                        <button 
                                            onClick={handleGenerateFullReport}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                            title="Generate full history report"
                                        >
                                            <FileText className="w-4 h-4 mr-1.5" /> Full Report
                                        </button>
                                        <button 
                                            onClick={handleGenerateSessionReport}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                            title="Generate summary of last session only"
                                        >
                                            <Sparkles className="w-4 h-4 mr-1.5" /> Last Session
                                        </button>
                                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                                    </>
                                )}

                                {/* Permission Check for Edit Buttons */}
                                {canEdit && (
                                    <>
                                        <button onClick={() => setEditingGroup(selectedGroup)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-200 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => onDeleteGroup(selectedGroup.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleCreateSession(selectedGroup.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-indigo-700 transition-colors shadow-sm ml-2">
                                            <Plus className="w-4 h-4 mr-2" /> New Session
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900/50">
                            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                {selectedGroup.sessions.map((session, index) => (
                                    <div key={session.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-800 shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                            <Clock className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-shadow hover:shadow-md">
                                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-700/50">
                                                <time className="font-bold text-indigo-600 dark:text-indigo-400 text-sm flex items-center"><Calendar className="w-4 h-4 mr-1.5"/>{session.date}</time>
                                                {canEdit && (
                                                    <button onClick={() => setEditingSession({groupId: selectedGroup.id, session})} className="text-xs text-slate-400 hover:text-indigo-500 font-medium underline">Edit</button>
                                                )}
                                            </div>
                                            
                                            {/* Notes */}
                                            {session.notes && (
                                                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-4 font-serif leading-relaxed">
                                                    {session.notes}
                                                </div>
                                            )}
                                            
                                            {/* Checklist */}
                                            {session.checklist && session.checklist.length > 0 && (
                                                <div className="mb-4 space-y-1">
                                                    {session.checklist.map((item, i) => (
                                                        <div key={i} className="flex flex-col text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded">
                                                            <div className="flex items-center gap-2">
                                                                {item.done 
                                                                    ? <CheckSquare className="w-3 h-3 text-emerald-500" /> 
                                                                    : <span className="w-3 h-3 border border-slate-400 rounded-sm"></span>
                                                                }
                                                                <span className={item.done ? 'line-through opacity-60' : ''}>{item.text}</span>
                                                                {item.isUrgent && <Siren className="w-3 h-3 text-red-500 animate-pulse ml-auto" title="Urgent"/>}
                                                            </div>
                                                            {item.comment && (
                                                                <p className="ml-5 text-[10px] text-slate-400 italic">"{item.comment}"</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            {session.actionItems.length > 0 && (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mt-3 border border-slate-100 dark:border-slate-800">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center"><CheckSquare className="w-3 h-3 mr-1"/> Actions</p>
                                                    </div>
                                                    
                                                    {/* Grouping Logic for Display */}
                                                    <div className="space-y-3">
                                                    {(() => {
                                                        const actionsToRender = [...session.actionItems];
                                                        
                                                        // Grouping
                                                        if (groupByFamily) {
                                                            const grouped: Record<string, ActionItem[]> = {};
                                                            actionsToRender.forEach(a => {
                                                                const cat = a.category || 'General';
                                                                if (!grouped[cat]) grouped[cat] = [];
                                                                grouped[cat].push(a);
                                                            });

                                                            return Object.entries(grouped).map(([category, items]) => (
                                                                <div key={category}>
                                                                    <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1 border-b border-indigo-100 dark:border-indigo-900/30 pb-0.5">{category}</div>
                                                                    <ul className="space-y-2">
                                                                        {items.map(action => renderActionItem(action))}
                                                                    </ul>
                                                                </div>
                                                            ));
                                                        } else {
                                                            return (
                                                                <ul className="space-y-2">
                                                                    {actionsToRender.map(action => renderActionItem(action))}
                                                                </ul>
                                                            );
                                                        }
                                                    })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {selectedGroup.sessions.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-60">
                                        <Layout className="w-16 h-16 text-slate-300 mb-4" />
                                        <p className="text-slate-500 text-sm font-medium">Timeline is empty.</p>
                                        <p className="text-slate-400 text-xs">Create a session to start tracking.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                        <Folder className="w-20 h-20 mb-4 opacity-10" />
                        <p className="text-lg font-medium text-slate-500">Select a working group</p>
                        <p className="text-sm">View details and timeline on the right.</p>
                    </div>
                )}
            </div>
        </div>
    );

    // Render logic for a single action item in view mode
    function renderActionItem(action: ActionItem) {
        const ownerUser = users.find(u => u.id === action.ownerId);
        const ownerName = ownerUser ? ownerUser.firstName : (action.ownerId || 'Unassigned');
        const isExternal = action.ownerId && !ownerUser;

        return (
            <li key={action.id} className="text-xs flex items-start gap-2 bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-slate-100 dark:border-slate-700/50">
                <div className="flex flex-col items-center gap-1 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase w-16 text-center ${getStatusColor(action.status)}`}>
                        {action.status}
                    </span>
                    {action.priority && action.priority !== TaskPriority.MEDIUM && (
                        <Flag className={`w-3 h-3 ${getPriorityColor(action.priority)}`} />
                    )}
                </div>
                
                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        {!groupByFamily && action.category && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded uppercase tracking-wide">{action.category}</span>
                        )}
                        <span className={`font-medium text-slate-900 dark:text-white truncate ${action.status === ActionItemStatus.DONE ? 'line-through opacity-70' : ''}`}>{action.description}</span>
                    </div>
                    
                    <div className="flex gap-2 mt-1 items-center">
                        {action.ownerId && (
                            <span className={`flex items-center px-1.5 py-0.5 rounded text-[9px] ${isExternal ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                {isExternal ? <UserPlus className="w-2.5 h-2.5 mr-1" /> : '@'}
                                {ownerName}
                            </span>
                        )}
                        {action.eta && <span className="opacity-70 text-[9px] flex items-center text-slate-500"><Clock className="w-3 h-3 mr-0.5"/> {action.eta}</span>}
                    </div>
                </div>
            </li>
        );
    }
};

export default WorkingGroupModule;
