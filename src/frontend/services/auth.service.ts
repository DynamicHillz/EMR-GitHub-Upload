/**
 * Authentication & User Management Service
 * Handles all API calls for authentication and user management
 */

import axios, { AxiosInstance } from 'axios';
import {
  LoginDto,
  LoginResponse,
  RegisterDto,
  RegisterResponse,
  ForgotPasswordDto,
  ForgotPasswordResponse,
  ResetPasswordDto,
  ResetPasswordResponse,
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
  User,
  UserFilters,
  ListUsersResponse,
  SuspendUserDto,
  ApiResponse,
} from '../types/auth.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

class AuthService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear auth and redirect to login
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // ============= Token Management =============

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token);
  }

  clearAuth(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  setCurrentUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // ============= Authentication Endpoints =============

  async login(data: LoginDto): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/auth/login', data);

    if (response.data.token) {
      this.setToken(response.data.token);
      if (response.data.refreshToken) {
        this.setRefreshToken(response.data.refreshToken);
      }
      if (response.data.user) {
        this.setCurrentUser(response.data.user as any);
      }
    }

    return response.data;
  }

  async register(data: RegisterDto): Promise<RegisterResponse> {
    const response = await this.api.post<RegisterResponse>('/auth/register', data);

    if (response.data.token) {
      this.setToken(response.data.token);
      if (response.data.refreshToken) {
        this.setRefreshToken(response.data.refreshToken);
      }
      if (response.data.user) {
        this.setCurrentUser(response.data.user);
      }
    }

    return response.data;
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();

    try {
      await this.api.post('/auth/logout', { refreshToken });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const response = await this.api.post<ForgotPasswordResponse>('/auth/forgot-password', data);
    return response.data;
  }

  async resetPassword(data: ResetPasswordDto): Promise<ResetPasswordResponse> {
    const response = await this.api.post<ResetPasswordResponse>('/auth/reset-password', data);
    return response.data;
  }

  async refreshToken(): Promise<{ token: string; refreshToken: string }> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.api.post<{ token: string; refreshToken: string }>(
      '/auth/refresh-token',
      { refreshToken }
    );

    if (response.data.token) {
      this.setToken(response.data.token);
      if (response.data.refreshToken) {
        this.setRefreshToken(response.data.refreshToken);
      }
    }

    return response.data;
  }

  // ============= User Management Endpoints =============

  async getUsers(filters?: UserFilters): Promise<ListUsersResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
    }

    const response = await this.api.get<ListUsersResponse>(`/users?${params.toString()}`);
    return response.data;
  }

  async getUser(id: string): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.get<ApiResponse<{ user: User }>>(`/users/${id}`);
    return response.data;
  }

  async createUser(data: CreateUserDto): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.post<ApiResponse<{ user: User }>>('/users', data);
    return response.data;
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<ApiResponse<{ user: User }>> {
    const response = await this.api.put<ApiResponse<{ user: User }>>(`/users/${id}`, data);
    return response.data;
  }

  async deactivateUser(id: string): Promise<ApiResponse> {
    const response = await this.api.post<ApiResponse>(`/users/${id}/deactivate`);
    return response.data;
  }

  async suspendUser(id: string, data?: SuspendUserDto): Promise<ApiResponse> {
    const response = await this.api.post<ApiResponse>(`/users/${id}/suspend`, data);
    return response.data;
  }

  async reactivateUser(id: string): Promise<ApiResponse> {
    const response = await this.api.post<ApiResponse>(`/users/${id}/reactivate`);
    return response.data;
  }

  async changePassword(data: ChangePasswordDto): Promise<ApiResponse> {
    const response = await this.api.post<ApiResponse>('/users/change-password', data);
    return response.data;
  }
}

export const authService = new AuthService();
export default authService;
