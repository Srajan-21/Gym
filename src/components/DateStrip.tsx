import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { addDays, formatReadableDate, useSelectedDate } from '../context/DateContext';
import { getTodayDateString } from '../lib/storage';
import { Colors } from '../theme/colors';

const ITEM_WIDTH = 52;
const ITEM_GAP = 8;
const ITEM_STRIDE = ITEM_WIDTH + ITEM_GAP;
const DAYS_BEFORE_TODAY = 90;
const DAYS_AFTER_TODAY = 14;

export function DateStrip() {
  const { selectedDate, setSelectedDate, shiftDate, resetToToday, isToday } =
    useSelectedDate();
  const today = getTodayDateString();
  const listRef = useRef<FlatList<string>>(null);

  const days = useMemo(() => {
    const start = addDays(today, -DAYS_BEFORE_TODAY);
    const end = addDays(today, DAYS_AFTER_TODAY);
    // Expand range if user navigates beyond default window via arrows
    const effectiveStart = selectedDate < start ? addDays(selectedDate, -14) : start;
    const effectiveEnd = selectedDate > end ? addDays(selectedDate, 14) : end;

    const list: string[] = [];
    let cursor = effectiveStart;
    while (cursor <= effectiveEnd) {
      list.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return list;
  }, [today, selectedDate]);

  const selectedIndex = useMemo(() => {
    const idx = days.indexOf(selectedDate);
    return idx >= 0 ? idx : days.indexOf(today);
  }, [days, selectedDate, today]);

  const selectedMonthLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDate]);

  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<string> | null | undefined, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_STRIDE * index,
      index,
    }),
    []
  );

  const renderDay = useCallback(
    ({ item: dateStr }: { item: string }) => {
      const active = dateStr === selectedDate;
      const isCurrentToday = dateStr === today;
      const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
      const dt = new Date(y, m - 1, d);
      const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const monthShort =
        d === 1 ? dt.toLocaleDateString('en-US', { month: 'short' }) : null;

      return (
        <Pressable
          style={[styles.dayCard, active && styles.dayCardActive]}
          onPress={() => setSelectedDate(dateStr)}
        >
          <Text style={[styles.weekday, active && styles.weekdayActive]}>
            {monthShort ?? weekday}
          </Text>
          <Text style={[styles.dayNum, active && styles.dayNumActive]}>{d}</Text>
          {isCurrentToday && (
            <View style={[styles.todayDot, active && styles.todayDotActive]} />
          )}
        </Pressable>
      );
    },
    [selectedDate, setSelectedDate, today]
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <Pressable style={styles.arrowBtn} onPress={() => shiftDate(-1)}>
          <ChevronLeft size={16} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.centerLabel}>
          <Calendar size={14} color={Colors.gold} />
          <Text style={styles.dateTitle}>{formatReadableDate(selectedDate)}</Text>
          <Text style={styles.dateIso}>{selectedMonthLabel}</Text>
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

      <FlatList
        ref={listRef}
        data={days}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={Math.max(0, selectedIndex)}
        contentContainerStyle={styles.stripContent}
        ItemSeparatorComponent={() => <View style={{ width: ITEM_GAP }} />}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.index * ITEM_STRIDE,
            animated: true,
          });
        }}
        renderItem={renderDay}
      />
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
    paddingHorizontal: 2,
  },
  dayCard: {
    width: ITEM_WIDTH,
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
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
    marginTop: 1,
  },
  todayDotActive: {
    backgroundColor: Colors.text,
  },
});
