# Revocart Design System

A production-ready design system built with React, TypeScript, Next.js, and Tailwind CSS, featuring a comprehensive brand color palette and reusable UI components.

## 🎨 Brand Color Palette

### Primary Colors
- **Deep Red**: `#AA0000`
- **Muted Gold**: `#D4AF37`

### Secondary Colors
- **Off-White**: `#F5F5F5`
- **Gray**: `#E0E0E0`
- **Soft Blue**: `#6996D3`

### Accent Colors
- **Turquoise**: `#40E0D0`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── components/          # Components preview page
│   │   ├── styles/
│   │   │   └── tokens/          # Design tokens showcase
│   │   ├── globals.css          # Global styles with dark mode
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home page
│   ├── components/
│   │   └── ui/                  # Shared UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── SectionTitle.tsx
│   │       └── index.ts
│   ├── lib/
│   │   └── utils.ts             # Utility functions
│   └── styles/
│       ├── tokens.ts             # TypeScript design tokens
│       └── tokens.js             # JavaScript tokens (for Tailwind)
├── tailwind.config.js           # Tailwind configuration
├── postcss.config.js            # PostCSS configuration
└── package.json
```

## 🚀 Getting Started

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## 🎯 Design Tokens

All design tokens are defined in `/src/styles/tokens.ts` and include:

- **Colors**: Primary, secondary, accent, semantic, and neutral color palettes
- **Spacing**: Consistent spacing scale from 0 to 64 (0px to 256px)
- **Typography**: Font families, sizes, weights, and letter spacing
- **Shadows**: Box shadow tokens including brand-specific shadows
- **Radius**: Border radius scale for consistent rounded corners

### Using Tokens in Tailwind

Tokens are integrated into Tailwind CSS, so you can use them directly:

```tsx
// Colors
<div className="bg-primary-deep-red text-white">
<div className="bg-accent-turquoise">
<div className="text-primary-muted-gold">

// Spacing
<div className="p-4 m-6">  // Uses spacing tokens

// Typography
<h1 className="text-3xl font-bold">  // Uses typography tokens

// Shadows
<div className="shadow-lg">  // Uses shadow tokens

// Radius
<button className="rounded-xl">  // Uses radius tokens
```

## 🧩 UI Components

### Button

A versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md">Click Me</Button>
```

**Variants**: `primary`, `secondary`, `accent`, `outline`, `ghost`  
**Sizes**: `sm`, `md`, `lg`

### Card

A flexible card component for content containers.

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

<Card variant="elevated">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
</Card>
```

**Variants**: `default`, `elevated`, `outlined`

### SectionTitle

A styled heading component for section titles.

```tsx
import { SectionTitle } from '@/components/ui';

<SectionTitle variant="default" size="lg">Section Title</SectionTitle>
```

**Variants**: `default`, `accent`, `gold`  
**Sizes**: `sm`, `md`, `lg`, `xl`

## 🌙 Dark Mode

Dark mode is supported via `prefers-color-scheme` media query. The system automatically switches based on the user's OS preference.

Dark mode tokens are prepared in the design tokens and can be extended in the future for manual theme switching.

## 📄 Pages

- **Home** (`/`): Overview of the design system
- **Design Tokens** (`/styles/tokens`): Complete showcase of all design tokens
- **Components** (`/components`): Interactive preview of UI components

## 🛠️ Technology Stack

- **Next.js 14**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first CSS framework
- **Design Tokens**: Centralized design system values

## 📝 Notes

- All components use design tokens for consistent styling
- Components are fully typed with TypeScript
- Dark mode support is foundation-ready for future enhancements
- All color usage references brand tokens

## 🔗 Links

- View Design Tokens: `/styles/tokens`
- View Components: `/components`

