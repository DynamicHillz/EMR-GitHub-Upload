/**
 * Dashboard Controller
 * Provides statistics and summary data for the dashboard
 */

import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    // Get current date for today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const role = req.user?.role;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isSuperAdmin = role === 'SUPER_ADMIN';

    // Run all queries in parallel for better performance
    const [
      totalPatients,
      todaysAppointments,
      pendingLabTests,
      unpaidInvoices,
      activeUsers,
      totalTenants,
    ] = await Promise.all([
      // Total Patients
      prisma.patient.count({
        where: {
          tenantId,
          deletedAt: null,
        },
      }),

      // Today's Appointments
      prisma.appointment.count({
        where: {
          tenantId,
          appointmentDate: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            in: ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'],
          },
        },
      }),

      // Pending Lab Tests (ordered but not completed)
      // @ts-ignore - Temporary fix for schema alignment
      prisma.labTestRecord.count({
        where: {
          tenantId,
          status: {
            in: ['PENDING', 'IN_PROGRESS'],
          },
        },
      }),

      // Unpaid Invoices (issued or partially paid)
      prisma.invoice.count({
        where: {
          tenantId,
          status: {
            in: ['ISSUED', 'PARTIALLY_PAID'],
          },
        },
      }),

      // Active Users — admin-only widget, skip the query otherwise
      isAdmin ? prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }) : Promise.resolve(null),

      // Total Tenants — SUPER_ADMIN-only, platform-wide (no tenantId filter)
      isSuperAdmin ? prisma.tenant.count() : Promise.resolve(null),
    ]);

    res.json({
      success: true,
      data: {
        totalPatients,
        todaysAppointments,
        pendingLabTests,
        unpaidInvoices,
        ...(isAdmin && { activeUsers }),
        ...(isSuperAdmin && { totalTenants }),
      },
    });
  } catch (error: any) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
    });
  }
};

/**
 * GET /api/dashboard/recent-patients
 * Get recent patients (last 5)
 */
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const recentPatients = await prisma.patient.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    res.json({
      success: true,
      data: recentPatients,
    });
  } catch (error: any) {
    logger.error('Recent patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent patients',
    });
  }
};

/**
 * GET /api/dashboard/upcoming-appointments
 * Get upcoming appointments (next 5)
 */
export const getUpcomingAppointments = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No tenant ID found',
      });
    }

    const now = new Date();

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointmentDate: {
          gte: now,
        },
        status: {
          in: ['SCHEDULED', 'CHECKED_IN'],
        },
      },
      select: {
        id: true,
        appointmentDate: true,
        appointmentTime: true,
        appointmentType: true,
        status: true,
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        {
          appointmentDate: 'asc',
        },
        {
          appointmentTime: 'asc',
        },
      ],
      take: 5,
    });

    res.json({
      success: true,
      data: upcomingAppointments,
    });
  } catch (error: any) {
    logger.error('Upcoming appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming appointments',
    });
  }
};
