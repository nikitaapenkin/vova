import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from '../src/systems/settings';

const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
};

describe('settings storage', () => {
  it('uses safe defaults for missing or damaged values', () => {
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const storage = memoryStorage();
    storage.setItem(SETTINGS_KEY, '{bad json');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('persists language, sound and best score', () => {
    const storage = memoryStorage();
    saveSettings(storage, { language: 'en', soundEnabled: false, bestScore: 12345 });
    expect(loadSettings(storage)).toEqual({ language: 'en', soundEnabled: false, bestScore: 12345 });
  });
});
