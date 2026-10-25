import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Save,
  Rocket,
  HelpCircle,
  Clock,
  Lock,
  Award,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Quiz, Question } from '../types/quiz';
import { parseDocxFile, getSampleQuiz } from '../utils/docxParser';

interface Props {
  initialQuiz?: Quiz | null;
  onSaveQuiz: (quizData: Partial<Quiz>) => Promise<Quiz>;
  onCancel: () => void;
  onPreviewStudent: (quizId: string) => void;
}

export const QuizEditorTab: React.FC<Props> = ({
  initialQuiz,
  onSaveQuiz,
  onCancel,
  onPreviewStudent
}) => {
  // Wizard steps: 1: Tải/Nhập -> 2: Kiểm tra câu hỏi -> 3: Cài đặt bài thi -> 4: Phát hành
  const [step, setStep] = useState<number>(initialQuiz ? 2 : 1);

  // Form states
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [description, setDescription] = useState(
    initialQuiz?.description || 'Học sinh đọc kỹ đề bài và chọn một đáp án đúng nhất cho mỗi câu hỏi.'
  );
  const [hasPassword, setHasPassword] = useState(initialQuiz?.hasPassword || false);
  const [password, setPassword] = useState(initialQuiz?.password || '');
  const [durationMinutes, setDurationMinutes] = useState<number>(
    initialQuiz?.durationMinutes !== undefined ? initialQuiz.durationMinutes : 15
  );
  const [maxAttempts, setMaxAttempts] = useState<number>(initialQuiz?.maxAttempts || 1);
  const [maxScore, setMaxScore] = useState<number>(initialQuiz?.maxScore || 10);
  const [scoringMode, setScoringMode] = useState<'equal' | 'custom'>(
    initialQuiz?.scoringMode || 'equal'
  );
  const [passThresholdForSolutions, setPassThresholdForSolutions] = useState<number>(
    initialQuiz?.passThresholdForSolutions !== undefined ? initialQuiz.passThresholdForSolutions : 8.0
  );
  const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState(
    initialQuiz?.showScoreAfterSubmit !== false
  );
  const [openTime, setOpenTime] = useState(initialQuiz?.openTime || '');
  const [closeTime, setCloseTime] = useState(initialQuiz?.closeTime || '');
  const [status, setStatus] = useState<'draft' | 'active' | 'paused' | 'closed'>(
    initialQuiz?.status || 'active'
  );

  const [questions, setQuestions] = useState<Question[]>(initialQuiz?.questions || []);
  const [parsingLoading, setParsingLoading] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [publishedQuiz, setPublishedQuiz] = useState<Quiz | null>(initialQuiz || null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle docx upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.docx')) {
      alert('Vui lòng chọn file định dạng Word (.docx)');
      return;
    }

    setParsingLoading(true);
    setParseNotice(null);
    try {
      const result = await parseDocxFile(file);
      setTitle(result.title || file.name.replace(/\.[^/.]+$/, ''));
      setQuestions(result.questions);

      if (result.questions.length === 0) {
        setParseNotice('Không tìm thấy câu hỏi trắc nghiệm nào trong file. Bạn có thể tự thêm câu hỏi thủ công bên dưới.');
      } else {
        setParseNotice(
          `Đã nhận diện thành công ${result.questions.length} câu hỏi.${
            result.warningCount > 0
              ? ` Có ${result.warningCount} câu cần kiểm tra lại đáp án đúng.`
              : ' Tất cả các câu đã có đáp án chuẩn!'
          }`
        );
        // Move to review step automatically
        setStep(2);
      }
    } catch (err: any) {
      console.error('Word parse error:', err);
      alert('Không thể đọc file Word này: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setParsingLoading(false);
    }
  };

  // Load sample quiz for quick testing
  const handleLoadSample = () => {
    const sample = getSampleQuiz();
    setTitle(sample.title);
    setDescription(sample.description);
    setQuestions(sample.questions);
    setParseNotice('Đã tải bộ 5 câu hỏi mẫu chuẩn (Toán & Hóa học). Bạn có thể kiểm tra hoặc thêm bớt tùy ý!');
    setStep(2);
  };

  // Update question field
  const updateQuestion = (qId: string, updates: Partial<Question>) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id === qId) {
          const updated = { ...q, ...updates };
          // Re-evaluate warning
          if (updated.correctAnswer && ['A', 'B', 'C', 'D'].includes(updated.correctAnswer)) {
            updated.hasWarning = false;
            updated.warningReason = undefined;
          }
          return updated;
        }
        return q;
      })
    );
  };

  // Update single option text
  const updateOptionText = (qId: string, optionLabel: string, newText: string) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id === qId) {
          const options = q.options.map(opt =>
            opt.label === optionLabel ? { ...opt, text: newText } : opt
          );
          return { ...q, options };
        }
        return q;
      })
    );
  };

  // Add new blank question
  const addNewQuestion = () => {
    const newQ: Question = {
      id: `q_${questions.length + 1}_${Date.now()}`,
      order: questions.length + 1,
      questionText: '',
      options: [
        { id: 'A', label: 'A', text: '' },
        { id: 'B', label: 'B', text: '' },
        { id: 'C', label: 'C', text: '' },
        { id: 'D', label: 'D', text: '' }
      ],
      correctAnswer: '',
      solution: '',
      points: 1,
      hasWarning: true,
      warningReason: 'Vui lòng nhập nội dung câu hỏi và chọn đáp án đúng.'
    };
    setQuestions(prev => [...prev, newQ]);
  };

  // Remove question
  const removeQuestion = (qId: string) => {
    setQuestions(prev =>
      prev.filter(q => q.id !== qId).map((q, idx) => ({ ...q, order: idx + 1 }))
    );
  };

  // Save / Publish
  const handleSave = async (targetStatus?: 'draft' | 'active') => {
    if (!title.trim()) {
      alert('Vui lòng nhập Tên bài thi.');
      setStep(3);
      return;
    }

    if (questions.length === 0) {
      alert('Đề thi phải có ít nhất 1 câu hỏi.');
      setStep(1);
      return;
    }

    // Check if any question has no correct answer
    const unselected = questions.filter(q => !q.correctAnswer);
    if (unselected.length > 0) {
      const confirmProceed = confirm(
        `Cảnh báo: Có ${unselected.length} câu hỏi chưa được chọn đáp án đúng (Câu ${unselected
          .map(q => q.order)
          .join(', ')}). Bạn có muốn kiểm tra lại trước khi phát hành không?`
      );
      if (confirmProceed) {
        setStep(2);
        return;
      }
    }

    const quizStatus = targetStatus || status;

    const quizPayload: Partial<Quiz> = {
      id: initialQuiz?.id,
      title: title.trim(),
      description: description.trim(),
      hasPassword,
      password: hasPassword ? password.trim() : '',
      durationMinutes,
      maxAttempts,
      maxScore,
      scoringMode,
      passThresholdForSolutions,
      showScoreAfterSubmit,
      openTime: openTime || null,
      closeTime: closeTime || null,
      status: quizStatus,
      questions
    };

    setSavingLoading(true);
    try {
      const saved = await onSaveQuiz(quizPayload);
      setPublishedQuiz(saved);
      setStep(4); // Move to publishing summary step
    } catch (err: any) {
      alert('Không thể lưu đề thi: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setSavingLoading(false);
    }
  };

  const copyShareLink = () => {
    if (!publishedQuiz) return;
    const origin = window.location.origin;
    const shareUrl = `${origin}/#exam=${publishedQuiz.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const warningCount = questions.filter(q => q.hasWarning || !q.correctAnswer).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Wizard Header / Step Navigator */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            {initialQuiz ? 'Chỉnh Sửa Đề Thi' : 'Tạo Đề Trắc Nghiệm Mới'}
          </h2>
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-800 transition"
          >
            Quay lại danh sách
          </button>
        </div>

        {/* Steps navigation pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
          {[
            { num: 1, label: '1. Nhập từ Word' },
            { num: 2, label: `2. Kiểm tra câu hỏi (${questions.length})` },
            { num: 3, label: '3. Cài đặt bài thi' },
            { num: 4, label: '4. Phát hành đề' }
          ].map(s => (
            <button
              key={s.num}
              onClick={() => {
                if (s.num === 4 && !publishedQuiz) return;
                setStep(s.num);
              }}
              disabled={s.num === 4 && !publishedQuiz}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition text-left flex items-center gap-2 cursor-pointer ${
                step === s.num
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                step === s.num ? 'bg-white text-indigo-700 font-bold' : 'bg-gray-200 text-gray-600'
              }`}>
                {s.num}
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: IMPORT FROM WORD OR LOAD SAMPLE */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xs text-center">
            <div className="max-w-xl mx-auto">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UploadCloud className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Tải lên File Word (.docx)
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Hệ thống tự động nhận diện câu hỏi, các phương án A-B-C-D, đáp án đúng và lời giải chi tiết. Hỗ trợ câu hỏi nhiều dòng, công thức toán và ký hiệu hóa học (H₂O, x², CO₂...).
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={parsingLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-100 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-5 h-5" />
                  <span>{parsingLoading ? 'Đang đọc và phân tích Word...' : 'Chọn file Word (.docx)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="w-full sm:w-auto px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Dùng thử đề mẫu (5 câu chuẩn)</span>
                </button>
              </div>

              {parseNotice && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-start gap-2 text-left">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{parseNotice}</span>
                </div>
              )}
            </div>

            <div className="mt-10 border-t border-gray-100 pt-6 text-left max-w-2xl mx-auto">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Quy cách soạn thảo Word được hỗ trợ:
              </h4>
              <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-4">
                <li>Bắt đầu câu hỏi bằng <strong>Câu 1:</strong>, <strong>Câu 1.</strong>, <strong>Bài 1:</strong> hoặc <strong>1.</strong></li>
                <li>Phương án: <strong>A.</strong>, <strong>B.</strong>, <strong>C.</strong>, <strong>D.</strong> (nằm riêng dòng hoặc cùng dòng).</li>
                <li>Đáp án: Đánh dấu bằng <strong>Đáp án: A</strong>, gạch chân phương án đúng, hoặc bảng đáp án ở cuối văn bản (<strong>1.A 2.B...</strong>).</li>
                <li>Lời giải chi tiết: Viết sau cụm từ <strong>Lời giải:</strong> hoặc <strong>Hướng dẫn giải:</strong>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW & EDIT QUESTIONS */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Warning Summary if any */}
          {warningCount > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-bold">Cần kiểm tra: {warningCount} câu chưa có đáp án đúng.</span>
                <p className="text-amber-700 mt-0.5">
                  Hãy bấm vào ký hiệu A, B, C hoặc D trên câu hỏi để chọn đáp án đúng trước khi phát hành.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-semibold">
                Toàn bộ {questions.length} câu hỏi đã có đáp án chuẩn! Bạn có thể kiểm tra nội dung và lời giải bên dưới.
              </span>
            </div>
          )}

          {/* Action toolbar */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-gray-700">
              Tổng số câu hỏi: <strong className="text-indigo-600 font-extrabold">{questions.length}</strong>
            </span>

            <button
              onClick={addNewQuestion}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer border border-indigo-200"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm câu hỏi mới</span>
            </button>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => {
              const needsAttention = !q.correctAnswer || q.hasWarning;

              return (
                <div
                  key={q.id}
                  className={`bg-white rounded-2xl border transition duration-150 p-5 shadow-xs ${
                    needsAttention ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                        {qIndex + 1}
                      </span>
                      <span className="font-bold text-gray-800 text-sm">
                        Câu {qIndex + 1}
                      </span>

                      {needsAttention && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Chưa chọn đáp án
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {scoringMode === 'custom' && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <span>Điểm:</span>
                          <input
                            type="number"
                            step="0.25"
                            value={q.points}
                            onChange={e => updateQuestion(q.id, { points: parseFloat(e.target.value) || 1 })}
                            className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => removeQuestion(q.id)}
                        title="Xóa câu này"
                        className="p-1 text-gray-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question text textarea */}
                  <div className="mb-4">
                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={e => updateQuestion(q.id, { questionText: e.target.value })}
                      placeholder="Nhập nội dung câu hỏi..."
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>

                  {/* Options A, B, C, D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {q.options.map(opt => {
                      const isCorrect = q.correctAnswer === opt.label;

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition ${
                            isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                              : 'bg-gray-50/50 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {/* Radio / Label button */}
                          <button
                            type="button"
                            onClick={() => updateQuestion(q.id, { correctAnswer: opt.label })}
                            title={`Bấm để chọn ${opt.label} làm đáp án đúng`}
                            className={`w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center shrink-0 transition cursor-pointer ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-gray-200 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700'
                            }`}
                          >
                            {opt.label}
                          </button>

                          {/* Option text */}
                          <input
                            type="text"
                            value={opt.text}
                            onChange={e => updateOptionText(q.id, opt.label, e.target.value)}
                            placeholder={`Phương án ${opt.label}...`}
                            className="w-full px-2.5 py-1.5 text-sm bg-transparent outline-none text-gray-800"
                          />

                          {isCorrect && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                              Đúng
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Solution box */}
                  <div className="mt-2 bg-gray-50/80 p-3 rounded-xl border border-gray-200">
                    <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Hướng dẫn giải chi tiết (Học sinh chỉ xem được khi đạt điểm sàn):</span>
                    </label>
                    <textarea
                      rows={2}
                      value={q.solution || ''}
                      onChange={e => updateQuestion(q.id, { solution: e.target.value })}
                      placeholder="Nhập lời giải hoặc hướng dẫn chi tiết..."
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom navigation */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tải file khác</span>
            </button>

            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-md shadow-indigo-100 cursor-pointer"
            >
              <span>Tiếp tục: Cài đặt bài thi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: EXAM SETTINGS */}
      {step === 3 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-xs space-y-6 animate-in fade-in duration-200">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
            Cài Đặt Cấu Hình Bài Thi
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Tên bài thi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Kiểm tra 15 phút Toán học kì 1"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-gray-800"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Hướng dẫn hoặc mô tả làm bài
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Hướng dẫn học sinh..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-700"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Thời gian làm bài (Phút)
              </label>
              <input
                type="number"
                min="0"
                value={durationMinutes}
                onChange={e => setDurationMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
              />
              <span className="text-xs text-gray-500 mt-1 block">Để 0 nếu không giới hạn thời gian</span>
            </div>

            {/* Max Score & Threshold */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Điểm sàn mở đáp án & hướng dẫn giải
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max={maxScore}
                value={passThresholdForSolutions}
                onChange={e => setPassThresholdForSolutions(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
              />
              <span className="text-xs text-gray-500 mt-1 block">
                Chỉ học sinh đạt ≥ {passThresholdForSolutions}/{maxScore} điểm mới được mở xem đáp án và giải chi tiết.
              </span>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-600" />
                  Mật khẩu bài thi
                </label>
                <label className="text-xs text-indigo-600 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPassword}
                    onChange={e => setHasPassword(e.target.checked)}
                    className="mr-1 rounded text-indigo-600"
                  />
                  Bật mật khẩu
                </label>
              </div>
              <input
                type="text"
                disabled={!hasPassword}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={hasPassword ? 'Nhập mật khẩu cho học sinh...' : 'Không yêu cầu mật khẩu (để trống)'}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50"
              />
            </div>

            {/* Scoring Mode */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Cách tính điểm
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScoringMode('equal')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    scoringMode === 'equal'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  Chia đều cho {questions.length} câu (Mặc định)
                </button>
                <button
                  type="button"
                  onClick={() => setScoringMode('custom')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    scoringMode === 'custom'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}
                >
                  Chỉnh điểm riêng từng câu
                </button>
              </div>
            </div>

            {/* Open / Close Time (Optional) */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                Thời điểm bắt đầu nhận bài (Tùy chọn)
              </label>
              <input
                type="datetime-local"
                value={openTime ? openTime.slice(0, 16) : ''}
                onChange={e => setOpenTime(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                Thời điểm kết thúc nhận bài (Tùy chọn)
              </label>
              <input
                type="datetime-local"
                value={closeTime ? closeTime.slice(0, 16) : ''}
                onChange={e => setCloseTime(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              />
            </div>

            {/* Checkbox: Show score after submit */}
            <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={showScoreAfterSubmit}
                  onChange={e => setShowScoreAfterSubmit(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>Cho phép học sinh xem điểm số ngay sau khi nộp bài</span>
              </label>
              <p className="text-xs text-gray-500 ml-6 mt-0.5">
                Lưu ý: Đáp án chuẩn và lời giải vẫn chỉ được hiển thị khi học sinh đạt điểm sàn {passThresholdForSolutions} điểm.
              </p>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại kiểm tra câu hỏi</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={savingLoading}
                onClick={() => handleSave('draft')}
                className="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition cursor-pointer"
              >
                Lưu Bản Nháp
              </button>

              <button
                type="button"
                disabled={savingLoading}
                onClick={() => handleSave('active')}
                className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-100 flex items-center gap-2 cursor-pointer"
              >
                <Rocket className="w-4 h-4" />
                <span>{savingLoading ? 'Đang lưu đề...' : 'Phát Hành Đề Thi Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: PUBLISHED & SHARE LINK */}
      {step === 4 && publishedQuiz && (
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-md space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-gray-900 mb-1">
              Phát Hành Đề Thi Thành Công!
            </h3>
            <p className="text-sm text-gray-600 max-w-lg mx-auto">
              Đề thi <strong>"{publishedQuiz.title}"</strong> ({publishedQuiz.questions.length} câu) đã được lưu trên máy chủ và sẵn sàng để học sinh làm bài.
            </p>
          </div>

          {/* Share Link Box */}
          <div className="max-w-2xl mx-auto p-4 bg-gray-50 rounded-2xl border border-gray-200 text-left space-y-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
              Đường link làm bài công khai cho học sinh:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/#exam=${publishedQuiz.id}`}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono text-gray-800 select-all outline-none"
              />
              <button
                onClick={copyShareLink}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                <Copy className="w-4 h-4" />
                <span>{copiedLink ? 'Đã chép link' : 'Sao chép link'}</span>
              </button>
            </div>

            <div className="text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2 pt-1">
              <span>Học sinh mở link trên điện thoại hoặc máy tính, chỉ cần nhập họ tên để làm bài.</span>
              {publishedQuiz.hasPassword && (
                <span className="font-semibold text-amber-700">Mật khẩu bài thi: {password || '(Đã đặt)'}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => onPreviewStudent(publishedQuiz.id)}
              className="px-5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-semibold text-sm transition flex items-center gap-2 cursor-pointer border border-indigo-200"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Xem thử với giao diện học sinh</span>
            </button>

            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-md shadow-indigo-100 cursor-pointer"
            >
              Về trang danh sách đề
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
