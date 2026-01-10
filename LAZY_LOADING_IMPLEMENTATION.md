# Lazy Loading Implementation

## ✅ Implementation Complete

This document describes the comprehensive lazy loading implementation for efficient data loading and pagination.

---

## 📋 Overview

The lazy loading implementation provides efficient pagination, infinite scroll support, and image lazy loading to improve performance and user experience.

### Key Features
- **Offset-based pagination** - Traditional page/limit pagination
- **Cursor-based pagination** - Better performance for large datasets
- **Infinite scroll** - Support for infinite scrolling
- **Image lazy loading** - Progressive image loading
- **Chunked loading** - Process large datasets in chunks
- **Streaming** - Stream data for very large datasets

---

## 🏗️ Architecture

### Components

1. **Lazy Loading Service** (`api/src/services/lazyLoading.service.ts`)
   - Core pagination functions
   - Cursor-based pagination
   - Infinite scroll support
   - Chunked and streaming loading

2. **Image Lazy Loading Utilities** (`api/src/utils/imageLazyLoading.ts`)
   - Lazy image attributes
   - Responsive image generation
   - Progressive loading support

3. **Lazy Loading Middleware** (`api/src/middleware/lazyLoading.middleware.ts`)
   - Automatic pagination
   - Response formatting
   - Query parameter extraction

4. **Lazy Loading Helpers** (`api/src/utils/lazyLoadingHelpers.ts`)
   - Convenience functions
   - Common query patterns
   - Multi-tenant support

---

## 📦 Implementation Details

### 1. Database Lazy Loading

#### Offset-Based Pagination

**Best for**: Small to medium datasets, when total count is needed

```typescript
import { paginate } from '../services/lazyLoading.service';
import { Product } from '../models/Product';

const result = await paginate(Product, { status: 'active' }, {
  page: 1,
  limit: 20,
  sort: { createdAt: -1 },
});

// Returns:
// {
//   data: Product[],
//   pagination: {
//     page: 1,
//     limit: 20,
//     total: 150,
//     pages: 8,
//     hasNext: true,
//     hasPrev: false
//   }
// }
```

#### Cursor-Based Pagination

**Best for**: Large datasets, infinite scroll, when total count is not needed

```typescript
import { paginateWithCursor } from '../services/lazyLoading.service';

const result = await paginateWithCursor(Product, { status: 'active' }, {
  cursor: 'base64EncodedCursor',
  limit: 20,
  sort: { _id: 1 },
  sortField: '_id',
});

// Returns:
// {
//   data: Product[],
//   pagination: {
//     cursor: 'nextCursor',
//     prevCursor: 'prevCursor',
//     limit: 20,
//     hasNext: true,
//     hasPrev: true,
//     count: 20
//   }
// }
```

#### Infinite Scroll

```typescript
import { infiniteScroll } from '../services/lazyLoading.service';

const result = await infiniteScroll(Product, { status: 'active' }, {
  cursor: 'base64EncodedCursor',
  limit: 20,
  direction: 'forward', // or 'backward'
  sort: { createdAt: -1 },
});
```

#### Chunked Loading

```typescript
import { lazyLoadChunks } from '../services/lazyLoading.service';

await lazyLoadChunks(Product, { status: 'active' }, {
  chunkSize: 100,
  onChunk: async (chunk) => {
    // Process chunk
    await processProducts(chunk);
  },
});
```

#### Streaming

```typescript
import { lazyLoadStream } from '../services/lazyLoading.service';

for await (const batch of lazyLoadStream(Product, { status: 'active' }, {
  batchSize: 100,
})) {
  // Process batch
  await processProducts(batch);
}
```

---

### 2. Image Lazy Loading

#### Generate Lazy Image Attributes

