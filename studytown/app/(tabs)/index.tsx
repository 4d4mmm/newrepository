import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGame } from '../../src/store/gameStore';
import { COLORS, WORLD_THEMES } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { state, dispatch } = useGame();
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const coinBounce = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const theme = WORLD_THEMES[state.world];
  const goalSeconds = state.dailyGoalMinutes * 60;
  const totalStudied = state.todayStudiedSeconds + (state.isTimerRunning ? sessionSeconds : 0);
  const progress = Math.min(totalStudied / goalSeconds, 1);
  const goalComplete = totalStudied >= goalSeconds;
  const prevGoalComplete = useRef(false);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Check if goal just completed
  useEffect(() => {
    if (goalComplete && !prevGoalComplete.current) {
      prevGoalComplete.current = true;
      dispatch({ type: 'COMPLETE_DAILY_GOAL' });
      Animated.sequence([
        Animated.timing(coinBounce, { toValue: 1.3, duration: 200, useNativeDriver: true }),
        Animated.timing(coinBounce, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [goalComplete]);

  // Pulse animation when timer running
  useEffect(() => {
    if (state.isTimerRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state.isTimerRunning]);

  // Timer tick
  useEffect(() => {
    if (state.isTimerRunning) {
      intervalRef.current = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isTimerRunning]);

  const handleToggleTimer = useCallback(() => {
    if (state.isTimerRunning) {
      dispatch({ type: 'STOP_TIMER', elapsedSeconds: sessionSeconds });
      setSessionSeconds(0);
    } else {
      dispatch({ type: 'START_TIMER' });
      setSessionSeconds(0);
    }
  }, [state.isTimerRunning, sessionSeconds, dispatch]);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.worldLabel}>{theme.emoji} {WORLD_THEMES[state.world].name}</Text>
        <Animated.View style={[styles.coinBadge, { transform: [{ scale: coinBounce }] }]}>
          <Text style={styles.coinText}>🪙 {state.coins}</Text>
        </Animated.View>
      </View>

      {/* Streak */}
      {state.currentStreak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakText}>🔥 {state.currentStreak} day streak!</Text>
        </View>
      )}

      {/* Timer Circle */}
      <View style={styles.timerSection}>
        <Animated.View
          style={[
            styles.timerCircle,
            {
              borderColor: goalComplete ? COLORS.success : theme.palette[0],
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Text style={styles.timerDisplay}>
            {state.isTimerRunning ? formatTime(sessionSeconds) : formatTime(totalStudied)}
          </Text>
          <Text style={styles.timerLabel}>
            {state.isTimerRunning
              ? 'Studying...'
              : goalComplete
              ? 'Goal Complete! 🎉'
              : `Goal: ${state.dailyGoalMinutes}m`}
          </Text>
        </Animated.View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>
          {Math.floor(totalStudied / 60)}m / {state.dailyGoalMinutes}m
        </Text>
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth,
                backgroundColor: goalComplete ? COLORS.success : theme.palette[0],
              },
            ]}
          />
        </View>
        <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* Start/Stop Button */}
      <TouchableOpacity
        onPress={handleToggleTimer}
        activeOpacity={0.8}
        style={[
          styles.timerBtn,
          {
            backgroundColor: state.isTimerRunning ? COLORS.primary : theme.palette[0],
          },
        ]}
      >
        <Text style={styles.timerBtnText}>
          {state.isTimerRunning ? '⏹ Stop' : '▶ Start Studying'}
        </Text>
      </TouchableOpacity>

      {/* Daily coins earned */}
      {goalComplete && (
        <Text style={styles.coinsEarnedText}>
          +{100 + Math.max(0, (state.currentStreak - 1)) * 10} coins earned today!
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  worldLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  coinBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.coinGold,
  },
  coinText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.coinGold,
  },
  streakBanner: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accentDark,
  },
  timerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCircle: {
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: (width * 0.65) / 2,
    borderWidth: 6,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 24,
  },
  progressLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  progressPercent: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 4,
  },
  timerBtn: {
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerBtnText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  coinsEarnedText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.coinGold,
    textAlign: 'center',
    marginBottom: 8,
  },
});
