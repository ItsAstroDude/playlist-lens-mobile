// ─── Native module mocks ──────────────────────────────────────────────────────
// These modules have native code that can't run in Node.js/Jest.
// We replace them with lightweight stubs so pure logic can be tested.

// react-native-mmkv — in-memory Map stands in for the native key-value store
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, any>()
  const mockStorage = {
    set:        jest.fn((k: string, v: any) => store.set(k, v)),
    getString:  jest.fn((k: string) => store.get(k)),
    getBoolean: jest.fn((k: string) => store.get(k)),
    getNumber:  jest.fn((k: string) => store.get(k)),
    delete:     jest.fn((k: string) => store.delete(k)),
    remove:     jest.fn((k: string) => store.delete(k)),
    contains:   jest.fn((k: string) => store.has(k)),
    getAllKeys:  jest.fn(() => Array.from(store.keys())),
    clearAll:   jest.fn(() => store.clear()),
    _store:     store, // exposed so tests can inspect / seed it
  }
  return { createMMKV: jest.fn(() => mockStorage) }
})

// expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(() => Promise.resolve(null)),
  setItemAsync:    jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync:          jest.fn(),
  notificationAsync:    jest.fn(),
  ImpactFeedbackStyle:  { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

// expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: null } },
}))

// react-native-image-colors
jest.mock('react-native-image-colors', () => ({
  __esModule: true,
  default: { getColors: jest.fn(() => Promise.resolve({ platform: 'android', dominant: '#1DB954' })) },
}))

// @shopify/flash-list
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native')
  return { FlashList: FlatList }
})
