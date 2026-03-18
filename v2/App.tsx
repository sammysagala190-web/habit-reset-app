import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

type TabKey = 'Home' | 'Calendar' | 'History' | 'Settings';
type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
type Feedback = 'Too Easy' | 'Just Right' | 'Too Hard';
type Focus = 'Full Body' | 'Abs' | 'Chest' | 'Legs' | 'Arms' | 'Butt';

type WorkoutSession = {
  date: string;
  completed: boolean;
  feedback?: Feedback;
  routineTitle: string;
  durationMin: number;
  focus: Focus;
};

type WorkoutPlan = {
  title: string;
  focus: Focus;
  durationMin: number;
  intensity: string;
  exercises: string[];
  restSeconds: number;
  source: 'adaptive-engine' | 'online-service';
};

type SettingsState = {
  userName: string;
  remindersEnabled: boolean;
  goalPerWeek: number;
  onlineSuggestionsEnabled: boolean;
  customApiUrl: string;
};

const STORAGE_KEY = 'home-workout-coach-v2';
const tabKeys: TabKey[] = ['Home', 'Calendar', 'History', 'Settings'];
const focusOptions: Focus[] = ['Full Body', 'Abs', 'Chest', 'Legs', 'Arms', 'Butt'];
const difficulties: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];
const feedbackOptions: Feedback[] = ['Too Easy', 'Just Right', 'Too Hard'];

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

function clampDifficulty(level: number) {
  return Math.max(0, Math.min(2, level));
}

function getDifficultyLabel(level: number): Difficulty {
  return difficulties[clampDifficulty(level)];
}

