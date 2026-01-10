/**
 * Block Type Definitions
 * 
 * Defines the structure and validation for each block type
 */

export type BlockType = 'hero' | 'collection' | 'cta' | 'faq';
export type BlockVisibility = 'always' | 'loggedIn' | 'loggedOut';

// ==================== HERO BLOCK ====================
export interface HeroBlockSettings {
  headline: string;
  subheadline?: string;
  backgroundImage?: string;
  alignment: 'left' | 'center';
  primaryButton?: {
    text: string;
    link: string;
  };
  secondaryButton?: {
    text: string;
    link: string;
  };
}

export const defaultHeroBlockSettings: HeroBlockSettings = {
  headline: 'Welcome to Our Store',
  subheadline: 'Discover amazing products',
  alignment: 'center',
  primaryButton: {
    text: 'Shop Now',
    link: '/products',
  },
};

// ==================== COLLECTION BLOCK ====================
export interface CollectionBlockSettings {
  title: string;
  collectionType: 'category' | 'manual';
  categoryId?: string;
  productIds?: string[];
  layout: 'grid' | 'carousel';
  itemsLimit: number;
}

export const defaultCollectionBlockSettings: CollectionBlockSettings = {
  title: 'Featured Products',
  collectionType: 'category',
  layout: 'grid',
  itemsLimit: 12,
};

// ==================== CTA BLOCK ====================
export interface CTABlockSettings {
  text: string;
  buttonText: string;
  buttonLink: string;
  backgroundStyle: 'primary' | 'secondary' | 'gradient';
}

export const defaultCTABlockSettings: CTABlockSettings = {
  text: 'Ready to get started?',
  buttonText: 'Get Started',
  buttonLink: '/signup',
  backgroundStyle: 'primary',
};

// ==================== FAQ BLOCK ====================
export interface FAQBlockSettings {
  title: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
  layout: 'accordion' | 'list';
}

export const defaultFAQBlockSettings: FAQBlockSettings = {
  title: 'Frequently Asked Questions',
  items: [
    {
      question: 'How do I place an order?',
      answer: 'You can place an order by adding items to your cart and proceeding to checkout.',
    },
  ],
  layout: 'accordion',
};

// ==================== UNION TYPE ====================
export type BlockSettings = HeroBlockSettings | CollectionBlockSettings | CTABlockSettings | FAQBlockSettings;

// ==================== BLOCK METADATA ====================
export interface BlockMetadata {
  type: BlockType;
  name: string;
  description: string;
  icon: string;
  defaultSettings: BlockSettings;
}

export const blockMetadata: Record<BlockType, BlockMetadata> = {
  hero: {
    type: 'hero',
    name: 'Hero Section',
    description: 'Large banner with headline, image, and call-to-action buttons',
    icon: '🎯',
    defaultSettings: defaultHeroBlockSettings,
  },
  collection: {
    type: 'collection',
    name: 'Product Collection',
    description: 'Display products from a category or manual selection',
    icon: '📦',
    defaultSettings: defaultCollectionBlockSettings,
  },
  cta: {
    type: 'cta',
    name: 'Call to Action',
    description: 'Simple call-to-action section with text and button',
    icon: '📢',
    defaultSettings: defaultCTABlockSettings,
  },
  faq: {
    type: 'faq',
    name: 'FAQ Section',
    description: 'Frequently asked questions in accordion or list format',
    icon: '❓',
    defaultSettings: defaultFAQBlockSettings,
  },
};

