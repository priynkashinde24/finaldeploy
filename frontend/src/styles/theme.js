/**
 * Sir ShopAlot Theme Tokens (JavaScript version for Tailwind)
 */

module.exports = {
  colors: {
    // Backgrounds
    background: '#0B0B0B',
    surface: '#121212',
    surfaceLight: '#1A1A1A',
    border: '#242424',
    
    // Primary Colors (from image palette)
    primaryRed: '#AA0000', // Deep Red - Energy, excitement, and attention
    primaryRedHover: '#C80000',
    mutedGold: '#D4AF37', // Muted Gold - Regal and sophisticated touch
    
    // Secondary Colors (from image palette)
    offWhite: '#F5F5F5', // Neutral Off-White - Softens bold colors for readability
    gray: '#E0E0E0', // Gray - Neutral balance for backgrounds
    softBlue: '#6996D3', // Soft Blue - Trustworthy and subtle accents
    
    // Accent Colors (from image palette)
    turquoise: '#40E0D0', // Turquoise - Fresh and prosperous vibe, ideal for callouts
    
    // Legacy support
    gold: '#D4AF37',
    goldSoft: '#F0D77A',
    
    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#F5F5F5',
    textMuted: '#A1A1A1',
  },
  
  typography: {
    fontFamily: {
      sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      h1: ['48px', { lineHeight: '56px', fontWeight: '700' }],
      h2: ['36px', { lineHeight: '40px', fontWeight: '700' }],
      h3: ['24px', { lineHeight: '28px', fontWeight: '600' }],
      body: ['16px', { lineHeight: '24px', fontWeight: '500' }],
      bodySmall: ['14px', { lineHeight: '20px', fontWeight: '500' }],
      button: ['16px', { lineHeight: '24px', fontWeight: '600', letterSpacing: '0.3px' }],
    },
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },
  
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  },
  
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.2)',
    md: '0 4px 8px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 16px rgba(0, 0, 0, 0.4)',
    glow: '0 0 20px rgba(212, 175, 55, 0.3)',
    glowRed: '0 0 20px rgba(176, 0, 0, 0.4)',
  },
};

