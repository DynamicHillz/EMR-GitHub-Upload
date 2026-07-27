/**
 * Check-In Appointment Use Case Tests
 */

import { CheckInAppointmentUseCase } from './check-in-appointment.use-case';
import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { AppointmentStatus } from '../../../domain/entities/Appointment';

describe('CheckInAppointmentUseCase', () => {
  let useCase: CheckInAppointmentUseCase;
  let mockAppointmentRepository: jest.Mocked<IAppointmentRepository>;

  const tenantId = 'test-tenant-001';
  const appointmentId = 'appt-uuid-1';
  const doctorId = 'doctor-uuid-1';

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

    useCase = new CheckInAppointmentUseCase(mockAppointmentRepository);
  });

  it('should check in a scheduled appointment and report queue position', async () => {
    mockAppointmentRepository.findById.mockResolvedValue({
      id: appointmentId,
      doctorId,
      status: AppointmentStatus.SCHEDULED,
    } as any);
    mockAppointmentRepository.checkIn.mockResolvedValue({
      id: appointmentId,
      doctorId,
      status: AppointmentStatus.CHECKED_IN,
      checkedInAt: new Date(),
    } as any);
    mockAppointmentRepository.getWaitingQueue.mockResolvedValue([
      { id: 'other-appt' } as any,
      { id: appointmentId } as any,
    ]);

    const result = await useCase.execute(appointmentId, tenantId);

    expect(result.success).toBe(true);
    expect(mockAppointmentRepository.checkIn).toHaveBeenCalledWith(appointmentId, tenantId);
    expect(result.queuePosition).toBe(2);
    expect(result.appointment?.status).toBe(AppointmentStatus.CHECKED_IN);
  });

  it('should reject when the appointment does not exist', async () => {
    mockAppointmentRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute(appointmentId, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Appointment not found');
    expect(mockAppointmentRepository.checkIn).not.toHaveBeenCalled();
  });

  it.each([AppointmentStatus.CHECKED_IN, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED])(
    'should reject checking in an appointment that is already %s',
    async (status) => {
      mockAppointmentRepository.findById.mockResolvedValue({ id: appointmentId, doctorId, status } as any);

      const result = await useCase.execute(appointmentId, tenantId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot check in');
      expect(mockAppointmentRepository.checkIn).not.toHaveBeenCalled();
    }
  );

  it('should reject an empty appointment ID before touching the repository', async () => {
    const result = await useCase.execute('', tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Validation failed');
    expect(mockAppointmentRepository.findById).not.toHaveBeenCalled();
  });
});
