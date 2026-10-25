import React, { useState } from 'react';
import {
  FileText,
  Clock,
  Users,
  Copy,
  ExternalLink,
  Play,
  Pause,
  StopCircle,
  Edit3,
  Trash2,
  Lock,
  PlusCircle,
  Check,
  Search,
  Sparkles,
  Award
} from 'lucide-react';
import { Quiz } from '../types/quiz';

interface Props {
  quizzes: Quiz[];
  onSelectQuizForMonitor: (quizId: string) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
  onUpdateStatus: (quizId: string, status: 'draft' | 'active' | 'paused' | 'closed') => void;
  onCreateNew: () => void;
  onPreviewStudent: (quizId: string) => void;
}

export const QuizListTab: React.FC<Props> = ({
  quizzes,
  onSelectQuizForMonitor,
  onEditQuiz,
  onDeleteQuiz,
  onUpdateStatus,
  onCreateNew,
  onPreviewStudent
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopyLink = (quizId: string) => {
    // Generate public link format
    const origin = window.location.origin;
    const shareUrl = `${origin}/#exam=${quizId}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(quizId);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const getStatusBadge = (status: Quiz['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Đang mở nhận bài
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Tạm dừng
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            Đã kết thúc
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            Bản nháp
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Danh Sách Đề Thi Của Bạn
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Quản lý, phát hành và xem tiến độ làm bài của học sinh
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm đề thi..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          </div>

          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 transition whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo đề mới</span>
          </button>
        </div>
      </div>

      {/* Quiz Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {searchTerm ? 'Không tìm thấy đề thi phù hợp' : 'Chưa có đề thi nào'}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            {searchTerm
              ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc.'
              : 'Hãy tải lên file Word (.docx) để hệ thống tự động nhận diện câu hỏi và phương án trong vài giây!'}
          </p>
          {!searchTerm && (
            <button
              onClick={onCreateNew}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-100 transition cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Tạo đề từ file Word ngay</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredQuizzes.map(quiz => {
            const isCopied = copiedId === quiz.id;
            const origin = window.location.origin;
            const shareUrl = `${origin}/#exam=${quiz.id}`;

            return (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6">
                  {/* Status & Security */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {getStatusBadge(quiz.status)}

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {quiz.hasPassword && (
                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200 font-medium" title="Có mật khẩu đề">
                          <Lock className="w-3 h-3" />
                          Có mật khẩu
                        </span>
                      )}
                      <span>{new Date(quiz.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-2 hover:text-indigo-600 transition mb-2">
                    {quiz.title}
                  </h3>
                  {quiz.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {quiz.description}
                    </p>
                  )}

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-600 mt-2">
                    <span className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-lg font-medium">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      {quiz.questions.length} câu hỏi
                    </span>

                    <span className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-lg font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {quiz.durationMinutes > 0 ? `${quiz.durationMinutes} phút` : 'Tự do'}
                    </span>

                    <span className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-lg font-medium">
                      <Award className="w-3.5 h-3.5 text-emerald-500" />
                      Điểm sàn giải: {quiz.passThresholdForSolutions}/{quiz.maxScore}
                    </span>

                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      {quiz.submissionCount || 0} bài nộp
                    </span>
                  </div>

                  {/* Link Box */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-600 truncate font-mono select-all flex-1">
                      {shareUrl}
                    </div>
                    <button
                      onClick={() => handleCopyLink(quiz.id)}
                      title="Sao chép link làm bài"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Chép link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-gray-50/70 px-6 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  {/* Left: Quick Status Change */}
                  <div className="flex items-center gap-1">
                    {quiz.status !== 'active' && (
                      <button
                        onClick={() => onUpdateStatus(quiz.id, 'active')}
                        title="Mở đề thi cho học sinh làm bài"
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mở đề</span>
                      </button>
                    )}

                    {quiz.status === 'active' && (
                      <button
                        onClick={() => onUpdateStatus(quiz.id, 'paused')}
                        title="Tạm dừng nhận bài"
                        className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Tạm dừng</span>
                      </button>
                    )}

                    {quiz.status !== 'closed' && (
                      <button
                        onClick={() => onUpdateStatus(quiz.id, 'closed')}
                        title="Đóng đề ngay (không nhận bài nữa)"
                        className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Đóng đề</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Monitor, Preview, Edit, Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectQuizForMonitor(quiz.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 text-indigo-700 hover:bg-indigo-50 rounded-lg transition shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Theo dõi ({quiz.submissionCount || 0})</span>
                    </button>

                    <button
                      onClick={() => onPreviewStudent(quiz.id)}
                      title="Xem thử với giao diện học sinh"
                      className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg transition border border-transparent hover:border-gray-200 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onEditQuiz(quiz)}
                      title="Chỉnh sửa đề thi"
                      className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg transition border border-transparent hover:border-gray-200 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa đề thi "${quiz.title}"? Toàn bộ kết quả bài nộp sẽ bị xóa vĩnh viễn.`)) {
                          onDeleteQuiz(quiz.id);
                        }
                      }}
                      title="Xóa đề thi"
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition border border-transparent hover:border-gray-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
