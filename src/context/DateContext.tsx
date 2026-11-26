import React, { createContext, useContext, useState } from 'react';
import { getTodayDateString } from '../lib/storage';

interface DateContextValue {
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  shiftDate: (days: number) => void;
  resetToToday: () => void;
  isToday: boolean;
}

const DateContext = createContext<DateContextValue>({
  selectedDate: getTodayDateString(),
  setSelectedDate: () => {},
  shiftDate: () => {},
  resetToToday: () => {},
  isToday: true,
});

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function formatReadableDate(dateStr: string): string {
  const today = getTodayDateString();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function getDayOfWeekFromDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).getDay();
}

export function DateProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const today = getTodayDateString();

  const shiftDate = (days: number) => {
    setSelectedDate((prev) => addDays(prev, days));
  };

  const resetToToday = () => {
    setSelectedDate(getTodayDateString());
  };

  return (
    <DateContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        shiftDate,
        resetToToday,
        isToday: selectedDate === today,
      }}
    >
      {children}
    </DateContext.Provider>
  );
}

export function useSelectedDate() {
  return useContext(DateContext);
}
