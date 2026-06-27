export interface Question {
  id: string; // unique local ID (or from Google Sheet row)
  questionText: string;
  questionType: "single" | "multiple" | "true_false" | "true_false_cluster" | "short_answer";
  options: string[]; // Options list (empty for short answer)
  correctAnswers: string[]; // List of correct answer values
  explanation: string;
  category: string; // e.g., "Toán học", "Ngữ văn", "Chung"
  difficulty: "easy" | "medium" | "hard";
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimitMinutes: number; // 0 for no limit
  createdAt: string;
}

export interface AnswerSubmission {
  questionId: string;
  selectedAnswers: string[]; // Selected answers or text input
}

export interface SubmissionResult {
  id: string;
  quizId: string;
  quizTitle: string;
  studentName: string;
  submittedAt: string;
  score: number; // out of 10.0
  correctCount: number;
  totalQuestions: number;
  answers: AnswerSubmission[];
  detailedGrades: {
    questionId: string;
    isCorrect: boolean;
    studentAnswers: string[];
    correctAnswers: string[];
    explanation: string;
  }[];
}

export interface GoogleSheetsState {
  isConnected: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  questionBankSheetName: string;
  resultsSheetName: string;
  isLoading: boolean;
}
