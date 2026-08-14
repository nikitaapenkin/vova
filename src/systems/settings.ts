import type { Language } from '../i18n';

export type GameSettings = {
  language: Language;
  soundEnabled: boolean;
  bestScore: number;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export const SETTINGS_KEY = 'cosmic-vova-settings-v1';
export const DEFAULT_SETTINGS: GameSettings = { language: 'ru', soundEnabled: true, bestScore: 0 };

export const loadSettings = (storage: StorageLike | undefined): GameSettings => {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}') as Partial<GameSettings>;
    return {
      language: saved.language === 'en' ? 'en' : 'ru',
      soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : true,
      bestScore: typeof saved.bestScore === 'number' && saved.bestScore >= 0 ? Math.floor(saved.bestScore) : 0,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (storage: StorageLike | undefined, settings: GameSettings): void => {
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage can be unavailable */ }
};
