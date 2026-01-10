/// <reference lib="dom" />

/**
 * Image Lazy Loading Utilities
 * 
 * PURPOSE:
 * - Provide utilities for lazy loading images
 * - Generate lazy loading attributes
 * - Support progressive image loading
 * - Intersection Observer helpers
 */

export interface LazyImageOptions {
  src: string;
  srcset?: string;
  sizes?: string;
  placeholder?: string; // Blur placeholder or low-quality image
  alt?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager' | 'auto';
  decoding?: 'async' | 'auto' | 'sync';
  fetchpriority?: 'high' | 'low' | 'auto';
}

/**
 * Generate lazy loading image attributes
 */
export function generateLazyImageAttributes(options: LazyImageOptions): {
  src: string;
  srcset?: string;
  sizes?: string;
  loading: string;
  decoding: string;
  'data-src'?: string;
  'data-srcset'?: string;
  'data-sizes'?: string;
  style?: string;
} {
  const {
    src,
    srcset,
    sizes,
    placeholder,
    width,
    height,
    loading = 'lazy',
    decoding = 'async',
  } = options;

  const attributes: any = {
    loading,
    decoding,
  };

  // Use placeholder as initial src, actual src in data attribute
  if (placeholder) {
    attributes.src = placeholder;
    attributes['data-src'] = src;
    if (srcset) {
      attributes['data-srcset'] = srcset;
    }
    if (sizes) {
      attributes['data-sizes'] = sizes;
    }
  } else {
    attributes.src = src;
    if (srcset) {
      attributes.srcset = srcset;
    }
    if (sizes) {
      attributes.sizes = sizes;
    }
  }

  // Add aspect ratio to prevent layout shift
  if (width && height) {
    const aspectRatio = (height / width) * 100;
    attributes.style = `aspect-ratio: ${width} / ${height};`;
  }

  return attributes;
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[],
  format?: string
): string {
  return sizes
    .map((size) => {
      const url = format 
        ? baseUrl.replace(/\.(jpg|jpeg|png|webp|avif)$/i, `_${size}w.${format}`)
        : `${baseUrl}?w=${size}`;
      return `${url} ${size}w`;
    })
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(breakpoints: {
  mobile?: string;
  tablet?: string;
  desktop?: string;
  default: string;
}): string {
  const parts: string[] = [];

  if (breakpoints.mobile) {
    parts.push(`(max-width: 768px) ${breakpoints.mobile}`);
  }
  if (breakpoints.tablet) {
    parts.push(`(max-width: 1024px) ${breakpoints.tablet}`);
  }
  if (breakpoints.desktop) {
    parts.push(`(max-width: 1920px) ${breakpoints.desktop}`);
  }
  parts.push(breakpoints.default);

  return parts.join(', ');
}

/**
 * Generate blur placeholder data URL
 */
export function generateBlurPlaceholder(width: number = 20, height: number = 20): string {
  // This is a minimal 1x1 transparent PNG as base64
  // In production, generate actual blur placeholder from image
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate lazy loading image HTML
 */
export function generateLazyImageHTML(options: LazyImageOptions): string {
  const attrs = generateLazyImageAttributes(options);
  const { alt = '', width, height } = options;

  const attrStrings = Object.entries(attrs)
    .map(([key, value]) => {
      if (value === undefined || value === null) return '';
      return `${key}="${String(value).replace(/"/g, '&quot;')}"`;
    })
    .filter(Boolean)
    .join(' ');

  const widthAttr = width ? ` width="${width}"` : '';
  const heightAttr = height ? ` height="${height}"` : '';

  return `<img ${attrStrings}${widthAttr}${heightAttr} alt="${alt.replace(/"/g, '&quot;')}">`;
}

/**
 * Generate picture element with lazy loading
 */
export function generateLazyPictureHTML(options: {
  sources: Array<{
    srcset: string;
    media?: string;
    type: string;
  }>;
  fallback: LazyImageOptions;
}): string {
  const sources = options.sources
    .map((source) => {
      const media = source.media ? ` media="${source.media}"` : '';
      return `<source srcset="${source.srcset}"${media} type="${source.type}">`;
    })
    .join('\n  ');

  const img = generateLazyImageHTML(options.fallback);

  return `<picture>\n  ${sources}\n  ${img}\n</picture>`;
}

/**
 * Check if browser supports native lazy loading
 */
export function supportsNativeLazyLoading(): boolean {
  // Check if 'loading' attribute is supported
  // This is a browser-only function, but we need it to compile in Node.js
  // In practice, this should only be called from the frontend
  try {
    // @ts-ignore - window and HTMLImageElement are browser-only globals
    if (typeof window !== 'undefined' && typeof HTMLImageElement !== 'undefined') {
      // @ts-ignore
      return 'loading' in HTMLImageElement.prototype;
    }
  } catch {
    // Ignore errors in Node.js environment
  }
  return true; // Server-side, assume support
}

/**
 * Generate Intersection Observer options
 */
export interface IntersectionObserverOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export function getIntersectionObserverOptions(
  options: IntersectionObserverOptions = {}
): any {
  return {
    root: options.root || null,
    rootMargin: options.rootMargin || '50px', // Start loading 50px before image enters viewport
    threshold: options.threshold || 0.1,
  };
}

