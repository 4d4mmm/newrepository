export type WorldType = 'hospital' | 'city' | 'park';

export interface Building {
  id: string;
  name: string;
  cost: number;
  color: string;
  width: number;
  height: number;
}

export interface PlacedBuilding {
  buildingId: string;
  row: number;
  col: number;
  placedAt: number;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  studiedMinutes: number;
  goalMinutes: number;
  completed: boolean;
  coinsEarned: number;
}

export interface GameState {
  // Onboarding
  onboardingComplete: boolean;
  world: WorldType;
  dailyGoalMinutes: number;

  // Currency
  coins: number;

  // Timer
  isTimerRunning: boolean;
  timerStartedAt: number | null;
  todayStudiedSeconds: number;

  // Town
  placedBuildings: PlacedBuilding[];

  // Stats
  currentStreak: number;
  totalStudiedMinutes: number;
  totalCoinsEarned: number;
  dayRecords: DayRecord[];

  // Meta
  lastActiveDate: string; // YYYY-MM-DD
}
