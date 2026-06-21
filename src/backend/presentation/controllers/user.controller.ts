/**
 * User Management Controller
 * Handles HTTP requests for user CRUD operations
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { CreateUserUseCase } from '../../application/use-cases/user/create-user.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/user/update-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/user/get-user.use-case';
import { ListUsersUseCase } from '../../application/use-cases/user/list-users.use-case';
import { DeactivateUserUseCase } from '../../application/use-cases/user/deactivate-user.use-case';
import { SuspendUserUseCase } from '../../application/use-cases/user/suspend-user.use-case';
import { ReactivateUserUseCase } from '../../application/use-cases/user/reactivate-user.use-case';
import { ChangePasswordUseCase } from '../../application/use-cases/user/change-password.use-case';
import {
  validateCreateUser,
  validateUpdateUser,
} from '../../application/validators/user.validator';
import { logger } from '../../config/logger';

/**
 * Create a new user (Admin only)
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = validateCreateUser(req.body);
    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: errorMessages.join('. '),
        errors: errorMessages,
      });
    }

    // Get current user ID from authenticated request
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Execute use case
    const createUserUseCase = new CreateUserUseCase(prisma);
    const user = await createUserUseCase.execute(value, currentUserId);

    res.status(201).json({
      message: 'User created successfully',
      user,
    });
  } catch (error: any) {
    logger.error('Create user error:', error);
    res.status(400).json({
      message: error.message || 'User creation failed',
    });
  }
};

/**
 * Update user details
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = validateUpdateUser(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message),
      });
    }

    // Get current user ID from authenticated request
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Execute use case
    const updateUserUseCase = new UpdateUserUseCase(prisma);
    const user = await updateUserUseCase.execute(id, value, currentUserId);

    res.json({
      message: 'User updated successfully',
      user,
    });
  } catch (error: any) {
    logger.error('Update user error:', error);
    res.status(400).json({
      message: error.message || 'User update failed',
    });
  }
};

/**
 * Get user by ID
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Execute use case
    const getUserUseCase = new GetUserUseCase(prisma);
    const user = await getUserUseCase.execute(id);

    res.json({ user });
  } catch (error: any) {
    logger.error('Get user error:', error);

    if (error.message === 'User not found') {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(400).json({
      message: error.message || 'Failed to retrieve user',
    });
  }
};

/**
 * List users with filters and pagination
 */
export const listUsers = async (req: Request, res: Response) => {
  try {
    // Get current user's tenant ID
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Build filters from query parameters
    const filters = {
      tenantId,
      role: req.query.role as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    // Execute use case
    const listUsersUseCase = new ListUsersUseCase(prisma);
    const result = await listUsersUseCase.execute(filters);

    res.json({
      users: result.users,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    });
  } catch (error: any) {
    logger.error('List users error:', error);
    res.status(400).json({
      message: error.message || 'Failed to retrieve users',
    });
  }
};

/**
 * Deactivate user
 */
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get current user ID from authenticated request
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Prevent self-deactivation
    if (id === currentUserId) {
      return res.status(400).json({
        message: 'Cannot deactivate your own account',
      });
    }

    // Execute use case
    const deactivateUserUseCase = new DeactivateUserUseCase(prisma);
    const result = await deactivateUserUseCase.execute(id, currentUserId);

    res.json(result);
  } catch (error: any) {
    logger.error('Deactivate user error:', error);
    res.status(400).json({
      message: error.message || 'User deactivation failed',
    });
  }
};

/**
 * Suspend user temporarily
 */
export const suspendUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { until } = req.body;

    // Get current user ID from authenticated request
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Prevent self-suspension
    if (id === currentUserId) {
      return res.status(400).json({
        message: 'Cannot suspend your own account',
      });
    }

    // Parse until date if provided
    const untilDate = until ? new Date(until) : undefined;

    // Validate date if provided
    if (untilDate && isNaN(untilDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format for suspension end date',
      });
    }

    // Execute use case
    const suspendUserUseCase = new SuspendUserUseCase(prisma);
    const result = await suspendUserUseCase.execute(id, currentUserId, untilDate);

    res.json(result);
  } catch (error: any) {
    logger.error('Suspend user error:', error);
    res.status(400).json({
      message: error.message || 'User suspension failed',
    });
  }
};

/**
 * Reactivate user
 */
export const reactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get current user ID from authenticated request
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Execute use case
    const reactivateUserUseCase = new ReactivateUserUseCase(prisma);
    const result = await reactivateUserUseCase.execute(id, currentUserId);

    res.json(result);
  } catch (error: any) {
    logger.error('Reactivate user error:', error);
    res.status(400).json({
      message: error.message || 'User reactivation failed',
    });
  }
};

/**
 * Change password (for authenticated user)
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get current user ID from authenticated request
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required',
      });
    }

    // Execute use case
    const changePasswordUseCase = new ChangePasswordUseCase(prisma);
    const result = await changePasswordUseCase.execute(currentUserId, currentPassword, newPassword);

    res.json(result);
  } catch (error: any) {
    logger.error('Change password error:', error);

    // Return appropriate status code based on error
    const statusCode = error.message.includes('incorrect') ? 401 : 400;

    res.status(statusCode).json({
      message: error.message || 'Password change failed',
    });
  }
};
