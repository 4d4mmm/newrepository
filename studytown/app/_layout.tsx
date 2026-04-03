import { useEffect, useReducer } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GameContext, gameReducer, createInitialState } from '../src/store/gameStore';
import { loadGameState, saveGameState } from '../src/lib/storage';
import { COLORS } from '../src/constants/theme';

export default function RootLayout() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());

  useEffect(() => {
    loadGameState().then((saved) => {
      if (saved) {
        dispatch({ type: 'LOAD_STATE', state: saved });
      }
    });
  }, []);

  useEffect(() => {
    if (state.onboardingComplete) {
      saveGameState(state);
    }
  }, [state]);

  useEffect(() => {
    dispatch({ type: 'CHECK_NEW_DAY' });
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      />
    </GameContext.Provider>
  );
}
