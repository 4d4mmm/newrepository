import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Animated,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { useGame } from '../../src/store/gameStore';
import { COLORS, WORLD_THEMES } from '../../src/constants/theme';
import { WorldType } from '../../src/types/game';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_MARGIN = 16;

const worlds: WorldType[] = ['hospital', 'city', 'park'];

export default function WorldSelect() {
  const { dispatch } = useGame();
  const [activeIndex, setActiveIndex] = useState(1);
  const scaleAnims = useRef(worlds.map(() => new Animated.Value(1))).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleSelect = (world: WorldType) => {
    const idx = worlds.indexOf(world);
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnims[idx], { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      dispatch({ type: 'SET_WORLD', world });
      router.push('/onboarding/daily-goal');
    });
  };

  const renderWorld = ({ item, index }: { item: WorldType; index: number }) => {
    const theme = WORLD_THEMES[item];
    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnims[index] }] }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handleSelect(item)}
          style={[
            styles.card,
            { backgroundColor: theme.bgAccent, borderColor: theme.palette[0] },
          ]}
        >
          <Text style={styles.worldEmoji}>{theme.emoji}</Text>
          <Text style={styles.worldName}>{theme.name}</Text>
          <Text style={styles.worldDesc}>{theme.description}</Text>

          <View style={styles.previewGrid}>
            {theme.palette.map((color, i) => (
              <View key={i} style={[styles.previewBlock, { backgroundColor: color }]} />
            ))}
          </View>

          <View style={[styles.selectBtn, { backgroundColor: theme.palette[0] }]}>
            <Text style={styles.selectBtnText}>Choose {theme.name}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your World</Text>
      <Text style={styles.subtitle}>Swipe to explore, tap to select</Text>

      <FlatList
        data={worlds}
        renderItem={renderWorld}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        initialScrollIndex={1}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + CARD_MARGIN * 2,
          offset: (CARD_WIDTH + CARD_MARGIN * 2) * index,
          index,
        })}
      />

      <View style={styles.dots}>
        {worlds.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
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
  listContent: {
    paddingHorizontal: (width - CARD_WIDTH) / 2 - CARD_MARGIN,
  },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    borderRadius: 24,
    borderWidth: 3,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 380,
  },
  worldEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  worldName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  worldDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  previewGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  previewBlock: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  selectBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  selectBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 60,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.textDark,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 24,
  },
});
