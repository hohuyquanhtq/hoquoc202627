import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Trash2,
  BarChart2,
  TrendingUp,
  Award,
  ChevronDown,
  X,
  HelpCircle,
  Check,
  Ban
} from 'lucide-react';
import { Quiz, Submission, QuizAnalytics } from '../types/quiz';
import { api } from '../api/client';
import { exportSubmissionsToExcel, exportSubmissionsToCSV } from '../utils/exportExcel';

interface Props {
  quizzes: Quiz[];
  selectedQuizId: string | null;
  onSelectQuiz: (id: string) => void;
}

export const MonitoringTab: React.FC<Props> = ({
  quizzes,
  selectedQuizId,
  onSelectQuiz
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    quiz: { id: string; title: string; maxScore: number; passThresholdForSolutions: number; status: string; durationMinutes: number };
    submissions: Submission[];
    analytics: QuizAnalytics;
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'submitted'>('all');
  const [selectedStudentSubmission, setSelectedStudentSubmission] = useState<Submission | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto polling ref
  const timerRef = useRef<any>(null);

  const activeQuizId = selectedQuizId || (quizzes.length > 0 ? quizzes[0].id : null);

  const fetchSubmissions = async (quizId: string, isSilent = false) => {
    if (!quizId) return;
    if (!isSilent) setLoading(true);

    try {
      const res = await api.getSubmissions(quizId);
      setData(res);
    } catch (err: any) {
      console.error('Error fetching submissions:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    if (activeQuizId) {
      fetchSubmissions(activeQuizId);
    } else {
      setData(null);
    }
  }, [activeQuizId]);

  // Periodic auto-refresh every 5s if enabled
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (autoRefresh && activeQuizId) {
      timerRef.current = setInterval(() => {
        fetchSubmissions(activeQuizId, true);
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, activeQuizId]);

  const handleDeleteSubmission = async (subId: string) => {
    if (!activeQuizId) return;
    if (!confirm('Bạn có chắc muốn xóa bài làm của học sinh này để họ có thể thi lại?')) return;

    try {
      await api.deleteSubmission(activeQuizId, subId);
      fetchSubmissions(activeQuizId, false);
      if (selectedStudentSubmission?.id === subId) {
        setSelectedStudentSubmission(null);
      }
    } catch (err: any) {
      alert('Không thể xóa bài làm: ' + (err.message || 'Lỗi'));
    }
  };

  const handleExportExcel = () => {
    if (!data || !activeQuizId) return;
    const fullQuiz = quizzes.find(q => q.id === activeQuizId);
    if (!fullQuiz) return;
    exportSubmissionsToExcel(fullQuiz, data.submissions);
  };

  const handleExportCSV = () => {
    if (!data || !activeQuizId) return;
    const fullQuiz = quizzes.find(q => q.id === activeQuizId);
    if (!fullQuiz) return;
    exportSubmissionsToCSV(fullQuiz, data.submissions);
  };

  // Filter submissions
  const filteredSubmissions = (data?.submissions || []).filter(sub => {
    const matchesSearch = sub.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'in_progress') return sub.status === 'in_progress';
    if (statusFilter === 'submitted') return sub.status === 'submitted' || sub.status === 'timeout';
    return true;
  });

  if (quizzes.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center max-w-xl mx-auto">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-800">Chưa có đề thi nào để theo dõi</h3>
        <p className="text-sm text-gray-500 mt-1">
          Hãy tạo đề thi trước khi xem bảng theo dõi bài làm của học sinh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quiz Selector */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Chọn đề thi cần theo dõi:
          </label>
          <div className="relative">
            <select
              value={activeQuizId || ''}
              onChange={e => onSelectQuiz(e.target.value)}
              className="w-full md:w-96 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer appearance-none pr-10"
            >
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.submissionCount || 0} bài nộp)
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3.5 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* Refresh & Export buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`}></span>
            <span>Tự cập nhật (4s)</span>
          </button>

          <button
            onClick={() => activeQuizId && fetchSubmissions(activeQuizId)}
            disabled={loading}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition cursor-pointer"
            title="Làm mới ngay"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={!data || data.submissions.length === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!data || data.submissions.length === 0}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2 uppercase">
              <span>Tổng lượt vào thi</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-gray-900">
              {data.analytics.totalSubmissions}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
              <span className="text-emerald-600 font-semibold">{data.analytics.submittedCount} đã nộp</span>
              <span>•</span>
              <span className="text-blue-600 font-semibold">{data.analytics.inProgressCount} đang làm</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2 uppercase">
              <span>Đang làm bài</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600 flex items-center gap-2">
              <span>{data.analytics.inProgressCount}</span>
              {data.analytics.inProgressCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Học sinh đang trực tiếp làm trên thiết bị
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2 uppercase">
              <span>Điểm trung bình</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {data.analytics.averageScore} <span className="text-xs font-medium text-gray-400">/{data.quiz.maxScore}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Cao nhất: <strong className="text-gray-700">{data.analytics.highestScore}</strong> | Thấp nhất: <strong className="text-gray-700">{data.analytics.lowestScore}</strong>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
            <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-2 uppercase">
              <span>Đạt điểm sàn mở giải</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              {data.analytics.passedThresholdCount}
              <span className="text-xs font-medium text-gray-400">
                {' '}({data.analytics.submittedCount > 0 ? Math.round((data.analytics.passedThresholdCount / data.analytics.submittedCount) * 100) : 0}%)
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Điểm sàn: <strong>≥ {data.quiz.passThresholdForSolutions} điểm</strong>
            </div>
          </div>
        </div>
      )}

      {/* Score distribution chart & filters */}
      {data && data.analytics.submittedCount > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-indigo-600" />
            Phổ điểm thi ({data.analytics.submittedCount} bài đã nộp)
          </h4>

          <div className="grid grid-cols-5 gap-2 sm:gap-4 items-end h-28 pt-4">
            {data.analytics.scoreDistribution.map(bracket => {
              const heightPercent = data.analytics.submittedCount > 0
                ? Math.max(12, Math.round((bracket.count / data.analytics.submittedCount) * 100))
                : 12;

              return (
                <div key={bracket.range} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[11px] font-bold text-gray-700 mb-1">
                    {bracket.count} hs
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-gradient-to-t from-indigo-600 to-blue-500 rounded-t-lg transition-all duration-300 group-hover:from-indigo-700 group-hover:to-blue-600"
                  ></div>
                  <span className="text-[11px] text-gray-500 mt-2 font-medium text-center">
                    {bracket.range}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên học sinh..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            {(['all', 'in_progress', 'submitted'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  statusFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' && 'Tất cả'}
                {f === 'in_progress' && 'Đang làm'}
                {f === 'submitted' && 'Đã nộp'}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-center w-12">STT</th>
                <th className="px-4 py-3">Họ và tên học sinh</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Bắt đầu lúc</th>
                <th className="px-4 py-3">Thời gian làm</th>
                <th className="px-4 py-3">Nộp bài lúc</th>
                <th className="px-4 py-3 text-right">Điểm số</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    Chưa có học sinh nào trong danh sách.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const minutes = Math.floor(sub.durationSeconds / 60);
                  const seconds = sub.durationSeconds % 60;
                  const durationStr = `${minutes}p ${seconds}s`;

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3.5 text-center font-bold text-gray-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-900">
                        {sub.studentName}
                      </td>
                      <td className="px-4 py-3.5">
                        {sub.status === 'in_progress' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                            Đang làm bài
                          </span>
                        )}
                        {sub.status === 'submitted' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Đã nộp bài
                          </span>
                        )}
                        {sub.status === 'timeout' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            Hết giờ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {sub.startedAt ? new Date(sub.startedAt).toLocaleTimeString('vi-VN') : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-gray-700">
                        {durationStr}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString('vi-VN') : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-base">
                        {sub.status === 'submitted' || sub.status === 'timeout' ? (
                          <span className={`${sub.passedThreshold ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {sub.score} <span className="text-xs font-medium text-gray-400">/{sub.maxScore}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 font-normal">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedStudentSubmission(sub)}
                            title="Xem chi tiết câu trả lời"
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSubmission(sub.id)}
                            title="Xóa bài làm (cho phép làm lại)"
                            className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudentSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-indigo-600 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Chi Tiết Bài Làm: {selectedStudentSubmission.studentName}
                </h3>
                <div className="flex items-center gap-3 text-xs text-indigo-100 mt-1">
                  <span>
                    Điểm số: <strong className="text-white text-sm">{selectedStudentSubmission.score}/{selectedStudentSubmission.maxScore}</strong>
                  </span>
                  <span>•</span>
                  <span>Số câu đúng: <strong>{selectedStudentSubmission.correctCount}/{selectedStudentSubmission.totalQuestions}</strong></span>
                  <span>•</span>
                  <span>
                    Đạt điểm sàn giải: <strong>{selectedStudentSubmission.passedThreshold ? 'ĐẠT' : 'CHƯA ĐẠT'}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudentSubmission(null)}
                className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Questions breakdown */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {(!selectedStudentSubmission.details || selectedStudentSubmission.details.length === 0) ? (
                <div className="text-center py-8 text-gray-400">
                  {selectedStudentSubmission.status === 'in_progress'
                    ? 'Học sinh đang trong phòng thi và chưa nộp bài.'
                    : 'Không có dữ liệu chi tiết cho lượt thi này.'}
                </div>
              ) : (
                selectedStudentSubmission.details.map((d, idx) => (
                  <div
                    key={d.questionId || idx}
                    className={`p-4 rounded-xl border ${
                      d.isCorrect
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-red-50/50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-bold text-sm text-gray-900">
                        Câu {idx + 1}: {d.questionText}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${
                          d.isCorrect
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {d.isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {d.isCorrect ? 'Đúng' : 'Sai'} (+{d.pointsEarned}/{d.maxPoints} đ)
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold mt-2">
                      <span className="text-gray-700">
                        Học sinh chọn: <strong className="font-bold text-indigo-700 font-mono text-sm">{d.chosen || '(Chưa chọn)'}</strong>
                      </span>
                      <span className="text-gray-700">
                        Đáp án chuẩn: <strong className="font-bold text-emerald-700 font-mono text-sm">{d.correct}</strong>
                      </span>
                    </div>

                    {d.solution && (
                      <div className="mt-3 pt-2 border-t border-gray-200/60 text-xs text-gray-600 flex items-start gap-1.5">
                        <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-gray-700">Hướng dẫn giải: </span>
                          <span>{d.solution}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedStudentSubmission(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
