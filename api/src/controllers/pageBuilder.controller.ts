import { Request, Response, NextFunction } from 'express';
import { Page, PageVersion, IBlock } from '../models/Page';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { z } from 'zod';
import { blockMetadata, BlockType, BlockSettings } from '../types/blockTypes';
import { logAudit } from '../utils/auditLogger';
import { Store } from '../models/Store';
import { getCachedPage, setCachedPage, invalidatePageCache } from '../utils/pageCache';

// Simple HTML sanitization
const sanitizeHTML = (text: string): string => {
  if (!text) return '';
  // Remove HTML tags - basic sanitization
  return text.replace(/<[^>]*>/g, '').trim();
};

// Validation schemas
const blockSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['hero', 'collection', 'cta', 'faq']),
  order: z.number().int().min(0),
  settings: z.any(), // Block-specific settings validated per type
  visibility: z.enum(['always', 'loggedIn', 'loggedOut']).default('always'),
});

const createPageSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  title: z.string().min(1).max(200),
  blocks: z.array(blockSchema).optional().default([]),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  blocks: z.array(blockSchema).optional(),
});

/**
 * Verify user has access to edit pages (store owner or admin)
 */
const verifyPageAccess = async (req: Request, storeId: string): Promise<boolean> => {
  if (!req.user) return false;
  
  // Admins have access to all stores
  if (req.user.role === 'admin') return true;
  
  // Check if user is store owner
  const store = await Store.findById(storeId);
  if (!store) return false;
  
  return store.ownerId === req.user.id;
};

/**
 * Sanitize and validate text inputs
 */
const sanitizeText = (text: string): string => {
  if (!text) return '';
  // Remove HTML tags - basic sanitization
  return sanitizeHTML(text);
};

/**
 * Validate URL (must be relative or same origin)
 */
