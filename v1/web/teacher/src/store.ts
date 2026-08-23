/**
 * 教师应用状态管理 (Zustand)
 */

import { create } from 'zustand';

export interface TeacherSession {
  token: string;
  teacherId: string;
  loginName: string;
  expiresAt: number;
}

export interface Lesson {
  id: string;
  course_id: string;
  sequence: number;
  title: string;
  node_count: number;
}

export interface Course {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  published_count: number;
  lessons: Lesson[];
}

export interface TeacherStore {
  // Session
  session: TeacherSession | null;
  setSession: (session: TeacherSession | null) => void;
  isLoggedIn: () => boolean;
  logout: () => void;

  // Courses
  courses: Course[];
  setCourses: (courses: Course[]) => void;
  addCourse: (course: Course) => void;
  updateCourse: (course: Course) => void;

  // Current selection
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;

  // Draft state
  unsavedChanges: boolean;
  setUnsavedChanges: (changed: boolean) => void;
}

export const useTeacherStore = create<TeacherStore>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  isLoggedIn: () => !!get().session,
  logout: () => {
    set({
      session: null,
      courses: [],
      selectedCourseId: null,
      unsavedChanges: false,
    });
  },

  courses: [],
  setCourses: (courses) => set({ courses }),
  addCourse: (course) => set((state) => ({ courses: [...state.courses, course] })),
  updateCourse: (course) =>
    set((state) => ({
      courses: state.courses.map((c) => (c.id === course.id ? course : c)),
    })),

  selectedCourseId: null,
  setSelectedCourseId: (id) => set({ selectedCourseId: id }),

  unsavedChanges: false,
  setUnsavedChanges: (changed) => set({ unsavedChanges: changed }),
}));