function formatPrettyDate(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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

function getAdaptivePlan(level: number, focus: Focus, previousFeedback?: Feedback): WorkoutPlan {
  let adjustedLevel = clampDifficulty(level);
  if (previousFeedback === 'Too Easy') adjustedLevel = clampDifficulty(adjustedLevel + 1);
  if (previousFeedback === 'Too Hard') adjustedLevel = clampDifficulty(adjustedLevel - 1);

  const presets: Record<Difficulty, { rounds: number; work: number; rest: number; duration: number; intensity: string }> = {
    Beginner: { rounds: 2, work: 30, rest: 40, duration: 16, intensity: 'Low to moderate' },
    Intermediate: { rounds: 3, work: 40, rest: 30, duration: 24, intensity: 'Moderate' },
    Advanced: { rounds: 4, work: 45, rest: 20, duration: 32, intensity: 'Moderate to high' },
  };

  const exerciseBank: Record<Focus, string[]> = {
    'Full Body': ['Jumping Jacks', 'Bodyweight Squats', 'Push Ups', 'Mountain Climbers', 'Glute Bridges', 'Plank'],
    Abs: ['Dead Bug', 'Bicycle Crunches', 'Leg Raises', 'Plank', 'Heel Taps', 'Russian Twists'],
    Chest: ['Push Ups', 'Wide Push Ups', 'Incline Push Ups', 'Pike Push Ups', 'Wall Push Ups', 'Slow Negative Push Ups'],
    Legs: ['Bodyweight Squats', 'Reverse Lunges', 'Wall Sit', 'Calf Raises', 'Split Squats', 'Pulse Squats'],
    Arms: ['Push Ups', 'Triceps Dips on Chair', 'Plank Up Downs', 'Arm Circles', 'Diamond Push Ups', 'Shoulder Taps'],
    Butt: ['Glute Bridges', 'Donkey Kicks', 'Fire Hydrants', 'Sumo Squats', 'Hip Thrusts', 'Curtsy Lunges'],
  };

  const difficulty = getDifficultyLabel(adjustedLevel);
  const preset = presets[difficulty];
  const exercises = exerciseBank[focus].slice(0, Math.min(6, preset.rounds + 3));

  return {
    title: `${difficulty} ${focus} Session`,
    focus,
    durationMin: preset.duration,
    intensity: `${preset.intensity}, ${preset.rounds} rounds, ${preset.work}s work`,
    exercises,
    restSeconds: preset.rest,
    source: 'adaptive-engine',
  };
}

async function fetchOnlineSuggestion(apiUrl: string, payload: { difficulty: Difficulty; focus: Focus; previousFeedback?: Feedback }) {
  if (!apiUrl) return null;
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.title || !Array.isArray(data?.exercises)) return null;
    return {
      title: String(data.title),
      focus: payload.focus,
      durationMin: Number(data.durationMin ?? 20),
      intensity: String(data.intensity ?? payload.difficulty),
      exercises: data.exercises.map((item: unknown) => String(item)),
      restSeconds: Number(data.restSeconds ?? 30),
      source: 'online-service' as const,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('Home');
  const [loading, setLoading] = useState(true);
  const [difficultyLevel, setDifficultyLevel] = useState<number>(0);
  const [focus, setFocus] = useState<Focus>('Full Body');
  const [sessions, setSessions] = useState<Record<string, WorkoutSession>>({});
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [settings, setSettings] = useState<SettingsState>({
    userName: 'Sam',
    remindersEnabled: false,
    goalPerWeek: 4,
    onlineSuggestionsEnabled: false,
    customApiUrl: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setDifficultyLevel(parsed.difficultyLevel ?? 0);
          setFocus(parsed.focus ?? 'Full Body');
          setSessions(parsed.sessions ?? {});
          setNote(parsed.note ?? '');
          setSettings({
            userName: parsed.settings?.userName ?? 'Sam',
            remindersEnabled: parsed.settings?.remindersEnabled ?? false,
            goalPerWeek: parsed.settings?.goalPerWeek ?? 4,
            onlineSuggestionsEnabled: parsed.settings?.onlineSuggestionsEnabled ?? false,
            customApiUrl: parsed.settings?.customApiUrl ?? '',
          });
        }
      } catch {
        Alert.alert('Load issue', 'Could not load saved app data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ difficultyLevel, focus, sessions, note, settings })
    ).catch(() => {
      Alert.alert('Save issue', 'Could not save your latest changes.');
    });
  }, [loading, difficultyLevel, focus, sessions, note, settings]);

  const latestFeedback = sessions[todayKey]?.feedback;

  useEffect(() => {
    const buildPlan = async () => {
      const fallback = getAdaptivePlan(difficultyLevel, focus, latestFeedback);
      if (settings.onlineSuggestionsEnabled && settings.customApiUrl.trim()) {
        const online = await fetchOnlineSuggestion(settings.customApiUrl.trim(), {
          difficulty: getDifficultyLabel(difficultyLevel),
          focus,
          previousFeedback: latestFeedback,
        });
        setPlan(online ?? fallback);
      } else {
        setPlan(fallback);
      }
    };
    buildPlan();
  }, [difficultyLevel, focus, latestFeedback, settings.onlineSuggestionsEnabled, settings.customApiUrl]);

  const monthData = useMemo(() => getMonthMatrix(new Date()), []);
  const monthLabel = new Date(monthData.year, monthData.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const sessionList = Object.values(sessions).sort((a, b) => b.date.localeCompare(a.date));
  const completedCount = sessionList.filter((s) => s.completed).length;
  const thisWeekCount = sessionList.filter((s) => {
    const d = new Date(s.date + 'T00:00:00');
    const diffDays = (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays < 7 && s.completed;
  }).length;

  const streak = (() => {
    let count = 0;
    const cursor = new Date();
    while (true) {
      const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
      if (sessions[key]?.completed) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  })();

  const markTodayDone = () => {
    if (!plan) return;
    setSessions((prev) => ({
      ...prev,
      [todayKey]: {
        date: todayKey,
        completed: true,
        routineTitle: plan.title,
        durationMin: plan.durationMin,
        focus: plan.focus,
        feedback: prev[todayKey]?.feedback,
      },
    }));
  };

  const setTodayFeedback = (feedback: Feedback) => {
    if (!plan) return;
    setSessions((prev) => ({
      ...prev,
      [todayKey]: {
        date: todayKey,
        completed: prev[todayKey]?.completed ?? false,
        routineTitle: prev[todayKey]?.routineTitle ?? plan.title,
        durationMin: prev[todayKey]?.durationMin ?? plan.durationMin,
        focus: prev[todayKey]?.focus ?? plan.focus,
        feedback,
      },
    }));
  };

  const homeContent = (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Welcome, {settings.userName}</Text>
        <Text style={styles.metric}>Completed sessions: {completedCount}</Text>
        <Text style={styles.metric}>Current streak: {streak} day{streak === 1 ? '' : 's'}</Text>
        <Text style={styles.metric}>This week: {thisWeekCount} / {settings.goalPerWeek}</Text>
        <Text style={styles.metric}>Today: {sessions[todayKey]?.completed ? 'Done' : 'Not yet completed'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Difficulty</Text>
        <View style={styles.rowWrap}>
          {difficulties.map((label, index) => (
            <Pressable key={label} style={[styles.chip, difficultyLevel === index && styles.chipActive]} onPress={() => setDifficultyLevel(index)}>
              <Text style={[styles.chipText, difficultyLevel === index && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Focus area</Text>
        <View style={styles.rowWrap}>
          {focusOptions.map((item) => (
            <Pressable key={item} style={[styles.chip, focus === item && styles.chipActive]} onPress={() => setFocus(item)}>
              <Text style={[styles.chipText, focus === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today’s plan</Text>
        {plan ? (
          <>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planMeta}>Duration: {plan.durationMin} min</Text>
            <Text style={styles.planMeta}>Intensity: {plan.intensity}</Text>
            <Text style={styles.planMeta}>Rest: {plan.restSeconds} sec</Text>
            <Text style={styles.planMeta}>Source: {plan.source}</Text>
            {plan.exercises.map((exercise) => (
              <Text key={exercise} style={styles.exerciseItem}>• {exercise}</Text>
            ))}
          </>
        ) : (
          <Text>No workout available yet.</Text>
        )}
        <Pressable style={styles.primaryButton} onPress={markTodayDone}>
          <Text style={styles.primaryButtonText}>Mark today complete</Text>
        </Pressable>
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>How did it feel?</Text>
        <View style={styles.rowWrap}>
          {feedbackOptions.map((item) => (
            <Pressable key={item} style={[styles.chip, sessions[todayKey]?.feedback === item && styles.chipActive]} onPress={() => setTodayFeedback(item)}>
              <Text style={[styles.chipText, sessions[todayKey]?.feedback === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today’s notes</Text>
        <TextInput style={styles.textArea} placeholder="Write what felt good, difficult, or what you want tomorrow." multiline value={note} onChangeText={setNote} />
      </View>
    </>
  );

  const calendarContent = (
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
            const done = sessions[key]?.completed;
            const isToday = key === todayKey;
            return (
              <View key={cellIndex} style={[styles.dayCell, done && styles.dayCellDone, isToday && styles.dayCellToday]}>
                <Text style={[styles.dayText, done && styles.dayTextDone]}>{day}</Text>
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.legend}>Filled cells mean completed workout days. Outlined cell marks today.</Text>
    </View>
  );

  const historyContent = (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Workout history</Text>
      {sessionList.length === 0 ? (
        <Text style={styles.metric}>No sessions saved yet.</Text>
      ) : (
        sessionList.map((session) => (
          <View key={session.date} style={styles.historyItem}>
            <Text style={styles.historyTitle}>{formatPrettyDate(session.date)}</Text>
            <Text style={styles.historyMeta}>{session.routineTitle}</Text>
            <Text style={styles.historyMeta}>{session.focus}, {session.durationMin} min</Text>
            <Text style={styles.historyMeta}>Feedback: {session.feedback ?? 'Not set'}</Text>
          </View>
        ))
      )}
    </View>
  );

  const settingsContent = (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Profile</Text>
      <TextInput style={styles.input} value={settings.userName} onChangeText={(value) => setSettings((prev) => ({ ...prev, userName: value }))} placeholder="Your name" />
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Weekly goal</Text>
      <View style={styles.rowWrap}>
        {[3, 4, 5, 6].map((goal) => (
          <Pressable key={goal} style={[styles.chip, settings.goalPerWeek === goal && styles.chipActive]} onPress={() => setSettings((prev) => ({ ...prev, goalPerWeek: goal }))}>
            <Text style={[styles.chipText, settings.goalPerWeek === goal && styles.chipTextActive]}>{goal} days</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Reminders enabled</Text>
        <Switch value={settings.remindersEnabled} onValueChange={(value) => setSettings((prev) => ({ ...prev, remindersEnabled: value }))} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Online suggestions</Text>
        <Switch value={settings.onlineSuggestionsEnabled} onValueChange={(value) => setSettings((prev) => ({ ...prev, onlineSuggestionsEnabled: value }))} />
      </View>
      <Text style={styles.helperText}>Paste your backend URL below when you are ready. Until then the app uses the local adaptive workout engine.</Text>
      <TextInput style={styles.input} value={settings.customApiUrl} onChangeText={(value) => setSettings((prev) => ({ ...prev, customApiUrl: value }))} placeholder="https://your-api-url.example/workout" autoCapitalize="none" />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.loadingText}>Loading app...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <Text style={styles.title}>Home Workout Coach V2</Text>
        <Text style={styles.subtitle}>Bodyweight workouts, adaptive tracking, and a cleaner app structure.</Text>
      </View>
      <View style={styles.tabBar}>
        {tabKeys.map((item) => (
          <Pressable key={item} style={[styles.tabButton, tab === item && styles.tabButtonActive]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        {tab === 'Home' && homeContent}
        {tab === 'Calendar' && calendarContent}
        {tab === 'History' && historyContent}
        {tab === 'Settings' && settingsContent}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f7fb' },
  appHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  container: { padding: 20, paddingTop: 12, paddingBottom: 50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f7fb' },
  loadingText: { fontSize: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#4b5563' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  tabButton: { flex: 1, backgroundColor: '#e5e7eb', paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#1f3c88' },
  tabText: { fontWeight: '600', color: '#111827' },
  tabTextActive: { color: '#ffffff' },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  metric: { fontSize: 15, marginBottom: 6 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: '#eef2ff' },
  chipActive: { backgroundColor: '#1f3c88' },
  chipText: { color: '#1f2937', fontWeight: '600' },
  chipTextActive: { color: '#ffffff' },
  planTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  planMeta: { fontSize: 14, marginBottom: 6, color: '#374151' },
  exerciseItem: { fontSize: 15, marginTop: 6 },
  primaryButton: { marginTop: 14, backgroundColor: '#111827', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  textArea: { minHeight: 100, borderColor: '#d1d5db', borderWidth: 1, borderRadius: 14, padding: 12, textAlignVertical: 'top' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekHeaderText: { width: '13.5%', textAlign: 'center', fontSize: 12, color: '#6b7280', fontWeight: '600' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dayCell: { width: '13.5%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  dayCellDone: { backgroundColor: '#c7f9cc', borderColor: '#84cc16' },
  dayCellToday: { borderColor: '#1f3c88', borderWidth: 2 },
  dayText: { fontSize: 14, fontWeight: '600' },
  dayTextDone: { color: '#14532d' },
  legend: { marginTop: 10, color: '#6b7280', fontSize: 13 },
  historyItem: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  historyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  historyMeta: { fontSize: 14, color: '#374151', marginBottom: 2 },
  input: { borderColor: '#d1d5db', borderWidth: 1, borderRadius: 14, padding: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  helperText: { color: '#6b7280', fontSize: 13, marginTop: 12, marginBottom: 10 },
});
