/**
 * Book Appointment Use Case Tests
 *
 * Tests for appointment booking business logic, including double-booking
 * prevention
 */

import { BookAppointmentUseCase } from './book-appointment.use-case';
import { IAppointmentRepository } from '../../../domain/interfaces/IAppointmentRepository';
import { IPatientRepository } from '../../../domain/interfaces/IPatientRepository';
import { AppointmentStatus } from '../../../domain/entities/Appointment';
import { CreateAppointmentDto } from '../../dtos/appointment/CreateAppointment.dto';

describe('BookAppointmentUseCase', () => {
  let useCase: BookAppointmentUseCase;
  let mockAppointmentRepository: jest.Mocked<IAppointmentRepository>;
  let mockPatientRepository: jest.Mocked<IPatientRepository>;

  const tenantId = 'test-tenant-001';

  const validDto: CreateAppointmentDto = {
    patientId: 'patient-uuid-1',
    doctorId: 'doctor-uuid-1',
    appointmentDate: '2099-01-15',
    appointmentTime: '09:30',
    appointmentType: 'CONSULTATION',
    reason: 'Routine checkup',
  };

  const mockPatient: any = { id: 'patient-uuid-1', firstName: 'John', lastName: 'Doe' };

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

    mockPatientRepository = {
      findById: jest.fn(),
      findByPatientId: jest.fn(),
      findByPhone: jest.fn(),
      search: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      isPatientIdUnique: jest.fn(),
    } as any;

    useCase = new BookAppointmentUseCase(mockAppointmentRepository, mockPatientRepository);
  });

  it('should successfully book an appointment when no conflicts exist', async () => {
    mockPatientRepository.findById.mockResolvedValue(mockPatient);
    mockAppointmentRepository.findOverlapping.mockResolvedValue([]);

    const mockCreated: any = {
      id: 'appt-uuid-1',
      patientId: validDto.patientId,
      doctorId: validDto.doctorId,
      appointmentDate: new Date(validDto.appointmentDate),
      appointmentTime: validDto.appointmentTime,
      appointmentType: validDto.appointmentType,
      reason: validDto.reason,
      duration: 30,
      status: AppointmentStatus.SCHEDULED,
      createdAt: new Date(),
    };
    mockAppointmentRepository.create.mockResolvedValue(mockCreated);

    const result = await useCase.execute(validDto, tenantId);

    expect(result.success).toBe(true);
    expect(mockAppointmentRepository.findOverlapping).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: validDto.doctorId, tenantId, startTime: '09:30', endTime: '10:00' })
    );
    expect(mockAppointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, patientId: validDto.patientId, doctorId: validDto.doctorId, duration: 30 })
    );
    expect(result.appointment?.status).toBe(AppointmentStatus.SCHEDULED);
  });

  it('should reject booking when the patient does not exist', async () => {
    mockPatientRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute(validDto, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Patient not found');
    expect(mockAppointmentRepository.create).not.toHaveBeenCalled();
  });

  it('should reject booking when the time slot overlaps an existing appointment', async () => {
    mockPatientRepository.findById.mockResolvedValue(mockPatient);
    mockAppointmentRepository.findOverlapping.mockResolvedValue([
      { id: 'existing-appt' } as any,
    ]);

    const result = await useCase.execute(validDto, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Time slot unavailable');
    expect(mockAppointmentRepository.create).not.toHaveBeenCalled();
  });

  it('should reject invalid input before touching the repositories', async () => {
    const invalidDto: CreateAppointmentDto = { ...validDto, appointmentTime: 'not-a-time' };

    const result = await useCase.execute(invalidDto, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Validation failed');
    expect(mockPatientRepository.findById).not.toHaveBeenCalled();
    expect(mockAppointmentRepository.create).not.toHaveBeenCalled();
  });

  it('should default duration to 30 minutes when not provided', async () => {
    mockPatientRepository.findById.mockResolvedValue(mockPatient);
    mockAppointmentRepository.findOverlapping.mockResolvedValue([]);
    mockAppointmentRepository.create.mockResolvedValue({
      id: 'appt-uuid-2',
      duration: 30,
      status: AppointmentStatus.SCHEDULED,
      createdAt: new Date(),
    } as any);

    await useCase.execute(validDto, tenantId);

    expect(mockAppointmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 30 })
    );
  });
});
