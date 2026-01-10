'use client';

import React from 'react';
import { HeroBlock } from './blocks/HeroBlock';
import { CollectionBlock } from './blocks/CollectionBlock';
import { CTABlock } from './blocks/CTABlock';
import { FAQBlock } from './blocks/FAQBlock';
import { Block, BlockType } from '@/types/blockTypes';

interface PageRendererProps {
  blocks: Block[];
  isAuthenticated?: boolean;
}

export function PageRenderer({ blocks, isAuthenticated = false }: PageRendererProps) {
  // Filter blocks based on visibility
  const visibleBlocks = blocks.filter((block) => {
    switch (block.visibility) {
      case 'always':
        return true;
      case 'loggedIn':
        return isAuthenticated;
      case 'loggedOut':
        return !isAuthenticated;
      default:
        return true;
    }
  });

  // Sort blocks by order
  const sortedBlocks = [...visibleBlocks].sort((a, b) => a.order - b.order);

  return (
    <div className="page-renderer">
      {sortedBlocks.map((block) => {
        switch (block.type as BlockType) {
          case 'hero':
            return (
              <HeroBlock
                key={block.id}
                settings={block.settings as any}
              />
            );
          case 'collection':
            return (
              <CollectionBlock
                key={block.id}
                settings={block.settings as any}
              />
            );
          case 'cta':
            return (
              <CTABlock
                key={block.id}
                settings={block.settings as any}
              />
            );
          case 'faq':
            return (
              <FAQBlock
                key={block.id}
                settings={block.settings as any}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

