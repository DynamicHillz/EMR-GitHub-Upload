/**
 * User Domain Service
 * Contains business rules and validation logic for users
 */

import crypto from 'crypto';

export class UserService {
  private static readonly PASSWORD_MIN_LENGTH = 8;
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 15;
  private static readonly PASSWORD_EXPIRY_DAYS = 90;
  private static readonly PASSWORD_HISTORY_COUNT = 5;

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${this.PASSWORD_MIN_LENGTH} characters long`);
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (/\d/.test(password) === false) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a password is in the common passwords list
   */
  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', 'password1', 'password123', 'password!',
      '12345678', '123456789', '1234567890',
      'qwerty', 'qwerty123', 'qwertyui',
      'abc123', 'abc12345',
      'letmein', 'welcome', 'welcome1',
      'admin', 'admin123', 'administrator',
      'login', 'master', 'dragon',
      'monkey', 'shadow', 'sunshine',
      'trustno1', 'iloveyou', 'princess',
      'football', 'baseball', 'soccer',
      'charlie', 'michael', 'jennifer',
      'access', 'passw0rd', 'p@ssword',
      'p@ssw0rd', 'pass1234', 'changeme',
      'hospital', 'medical', 'doctor',
      'nurse', 'patient', 'health',
      'stephen', 'ststephen', 'ssmc',
      'emr12345', 'test1234', 'default',
      'secret', 'Pa$$w0rd', 'P@ssword1',
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Calculate password strength (0-100)
   */
  static calculatePasswordStrength(password: string): number {
    let strength = 0;

    // Length
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 10;

    // Character variety
    if (/[a-z]/.test(password)) strength += 10;
    if (/[A-Z]/.test(password)) strength += 10;
    if (/\d/.test(password)) strength += 10;
    if (/[@$!%*?&]/.test(password)) strength += 10;

    // Multiple occurrences
    if ((password.match(/[a-z]/g) || []).length >= 3) strength += 5;
    if ((password.match(/[A-Z]/g) || []).length >= 2) strength += 5;
    if ((password.match(/\d/g) || []).length >= 2) strength += 5;
    if ((password.match(/[@$!%*?&]/g) || []).length >= 2) strength += 5;

    return Math.min(strength, 100);
  }

  /**
   * Check if account should be locked based on failed attempts
   */
  static shouldLockAccount(failedAttempts: number): boolean {
    return failedAttempts >= this.MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Get lockout duration in minutes
   */
  static getLockoutDuration(): number {
    return this.LOCKOUT_DURATION_MINUTES;
  }

  /**
   * Check if password has expired (older than PASSWORD_EXPIRY_DAYS)
   */
  static isPasswordExpired(passwordChangedAt: Date | null): boolean {
    if (!passwordChangedAt) {
      // If never set, consider it expired to force a password change
      return true;
    }
    const expiryMs = this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return (Date.now() - passwordChangedAt.getTime()) > expiryMs;
  }

  /**
   * Get number of days until password expires
   */
  static getDaysUntilPasswordExpiry(passwordChangedAt: Date | null): number {
    if (!passwordChangedAt) return 0;
    const expiryMs = this.PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = (passwordChangedAt.getTime() + expiryMs) - Date.now();
    return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  }

  /**
   * Get the max number of passwords to keep in history
   */
  static getPasswordHistoryCount(): number {
    return this.PASSWORD_HISTORY_COUNT;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate user role
   */
  static validateRole(role: string): boolean {
    const validRoles = [
      'ADMIN',
      'DOCTOR',
      'NURSE',
      'LAB_TECH',
      'PHARMACIST',
      'CASHIER',
      'RECEPTIONIST',
    ];
    return validRoles.includes(role);
  }

  /**
   * Validate user status
   */
  static validateStatus(status: string): boolean {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    return validStatuses.includes(status);
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Generate cryptographically secure random password
   */
  static generateRandomPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '@$!%*?&';
    const allChars = lowercase + uppercase + numbers + special;

    // Use crypto.randomBytes for cryptographic security
    const randomBytes = crypto.randomBytes(length);
    const chars: string[] = [];

    // Ensure at least one of each required character type
    chars.push(lowercase[crypto.randomInt(lowercase.length)]);
    chars.push(uppercase[crypto.randomInt(uppercase.length)]);
    chars.push(numbers[crypto.randomInt(numbers.length)]);
    chars.push(special[crypto.randomInt(special.length)]);

    // Fill the rest with cryptographically random characters
    for (let i = chars.length; i < length; i++) {
      chars.push(allChars[randomBytes[i] % allChars.length]);
    }

    // Fisher-Yates shuffle using crypto.randomInt
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
  }

  /**
   * Mask email for privacy
   */
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (username.length <= 3) {
      return `${username[0]}***@${domain}`;
    }
    const maskedUsername = `${username.slice(0, 2)}***${username.slice(-1)}`;
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Check if user can perform action based on role
   */
  static canPerformAction(userRole: string, action: string, _targetRole?: string): boolean {
    // Admins can do anything
    if (userRole === 'ADMIN') return true;

    // Define role hierarchy and permissions
    const rolePermissions: Record<string, string[]> = {
      DOCTOR: ['view_patients', 'create_consultation', 'create_prescription', 'order_lab_test'],
      NURSE: ['view_patients', 'update_vitals', 'check_in_patient'],
      LAB_TECH: ['view_lab_tests', 'process_lab_test', 'submit_results'],
      PHARMACIST: ['view_prescriptions', 'dispense_medication', 'manage_inventory'],
      CASHIER: ['view_invoices', 'record_payment', 'create_invoice'],
      RECEPTIONIST: ['view_patients', 'create_patient', 'create_appointment'],
    };

    return rolePermissions[userRole]?.includes(action) || false;
  }
}
