
import React, { useState, useEffect } from 'react';
import { User, WeeklyReport as WeeklyReportType, LLMConfig, HealthStatus, Team, UserRole } from '../types';
import { generateWeeklyReportSummary, generateConsolidatedReport, generateManagerSynthesis } from '../services/llmService';
import FormattedText from './FormattedText';
import { Save, Calendar, CheckCircle2, AlertOctagon, AlertTriangle, Users, History, Bot, Loader2, Copy, X, Pencil, Plus, Mail, MessageSquare, Activity, MoreHorizontal, Download, Wand2, Archive, FileText, Sparkles } from 'lucide-react';

interface WeeklyReportProps {
  reports: WeeklyReportType[];
  users: User[];
  currentUser: User | null;
  teams: Team[];
  llmConfig?: LLMConfig; 
  onSaveReport: (report: WeeklyReportType) => void;
}

const WeeklyReport: React.FC<WeeklyReportProps> = ({ reports, users, currentUser, teams, llmConfig, onSaveReport }) => {
  const [activeTab, setActiveTab] = useState<'my-report' | 'team-reports' | 'archives'>('my-report');
  
  // AI State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-Fill State
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [selectedReportIdsForFill, setSelectedReportIdsForFill] = useState<string[]>([]);
  const [isFilling, setIsFilling] = useState(false);

  // Manager Synthesis State
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Helper to get current week's Monday
  const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const currentMonday = getMonday(new Date());
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  const [currentReport, setCurrentReport] = useState<WeeklyReportType>({
      id: '',
      userId: currentUser?.id || '',
      weekOf: currentMonday,
      mainSuccess: '',
      mainIssue: '',
      incident: '',
      orgaPoint: '',
      otherSection: '',
      teamHealth: 'Green',
      projectHealth: 'Green',
      updatedAt: new Date().toISOString()
  });

  // Handle Escape Key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowAutoFillModal(false);
            setShowSummaryModal(false);
            setShowSynthesisModal(false);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load existing report for this week if exists on mount, but only if we are in "Current Week mode" (id is empty or matches current week logic)
  useEffect(() => {
      if (!currentUser) return;
      // Find current week report
      const existing = reports.find(r => r.userId === currentUser.id && r.weekOf === currentMonday);
      
      // If we are currently editing a past report (based on weekOf mismatch with currentMonday), don't override
      if (currentReport.weekOf !== currentMonday && currentReport.id) {
          return;
      }

      if (existing) {
          setCurrentReport(existing);
      } else {
          // Reset if no report found for this week
          setCurrentReport({
              id: '',
              userId: currentUser.id,
              weekOf: currentMonday,
              mainSuccess: '',
              mainIssue: '',
              incident: '',
              orgaPoint: '',
              otherSection: '',
              teamHealth: 'Green',
              projectHealth: 'Green',
              updatedAt: new Date().toISOString()
          });
      }
  }, [currentUser, reports, currentMonday]);

  const handleSave = () => {
      const reportToSave = {
          ...currentReport,
          id: currentReport.id || Date.now().toString(),
          updatedAt: new Date().toISOString()
      };
      onSaveReport(reportToSave);
      setCurrentReport(reportToSave); // Update state to have the ID
      alert("Report saved successfully!");
  };

  const handleGenerateEmail = async (reportToUse: WeeklyReportType = currentReport) => {
      if (!llmConfig) return alert("AI Configuration missing");
      setIsGenerating(true);
      setShowSummaryModal(true);
      setGeneratedEmail('');
      
      const email = await generateWeeklyReportSummary(reportToUse, currentUser, llmConfig);
      setGeneratedEmail(email);
      setIsGenerating(false);
  }

  const handleManagerSynthesis = async () => {
      if (!llmConfig) return alert("AI Configuration missing");
      // Basic validation: ensure there is content to synthesize
      if (!currentReport.mainSuccess && !currentReport.mainIssue && !currentReport.incident && !currentReport.otherSection) {
          return alert("Please fill or auto-fill the report sections before generating a synthesis.");
      }
      setIsSynthesizing(true);
      setShowSynthesisModal(true);
      setSynthesisResult('');

      const result = await generateManagerSynthesis(currentReport, llmConfig);
      setSynthesisResult(result);
      setIsSynthesizing(false);
  }

  const handleLoadReport = (report: WeeklyReportType) => {
      setCurrentReport({ ...report });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveTab('my-report'); // Switch to edit tab when loading
  };

  const handleResetToCurrent = () => {
      const existing = reports.find(r => r.userId === currentUser?.id && r.weekOf === currentMonday);
      if (existing) {
          setCurrentReport(existing);
      } else {
          setCurrentReport({
            id: '',
            userId: currentUser?.id || '',
            weekOf: currentMonday,
            mainSuccess: '',
            mainIssue: '',
            incident: '',
            orgaPoint: '',
            otherSection: '',
            teamHealth: 'Green',
            projectHealth: 'Green',
            updatedAt: new Date().toISOString()
        });
      }
  };

  const handleToggleReportSelection = (id: string) => {
      if (selectedReportIdsForFill.includes(id)) {
          setSelectedReportIdsForFill(selectedReportIdsForFill.filter(i => i !== id));
      } else {
          setSelectedReportIdsForFill([...selectedReportIdsForFill, id]);
      }
  }

  const handleAutoFill = async () => {
      if (!llmConfig) return alert("AI Configuration missing");
      if (selectedReportIdsForFill.length === 0) return alert("Select at least one report");
      
      setIsFilling(true);
      const reportsToProcess = reports.filter(r => selectedReportIdsForFill.includes(r.id));
      
      const consolidated = await generateConsolidatedReport(reportsToProcess, users, teams, llmConfig);
      
      setCurrentReport({
          ...currentReport,
          mainSuccess: consolidated.mainSuccess || currentReport.mainSuccess,
          mainIssue: consolidated.mainIssue || currentReport.mainIssue,
          incident: consolidated.incident || currentReport.incident,
          orgaPoint: consolidated.orgaPoint || currentReport.orgaPoint,
          otherSection: consolidated.otherSection || currentReport.otherSection
      });

      setIsFilling(false);
      setShowAutoFillModal(false);
      setSelectedReportIdsForFill([]);
  }

  const cleanTextForClipboard = (text: string) => {
      return text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/###\s?/g, '') // Remove headers
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links keeping text
          .trim();
  };

  const copyToClipboard = (text: string) => {
    const plainText = cleanTextForClipboard(text);
    navigator.clipboard.writeText(plainText);
    alert("Copied to clipboard (Plain Text)!");
  };

  const exportToDoc = (text: string, filename: string) => {
      const element = document.createElement("a");
      // For Doc export, we keep markdown/format as raw text usually handles basic structure better than stripped
      // But let's strip it to be consistent with "Copy" if desired, or keep as is.
      // Let's keep as is for Doc file as it might be interpreted or readable.
      const file = new Blob([text], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = filename; 
      document.body.appendChild(element);
      element.click();
  };

  const getWeekLabel = (dateStr: string) => {
      const date = new Date(dateStr);
      return `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const getHealthColor = (status?: HealthStatus) => {
      switch(status) {
          case 'Red': return 'bg-red-500';
          case 'Amber': return 'bg-amber-500';
          case 'Green': return 'bg-emerald-500';
          default: return 'bg-slate-300';
      }
  };

  // --- DATA PROCESSING FOR ARCHIVES AND AUTO-FILL ---

  // 1. Sort all reports desc (Newest -> Oldest)
  const sortedReports = [...reports].sort((a, b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime());

  // 2. Calculate Cutoff Date (3 months ago)
  const today = new Date();
  const threeMonthsAgo = new Date(today.setMonth(today.getMonth() - 3));

  // 3. Split reports
  const recentReports = sortedReports.filter(r => new Date(r.weekOf) >= threeMonthsAgo);
  const archivedReports = sortedReports.filter(r => new Date(r.weekOf) < threeMonthsAgo);

  // My History (User specific, show all for editing purposes, but we could split if needed. Keep all for now in the table)
  const myHistory = sortedReports.filter(r => r.userId === currentUser?.id);

  // 4. Group reports by user for Auto-Fill Modal
  // RULE: Only propose "recentReports" (< 3 months) for AI Auto-Fill
  const reportsByUserForAutoFill = recentReports.reduce((acc, report) => {
      // Exclude current user's OWN report to avoid circular logic
      if (report.id === currentReport.id) return acc;

      if (!acc[report.userId]) acc[report.userId] = [];
      acc[report.userId].push(report);
      return acc;
  }, {} as Record<string, WeeklyReportType[]>);

  // Render content helper to avoid code duplication between Recent and Archive views
  const renderReportList = (reportsList: WeeklyReportType[], emptyMessage: string) => (
      <div className="grid grid-cols-1 gap-6 animate-in fade-in">
          {reportsList.map(report => {
              const author = users.find(u => u.id === report.userId);
              return (
                  <div key={report.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                                  {author?.firstName[0]}{author?.lastName[0]}
                              </div>
                              <div>
                                  <h3 className="font-bold text-slate-900 dark:text-white">{author?.firstName} {author?.lastName}</h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{getWeekLabel(report.weekOf)}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              {/* AI Replay Button for History */}
                              <button 
                                  onClick={() => handleGenerateEmail(report)}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  title="Regenerate AI Summary"
                              >
                                  <Bot className="w-4 h-4" />
                              </button>

                              <div className="flex gap-1 items-center" title="Team/Project Health">
                                  <div className={`w-3 h-3 rounded-full ${getHealthColor(report.teamHealth)}`}></div>
                                  <div className={`w-3 h-3 rounded-full ${getHealthColor(report.projectHealth)}`}></div>
                              </div>
                              <div className="text-xs text-slate-400">
                                  Updated: {new Date(report.updatedAt).toLocaleDateString()}
                              </div>
                          </div>
                      </div>
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Success</h4>
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.mainSuccess || '-'}</p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Issues</h4>
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.mainIssue || '-'}</p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">Incidents</h4>
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.incident || '-'}</p>
                          </div>
                          <div>
                              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Organization</h4>
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.orgaPoint || '-'}</p>
                          </div>
                          {report.otherSection && (
                              <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Other</h4>
                                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{report.otherSection}</p>
                              </div>
                          )}
                      </div>
                  </div>
              );
          })}
          {reportsList.length === 0 && (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 italic">
                  {emptyMessage}
              </div>
          )}
      </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
        
        {/* Auto Fill Modal */}
        {showAutoFillModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-indigo-600 rounded-t-2xl">
                         <h3 className="font-bold text-lg text-white flex items-center gap-2">
                             <Wand2 className="w-5 h-5" />
                             Generate Global Report
                         </h3>
                         <button onClick={() => setShowAutoFillModal(false)} className="text-white hover:text-indigo-200">
                             <X className="w-5 h-5" />
                         </button>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Select weekly reports from your team to consolidate into your current report fields.
                            <br/>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Only showing reports from the last 3 months.</span>
                        </p>
                        
                        {Object.keys(reportsByUserForAutoFill).length === 0 && <p className="text-center italic text-slate-400">No recent reports available.</p>}

                        <div className="space-y-4">
                            {Object.entries(reportsByUserForAutoFill).map(([userId, userReports]) => {
                                const user = users.find(u => u.id === userId);
                                const userReportsList = userReports as WeeklyReportType[];
                                return (
                                    <div key={userId} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="bg-slate-100 dark:bg-slate-700/50 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                                            {user?.firstName} {user?.lastName}
                                        </div>
                                        <div>
                                            {userReportsList.map(report => ( // Map all valid recent reports
                                                <div 
                                                    key={report.id} 
                                                    onClick={() => handleToggleReportSelection(report.id)}
                                                    className={`p-3 flex items-center gap-3 cursor-pointer border-b last:border-0 border-slate-100 dark:border-slate-700 transition-colors ${selectedReportIdsForFill.includes(report.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedReportIdsForFill.includes(report.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {selectedReportIdsForFill.includes(report.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{getWeekLabel(report.weekOf)}</div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{report.mainSuccess || "No success recorded"}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                         <button onClick={() => setShowAutoFillModal(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                         <button 
                            onClick={handleAutoFill}
                            disabled={isFilling || selectedReportIdsForFill.length === 0}
                            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {isFilling ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4" />}
                            Generate Content
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* AI Email Modal */}
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                          <Bot className="w-5 h-5 text-indigo-500" />
                          Generated Email Draft (English)
                      </h3>
                      <button onClick={() => setShowSummaryModal(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                      {isGenerating ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                              <p>Generating professional summary (Fact-based)...</p>
                          </div>
                      ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                              <FormattedText text={generatedEmail} />
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                      <button 
                        onClick={() => setShowSummaryModal(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                          Close
                      </button>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => exportToDoc(generatedEmail, "Weekly_Report_Email.doc")}
                            disabled={isGenerating}
                            className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Download className="w-4 h-4" />
                              Export (.doc)
                          </button>
                          <button 
                            onClick={() => copyToClipboard(generatedEmail)}
                            disabled={isGenerating}
                            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Copy className="w-4 h-4" />
                              Copy
                          </button>
                      </div>
                  </div>
              </div>
          </div>
        )}

        {/* Manager Synthesis Modal */}
        {showSynthesisModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
                      <h3 className="font-bold text-lg text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-yellow-300" />
                          Manager Synthesis (AI)
                      </h3>
                      <button onClick={() => setShowSynthesisModal(false)} className="text-white hover:text-indigo-200">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                      {isSynthesizing ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                              <Loader2 className="w-10 h-10 animate-spin mb-4 text-purple-600" />
                              <p className="font-medium">Analyzing data & Generating synthesis...</p>
                              <p className="text-xs mt-2 text-slate-400">Restructuring by project • Highlighting key facts</p>
                          </div>
                      ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                              <FormattedText text={synthesisResult} />
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-3 bg-white dark:bg-slate-900 rounded-b-2xl">
                      <button 
                        onClick={() => setShowSynthesisModal(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                          Close
                      </button>
                      <div className="flex gap-2">
                          <button 
                            onClick={() => exportToDoc(synthesisResult, "Manager_Synthesis.doc")}
                            disabled={isSynthesizing}
                            className="px-4 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Download className="w-4 h-4" />
                              Export (.doc)
                          </button>
                          <button 
                            onClick={() => copyToClipboard(synthesisResult)}
                            disabled={isSynthesizing}
                            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                              <Copy className="w-4 h-4" />
                              Copy
                          </button>
                      </div>
                  </div>
              </div>
          </div>
        )}

        {/* Header Tabs */}
        <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700">
            <button 
                onClick={() => setActiveTab('my-report')}
                className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'my-report' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <Save className="w-4 h-4" /> My Report
            </button>
            <button 
                onClick={() => setActiveTab('team-reports')}
                className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'team-reports' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <History className="w-4 h-4" /> Recent Reports
            </button>
            <button 
                onClick={() => setActiveTab('archives')}
                className={`pb-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'archives' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <Archive className="w-4 h-4" /> Archives ({archivedReports.length})
            </button>
        </div>

        {activeTab === 'my-report' && (
            <div className="animate-in fade-in space-y-8">
                {/* Manager Feedback Section (Only if checked or annotated) */}
                {(currentReport.managerCheck || currentReport.managerAnnotation) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2">
                             <h3 className="font-bold text-blue-700 dark:text-blue-300 flex items-center">
                                 <MessageSquare className="w-4 h-4 mr-2" />
                                 Manager Feedback
                             </h3>
                             {currentReport.managerCheck && (
                                 <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800 flex items-center">
                                     <CheckCircle2 className="w-3 h-3 mr-1" /> Reviewed
                                 </span>
                             )}
                        </div>
                        {currentReport.managerAnnotation ? (
                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                "{currentReport.managerAnnotation}"
                            </p>
                        ) : (
                            <p className="text-xs text-slate-500 italic">No written comments.</p>
                        )}
                    </div>
                )}

                {/* Input Section */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    {currentReport.id ? 'Edit Report' : 'New Report'}
                                </h2>
                                {currentReport.weekOf !== currentMonday && (
                                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold px-2 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                                        Editing Past Report
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center mt-2 gap-2">
                                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center font-mono">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    Week Of:
                                </span>
                                {/* Date Change Input */}
                                <input 
                                    type="date" 
                                    value={currentReport.weekOf}
                                    onChange={(e) => setCurrentReport({...currentReport, weekOf: e.target.value})}
                                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {currentReport.weekOf !== currentMonday && (
                                <button 
                                    onClick={handleResetToCurrent}
                                    className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> New/Current
                                </button>
                            )}

                             {/* Consolidation Magic Button (Admin Only) */}
                             {llmConfig && isAdmin && (
                                <button 
                                    onClick={() => setShowAutoFillModal(true)}
                                    className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-2 rounded-lg font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center border border-purple-200 dark:border-purple-800 text-sm"
                                    title="Auto-fill from recent team reports"
                                >
                                    <Wand2 className="w-4 h-4 mr-2" /> Auto-Fill
                                </button>
                            )}
                            
                            {/* Manager Synthesis Button (Admin Only) */}
                            {llmConfig && isAdmin && (
                                <button 
                                    onClick={handleManagerSynthesis}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-2 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center shadow-md text-sm"
                                    title="Generate structured synthesis from current report fields"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" /> Manager Synthèse
                                </button>
                            )}

                            {llmConfig && (
                                <button 
                                    onClick={() => handleGenerateEmail()}
                                    className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors flex items-center border border-indigo-200 dark:border-indigo-800 text-sm"
                                >
                                    <Mail className="w-4 h-4 mr-2" /> AI Email
                                </button>
                            )}

                            <button 
                                onClick={handleSave}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center shadow-md text-sm"
                            >
                                <Save className="w-4 h-4 mr-2" /> Save
                            </button>
                        </div>
                    </div>

                    {/* Health Status Selectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Health of the Team</label>
                            <select 
                                value={currentReport.teamHealth || 'Green'} 
                                onChange={e => setCurrentReport({...currentReport, teamHealth: e.target.value as HealthStatus})}
                                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                            >
                                <option value="Green">🟢 Green</option>
                                <option value="Amber">🟠 Amber</option>
                                <option value="Red">🔴 Red</option>
                            </select>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Health of Projects</label>
                            <select 
                                value={currentReport.projectHealth || 'Green'} 
                                onChange={e => setCurrentReport({...currentReport, projectHealth: e.target.value as HealthStatus})}
                                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                            >
                                <option value="Green">🟢 Green</option>
                                <option value="Amber">🟠 Amber</option>
                                <option value="Red">🔴 Red</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Main Success */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <label className="block text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Main Success
                            </label>
                            <textarea 
                                value={currentReport.mainSuccess}
                                onChange={e => setCurrentReport({...currentReport, mainSuccess: e.target.value})}
                                className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-emerald-200 dark:ring-emerald-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-emerald-800/30"
                                placeholder="What went well this week?"
                            />
                        </div>

                        {/* Main Issue */}
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                            <label className="block text-sm font-bold text-red-700 dark:text-red-400 mb-2 flex items-center">
                                <AlertOctagon className="w-4 h-4 mr-2" /> Main Issue / Blocker
                            </label>
                            <textarea 
                                value={currentReport.mainIssue}
                                onChange={e => setCurrentReport({...currentReport, mainIssue: e.target.value})}
                                className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-red-200 dark:ring-red-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white placeholder-red-800/30"
                                placeholder="Any blocking points or major difficulties?"
                            />
                        </div>

                        {/* Incident */}
                        <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30">
                            <label className="block text-sm font-bold text-orange-700 dark:text-orange-400 mb-2 flex items-center">
                                <AlertTriangle className="w-4 h-4 mr-2" /> Incidents
                            </label>
                            <textarea 
                                value={currentReport.incident}
                                onChange={e => setCurrentReport({...currentReport, incident: e.target.value})}
                                className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-orange-200 dark:ring-orange-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-white placeholder-orange-800/30"
                                placeholder="Prod incidents, security alerts..."
                            />
                        </div>

                        {/* Organization */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <label className="block text-sm font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center">
                                <Users className="w-4 h-4 mr-2" /> Organizational Point
                            </label>
                            <textarea 
                                value={currentReport.orgaPoint}
                                onChange={e => setCurrentReport({...currentReport, orgaPoint: e.target.value})}
                                className="w-full h-32 p-3 rounded-lg border-0 ring-1 ring-blue-200 dark:ring-blue-800 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white placeholder-blue-800/30"
                                placeholder="Leaves, training, team events..."
                            />
                        </div>

                        {/* Other (Full Width) */}
                        <div className="bg-slate-50 dark:bg-slate-900/10 p-4 rounded-xl border border-slate-200 dark:border-slate-800 md:col-span-2">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2 flex items-center">
                                <MoreHorizontal className="w-4 h-4 mr-2" /> Other
                            </label>
                            <textarea 
                                value={currentReport.otherSection}
                                onChange={e => setCurrentReport({...currentReport, otherSection: e.target.value})}
                                className="w-full h-24 p-3 rounded-lg border-0 ring-1 ring-slate-200 dark:ring-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-slate-500 outline-none text-slate-900 dark:text-white placeholder-slate-400"
                                placeholder="Any other topics..."
                            />
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                         <History className="w-5 h-5 text-indigo-500" /> My History
                     </h3>
                     <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                         <table className="w-full text-sm text-left">
                             <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                 <tr>
                                     <th className="px-6 py-3">Week Of</th>
                                     <th className="px-6 py-3">Health (Team/Proj)</th>
                                     <th className="px-6 py-3">Status</th>
                                     <th className="px-6 py-3 text-right">Actions</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                 {myHistory.map(report => (
                                     <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                         <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                             {report.weekOf}
                                             {report.weekOf === currentMonday && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Current</span>}
                                         </td>
                                         <td className="px-6 py-4">
                                             <div className="flex gap-2">
                                                 <div className={`w-3 h-3 rounded-full ${getHealthColor(report.teamHealth)}`} title={`Team: ${report.teamHealth || 'N/A'}`}></div>
                                                 <div className={`w-3 h-3 rounded-full ${getHealthColor(report.projectHealth)}`} title={`Project: ${report.projectHealth || 'N/A'}`}></div>
                                             </div>
                                         </td>
                                         <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                             {report.managerCheck 
                                                ? <span className="flex items-center text-green-600 text-xs font-bold"><CheckCircle2 className="w-3 h-3 mr-1"/> Reviewed</span> 
                                                : <span className="text-slate-400 text-xs italic">Pending</span>}
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                             <button 
                                                onClick={() => handleLoadReport(report)}
                                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium flex items-center justify-end w-full"
                                             >
                                                 <Pencil className="w-4 h-4 mr-1" /> Edit
                                             </button>
                                         </td>
                                     </tr>
                                 ))}
                                 {myHistory.length === 0 && (
                                     <tr>
                                         <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic">
                                             No history found.
                                         </td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                </div>
            </div>
        )}

        {/* Tab 2: Recent Reports */}
        {activeTab === 'team-reports' && renderReportList(recentReports, "No recent reports found (< 3 months). Check Archives.")}

        {/* Tab 3: Archives */}
        {activeTab === 'archives' && renderReportList(archivedReports, "No archived reports found (> 3 months).")}

    </div>
  );
};

export default WeeklyReport;
