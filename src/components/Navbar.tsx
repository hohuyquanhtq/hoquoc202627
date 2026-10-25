import React from 'react';
import { BookOpen, PlusCircle, ListOrdered, BarChart3, Lock, Unlock, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface Props {
  activeTab: 'list' | 'create' | 'monitor';
  setActiveTab: (tab: 'list' | 'create' | 'monitor') => void;
  isBackendConnected: boolean;
  isAdminUnlocked: boolean;
  onLockAdmin: () => void;
  onUnlockAdmin: () => void;
  totalQuizzes: number;
}

export const Navbar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  isBackendConnected,
  isAdminUnlocked,
  onLockAdmin,
  onUnlockAdmin,
  totalQuizzes
}) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">
                  QUIZ PRO
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Giáo viên
                </span>
              </div>
              <p className="text-[11px] text-gray-500 hidden sm:block">Tạo đề trắc nghiệm Word & Chấm thi online</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tạo đề mới</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Danh sách đề</span>
              {totalQuizzes > 0 && (
                <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'list' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {totalQuizzes}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition cursor-pointer ${
                activeTab === 'monitor'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Kết quả & Theo dõi</span>
            </button>
          </nav>

          {/* Right Status & Passcode controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Backend connectivity badge */}
            <div
              title={isBackendConnected ? 'Máy chủ và cơ sở dữ liệu trực tuyến đang hoạt động' : 'Chưa kết nối máy chủ'}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isBackendConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isBackendConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Đã đồng bộ máy chủ</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mất kết nối máy chủ</span>
                </>
              )}
            </div>

            {/* Admin passcode lock/unlock button */}
            {isAdminUnlocked ? (
              <button
                onClick={onLockAdmin}
                title="Khóa quyền quản trị trên trình duyệt này"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition cursor-pointer border border-emerald-300"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quản trị: Đã mở</span>
              </button>
            ) : (
              <button
                onClick={onUnlockAdmin}
                title="Nhập mã quản trị để sửa đề và xem kết quả"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer border border-indigo-200"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Mở khóa mã QTV</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
