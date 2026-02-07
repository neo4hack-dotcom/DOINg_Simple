
import React, { useState, useEffect, useRef } from 'react';
import { AppState, LLMConfig, LLMProvider, User, UserRole } from '../types';
import { fetchOllamaModels, DEFAULT_PROMPTS } from '../services/llmService';
import { clearState } from '../services/storage';
import { Save, RefreshCw, Cpu, Server, Key, Link, Download, Upload, Database, Settings, Lock, TestTube, Trash2, AlertOctagon, MessageSquare, RotateCcw } from 'lucide-react';

interface SettingsPanelProps {
  config: LLMConfig;
  appState: AppState | null; // Needed for export and user management
  onSave: (config: LLMConfig, prompts?: Record<string, string>) => void;
  onImport: (newState: AppState) => void;
  onInjectData?: () => void; // New prop for test data
  onUpdateUserPassword?: (userId: string, newPass: string) => void; 
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, appState, onSave, onImport, onUpdateUserPassword, onInjectData }) => {
  const [localConfig, setLocalConfig] = useState<LLMConfig>(config);
  const [localPrompts, setLocalPrompts] = useState<Record<string, string>>(appState?.prompts || {});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'general' | 'prompts'>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Password Management State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');

  // Load models if Ollama is selected initially
  useEffect(() => {
    if (localConfig.provider === 'ollama') {
      handleRefreshOllama();
    }
  }, []);

  const handleRefreshOllama = async () => {
    setLoadingModels(true);
    const models = await fetchOllamaModels(localConfig.baseUrl || 'http://localhost:11434');
    setOllamaModels(models);
    setLoadingModels(false);
    
    // Auto-select first model if none selected or current not in list
    if (models.length > 0 && (!localConfig.model || !models.includes(localConfig.model))) {
      setLocalConfig(prev => ({ ...prev, model: models[0] }));
    }
  };

  const handleSave = () => {
    onSave(localConfig, localPrompts);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handlePasswordReset = () => {
      if (selectedUserId && newPassword && onUpdateUserPassword) {
          onUpdateUserPassword(selectedUserId, newPassword);
          alert('Password updated successfully');
          setNewPassword('');
          setSelectedUserId('');
      }
  };

  const handleExport = () => {
    if (!appState) return;
    const dataStr = JSON.stringify(appState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `doing_backup_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileObj = event.target.files && event.target.files[0];
      if (!fileObj) {
          return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result;
              if (typeof content === 'string') {
                  const parsedState = JSON.parse(content);
                  // Basic validation
                  if (parsedState.users && parsedState.teams) {
                      if (window.confirm("This will overwrite current data. Are you sure?")) {
                          onImport(parsedState);
                      }
                  } else {
                      alert("Invalid file format.");
                  }
              }
          } catch (error) {
              console.error("JSON Parse Error", error);
              alert("Error reading JSON file.");
          }
      }
      reader.readAsText(fileObj);
      // Reset input
      event.target.value = '';
  }

  const handleConfirmInject = () => {
      if (window.confirm("WARNING: This will overwrite your current data with simulation test data. Continue?")) {
          if (onInjectData) onInjectData();
      }
  }

  const handleResetApp = () => {
      if (window.confirm("DANGER: This will permanently delete ALL data (Users, Projects, Notes, etc.) and reset the application to its initial state. This action cannot be undone.\n\nAre you absolutely sure?")) {
          clearState();
      }
  }

  const handleResetPrompt = (key: string) => {
      if(window.confirm(`Reset "${key}" prompt to default?`)) {
          const newPrompts = { ...localPrompts };
          delete newPrompts[key];
          setLocalPrompts(newPrompts);
      }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Configuration Header */}
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-6">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Settings className="w-6 h-6" /> {/* Generic Settings Icon */}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configuration</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">System settings, security, backup, and AI.</p>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl w-fit mb-6">
          <button 
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
          >
              General & AI Config
          </button>
          <button 
            onClick={() => setActiveTab('prompts')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'prompts' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
          >
              <MessageSquare className="w-4 h-4"/> Prompt Engineering
          </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-8">

        {activeTab === 'prompts' ? (
            <div className="space-y-8 animate-in fade-in">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-200 flex items-center mb-2">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        System Prompts Editor
                    </h3>
                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                        Customize how the AI generates content. Use placeholders like <code>{'{{DATA}}'}</code> to inject context.
                    </p>
                </div>

                {Object.entries(DEFAULT_PROMPTS).map(([key, defaultPrompt]) => (
                    <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">
                                {key.replace('_', ' ')}
                            </label>
                            {localPrompts[key] && localPrompts[key] !== defaultPrompt && (
                                <button 
                                    onClick={() => handleResetPrompt(key)}
                                    className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
                                >
                                    <RotateCcw className="w-3 h-3" /> Reset to Default
                                </button>
                            )}
                        </div>
                        <textarea 
                            value={localPrompts[key] || defaultPrompt}
                            onChange={(e) => setLocalPrompts({ ...localPrompts, [key]: e.target.value })}
                            className="w-full h-48 p-4 text-sm font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                        />
                    </div>
                ))}
                
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button 
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all"
                    >
                        Save Prompts
                    </button>
                </div>
            </div>
        ) : (
            <>
            {/* General Settings Content */}
            
            {/* Security Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-500" />
                    Security & Users
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Reset user password.</p>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">User</label>
                            <select 
                                value={selectedUserId} 
                                onChange={e => setSelectedUserId(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                <option value="">Select user...</option>
                                {appState?.users.map(u => (
                                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.uid})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">New Password</label>
                            <input 
                                type="text" 
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="New password"
                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                        </div>
                        <button 
                            onClick={handlePasswordReset}
                            disabled={!selectedUserId || !newPassword}
                            className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Update
                        </button>
                    </div>
                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Data Management Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    Data Management
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col space-y-4">
                    
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p className="font-semibold mb-1">Backup & Restore</p>
                            <p>Export full database to JSON or restore from backup.</p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleExport}
                                className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors font-medium text-sm"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export JSON
                            </button>
                            <input 
                                type="file" 
                                accept=".json" 
                                ref={fileInputRef} 
                                style={{display: 'none'}} 
                                onChange={handleFileChange}
                            />
                            <button 
                                onClick={handleImportClick}
                                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Import JSON
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p className="font-semibold mb-1 flex items-center gap-2"><TestTube className="w-4 h-4 text-amber-500"/> Test Data Injection</p>
                            <p>Inject dummy data (Users, Teams, Projects) for testing/demo purposes.</p>
                        </div>
                        <button 
                            onClick={handleConfirmInject}
                            className="flex items-center px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg transition-colors font-medium text-sm"
                        >
                            <Database className="w-4 h-4 mr-2" />
                            Inject Mock Data
                        </button>
                    </div>

                    {/* Danger Zone: Reset App */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p className="font-semibold mb-1 flex items-center gap-2 text-red-600 dark:text-red-400"><AlertOctagon className="w-4 h-4"/> Danger Zone</p>
                            <p>Permanently delete all data and reset application.</p>
                        </div>
                        <button 
                            onClick={handleResetApp}
                            className="flex items-center px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors font-medium text-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Reset Application
                        </button>
                    </div>

                </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* AI Section */}
            <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-500" />
                    Artificial Intelligence Config
                </h3>
                
                <div className="space-y-6">
                {/* Provider Selection */}
                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">AI Provider</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { id: 'ollama', label: 'Ollama (Local)', icon: <Server className="w-4 h-4"/> },
                        { id: 'local_http', label: 'Custom HTTP', icon: <Link className="w-4 h-4"/> }
                    ].map((provider) => (
                        <button
                        key={provider.id}
                        onClick={() => setLocalConfig({ ...localConfig, provider: provider.id as LLMProvider })}
                        className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all font-medium text-sm
                            ${localConfig.provider === provider.id 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'}
                        `}
                        >
                        {provider.icon}
                        {provider.label}
                        </button>
                    ))}
                    </div>
                </div>

                {/* Configuration Fields based on Provider */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl space-y-6 border border-slate-100 dark:border-slate-700/50">

                    {localConfig.provider === 'ollama' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Base URL</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Link className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={localConfig.baseUrl || 'http://localhost:11434'}
                                    onChange={e => setLocalConfig({...localConfig, baseUrl: e.target.value})}
                                    className="w-full p-3 pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <button 
                                onClick={handleRefreshOllama}
                                disabled={loadingModels}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center"
                                title="Fetch available models"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        </div>

                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Model</label>
                        {ollamaModels.length > 0 ? (
                            <select 
                                value={localConfig.model}
                                onChange={e => setLocalConfig({...localConfig, model: e.target.value})}
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                            >
                                {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        ) : (
                            <input 
                                type="text"
                                value={localConfig.model}
                                onChange={e => setLocalConfig({...localConfig, model: e.target.value})}
                                className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                placeholder="Model name (e.g., llama3)" 
                            />
                        )}
                        </div>
                    </div>
                    )}

                    {localConfig.provider === 'local_http' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Endpoint URL</label>
                        <input 
                            type="text" 
                            value={localConfig.baseUrl || ''}
                            onChange={e => setLocalConfig({...localConfig, baseUrl: e.target.value})}
                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="http://localhost:8000/v1/chat/completions"
                        />
                        </div>
                        <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">API Key (Optional)</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                            <input 
                                type="password" 
                                value={localConfig.apiKey || ''}
                                onChange={e => setLocalConfig({...localConfig, apiKey: e.target.value})}
                                className="w-full p-3 pl-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="sk-..."
                            />
                        </div>
                        </div>
                    </div>
                    )}
                </div>
                
                 <div className="flex justify-end pt-4">
                    <button 
                        onClick={handleSave}
                        className={`flex items-center px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform active:scale-95
                            ${saveStatus === 'saved' 
                                ? 'bg-green-500 hover:bg-green-600 text-white' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
                        `}
                    >
                        {saveStatus === 'saved' ? <span className="mr-2">Saved!</span> : <Save className="w-5 h-5 mr-2" />}
                        {saveStatus === 'idle' && 'Save Configuration'}
                    </button>
                 </div>
                </div>
            </div>
            </>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
