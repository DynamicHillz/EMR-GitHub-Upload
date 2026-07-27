/**
 * Cancel Appointment Use Case Tests
 */

import { CancelAppointmentUseCase } from './cancel-appointment.use-case';
import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { AppointmentStatus } from '../../../domain/entities/Appointment';

describe('CancelAppointmentUseCase', () => {
  let useCase: CancelAppointmentUseCase;
  let mockAppointmentRepository: jest.Mocked<IAppointmentRepository>;

  const tenantId = 'test-tenant-001';
  const appointmentId = 'appt-uuid-1';
  const reason = 'Patient requested reschedule';

  beforeEach(() => {
    mockAppointmentRepository = {
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      findByDoctorId: jest.fn(),
      search: jest.fn(),
      findOverlapping: jest.fn(),
      getWaitingQueue: jest.fn(),
      findByDateRange: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      checkIn: jest.fn(),
      cancel: jest.fn(),
      delete: jest.fn(),
      findNeedingReminder: jest.fn(),
      markReminderSent: jest.fn(),
    } as any;

    useCase = new CancelAppointmentUseCase(mockAppointmentRepository);
  });

  it('should successfully cancel a scheduled appointment', async () => {
    mockAppointmentRepository.findById.mockResolvedValue({
      id: appointmentId,
      status: AppointmentStatus.SCHEDULED,
    } as any);
    mockAppointmentRepository.cancel.mockResolvedValue({
      id: appointmentId,
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason,
    } as any);

    const result = await useCase.execute(appointmentId, reason, tenantId);

    expect(result.success).toBe(true);
    expect(mockAppointmentRepository.cancel).toHaveBeenCalledWith(appointmentId, tenantId, reason);
    expect(result.appointment?.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('should reject when the appointment does not exist', async () => {
    mockAppointmentRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute(appointmentId, reason, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Appointment not found');
    expect(mockAppointmentRepository.cancel).not.toHaveBeenCalled();
  });

  it('should reject cancelling an already-cancelled appointment', async () => {
    mockAppointmentRepository.findById.mockResolvedValue({
      id: appointmentId,
      status: AppointmentStatus.CANCELLED,
    } as any);

    const result = await useCase.execute(appointmentId, reason, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Already cancelled');
    expect(mockAppointmentRepository.cancel).not.toHaveBeenCalled();
  });

  it.each([AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW])(
    'should reject cancelling a %s appointment',
    async (status) => {
      mockAppointmentRepository.findById.mockResolvedValue({ id: appointmentId, status } as any);

      const result = await useCase.execute(appointmentId, reason, tenantId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot cancel');
      expect(mockAppointmentRepository.cancel).not.toHaveBeenCalled();
    }
  );

  it('should reject a cancellation reason that is too short', async () => {
    mockAppointmentRepository.findById.mockResolvedValue({
      id: appointmentId,
      status: AppointmentStatus.SCHEDULED,
    } as any);

    const result = await useCase.execute(appointmentId, 'no', tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Validation failed');
    expect(mockAppointmentRepository.findById).not.toHaveBeenCalled();
  });
});
