import { useThemeVariant } from '@/context/ThemeContext';

export const getButtonClasses = (buttonStyle?: 'rounded' | 'square' | 'pill') => {
  switch (buttonStyle) {
    case 'pill':
      return 'rounded-full px-6';
    case 'square':
      return 'rounded-none';
    default:
      return 'rounded-md';
  }
};

export const getCardClasses = (cardStyle?: 'flat' | 'elevated') => {
  switch (cardStyle) {
    case 'elevated':
      return 'shadow-md';
    default:
      return 'shadow-none';
  }
};

export const getInputClasses = (inputStyle?: 'outline' | 'filled') => {
  switch (inputStyle) {
    case 'filled':
      return 'bg-neutral-900 border border-transparent';
    default:
      return 'border border-neutral-800';
  }
};

export const useThemeAdapters = () => {
  const theme = useThemeVariant();
  return {
    button: getButtonClasses(theme.components?.buttonStyle),
    card: getCardClasses(theme.components?.cardStyle),
    input: getInputClasses(theme.components?.inputStyle),
    layout: theme.layout,
  };
};


