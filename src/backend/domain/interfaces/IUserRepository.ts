/**
 * User Repository Interface
 * Defines contract for user data access operations
 */

export interface IUser {
  id: string;
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status: string;
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  status?: string;
}

export interface UserFilters {
  tenantId: string;
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface IUserRepository {
  /**
   * Find user by ID
   */
  findById(id: string): Promise<IUser | null>;

  /**
   * Find user by email within tenant
   */
  findByEmail(email: string, tenantId: string): Promise<IUser | null>;

  /**
   * Find all users with filters
   */
  findAll(filters: UserFilters): Promise<IUser[]>;

  /**
   * Create new user
   */
  create(data: CreateUserData): Promise<IUser>;

  /**
   * Update user
   */
  update(id: string, data: UpdateUserData): Promise<IUser>;

  /**
   * Update user password
   */
  updatePassword(id: string, hashedPassword: string): Promise<void>;

  /**
   * Update failed login attempts
   */
  updateFailedAttempts(id: string, attempts: number, lockedUntil?: Date): Promise<void>;

  /**
   * Update last login timestamp
   */
  updateLastLogin(id: string): Promise<void>;

  /**
   * Deactivate user (soft delete)
   */
  deactivate(id: string): Promise<void>;

  /**
   * Reactivate user
   */
  reactivate(id: string): Promise<void>;

  /**
   * Suspend user
   */
  suspend(id: string, until?: Date): Promise<void>;

  /**
   * Count users by filters
   */
  count(filters: Omit<UserFilters, 'limit' | 'offset'>): Promise<number>;
}
