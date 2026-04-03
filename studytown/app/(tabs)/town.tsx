import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGame } from '../../src/store/gameStore';
import { COLORS, GRID_SIZE, WORLD_THEMES } from '../../src/constants/theme';
import { BUILDINGS_BY_WORLD, getBuildingById } from '../../src/constants/buildings';
import { Building, PlacedBuilding } from '../../src/types/game';

const { width } = Dimensions.get('window');
const GRID_PADDING = 16;
const TILE_SIZE = (width - GRID_PADDING * 2 - (GRID_SIZE - 1) * 2) / GRID_SIZE;

export default function TownScreen() {
  const { state, dispatch } = useGame();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [showShop, setShowShop] = useState(false);
  const placeAnims = useRef<Record<string, Animated.Value>>({}).current;

  const theme = WORLD_THEMES[state.world];
  const buildings = BUILDINGS_BY_WORLD[state.world];

  const getOccupiedTiles = (): Set<string> => {
    const occupied = new Set<string>();
    for (const pb of state.placedBuildings) {
      const building = getBuildingById(state.world, pb.buildingId);
      if (!building) continue;
      for (let r = pb.row; r < pb.row + building.height; r++) {
        for (let c = pb.col; c < pb.col + building.width; c++) {
          occupied.add(`${r}-${c}`);
        }
      }
    }
    return occupied;
  };

  const canPlace = (row: number, col: number, building: Building): boolean => {
    if (row + building.height > GRID_SIZE || col + building.width > GRID_SIZE) return false;
    const occupied = getOccupiedTiles();
    for (let r = row; r < row + building.height; r++) {
      for (let c = col; c < col + building.width; c++) {
        if (occupied.has(`${r}-${c}`)) return false;
      }
    }
    return true;
  };

  const handleTilePress = (row: number, col: number) => {
    if (!selectedBuilding) return;
    if (!canPlace(row, col, selectedBuilding)) return;
    if (state.coins < selectedBuilding.cost) return;

    const key = `${row}-${col}-${Date.now()}`;
    placeAnims[key] = new Animated.Value(0);

    dispatch({ type: 'SPEND_COINS', amount: selectedBuilding.cost });
    dispatch({
      type: 'PLACE_BUILDING',
      building: {
        buildingId: selectedBuilding.id,
        row,
        col,
        placedAt: Date.now(),
      },
    });

    // Placement animation
    Animated.spring(placeAnims[key], {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start();

    setSelectedBuilding(null);
  };

  const getBuildingAt = (row: number, col: number): { pb: PlacedBuilding; building: Building } | null => {
    for (const pb of state.placedBuildings) {
      if (pb.row === row && pb.col === col) {
        const building = getBuildingById(state.world, pb.buildingId);
        if (building) return { pb, building };
      }
    }
    return null;
  };

  const occupied = getOccupiedTiles();

  const renderGrid = () => {
    const rows = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const cells = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const buildingHere = getBuildingAt(r, c);
        const isOccupied = occupied.has(`${r}-${c}`) && !buildingHere;
        const canPlaceHere = selectedBuilding && canPlace(r, c, selectedBuilding) && state.coins >= selectedBuilding.cost;

        cells.push(
          <TouchableOpacity
            key={`${r}-${c}`}
            onPress={() => handleTilePress(r, c)}
            disabled={!selectedBuilding || !canPlaceHere}
            style={[
              styles.tile,
              {
                width: TILE_SIZE,
                height: TILE_SIZE,
                backgroundColor: canPlaceHere
                  ? theme.palette[0] + '40'
                  : isOccupied
                  ? 'transparent'
                  : COLORS.gridEmpty,
                borderColor: canPlaceHere ? theme.palette[0] : COLORS.gridLine,
              },
            ]}
          >
            {buildingHere && (
              <Animated.View
                style={[
                  styles.buildingBlock,
                  {
                    backgroundColor: buildingHere.building.color,
                    width: buildingHere.building.width * TILE_SIZE - 4,
                    height: buildingHere.building.height * TILE_SIZE - 4,
                  },
                ]}
              >
                <Text style={styles.buildingLabel} numberOfLines={1}>
                  {buildingHere.building.name}
                </Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        );
      }
      rows.push(
        <View key={r} style={styles.gridRow}>
          {cells}
        </View>
      );
    }
    return rows;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{theme.emoji} My {WORLD_THEMES[state.world].name}</Text>
        <View style={styles.coinBadge}>
          <Text style={styles.coinText}>🪙 {state.coins}</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridContainer}>
        {renderGrid()}
      </View>

      {/* Selected building indicator */}
      {selectedBuilding && (
        <View style={[styles.selectedBanner, { backgroundColor: theme.palette[0] + '30' }]}>
          <Text style={styles.selectedText}>
            Placing: {selectedBuilding.name} — Tap an empty tile
          </Text>
          <TouchableOpacity onPress={() => setSelectedBuilding(null)}>
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Build Button */}
      <TouchableOpacity
        onPress={() => setShowShop(true)}
        style={[styles.buildBtn, { backgroundColor: theme.palette[0] }]}
        activeOpacity={0.8}
      >
        <Text style={styles.buildBtnText}>🏗️ Build</Text>
      </TouchableOpacity>

      {/* Shop Modal */}
      <Modal visible={showShop} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Building Shop</Text>
              <TouchableOpacity onPress={() => setShowShop(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {buildings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => {
                    if (state.coins >= b.cost) {
                      setSelectedBuilding(b);
                      setShowShop(false);
                    }
                  }}
                  style={[
                    styles.shopItem,
                    state.coins < b.cost && styles.shopItemDisabled,
                  ]}
                >
                  <View style={[styles.shopPreview, { backgroundColor: b.color }]}>
                    <Text style={styles.shopPreviewSize}>
                      {b.width}x{b.height}
                    </Text>
                  </View>
                  <View style={styles.shopInfo}>
                    <Text style={styles.shopName}>{b.name}</Text>
                    <Text style={styles.shopSize}>{b.width}x{b.height} tiles</Text>
                  </View>
                  <Text
                    style={[
                      styles.shopCost,
                      state.coins < b.cost && styles.shopCostDisabled,
                    ]}
                  >
                    🪙 {b.cost}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
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
  gridContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 2,
    borderColor: COLORS.surfaceLight,
  },
  gridRow: {
    flexDirection: 'row',
  },
  tile: {
    margin: 1,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  buildingBlock: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  buildingLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: '#00000080',
    textShadowRadius: 2,
  },
  selectedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  selectedText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  cancelText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  buildBtn: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  buildBtnText: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  closeBtn: {
    fontSize: 24,
    color: COLORS.textSecondary,
    fontWeight: '800',
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  shopItemDisabled: {
    opacity: 0.4,
  },
  shopPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopPreviewSize: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  shopInfo: {
    flex: 1,
    marginLeft: 16,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  shopSize: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  shopCost: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.coinGold,
  },
  shopCostDisabled: {
    color: COLORS.textDark,
  },
});
