import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useGame } from '../../src/store/gameStore';
import { COLORS, WORLD_THEMES } from '../../src/constants/theme';

const PRESETS = [15, 30, 45, 60, 90, 120];

export default function DailyGoal() {
  const { state, dispatch } = useGame();
  const [selected, setSelected] = useState(30);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const theme = WORLD_THEMES[state.world];

  const handleSelect = (mins: number) => {
    setSelected(mins);
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleContinue = () => {
    dispatch({ type: 'SET_DAILY_GOAL', minutes: selected });
    dispatch({ type: 'COMPLETE_ONBOARDING' });
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{theme.emoji}</Text>
      <Text style={styles.title}>Set Your Daily Goal</Text>
      <Text style={styles.subtitle}>
        How many minutes will you study each day?
      </Text>

      <Animated.View style={[styles.displayContainer, { transform: [{ scale: bounceAnim }] }]}>
        <Text style={[styles.displayNumber, { color: theme.palette[0] }]}>{selected}</Text>
        <Text style={styles.displayLabel}>minutes / day</Text>
      </Animated.View>

      <View style={styles.presetsGrid}>
        {PRESETS.map((mins) => (
          <TouchableOpacity
            key={mins}
            onPress={() => handleSelect(mins)}
            style={[
              styles.presetBtn,
              selected === mins && { backgroundColor: theme.palette[0], borderColor: theme.palette[0] },
            ]}
          >
            <Text
              style={[
                styles.presetText,
                selected === mins && styles.presetTextActive,
              ]}
            >
              {mins}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleContinue}
        style={[styles.continueBtn, { backgroundColor: theme.palette[0] }]}
        activeOpacity={0.8}
      >
        <Text style={styles.continueBtnText}>Start Building! 🏗️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  displayContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  displayNumber: {
    fontSize: 80,
    fontWeight: '900',
  },
  displayLabel: {
    fontSize: 18,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 48,
  },
  presetBtn: {
    width: 80,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.surfaceLight,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  presetTextActive: {
    color: COLORS.text,
  },
  continueBtn: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 20,
  },
  continueBtnText: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
});
