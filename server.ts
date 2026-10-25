import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Quiz, Submission, SubmissionDetail } from './src/types/quiz';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -----------------------------------------------------------------------------
// Database & Storage
// -----------------------------------------------------------------------------
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'quiz_pro_db.json');

interface DatabaseSchema {
  adminPasscodeHash: string | null;
  quizzes: Quiz[];
  submissions: Submission[];
  updatedAt: string;
}

function initDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(content);
      return {
        adminPasscodeHash: data.adminPasscodeHash || null,
        quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
        submissions: Array.isArray(data.submissions) ? data.submissions : [],
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    } catch (e) {
      console.error('Error reading db file, reinitializing fallback:', e);
    }
  }

  const initialData: DatabaseSchema = {
    adminPasscodeHash: null, // Teacher will set up on first entry
    quizzes: [],
    submissions: [],
    updatedAt: new Date().toISOString()
  };

  saveDatabase(initialData);
  return initialData;
}

let db = initDatabase();

function saveDatabase(data: DatabaseSchema) {
  try {
    data.updatedAt = new Date().toISOString();
    // Atomic write using temporary file to avoid corruption
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

function hashString(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

// -----------------------------------------------------------------------------
// Admin Middleware & Auth Verification
// -----------------------------------------------------------------------------
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const passcode = req.headers['x-admin-passcode'] as string;

  if (!db.adminPasscodeHash) {
    return res.status(403).json({
      error: 'passcode_not_set',
      message: 'Chưa thiết lập mã quản trị. Vui lòng thiết lập mã quản trị trước.'
    });
  }

  if (!passcode) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Thiếu mã quản trị.'
    });
  }

  const hashed = hashString(passcode.trim());
  if (hashed !== db.adminPasscodeHash) {
    return res.status(403).json({
      error: 'invalid_passcode',
      message: 'Mã quản trị không đúng.'
    });
  }

  next();
}

// -----------------------------------------------------------------------------
// API Routes: System & Admin Passcode Management
// -----------------------------------------------------------------------------

// Check system status & whether admin passcode has been created
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'online',
    isPasscodeConfigured: Boolean(db.adminPasscodeHash),
    totalQuizzes: db.quizzes.length,
    totalSubmissions: db.submissions.length,
    serverTime: new Date().toISOString()
  });
});

// Setup admin passcode for the first time
app.post('/api/admin/setup-passcode', (req, res) => {
  const { passcode } = req.body;
  if (!passcode || typeof passcode !== 'string' || passcode.trim().length < 4) {
    return res.status(400).json({ error: 'Mã quản trị phải có ít nhất 4 ký tự.' });
  }

  if (db.adminPasscodeHash) {
    return res.status(400).json({ error: 'Mã quản trị đã được thiết lập từ trước.' });
  }

  db.adminPasscodeHash = hashString(passcode.trim());
  saveDatabase(db);

  res.json({ success: true, message: 'Thiết lập mã quản trị thành công.' });
});

// Verify passcode
app.post('/api/admin/verify-passcode', (req, res) => {
  const { passcode } = req.body;
  if (!passcode || typeof passcode !== 'string') {
    return res.status(400).json({ error: 'Vui lòng nhập mã quản trị.' });
  }

  if (!db.adminPasscodeHash) {
    return res.status(403).json({
      error: 'passcode_not_set',
      message: 'Mã quản trị chưa được thiết lập.'
    });
  }

  const isValid = hashString(passcode.trim()) === db.adminPasscodeHash;
  if (!isValid) {
    return res.status(401).json({ error: 'Mã quản trị không chính xác.' });
  }

  res.json({ success: true, message: 'Xác thực thành công.' });
});

// Change passcode (requires old passcode)
app.post('/api/admin/change-passcode', requireAdmin, (req, res) => {
  const { newPasscode } = req.body;
  if (!newPasscode || typeof newPasscode !== 'string' || newPasscode.trim().length < 4) {
    return res.status(400).json({ error: 'Mã mới phải có ít nhất 4 ký tự.' });
  }

  db.adminPasscodeHash = hashString(newPasscode.trim());
  saveDatabase(db);
  res.json({ success: true, message: 'Đổi mã quản trị thành công.' });
});

