import { Redirect } from 'expo-router';
import { useGame } from '../src/store/gameStore';

export default function Index() {
  const { state } = useGame();

  if (!state.onboardingComplete) {
    return <Redirect href="/onboarding/world-select" />;
  }

  return <Redirect href="/(tabs)" />;
}
