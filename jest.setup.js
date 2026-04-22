/* global jest */
// Jest setup file

// Mock Expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
}), { virtual: true });

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}), { virtual: true });

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: {
    All: 'All',
    Images: 'Images',
    Videos: 'Videos',
  },
}), { virtual: true });

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}), { virtual: true });

// Mock Supabase client
jest.mock('./src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      range: jest.fn().mockReturnThis(),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test.com/file.pdf' } })),
        createSignedUrl: jest.fn(),
      })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  },
}));

// Silence console warnings during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Animated: `useNativeDriver`') ||
     args[0].includes('componentWillReceiveProps') ||
     args[0].includes('componentWillMount'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Global test timeout
jest.setTimeout(10000);
