import mammoth from 'mammoth';
import { Question } from '../types/quiz';

interface ParseResult {
  title?: string;
  questions: Question[];
  warningCount: number;
  totalFound: number;
}

export async function parseDocxFile(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Convert to both HTML (for rich formatting like <sub>, <sup>, <b>, <u>) and raw text
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    mammoth.extractRawText({ arrayBuffer })
  ]);

  const rawText = textResult.value;
  const rawHtml = htmlResult.value;

  return parseQuizContent(rawText, rawHtml, file.name.replace(/\.[^/.]+$/, ''));
}

export function parseQuizContent(rawText: string, rawHtml?: string, defaultTitle?: string): ParseResult {
  // Normalize line breaks
  const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if there is an Answer Table at the end
  // e.g., "BẢNG ĐÁP ÁN", "ĐÁP ÁN:", "KEY:", "1.A 2.B 3.C..."
  const answerTableMap = extractAnswerTable(normalizedText);

  // Split into question blocks
  // Common question starters in Vietnamese:
  // "Câu 1:", "Câu 1.", "Câu 1 -", "Bài 1:", "Question 1:", "1."
  const questionRegex = /(?:^|\n)\s*(?:(?:Câu|Bài|Question)\s*(\d+)[\s.:\-–—]|(\d+)[\s.:\-–—]\s*(?=[A-ZÀ-Ỹ]))/gi;

  const matches: { index: number; qNum: number; fullMatch: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = questionRegex.exec(normalizedText)) !== null) {
    const qNum = parseInt(match[1] || match[2], 10);
    matches.push({
      index: match.index,
      qNum: !isNaN(qNum) ? qNum : matches.length + 1,
      fullMatch: match[0]
    });
  }

  const questions: Question[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];
      const blockText = normalizedText.substring(
        current.index,
        next ? next.index : normalizedText.length
      ).trim();

      const parsedQ = parseSingleQuestionBlock(blockText, current.qNum, i + 1, answerTableMap);
      if (parsedQ) {
        questions.push(parsedQ);
      }
    }
  } else {
    // Fallback: try splitting by empty double newlines if no "Câu" marker found
    const blocks = normalizedText.split(/\n\s*\n/).filter(b => b.trim().length > 10);
    blocks.forEach((block, idx) => {
      const parsedQ = parseSingleQuestionBlock(block, idx + 1, idx + 1, answerTableMap);
      if (parsedQ) {
        questions.push(parsedQ);
      }
    });
  }

  // Count questions needing review
  const warningCount = questions.filter(q => q.hasWarning).length;

  return {
    title: defaultTitle || 'Đề trắc nghiệm Word',
    questions,
    warningCount,
    totalFound: questions.length
  };
}

