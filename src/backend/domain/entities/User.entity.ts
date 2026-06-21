/**
 * User Domain Entity
 * Contains business logic for User operations
 */

export class UserEntity {
  constructor(
    public id: string,
    public tenantId: string,
    public email: string,
    public firstName: string,
    public lastName: string,
    public role: string,
    public status: string,
    public phone?: string,
    public lastLogin?: Date,
    public failedLoginAttempts: number = 0,
    public lockedUntil?: Date,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  /**
   * Get full name of the user
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Check if user account is locked
   */
  isLocked(): boolean {
    if (!this.lockedUntil) return false;
    return new Date() < this.lockedUntil;
  }

  /**
   * Check if user account is active
   */
  isActive(): boolean {
    return this.status === 'ACTIVE' && !this.isLocked();
  }

  /**
   * Check if user can login
   */
  canLogin(): boolean {
    return this.isActive();
  }

  /**
   * Increment failed login attempts
   */
  incrementFailedLogins(): void {
    this.failedLoginAttempts += 1;
  }

  /**
   * Reset failed login attempts
   */
  resetFailedLogins(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = undefined;
  }

  /**
   * Lock user account for specified minutes
   */
  lockAccount(minutes: number): void {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + minutes);
    this.lockedUntil = lockUntil;
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(): void {
    this.lastLogin = new Date();
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: string): boolean {
    return this.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(roles: string[]): boolean {
    return roles.includes(this.role);
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  /**
   * Validate user data
   */
  validate(): string[] {
    const errors: string[] = [];

    if (!this.email || !this.email.includes('@')) {
      errors.push('Valid email is required');
    }

    if (!this.firstName || this.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters');
    }

    if (!this.lastName || this.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters');
    }

    if (!this.role) {
      errors.push('Role is required');
    }

    return errors;
  }
}
