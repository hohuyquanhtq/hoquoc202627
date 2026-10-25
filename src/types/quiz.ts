export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D'
  label: string; // 'A', 'B', 'C', 'D'
  text: string;
  html?: string;
}

export interface Question {
  id: string;
  order: number;
  questionText: string;
  questionHtml?: string;
  options: QuestionOption[];
  correctAnswer: string; // 'A', 'B', 'C', 'D' - Keep secret from student!
  solution?: string;     // Secret from student until threshold met
  points: number;
  hasWarning?: boolean;
  warningReason?: string;
}

export interface QuizSettings {
  title: string;
  description: string;
  hasPassword: boolean;
  password?: string;
  durationMinutes: number; // in minutes, 0 means no time limit
  maxAttempts: number;
  maxScore: number;
  scoringMode: 'equal' | 'custom';
  passThresholdForSolutions: number; // e.g. 8.0/10 to unlock solutions
  showScoreAfterSubmit: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  status: 'draft' | 'active' | 'paused' | 'closed';
}

export interface Quiz extends QuizSettings {
  id: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
}

// Public quiz info for student before starting
export interface PublicQuizInfo {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  totalQuestions: number;
  maxScore: number;
  hasPassword: boolean;
  status: 'draft' | 'active' | 'paused' | 'closed';
  openTime?: string | null;
  closeTime?: string | null;
  passThresholdForSolutions: number;
}

// Student question view (strictly without correctAnswer or solution!)
export interface StudentQuestion {
  id: string;
  order: number;
  questionText: string;
  questionHtml?: string;
  options: { id: string; label: string; text: string; html?: string }[];
  points: number;
}

export interface StudentExamData {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  maxScore: number;
  questions: StudentQuestion[];
}

export interface SubmissionDetail {
  questionId: string;
  questionText: string;
  chosen: string;
  correct: string;
  isCorrect: boolean;
  pointsEarned: number;
  maxPoints: number;
  solution?: string;
}

export interface Submission {
  id: string;
  quizId: string;
  studentName: string;
  sessionToken: string;
  startedAt: string;
  submittedAt?: string;
  lastHeartbeatAt: string;
  durationSeconds: number;
  status: 'in_progress' | 'submitted' | 'timeout' | 'interrupted';
  answers: Record<string, string>; // questionId -> chosen label e.g. "A"
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  passedThreshold: boolean;
  details?: SubmissionDetail[];
}

export interface StudentSubmissionResult {
  submissionId: string;
  studentName: string;
  status: 'submitted' | 'timeout';
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  passedThreshold: boolean;
  passThreshold: number;
  solutionsUnlocked: boolean;
  showScore: boolean;
  // Included only when solutionsUnlocked is true
  review?: {
    questions: Array<{
      id: string;
      order: number;
      questionText: string;
      options: { id: string; label: string; text: string }[];
      chosen: string;
      correctAnswer: string;
      isCorrect: boolean;
      solution?: string;
      pointsEarned: number;
      maxPoints: number;
    }>;
  };
}

export interface QuizAnalytics {
  totalSubmissions: number;
  inProgressCount: number;
  submittedCount: number;
  unsubmittedCount: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passedThresholdCount: number;
  scoreDistribution: {
    range: string;
    count: number;
  }[];
}
