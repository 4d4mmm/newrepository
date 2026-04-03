import { Building, WorldType } from '../types/game';

const HOSPITAL_BUILDINGS: Building[] = [
  { id: 'h1', name: 'Clinic', cost: 50, color: '#ff6b6b', width: 1, height: 1 },
  { id: 'h2', name: 'Pharmacy', cost: 100, color: '#ee5a24', width: 1, height: 1 },
  { id: 'h3', name: 'Lab', cost: 150, color: '#ff9ff3', width: 1, height: 1 },
  { id: 'h4', name: 'Ward', cost: 200, color: '#f368e0', width: 2, height: 1 },
  { id: 'h5', name: 'Hospital', cost: 300, color: '#ff4757', width: 2, height: 2 },
];

const CITY_BUILDINGS: Building[] = [
  { id: 'c1', name: 'House', cost: 50, color: '#54a0ff', width: 1, height: 1 },
  { id: 'c2', name: 'Shop', cost: 100, color: '#2e86de', width: 1, height: 1 },
  { id: 'c3', name: 'Office', cost: 150, color: '#48dbfb', width: 1, height: 1 },
  { id: 'c4', name: 'Mall', cost: 200, color: '#0abde3', width: 2, height: 1 },
  { id: 'c5', name: 'Skyscraper', cost: 300, color: '#576574', width: 2, height: 2 },
];

const PARK_BUILDINGS: Building[] = [
  { id: 'p1', name: 'Bench', cost: 50, color: '#6bcb77', width: 1, height: 1 },
  { id: 'p2', name: 'Fountain', cost: 100, color: '#26de81', width: 1, height: 1 },
  { id: 'p3', name: 'Garden', cost: 150, color: '#ffd93d', width: 1, height: 1 },
  { id: 'p4', name: 'Playground', cost: 200, color: '#f7d794', width: 2, height: 1 },
  { id: 'p5', name: 'Pavilion', cost: 300, color: '#78e08f', width: 2, height: 2 },
];

export const BUILDINGS_BY_WORLD: Record<WorldType, Building[]> = {
  hospital: HOSPITAL_BUILDINGS,
  city: CITY_BUILDINGS,
  park: PARK_BUILDINGS,
};

export function getBuildingById(world: WorldType, id: string): Building | undefined {
  return BUILDINGS_BY_WORLD[world].find((b) => b.id === id);
}
