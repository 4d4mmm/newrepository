import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGame } from '../../src/store/gameStore';
import { COLORS, WORLD_THEMES } from '../../src/constants/theme';

export default function StatsScreen() {
  const { state } = useGame();
  const theme = WORLD_THEMES[state.world];

  const totalHours = (state.totalStudiedMinutes / 60).toFixed(1);
  const buildingsPlaced = state.placedBuildings.length;
  const daysStudied = state.dayRecords.filter((r) => r.completed).length;

  // Last 7 days activity
  const last7Days = (() => {
    const days: { date: string; label: string; completed: boolean; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const record = state.dayRecords.find((r) => r.date === dateStr);
      days.push({
        date: dateStr,
        label: dayNames[d.getDay()],
        completed: record?.completed ?? false,
        minutes: record?.studiedMinutes ?? 0,
      });
    }
    return days;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>📊 Your Stats</Text>

        {/* Main Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderColor: COLORS.accentDark }]}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: COLORS.accentDark }]}>
              {state.currentStreak}
            </Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={[styles.statCard, { borderColor: COLORS.success }]}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={[styles.statValue, { color: COLORS.success }]}>
              {totalHours}h
            </Text>
            <Text style={styles.statLabel}>Total Study</Text>
          </View>

          <View style={[styles.statCard, { borderColor: COLORS.coinGold }]}>
            <Text style={styles.statEmoji}>🪙</Text>
            <Text style={[styles.statValue, { color: COLORS.coinGold }]}>
              {state.totalCoinsEarned}
            </Text>
            <Text style={styles.statLabel}>Coins Earned</Text>
          </View>

          <View style={[styles.statCard, { borderColor: theme.palette[0] }]}>
            <Text style={styles.statEmoji}>🏗️</Text>
            <Text style={[styles.statValue, { color: theme.palette[0] }]}>
              {buildingsPlaced}
            </Text>
            <Text style={styles.statLabel}>Buildings</Text>
          </View>
        </View>

        {/* Weekly Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weekRow}>
            {last7Days.map((day) => (
              <View key={day.date} style={styles.dayCol}>
                <View
                  style={[
                    styles.dayDot,
                    day.completed
                      ? { backgroundColor: COLORS.success }
                      : { backgroundColor: COLORS.surface },
                  ]}
                >
                  {day.completed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {day.minutes > 0 && (
                  <Text style={styles.dayMinutes}>{Math.round(day.minutes)}m</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Achievements / Milestones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          {[
            { label: 'First Study Session', target: 1, current: daysStudied, emoji: '📖' },
            { label: '7-Day Streak', target: 7, current: state.currentStreak, emoji: '🔥' },
            { label: '10 Hours Studied', target: 10, current: parseFloat(totalHours), emoji: '⏱️' },
            { label: '10 Buildings Placed', target: 10, current: buildingsPlaced, emoji: '🏙️' },
            { label: '1000 Coins Earned', target: 1000, current: state.totalCoinsEarned, emoji: '💰' },
          ].map((milestone) => {
            const progress = Math.min(milestone.current / milestone.target, 1);
            const achieved = progress >= 1;
            return (
              <View key={milestone.label} style={styles.milestoneRow}>
                <Text style={styles.milestoneEmoji}>{milestone.emoji}</Text>
                <View style={styles.milestoneInfo}>
                  <Text style={[styles.milestoneName, achieved && { color: COLORS.success }]}>
                    {milestone.label}
                    {achieved ? ' ✓' : ''}
                  </Text>
                  <View style={styles.milestoneBarBg}>
                    <View
                      style={[
                        styles.milestoneBarFill,
                        {
                          width: `${progress * 100}%`,
                          backgroundColor: achieved ? COLORS.success : theme.palette[0],
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.milestoneProgress}>
                  {Math.min(Math.round(milestone.current), milestone.target)}/{milestone.target}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  dayLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  dayMinutes: {
    fontSize: 10,
    color: COLORS.textDark,
    fontWeight: '600',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  milestoneEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  milestoneBarBg: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  milestoneBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  milestoneProgress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginLeft: 12,
  },
});
