import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, X, ArrowRight, Clock, CheckCircle } from 'lucide-react';
import { db } from '../../db';
import { getTodayDateStr } from '../../utils/date';
import { ActiveView } from '../../types';

interface BacklogDueNotificationProps {
  activeView: ActiveView;
  onNavigateToBacklog: () => void;
}

const SNOOZE_STORAGE_KEY = 'backlog_due_reminder_snooze_until';
const ACK_STORAGE_KEY = 'backlog_due_reminder_ack_date';

export const BacklogDueNotification: React.FC<BacklogDueNotificationProps> = ({
  activeView,
  onNavigateToBacklog,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Periodically update current timestamp to re-evaluate 1hr snooze
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000); // Check every 30 seconds
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayDateStr();

  // Reactive query for all active backlog items due today (or overdue)
  const dueItems =
    useLiveQuery(async () => {
      const all = await db.backlogItems.toArray();
      return all.filter(
        (item) => item.status !== 'completed' && item.targetDate && item.targetDate <= todayStr
      );
    }, [todayStr]) || [];

  // Do not show if:
  // 1. We are already on the backlog screen
  // 2. There are 0 items due today or overdue
  // 3. User acknowledged for today
  // 4. User snoozed for 1 hour and snooze time hasn't expired
  // 5. User dismissed the alert in this session
  if (activeView === 'backlog') return null;
  if (dueItems.length === 0) return null;
  if (isDismissed) return null;

  const ackDate = localStorage.getItem(ACK_STORAGE_KEY);
  if (ackDate === todayStr) return null;

  const snoozeUntilStr = localStorage.getItem(SNOOZE_STORAGE_KEY);
  if (snoozeUntilStr) {
    const snoozeUntil = parseInt(snoozeUntilStr, 10);
    if (now < snoozeUntil) return null;
  }

  // Handlers
  const handleAcknowledge = () => {
    localStorage.setItem(ACK_STORAGE_KEY, todayStr);
    setIsDismissed(true);
  };

  const handleRemindIn1Hour = () => {
    const oneHourLater = Date.now() + 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_STORAGE_KEY, oneHourLater.toString());
    setIsDismissed(true);
  };

  const topItems = dueItems.slice(0, 2);

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white dark:bg-[#050c21] rounded-2xl border border-rose-200 dark:border-[#ff2d5f]/40 shadow-2xl p-4 text-slate-900 dark:text-white animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff2d5f] to-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-[#ff2d5f]/25">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              Backlog Tasks Due Today
              <span className="w-2 h-2 rounded-full bg-[#ff2d5f] animate-ping" />
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              You have <strong className="text-[#ff2d5f] font-bold">{dueItems.length} task(s)</strong> scheduled for completion today.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
          title="Dismiss for now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Snippet of due items */}
      <div className="mt-3 space-y-1.5 bg-slate-50 dark:bg-[#020612] p-2.5 rounded-xl border border-slate-100 dark:border-[#142552] text-xs">
        {topItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
              • {item.title}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-[#ff2d5f]/20 text-[#ff2d5f] flex-shrink-0">
              {item.targetDate === todayStr ? 'Today' : 'Overdue'}
            </span>
          </div>
        ))}
        {dueItems.length > 2 && (
          <div className="text-[10px] text-slate-400 font-medium italic">
            + {dueItems.length - 2} more item(s)...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#142552] text-xs">
        <button
          type="button"
          onClick={handleAcknowledge}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] rounded-lg transition-colors cursor-pointer"
          title="Acknowledge for today"
        >
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          <span>Acknowledge</span>
        </button>

        <button
          type="button"
          onClick={handleRemindIn1Hour}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#08122f] hover:bg-slate-200 dark:hover:bg-[#0c1a40] rounded-lg transition-colors cursor-pointer"
          title="Snooze and remind again in 1 hour"
        >
          <Clock className="w-3 h-3 text-amber-500" />
          <span>Remind in 1 hr</span>
        </button>

        <button
          type="button"
          onClick={onNavigateToBacklog}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black text-white bg-[#ff2d5f] hover:bg-[#e62252] rounded-lg transition-all shadow-xs hover:scale-102 cursor-pointer ml-auto"
        >
          <span>View</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