function parseSingleQuestionBlock(
  block: string,
  qNum: number,
  order: number,
  answerTableMap: Map<number, string>
): Question | null {
  // 1. Separate Explanation/Solution if present
  // Markers: "Lời giải:", "Hướng dẫn giải:", "Giải chi tiết:", "Giải:", "HD giải:"
  let questionPart = block;
  let solution = '';

  const solutionMarkerRegex = /(?:\n|\s)(?:Lời giải|Hướng dẫn giải|Giải chi tiết|Giải|HD|Explanation)[\s.:\-–—]/i;
  const solMatch = solutionMarkerRegex.exec(block);
  if (solMatch) {
    questionPart = block.substring(0, solMatch.index).trim();
    solution = block.substring(solMatch.index + solMatch[0].length).trim();
  }

  // 2. Look for inline answer marker e.g., "Đáp án: A", "Chọn: B", "Key: C", "Đ/a: D"
  let detectedAnswer = '';
  const inlineAnswerRegex = /(?:Đáp án(?:\s*đúng)?|Chọn|Đ\/a|Key)[\s.:\-–—]*([A-D])/i;
  const ansMatch = inlineAnswerRegex.exec(questionPart);
  if (ansMatch) {
    detectedAnswer = ansMatch[1].toUpperCase();
    // Remove the answer string from question text if it's at the end
    questionPart = questionPart.replace(inlineAnswerRegex, '').trim();
  }

  // If not found in block, check answer table extracted from footer
  if (!detectedAnswer && answerTableMap.has(qNum)) {
    detectedAnswer = answerTableMap.get(qNum)!.toUpperCase();
  }

  // 3. Extract Options A, B, C, D
  // Options can be on separate lines or inline: "A. xxx B. yyy C. zzz D. ttt"
  const optionRegex = /(?:^|\s|\n)([A-D])[\s.)\-–—]\s*/g;
  const optMatches: { label: string; index: number; fullLength: number }[] = [];
  let optM: RegExpExecArray | null;

  while ((optM = optionRegex.exec(questionPart)) !== null) {
    // ensure label hasn't been captured yet in sequence
    const label = optM[1].toUpperCase();
    const lastLabel = optMatches.length > 0 ? optMatches[optMatches.length - 1].label : '';
    // Expected next label: A -> B -> C -> D
    const expected = ['A', 'B', 'C', 'D'][optMatches.length];
    if (label === expected) {
      optMatches.push({
        label,
        index: optM.index,
        fullLength: optM[0].length
      });
    }
  }

  let questionText = questionPart;
  const options: { id: string; label: string; text: string }[] = [];

  if (optMatches.length >= 2) {
    // The question content is before the first option 'A'
    questionText = questionPart.substring(0, optMatches[0].index).trim();

    // Clean question text header (e.g., "Câu 1: ", "1. ")
    questionText = cleanQuestionHeader(questionText);

    for (let i = 0; i < optMatches.length; i++) {
      const current = optMatches[i];
      const next = optMatches[i + 1];
      const text = questionPart.substring(
        current.index + current.fullLength,
        next ? next.index : questionPart.length
      ).trim();

      // Check if option text has answer indicator like bold or asterisk: e.g., "*A. 15cm" or "A. 15cm (*)"
      let isOptMarked = false;
      let cleanText = text;
      if (cleanText.includes('(*)') || cleanText.startsWith('*') || cleanText.endsWith('*')) {
        isOptMarked = true;
        cleanText = cleanText.replace(/\(\*\)|\*/g, '').trim();
      }

      if (isOptMarked && !detectedAnswer) {
        detectedAnswer = current.label;
      }

      options.push({
        id: current.label,
        label: current.label,
        text: cleanText
      });
    }
  } else {
    // If fewer than 2 options found, clean header
    questionText = cleanQuestionHeader(questionText);
    // Provide default 4 empty options A, B, C, D so the teacher can easily fill in
    ['A', 'B', 'C', 'D'].forEach(lbl => {
      options.push({ id: lbl, label: lbl, text: '' });
    });
  }

  // Format chemical / sub / sup notation if plain text e.g., H2O -> H₂O, m2 -> m²
  const formattedQuestionText = formatScientificChars(questionText);
  const formattedOptions = options.map(opt => ({
    ...opt,
    text: formatScientificChars(opt.text)
  }));

  // Determine warnings
  let hasWarning = false;
  let warningReason = '';

  if (!detectedAnswer || !['A', 'B', 'C', 'D'].includes(detectedAnswer)) {
    hasWarning = true;
    warningReason = 'Chưa xác định được đáp án đúng. Vui lòng bấm chọn đáp án A, B, C hoặc D bên dưới.';
  } else if (formattedOptions.filter(o => o.text.trim().length > 0).length < 2) {
    hasWarning = true;
    warningReason = 'Chưa nhận diện đủ phương án lựa chọn. Vui lòng kiểm tra lại phương án A, B, C, D.';
  }

  return {
    id: `q_${order}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    order,
    questionText: formattedQuestionText,
    options: formattedOptions,
    correctAnswer: detectedAnswer || '',
    solution: solution ? formatScientificChars(solution) : '',
    points: 1, // Will be recalculated by scoring mode
    hasWarning,
    warningReason
  };
}

function cleanQuestionHeader(text: string): string {
  return text
    .replace(/^\s*(?:Câu|Bài|Question)\s*\d+[\s.:\-–—]+\s*/i, '')
    .replace(/^\s*\d+[\s.:\-–—]+\s*/, '')
    .trim();
}

// Convert common formulas and subscripts/superscripts
function formatScientificChars(text: string): string {
  if (!text) return '';
  return text
    // Chemistry subscripts
    .replace(/H2O\b/g, 'H₂O')
    .replace(/CO2\b/g, 'CO₂')
    .replace(/O2\b/g, 'O₂')
    .replace(/N2\b/g, 'N₂')
    .replace(/H2SO4\b/g, 'H₂SO₄')
    .replace(/CaCO3\b/g, 'CaCO₃')
    .replace(/Al2O3\b/g, 'Al₂O₃')
    .replace(/Fe2O3\b/g, 'Fe₂O₃')
    .replace(/NaOH\b/g, 'NaOH')
    .replace(/CuSO4\b/g, 'CuSO₄')
    .replace(/SO2\b/g, 'SO₂')
    .replace(/SO4\b/g, 'SO₄')
    .replace(/NO3\b/g, 'NO₃')
    // Math superscripts
    .replace(/m2\b/g, 'm²')
    .replace(/m3\b/g, 'm³')
    .replace(/cm2\b/g, 'cm²')
    .replace(/cm3\b/g, 'cm³')
    .replace(/km2\b/g, 'km²')
    .replace(/x2\b/g, 'x²')
    .replace(/x3\b/g, 'x³')
    .replace(/y2\b/g, 'y²');
}

// Extracts Answer tables like:
// "BẢNG ĐÁP ÁN: 1.A 2.B 3.C 4.D" or "1-A, 2-B, 3-C..."
function extractAnswerTable(text: string): Map<number, string> {
  const map = new Map<number, string>();

  // Look for sections starting with "BẢNG ĐÁP ÁN" or "ĐÁP ÁN TRẮC NGHIỆM"
  const tableIndex = text.search(/(?:BẢNG ĐÁP ÁN|ĐÁP ÁN TRẮC NGHIỆM|BẢNG TRẢ LỜI)/i);
  const searchArea = tableIndex !== -1 ? text.substring(tableIndex) : text;

  // Patterns like "1.A", "1-A", "1:A", "Câu 1: A", "1A"
  const pairRegex = /(?:Câu\s*)?(\d+)[\s.:\-–—]*([A-D])\b/gi;
  let m: RegExpExecArray | null;

  while ((m = pairRegex.exec(searchArea)) !== null) {
    const qNum = parseInt(m[1], 10);
    const ans = m[2].toUpperCase();
    if (!isNaN(qNum) && !map.has(qNum)) {
      map.set(qNum, ans);
    }
  }

  return map;
}

// Sample test generator in case the teacher wants to test immediately
export function getSampleQuiz(): { title: string; description: string; questions: Question[] } {
  return {
    title: 'Kiểm tra trắc nghiệm Khảo sát Chất lượng đầu năm',
    description: 'Học sinh làm bài nghiêm túc, đọc kỹ đề trước khi chọn phương án trả lời. Điểm sàn xem đáp án chi tiết là 8.0/10.',
    questions: [
      {
        id: 'q_1_sample',
        order: 1,
        questionText: 'Cho phản ứng hoá học: 2H₂ + O₂ → 2H₂O. Tỉ lệ số phân tử H₂ và O₂ tham gia phản ứng là bao nhiêu?',
        options: [
          { id: 'A', label: 'A', text: '2 : 1' },
          { id: 'B', label: 'B', text: '1 : 2' },
          { id: 'C', label: 'C', text: '1 : 1' },
          { id: 'D', label: 'D', text: '2 : 3' }
        ],
        correctAnswer: 'A',
        solution: 'Theo phương trình hoá học: hệ số của H₂ là 2, hệ số của O₂ là 1. Do đó tỉ lệ số phân tử H₂ : O₂ là 2 : 1.',
        points: 2,
        hasWarning: false
      },
      {
        id: 'q_2_sample',
        order: 2,
        questionText: 'Diện tích hình vuông có cạnh a = 6 cm bằng bao nhiêu?',
        options: [
          { id: 'A', label: 'A', text: '24 cm²' },
          { id: 'B', label: 'B', text: '36 cm²' },
          { id: 'C', label: 'C', text: '12 cm²' },
          { id: 'D', label: 'D', text: '18 cm²' }
        ],
        correctAnswer: 'B',
        solution: 'Diện tích hình vuông tính theo công thức S = a² = 6² = 36 cm².',
        points: 2,
        hasWarning: false
      },
      {
        id: 'q_3_sample',
        order: 3,
        questionText: 'Nghiệm của phương trình bậc nhất 2x - 8 = 0 là:',
        options: [
          { id: 'A', label: 'A', text: 'x = 2' },
          { id: 'B', label: 'B', text: 'x = -4' },
          { id: 'C', label: 'C', text: 'x = 4' },
          { id: 'D', label: 'D', text: 'x = 8' }
        ],
        correctAnswer: 'C',
        solution: 'Ta có 2x - 8 = 0 ⇔ 2x = 8 ⇔ x = 4.',
        points: 2,
        hasWarning: false
      },
      {
        id: 'q_4_sample',
        order: 4,
        questionText: 'Chất khí nào sau đây chiếm thể tích lớn nhất trong không khí sạch (khoảng 78%)?',
        options: [
          { id: 'A', label: 'A', text: 'Khí Oxygen (O₂)' },
          { id: 'B', label: 'B', text: 'Khí Carbon dioxide (CO₂)' },
          { id: 'C', label: 'C', text: 'Khí Nitrogen (N₂)' },
          { id: 'D', label: 'D', text: 'Khí Hydrogen (H₂)' }
        ],
        correctAnswer: 'C',
        solution: 'Không khí bao gồm khoảng 78% thể tích khí Nitrogen (N₂), khoảng 21% khí Oxygen (O₂), và 1% các khí khác.',
        points: 2,
        hasWarning: false
      },
      {
        id: 'q_5_sample',
        order: 5,
        questionText: 'Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông là nội dung của:',
        options: [
          { id: 'A', label: 'A', text: 'Định lí Ta-lét' },
          { id: 'B', label: 'B', text: 'Định lí Pythagoras (Pi-ta-go)' },
          { id: 'C', label: 'C', text: 'Bất đẳng thức tam giác' },
          { id: 'D', label: 'D', text: 'Định lí Cosin' }
        ],
        correctAnswer: 'B',
        solution: 'Định lí Pythagoras phát biểu: Trong một tam giác vuông, bình phương của cạnh huyền bằng tổng bình phương của hai cạnh góc vuông.',
        points: 2,
        hasWarning: false
      }
    ]
  };
}
