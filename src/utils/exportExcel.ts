import * as XLSX from 'xlsx';
import { Submission, Quiz } from '../types/quiz';

export function exportSubmissionsToExcel(quiz: Quiz, submissions: Submission[]) {
  // Build rows for candidate summary
  const rows = submissions.map((sub, index) => {
    const started = sub.startedAt ? new Date(sub.startedAt).toLocaleString('vi-VN') : '-';
    const submitted = sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '-';
    const minutes = Math.floor(sub.durationSeconds / 60);
    const seconds = sub.durationSeconds % 60;
    const durationStr = `${minutes}p ${seconds}s`;

    let statusText = 'Đang làm';
    if (sub.status === 'submitted') statusText = 'Đã nộp';
    else if (sub.status === 'timeout') statusText = 'Hết giờ';
    else if (sub.status === 'interrupted') statusText = 'Bị gián đoạn';

    const row: Record<string, string | number> = {
      'STT': index + 1,
      'Họ và tên học sinh': sub.studentName,
      'Trạng thái': statusText,
      'Điểm số': sub.status === 'submitted' || sub.status === 'timeout' ? sub.score : '-',
      'Điểm tối đa': sub.maxScore,
      'Số câu đúng': `${sub.correctCount}/${sub.totalQuestions}`,
      'Đạt điểm sàn': sub.passedThreshold ? 'Đạt' : 'Chưa đạt',
      'Thời điểm bắt đầu': started,
      'Thời điểm nộp bài': submitted,
      'Thời gian làm bài': durationStr
    };

    // Also include question columns
    if (sub.details && sub.details.length > 0) {
      sub.details.forEach((d, qIdx) => {
        row[`Câu ${qIdx + 1} (Chọn/Đúng)`] = `${d.chosen || 'Chưa chọn'} / ${d.correct} (${d.isCorrect ? 'Đúng' : 'Sai'})`;
      });
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kết quả bài thi');

  // Generate file name
  const safeTitle = quiz.title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 30);
  const fileName = `Ket_qua_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

export function exportSubmissionsToCSV(quiz: Quiz, submissions: Submission[]) {
  const headers = [
    'STT',
    'Họ và tên',
    'Trạng thái',
    'Điểm số',
    'Điểm tối đa',
    'Số câu đúng',
    'Tổng số câu',
    'Đạt điểm sàn',
    'Thời điểm bắt đầu',
    'Thời điểm nộp bài',
    'Thời gian làm bài'
  ];

  const rows = submissions.map((sub, index) => {
    const started = sub.startedAt ? new Date(sub.startedAt).toLocaleString('vi-VN') : '-';
    const submitted = sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '-';
    const duration = `${Math.floor(sub.durationSeconds / 60)}p ${sub.durationSeconds % 60}s`;
    let statusText = 'Đang làm';
    if (sub.status === 'submitted') statusText = 'Đã nộp';
    else if (sub.status === 'timeout') statusText = 'Hết giờ';

    return [
      index + 1,
      `"${sub.studentName.replace(/"/g, '""')}"`,
      `"${statusText}"`,
      sub.status === 'submitted' || sub.status === 'timeout' ? sub.score : '',
      sub.maxScore,
      sub.correctCount,
      sub.totalQuestions,
      sub.passedThreshold ? 'Đạt' : 'Chưa đạt',
      `"${started}"`,
      `"${submitted}"`,
      `"${duration}"`
    ].join(',');
  });

  // UTF-8 BOM \uFEFF ensures Vietnamese letters display properly in Microsoft Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = quiz.title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 30);
  link.setAttribute('download', `Ket_qua_${safeTitle}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
