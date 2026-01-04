// Mock native dependencies so we can import LayoutService without native runtime
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => null,
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: async () => {}, localUri: '/tmp/fake', uri: '/tmp/fake' })
  }
}));

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: async () => ({ exists: true, size: 100 }),
  makeDirectoryAsync: async () => {},
  copyAsync: async () => {},
  deleteAsync: async () => {},
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async (name: string) => ({
    getAllAsync: async () => [],
    getFirstAsync: async () => null,
    runAsync: async () => {},
    closeAsync: async () => {},
  })
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: any) => obj?.ios ?? obj?.default },
}));

import LayoutService from '../app/mushaf/services/layoutService';

describe('LayoutService DB change notifications', () => {
  test('onDatabaseChange registers and unregisters listeners properly', () => {
    const calls: number[] = [];

    const cb1 = () => { calls.push(1); };
    const cb2 = () => { calls.push(2); };

    // Register two listeners
    const unsub1 = LayoutService.onDatabaseChange(cb1);
    const unsub2 = LayoutService.onDatabaseChange(cb2);

    // Trigger notification via private API (allowed for tests)
    (LayoutService as any).notifyDatabaseChange();
    expect(calls).toEqual([1,2]);

    // Unsubscribe first and notify again
    unsub1();
    (LayoutService as any).notifyDatabaseChange();
    expect(calls).toEqual([1,2,2]);

    // Unsubscribe second
    unsub2();
    (LayoutService as any).notifyDatabaseChange();
    expect(calls).toEqual([1,2,2]);
  });
});
