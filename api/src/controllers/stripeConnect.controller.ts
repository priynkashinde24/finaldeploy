import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/responseFormatter';
import { stripe } from '../lib/stripe';
import { StripeConnectAccount } from '../models/StripeConnectAccount';
import { logAudit } from '../utils/auditLogger';
import mongoose from 'mongoose';

/**
 * Stripe Connect Controller
 * 
 * PURPOSE:
 * - Create Stripe Connect accounts for suppliers
 * - Generate onboarding links
 * - Process payouts to suppliers
 */

/**
 * POST /payments/stripe/connect/create-account
 * Create Stripe Connect account for supplier
 */
export const createConnectAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'supplier' || !storeId) {
      sendError(res, 'Only suppliers can create Connect accounts', 403);
      return;
    }

    // Check if account already exists
    const existingAccount = await StripeConnectAccount.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
    });

    if (existingAccount) {
      // Return existing account
      sendSuccess(
        res,
        {
          accountId: existingAccount.stripeAccountId,
          onboardingLink: existingAccount.onboardingLink,
          status: existingAccount.accountStatus,
          onboardingStatus: existingAccount.onboardingStatus,
        },
        'Connect account already exists'
      );
      return;
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // TODO: Make configurable
      email: currentUser.email || undefined,
      metadata: {
        supplierId: currentUser.id,
        storeId: storeId,
      },
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/supplier/connect/refresh`,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/supplier/connect/return`,
      type: 'account_onboarding',
    });

    // Save Connect account
    const connectAccount = new StripeConnectAccount({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
      stripeAccountId: account.id,
      accountStatus: account.details_submitted ? 'enabled' : 'pending',
      onboardingStatus: account.details_submitted ? 'complete' : 'incomplete',
      onboardingLink: accountLink.url,
      payoutsEnabled: account.payouts_enabled || false,
      chargesEnabled: account.charges_enabled || false,
      detailsSubmitted: account.details_submitted || false,
    });

    await connectAccount.save();

    // Audit log
    await logAudit({
      req,
      action: 'STRIPE_CONNECT_ACCOUNT_CREATED',
      entityType: 'StripeConnectAccount',
      entityId: connectAccount._id.toString(),
      description: `Stripe Connect account created for supplier`,
      after: {
        stripeAccountId: account.id,
        onboardingStatus: connectAccount.onboardingStatus,
      },
      metadata: {
        storeId: storeId,
        supplierId: currentUser.id,
      },
    });

    sendSuccess(
      res,
      {
        accountId: account.id,
        onboardingLink: accountLink.url,
        status: connectAccount.accountStatus,
        onboardingStatus: connectAccount.onboardingStatus,
      },
      'Connect account created successfully',
      201
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /payments/stripe/connect/account
 * Get supplier's Connect account status
 */
export const getConnectAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'supplier' || !storeId) {
      sendError(res, 'Only suppliers can view Connect accounts', 403);
      return;
    }

    const connectAccount = await StripeConnectAccount.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
    });

    if (!connectAccount) {
      sendError(res, 'Connect account not found', 404);
      return;
    }

    // Get latest status from Stripe
    const account = await stripe.accounts.retrieve(connectAccount.stripeAccountId);

    // Update local status
    connectAccount.accountStatus = account.details_submitted
      ? account.payouts_enabled
        ? 'enabled'
        : 'restricted'
      : 'pending';
    connectAccount.onboardingStatus = account.details_submitted ? 'complete' : 'incomplete';
    connectAccount.payoutsEnabled = account.payouts_enabled || false;
    connectAccount.chargesEnabled = account.charges_enabled || false;
    connectAccount.detailsSubmitted = account.details_submitted || false;
    await connectAccount.save();

    sendSuccess(
      res,
      {
        accountId: connectAccount.stripeAccountId,
        status: connectAccount.accountStatus,
        onboardingStatus: connectAccount.onboardingStatus,
        payoutsEnabled: connectAccount.payoutsEnabled,
        chargesEnabled: connectAccount.chargesEnabled,
        onboardingLink: connectAccount.onboardingLink,
      },
      'Connect account fetched successfully'
    );
  } catch (error: any) {
    next(error);
  }
};

/**
 * POST /payments/stripe/connect/create-onboarding-link
 * Create new onboarding link for existing account
 */
export const createOnboardingLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUser = req.user;
    const storeId = req.store?.storeId;

    if (!currentUser || currentUser.role !== 'supplier' || !storeId) {
      sendError(res, 'Only suppliers can create onboarding links', 403);
      return;
    }

    const connectAccount = await StripeConnectAccount.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      supplierId: new mongoose.Types.ObjectId(currentUser.id),
    });

    if (!connectAccount) {
      sendError(res, 'Connect account not found', 404);
      return;
    }

    // Create new onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: connectAccount.stripeAccountId,
      refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/supplier/connect/refresh`,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/supplier/connect/return`,
      type: 'account_onboarding',
    });

    // Update onboarding link
    connectAccount.onboardingLink = accountLink.url;
    await connectAccount.save();

    sendSuccess(
      res,
      {
        onboardingLink: accountLink.url,
      },
      'Onboarding link created successfully'
    );
  } catch (error: any) {
    next(error);
  }
};