const validateLink = (link: string): boolean => {
  if (!link) return true; // Empty links are allowed
  
  // Allow relative paths
  if (link.startsWith('/')) return true;
  
  // Allow hash links
  if (link.startsWith('#')) return true;
  
  // Validate absolute URLs (must be http/https)
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Sanitize block settings
 */
const sanitizeBlockSettings = (settings: any, type: BlockType): any => {
  const sanitized = { ...settings };
  
  // Sanitize text fields
  if (type === 'hero') {
    if (sanitized.headline) sanitized.headline = sanitizeText(sanitized.headline);
    if (sanitized.subheadline) sanitized.subheadline = sanitizeText(sanitized.subheadline);
    if (sanitized.primaryButton?.link) {
      if (!validateLink(sanitized.primaryButton.link)) {
        sanitized.primaryButton.link = '#';
      }
    }
    if (sanitized.secondaryButton?.link) {
      if (!validateLink(sanitized.secondaryButton.link)) {
        sanitized.secondaryButton.link = '#';
      }
    }
  }
  
  if (type === 'collection') {
    if (sanitized.title) sanitized.title = sanitizeText(sanitized.title);
  }
  
  if (type === 'cta') {
    if (sanitized.text) sanitized.text = sanitizeText(sanitized.text);
    if (sanitized.buttonLink) {
      if (!validateLink(sanitized.buttonLink)) {
        sanitized.buttonLink = '#';
      }
    }
  }
  
  if (type === 'faq') {
    if (sanitized.title) sanitized.title = sanitizeText(sanitized.title);
    if (sanitized.items) {
      sanitized.items = sanitized.items.map((item: any) => ({
        question: sanitizeText(item.question || ''),
        answer: sanitizeText(item.answer || ''),
      }));
    }
  }
  
  return sanitized;
};

/**
 * POST /api/store/pages
 * Create a new page (draft)
 */
export const createPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    
    // Verify access
    if (!(await verifyPageAccess(req, storeId))) {
      sendError(res, 'Only store owners and admins can create pages', 403);
      return;
    }

    const validatedData = createPageSchema.parse(req.body);

    // Check if slug already exists for this store
    const existingPage = await Page.findOne({ storeId, slug: validatedData.slug });
    if (existingPage) {
      sendError(res, 'Page with this slug already exists', 400);
      return;
    }

    // Sanitize and validate blocks
    const blocks: IBlock[] = validatedData.blocks.map((block, index) => {
      const sanitizedSettings = sanitizeBlockSettings(
        block.settings || blockMetadata[block.type as BlockType].defaultSettings,
        block.type as BlockType
      );
      
      return {
        id: block.id || `block-${Date.now()}-${index}`,
        type: block.type as BlockType,
        order: block.order !== undefined ? block.order : index,
        settings: sanitizedSettings,
        visibility: block.visibility || 'always',
      };
    });

    const page = new Page({
      storeId,
      slug: validatedData.slug,
      title: sanitizeText(validatedData.title),
      status: 'draft',
      blocks,
      version: 1,
    });

    await page.save();

    // Log audit
    await logAudit({
      req,
      action: 'PAGE_CREATED',
      entityType: 'Page',
      entityId: page._id,
      after: { slug: page.slug, title: page.title, blocksCount: page.blocks.length },
      description: `Page "${page.title}" (${page.slug}) created`,
      metadata: { version: page.version },
    });

    sendSuccess(res, page, 'Page created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store/pages
 * Get all pages for a store
 */
export const getPages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const status = req.query.status as 'draft' | 'published' | undefined;

    const query: any = { storeId };
    if (status) {
      query.status = status;
    }

    const pages = await Page.find(query).sort({ updatedAt: -1 });

    sendSuccess(res, { pages, count: pages.length }, 'Pages retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store/pages/:slug
 * Get a page by slug (returns published version if available, otherwise draft)
 * Uses caching for published pages
 */
export const getPageBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const { slug } = req.params;
    const includeDraft = req.query.draft === 'true';

    // Try cache first for published pages (only if not requesting draft)
    if (!includeDraft) {
      const cached = getCachedPage(storeId, slug);
      if (cached) {
        return sendSuccess(res, cached, 'Page retrieved successfully (cached)');
      }
    }

    // Try to get published page first
    let page = await Page.findOne({ storeId, slug, status: 'published' });

    // If no published page and draft is requested, get draft
    if (!page && includeDraft) {
      page = await Page.findOne({ storeId, slug, status: 'draft' });
    }

    if (!page) {
      sendError(res, 'Page not found', 404);
      return;
    }

    // Cache published pages
    if (page.status === 'published' && !includeDraft) {
      setCachedPage(storeId, slug, page);
    }

    sendSuccess(res, page, 'Page retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/store/pages/:id
 * Update a page (only draft pages can be updated)
 */
export const updatePage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const { id } = req.params;
    const validatedData = updatePageSchema.parse(req.body);

    const page = await Page.findOne({ _id: id, storeId });

    if (!page) {
      sendError(res, 'Page not found', 404);
      return;
    }

    // Verify access
    if (!(await verifyPageAccess(req, storeId))) {
      sendError(res, 'Only store owners and admins can update pages', 403);
      return;
    }

    // Only allow updating draft pages
    if (page.status === 'published') {
      sendError(res, 'Cannot update published page. Create a new draft version.', 400);
      return;
    }

    const beforeState = {
      title: page.title,
      blocksCount: page.blocks.length,
      blocks: page.blocks.map(b => ({ id: b.id, type: b.type })),
    };

    // Track block changes
    const oldBlockIds = new Set(page.blocks.map(b => b.id));
    
    // Update fields
    if (validatedData.title !== undefined) {
      page.title = sanitizeText(validatedData.title);
    }

    if (validatedData.blocks !== undefined) {
      // Sanitize and validate blocks
      page.blocks = validatedData.blocks.map((block, index) => {
        const sanitizedSettings = sanitizeBlockSettings(
          block.settings || blockMetadata[block.type as BlockType].defaultSettings,
          block.type as BlockType
        );
        
        return {
          id: block.id || `block-${Date.now()}-${index}`,
          type: block.type as BlockType,
          order: block.order !== undefined ? block.order : index,
          settings: sanitizedSettings,
          visibility: block.visibility || 'always',
        };
      }) as IBlock[];
    }

    await page.save();

    // Track added/removed blocks
    const newBlockIds = new Set(page.blocks.map(b => b.id));
    const addedBlocks = page.blocks.filter(b => !oldBlockIds.has(b.id));
    const removedBlocks = beforeState.blocks.filter(b => !newBlockIds.has(b.id));

    // Log audit
    await logAudit({
      req,
      action: 'PAGE_UPDATED',
      entityType: 'Page',
      entityId: page._id,
      before: beforeState,
      after: { title: page.title, blocksCount: page.blocks.length },
      description: `Page "${page.title}" (${page.slug}) updated`,
      metadata: { 
        version: page.version,
        addedBlocks: addedBlocks.map(b => ({ id: b.id, type: b.type })),
        removedBlocks: removedBlocks,
      },
    });

    // Log individual block changes
    for (const block of addedBlocks) {
      await logAudit({
        req,
        action: 'BLOCK_ADDED',
        entityType: 'Page',
        entityId: page._id,
        after: { blockId: block.id, blockType: block.type },
        description: `Block ${block.type} added to page "${page.title}"`,
        metadata: { pageSlug: page.slug, blockId: block.id },
      });
    }

    for (const block of removedBlocks) {
      await logAudit({
        req,
        action: 'BLOCK_REMOVED',
        entityType: 'Page',
        entityId: page._id,
        before: { blockId: block.id, blockType: block.type },
        description: `Block ${block.type} removed from page "${page.title}"`,
        metadata: { pageSlug: page.slug, blockId: block.id },
      });
    }

    sendSuccess(res, page, 'Page updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store/pages/:id/publish
 * Publish a page (creates a published version, archives old published version)
 */
export const publishPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const { id } = req.params;

    // Verify access
    if (!(await verifyPageAccess(req, storeId))) {
      sendError(res, 'Only store owners and admins can publish pages', 403);
      return;
    }

    const draftPage = await Page.findOne({ _id: id, storeId, status: 'draft' });

    if (!draftPage) {
      sendError(res, 'Draft page not found', 404);
      return;
    }

    // Save current published version to history before unpublishing
    const oldPublishedPage = await Page.findOne({ 
      storeId, 
      slug: draftPage.slug, 
      status: 'published' 
    });

    if (oldPublishedPage) {
      // Save to version history
      const pageVersion = new PageVersion({
        pageId: oldPublishedPage._id,
        storeId: oldPublishedPage.storeId,
        slug: oldPublishedPage.slug,
        title: oldPublishedPage.title,
        blocks: oldPublishedPage.blocks,
        version: oldPublishedPage.version,
        publishedAt: oldPublishedPage.publishedAt,
      });
      await pageVersion.save();

      // Unpublish old version
      oldPublishedPage.status = 'draft';
      await oldPublishedPage.save();
    }

    // Save draft version to history before publishing
    const draftVersion = new PageVersion({
      pageId: draftPage._id,
      storeId: draftPage.storeId,
      slug: draftPage.slug,
      title: draftPage.title,
      blocks: draftPage.blocks,
      version: draftPage.version,
    });
    await draftVersion.save();

    // Publish the current draft
    const newVersion = (draftPage.version || 1) + 1;
    draftPage.status = 'published';
    draftPage.version = newVersion;
    draftPage.publishedAt = new Date();

    await draftPage.save();

    // Log audit
    await logAudit({
      req,
      action: 'PAGE_PUBLISHED',
      entityType: 'Page',
      entityId: draftPage._id,
      after: { 
        version: newVersion, 
        slug: draftPage.slug, 
        blocksCount: draftPage.blocks.length 
      },
      description: `Page "${draftPage.title}" (${draftPage.slug}) published as version ${newVersion}`,
      metadata: { 
        version: newVersion,
        previousVersion: draftPage.version - 1,
      },
    });

    sendSuccess(res, draftPage, 'Page published successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/store/pages/:id/versions
 * Get version history for a page
 */
export const getPageVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const { id } = req.params;

    // Verify access
    if (!(await verifyPageAccess(req, storeId))) {
      sendError(res, 'Only store owners and admins can view page versions', 403);
      return;
    }

    const page = await Page.findOne({ _id: id, storeId });
    if (!page) {
      sendError(res, 'Page not found', 404);
      return;
    }

    const versions = await PageVersion.find({ pageId: id, storeId })
      .sort({ version: -1 })
      .limit(50); // Limit to last 50 versions

    sendSuccess(res, { versions, currentVersion: page.version }, 'Versions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/store/pages/:id/rollback
 * Rollback to a previous version
 */
export const rollbackPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const { id } = req.params;
    const { version } = req.body;

    if (!version || typeof version !== 'number') {
      sendError(res, 'Version number is required', 400);
      return;
    }

    // Verify access
    if (!(await verifyPageAccess(req, storeId))) {
      sendError(res, 'Only store owners and admins can rollback pages', 403);
      return;
    }

    const page = await Page.findOne({ _id: id, storeId });
    if (!page) {
      sendError(res, 'Page not found', 404);
      return;
    }

    // Find the version to rollback to
    const targetVersion = await PageVersion.findOne({ 
      pageId: id, 
      storeId, 
      version 
    });

    if (!targetVersion) {
      sendError(res, `Version ${version} not found`, 404);
      return;
    }

    // Save current state to history before rollback
    if (page.status === 'published') {
      const currentVersion = new PageVersion({
        pageId: page._id,
        storeId: page.storeId,
        slug: page.slug,
        title: page.title,
        blocks: page.blocks,
        version: page.version,
        publishedAt: page.publishedAt,
      });
      await currentVersion.save();
    }

    // Rollback to target version
    const beforeState = {
      title: page.title,
      blocksCount: page.blocks.length,
      version: page.version,
    };

    page.title = targetVersion.title;
    page.blocks = targetVersion.blocks;
    page.version = targetVersion.version;
    // Keep status as draft after rollback (user must publish again)
    page.status = 'draft';

    await page.save();

    // Invalidate cache
    invalidatePageCache(storeId, page.slug);

    // Log audit
    await logAudit({
      req,
      action: 'PAGE_ROLLBACK',
      entityType: 'Page',
      entityId: page._id,
      before: beforeState,
      after: { 
        title: page.title, 
        blocksCount: page.blocks.length, 
        version: page.version 
      },
      description: `Page "${page.title}" (${page.slug}) rolled back to version ${version}`,
      metadata: { 
        fromVersion: beforeState.version,
        toVersion: version,
      },
    });

    sendSuccess(res, page, `Page rolled back to version ${version} successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/store/pages/:id
 * Delete a page (only draft pages can be deleted)
 */
export const deletePage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.store) {
      sendError(res, 'Store context required', 400);
      return;
    }

    const storeId = req.store.storeId;
    const { id } = req.params;

    // Verify access
    if (!(await verifyPageAccess(req, storeId))) {
      sendError(res, 'Only store owners and admins can delete pages', 403);
      return;
    }

    const page = await Page.findOne({ _id: id, storeId });

    if (!page) {
      sendError(res, 'Page not found', 404);
      return;
    }

    // Only allow deleting draft pages
    if (page.status === 'published') {
      sendError(res, 'Cannot delete published page. Unpublish it first.', 400);
      return;
    }

    await Page.deleteOne({ _id: id, storeId });

    // Log audit
    await logAudit({
      req,
      action: 'PAGE_DELETED',
      entityType: 'Page',
      entityId: page._id,
      before: { slug: page.slug, title: page.title },
      description: `Page "${page.title}" (${page.slug}) deleted`,
    });

    sendSuccess(res, null, 'Page deleted successfully');
  } catch (error) {
    next(error);
  }
};

