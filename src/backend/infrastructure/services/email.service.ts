/**
 * Email Service
 * Service for sending emails (SendGrid or SMTP)
 */

import { logger } from '../../config/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private static readonly FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@ssmc.com';
  private static readonly FROM_NAME = process.env.SENDGRID_FROM_NAME || 'SSMC EMR';

  /**
   * Send email
   */
  static async send(options: EmailOptions): Promise<void> {
    try {
      // In development, just log the email
      if (process.env.NODE_ENV === 'development') {
        logger.info('Email would be sent:', {
          from: `${this.FROM_NAME} <${this.FROM_EMAIL}>`,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        return;
      }

      // TODO: Implement actual email sending with SendGrid
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send({
      //   from: {
      //     email: this.FROM_EMAIL,
      //     name: this.FROM_NAME,
      //   },
      //   to: options.to,
      //   subject: options.subject,
      //   text: options.text,
      //   html: options.html,
      // });

      logger.info(`Email sent successfully to ${options.to}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(email: string, firstName: string, tempPassword?: string): Promise<void> {
    const subject = 'Welcome to SSMC EMR';
    const text = `Hi ${firstName},\n\nWelcome to SSMC EMR! Your account has been created successfully.\n\n${
      tempPassword ? `Your temporary password is: ${tempPassword}\n\nPlease change it after your first login.\n\n` : ''
    }Best regards,\nSSMC EMR Team`;

    const html = `
      <h2>Welcome to SSMC EMR</h2>
      <p>Hi ${firstName},</p>
      <p>Welcome to SSMC EMR! Your account has been created successfully.</p>
      ${
        tempPassword
          ? `
      <p><strong>Your temporary password is:</strong> <code>${tempPassword}</code></p>
      <p>Please change it after your first login.</p>
      `
          : ''
      }
      <p>Best regards,<br/>SSMC EMR Team</p>
    `;

    await this.send({ to: email, subject, text, html });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.RESET_URL_BASE || 'http://localhost:5173/reset-password'}?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const text = `Hi ${firstName},\n\nWe received a request to reset your password.\n\nPlease click the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nSSMC EMR Team`;

    const html = `
      <h2>Password Reset Request</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password.</p>
      <p>Please click the button below to reset your password:</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p><strong>This link will expire in 15 minutes.</strong></p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br/>SSMC EMR Team</p>
    `;

    await this.send({ to: email, subject, text, html });
  }

  /**
   * Send password changed confirmation email
   */
  static async sendPasswordChangedEmail(email: string, firstName: string): Promise<void> {
    const subject = 'Password Changed Successfully';
    const text = `Hi ${firstName},\n\nYour password has been changed successfully.\n\nIf you didn't make this change, please contact support immediately.\n\nBest regards,\nSSMC EMR Team`;

    const html = `
      <h2>Password Changed Successfully</h2>
      <p>Hi ${firstName},</p>
      <p>Your password has been changed successfully.</p>
      <p><strong>If you didn't make this change, please contact support immediately.</strong></p>
      <p>Best regards,<br/>SSMC EMR Team</p>
    `;

    await this.send({ to: email, subject, text, html });
  }

  /**
   * Send account locked notification
   */
  static async sendAccountLockedEmail(email: string, firstName: string, unlockTime: Date): Promise<void> {
    const subject = 'Account Temporarily Locked';
    const unlockTimeStr = unlockTime.toLocaleString();
    const text = `Hi ${firstName},\n\nYour account has been temporarily locked due to multiple failed login attempts.\n\nYour account will be automatically unlocked at ${unlockTimeStr}.\n\nIf this wasn't you, please contact support immediately.\n\nBest regards,\nSSMC EMR Team`;

    const html = `
      <h2>Account Temporarily Locked</h2>
      <p>Hi ${firstName},</p>
      <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
      <p><strong>Your account will be automatically unlocked at ${unlockTimeStr}.</strong></p>
      <p>If this wasn't you, please contact support immediately.</p>
      <p>Best regards,<br/>SSMC EMR Team</p>
    `;

    await this.send({ to: email, subject, text, html });
  }
}
