import { createContext, useContext } from 'react';
import { GameState, WorldType, PlacedBuilding, DayRecord } from '../types/game';
import { COINS_PER_GOAL, STREAK_BONUS } from '../constants/theme';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function createInitialState(): GameState {
  return {
    onboardingComplete: false,
    world: 'city',
    dailyGoalMinutes: 30,
    coins: 0,
    isTimerRunning: false,
    timerStartedAt: null,
    todayStudiedSeconds: 0,
    placedBuildings: [],
    currentStreak: 0,
    totalStudiedMinutes: 0,
    totalCoinsEarned: 0,
    dayRecords: [],
    lastActiveDate: getTodayString(),
  };
}

export type GameAction =
  | { type: 'SET_WORLD'; world: WorldType }
  | { type: 'SET_DAILY_GOAL'; minutes: number }
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'START_TIMER' }
  | { type: 'STOP_TIMER'; elapsedSeconds: number }
  | { type: 'TICK_TIMER'; elapsedSeconds: number }
  | { type: 'COMPLETE_DAILY_GOAL' }
  | { type: 'PLACE_BUILDING'; building: PlacedBuilding }
  | { type: 'SPEND_COINS'; amount: number }
  | { type: 'CHECK_NEW_DAY' }
  | { type: 'LOAD_STATE'; state: GameState };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_WORLD':
      return { ...state, world: action.world };

    case 'SET_DAILY_GOAL':
      return { ...state, dailyGoalMinutes: action.minutes };

    case 'COMPLETE_ONBOARDING':
      return { ...state, onboardingComplete: true, lastActiveDate: getTodayString() };

    case 'START_TIMER':
      return { ...state, isTimerRunning: true, timerStartedAt: Date.now() };

    case 'STOP_TIMER': {
      const newStudied = state.todayStudiedSeconds + action.elapsedSeconds;
      const newTotalMinutes = state.totalStudiedMinutes + action.elapsedSeconds / 60;
      return {
        ...state,
        isTimerRunning: false,
        timerStartedAt: null,
        todayStudiedSeconds: newStudied,
        totalStudiedMinutes: newTotalMinutes,
      };
    }

    case 'TICK_TIMER':
      return { ...state, todayStudiedSeconds: state.todayStudiedSeconds + action.elapsedSeconds };

    case 'COMPLETE_DAILY_GOAL': {
      const today = getTodayString();
      const alreadyCompleted = state.dayRecords.some((r) => r.date === today && r.completed);
      if (alreadyCompleted) return state;

      const streakBonus = state.currentStreak * STREAK_BONUS;
      const coinsEarned = COINS_PER_GOAL + streakBonus;
      const newStreak = state.currentStreak + 1;

      const record: DayRecord = {
        date: today,
        studiedMinutes: state.todayStudiedSeconds / 60,
        goalMinutes: state.dailyGoalMinutes,
        completed: true,
        coinsEarned,
      };

      return {
        ...state,
        coins: state.coins + coinsEarned,
        currentStreak: newStreak,
        totalCoinsEarned: state.totalCoinsEarned + coinsEarned,
        dayRecords: [...state.dayRecords.filter((r) => r.date !== today), record],
      };
    }

    case 'PLACE_BUILDING':
      return {
        ...state,
        placedBuildings: [...state.placedBuildings, action.building],
      };

    case 'SPEND_COINS':
      return { ...state, coins: state.coins - action.amount };

    case 'CHECK_NEW_DAY': {
      const today = getTodayString();
      if (state.lastActiveDate === today) return state;

      // Check if yesterday's goal was completed
      const yesterday = state.lastActiveDate;
      const yesterdayRecord = state.dayRecords.find((r) => r.date === yesterday);
      const yesterdayCompleted = yesterdayRecord?.completed ?? false;

      return {
        ...state,
        lastActiveDate: today,
        todayStudiedSeconds: 0,
        isTimerRunning: false,
        timerStartedAt: null,
        currentStreak: yesterdayCompleted ? state.currentStreak : 0,
      };
    }

    case 'LOAD_STATE':
      return action.state;

    default:
      return state;
  }
}

export interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export const GameContext = createContext<GameContextType>({
  state: createInitialState(),
  dispatch: () => {},
});

export function useGame(): GameContextType {
  return useContext(GameContext);
}
