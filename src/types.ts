export interface SubQuestion {
  id: string;
  questionText: string;
  questionType: "single" | "multiple" | "true_false" | "short_answer";
  options: string[];
  correctAnswers: string[];
  explanation: string;
  imageUrl?: string;
}

export interface Question {
  id: string; // unique local ID (or from Google Sheet row)
  questionText: string;
  imageUrl?: string; // Optional image for the question
  questionType: "single" | "multiple" | "true_false" | "true_false_cluster" | "short_answer" | "case_study";
  options: string[]; // Options list (empty for short answer)
  correctAnswers: string[]; // List of correct answer values
  explanation: string;
  category: string; // e.g., "Toán học", "Ngữ văn", "Chung"
  difficulty: "easy" | "medium" | "hard";
  subQuestions?: SubQuestion[]; // List of sub-questions for case_study type
}

export interface StudentInfoField {
  id: string;
  label: string;
  type: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  timeLimitMinutes: number; // 0 for no limit
  createdAt: string;
  isRandomized?: boolean; // If true, questions will be drawn randomly
  randomQuestionCount?: number; // How many questions to draw randomly
  pinnedQuestionIds?: string[]; // IDs of questions that must always be included
  grade?: string;
  subject?: string;
  purpose?: string;
  // Security / Online Test Config
  maxAttempts?: number;
  password?: string;
  proctoringMode?: "off" | "monitor_screen_exit";
  requireStudentInfo?: boolean;
  studentInfoFields?: StudentInfoField[];
  publishedId?: string;
  shuffleQuestions?: boolean;
  groupByType?: boolean;
  shuffleAnswers?: boolean;
  showScore?: "no" | "when_finished" | "when_all_finished";
  showAnswers?: "no" | "when_finished" | "when_all_finished" | "when_reach_score";
  hideCorrectAnswerForWrong?: boolean;
  startTime?: string;
  endTime?: string;
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
  studentClass?: string;
  submittedAt: string;
  score: number; // out of 10.0
  correctCount: number;
  totalQuestions: number;
  answers: AnswerSubmission[];
  detailedGrades: {
    questionId: string;
    questionText: string;
    questionType?: string;
    isCorrect: boolean;
    studentAnswers: string[];
    correctAnswers: string[];
    options?: string[];
    explanation: string;
    imageUrl?: string;
    subGrades?: {
      questionId: string;
      questionText: string;
      questionType: string;
      isCorrect: boolean;
      studentAnswers: string[];
      correctAnswers: string[];
      options?: string[];
      explanation: string;
    }[];
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
