import React, { useState, useEffect } from "react";
import { 
  CheckCircle, 
  Circle, 
  Calendar, 
  BookOpen, 
  Music, 
  Sparkles, 
  Lock, 
  ArrowLeft, 
  Trophy, 
  Check, 
  MessageSquare,
  Flame
} from "lucide-react";
import { Child, TaskLog } from "../types";
import { saveTaskLog, getTaskLogs } from "../firebase";

interface ChildPortalProps {
  child: Child;
  onBack: () => void;
}

export default function ChildPortal({ child, onBack }: ChildPortalProps) {
  const [passcode, setPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  
  // State for completions
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [streakDays, setStreakDays] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load existing data for the selected date or reset to false
  useEffect(() => {
    if (!isUnlocked) return;
    
    async function fetchTodayData() {
      const allLogs = await getTaskLogs();
      const match = allLogs.find(l => l.childId === child.id && l.date === selectedDate);
      
      if (match) {
        setCompletions(match.completions);
        setNotes(match.notes || "");
      } else {
        // Default everything to false when no entry exists for this date
        const initialStates: Record<string, boolean> = {};
        child.subjects.forEach(sub => {
          initialStates[sub] = false;
        });
        setCompletions(initialStates);
        setNotes("");
      }

      // Calculate streak dynamically based on adjacent daily logs
      const childLogs = allLogs.filter(l => l.childId === child.id && l.completedRatio > 0);
      childLogs.sort((a, b) => b.date.localeCompare(a.date));
      
      let streak = 0;
      let checkDate = new Date();
      // Check today first, then yesterday, backward
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split("T")[0];
        const logForDay = childLogs.find(l => l.date === dateStr);
        if (logForDay && logForDay.completedRatio >= 0.5) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          // If checking date is today or yesterday, let streak continue if yesterday is completed
          if (i === 0) {
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
          break;
        }
      }
      setStreakDays(streak);
    }
    
    fetchTodayData();
  }, [isUnlocked, selectedDate, child.id]);

  // Passcode verification
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === child.passcode) {
      setIsUnlocked(true);
      setErrorMsg("");
    } else {
      setErrorMsg("密碼不正確，請再試一次喔！ (Incorrect passcode)");
      setPasscode("");
    }
  };

  const handleToggleSubject = (subject: string) => {
    setCompletions(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }));
  };

  const activeCount = Object.values(completions).filter(Boolean).length;
  const totalCount = child.subjects.length;
  const ratio = totalCount > 0 ? activeCount / totalCount : 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const logId = `${child.id}_${selectedDate}`;
      const updatedLog: TaskLog = {
        id: logId,
        childId: child.id,
        date: selectedDate,
        completions,
        notes,
        completedRatio: ratio,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTaskLog(updatedLog);
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  // Pre-fill numbers helper for child-friendly passcode buttons
  const appendDigit = (num: number) => {
    if (passcode.length < 4) {
      setPasscode(prev => prev + num);
    }
  };

  const clearDigit = () => {
    setPasscode("");
  };

  if (!isUnlocked) {
    return (
      <div id="child-login" className="max-w-md mx-auto bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-8 mt-12 transition-all">
        <button 
          id="btn-back-main"
          onClick={onBack}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> 
          返回主頁 (Back)
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-sky-400 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto shadow-md text-white mb-4">
            <span className="text-2xl font-bold">{child.name[0]}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">登入個人進度表 ({child.name})</h2>
          <p className="text-sm text-slate-500 mt-1">{child.year} • 填寫你專屬的 4 位數密碼</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center space-x-3 my-4">
            {[0, 1, 2, 3].map((index) => (
              <div 
                key={index} 
                className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                  passcode.length > index 
                    ? "border-sky-500 bg-sky-50/50 text-sky-600 scale-105" 
                    : "border-slate-200 text-slate-300"
                }`}
              >
                {passcode.length > index ? "●" : ""}
              </div>
            ))}
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-500 text-center font-medium bg-rose-50/50 py-2 px-3 rounded-lg border border-rose-100">
              {errorMsg}
            </p>
          )}

          {/* Child-friendly numeric key pad */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => appendDigit(num)}
                className="h-14 font-semibold text-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl transition duration-100"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={clearDigit}
              className="h-14 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition"
            >
              重置
            </button>
            <button
              type="button"
              onClick={() => appendDigit(0)}
              className="h-14 font-semibold text-lg bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition"
            >
              0
            </button>
            <button
              type="submit"
              disabled={passcode.length < 4}
              className="h-14 font-bold text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl transition shadow-md shadow-sky-100 flex items-center justify-center"
            >
              確認 <Check className="w-4 h-4 ml-1" />
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6 font-mono">
          Hints: Kate 祕蜜是 1111 / Damon 秘密是 2222
        </p>
      </div>
    );
  }

  // Get current weekday text
  const getWeekdayText = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
      const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return `${days[d.getDay()]} (${daysEn[d.getDay()]})`;
    } catch {
      return "";
    }
  };

  const getSubjectIcon = (sub: string) => {
    const s = sub.toLowerCase();
    if (s.includes("中文") || s.includes("chinese")) return <BookOpen className="w-5 h-5 text-emerald-500" />;
    if (s.includes("英文") || s.includes("english")) return <BookOpen className="w-5 h-5 text-indigo-500" />;
    if (s.includes("數學") || s.includes("math")) return <BookOpen className="w-5 h-5 text-sky-500" />;
    if (s.includes("piano") || s.includes("flute") || s.includes("樂器") || s.includes("鋼琴")) return <Music className="w-5 h-5 text-amber-500" />;
    return <Sparkles className="w-5 h-5 text-purple-500" />;
  };

  return (
    <div id="child-dashboard" className="max-w-xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Child Dashboard Header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-white font-bold text-2xl flex items-center justify-center shadow">
            {child.name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              嗨，{child.name}！
            </h1>
            <p className="text-sm text-slate-500">{child.year} • 今天也要加油喔！</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {streakDays > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full text-xs font-semibold border border-rose-100">
              <Flame className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
              <span>連續打卡 {streakDays} 天！</span>
            </div>
          )}
          <button 
            id="btn-child-logout"
            onClick={onBack}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 py-1.5 px-3.5 rounded-lg transition"
          >
            登出 (Logout)
          </button>
        </div>
      </div>

      {/* Main checklist box */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
        {/* Date Selector bar */}
        <div className="bg-slate-50/70 border-b border-slate-100 p-5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-500" />
            <span className="font-semibold text-slate-700">選擇記錄日期 (Select Date)</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]} // Prevent recording future logs
              className="px-3 py-1.5 font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:border-sky-500 text-sm"
            />
            <span className="text-xs text-indigo-500 font-semibold bg-indigo-50 px-2 py-1 rounded">
              {getWeekdayText(selectedDate)}
            </span>
          </div>
        </div>

        {/* Dynamic completion chart circle */}
        <div className="p-8 text-center bg-gradient-to-b from-sky-50/20 to-transparent">
          <div className="relative inline-flex items-center justify-center">
            {/* Custom high-fidelity rounded radial progress */}
            <svg className="w-32 h-32 transform -rotate-90">
              <circle 
                cx="64" 
                cy="64" 
                r="54" 
                className="stroke-slate-100" 
                strokeWidth="10" 
                fill="transparent" 
              />
              <circle 
                cx="64" 
                cy="64" 
                r="54" 
                className="stroke-sky-500 transition-all duration-500" 
                strokeWidth="10" 
                fill="transparent" 
                strokeDasharray={2 * Math.PI * 54}
                strokeDashoffset={2 * Math.PI * 54 * (1 - ratio)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="block text-3xl font-extrabold text-slate-800">{activeCount}/{totalCount}</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">完成率</span>
            </div>
          </div>
          <div className="mt-4">
            {ratio === 1 ? (
              <p className="text-emerald-600 font-bold text-sm inline-flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Trophy className="w-4 h-4 text-amber-500 animate-bounce" /> 太棒了！全部功課做完囉！ 🥇
              </p>
            ) : ratio >= 0.5 ? (
              <p className="text-sky-600 font-medium text-sm">
                做得非常好！繼續向 100% 目標邁進！ 💪
              </p>
            ) : (
              <p className="text-slate-500 text-sm">
                加油喔！把今天的學習項目一個個勾選完成吧 🚀
              </p>
            )}
          </div>
        </div>

        {/* Task Items list */}
        <div className="px-6 pb-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">功課清單 (Homework List)</h2>
          
          <div className="grid gap-3">
            {child.subjects.map((sub) => {
              const isDone = !!completions[sub];
              return (
                <button
                  key={sub}
                  onClick={() => handleToggleSubject(sub)}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all duration-150 group min-h-16 ${
                    isDone 
                      ? "border-emerald-500/80 bg-emerald-50/20 shadow-sm" 
                      : "border-slate-100 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isDone ? "bg-emerald-100" : "bg-slate-50 group-hover:bg-slate-100"
                    }`}>
                      {getSubjectIcon(sub)}
                    </div>
                    <div>
                      <span className={`font-semibold block ${isDone ? "text-emerald-800 line-through decoration-emerald-200" : "text-slate-700"}`}>
                        {sub}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {isDone ? (
                      <CheckCircle className="w-6 h-6 text-emerald-500 fill-emerald-100" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Child input notes */}
          <div className="mt-6 space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span>今日學習小心得 / 給家長的話 (Notes for parents):</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：琴鍵彈得很流暢！英文寫作拿了高分... (Describe what you learned today!)"
              maxLength={200}
              rows={2}
              className="w-full text-sm p-4 text-slate-700 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Save trigger */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-xs text-slate-400">所有記錄將自動同步，方便爸爸媽媽在後台查看。</span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full sm:w-auto px-6 py-3 font-semibold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 ${
                saveSuccess 
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100" 
                  : "bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white shadow-sky-100"
              }`}
            >
              {isSaving ? "正在儲存中..." : saveSuccess ? "儲存成功！🌟" : "登錄進度表 (Submit)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
