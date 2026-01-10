'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageRenderer } from '@/components/PageRenderer';
import { Block, BlockType, blockMetadata, defaultHeroBlockSettings, defaultCollectionBlockSettings, defaultCTABlockSettings, defaultFAQBlockSettings } from '@/types/blockTypes';
import { BrandingProvider } from '@/context/BrandingContext';
import { api } from '@/lib/api';

interface Page {
  _id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  blocks: Block[];
  version: number;
}

export default function PageEditor() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [page, setPage] = useState<Page | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);

  // Load page
  useEffect(() => {
    loadPage();
  }, [slug]);

  const loadPage = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/store/pages/${slug}?draft=true`);
      if (response.data.success) {
        setPage(response.data.data);
        if (response.data.data.blocks.length > 0) {
          setSelectedBlockId(response.data.data.blocks[0].id);
        }
      }
    } catch (error: any) {
      console.error('Failed to load page:', error);
      // If page doesn't exist, create a new draft
      if (error.response?.status === 404) {
        createNewPage();
      }
    } finally {
      setLoading(false);
    }
  };

  const createNewPage = async () => {
    try {
      const response = await api.post('/store/pages', {
        slug,
        title: slug.charAt(0).toUpperCase() + slug.slice(1),
        blocks: [],
      });
      if (response.data.success) {
        setPage(response.data.data);
      }
    } catch (error) {
      console.error('Failed to create page:', error);
    }
  };

  const addBlock = (type: BlockType) => {
    if (!page) return;

    const defaultSettings = {
      hero: defaultHeroBlockSettings,
      collection: defaultCollectionBlockSettings,
      cta: defaultCTABlockSettings,
      faq: defaultFAQBlockSettings,
    }[type];

    const newBlock: Block = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      order: page.blocks.length,
      settings: defaultSettings as any,
      visibility: 'always',
    };

    const updatedBlocks = [...page.blocks, newBlock];
    setPage({ ...page, blocks: updatedBlocks });
    setSelectedBlockId(newBlock.id);
    setShowBlockLibrary(false);
  };

  const removeBlock = (blockId: string) => {
    if (!page) return;
    const updatedBlocks = page.blocks
      .filter((b) => b.id !== blockId)
      .map((b, index) => ({ ...b, order: index }));
    setPage({ ...page, blocks: updatedBlocks });
    if (selectedBlockId === blockId) {
      setSelectedBlockId(updatedBlocks.length > 0 ? updatedBlocks[0].id : null);
    }
  };

  const updateBlockSettings = (blockId: string, settings: any) => {
    if (!page) return;
    const updatedBlocks = page.blocks.map((b) =>
      b.id === blockId ? { ...b, settings } : b
    );
    setPage({ ...page, blocks: updatedBlocks });
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    if (!page) return;
    const index = page.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= page.blocks.length) return;

    const updatedBlocks = [...page.blocks];
    [updatedBlocks[index], updatedBlocks[newIndex]] = [
      updatedBlocks[newIndex],
      updatedBlocks[index],
    ];
    updatedBlocks.forEach((b, i) => {
      b.order = i;
    });

    setPage({ ...page, blocks: updatedBlocks });
  };

  const saveDraft = async () => {
    if (!page) return;
    try {
      setSaving(true);
      const response = await api.patch(`/store/pages/${page._id}`, {
        title: page.title,
        blocks: page.blocks,
      });
      if (response.data.success) {
        alert('Draft saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const publishPage = async () => {
    if (!page) return;
    if (!confirm('Publish this page? This will make it live on your storefront.')) {
      return;
    }
    try {
      setSaving(true);
      const response = await api.post(`/store/pages/${page._id}/publish`);
      if (response.data.success) {
        alert('Page published successfully!');
        setPage(response.data.data);
      }
    } catch (error) {
      console.error('Failed to publish page:', error);
      alert('Failed to publish page');
    } finally {
      setSaving(false);
    }
  };

  const selectedBlock = page?.blocks.find((b) => b.id === selectedBlockId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading page editor...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Page not found</p>
      </div>
    );
  }

  return (
    <BrandingProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{page.title}</h1>
            <p className="text-sm text-gray-500">
              Status: <span className={page.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>{page.status}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={publishPage}
              disabled={saving || page.status === 'published'}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover disabled:opacity-50"
            >
              {page.status === 'published' ? 'Published' : 'Publish'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Block List */}
          <aside className="w-64 bg-white border-r overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Blocks</h2>
                <button
                  onClick={() => setShowBlockLibrary(true)}
                  className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primaryHover"
                >
                  + Add
                </button>
              </div>

              {showBlockLibrary && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold mb-2">Block Library</h3>
                  <div className="space-y-2">
                    {Object.values(blockMetadata).map((metadata) => (
                      <button
                        key={metadata.type}
                        onClick={() => addBlock(metadata.type)}
                        className="w-full text-left px-3 py-2 bg-white border rounded hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span>{metadata.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{metadata.name}</div>
                          <div className="text-xs text-gray-500">{metadata.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowBlockLibrary(false)}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {page.blocks.map((block) => {
                  const metadata = blockMetadata[block.type];
                  return (
                    <div
                      key={block.id}
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedBlockId === block.id
                          ? 'border-primary bg-primary/10'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedBlockId(block.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{metadata.icon}</span>
                          <span className="font-medium text-sm">{metadata.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeBlock(block.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlock(block.id, 'up');
                          }}
                          disabled={block.order === 0}
                          className="text-xs px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlock(block.id, 'down');
                          }}
                          disabled={block.order === page.blocks.length - 1}
                          className="text-xs px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
                {page.blocks.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No blocks yet. Click "Add" to get started.
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Center - Live Preview */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-6xl mx-auto p-8">
              <PageRenderer blocks={page.blocks} />
            </div>
          </main>

          {/* Right Sidebar - Block Settings */}
          <aside className="w-80 bg-white border-l overflow-y-auto">
            <div className="p-4">
              {selectedBlock ? (
                <BlockSettingsPanel
                  block={selectedBlock}
                  onUpdate={(settings) => updateBlockSettings(selectedBlock.id, settings)}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>Select a block to edit its settings</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </BrandingProvider>
  );
}

// Block Settings Panel Component
function BlockSettingsPanel({ block, onUpdate }: { block: Block; onUpdate: (settings: any) => void }) {
  const settings = block.settings as any;

  const updateField = (field: string, value: any) => {
    onUpdate({ ...settings, [field]: value });
  };

  const updateNestedField = (path: string[], value: any) => {
    const newSettings = { ...settings };
    let current: any = newSettings;
    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = { ...current[path[i]] };
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    onUpdate(newSettings);
  };

  return (
    <div>
      <h3 className="font-semibold mb-4">Block Settings</h3>
      <div className="space-y-4">
        {block.type === 'hero' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Headline</label>
              <input
                type="text"
                value={settings.headline || ''}
                onChange={(e) => updateField('headline', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subheadline</label>
              <input
                type="text"
                value={settings.subheadline || ''}
                onChange={(e) => updateField('subheadline', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Background Image URL</label>
              <input
                type="text"
                value={settings.backgroundImage || ''}
                onChange={(e) => updateField('backgroundImage', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alignment</label>
              <select
                value={settings.alignment || 'center'}
                onChange={(e) => updateField('alignment', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Button Text</label>
              <input
                type="text"
                value={settings.primaryButton?.text || ''}
                onChange={(e) => updateNestedField(['primaryButton', 'text'], e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Button Link</label>
              <input
                type="text"
                value={settings.primaryButton?.link || ''}
                onChange={(e) => updateNestedField(['primaryButton', 'link'], e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </>
        )}

        {block.type === 'collection' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={settings.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Layout</label>
              <select
                value={settings.layout || 'grid'}
                onChange={(e) => updateField('layout', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="grid">Grid</option>
                <option value="carousel">Carousel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Items Limit</label>
              <input
                type="number"
                value={settings.itemsLimit || 12}
                onChange={(e) => updateField('itemsLimit', parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </>
        )}

        {block.type === 'cta' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Text</label>
              <input
                type="text"
                value={settings.text || ''}
                onChange={(e) => updateField('text', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Button Text</label>
              <input
                type="text"
                value={settings.buttonText || ''}
                onChange={(e) => updateField('buttonText', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Button Link</label>
              <input
                type="text"
                value={settings.buttonLink || ''}
                onChange={(e) => updateField('buttonLink', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Background Style</label>
              <select
                value={settings.backgroundStyle || 'primary'}
                onChange={(e) => updateField('backgroundStyle', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="gradient">Gradient</option>
              </select>
            </div>
          </>
        )}

        {block.type === 'faq' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={settings.title || ''}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Layout</label>
              <select
                value={settings.layout || 'accordion'}
                onChange={(e) => updateField('layout', e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="accordion">Accordion</option>
                <option value="list">List</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">FAQ Items</label>
              <div className="space-y-2">
                {settings.items?.map((item: any, index: number) => (
                  <div key={index} className="p-3 border rounded">
                    <input
                      type="text"
                      placeholder="Question"
                      value={item.question || ''}
                      onChange={(e) => {
                        const newItems = [...settings.items];
                        newItems[index] = { ...newItems[index], question: e.target.value };
                        updateField('items', newItems);
                      }}
                      className="w-full px-2 py-1 border rounded mb-2 text-sm"
                    />
                    <textarea
                      placeholder="Answer"
                      value={item.answer || ''}
                      onChange={(e) => {
                        const newItems = [...settings.items];
                        newItems[index] = { ...newItems[index], answer: e.target.value };
                        updateField('items', newItems);
                      }}
                      className="w-full px-2 py-1 border rounded text-sm"
                      rows={2}
                    />
                    <button
                      onClick={() => {
                        const newItems = settings.items.filter((_: any, i: number) => i !== index);
                        updateField('items', newItems);
                      }}
                      className="mt-2 text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newItems = [...(settings.items || []), { question: '', answer: '' }];
                    updateField('items', newItems);
                  }}
                  className="w-full px-3 py-2 border border-dashed rounded text-sm hover:bg-gray-50"
                >
                  + Add FAQ Item
                </button>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Visibility</label>
          <select
            value={block.visibility}
            onChange={(e) => {
              // This would need to update the block's visibility, not settings
              // For now, we'll handle it in the parent component
            }}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="always">Always</option>
            <option value="loggedIn">Logged In Only</option>
            <option value="loggedOut">Logged Out Only</option>
          </select>
        </div>
      </div>
    </div>
  );
}

