import { Theme } from '@/types/theme';

// Import themes statically for Next.js
import defaultTheme from '../../themes/default.json';
import modernDarkTheme from '../../themes/modern-dark.json';
import elegantGoldTheme from '../../themes/elegant-gold.json';
import minimalWhiteTheme from '../../themes/minimal-white.json';
import softBlueTheme from '../../themes/soft-blue.json';
import vibrantRedTheme from '../../themes/vibrant-red.json';
import turquoiseAccentTheme from '../../themes/turquoise-accent.json';

const themesMap: Record<string, Theme> = {
  default: defaultTheme as Theme,
  'modern-dark': modernDarkTheme as Theme,
  'elegant-gold': elegantGoldTheme as Theme,
  'minimal-white': minimalWhiteTheme as Theme,
  'soft-blue': softBlueTheme as Theme,
  'vibrant-red': vibrantRedTheme as Theme,
  'turquoise-accent': turquoiseAccentTheme as Theme,
};

export const loadTheme = async (themeId: string): Promise<Theme | null> => {
  try {
    const theme = themesMap[themeId] || themesMap.default;
    return theme;
  } catch (error) {
    console.error(`Failed to load theme: ${themeId}`, error);
    return themesMap.default || null;
  }
};

export const getAllThemes = async (): Promise<Theme[]> => {
  return Object.values(themesMap);
};

