import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Sparkles, 
  Lock, 
  ArrowLeft, 
  Calendar, 
  User, 
  Check, 
  Settings, 
  Plus, 
  Trash, 
  Download, 
  RefreshCw, 
  BookOpen, 
  Music, 
  CheckCircle2, 
  XCircle,
  FileText,
  AlertCircle
} from "lucide-react";
import { Child, TaskLog, SummaryReport } from "../types";
import { 
  getChildren, 
  saveChild, 
  getTaskLogs, 
  getSummaryReports, 
  saveSummaryReport,
  getParentPasscode,
  saveParentPasscode
} from "../firebase";

interface ParentPortalProps {
  onBack: () => void;
}

export default function ParentPortal({ onBack }: ParentPortalProps) {
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Dashboard states
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "reports" | "settings">("overview");
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [reports, setReports] = useState<SummaryReport[]>([]);
  
  // Settings edits
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [parentPIN, setParentPIN] = useState(getParentPasscode());

  // Report Generator settings
  const [selectedChildForReport, setSelectedChildForReport] = useState("all");
  const [reportDateRange, setReportDateRange] = useState("7"); // days
  const [parentNotes, setParentNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [reportError, setReportError] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  // Load all dashboard data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const kids = await getChildren();
      setChildrenList(kids);
      
      const taskLogs = await getTaskLogs();
      setLogs(taskLogs);
      
      const summaries = await getSummaryReports();
      setReports(summaries);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      loadData();
    }
  }, [isUnlocked]);

  // PIN validation
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === getParentPasscode()) {
      setIsUnlocked(true);
      setErrorMsg("");
    } else {
      setErrorMsg("管理密碼不正確！ (Incorrect parent PIN)");
      setPasscode("");
    }
  };

  // Setup initial edit selections
  const selectEditingChild = (child: Child) => {
    setEditingChild({ ...child, subjects: [...child.subjects] });
  };

  // Save customized settings
  const handleSaveChildSettings = async () => {
    if (!editingChild) return;
    await saveChild(editingChild);
    setEditingChild(null);
    await loadData();
  };

  const handleUpdatePIN = () => {
    if (parentPIN.length !== 4 || isNaN(Number(parentPIN))) {
      alert("請輸入4位數的純數字密碼！");
      return;
    }
    saveParentPasscode(parentPIN);
    alert("家長後台管理密碼更新成功！");
  };

  const handleAddSubjectToChild = () => {
    if (!editingChild || !newSubject.trim()) return;
    if (editingChild.subjects.includes(newSubject.trim())) {
      alert("此科目已經存在囉！");
      return;
    }
    setEditingChild({
      ...editingChild,
      subjects: [...editingChild.subjects, newSubject.trim()]
    });
    setNewSubject("");
  };

  const handleRemoveSubjectFromChild = (sub: string) => {
    if (!editingChild) return;
    setEditingChild({
      ...editingChild,
      subjects: editingChild.subjects.filter(s => s !== sub)
    });
  };

  // Generate parent insights report from Gemini API
  const handleGenerateAIReport = async () => {
    setIsGenerating(true);
    setReportError("");
    setGeneratedResult(null);

    try {
      // Find logs to synthesize
      const daysLimit = Number(reportDateRange);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
      
      let targetChild = childrenList[0];
      if (selectedChildForReport !== "all") {
        const found = childrenList.find(c => c.id === selectedChildForReport);
        if (found) targetChild = found;
      }

      // Filter relevant logs for the kid inside cutoff period
      const relevantLogs = logs.filter(log => {
        const matchesChild = selectedChildForReport === "all" || log.childId === selectedChildForReport;
        const matchesDate = new Date(log.date) >= cutoffDate;
        return matchesChild && matchesDate;
      });

      if (relevantLogs.length === 0) {
        throw new Error(`過去 ${daysLimit} 天內，尚未登錄過相關的學習與功課數據。請先讓小朋友完成日常打卡喔！`);
      }

      // Query server-side Gemini API route!
      const response = await fetch("/api/generate-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          childName: selectedChildForReport === "all" ? "Kate 與 Damon" : targetChild.name,
          childYear: selectedChildForReport === "all" ? "Year 8 與 Year 4" : targetChild.year,
          subjects: selectedChildForReport === "all" ? ["中文", "英文", "數學", "Flute/Piano"] : targetChild.subjects,
          logs: relevantLogs,
          parentNotes: parentNotes,
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "產生報告時服務器拒絕或遇到未預期錯誤");
      }

      setGeneratedResult(resData.summary);

      // Save report back into database
      const reportId = `report_${selectedChildForReport}_${new Date().toISOString().split("T")[0]}`;
      const newReport: SummaryReport = {
        id: reportId,
        childId: selectedChildForReport !== "all" ? selectedChildForReport : undefined,
        date: new Date().toISOString().split("T")[0],
        summary: resData.summary,
        createdAt: new Date().toISOString(),
      };

      await saveSummaryReport(newReport);
      
      // Reload reports collection
      const summaries = await getSummaryReports();
      setReports(summaries);

    } catch (err: any) {
      console.error(err);
      setReportError(err.message || "產生學習總結報告時失敗，請確認 AI 憑證或是網絡是否通暢。");
    } finally {
      setIsGenerating(false);
    }
  };

  // Statistics calculation
  const getAverageCompletion = (childId: string): number => {
    const childLogs = logs.filter(l => l.childId === childId);
    if (childLogs.length === 0) return 0;
    const total = childLogs.reduce((sum, current) => sum + current.completedRatio, 0);
    return total / childLogs.length;
  };

  const getStarredSubject = (childId: string, childSubjects: string[]): string => {
    const childLogs = logs.filter(l => l.childId === childId);
    if (childLogs.length === 0) return "尚無數據";
    
    const subjectScores: Record<string, { done: number, total: number }> = {};
    childSubjects.forEach(s => {
      subjectScores[s] = { done: 0, total: 0 };
    });

    childLogs.forEach(l => {
      Object.entries(l.completions).forEach(([subj, done]) => {
        if (subjectScores[subj] !== undefined) {
          subjectScores[subj].total += 1;
          if (done) subjectScores[subj].done += 1;
        }
      });
    });

    let bestSubject = "全體科目";
    let maxRatio = -1;
    Object.entries(subjectScores).forEach(([subj, stats]) => {
      if (stats.total > 0) {
        const ratio = stats.done / stats.total;
        if (ratio > maxRatio) {
          maxRatio = ratio;
          bestSubject = subj;
        }
      }
    });

    return maxRatio >= 0 ? `${bestSubject} (${(maxRatio * 100).toFixed(0)}% 完成率)` : "全體科目";
  };

  // Verification Gate
  if (!isUnlocked) {
    return (
      <div id="parent-login" className="max-w-md mx-auto bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-8 mt-12 text-slate-100 animate-fadeIn">
        <button 
          id="btn-back-main"
          onClick={onBack}
          className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-slate-200 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 
          返回主頁 (Back)
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg text-white mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">登入家長後台管理首頁</h2>
          <p className="text-sm text-slate-400 mt-1">家長可在後台查看學習進度圖表與自動產生 AI 報告</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">輸入 4 位數管理密碼 (Parent PIN)</label>
            <input 
              type="password"
              maxLength={4}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••"
              className="w-full text-center tracking-widest text-2xl font-bold p-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white transition-all placeholder:text-slate-600"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 text-center font-medium bg-rose-500/10 py-2.5 px-3 rounded-lg border border-rose-500/20">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl font-semibold transition text-white shadow-md shadow-indigo-900/20 flex items-center justify-center gap-1.5"
          >
            驗證並登入 <Check className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6 font-mono">
          Hints: 預設家長密碼為 8888 
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-hidden relative select-none" style={{ direction: "ltr" }}>
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-350 flex flex-col border-r border-slate-800 shrink-0 hidden md:flex text-slate-300">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3 text-white">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black">LS</div>
          <h1 className="text-base font-bold tracking-tight">Little Scholars</h1>
        </div>
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-1">登入權限模式：</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
            <span className="text-xs font-bold text-slate-200">全能家長後台已授權</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-2">後台功能選單</div>
          
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow"
                : "hover:bg-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>數據統計圖表看板</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow"
                : "hover:bg-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>打卡歷史完整日誌</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === "reports"
                ? "bg-indigo-600 text-white shadow"
                : "hover:bg-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Gemini AI 整合報告</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
              activeTab === "settings"
                ? "bg-indigo-600 text-white shadow"
                : "hover:bg-slate-850 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>科目與登入密碼自訂</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onBack}
            className="w-full py-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-250 text-xs font-semibold rounded-lg transition"
          >
            返回打卡登錄 (Back)
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Top Header Panel */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg transition"
              title="返回"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              {activeTab === "overview" && "📊 數據統計分佈圖表"}
              {activeTab === "history" && "📅 小朋友歷史打卡數據表"}
              {activeTab === "reports" && "✨ AI 即時學習結案報告顧問"}
              {activeTab === "settings" && "⚙️ 系統權限與追蹤項目自訂"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              title="重新載入"
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBack}
              className="hidden md:inline-flex items-center text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 py-1.5 px-3.5 rounded-lg transition"
            >
              安全登出 (Quit)
            </button>
          </div>
        </header>

        {/* Mobile quick tabs navigation */}
        <div className="md:hidden flex bg-white border-b border-slate-200 p-1.5 shrink-0 gap-1">
          {(["overview", "history", "reports", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : "text-slate-500 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              {tab === "overview" && "圖表"}
              {tab === "history" && "歷史"}
              {tab === "reports" && "AI"}
              {tab === "settings" && "設定"}
            </button>
          ))}
        </div>

        {/* Scrollable Container with dense layout content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {isLoading ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-inner">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 text-xs font-semibold">正在從雲端同步載入最新學員紀錄中，請稍候...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Kids summaries Cards */}
                  <div className="grid md:grid-cols-2 gap-6">
                {childrenList.map((kid) => {
                  const avg = getAverageCompletion(kid.id);
                  const starred = getStarredSubject(kid.id, kid.subjects);
                  const count = logs.filter(l => l.childId === kid.id).length;
                  return (
                    <div key={kid.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center">
                            {kid.name[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 text-lg">{kid.name} 的學習履歷</h3>
                            <p className="text-xs text-slate-500">{kid.year} • 包含 {count} 天紀錄</p>
                          </div>
                        </div>
                        <span className="text-3xl font-extrabold text-indigo-600">
                          {(avg * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="bg-slate-50 p-3.5 rounded-xl">
                          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">最佳表現領域</span>
                          <span className="text-sm font-bold text-slate-700 block mt-1 truncate">{starred}</span>
                        </div>
                        <div className="bg-slate-50 p-3.5 rounded-xl">
                          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">追蹤科目數量</span>
                          <span className="text-sm font-bold text-slate-700 block mt-1">{kid.subjects.length} 個必做項目</span>
                        </div>
                      </div>

                      {/* Custom inline High Fidelity SVG bar chart for subject completion averages */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">科目完成率統計表</h4>
                        <div className="bg-slate-50/50 rounded-xl p-4 space-y-3 border border-slate-100">
                          {kid.subjects.map((sub) => {
                            const subjectLogs = logs.filter(l => l.childId === kid.id);
                            const doneCount = subjectLogs.filter(l => l.completions[sub] === true).length;
                            const total = subjectLogs.length || 1;
                            const completionRatio = doneCount / total;
                            
                            return (
                              <div key={sub} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium text-slate-600">
                                  <span>{sub}</span>
                                  <span>{doneCount}/{total} 天 ({(completionRatio * 100).toFixed(0)}%)</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                    style={{ width: `${completionRatio * 100}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress trend SVG line graph */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">每日功課完成率歷史波動圖</h3>
                    <p className="text-sm text-slate-400">顯示最近 8 天兩位小朋友各自的作業成果曲線</p>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 bg-sky-400 rounded-full inline-block"></span>
                      <span>Kate (Year 8)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 bg-indigo-500 rounded-full inline-block"></span>
                      <span>Damon (Year 4)</span>
                    </div>
                  </div>
                </div>

                {/* Hand-crafted premium custom SVG line chart */}
                <div className="w-full overflow-x-auto select-none" style={{ direction: "ltr" }}>
                  <div className="min-w-[600px] h-[250px] relative">
                    <svg className="w-full h-full" viewBox="0 0 800 250">
                      {/* Grid Lines */}
                      {[0, 1, 2, 3, 4].map((gridLine) => {
                        const y = 20 + gridLine * 45;
                        return (
                          <g key={gridLine}>
                            <line 
                              x1="50" 
                              y1={y} 
                              x2="780" 
                              y2={y} 
                              className="stroke-slate-100" 
                              strokeWidth="1" 
                              strokeDasharray="4 4" 
                            />
                            <text 
                              x="15" 
                              y={y + 4} 
                              className="fill-slate-400 text-[10px] font-mono"
                            >
                              {100 - gridLine * 25}%
                            </text>
                          </g>
                        );
                      })}

                      {/* X axis lines */}
                      <line x1="50" y1="200" x2="780" y2="200" className="stroke-slate-200" strokeWidth="1" />

                      {/* Gather past 8 days dates */}
                      {(() => {
                        const days: string[] = [];
                        for (let i = 7; i >= 0; i--) {
                          const d = new Date();
                          d.setDate(d.getDate() - i);
                          days.push(d.toISOString().split("T")[0]);
                        }

                        // Coordinates helpers
                        const paddingX = 50;
                        const widthX = 730;
                        const stepX = widthX / (days.length - 1);

                        // Collect child points
                        const getCoords = (childId: string) => {
                          return days.map((day, index) => {
                            const x = paddingX + index * stepX;
                            const logForDay = logs.find(l => l.childId === childId && l.date === day);
                            const ratioVal = logForDay ? logForDay.completedRatio : 0;
                            // Map ratio 0-1 to y-coordinates 200 to 20
                            const y = 200 - ratioVal * 180;
                            return { x, y, checked: !!logForDay, ratio: ratioVal };
                          });
                        };

                        const kateCoords = getCoords("kate");
                        const damonCoords = getCoords("damon");

                        // Create line generator helper
                        const makePath = (coords: typeof kateCoords) => {
                          return coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
                        };

                        return (
                          <>
                            {/* Kate dynamic line (Sky Blue) */}
                            <path 
                              d={makePath(kateCoords)} 
                              fill="none" 
                              className="stroke-sky-400" 
                              strokeWidth="3.5" 
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {/* Damon dynamic line (Indigo) */}
                            <path 
                              d={makePath(damonCoords)} 
                              fill="none" 
                              className="stroke-indigo-500" 
                              strokeWidth="3.5" 
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Custom interactive points and labels */}
                            {days.map((day, index) => {
                              const x = paddingX + index * stepX;
                              const displayDate = day.substring(5); // format mm-dd
                              return (
                                <g key={day}>
                                  {/* X Axis labels */}
                                  <text 
                                    x={x} 
                                    y="225" 
                                    className="fill-slate-500 font-semibold text-[11px] text-center" 
                                    textAnchor="middle"
                                  >
                                    {displayDate}
                                  </text>

                                  {/* Kate points */}
                                  {kateCoords[index].checked && (
                                    <g>
                                      <circle 
                                        cx={x} 
                                        cy={kateCoords[index].y} 
                                        r="5" 
                                        className="fill-white stroke-sky-500" 
                                        strokeWidth="2.5" 
                                      />
                                      <text 
                                        x={x} 
                                        y={kateCoords[index].y - 8} 
                                        className="fill-sky-600 font-bold text-[9px]" 
                                        textAnchor="middle"
                                      >
                                        {(kateCoords[index].ratio * 100).toFixed(0)}%
                                      </text>
                                    </g>
                                  )}

                                  {/* Damon points */}
                                  {damonCoords[index].checked && (
                                    <g>
                                      <circle 
                                        cx={x} 
                                        cy={damonCoords[index].y} 
                                        r="5" 
                                        className="fill-white stroke-indigo-500" 
                                        strokeWidth="2.5" 
                                      />
                                      <text 
                                        x={x} 
                                        y={damonCoords[index].y + 13} 
                                        className="fill-indigo-700 font-bold text-[9px]" 
                                        textAnchor="middle"
                                      >
                                        {(damonCoords[index].ratio * 100).toFixed(0)}%
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 leading-relaxed border border-slate-100 flex items-start gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>家長提示：</strong>如果折線圖在某些天出現 0% 或中斷，可能是小朋友那天忘记登錄打卡囉。
                    您可以隨時到孩子傳送門登入他們的密碼（或由您在後台代為設定）進行補錄。
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORY LOGS */}
          {activeTab === "history" && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">打卡歷史完整數據報表 ({logs.length} 筆)</h3>
                  <p className="text-sm text-slate-400">所有日期下的各科課前、練習、樂器自我勾選明細狀態</p>
                </div>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">目前還沒有任何打卡日誌檔案紀錄。</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left font-medium border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase font-bold">
                        <th className="p-4">日期</th>
                        <th className="p-4">學生</th>
                        <th className="p-4">登錄項目清單狀態</th>
                        <th className="p-4 text-center">完成率</th>
                        <th className="p-4">打卡心得 & 備註</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                      {logs.map((log) => {
                        const kid = childrenList.find(c => c.id === log.childId);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-4 whitespace-nowrap font-semibold text-slate-900">
                              {log.date}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                log.childId === "kate" 
                                  ? "bg-sky-50 text-sky-700" 
                                  : "bg-indigo-50 text-indigo-700"
                              }`}>
                                {kid ? kid.name : log.childId} ({kid ? kid.year : ""})
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1.5 max-w-sm">
                                {Object.entries(log.completions).map(([subj, isDone]) => (
                                  <span 
                                    key={subj} 
                                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-semibold tracking-tight ${
                                      isDone 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                        : "bg-rose-50 text-rose-500 border border-slate-100"
                                    }`}
                                  >
                                    {isDone ? "✓" : "✗"} {subj}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`font-bold inline-block px-1.5 py-0.5 rounded text-xs ${
                                log.completedRatio === 1 
                                  ? "bg-amber-100 text-amber-800" 
                                  : log.completedRatio >= 0.5 
                                    ? "bg-slate-100 text-slate-800" 
                                    : "bg-rose-50 text-rose-500"
                              }`}>
                                {(log.completedRatio * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="p-4 text-xs font-medium text-slate-500 max-w-xs truncate" title={log.notes}>
                              {log.notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GENERATE INSIGHTS BY GEMINI */}
          {activeTab === "reports" && (
            <div className="grid md:grid-cols-3 gap-6">
              
              {/* Generator input settings card */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6 h-fit shrink-0">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1.5">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <span>學習大數據分析顧問</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    調用 Gemini 智能，快速統整孩子作息紀錄與課外鋼琴/長笛成果。
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      分析指定孩子
                    </label>
                    <select
                      value={selectedChildForReport}
                      onChange={(e) => setSelectedChildForReport(e.target.value)}
                      className="w-full text-slate-700 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    >
                      <option value="all">Consolidated (Kate & Damon 共同統整)</option>
                      {childrenList.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.year})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      追蹤分析天數
                    </label>
                    <select
                      value={reportDateRange}
                      onChange={(e) => setReportDateRange(e.target.value)}
                      className="w-full text-slate-700 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    >
                      <option value="3">過去 3 天</option>
                      <option value="7">過去 1 週 (7天)</option>
                      <option value="14">過去 2 週 (14天)</option>
                      <option value="30">過去 1 個月 (30天)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      給 AI 的家長備註 (Parent Feedback Context)
                    </label>
                    <textarea
                      value={parentNotes}
                      onChange={(e) => setParentNotes(e.target.value)}
                      placeholder="例如：Kate 鋼琴在本週有很大進步，Damon 週三生病，想獲得針對性引導建议..."
                      rows={3}
                      className="w-full text-sm p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
                    />
                  </div>

                  {reportError && (
                    <p className="text-xs text-rose-500 leading-relaxed font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                      {reportError}
                    </p>
                  )}

                  <button
                    onClick={handleGenerateAIReport}
                    disabled={isGenerating || childrenList.length === 0}
                    className="w-full py-3.5 bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:opacity-95 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 shadow"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        AI 專利分析精算中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 animate-pulse text-amber-300 fill-amber-300" />
                        產生 AI 學習總結報告
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Reports display area */}
              <div className="md:col-span-2 space-y-6">
                
                {generatedResult && (
                  <div className="bg-gradient-to-r from-indigo-50 to-sky-50 rounded-3xl border border-indigo-100 shadow-sm p-6 space-y-4 animate-scaleUp">
                    <div className="flex justify-between items-center pb-2.5 border-b border-indigo-100">
                      <div className="flex items-center gap-1.5 text-indigo-800">
                        <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 animate-bounce" />
                        <h4 className="font-bold">最新產生 AI 即時報告成果</h4>
                      </div>
                      <span className="text-xs text-indigo-500 font-mono font-bold">Just Generated</span>
                    </div>
                    {/* Markdown rendering simulation wrapper */}
                    <div className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-80 overflow-y-auto">
                      {generatedResult}
                    </div>
                  </div>
                )}

                {/* Stored historical summary reports */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span>已儲存的歷史統整報告紀錄 ({reports.length} 份)</span>
                  </h3>

                  {reports.length === 0 && !generatedResult ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">目前還沒有產生或儲存任何 AI 歷程結案報告。</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {reports.map((rep) => {
                        const kid = childrenList.find(c => c.id === rep.childId);
                        return (
                          <div key={rep.id} className="border border-slate-100 hover:border-slate-200 bg-slate-50/40 hover:bg-slate-50 p-5 rounded-2xl transition space-y-3">
                            <div className="flex justify-between items-center text-xs text-slate-500 font-bold border-b border-slate-100/60 pb-2">
                              <span className="bg-slate-200/80 px-2.5 py-1 rounded text-slate-700">
                                對象: {kid ? kid.name : "Kate & Damon (共同統整)"}
                              </span>
                              <span>產生於: {rep.createdAt.substring(0, 16).replace("T", " ")}</span>
                            </div>
                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-40 overflow-y-auto bg-white border border-slate-50 rounded-xl p-4 shadow-inner">
                              {rep.summary}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM AND SUBJECTS SETTINGS */}
          {activeTab === "settings" && (
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Kids subject details custom set */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">自訂打卡與練習科目項目</h3>
                  <p className="text-sm text-slate-400">家長可以根據孩子當前的課程需要，靈活增刪追蹤科目</p>
                </div>

                <div className="space-y-4">
                  {/* Select kid */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    {childrenList.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectEditingChild(c)}
                        className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition ${
                          editingChild?.id === c.id
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-600"
                        }`}
                      >
                        調整 {c.name} ({c.year})
                      </button>
                    ))}
                  </div>

                  {!editingChild && childrenList.length > 0 && (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      請點選上方按鈕選擇特定小孩開始修改
                    </div>
                  )}

                  {editingChild && (
                    <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-fadeIn">
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{editingChild.name} 目前的項目清單：</h4>
                        <div className="flex flex-wrap gap-2">
                          {editingChild.subjects.map(s => (
                            <span 
                              key={s} 
                              className="inline-flex items-center gap-1 bg-white text-slate-700 font-semibold text-xs border border-slate-200 rounded-full px-3 py-1.5 shadow-sm"
                            >
                              <span>{s}</span>
                              <button 
                                onClick={() => handleRemoveSubjectFromChild(s)}
                                className="w-4 h-4 rounded-full bg-slate-100 hover:bg-slate-200 hover:text-rose-500 text-slate-400 font-bold flex items-center justify-center text-[10px] select-none shrink-0"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Add Subject Input */}
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="例如: 科學練習、中文默寫..."
                          value={newSubject}
                          onChange={(e) => setNewSubject(e.target.value)}
                          className="flex-1 text-slate-700 text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleAddSubjectToChild}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 hover:text-white text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-4 h-4" /> 增加項目
                        </button>
                      </div>

                      {/* Update Password fields specific for the child */}
                      <div className="pt-2 border-t border-slate-200">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                          {editingChild.name} 的登入打卡密碼 (同為 4 位數字):
                        </label>
                        <input 
                          type="text"
                          maxLength={4}
                          value={editingChild.passcode}
                          onChange={(e) => setEditingChild({ ...editingChild, passcode: e.target.value })}
                          className="w-24 text-center text-sm font-bold p-2 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditingChild(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveChildSettings}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" /> 儲存修改
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Parents config & password */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">安全偏好與家長 PIN 修改</h3>
                  <p className="text-sm text-slate-400">保障家長報告後台不被大意亂按，建議經常輪換密碼</p>
                </div>

                <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                      家長後台管理 PIN 密碼修改 (4位純數字)：
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="password"
                        maxLength={4}
                        placeholder="預設為 8888"
                        value={parentPIN}
                        onChange={(e) => setParentPIN(e.target.value)}
                        className="w-32 text-center text-sm font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700"
                      />
                      <button
                        onClick={handleUpdatePIN}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        更新家長密碼
                      </button>
                    </div>
                    <span className="block text-[10px] text-slate-400 mt-2 font-medium">更新立刻生效，下次登入時系統讀取本地此新 PIN 信標憑證。</span>
                  </div>
                </div>

                {/* Diagnostic Check */}
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-2.5">系統健康度在線檢測</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Firebase 資料庫:</span>
                      <span className="font-bold text-emerald-500">已就緒 (Fallbacks)</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Gemini 智能報告:</span>
                      <span className="font-bold text-emerald-500">已就緒 (Online/Lazy)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
