import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, AlertCircle } from 'lucide-react';
import { api, setStoredAdminPasscode } from '../api/client';

interface Props {
  isOpen: boolean;
  isInitialSetup: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

export const AdminPasscodeModal: React.FC<Props> = ({
  isOpen,
  isInitialSetup,
  onSuccess,
  onClose
}) => {
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passcode || passcode.trim().length < 4) {
      setError('Mã quản trị phải có ít nhất 4 ký tự.');
      return;
    }

    if (isInitialSetup && passcode !== confirmPasscode) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);
    try {
      if (isInitialSetup) {
        await api.setupPasscode(passcode.trim());
      } else {
        await api.verifyPasscode(passcode.trim());
      }
      setStoredAdminPasscode(passcode.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Mã quản trị không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white text-center relative">
          <div className="w-14 h-14 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-3 backdrop-blur-xs border border-white/20">
            {isInitialSetup ? <ShieldCheck className="w-8 h-8 text-yellow-300" /> : <Lock className="w-8 h-8 text-yellow-300" />}
          </div>
          <h3 className="text-xl font-bold">
            {isInitialSetup ? 'Thiết Lập Mã Quản Trị' : 'Xác Thực Giáo Viên'}
          </h3>
          <p className="text-indigo-100 text-sm mt-1">
            {isInitialSetup
              ? 'Tạo một mã bảo vệ để quản lý đề thi và bài nộp học sinh'
              : 'Nhập mã quản trị để truy cập khu vực giáo viên'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {isInitialSetup ? 'Nhập mã quản trị mới (tối thiểu 4 ký tự):' : 'Mã quản trị của bạn:'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Nhập mã bí mật..."
                autoFocus
                className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-gray-800 font-mono tracking-wider"
              />
              <KeyRound className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {isInitialSetup && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Xác nhận lại mã quản trị:
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPasscode}
                  onChange={e => setConfirmPasscode(e.target.value)}
                  placeholder="Nhập lại mã..."
                  className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-gray-800 font-mono tracking-wider"
                />
                <KeyRound className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang kiểm tra...' : (isInitialSetup ? 'Lưu Mã Quản Trị' : 'Mở Khóa Quản Lý')}
            </button>
          </div>

          <p className="text-xs text-center text-gray-400 pt-2">
            Mã được mã hóa an toàn trên máy chủ. Học sinh sẽ không có quyền truy cập.
          </p>
        </form>
      </div>
    </div>
  );
};
