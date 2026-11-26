import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addDays, formatReadableDate, useSelectedDate } from '../context/DateContext';
import { getTodayDateString } from '../lib/storage';
import { Colors } from '../theme/colors';

export function DateStrip() {
  const { selectedDate, setSelectedDate, shiftDate, resetToToday, isToday } =
    useSelectedDate();
  const today = getTodayDateString();

  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = -6; i <= 0; i++) {
      list.push(addDays(today, i));
    }
    return list;
  }, [today]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <Pressable style={styles.arrowBtn} onPress={() => shiftDate(-1)}>
          <ChevronLeft size={16} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.centerLabel}>
          <Calendar size={14} color={Colors.gold} />
          <Text style={styles.dateTitle}>{formatReadableDate(selectedDate)}</Text>
          <Text style={styles.dateIso}>{selectedDate}</Text>
        </View>

        <View style={styles.rightControls}>
          {!isToday && (
            <Pressable style={styles.todayPill} onPress={resetToToday}>
              <Text style={styles.todayPillText}>Today</Text>
            </Pressable>
          )}
          <Pressable style={styles.arrowBtn} onPress={() => shiftDate(1)}>
            <ChevronRight size={16} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
      >
        {days.map((dateStr) => {
          const active = dateStr === selectedDate;
          const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
          const dt = new Date(y, m - 1, d);
          const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = d;
          return (
            <Pressable
              key={dateStr}
              style={[styles.dayCard, active && styles.dayCardActive]}
              onPress={() => setSelectedDate(dateStr)}
            >
              <Text style={[styles.weekday, active && styles.weekdayActive]}>{weekday}</Text>
              <Text style={[styles.dayNum, active && styles.dayNumActive]}>{dayNum}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dateTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dateIso: {
    color: Colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  todayPillText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  stripContent: {
    gap: 8,
  },
  dayCard: {
    width: 46,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    gap: 2,
  },
  dayCardActive: {
    backgroundColor: Colors.goldSoft,
    borderColor: Colors.gold,
  },
  weekday: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  weekdayActive: {
    color: Colors.gold,
  },
  dayNum: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dayNumActive: {
    color: Colors.text,
  },
});
