import { EmailVerification } from '../models/EmailVerification';
import { generateEmailVerificationToken, hashEmailVerificationToken } from './emailVerificationToken';

/**
 * Helper function to send verification email for a new user
 * Called automatically after user registration or invite acceptance
 */
export const sendVerificationEmailForUser = async (userId: string, email: string): Promise<void> => {
  try {
    // Generate verification token
    const rawToken = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(rawToken);

    // Set expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Invalidate any existing unused verification tokens for this user
    await EmailVerification.updateMany(
      { userId, used: false },
      { used: true }
    );

    // Create new email verification record
    const emailVerification = new EmailVerification({
      userId,
      tokenHash,
      expiresAt,
      used: false,
    });

    await emailVerification.save();

    // Build verification URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

    // Send email using Nodemailer
    try {
      const { sendMail } = await import('./mailer');
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Thank you for registering! Please verify your email address to complete your registration.</p>
          <p style="margin: 20px 0;">
            <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This link expires in 24 hours.<br>
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px; word-break: break-all;">
            <a href="${verificationUrl}" style="color: #007bff;">${verificationUrl}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            If you didn't create this account, please ignore this email.<br>
            Your account remains secure.
          </p>
        </div>
      `;

      await sendMail(
        email,
        'Verify Your Email Address',
        emailHtml
      );
      
      console.log('[EMAIL VERIFICATION] Verification email sent successfully to:', email);
    } catch (emailError) {
      // Log error but don't fail - email sending failure shouldn't block user creation
      console.error('[EMAIL VERIFICATION] Failed to send verification email:', emailError);
      // Fallback: log to console for development
      if (process.env.NODE_ENV !== 'production') {
        console.log('========================================');
        console.log('EMAIL VERIFICATION EMAIL (Email send failed, showing here for dev)');
        console.log('========================================');
        console.log(`To: ${email}`);
        console.log(`Subject: Verify Your Email Address`);
        console.log(`\nClick the link below to verify your email address:\n${verificationUrl}`);
        console.log(`\nThis link expires in 24 hours.`);
        console.log(`If you didn't create this account, please ignore this email.`);
        console.log('========================================');
        console.log('\n⚠️  To send verification emails, set EMAIL_USER and EMAIL_PASS in .env');
      }
    }
  } catch (error) {
    // Don't throw - email sending failure shouldn't block user creation
    console.error('Failed to send verification email:', error);
  }
};

