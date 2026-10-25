import {
  Quiz,
  PublicQuizInfo,
  StudentExamData,
  StudentSubmissionResult,
  Submission,
  QuizAnalytics
} from '../types/quiz';

const ADMIN_PASSCODE_STORAGE_KEY = 'quiz_pro_admin_passcode';

export function getStoredAdminPasscode(): string {
  return localStorage.getItem(ADMIN_PASSCODE_STORAGE_KEY) || '';
}

export function setStoredAdminPasscode(passcode: string) {
  if (passcode) {
    localStorage.setItem(ADMIN_PASSCODE_STORAGE_KEY, passcode);
  } else {
    localStorage.removeItem(ADMIN_PASSCODE_STORAGE_KEY);
  }
}

export function clearStoredAdminPasscode() {
  localStorage.removeItem(ADMIN_PASSCODE_STORAGE_KEY);
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Include admin passcode if available
  const passcode = getStoredAdminPasscode();
  if (passcode && !headers.has('x-admin-passcode')) {
    headers.set('x-admin-passcode', passcode);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `Lỗi hệ thống (${response.status})`;
    const error = new Error(errorMsg) as any;
    error.status = response.status;
    error.code = data.error;
    throw error;
  }

  return data as T;
}

export const api = {
  // System status
  async checkStatus(): Promise<{
    status: string;
    isPasscodeConfigured: boolean;
    totalQuizzes: number;
    totalSubmissions: number;
    serverTime: string;
  }> {
    return apiRequest('/api/status');
  },

  // Admin Passcode
  async setupPasscode(passcode: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/admin/setup-passcode', {
      method: 'POST',
      body: JSON.stringify({ passcode })
    });
  },

  async verifyPasscode(passcode: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/admin/verify-passcode', {
      method: 'POST',
      body: JSON.stringify({ passcode })
    });
  },

  async changePasscode(newPasscode: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/admin/change-passcode', {
      method: 'POST',
      body: JSON.stringify({ newPasscode })
    });
  },

  // Teacher Quizzes
  async getQuizzes(): Promise<{ quizzes: Quiz[] }> {
    return apiRequest('/api/admin/quizzes');
  },

  async getQuiz(id: string): Promise<{ quiz: Quiz }> {
    return apiRequest(`/api/admin/quizzes/${id}`);
  },

  async createQuiz(quiz: Partial<Quiz>): Promise<{ success: boolean; quiz: Quiz }> {
    return apiRequest('/api/admin/quizzes', {
      method: 'POST',
      body: JSON.stringify(quiz)
    });
  },

  async updateQuiz(id: string, quiz: Partial<Quiz>): Promise<{ success: boolean; quiz: Quiz }> {
    return apiRequest(`/api/admin/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(quiz)
    });
  },

  async setQuizStatus(id: string, status: 'draft' | 'active' | 'paused' | 'closed'): Promise<{ success: boolean; status: string }> {
    return apiRequest(`/api/admin/quizzes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteQuiz(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/admin/quizzes/${id}`, {
      method: 'DELETE'
    });
  },

  // Submissions & Monitoring
  async getSubmissions(quizId: string): Promise<{
    quiz: { id: string; title: string; maxScore: number; passThresholdForSolutions: number; status: string; durationMinutes: number };
    submissions: Submission[];
    analytics: QuizAnalytics;
  }> {
    return apiRequest(`/api/admin/quizzes/${quizId}/submissions`);
  },

  async deleteSubmission(quizId: string, submissionId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/admin/quizzes/${quizId}/submissions/${submissionId}`, {
      method: 'DELETE'
    });
  },

  // Public Student Endpoints
  async getStudentQuizInfo(quizId: string): Promise<PublicQuizInfo> {
    return apiRequest(`/api/quiz/${quizId}/info`);
  },

  async startExam(quizId: string, studentName: string, password?: string): Promise<{
    submissionId: string;
    sessionToken: string;
    startedAt: string;
    quiz: StudentExamData;
  }> {
    return apiRequest(`/api/quiz/${quizId}/start`, {
      method: 'POST',
      body: JSON.stringify({ studentName, password })
    });
  },

  async heartbeat(
    quizId: string,
    submissionId: string,
    sessionToken: string,
    answers: Record<string, string>,
    durationSeconds: number
  ): Promise<{ status: string; success?: boolean; isFinished?: boolean }> {
    return apiRequest(`/api/quiz/${quizId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ submissionId, sessionToken, answers, durationSeconds })
    });
  },

  async submitExam(
    quizId: string,
    submissionId: string,
    sessionToken: string,
    answers: Record<string, string>,
    durationSeconds: number
  ): Promise<StudentSubmissionResult> {
    return apiRequest(`/api/quiz/${quizId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ submissionId, sessionToken, answers, durationSeconds })
    });
  },

  async getSubmissionResult(
    quizId: string,
    submissionId: string,
    sessionToken: string
  ): Promise<StudentSubmissionResult> {
    return apiRequest(`/api/quiz/${quizId}/result/${submissionId}?sessionToken=${sessionToken}`);
  }
};
