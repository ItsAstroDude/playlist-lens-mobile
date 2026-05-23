/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  // Allow Jest to transform these packages that ship as ESM
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|expo(nent)?' +
      '|@expo(nent)?/.*' +
      '|@expo-google-fonts/.*' +
      '|react-navigation' +
      '|@react-navigation/.*' +
      '|react-native-svg' +
      '|@shopify/flash-list' +
      '|react-native-reanimated' +
      '|react-native-gesture-handler' +
      '|react-native-safe-area-context' +
    '))',
  ],

  // Resolve path aliases (@/ → project root)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Global setup — mock all native modules before any test file runs
  setupFiles: ['<rootDir>/jest-setup.ts'],

  // Test file locations
  testMatch: ['**/__tests__/**/*.test.ts'],

  // Show individual test names
  verbose: true,
}
