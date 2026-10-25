import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  BookOpen,
  Lock,
  User,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  Award,
  RefreshCw,
  Home,
  Check,
  X
} from 'lucide-react';
import {
  PublicQuizInfo,
  StudentExamData,
  StudentSubmissionResult
} from '../types/quiz';
import { api } from '../api/client';

interface Props {
  quizId: string;
  onExitToHome?: () => void;
}

export const StudentExamView: React.FC<Props> = ({ quizId, onExitToHome }) => {
  // Screens: 'info' -> 'taking' -> 'result'
  const [screen, setScreen] = useState<'info' | 'taking' | 'result'>('info');

  // Info state
  const [quizInfo, setQuizInfo] = useState<PublicQuizInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Form input
  const [studentName, setStudentName] = useState('');
  const [password, setPassword] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [startLoading, setStartLoading] = useState(false);

  // Active exam state
  const [examData, setExamData] = useState<StudentExamData | null>(null);
  const [submissionId, setSubmissionId] = useState<string>('');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [durationElapsed, setDurationElapsed] = useState<number>(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Result state
  const [result, setResult] = useState<StudentSubmissionResult | null>(null);

  // Local storage backup key for recovery
  const localBackupKey = `exam_state_${quizId}`;

  // 1. Fetch public quiz info on load
  useEffect(() => {
    let isMounted = true;
    async function loadInfo() {
      setLoadingInfo(true);
      setInfoError(null);
      try {
        const info = await api.getStudentQuizInfo(quizId);
        if (isMounted) {
          setQuizInfo(info);
          // Check if there is an existing ongoing session saved in localStorage
          const savedSession = localStorage.getItem(localBackupKey);
          if (savedSession) {
            try {
              const parsed = JSON.parse(savedSession);
              if (parsed.submissionId && parsed.sessionToken && parsed.examData) {
                // Restore state
                setSubmissionId(parsed.submissionId);
                setSessionToken(parsed.sessionToken);
                setExamData(parsed.examData);
                setAnswers(parsed.answers || {});
                setStudentName(parsed.studentName || '');
                setRemainingSeconds(parsed.remainingSeconds || (info.durationMinutes * 60));
                setDurationElapsed(parsed.durationElapsed || 0);
                setScreen('taking');
              }
            } catch (e) {
              console.error('Error recovering session:', e);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setInfoError(err.message || 'Không thể tải thông tin đề thi.');
        }
      } finally {
        if (isMounted) setLoadingInfo(false);
      }
    }

    loadInfo();
    return () => {
      isMounted = false;
    };
  }, [quizId]);

  // 2. Countdown timer and Heartbeat during 'taking' screen
  useEffect(() => {
    if (screen !== 'taking' || !examData) return;

    const timer = setInterval(() => {
      setDurationElapsed(prev => prev + 1);

      if (examData.durationMinutes > 0) {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmitOnTimeout();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    // Periodic heartbeat every 15s to sync answers to server
    const heartbeatTimer = setInterval(() => {
      if (submissionId && sessionToken) {
        api.heartbeat(quizId, submissionId, sessionToken, answers, durationElapsed).catch(() => {});
      }
    }, 15000);

    // Save state to localStorage for refresh recovery
    localStorage.setItem(
      localBackupKey,
      JSON.stringify({
        submissionId,
        sessionToken,
        examData,
        answers,
        studentName,
        remainingSeconds,
        durationElapsed
      })
    );

    return () => {
      clearInterval(timer);
      clearInterval(heartbeatTimer);
    };
  }, [screen, examData, remainingSeconds, durationElapsed, answers]);

  // Start exam handler
  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartError(null);

    if (!studentName.trim() || studentName.trim().length < 2) {
      setStartError('Vui lòng nhập họ và tên của bạn (ít nhất 2 ký tự).');
      return;
    }

    if (quizInfo?.hasPassword && !password.trim()) {
      setStartError('Vui lòng nhập mật khẩu bài thi.');
      return;
    }

    setStartLoading(true);
    try {
      const res = await api.startExam(quizId, studentName.trim(), password.trim());
      setExamData(res.quiz);
      setSubmissionId(res.submissionId);
      setSessionToken(res.sessionToken);
      setAnswers({});
      setRemainingSeconds(res.quiz.durationMinutes * 60);
      setDurationElapsed(0);
      setScreen('taking');
    } catch (err: any) {
      setStartError(err.message || 'Không thể bắt đầu bài thi.');
    } finally {
      setStartLoading(false);
    }
  };

  // Option select
  const handleSelectOption = (questionId: string, optionLabel: string) => {
    const updated = {
      ...answers,
      [questionId]: optionLabel
    };
    setAnswers(updated);

    // Immediate heartbeat sync
    if (submissionId && sessionToken) {
      api.heartbeat(quizId, submissionId, sessionToken, updated, durationElapsed).catch(() => {});
    }
  };

  // Submit test
  const handleSubmitExam = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await api.submitExam(
        quizId,
        submissionId,
        sessionToken,
        answers,
        durationElapsed
      );
      setResult(res);
      setScreen('result');
      // Clear backup
      localStorage.removeItem(localBackupKey);
    } catch (err: any) {
      alert('Lỗi nộp bài: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setSubmitting(false);
      setShowSubmitConfirm(false);
    }
  };

  const handleAutoSubmitOnTimeout = async () => {
    if (submitting || screen !== 'taking') return;
    setSubmitting(true);
    try {
      const res = await api.submitExam(
        quizId,
        submissionId,
        sessionToken,
        answers,
        durationElapsed
      );
      setResult(res);
      setScreen('result');
      localStorage.removeItem(localBackupKey);
    } catch (err) {
      console.error('Auto-submit timeout error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Format time mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // SCREEN 1: QUIZ INFO & CANDIDATE NAME INPUT
  // ---------------------------------------------------------------------------
  if (screen === 'info') {
    if (loadingInfo) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-gray-600">Đang tải đề thi...</p>
          </div>
        </div>
      );
    }

    if (infoError || !quizInfo) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Không Thể Mở Đề Thi</h3>
            <p className="text-sm text-gray-600">{infoError || 'Đề thi không tồn tại hoặc đã bị xóa.'}</p>
            {onExitToHome && (
              <button
                onClick={onExitToHome}
                className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm transition"
              >
                Về Trang Chủ
              </button>
            )}
          </div>
        </div>
      );
    }

    const isClosedOrPaused = quizInfo.status !== 'active';

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-white to-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-md shadow-indigo-100">
              <BookOpen className="w-6 h-6" />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Phòng thi trực tuyến
              </span>
              {quizInfo.hasPassword && (
                <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Có mật khẩu
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-gray-900 mb-2 leading-snug">
              {quizInfo.title}
            </h1>

            {quizInfo.description && (
              <p className="text-sm text-gray-600 mb-5 bg-gray-50 p-3.5 rounded-xl border border-gray-100 leading-relaxed">
                {quizInfo.description}
              </p>
            )}

            {/* Exam specifications */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-xs text-gray-600">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60">
                <span className="text-gray-400 block mb-0.5 font-medium">Số lượng câu:</span>
                <span className="text-sm font-bold text-gray-900">{quizInfo.totalQuestions} câu</span>
              </div>
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60">
                <span className="text-gray-400 block mb-0.5 font-medium">Thời gian:</span>
                <span className="text-sm font-bold text-gray-900">
                  {quizInfo.durationMinutes > 0 ? `${quizInfo.durationMinutes} phút` : 'Tự do'}
                </span>
              </div>
            </div>

            {/* Candidate Entry Form */}
            {isClosedOrPaused ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center text-sm text-amber-800">
                {quizInfo.status === 'paused'
                  ? 'Bài thi đang tạm dừng nhận bài.'
                  : quizInfo.status === 'closed'
                  ? 'Bài thi đã kết thúc thời gian nhận bài.'
                  : 'Bài thi chưa mở.'}
              </div>
            ) : (
              <form onSubmit={handleStartExam} className="space-y-4">
                {startError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{startError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nhập Họ và Tên của bạn <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      placeholder="VD: Nguyễn Văn Anh"
                      autoFocus
                      required
                      className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-gray-900 transition"
                    />
                    <User className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
                  </div>
                </div>

                {quizInfo.hasPassword && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Mật khẩu bài thi <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu do giáo viên cấp..."
                        required
                        className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-gray-900 transition"
                      />
                      <Lock className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={startLoading}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition text-sm cursor-pointer disabled:opacity-50"
                >
                  {startLoading ? 'Đang vào phòng thi...' : 'BẮT ĐẦU LÀM BÀI'}
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-gray-400">
            Hệ thống QUIZ PRO – Đồng hồ chỉ tính giờ sau khi bấm bắt đầu.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 2: ACTIVE EXAM (TEST TAKING)
  // ---------------------------------------------------------------------------
  if (screen === 'taking' && examData) {
    const currentQuestion = examData.questions[currentIndex];
    const totalQ = examData.questions.length;
    const answeredCount = Object.keys(answers).length;
    const isTimeUrgent = examData.durationMinutes > 0 && remainingSeconds < 300; // < 5 mins
    const isTimeCritical = examData.durationMinutes > 0 && remainingSeconds < 60; // < 1 min

    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Sticky Header with Timer & Submit */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs px-4 sm:px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900 truncate max-w-xs sm:max-w-md">
                {examData.title}
              </h2>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                Thí sinh: <strong className="text-indigo-700 font-semibold">{studentName}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Countdown Clock */}
              {examData.durationMinutes > 0 && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition ${
                    isTimeCritical
                      ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
                      : isTimeUrgent
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="font-mono">{formatTime(remainingSeconds)}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Nộp bài</span>
              </button>
            </div>
          </div>
        </header>

        {/* Urgent Timer Alert Banner if < 1 minute */}
        {isTimeCritical && (
          <div className="bg-red-600 text-white text-center text-xs font-bold py-1.5 px-4 animate-bounce">
            ⚠️ Sắp hết giờ làm bài! Hệ thống sẽ tự động nộp bài khi đồng hồ về 00:00.
          </div>
        )}

        {/* Main Exam Content */}
        <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question View (Left 3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-8">
              {/* Question number and progress */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <span className="font-black text-indigo-600 text-sm">
                  CÂU HỎI {currentIndex + 1} / {totalQ}
                </span>

                <span className="text-xs text-gray-500 font-medium">
                  {answers[currentQuestion.id] ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã trả lời
                    </span>
                  ) : (
                    <span className="text-gray-400">Chưa chọn đáp án</span>
                  )}
                </span>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg text-gray-900 font-medium mb-6 leading-relaxed select-none">
                {currentQuestion.questionText}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map(opt => {
                  const isSelected = answers[currentQuestion.id] === opt.label;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(currentQuestion.id, opt.label)}
                      className={`w-full p-4 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center shrink-0 transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-sm sm:text-base text-gray-800 pt-0.5 leading-snug">
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation buttons: Prev / Next */}
              <div className="flex items-center justify-between gap-3 pt-8 mt-6 border-t border-gray-100">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <span className="text-xs text-gray-400 hidden sm:inline">
                  Tự động lưu câu trả lời
                </span>

                <button
                  disabled={currentIndex === totalQ - 1}
                  onClick={() => setCurrentIndex(prev => Math.min(totalQ - 1, prev + 1))}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition shadow-xs hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Question Palette Sidebar (Right column) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Bảng câu hỏi
                </span>
                <span className="text-xs font-bold text-indigo-600">
                  {answeredCount}/{totalQ}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300"
                  style={{ width: `${(answeredCount / totalQ) * 100}%` }}
                ></div>
              </div>

              {/* Question Number Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1">
                {examData.questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = Boolean(answers[q.id]);

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center relative ${
                        isCurrent
                          ? 'ring-2 ring-indigo-600 ring-offset-2'
                          : ''
                      } ${
                        isAnswered
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-4 mt-4 border-t border-gray-100">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-indigo-600"></span> Đã làm
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200"></span> Chưa làm
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Xác Nhận Nộp Bài Thi
              </h3>
              <p className="text-sm text-gray-600">
                Bạn đã trả lời{' '}
                <strong className="text-indigo-600">{answeredCount}/{totalQ}</strong> câu hỏi.
                {answeredCount < totalQ && (
                  <span className="block text-amber-600 font-semibold mt-1">
                    Còn {totalQ - answeredCount} câu hỏi chưa được chọn đáp án!
                  </span>
                )}
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Làm tiếp
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitExam}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Đang nộp bài...' : 'Đồng ý nộp bài'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SCREEN 3: RESULT & SOLUTION UNLOCK
  // ---------------------------------------------------------------------------
  if (screen === 'result' && result) {
    const minutes = Math.floor(result.durationSeconds / 60);
    const seconds = result.durationSeconds % 60;
    const durationStr = `${minutes} phút ${seconds} giây`;

    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Result Card */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <Award className="w-9 h-9" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Nộp bài thành công
              </span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">
                Kết Quả Bài Làm: {result.studentName}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Thời gian làm bài: {durationStr}
              </p>
            </div>

            {/* Score Display (If enabled by teacher) */}
            {result.showScore ? (
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100">
                <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">
                  Điểm số đạt được
                </span>
                <div className="text-4xl sm:text-5xl font-black text-indigo-700 my-1">
                  {result.score}{' '}
                  <span className="text-base font-semibold text-gray-400">/{result.maxScore}</span>
                </div>
                <div className="text-xs font-semibold text-gray-600">
                  Trả lời đúng: <strong className="text-emerald-600 font-bold">{result.correctCount}/{result.totalQuestions}</strong> câu
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-xl text-xs text-gray-500">
                Giáo viên đã nhận bài nộp của bạn. Điểm số sẽ được thông báo sau.
              </div>
            )}

            {/* Threshold Condition Message */}
            {result.solutionsUnlocked ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-emerald-900">
                  <span className="font-bold">Chúc mừng! Bạn đã đạt điểm sàn (≥ {result.passThreshold} điểm).</span>
                  <p className="text-emerald-700 mt-0.5">
                    Hệ thống đã mở khóa đáp án chuẩn và hướng dẫn giải chi tiết bên dưới.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-900">
                  <span className="font-bold">
                    Chưa đạt điểm sàn ({result.score}/{result.maxScore} đ, điểm sàn: {result.passThreshold} đ).
                  </span>
                  <p className="text-amber-700 mt-0.5">
                    Theo quy định của đề thi, đáp án chi tiết và hướng dẫn giải chỉ mở khi đạt từ {result.passThreshold} điểm trở lên. Hãy cố gắng hơn ở bài kiểm tra sau nhé!
                  </p>
                </div>
              </div>
            )}

            {onExitToHome && (
              <button
                onClick={onExitToHome}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Về trang chủ</span>
              </button>
            )}
          </div>

          {/* Solutions Accordion (ONLY IF UNLOCKED) */}
          {result.solutionsUnlocked && result.review && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Đáp Án Chuẩn & Hướng Dẫn Giải Chi Tiết
              </h3>

              {result.review.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl border p-5 shadow-xs ${
                    q.isCorrect ? 'border-emerald-200' : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-gray-900">
                      Câu {idx + 1}: {q.questionText}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${
                        q.isCorrect
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {q.isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {q.isCorrect ? 'Đúng' : 'Sai'} (+{q.pointsEarned} đ)
                    </span>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
                    {q.options.map(opt => {
                      const isCorrectAnswer = opt.label === q.correctAnswer;
                      const isChosen = opt.label === q.chosen;

                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                            isCorrectAnswer
                              ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800'
                              : isChosen && !isCorrectAnswer
                              ? 'bg-red-50 border-red-300 font-semibold text-red-800'
                              : 'bg-gray-50 border-gray-100 text-gray-600'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-md font-bold flex items-center justify-center shrink-0 ${
                              isCorrectAnswer
                                ? 'bg-emerald-600 text-white'
                                : isChosen
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <span className="truncate">{opt.text}</span>
                          {isCorrectAnswer && (
                            <span className="ml-auto text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                              Đáp án chuẩn
                            </span>
                          )}
                          {isChosen && !isCorrectAnswer && (
                            <span className="ml-auto text-[10px] bg-red-200 text-red-900 px-1.5 py-0.2 rounded font-bold">
                              Bạn đã chọn
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution */}
                  {q.solution && (
                    <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50 p-3 rounded-xl text-xs text-gray-700 flex items-start gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-gray-900 font-semibold">Lời giải: </strong>
                        <span>{q.solution}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
