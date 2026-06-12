import { useState, useEffect } from "react";
import { 
  User, 
  Settings, 
  Lock, 
  Sparkles, 
  Music, 
  BookOpen, 
  TrendingUp, 
  Trophy,
  Activity,
  Flame,
  CheckCircle2
} from "lucide-react";
import { Child, TaskLog } from "./types";
import { getChildren, getTaskLogs } from "./firebase";
import ChildPortal from "./components/ChildPortal";
import ParentPortal from "./components/ParentPortal";

export default function App() {
  const [children, setChildren] = useState<Child[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [view, setView] = useState<"lobby" | "child" | "parent">("lobby");
  const [stats, setStats] = useState<Record<string, { total: number, ratio: number }>>({});

  const reloadData = async () => {
    try {
      const kids = await getChildren();
      setChildren(kids);

      const allLogs = await getTaskLogs();
      setLogs(allLogs);

      // Simple metrics for today's completes to reward the kid cards
      const todayStr = new Date().toISOString().split("T")[0];
      const newStats: Record<string, { total: number, ratio: number }> = {};
      
      kids.forEach(k => {
        const matchingLog = allLogs.find(l => l.childId === k.id && l.date === todayStr);
        if (matchingLog) {
          const finishedCount = Object.values(matchingLog.completions).filter(Boolean).length;
          newStats[k.id] = {
            total: k.subjects.length,
            ratio: finishedCount / k.subjects.length
          };
        } else {
          newStats[k.id] = { total: k.subjects.length, ratio: 0 };
        }
      });
      setStats(newStats);
    } catch (err) {
      console.error("Error loading app data:", err);
    }
  };

  useEffect(() => {
    reloadData();
  }, [view]);

  const handleSelectChild = (child: Child) => {
    setSelectedChild(child);
    setView("child");
  };

  const handleBackToLobby = () => {
    setSelectedChild(null);
    setView("lobby");
    reloadData();
  };

  if (view === "child" && selectedChild) {
    return (
      <main className="min-h-screen bg-slate-50/50 p-4 sm:p-6 md:p-8">
        <ChildPortal child={selectedChild} onBack={handleBackToLobby} />
      </main>
    );
  }

  if (view === "parent") {
    return (
      <main className="min-h-screen bg-slate-50/50 p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <ParentPortal onBack={handleBackToLobby} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col overflow-x-hidden">
      {/* Lobby Global Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-black text-white text-sm shadow-md">LS</div>
          <span className="font-bold text-slate-900 tracking-tight text-lg">Little Scholars</span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-medium bg-slate-100 py-0.5 px-2 rounded-full">2026 導航中心</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-slate-400 font-mono">系統時間: 2026-06-12 01:08</span>
          <button
            id="btn-parent-portal-gate"
            onClick={() => setView("parent")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>家長管理後台 (Parent Access)</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-12 flex flex-col justify-center space-y-10">
        
        {/* Main Brand Header Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs uppercase tracking-widest px-3.5 py-1 rounded-full shadow-sm">
            <Trophy className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
            <span>2026 Daily Learning Tracker</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-950 font-sans">
            兒童學習與功課進度記錄表
          </h1>
          <p className="text-slate-500 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            小朋友專屬打卡系統。只需點擊姓名並輸入密碼，即可自主勾選、登錄每日中文、英文、數學作業及鋼琴、長笛等樂器練習狀況！
          </p>
        </div>

        {/* Portals grid doors */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
          {children.map((child) => {
            const childStats = stats[child.id] || { total: child.subjects.length, ratio: 0 };
            const isCompletedToday = childStats.ratio === 1;

            return (
              <button
                key={child.id}
                onClick={() => handleSelectChild(child)}
                className={`group relative flex flex-col text-left p-6 bg-white hover:bg-slate-50/40 rounded-2xl border-2 transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 shadow-sm hover:shadow-md ${
                  isCompletedToday 
                    ? "border-emerald-500 bg-emerald-50/5 hover:bg-emerald-50/10" 
                    : "border-slate-200 hover:border-indigo-400"
                }`}
              >
                {/* Visual Completeness Crown */}
                {isCompletedToday && (
                  <span className="absolute -top-3 -right-3 bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-900 border border-white rounded-full p-1.5 text-[10px] font-bold shadow-sm animate-bounce flex items-center gap-0.5">
                    🌟 100%
                  </span>
                )}

                <div className="flex justify-between items-start w-full">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xl transition shadow-sm ${
                    child.id === "kate" ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"
                  }`}>
                    {child.name[0]}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                    {child.year}
                  </span>
                </div>

                <div className="mt-5 space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                    <span>{child.name}</span>
                    <span className="text-xs text-slate-400 font-normal">的每日任務</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">每日追蹤打卡科目：</p>
                </div>

                {/* Subjects pill display list */}
                <div className="flex flex-wrap gap-1 mt-2.5 w-full">
                  {child.subjects.map(s => (
                    <span 
                      key={s} 
                      className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-100"
                    >
                      {s.toLowerCase().includes("piano") || s.toLowerCase().includes("flute") || s.toLowerCase().includes("鋼琴") ? (
                        <Music className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                      ) : (
                        <BookOpen className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[100px]">{s}</span>
                    </span>
                  ))}
                </div>

                {/* Progress bar in place in the card */}
                <div className="w-full mt-4 space-y-1">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompletedToday ? "bg-emerald-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${childStats.ratio * 100}%` }}
                    />
                  </div>
                </div>

                {/* Simple Today completion info banner */}
                <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">今日進度：</span>
                  {childStats.ratio > 0 ? (
                    <span className={`font-bold ${isCompletedToday ? "text-emerald-600" : "text-indigo-600"}`}>
                      {isCompletedToday ? "全部完成囉 🏆" : `已完成 ${(childStats.ratio * 100).toFixed(0)}% ⏰`}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">尚未開始打卡 💤</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Help Segment */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-400 font-mono">
            提示：Kate 學生登入通行碼為 1111 | Damon 學生登入通行碼為 2222 | 家長密碼為 8888
          </p>
        </div>
      </div>
    </main>
  );
}
