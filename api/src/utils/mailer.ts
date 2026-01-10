import nodemailer from 'nodemailer';

/**
 * Create reusable transporter for Gmail SMTP
 */
const createTransport = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

/**
 * Send email using Gmail SMTP
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML email body
 * @returns Promise<void>
 */
export const sendMail = async (to: string, subject: string, html: string): Promise<void> => {
  try {
    const emailUser = process.env.EMAIL_USER;
    
    if (!emailUser) {
      throw new Error('EMAIL_USER environment variable is not set');
    }

    const transporter = createTransport();

    const mailOptions = {
      from: emailUser,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

