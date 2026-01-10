import React from 'react';
import { PageRenderer } from '@/components/PageRenderer';
import { BrandingProvider } from '@/context/BrandingContext';
import { api } from '@/lib/api';

interface Page {
  _id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  blocks: any[];
  version: number;
}

interface PageProps {
  params: {
    slug: string;
  };
}

/**
 * Storefront Page (SSR)
 * Renders published pages with server-side rendering for performance
 */
export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = params;

  try {
    // Fetch published page (no draft parameter = only published)
    const response = await api.get(`/store/pages/${slug}`);
    
    if (!response.data.success || !response.data.data) {
      return <NotFoundPage slug={slug} />;
    }

    const page: Page = response.data.data;

    // Only render published pages on storefront
    if (page.status !== 'published') {
      return <NotFoundPage slug={slug} />;
    }

    return (
      <BrandingProvider>
        <div className="min-h-screen">
          <PageRenderer blocks={page.blocks} isAuthenticated={false} />
        </div>
      </BrandingProvider>
    );
  } catch (error) {
    console.error('Failed to load page:', error);
    return <NotFoundPage slug={slug} />;
  }
}

function NotFoundPage({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Page Not Found</h1>
        <p className="text-gray-500">The page "{slug}" could not be found.</p>
      </div>
    </div>
  );
}