```typescript
import { generateLazyImageAttributes } from '../utils/imageLazyLoading';

const attrs = generateLazyImageAttributes({
  src: '/images/product.jpg',
  srcset: '/images/product-300w.webp 300w, /images/product-600w.webp 600w',
  sizes: '(max-width: 768px) 100vw, 50vw',
  placeholder: '/images/product-blur.jpg',
  alt: 'Product image',
  width: 1200,
  height: 800,
  loading: 'lazy',
});

// Use in HTML/JSX
// <img {...attrs} />
```

#### Generate Responsive Srcset

```typescript
import { generateSrcSet, generateSizes } from '../utils/imageLazyLoading';

const srcset = generateSrcSet('/images/product.jpg', [300, 600, 1200], 'webp');
// Returns: "/images/product_300w.webp 300w, /images/product_600w.webp 600w, /images/product_1200w.webp 1200w"

const sizes = generateSizes({
  mobile: '100vw',
  tablet: '50vw',
  desktop: '33vw',
  default: '33vw',
});
// Returns: "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1920px) 33vw, 33vw"
```

#### Generate Lazy Image HTML

```typescript
import { generateLazyImageHTML } from '../utils/imageLazyLoading';

const html = generateLazyImageHTML({
  src: '/images/product.jpg',
  placeholder: '/images/product-blur.jpg',
  alt: 'Product',
  width: 1200,
  height: 800,
});
```

---

### 3. Controller Usage

#### Using Helpers

```typescript
import { lazyLoadWithPagination } from '../utils/lazyLoadingHelpers';
import { Product } from '../models/Product';

export const listProducts = async (req: Request, res: Response) => {
  const result = await lazyLoadWithPagination(Product, req, {
    status: 'active',
  });

  sendSuccess(res, {
    products: result.data,
    pagination: result.pagination,
  }, 'Products retrieved');
};
```

#### With Store Filter

```typescript
import { lazyLoadForStore } from '../utils/lazyLoadingHelpers';

export const listStoreProducts = async (req: Request, res: Response) => {
  const storeId = req.store?.storeId;
  const result = await lazyLoadForStore(Product, req, storeId, {
    status: 'active',
  });

  sendSuccess(res, {
    products: result.data,
    pagination: result.pagination,
  }, 'Products retrieved');
};
```

#### With Search

```typescript
import { lazyLoadWithSearch } from '../utils/lazyLoadingHelpers';

export const searchProducts = async (req: Request, res: Response) => {
  const result = await lazyLoadWithSearch(
    Product,
    req,
    ['name', 'description', 'sku'], // Search fields
    { status: 'active' }
  );

  sendSuccess(res, {
    products: result.data,
    pagination: result.pagination,
  }, 'Products retrieved');
};
```

#### With Date Range

```typescript
import { lazyLoadWithDateRange } from '../utils/lazyLoadingHelpers';

export const listRecentOrders = async (req: Request, res: Response) => {
  const result = await lazyLoadWithDateRange(
    Order,
    req,
    'createdAt', // Date field
    { status: 'completed' }
  );

  sendSuccess(res, {
    orders: result.data,
    pagination: result.pagination,
  }, 'Orders retrieved');
};
```

---

### 4. Middleware Usage

#### Automatic Pagination Middleware

```typescript
import { lazyLoadingMiddleware } from '../middleware/lazyLoading.middleware';
import { Product } from '../models/Product';

router.get(
  '/products',
  lazyLoadingMiddleware(Product, (req) => ({
    status: 'active',
    storeId: req.store?.storeId,
  }), {
    defaultLimit: 20,
    maxLimit: 100,
  })
);
```

#### Infinite Scroll Middleware

```typescript
import { infiniteScrollMiddleware } from '../middleware/lazyLoading.middleware';

router.get(
  '/products/infinite',
  infiniteScrollMiddleware(Product, (req) => ({
    status: 'active',
  }), {
    defaultLimit: 20,
    sortField: 'createdAt',
  })
);
```

---

## 🚀 API Usage Examples

### Offset-Based Pagination

