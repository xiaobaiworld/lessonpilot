/**
 * 管理员应用状态管理 (Zustand)
 * 职责：adminSession、教师列表、临时密码
 */

import { create } from 'zustand';
import { APIError } from '@v1/web/shared';

export interface AdminSession {
  token: string;
  adminId: string;
  email: string;
  expiresAt: number;
}

export interface Teacher {
  id: string;
  login_name: string;
  display_name: string;
  status: 'active' | 'suspended';
  created_at: string;
  published_course_count: number;
}

export interface AdminStore {
  // Session 状态
  session: AdminSession | null;
  setSession: (session: AdminSession | null) => void;
  isLoggedIn: () => boolean;
  logout: () => void;

  // 教师列表
  teachers: Teacher[];
  setTeachers: (teachers: Teacher[]) => void;
  addTeacher: (teacher: Teacher) => void;

  // 临时密码（仅内存）
  temporaryPassword: string | null;
  setTemporaryPassword: (password: string | null) => void;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  isLoggedIn: () => !!get().session,
  logout: () => {
    set({ session: null, teachers: [], temporaryPassword: null });
  },

  teachers: [],
  setTeachers: (teachers) => set({ teachers }),
  addTeacher: (teacher) => set((state) => ({ teachers: [...state.teachers, teacher] })),

  temporaryPassword: null,
  setTemporaryPassword: (password) => set({ temporaryPassword: password }),
}));
