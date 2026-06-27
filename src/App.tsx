import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Question, Quiz, SubmissionResult, AnswerSubmission } from "./types";
import { googleSignIn, initAuth, logout, getAccessToken as firebaseGetAccessToken } from "./lib/firebase";
import { fetchQuestionsFromSheet, syncAllQuestionsToSheet, appendResultToSheet } from "./lib/googleSheets";
import LZString from "lz-string";

// Components
import SheetsConnection from "./components/SheetsConnection";
import QuestionBankView from "./components/QuestionBankView";
import QuizBuilderView from "./components/QuizBuilderView";
import QuizRunnerView from "./components/QuizRunnerView";
import QuizResultsView from "./components/QuizResultsView";

// Icons
import {
  Database,
  FileText,
  FileSpreadsheet,
  Award,
  Sparkles,
  Play,
  HelpCircle,
  Brain,
  Clock,
  Trash2,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Share2,
} from "lucide-react";

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "bank" | "builder" | "runner" | "results">("dashboard");

  // Auth & Storage Config
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);

  // App Data State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // Active state for taking test
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [lastResult, setLastResult] = useState<SubmissionResult | null>(null);
  const [isStudentMode, setIsStudentMode] = useState(false);

  // Global loading and sync flags
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingResult, setIsSyncingResult] = useState(false);
  const [syncResultError, setSyncResultError] = useState<string | null>(null);
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);
  const [globalNotification, setGlobalNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [shareCodeModal, setShareCodeModal] = useState<{isOpen: boolean, code: string, url: string} | null>(null);

  // 1. Initial State Loading from localStorage
  useEffect(() => {
    // Check for shared quiz in URL via short ID
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("q");
    if (sharedId) {
      setIsLoading(true);
      fetch(`/api/get-shared-quiz/${sharedId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.quiz) {
            setActiveQuiz(data.quiz);
            setActiveTab("runner");
            setIsStudentMode(true);
          } else {
            console.error("Failed to load shared quiz:", data.error);
            setGlobalNotification({ message: data.error || "Bài thi không tồn tại hoặc đã hết hạn", type: "error" });
          }
        })
        .catch(err => {
          console.error("Error fetching shared quiz:", err);
          setGlobalNotification({ message: "Lỗi kết nối khi tải bài thi.", type: "error" });
        })
        .finally(() => {
          setIsLoading(false);
        });
      return; // Skip loading teacher auth data if in student mode
    }

    const cachedId = localStorage.getItem("quiz_spreadsheet_id");
    const cachedUrl = localStorage.getItem("quiz_spreadsheet_url");
    if (cachedId) setSpreadsheetId(cachedId);
    if (cachedUrl) setSpreadsheetUrl(cachedUrl);

    // Load local quizzes from cache to persist tests created
    const cachedQuizzes = localStorage.getItem("local_quizzes");
    if (cachedQuizzes) {
      try {
        setQuizzes(JSON.parse(cachedQuizzes));
      } catch (e) {
        console.error("Failed to parse local quizzes:", e);
      }
    }

    // Initialize Firebase Auth
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setNeedsAuth(false);
        // If logged in and spreadsheet is saved, fetch questions
        if (cachedId) {
          loadQuestionsFromSheets(token, cachedId);
        }
      },
      () => {
        setNeedsAuth(true);
      }
    );
  }, []);

  // Sync quizzes to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("local_quizzes", JSON.stringify(quizzes));
  }, [quizzes]);

  // 2. Fetch Questions from connected Google Sheet
  const loadQuestionsFromSheets = async (accessToken: string, idToFetch: string) => {
    setIsLoading(true);
    try {
      const fetchedQuestions = await fetchQuestionsFromSheet(accessToken, idToFetch);
      if (fetchedQuestions && fetchedQuestions.length > 0) {
        setQuestions(fetchedQuestions);
      }
    } catch (err) {
      console.error("Error fetching questions from Sheet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshQuestions = async () => {
    const token = getAccessToken();
    if (!token || !spreadsheetId) return;
    await loadQuestionsFromSheets(token, spreadsheetId);
  };

  // Helper to fetch local cached auth token
  const getAccessToken = (): string | null => {
    return firebaseGetAccessToken() || (window as any).__google_oauth_token || null;
  };

  // 3. Authenticate Google Account
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        // If already have connected sheet, pull questions
        if (spreadsheetId) {
          loadQuestionsFromSheets(result.accessToken, spreadsheetId);
        }
      }
    } catch (err) {
      console.error("Google login failed:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setNeedsAuth(true);
      setQuestions([]);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // 4. Save connected Sheet ID and URL
  const handleSpreadsheetConnected = (id: string, url: string) => {
    if (!id) {
      // Clear connection
      setSpreadsheetId(null);
      setSpreadsheetUrl(null);
      localStorage.removeItem("quiz_spreadsheet_id");
      localStorage.removeItem("quiz_spreadsheet_url");
      setQuestions([]);
      return;
    }

    setSpreadsheetId(id);
    setSpreadsheetUrl(url);
    localStorage.setItem("quiz_spreadsheet_id", id);
    localStorage.setItem("quiz_spreadsheet_url", url);

    const token = getAccessToken();
    if (token) {
      loadQuestionsFromSheets(token, id);
    }
  };

  // 5. Sync local Question Bank entirely to Google Sheets (Overwrite)
  const handleSyncQuestionsToSheets = async () => {
    const token = getAccessToken();
    if (!token || !spreadsheetId) {
      setGlobalNotification({
        message: "Vui lòng kết nối Google Sheets trước.",
        type: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      await syncAllQuestionsToSheet(token, spreadsheetId, questions);
      setGlobalNotification({
        message: "Đồng bộ Ngân hàng câu hỏi lên Google Sheets thành công!",
        type: "success",
      });
    } catch (err: any) {
      console.error(err);
      setGlobalNotification({
        message: err.message || "Không thể đồng bộ câu hỏi lên Google Sheets.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Add new questions (called from bank manual creator or AI generator)
  const handleAddQuestions = (newQuestions: Question[]) => {
    const updated = [...questions, ...newQuestions];
    setQuestions(updated);

    // Auto-sync up to Sheets if connected
    const token = getAccessToken();
    if (token && spreadsheetId) {
      syncAllQuestionsToSheet(token, spreadsheetId, updated).catch((err) => {
        console.error("Auto-sync new questions failed:", err);
      });
    }
  };

  // 7. Delete question from Bank
  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);

    const token = getAccessToken();
    if (token && spreadsheetId) {
      syncAllQuestionsToSheet(token, spreadsheetId, updated).catch((err) => {
        console.error("Auto-sync deletion failed:", err);
      });
    }
  };

  // 8. Add newly created Quiz
  const handleAddQuiz = (quiz: Quiz) => {
    setQuizzes([quiz, ...quizzes]);
    setActiveTab("dashboard");
  };

  const handleDeleteQuiz = (quizId: string) => {
    setDeleteQuizId(quizId);
  };

  const confirmDeleteQuiz = () => {
    if (deleteQuizId) {
      setQuizzes(quizzes.filter((q) => q.id !== deleteQuizId));
      setDeleteQuizId(null);
    }
  };

  // 9. Launch exam taking mode
  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setActiveTab("runner");
  };

  // 10. Grade exam and sync submissions automatically to Google Sheets
  const handleGrading = async (studentName: string, submissions: AnswerSubmission[]) => {
    if (!activeQuiz) return;

    let correctCount = 0;

    const detailedGrades = activeQuiz.questions.map((q) => {
      const studentAns = submissions.find((s) => s.questionId === q.id)?.selectedAnswers || [];

      // Logic for checking correctness based on question type
      let isCorrect = false;
      let partialPoints = 0;

      if (q.questionType === "single" || q.questionType === "true_false") {
        isCorrect =
          studentAns.length === 1 &&
          q.correctAnswers.length === 1 &&
          studentAns[0].toLowerCase().trim() === q.correctAnswers[0].toLowerCase().trim();
      } else if (q.questionType === "multiple") {
        const sortedStudent = [...studentAns].sort();
        const sortedCorrect = [...q.correctAnswers].sort();
        isCorrect =
          sortedStudent.length === sortedCorrect.length &&
          sortedStudent.every((val, idx) => val.toLowerCase().trim() === sortedCorrect[idx].toLowerCase().trim());
      } else if (q.questionType === "true_false_cluster") {
        let correctStatements = 0;
        for (let i = 0; i < q.correctAnswers.length; i++) {
          if (studentAns[i] === q.correctAnswers[i]) correctStatements++;
        }
        isCorrect = correctStatements === q.correctAnswers.length && q.correctAnswers.length > 0;
        
        // 2025 Format partial scoring
        if (q.correctAnswers.length === 4) {
          if (correctStatements === 1) partialPoints = 0.1;
          else if (correctStatements === 2) partialPoints = 0.25;
          else if (correctStatements === 3) partialPoints = 0.5;
          else if (correctStatements === 4) partialPoints = 1;
        } else {
          partialPoints = correctStatements / q.correctAnswers.length; 
        }
      } else if (q.questionType === "short_answer") {
        isCorrect =
          studentAns.length === 1 &&
          q.correctAnswers.some((ans) => ans.toLowerCase().trim() === studentAns[0].toLowerCase().trim());
      }

      if (q.questionType === "true_false_cluster") {
        correctCount += partialPoints;
      } else if (isCorrect) {
        correctCount++;
      }

      return {
        questionId: q.id,
        isCorrect,
        studentAnswers: studentAns,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
      };
    });

    const score = (correctCount / activeQuiz.questions.length) * 10;

    const newResult: SubmissionResult = {
      id: `res-${Date.now()}`,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      studentName,
      submittedAt: new Date().toLocaleString("vi-VN"),
      score,
      correctCount,
      totalQuestions: activeQuiz.questions.length,
      answers: submissions,
      detailedGrades,
    };

    setLastResult(newResult);
    setActiveTab("results");
    setActiveQuiz(null);

    // Sync Submission Result to Google Sheets
    setIsSyncingResult(true);
    setSyncResultError(null);
    
    try {
      if (isStudentMode) {
        // If we are a student, we don't have the teacher's credentials.
        // We rely on the backend proxying the submission to the teacher's sheet.
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get("q");
        if (sharedId) {
          const response = await fetch(`/api/submit-quiz/${sharedId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result: newResult })
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || "Không thể đồng bộ kết quả thi qua máy chủ.");
          }
        }
      } else {
        // Teacher testing the quiz themselves locally
        const token = getAccessToken();
        if (token && spreadsheetId) {
          await appendResultToSheet(token, spreadsheetId, newResult);
        }
      }
    } catch (err: any) {
      console.error("Syncing submission to Sheets failed:", err);
      setSyncResultError(err.message || "Không thể đồng bộ kết quả thi lên Google Sheets.");
    } finally {
      setIsSyncingResult(false);
    }
  };

  const handleStudentJoin = () => {
    const code = prompt("Nhập mã bài thi (6 ký tự):");
    if (!code) return;
    
    setIsLoading(true);
    fetch(`/api/get-shared-quiz/${code.toUpperCase()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.quiz) {
          setActiveQuiz(data.quiz);
          setActiveTab("runner");
          setIsStudentMode(true);
        } else {
          setGlobalNotification({ message: data.error || "Mã bài thi không hợp lệ hoặc đã hết hạn.", type: "error" });
        }
      })
      .catch(err => {
         setGlobalNotification({ message: "Lỗi kết nối.", type: "error" });
      })
      .finally(() => setIsLoading(false));
  };

  const handleShareQuiz = async (quiz: Quiz) => {
    try {
      const accessToken = getAccessToken();
      const response = await fetch("/api/share-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz,
          accessToken, // This will be null if they aren't logged in, which means results won't sync
          spreadsheetId
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      const shareUrl = `${window.location.origin}${window.location.pathname}?q=${data.shortId}`;
      
      setShareCodeModal({
        isOpen: true,
        code: data.shortId,
        url: shareUrl
      });
    } catch (err: any) {
      console.error("Failed to generate share link", err);
      setGlobalNotification({
        message: "Có lỗi khi tạo link chia sẻ: " + (err.message || "Lỗi không xác định."),
        type: "error"
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans antialiased text-slate-800 flex flex-col">
      {/* Top Header navbar */}
      {!isStudentMode && (
        <header className="bg-white border-b border-slate-100 py-4 px-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                Quiz Builder & Question Bank
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 font-medium">
                Azota & Moodle Power
              </span>
            </div>
          </div>

          {/* Navigation Tab lists (only shown if not currently in exam taking mode) */}
          {activeTab !== "runner" && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-50 border border-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "dashboard" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Trang chủ
              </button>
              <button
                onClick={() => setActiveTab("bank")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "bank" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Ngân hàng câu hỏi
              </button>
              <button
                onClick={() => setActiveTab("builder")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === "builder" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Soạn đề thi
              </button>
            </nav>
          )}

          {/* Mobile indicator for sheet connection */}
          <div className="flex items-center gap-2">
            {spreadsheetId ? (
              <a
                href={spreadsheetUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Đã liên kết Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setTimeout(() => {
                    document.getElementById("google-sheets-section")?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="text-[10px] sm:text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-100 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Chưa kết nối
              </button>
            )}
          </div>
        </div>
      </header>
      )}

      {/* Main Container workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Mobile Nav rails */}
        {!isStudentMode && activeTab !== "runner" && (
          <div className="flex md:hidden bg-white border border-slate-100 p-1.5 rounded-xl justify-around shadow-sm">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors ${
                activeTab === "dashboard" ? "bg-slate-100 text-slate-950" : "text-slate-400"
              }`}
            >
              Trang chủ
            </button>
            <button
              onClick={() => setActiveTab("bank")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors ${
                activeTab === "bank" ? "bg-slate-100 text-slate-950" : "text-slate-400"
              }`}
            >
              Ngân hàng
            </button>
            <button
              onClick={() => setActiveTab("builder")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-colors ${
                activeTab === "builder" ? "bg-slate-100 text-slate-950" : "text-slate-400"
              }`}
            >
              Soạn đề
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl flex items-center gap-3 text-indigo-700 text-xs font-semibold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Hệ thống đang tải dữ liệu và đồng bộ với Google Sheets...</span>
          </div>
        )}

        {/* Core Router Views */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Hero / Quick Welcome */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                  Chào mừng bạn đến với Quiz Builder <Sparkles className="w-5 h-5 text-indigo-600 fill-indigo-100 animate-pulse" />
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                  Hãy soạn thảo, quản lý ngân hàng câu hỏi đa dạng theo chuẩn Moodle và tự động chuyển đổi văn bản đề thi theo chuẩn Azota. Mọi câu hỏi và kết quả thi sẽ tự động đồng bộ trên Google Sheets của bạn.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                <button
                  onClick={handleStudentJoin}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Học sinh: Nhập mã thi
                </button>
                <button
                  onClick={() => setActiveTab("builder")}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" /> Soạn đề thi ngay
                </button>
              </div>
            </div>

            {/* Google Sheets Status panel */}
            <SheetsConnection
              user={user}
              needsAuth={needsAuth}
              spreadsheetId={spreadsheetId}
              spreadsheetUrl={spreadsheetUrl}
              isLoading={isLoading}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onSpreadsheetConnected={handleSpreadsheetConnected}
              onRefreshQuestions={handleRefreshQuestions}
            />

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Ngân hàng câu hỏi</p>
                  <p className="text-2xl font-black text-slate-800">{questions.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Đề thi đã soạn</p>
                  <p className="text-2xl font-black text-slate-800">{quizzes.length}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Trạng thái đồng bộ</p>
                  <p className="text-sm font-bold text-emerald-700 mt-1">
                    {spreadsheetId ? "Đã kết nối" : "Chỉ lưu trình duyệt"}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Quizzes List */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-indigo-600" /> Danh sách bài thi đang hoạt động
              </h2>

              {quizzes.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold">Chưa có đề thi nào được tạo</p>
                  <p className="text-[10px] max-w-xs mx-auto">
                    Ấn vào mục "Soạn đề thi" trên thanh điều hướng để tạo ngay một bài kiểm tra nhanh bằng dán văn bản.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="border border-slate-100 rounded-xl p-5 hover:border-indigo-100 transition-all bg-slate-50/20 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {quiz.questions.length} câu hỏi
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">Tạo lúc: {quiz.createdAt}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 leading-snug">{quiz.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{quiz.description}</p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4">
                        <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {quiz.timeLimitMinutes} phút
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleShareQuiz(quiz)}
                            className="text-slate-400 hover:text-indigo-600 p-1 rounded-lg"
                            title="Chia sẻ link thi"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                            title="Xóa đề thi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleStartQuiz(quiz)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                          >
                            <Play className="w-2.5 h-2.5 fill-white" /> Làm bài thi
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "bank" && (
          <QuestionBankView
            questions={questions}
            onAddQuestions={handleAddQuestions}
            onDeleteQuestion={handleDeleteQuestion}
            spreadsheetId={spreadsheetId}
            isLoading={isLoading}
            onSyncToSheets={handleSyncQuestionsToSheets}
          />
        )}

        {activeTab === "builder" && (
          <QuizBuilderView
            questionBank={questions}
            onAddQuiz={handleAddQuiz}
            onAddQuestions={handleAddQuestions}
          />
        )}

        {activeTab === "runner" && activeQuiz && (
          <QuizRunnerView quiz={activeQuiz} onSubmitQuiz={handleGrading} />
        )}

        {activeTab === "results" && lastResult && (
          <QuizResultsView
            result={lastResult}
            isSyncing={isSyncingResult}
            syncError={syncResultError}
            spreadsheetId={spreadsheetId}
            isStudentMode={isStudentMode}
            onBackToHome={() => {
              setLastResult(null);
              setActiveTab("dashboard");
              setIsStudentMode(false);
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
          />
        )}
      </main>

      {/* Footer system */}
      <footer className="bg-white border-t border-slate-100 py-6 px-6 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Quiz Builder & Question Bank. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Kết nối đám mây thông qua <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Google Sheets API
          </p>
        </div>
      </footer>

      {/* Custom Confirmation Modal for Quiz Deletion */}
      {deleteQuizId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="confirm-delete-quiz-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa đề thi</h3>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn xóa đề thi này không? Hành động này sẽ gỡ bỏ đề thi khỏi danh sách hiển thị (các câu hỏi trong ngân hàng vẫn được giữ nguyên).
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteQuizId(null)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteQuiz}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer text-center"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Code Modal */}
      {shareCodeModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="share-code-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 text-center">Chia sẻ bài thi</h3>
            <p className="text-sm text-slate-600 text-center">
              Để học sinh có thể truy cập và làm bài thi này, hãy gửi cho họ mã bài thi dưới đây.
            </p>
            
            <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Mã Bài Thi</span>
              <span className="text-5xl font-black text-indigo-600 tracking-[0.2em]">{shareCodeModal.code}</span>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-sm text-indigo-800 space-y-2">
              <p><strong>Lưu ý quan trọng:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Bảo đảm bạn đã đăng nhập và đồng bộ Google Sheets, kết quả thi sẽ tự động đổ về sheet của bạn.</li>
                <li>Bạn có thể copy URL của ứng dụng ở trên thanh địa chỉ, và nhắc học sinh chọn nút <strong>Học sinh: Nhập mã thi</strong>.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShareCodeModal(null)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Global Notification Modal */}
      {globalNotification && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="global-notification-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 transform scale-100 transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${globalNotification.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {globalNotification.type === "success" ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">Thông báo hệ thống</h3>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed">
              {globalNotification.message}
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setGlobalNotification(null)}
                className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer text-center"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
