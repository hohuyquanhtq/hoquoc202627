import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { QuizListTab } from './components/QuizListTab';
import { QuizEditorTab } from './components/QuizEditorTab';
import { MonitoringTab } from './components/MonitoringTab';
import { StudentExamView } from './components/StudentExamView';
import { AdminPasscodeModal } from './components/AdminPasscodeModal';
import { Quiz } from './types/quiz';
import {
  api,
  getStoredAdminPasscode,
  clearStoredAdminPasscode
} from './api/client';
import { Eye, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'monitor'>('list');
  const [studentExamQuizId, setStudentExamQuizId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // Backend & Security State
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [isPasscodeConfigured, setIsPasscodeConfigured] = useState<boolean>(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);
  const [isInitialPasscodeSetup, setIsInitialPasscodeSetup] = useState<boolean>(false);

  // Quizzes State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState<boolean>(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [selectedMonitorQuizId, setSelectedMonitorQuizId] = useState<string | null>(null);

  // 1. Detect Student Exam Link from URL hash or query params
  // e.g. /#exam=quiz_123 or ?exam=quiz_123
  useEffect(() => {
    const handleLocationChange = () => {
      const hash = window.location.hash;
      const search = window.location.search;

      let foundQuizId: string | null = null;

      if (hash.startsWith('#exam=')) {
        foundQuizId = hash.replace('#exam=', '').trim();
      } else if (hash.startsWith('#/exam/')) {
        foundQuizId = hash.replace('#/exam/', '').trim();
      } else {
        const urlParams = new URLSearchParams(search);
        if (urlParams.has('exam')) {
          foundQuizId = urlParams.get('exam');
        }
      }

      if (foundQuizId) {
        setStudentExamQuizId(foundQuizId);
        setIsPreviewMode(false);
      }
    };

    handleLocationChange();
    window.addEventListener('hashchange', handleLocationChange);
    return () => window.removeEventListener('hashchange', handleLocationChange);
  }, []);

  // 2. Check Backend Server Status & Passcode Configuration
  const checkServerStatus = async () => {
    try {
      const statusRes = await api.checkStatus();
      setIsBackendConnected(true);
      setIsPasscodeConfigured(statusRes.isPasscodeConfigured);

      if (!statusRes.isPasscodeConfigured) {
        // Teacher needs to configure passcode for the first time
        setIsInitialPasscodeSetup(true);
        setShowPasscodeModal(true);
      } else {
        // Check if browser already has saved passcode
        const stored = getStoredAdminPasscode();
        if (stored) {
          try {
            await api.verifyPasscode(stored);
            setIsAdminUnlocked(true);
          } catch {
            clearStoredAdminPasscode();
            setIsAdminUnlocked(false);
          }
        }
      }
    } catch (err) {
      console.error('Backend status check failed:', err);
      setIsBackendConnected(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
  }, []);

  // 3. Load Quizzes if Admin is unlocked
  const fetchQuizzes = async () => {
    if (!isAdminUnlocked) return;
    setLoadingQuizzes(true);
    try {
      const res = await api.getQuizzes();
      setQuizzes(res.quizzes || []);
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        setIsAdminUnlocked(false);
      }
    } finally {
      setLoadingQuizzes(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchQuizzes();
    }
  }, [isAdminUnlocked]);

  // Actions
  const handleSaveQuiz = async (quizData: Partial<Quiz>): Promise<Quiz> => {
    if (quizData.id) {
      const res = await api.updateQuiz(quizData.id, quizData);
      await fetchQuizzes();
      setEditingQuiz(null);
      return res.quiz;
    } else {
      const res = await api.createQuiz(quizData);
      await fetchQuizzes();
      return res.quiz;
    }
  };

  const handleUpdateStatus = async (
    quizId: string,
    newStatus: 'draft' | 'active' | 'paused' | 'closed'
  ) => {
    try {
      await api.setQuizStatus(quizId, newStatus);
      await fetchQuizzes();
    } catch (err: any) {
      alert('Không thể đổi trạng thái: ' + (err.message || 'Lỗi'));
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      await api.deleteQuiz(quizId);
      await fetchQuizzes();
    } catch (err: any) {
      alert('Không thể xóa đề thi: ' + (err.message || 'Lỗi'));
    }
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuiz(quiz);
    setActiveTab('create');
  };

  const handleSelectQuizForMonitor = (quizId: string) => {
    setSelectedMonitorQuizId(quizId);
    setActiveTab('monitor');
  };

  const handlePreviewStudent = (quizId: string) => {
    setStudentExamQuizId(quizId);
    setIsPreviewMode(true);
  };

  const handleExitStudentMode = () => {
    setStudentExamQuizId(null);
    setIsPreviewMode(false);
    window.location.hash = '';
  };

  // ---------------------------------------------------------------------------
  // RENDER: STUDENT EXAM VIEW (Or Teacher Preview Mode)
  // ---------------------------------------------------------------------------
  if (studentExamQuizId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Banner if in Preview Mode */}
        {isPreviewMode && (
          <div className="bg-indigo-900 text-indigo-100 px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-50">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-yellow-400" />
              <span>Chế độ Xem Thử của Giáo Viên (Học sinh sẽ không thấy thanh thông báo này)</span>
            </span>
            <button
              onClick={handleExitStudentMode}
              className="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại trang quản lý</span>
            </button>
          </div>
        )}

        <StudentExamView
          quizId={studentExamQuizId}
          onExitToHome={isPreviewMode ? handleExitStudentMode : undefined}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: TEACHER MANAGEMENT ZONE
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={tab => {
          if (tab === 'create' && activeTab !== 'create') {
            setEditingQuiz(null); // Reset when clicking new
          }
          setActiveTab(tab);
        }}
        isBackendConnected={isBackendConnected}
        isAdminUnlocked={isAdminUnlocked}
        onLockAdmin={() => {
          clearStoredAdminPasscode();
          setIsAdminUnlocked(false);
        }}
        onUnlockAdmin={() => {
          setIsInitialPasscodeSetup(!isPasscodeConfigured);
          setShowPasscodeModal(true);
        }}
        totalQuizzes={quizzes.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* If Backend Disconnected Warning */}
        {!isBackendConnected && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-bold">Chưa kết nối được máy chủ backend:</span>
              <p className="text-amber-800 mt-0.5">
                Đang thử kết nối lại với máy chủ. Hãy đảm bảo server đang chạy trên cổng 3000. Dữ liệu sẽ không báo thành công giả lập nếu chưa lưu vào cơ sở dữ liệu.
              </p>
              <button
                onClick={checkServerStatus}
                className="mt-2 px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử kết nối lại</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Quiz List */}
        {activeTab === 'list' && (
          <QuizListTab
            quizzes={quizzes}
            onSelectQuizForMonitor={handleSelectQuizForMonitor}
            onEditQuiz={handleEditQuiz}
            onDeleteQuiz={handleDeleteQuiz}
            onUpdateStatus={handleUpdateStatus}
            onCreateNew={() => {
              setEditingQuiz(null);
              setActiveTab('create');
            }}
            onPreviewStudent={handlePreviewStudent}
          />
        )}

        {/* Tab 2: Create / Edit Quiz */}
        {activeTab === 'create' && (
          <QuizEditorTab
            initialQuiz={editingQuiz}
            onSaveQuiz={handleSaveQuiz}
            onCancel={() => {
              setEditingQuiz(null);
              setActiveTab('list');
            }}
            onPreviewStudent={handlePreviewStudent}
          />
        )}

        {/* Tab 3: Monitor & Results */}
        {activeTab === 'monitor' && (
          <MonitoringTab
            quizzes={quizzes}
            selectedQuizId={selectedMonitorQuizId}
            onSelectQuiz={setSelectedMonitorQuizId}
          />
        )}
      </main>

      {/* Admin Passcode Modal */}
      <AdminPasscodeModal
        isOpen={showPasscodeModal}
        isInitialSetup={isInitialPasscodeSetup}
        onSuccess={() => {
          setIsAdminUnlocked(true);
          setShowPasscodeModal(false);
          setIsPasscodeConfigured(true);
          fetchQuizzes();
        }}
        onClose={() => {
          if (isPasscodeConfigured) {
            setShowPasscodeModal(false);
          }
        }}
      />
    </div>
  );
}
