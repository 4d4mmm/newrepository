import { WorldType } from '../types/game';

export const COLORS = {
  background: '#1a1a2e',
  surface: '#16213e',
  surfaceLight: '#0f3460',
  primary: '#e94560',
  primaryLight: '#ff6b6b',
  accent: '#ffd93d',
  accentDark: '#f4a261',
  success: '#6bcb77',
  text: '#ffffff',
  textSecondary: '#a0a0b0',
  textDark: '#666680',
  coinGold: '#ffd700',
  gridLine: '#2a2a4e',
  gridEmpty: '#12122a',
};

export const WORLD_THEMES: Record<WorldType, { name: string; palette: string[]; bgAccent: string; emoji: string; description: string }> = {
  hospital: {
    name: 'Hospital',
    palette: ['#ff6b6b', '#ee5a24', '#ff9ff3', '#f368e0', '#ff4757'],
    bgAccent: '#2d1f3d',
    emoji: '🏥',
    description: 'Build a world-class medical campus',
  },
  city: {
    name: 'City',
    palette: ['#54a0ff', '#2e86de', '#48dbfb', '#0abde3', '#576574'],
    bgAccent: '#1a2a4a',
    emoji: '🏙️',
    description: 'Create a bustling metropolis',
  },
  park: {
    name: 'Park',
    palette: ['#6bcb77', '#26de81', '#ffd93d', '#f7d794', '#78e08f'],
    bgAccent: '#1a3a2a',
    emoji: '🌳',
    description: 'Design a beautiful nature reserve',
  },
};

export const GRID_SIZE = 8;
export const COINS_PER_GOAL = 100;
export const STREAK_BONUS = 10;
