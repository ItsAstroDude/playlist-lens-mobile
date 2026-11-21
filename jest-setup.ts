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

// expo-sqlite — backed by Node's built-in SQLite (node:sqlite), in memory, so the play
// database runs real SQL in tests. Each openDatabaseSync() is a fresh empty database.
jest.mock('expo-sqlite', () => {
  const emit = process.emitWarning
  process.emitWarning = (() => {}) as typeof process.emitWarning   // hush "SQLite is experimental"
  const { DatabaseSync } = require('node:sqlite')
  process.emitWarning = emit
  const plain = (r: any) => (r ? { ...r } : null)
  let last: any = null
  return {
    // A plain open is a fresh empty database; `useNewConnection` is a second handle on
    // the last one (the same "file"), like the app's stats connection.
    openDatabaseSync: jest.fn((_name: string, opts?: { useNewConnection?: boolean }) => {
      const d = opts?.useNewConnection && last ? last : (last = new DatabaseSync(':memory:'))
      return {
        execSync: (sql: string) => d.exec(sql),
        runSync: (sql: string, params: any[] = []) => {
          const r = d.prepare(sql).run(...params)
          return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }
        },
        getFirstSync: (sql: string, params: any[] = []) => plain(d.prepare(sql).get(...params)),
        getAllSync:   (sql: string, params: any[] = []) => d.prepare(sql).all(...params).map(plain),
        withTransactionSync: (task: () => void) => {
          d.exec('BEGIN')
          try { task(); d.exec('COMMIT') } catch (e) { d.exec('ROLLBACK'); throw e }
        },
        prepareSync: (sql: string) => {
          const s = d.prepare(sql)
          return {
            executeSync: (params: any[] = []) => ({ changes: Number(s.run(...params).changes) }),
            finalizeSync: () => {},
          }
        },
        closeSync: () => d.close(),
        // Async twins (the app runs heavy stats with these, off the UI thread).
        execAsync:     async (sql: string) => { d.exec(sql) },
        getFirstAsync: async (sql: string, params: any[] = []) => plain(d.prepare(sql).get(...params)),
        getAllAsync:   async (sql: string, params: any[] = []) => d.prepare(sql).all(...params).map(plain),
      }
    }),
  }
})