// -----------------------------------------------------------------------------
// API Routes: Teacher Quiz Management (Protected by requireAdmin)
// -----------------------------------------------------------------------------

// Get list of quizzes for teacher
app.get('/api/admin/quizzes', requireAdmin, (_req, res) => {
  // Return quizzes with submission counts
  const quizzesWithCounts = db.quizzes.map(q => {
    const subs = db.submissions.filter(s => s.quizId === q.id);
    return {
      ...q,
      submissionCount: subs.length,
      password: q.password ? '******' : '' // Mask actual password in list
    };
  });

  res.json({ quizzes: quizzesWithCounts });
});

// Get single quiz full details for teacher (with true answers and solutions)
app.get('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const quiz = db.quizzes.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
  }
  res.json({ quiz });
});

// Create new quiz
app.post('/api/admin/quizzes', requireAdmin, (req, res) => {
  const quizData = req.body;

  if (!quizData.title || typeof quizData.title !== 'string') {
    return res.status(400).json({ error: 'Vui lòng nhập tên bài thi.' });
  }

  if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
    return res.status(400).json({ error: 'Đề thi phải có ít nhất 1 câu hỏi.' });
  }

  const now = new Date().toISOString();
  const newQuiz: Quiz = {
    id: `quiz_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    title: quizData.title.trim(),
    description: (quizData.description || '').trim(),
    hasPassword: Boolean(quizData.hasPassword),
    password: quizData.hasPassword && quizData.password ? quizData.password.trim() : '',
    durationMinutes: Math.max(0, parseInt(quizData.durationMinutes || 0, 10)),
    maxAttempts: Math.max(1, parseInt(quizData.maxAttempts || 1, 10)),
    maxScore: parseFloat(quizData.maxScore) || 10,
    scoringMode: quizData.scoringMode === 'custom' ? 'custom' : 'equal',
    passThresholdForSolutions: parseFloat(quizData.passThresholdForSolutions) || 8.0,
    showScoreAfterSubmit: quizData.showScoreAfterSubmit !== false,
    openTime: quizData.openTime || null,
    closeTime: quizData.closeTime || null,
    status: ['draft', 'active', 'paused', 'closed'].includes(quizData.status) ? quizData.status : 'active',
    questions: quizData.questions.map((q: any, idx: number) => ({
      id: q.id || `q_${idx + 1}_${Date.now()}`,
      order: idx + 1,
      questionText: q.questionText || '',
      questionHtml: q.questionHtml,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: (q.correctAnswer || '').toUpperCase(),
      solution: q.solution || '',
      points: parseFloat(q.points) || (quizData.scoringMode === 'custom' ? 1 : 10 / quizData.questions.length),
      hasWarning: Boolean(q.hasWarning),
      warningReason: q.warningReason
    })),
    createdAt: now,
    updatedAt: now
  };

  db.quizzes.unshift(newQuiz);
  saveDatabase(db);

  res.status(201).json({ success: true, quiz: newQuiz });
});

// Update existing quiz
app.put('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const quizIndex = db.quizzes.findIndex(q => q.id === req.params.id);
  if (quizIndex === -1) {
    return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
  }

  const quizData = req.body;
  const existing = db.quizzes[quizIndex];

  const updatedQuiz: Quiz = {
    ...existing,
    title: quizData.title ? quizData.title.trim() : existing.title,
    description: quizData.description !== undefined ? quizData.description.trim() : existing.description,
    hasPassword: Boolean(quizData.hasPassword),
    password: quizData.hasPassword && quizData.password ? quizData.password.trim() : existing.password,
    durationMinutes: quizData.durationMinutes !== undefined ? Math.max(0, parseInt(quizData.durationMinutes, 10)) : existing.durationMinutes,
    maxAttempts: quizData.maxAttempts !== undefined ? Math.max(1, parseInt(quizData.maxAttempts, 10)) : existing.maxAttempts,
    maxScore: quizData.maxScore !== undefined ? parseFloat(quizData.maxScore) : existing.maxScore,
    scoringMode: quizData.scoringMode || existing.scoringMode,
    passThresholdForSolutions: quizData.passThresholdForSolutions !== undefined ? parseFloat(quizData.passThresholdForSolutions) : existing.passThresholdForSolutions,
    showScoreAfterSubmit: quizData.showScoreAfterSubmit !== undefined ? Boolean(quizData.showScoreAfterSubmit) : existing.showScoreAfterSubmit,
    openTime: quizData.openTime !== undefined ? quizData.openTime : existing.openTime,
    closeTime: quizData.closeTime !== undefined ? quizData.closeTime : existing.closeTime,
    status: quizData.status || existing.status,
    questions: Array.isArray(quizData.questions)
      ? quizData.questions.map((q: any, idx: number) => ({
          id: q.id || `q_${idx + 1}_${Date.now()}`,
          order: idx + 1,
          questionText: q.questionText || '',
          questionHtml: q.questionHtml,
          options: Array.isArray(q.options) ? q.options : [],
          correctAnswer: (q.correctAnswer || '').toUpperCase(),
          solution: q.solution || '',
          points: parseFloat(q.points) || 1,
          hasWarning: Boolean(q.hasWarning),
          warningReason: q.warningReason
        }))
      : existing.questions,
    updatedAt: new Date().toISOString()
  };

  db.quizzes[quizIndex] = updatedQuiz;
  saveDatabase(db);

  res.json({ success: true, quiz: updatedQuiz });
});

// Update quiz status (draft, active, paused, closed)
app.patch('/api/admin/quizzes/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['draft', 'active', 'paused', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  }

  const quiz = db.quizzes.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
  }

  quiz.status = status;
  quiz.updatedAt = new Date().toISOString();
  saveDatabase(db);

  res.json({ success: true, status: quiz.status });
});

// Delete quiz and its submissions
app.delete('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const quizId = req.params.id;
  const initialLen = db.quizzes.length;
  db.quizzes = db.quizzes.filter(q => q.id !== quizId);

  if (db.quizzes.length === initialLen) {
    return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
  }

  // Also remove associated submissions
  db.submissions = db.submissions.filter(s => s.quizId !== quizId);
  saveDatabase(db);

  res.json({ success: true, message: 'Đã xóa đề thi và toàn bộ bài nộp liên quan.' });
});

// Get submissions & analytics for a quiz
app.get('/api/admin/quizzes/:id/submissions', requireAdmin, (req, res) => {
  const quiz = db.quizzes.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
  }

  const submissions = db.submissions.filter(s => s.quizId === req.params.id);

  // Compute analytics
  const submittedSubs = submissions.filter(s => s.status === 'submitted' || s.status === 'timeout');
  const inProgressSubs = submissions.filter(s => s.status === 'in_progress');

  let avgScore = 0;
  let highestScore = 0;
  let lowestScore = quiz.maxScore;
  let passedCount = 0;

  if (submittedSubs.length > 0) {
    const scores = submittedSubs.map(s => s.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    avgScore = Math.round((sum / submittedSubs.length) * 100) / 100;
    highestScore = Math.max(...scores);
    lowestScore = Math.min(...scores);
    passedCount = submittedSubs.filter(s => s.passedThreshold).length;
  } else {
    lowestScore = 0;
  }

  // Score distribution brackets (0-2, 2-4, 4-6, 6-8, 8-10)
  const scoreDistribution = [
    { range: '0 - < 2', count: submittedSubs.filter(s => s.score < 2).length },
    { range: '2 - < 4', count: submittedSubs.filter(s => s.score >= 2 && s.score < 4).length },
    { range: '4 - < 6', count: submittedSubs.filter(s => s.score >= 4 && s.score < 6).length },
    { range: '6 - < 8', count: submittedSubs.filter(s => s.score >= 6 && s.score < 8).length },
    { range: '8 - 10', count: submittedSubs.filter(s => s.score >= 8).length }
  ];

  res.json({
    quiz: {
      id: quiz.id,
      title: quiz.title,
      maxScore: quiz.maxScore,
      passThresholdForSolutions: quiz.passThresholdForSolutions,
      status: quiz.status,
      durationMinutes: quiz.durationMinutes
    },
    submissions,
    analytics: {
      totalSubmissions: submissions.length,
      inProgressCount: inProgressSubs.length,
      submittedCount: submittedSubs.length,
      unsubmittedCount: inProgressSubs.length,
      averageScore: avgScore,
      highestScore,
      lowestScore,
      passedThresholdCount: passedCount,
      scoreDistribution
    }
  });
});

// Delete a submission
app.delete('/api/admin/quizzes/:id/submissions/:submissionId', requireAdmin, (req, res) => {
  const { submissionId } = req.params;
  const initialLen = db.submissions.length;
  db.submissions = db.submissions.filter(s => s.id !== submissionId);

  if (db.submissions.length === initialLen) {
    return res.status(404).json({ error: 'Không tìm thấy lượt làm bài.' });
  }

  saveDatabase(db);
  res.json({ success: true, message: 'Đã xóa lượt làm bài.' });
});

// -----------------------------------------------------------------------------
// API Routes: Public Student Exam (Zero Account, Strictly Secure)
// -----------------------------------------------------------------------------

// 1. Get basic info of quiz (No questions, no answers)
app.get('/api/quiz/:id/info', (req, res) => {
  const quiz = db.quizzes.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  }

  res.json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    durationMinutes: quiz.durationMinutes,
    totalQuestions: quiz.questions.length,
    maxScore: quiz.maxScore,
    hasPassword: Boolean(quiz.hasPassword && quiz.password),
    status: quiz.status,
    openTime: quiz.openTime,
    closeTime: quiz.closeTime,
    passThresholdForSolutions: quiz.passThresholdForSolutions
  });
});

// 2. Student starts exam -> returns questions WITHOUT correct answers or solutions!
app.post('/api/quiz/:id/start', (req, res) => {
  const { studentName, password } = req.body;
  const quiz = db.quizzes.find(q => q.id === req.params.id);

  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  }

  if (quiz.status !== 'active') {
    let msg = 'Bài thi hiện không mở nhận bài.';
    if (quiz.status === 'paused') msg = 'Bài thi đang tạm dừng.';
    if (quiz.status === 'closed') msg = 'Bài thi đã kết thúc.';
    if (quiz.status === 'draft') msg = 'Bài thi chưa được phát hành.';
    return res.status(403).json({ error: msg });
  }

  // Check start and end time if specified
  const nowTime = new Date();
  if (quiz.openTime && new Date(quiz.openTime) > nowTime) {
    return res.status(403).json({ error: `Bài thi chưa đến giờ mở. Thời gian mở: ${new Date(quiz.openTime).toLocaleString('vi-VN')}` });
  }
  if (quiz.closeTime && new Date(quiz.closeTime) < nowTime) {
    return res.status(403).json({ error: `Bài thi đã hết thời gian nhận bài vào lúc: ${new Date(quiz.closeTime).toLocaleString('vi-VN')}` });
  }

  // Check password if set
  if (quiz.hasPassword && quiz.password) {
    if (!password || password.trim() !== quiz.password.trim()) {
      return res.status(401).json({ error: 'Mật khẩu bài thi không đúng.' });
    }
  }

  const cleanName = (studentName || '').trim();
  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Vui lòng nhập họ và tên của bạn (tối thiểu 2 ký tự).' });
  }

  // Check attempts restriction if maxAttempts === 1
  if (quiz.maxAttempts === 1) {
    const existing = db.submissions.find(
      s => s.quizId === quiz.id &&
           s.studentName.toLowerCase() === cleanName.toLowerCase() &&
           (s.status === 'submitted' || s.status === 'timeout')
    );
    if (existing) {
      return res.status(403).json({
        error: `Học sinh "${cleanName}" đã hoàn thành bài thi này trước đó (Đạt ${existing.score}/${existing.maxScore} điểm). Mỗi học sinh chỉ được làm 1 lần.`
      });
    }
  }

  // Create submission record
  const sessionToken = crypto.randomBytes(16).toString('hex');
  const submissionId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const newSubmission: Submission = {
    id: submissionId,
    quizId: quiz.id,
    studentName: cleanName,
    sessionToken,
    startedAt: nowIso,
    lastHeartbeatAt: nowIso,
    durationSeconds: 0,
    status: 'in_progress',
    answers: {},
    score: 0,
    maxScore: quiz.maxScore,
    correctCount: 0,
    totalQuestions: quiz.questions.length,
    passedThreshold: false
  };

  db.submissions.unshift(newSubmission);
  saveDatabase(db);

  // Return questions with NO ANSWERS and NO SOLUTIONS
  const safeQuestions = quiz.questions.map(q => ({
    id: q.id,
    order: q.order,
    questionText: q.questionText,
    questionHtml: q.questionHtml,
    points: q.points,
    options: q.options.map(opt => ({
      id: opt.id,
      label: opt.label,
      text: opt.text,
      html: opt.html
    }))
  }));

  res.json({
    submissionId,
    sessionToken,
    startedAt: nowIso,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes,
      maxScore: quiz.maxScore,
      questions: safeQuestions
    }
  });
});

// 3. Heartbeat / Auto-save in-progress answers
app.post('/api/quiz/:id/heartbeat', (req, res) => {
  const { submissionId, sessionToken, answers, durationSeconds } = req.body;
  const sub = db.submissions.find(s => s.id === submissionId && s.sessionToken === sessionToken);

  if (!sub) {
    return res.status(404).json({ error: 'Không tìm thấy phiên làm bài.' });
  }

  if (sub.status === 'submitted' || sub.status === 'timeout') {
    return res.json({ status: sub.status, isFinished: true });
  }

  sub.lastHeartbeatAt = new Date().toISOString();
  if (answers && typeof answers === 'object') {
    sub.answers = { ...sub.answers, ...answers };
  }
  if (typeof durationSeconds === 'number') {
    sub.durationSeconds = durationSeconds;
  }

  saveDatabase(db);
  res.json({ status: sub.status, success: true });
});

// 4. Student submits quiz -> Server grades authoritative score
app.post('/api/quiz/:id/submit', (req, res) => {
  const { submissionId, sessionToken, answers, durationSeconds } = req.body;
  const quiz = db.quizzes.find(q => q.id === req.params.id);

  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  }

  const sub = db.submissions.find(s => s.id === submissionId && s.sessionToken === sessionToken);
  if (!sub) {
    return res.status(404).json({ error: 'Không tìm thấy thông tin lượt làm bài.' });
  }

  if (sub.status === 'submitted' || sub.status === 'timeout') {
    return res.status(400).json({ error: 'Bài thi đã được nộp trước đó.' });
  }

  const submittedAnswers: Record<string, string> = answers || sub.answers || {};
  const nowIso = new Date().toISOString();

  // Authoritative server-side grading
  let totalScoreEarned = 0;
  let correctCount = 0;
  const details: SubmissionDetail[] = [];

  // Determine points per question
  const isCustomScoring = quiz.scoringMode === 'custom';
  const defaultEqualPoints = quiz.questions.length > 0 ? quiz.maxScore / quiz.questions.length : 0;

  quiz.questions.forEach(q => {
    const qPoints = isCustomScoring ? (q.points || 1) : defaultEqualPoints;
    const chosen = (submittedAnswers[q.id] || '').trim().toUpperCase();
    const correct = (q.correctAnswer || '').trim().toUpperCase();
    const isCorrect = Boolean(chosen && correct && chosen === correct);

    const pointsEarned = isCorrect ? qPoints : 0;
    if (isCorrect) {
      correctCount++;
      totalScoreEarned += pointsEarned;
    }

    details.push({
      questionId: q.id,
      questionText: q.questionText,
      chosen,
      correct,
      isCorrect,
      pointsEarned,
      maxPoints: qPoints,
      solution: q.solution || ''
    });
  });

  // Round score to 2 decimal places
  const finalScore = Math.round(totalScoreEarned * 100) / 100;
  const passedThreshold = finalScore >= (quiz.passThresholdForSolutions || 0);

  sub.status = 'submitted';
  sub.submittedAt = nowIso;
  sub.answers = submittedAnswers;
  sub.score = finalScore;
  sub.maxScore = quiz.maxScore;
  sub.correctCount = correctCount;
  sub.totalQuestions = quiz.questions.length;
  sub.durationSeconds = typeof durationSeconds === 'number' ? durationSeconds : Math.round((new Date(nowIso).getTime() - new Date(sub.startedAt).getTime()) / 1000);
  sub.passedThreshold = passedThreshold;
  sub.details = details;

  saveDatabase(db);

  // Prepare result response
  const responseData: any = {
    submissionId: sub.id,
    studentName: sub.studentName,
    status: sub.status,
    score: quiz.showScoreAfterSubmit ? sub.score : null,
    maxScore: sub.maxScore,
    correctCount: quiz.showScoreAfterSubmit ? sub.correctCount : null,
    totalQuestions: sub.totalQuestions,
    durationSeconds: sub.durationSeconds,
    passedThreshold,
    passThreshold: quiz.passThresholdForSolutions,
    solutionsUnlocked: passedThreshold,
    showScore: quiz.showScoreAfterSubmit
  };

  // ONLY send solutions and correct answers IF student passed threshold!
  if (passedThreshold) {
    responseData.review = {
      questions: quiz.questions.map(q => {
        const d = details.find(item => item.questionId === q.id);
        return {
          id: q.id,
          order: q.order,
          questionText: q.questionText,
          options: q.options,
          chosen: d ? d.chosen : '',
          correctAnswer: q.correctAnswer,
          isCorrect: d ? d.isCorrect : false,
          solution: q.solution,
          pointsEarned: d ? d.pointsEarned : 0,
          maxPoints: d ? d.maxPoints : 0
        };
      })
    };
  }

  res.json(responseData);
});

// 5. Get review / result for a finished submission (e.g. on page refresh)
app.get('/api/quiz/:id/result/:submissionId', (req, res) => {
  const { sessionToken } = req.query;
  const quiz = db.quizzes.find(q => q.id === req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bài thi.' });
  }

  const sub = db.submissions.find(s => s.id === req.params.submissionId && s.sessionToken === sessionToken);
  if (!sub) {
    return res.status(404).json({ error: 'Không tìm thấy lượt làm bài hoặc phiên không hợp lệ.' });
  }

  if (sub.status !== 'submitted' && sub.status !== 'timeout') {
    return res.status(400).json({ error: 'Bài thi chưa được nộp.' });
  }

  const responseData: any = {
    submissionId: sub.id,
    studentName: sub.studentName,
    status: sub.status,
    score: quiz.showScoreAfterSubmit ? sub.score : null,
    maxScore: sub.maxScore,
    correctCount: quiz.showScoreAfterSubmit ? sub.correctCount : null,
    totalQuestions: sub.totalQuestions,
    durationSeconds: sub.durationSeconds,
    passedThreshold: sub.passedThreshold,
    passThreshold: quiz.passThresholdForSolutions,
    solutionsUnlocked: sub.passedThreshold,
    showScore: quiz.showScoreAfterSubmit
  };

  // Only attach review details if passed threshold
  if (sub.passedThreshold && sub.details) {
    responseData.review = {
      questions: quiz.questions.map(q => {
        const d = sub.details?.find(item => item.questionId === q.id);
        return {
          id: q.id,
          order: q.order,
          questionText: q.questionText,
          options: q.options,
          chosen: d ? d.chosen : '',
          correctAnswer: q.correctAnswer,
          isCorrect: d ? d.isCorrect : false,
          solution: q.solution,
          pointsEarned: d ? d.pointsEarned : 0,
          maxPoints: d ? d.maxPoints : 0
        };
      })
    };
  }

  res.json(responseData);
});

// -----------------------------------------------------------------------------
// Vite Middleware (Dev) or Static File Serving (Prod)
// -----------------------------------------------------------------------------
async function setupServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QUIZ PRO Server running on http://localhost:${PORT} (${isProduction ? 'Production' : 'Development'})`);
  });
}

setupServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
