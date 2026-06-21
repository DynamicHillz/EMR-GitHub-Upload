/**
 * User Domain Service
 * Contains business rules and validation logic for users
 */

export class UserService {
  private static readonly PASSWORD_MIN_LENGTH = 8;
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 15;

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

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password must contain at least one special character (@$!%*?&)');
    }

    // Check for common passwords
    const commonPasswords = [
      'password',
      'password123',
      '12345678',
      'qwerty',
      'abc123',
      'password1',
      '12345678',
      '123456789',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
   * Generate random password
   */
  static generateRandomPassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '@$!%*?&';
    const allChars = lowercase + uppercase + numbers + special;

    let password = '';

    // Ensure at least one of each required character type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
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