**Request**:
```
GET /api/products?page=1&limit=20&sort=-createdAt
```

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Cursor-Based Pagination

**Request**:
```
GET /api/products?cursor=base64EncodedCursor&limit=20
```

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "cursor": "nextCursor",
      "prevCursor": "prevCursor",
      "limit": 20,
      "hasNext": true,
      "hasPrev": true,
      "count": 20
    }
  }
}
```

### Infinite Scroll

**Request**:
```
GET /api/products/infinite?cursor=base64EncodedCursor&limit=20&direction=forward
```

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "cursor": "nextCursor",
      "prevCursor": "prevCursor",
      "limit": 20,
      "hasNext": true,
      "hasPrev": true,
      "count": 20
    }
  }
}
```

---

## 🎯 Best Practices

### 1. Choose the Right Pagination Method

- **Offset-based**: When you need total count, small to medium datasets
- **Cursor-based**: Large datasets, infinite scroll, better performance
- **Streaming**: Very large datasets, batch processing

### 2. Image Lazy Loading

- Always use `loading="lazy"` for below-the-fold images
- Provide blur placeholders for better UX
- Use responsive images with srcset
- Set width and height to prevent layout shift

### 3. Performance Optimization

- Use cursor-based pagination for large datasets
- Limit page size (max 100 items)
- Index fields used for sorting
- Use chunked loading for batch operations

### 4. Frontend Integration

```typescript
// React example
const [products, setProducts] = useState([]);
const [cursor, setCursor] = useState(null);
const [loading, setLoading] = useState(false);

const loadMore = async () => {
  setLoading(true);
  const response = await fetch(`/api/products?cursor=${cursor}&limit=20`);
  const data = await response.json();
  setProducts([...products, ...data.data.data]);
  setCursor(data.data.pagination.cursor);
  setLoading(false);
};

// Intersection Observer for infinite scroll
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && cursor && !loading) {
      loadMore();
    }
  });

  const sentinel = document.getElementById('load-more-sentinel');
  if (sentinel) observer.observe(sentinel);

  return () => observer.disconnect();
}, [cursor, loading]);
```

---

## 📊 Performance Comparison

### Offset vs Cursor Pagination

| Feature | Offset-Based | Cursor-Based |
|---------|-------------|--------------|
| Performance | Slower on large datasets | Faster, consistent |
| Total Count | Yes | No |
| Jump to Page | Yes | No |
| Infinite Scroll | Possible | Ideal |
| Database Load | Higher | Lower |

### When to Use Each

- **Offset-based**: Admin panels, reports, when total count needed
- **Cursor-based**: User-facing lists, infinite scroll, large datasets
- **Streaming**: Data exports, batch processing, ETL operations

---

## 🔍 Troubleshooting

### Issue: Slow pagination on large datasets

**Solution**: Switch to cursor-based pagination
```typescript
// Instead of:
await paginate(Model, filter, { page: 10, limit: 20 });

// Use:
await paginateWithCursor(Model, filter, { cursor: '...', limit: 20 });
```

### Issue: Images loading all at once

**Solution**: Use lazy loading attributes
```typescript
const attrs = generateLazyImageAttributes({
  src: imageUrl,
  loading: 'lazy',
  placeholder: blurUrl,
});
```

### Issue: Layout shift when images load

**Solution**: Set width and height
```typescript
const attrs = generateLazyImageAttributes({
  src: imageUrl,
  width: 1200,
  height: 800,
});
```

---

## ✅ Checklist

- [x] Offset-based pagination
- [x] Cursor-based pagination
- [x] Infinite scroll support
- [x] Chunked loading
- [x] Streaming support
- [x] Image lazy loading utilities
- [x] Lazy loading middleware
- [x] Helper functions
- [x] Multi-tenant support
- [x] Search integration
- [x] Date range filtering
- [x] Documentation

---

**Status**: ✅ Complete and Ready for Production

**Last Updated**: 2024-01-15

