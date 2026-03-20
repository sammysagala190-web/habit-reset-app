import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

type RelapseReport = {
  id: string;
  date: string;
  trigger: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type AppState = {
  trackingStartDate: string;
  reports: RelapseReport[];
  userName: string;
};

const STORAGE_KEY = 'habit-reset-app-v1';
const pad = (n: number) => String(n).padStart(2, '0');

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatPrettyDate(key: string) {
  const date = dateFromKey(key);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysBetween(startKey: string, endKey: string) {
  const start = startOfDay(dateFromKey(startKey));
  const end = startOfDay(dateFromKey(endKey));
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthMatrix(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return { weeks, year, month };
}

function dateKeyFor(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [trackingStartDate, setTrackingStartDate] = useState(todayKey());
  const [reports, setReports] = useState<RelapseReport[]>([]);
  const [userName, setUserName] = useState('Sam');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(todayKey());
  const [formTrigger, setFormTrigger] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: Partial<AppState> = JSON.parse(raw);
          setTrackingStartDate(parsed.trackingStartDate ?? todayKey());
          setReports(Array.isArray(parsed.reports) ? parsed.reports : []);
          setUserName(parsed.userName ?? 'Sam');
        }
      } catch {
        Alert.alert('Load issue', 'Could not load your saved habit data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    const state: AppState = { trackingStartDate, reports, userName };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      Alert.alert('Save issue', 'Could not save your latest changes.');
    });
  }, [loading, trackingStartDate, reports, userName]);

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    [reports]
  );

  const relapseDateSet = useMemo(() => new Set(reports.map((report) => report.date)), [reports]);

  const lastRelapseDate = useMemo(() => {
    if (sortedReports.length === 0) return null;
    return sortedReports[0].date;
  }, [sortedReports]);

  const streak = useMemo(() => {
    const today = todayKey();
    if (lastRelapseDate) {
      return Math.max(0, daysBetween(lastRelapseDate, today));
    }
    return Math.max(1, daysBetween(trackingStartDate, today) + 1);
  }, [lastRelapseDate, trackingStartDate]);

  const longestGap = useMemo(() => {
    const today = todayKey();
    const dates = [...new Set(reports.map((report) => report.date))].sort();
    if (dates.length === 0) return Math.max(1, daysBetween(trackingStartDate, today) + 1);

    let best = Math.max(0, daysBetween(trackingStartDate, dates[0]));
    for (let i = 1; i < dates.length; i += 1) {
      best = Math.max(best, Math.max(0, daysBetween(dates[i - 1], dates[i]) - 1));
    }
    best = Math.max(best, Math.max(0, daysBetween(dates[dates.length - 1], today)));
    return best;
  }, [reports, trackingStartDate]);

  const resetForm = () => {
    setEditingId(null);
    setFormDate(todayKey());
    setFormTrigger('');
    setFormNotes('');
  };

  const saveReport = () => {
    if (!isValidDateKey(formDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format.');
      return;
    }
    if (daysBetween(formDate, todayKey()) < 0) {
      Alert.alert('Invalid date', 'Relapse date cannot be in the future.');
      return;
    }
    if (daysBetween(trackingStartDate, formDate) < 0) {
      Alert.alert('Invalid date', 'Relapse date cannot be earlier than your tracking start date.');
      return;
    }

    const timestamp = new Date().toISOString();

    if (editingId) {
      setReports((prev) =>
        prev.map((report) =>
          report.id === editingId
            ? {
                ...report,
                date: formDate,
                trigger: formTrigger.trim(),
                notes: formNotes.trim(),
                updatedAt: timestamp,
              }
            : report
        )
      );
      resetForm();
      return;
    }

    const newReport: RelapseReport = {
      id: `${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
      date: formDate,
      trigger: formTrigger.trim(),
      notes: formNotes.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setReports((prev) => [...prev, newReport]);
    resetForm();
  };

  const startEdit = (report: RelapseReport) => {
    setEditingId(report.id);
    setFormDate(report.date);
    setFormTrigger(report.trigger);
    setFormNotes(report.notes);
  };

  const deleteReport = (id: string) => {
    setReports((prev) => prev.filter((report) => report.id !== id));
    if (editingId === id) resetForm();
  };

  const monthData = useMemo(() => getMonthMatrix(new Date()), []);
  const monthLabel = new Date(monthData.year, monthData.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const today = todayKey();

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.loadingText}>Loading habit tracker...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Habit Reset</Text>
        <Text style={styles.subtitle}>Automatic streaks, relapse logging, editable reports.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.metric}>Name: {userName || 'User'}</Text>
          <Text style={styles.metric}>Tracking since: {formatPrettyDate(trackingStartDate)}</Text>
          <Text style={styles.metric}>Current streak: {streak} day{streak === 1 ? '' : 's'}</Text>
          <Text style={styles.metric}>Longest clean streak: {longestGap} day{longestGap === 1 ? '' : 's'}</Text>
          <Text style={styles.metric}>Total relapse reports: {reports.length}</Text>
          <Text style={styles.metric}>Last relapse: {lastRelapseDate ? formatPrettyDate(lastRelapseDate) : 'None logged'}</Text>
          <Text style={styles.helperText}>The streak updates automatically every day unless you log a relapse. No success check in is needed.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={userName}
            onChangeText={setUserName}
            placeholder="Your name"
          />
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Tracking start date</Text>
          <TextInput
            style={styles.input}
            value={trackingStartDate}
            onChangeText={setTrackingStartDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? 'Edit relapse report' : 'Add relapse report'}</Text>
          <Text style={styles.inputLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={formDate}
            onChangeText={setFormDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Trigger</Text>
          <TextInput
            style={styles.input}
            value={formTrigger}
            onChangeText={setFormTrigger}
            placeholder="What triggered it?"
          />
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Notes</Text>
          <TextInput
            style={styles.textArea}
            value={formNotes}
            onChangeText={setFormNotes}
            placeholder="Write what happened and what to improve next time."
            multiline
          />
          <Pressable style={styles.primaryButton} onPress={saveReport}>
            <Text style={styles.primaryButtonText}>{editingId ? 'Save changes' : 'Save report'}</Text>
          </Pressable>
          {editingId ? (
            <Pressable style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>Cancel editing</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{monthLabel}</Text>
          <View style={styles.weekHeader}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text key={day} style={styles.weekHeaderText}>{day}</Text>
            ))}
          </View>
          {monthData.weeks.map((week, index) => (
            <View key={index} style={styles.weekRow}>
              {week.map((day, cellIndex) => {
                if (!day) return <View key={cellIndex} style={styles.dayCell} />;
                const key = dateKeyFor(monthData.year, monthData.month, day);
                const isToday = key === today;
                const started = daysBetween(trackingStartDate, key) >= 0;
                const inPastOrToday = daysBetween(key, today) >= 0;
                const relapse = relapseDateSet.has(key);
                const cleanDay = started && inPastOrToday && !relapse;
                return (
                  <View
                    key={cellIndex}
                    style={[
                      styles.dayCell,
                      cleanDay && styles.dayCellClean,
                      relapse && styles.dayCellRelapse,
                      isToday && styles.dayCellToday,
                    ]}
                  >
                    <Text style={[styles.dayText, relapse && styles.dayTextRelapse]}>{day}</Text>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={styles.legend}>Green means no relapse, red means relapse reported, outlined means today.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Relapse history</Text>
          {sortedReports.length === 0 ? (
            <Text style={styles.metric}>No relapse reports yet.</Text>
          ) : (
            sortedReports.map((report) => (
              <View key={report.id} style={styles.historyItem}>
                <Text style={styles.historyTitle}>{formatPrettyDate(report.date)}</Text>
                <Text style={styles.historyMeta}>Trigger: {report.trigger || 'Not specified'}</Text>
                <Text style={styles.historyMeta}>Notes: {report.notes || 'No notes'}</Text>
                <View style={styles.historyButtons}>
                  <Pressable style={styles.smallButton} onPress={() => startEdit(report)}>
                    <Text style={styles.smallButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.smallDangerButton} onPress={() => deleteReport(report.id)}>
                    <Text style={styles.smallDangerButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f7fb',
  },
  loadingText: {
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  metric: {
    fontSize: 15,
    marginBottom: 6,
  },
  helperText: {
    marginTop: 10,
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#374151',
  },
  input: {
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 100,
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1f3c88',
    fontSize: 14,
    fontWeight: '700',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekHeaderText: {
    width: '13.5%',
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayCell: {
    width: '13.5%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  dayCellClean: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  dayCellRelapse: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: '#1f3c88',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayTextRelapse: {
    color: '#991b1b',
  },
  legend: {
    marginTop: 10,
    color: '#6b7280',
    fontSize: 13,
  },
  historyItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  historyMeta: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  historyButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  smallButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallButtonText: {
    color: '#1f3c88',
    fontWeight: '700',
  },
  smallDangerButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallDangerButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
});
