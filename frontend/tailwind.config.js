/** @type {import('tailwindcss').Config} */
const theme = require('./src/styles/theme.js');

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Force dark mode
  theme: {
    extend: {
      colors: {
        // Backgrounds
        background: theme.colors.background,
        surface: theme.colors.surface,
        surfaceLight: theme.colors.surfaceLight,
        border: theme.colors.border,
        
        // Primary Colors (from image palette)
        primary: {
          DEFAULT: theme.colors.primaryRed,
          hover: theme.colors.primaryRedHover,
          deepRed: '#AA0000',
        },
        
        // Secondary Colors (from image palette)
        secondary: {
          offWhite: theme.colors.offWhite,
          gray: theme.colors.gray,
          softBlue: theme.colors.softBlue,
        },
        
        // Accent Colors (from image palette)
        accent: {
          DEFAULT: theme.colors.turquoise,
          turquoise: theme.colors.turquoise,
        },
        
        // Legacy Gold support
        gold: {
          DEFAULT: theme.colors.mutedGold,
          soft: theme.colors.goldSoft,
        },
        
        // Text
        text: {
          primary: theme.colors.textPrimary,
          secondary: theme.colors.textSecondary,
          muted: theme.colors.textMuted,
        },
      },
      
      fontFamily: {
        sans: theme.typography.fontFamily.sans,
      },
      
      fontSize: {
        h1: theme.typography.fontSize.h1,
        h2: theme.typography.fontSize.h2,
        h3: theme.typography.fontSize.h3,
        body: theme.typography.fontSize.body,
        'body-sm': theme.typography.fontSize.bodySmall,
        button: theme.typography.fontSize.button,
      },
      
      spacing: {
        ...theme.spacing,
      },
      
      borderRadius: {
        ...theme.borderRadius,
      },
      
      boxShadow: {
        ...theme.shadows,
      },
      
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
