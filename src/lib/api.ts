import axios from 'axios';
import { firebaseAuth } from '../firebase';
import type { Listing, Load, Job, FinanceRequest, User, SocialLink, ContactNumber, SiteSettings, ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// بيربط التوكن: جلسة Firebase الحالية أولاً (ID Token صالح)، ثم أي توكن مخزن قديم
api.interceptors.request.use(async (config) => {
  try {
    const idToken = firebaseAuth?.currentUser ? await firebaseAuth.currentUser.getIdToken() : localStorage.getItem('tareeq_token');
    if (idToken) {
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch {} // بدون توكن => نكمل، والسيرفر هيقول لو محتاج تسجيل دخول
  return config;
});

// Listings API
export const listingsApi = {
  getAll: (params?: Record<string, string>) => api.get<ApiResponse<Listing[]>>('/listings', { params }),
  getById: (id: string) => api.get<ApiResponse<Listing>>(`/listings/${id}`),
  create: (data: Partial<Listing>) => api.post<ApiResponse<Listing>>('/listings', data),
  update: (id: string, data: Partial<Listing>) => api.put<ApiResponse<Listing>>(`/listings/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/listings/${id}`),
  getFeatured: () => api.get<ApiResponse<Listing[]>>('/listings/featured'),
  getByUser: (userId: string) => api.get<ApiResponse<Listing[]>>(`/listings/user/${userId}`),
};

// Loads API
export const loadsApi = {
  getAll: (params?: Record<string, string>) => api.get<ApiResponse<Load[]>>('/loads', { params }),
  getById: (id: string) => api.get<ApiResponse<Load>>(`/loads/${id}`),
  create: (data: Partial<Load>) => api.post<ApiResponse<Load>>('/loads', data),
  update: (id: string, data: Partial<Load>) => api.put<ApiResponse<Load>>(`/loads/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/loads/${id}`),
};

// Jobs API
export const jobsApi = {
  getAll: (params?: Record<string, string>) => api.get<ApiResponse<Job[]>>('/jobs', { params }),
  getById: (id: string) => api.get<ApiResponse<Job>>(`/jobs/${id}`),
  create: (data: Partial<Job>) => api.post<ApiResponse<Job>>('/jobs', data),
  update: (id: string, data: Partial<Job>) => api.put<ApiResponse<Job>>(`/jobs/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/jobs/${id}`),
};

// Finance API
export const financeApi = {
  getAll: () => api.get<ApiResponse<FinanceRequest[]>>('/finance'),
  create: (data: Partial<FinanceRequest>) => api.post<ApiResponse<FinanceRequest>>('/finance', data),
  update: (id: string, data: Partial<FinanceRequest>) => api.put<ApiResponse<FinanceRequest>>(`/finance/${id}`, data),
};

// Auth API
export const authApi = {
  register: (data: Partial<User> & { password: string }) => api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', data),
  me: () => api.get<ApiResponse<User>>('/auth/me'),
};

// Admin API
export const adminApi = {
  getStats: () => api.get<ApiResponse<Record<string, number>>>('/admin/stats'),
  getUsers: () => api.get<ApiResponse<User[]>>('/admin/users'),
  updateUser: (id: string, data: Partial<User>) => api.put<ApiResponse<User>>(`/admin/users/${id}`, data),
  approveListing: (id: string) => api.put<ApiResponse<Listing>>(`/admin/listings/${id}/approve`, {}),
  rejectListing: (id: string) => api.put<ApiResponse<Listing>>(`/admin/listings/${id}/reject`, {}),
};

// Social Links API
export const socialLinksApi = {
  getAll: (activeOnly = true) => api.get<ApiResponse<SocialLink[]>>(`/social-links${activeOnly ? '' : '?active=false'}`),
  create: (data: Partial<SocialLink>) => api.post<ApiResponse<SocialLink>>('/social-links', data),
  update: (id: string, data: Partial<SocialLink>) => api.put<ApiResponse<SocialLink>>(`/social-links/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/social-links/${id}`),
};

// Contact Numbers API
export const contactNumbersApi = {
  getAll: (activeOnly = true) => api.get<ApiResponse<ContactNumber[]>>(`/contact-numbers${activeOnly ? '' : '?active=false'}`),
  create: (data: Partial<ContactNumber>) => api.post<ApiResponse<ContactNumber>>('/contact-numbers', data),
  update: (id: string, data: Partial<ContactNumber>) => api.put<ApiResponse<ContactNumber>>(`/contact-numbers/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/contact-numbers/${id}`),
};

// Site Settings API
export const siteSettingsApi = {
  getAll: () => api.get<ApiResponse<SiteSettings>>('/site-settings'),
  set: (key: string, value: string) => api.put<ApiResponse<{ key: string; value: string }>>('/site-settings', { key, value }),
};

export default api;
