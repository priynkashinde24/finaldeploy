export interface ThemeConfig {
  themeId: string;
  name: string;
  previewImage?: string;
  defaultColors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
  defaultFonts: {
    heading: string;
    body: string;
  };
}

export const THEMES: ThemeConfig[] = [
  {
    themeId: 'default',
    name: 'Default',
    previewImage: '/themes/default-preview.png',
    defaultColors: {
      primary: '#AA0000',
      secondary: '#6996D3',
      accent: '#40E0D0',
      background: '#FFFFFF',
      surface: '#F5F5F5',
    },
    defaultFonts: {
      heading: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
    },
  },
  {
    themeId: 'modern-dark',
    name: 'Modern Dark',
    previewImage: '/themes/modern-dark-preview.png',
    defaultColors: {
      primary: '#AA0000',
      secondary: '#6996D3',
      accent: '#40E0D0',
      background: '#0F172A',
      surface: '#1E293B',
    },
    defaultFonts: {
      heading: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
    },
  },
  {
    themeId: 'elegant-gold',
    name: 'Elegant Gold',
    previewImage: '/themes/elegant-gold-preview.png',
    defaultColors: {
      primary: '#D4AF37',
      secondary: '#AA0000',
      accent: '#F5E6D3',
      background: '#FFFFFF',
      surface: '#FFFBF0',
    },
    defaultFonts: {
      heading: 'Georgia, serif',
      body: 'Georgia, serif',
    },
  },
  {
    themeId: 'vibrant-red',
    name: 'Vibrant Red',
    previewImage: '/themes/vibrant-red-preview.png',
    defaultColors: {
      primary: '#AA0000',
      secondary: '#D4AF37',
      accent: '#FF4444',
      background: '#FFFFFF',
      surface: '#FFF5F5',
    },
    defaultFonts: {
      heading: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
    },
  },
  {
    themeId: 'minimal-white',
    name: 'Minimal White',
    previewImage: '/themes/minimal-white-preview.png',
    defaultColors: {
      primary: '#000000',
      secondary: '#6B7280',
      accent: '#F5F5F5',
      background: '#FFFFFF',
      surface: '#FAFAFA',
    },
    defaultFonts: {
      heading: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
    },
  },
  {
    themeId: 'soft-blue',
    name: 'Soft Blue',
    previewImage: '/themes/soft-blue-preview.png',
    defaultColors: {
      primary: '#6996D3',
      secondary: '#40E0D0',
      accent: '#AA0000',
      background: '#F0F7FF',
      surface: '#E6F2FF',
    },
    defaultFonts: {
      heading: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
    },
  },
  {
    themeId: 'turquoise-accent',
    name: 'Turquoise Accent',
    previewImage: '/themes/turquoise-accent-preview.png',
    defaultColors: {
      primary: '#40E0D0',
      secondary: '#6996D3',
      accent: '#AA0000',
      background: '#FFFFFF',
      surface: '#F0FDFC',
    },
    defaultFonts: {
      heading: 'system-ui, -apple-system, sans-serif',
      body: 'system-ui, -apple-system, sans-serif',
    },
  },
];

/**
 * Get theme by ID
 */
export const getThemeById = (themeId: string): ThemeConfig | undefined => {
  return THEMES.find((theme) => theme.themeId === themeId);
};

/**
 * Get all available themes
 */
export const getAllThemes = (): ThemeConfig[] => {
  return THEMES;
};

/**
 * Validate theme ID
 */
export const isValidThemeId = (themeId: string): boolean => {
  return THEMES.some((theme) => theme.themeId === themeId);
};

