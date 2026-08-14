import { en } from './en';
import { ru } from './ru';
import type { Language, Messages } from './types';

export const messages: Record<Language, Messages> = { ru, en };
export type { Language, Messages } from './types';
