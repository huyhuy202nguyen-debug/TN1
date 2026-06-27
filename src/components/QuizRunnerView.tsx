import React, { useState, useEffect, useRef } from "react";
import { Quiz, AnswerSubmission } from "../types";
import { Clock, User, Award, HelpCircle, ArrowRight, Play, CheckCircle, AlertTriangle } from "lucide-react";

interface QuizRunnerViewProps {
  quiz: Quiz;
  onSubmitQuiz: (studentName: string, submissions: AnswerSubmission[]) => void;
}

export default function QuizRunnerView({ quiz, onSubmitQuiz }: QuizRunnerViewProps) {
  const [studentName, setStudentName] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [nameError, setNameError] = useState("");

  // Active exam state
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string[]>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(quiz.timeLimitMinutes * 60);

  // Active index for scrolling or pagination focus
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start the timer when the exam begins
  useEffect(() => {
    if (isStarted && quiz.timeLimitMinutes > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Auto submit when time hits zero
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted]);

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setNameError("Vui lòng nhập Họ và Tên của bạn để bắt đầu làm bài.");
      return;
    }
    setIsStarted(true);
  };

  const handleSelectAnswer = (qId: string, value: string, isMulti: boolean) => {
    const existing = currentAnswers[qId] || [];

    if (isMulti) {
      if (existing.includes(value)) {
        setCurrentAnswers({
          ...currentAnswers,
          [qId]: existing.filter((item) => item !== value),
        });
      } else {
        setCurrentAnswers({
          ...currentAnswers,
          [qId]: [...existing, value],
        });
      }
    } else {
      // Single choice, true_false, short_answer
      setCurrentAnswers({
        ...currentAnswers,
        [qId]: [value],
      });
    }
  };

  const handleClusterAnswer = (qId: string, optIndex: number, value: string, totalOptions: number) => {
    const existing = currentAnswers[qId] || new Array(totalOptions).fill("");
    const newAnswers = [...existing];
    newAnswers[optIndex] = value;
    setCurrentAnswers({
      ...currentAnswers,
      [qId]: newAnswers,
    });
  };

  const handleTextChange = (qId: string, val: string) => {
    setCurrentAnswers({
      ...currentAnswers,
      [qId]: [val],
    });
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirm(false);
    if (timerRef.current) clearInterval(timerRef.current);

    // Compile into AnswerSubmission format
    const compiledAnswers: AnswerSubmission[] = quiz.questions.map((q) => ({
      questionId: q.id,
      selectedAnswers: currentAnswers[q.id] || [],
    }));

    onSubmitQuiz(studentName.trim(), compiledAnswers);
  };

  const handleSubmit = (auto: boolean = false) => {
    if (auto) {
      if (timerRef.current) clearInterval(timerRef.current);
      const compiledAnswers: AnswerSubmission[] = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedAnswers: currentAnswers[q.id] || [],
      }));
      onSubmitQuiz(studentName.trim(), compiledAnswers);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-2xl p-8 shadow-md" id="quiz-runner-start">
        <div className="text-center space-y-4 mb-8">
          <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Award className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight">{quiz.title}</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{quiz.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-y border-slate-50 py-4 mb-6 text-center bg-slate-50/50 rounded-xl">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-slate-400">Số câu hỏi</p>
            <p className="text-lg font-bold text-indigo-600">{quiz.questions.length} câu</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-slate-400">Thời gian làm bài</p>
            <p className="text-lg font-bold text-indigo-600">
              {quiz.timeLimitMinutes > 0 ? `${quiz.timeLimitMinutes} phút` : "Không giới hạn"}
            </p>
          </div>
        </div>

        <form onSubmit={handleStartExam} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-indigo-600" /> Nhập Họ và Tên của học sinh để bắt đầu:
            </label>
            <input
              type="text"
              required
              placeholder="Nhập tên đầy đủ của bạn..."
              value={studentName}
              onChange={(e) => {
                setStudentName(e.target.value);
                if (e.target.value.trim()) setNameError("");
              }}
              className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold text-slate-800"
            />
            {nameError && (
              <p className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" /> {nameError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Bắt đầu làm bài <Play className="w-4 h-4 fill-white" />
          </button>
        </form>
      </div>
    );
  }

  const activeQuestion = quiz.questions[activeQuestionIdx];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="quiz-runner-active">
      {/* Question Navigation & Timer block (Col 1 on desktop) */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 h-fit order-first lg:order-last">
        {/* Timer Panel */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 text-center shadow">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className={`w-5 h-5 ${secondsRemaining < 60 ? "text-rose-400 animate-pulse" : "text-indigo-400"}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Thời gian còn lại</span>
          </div>
          <p
            className={`text-3xl font-bold tracking-tight font-mono ${
              secondsRemaining < 60 ? "text-rose-500 animate-pulse" : ""
            }`}
          >
            {formatTime(secondsRemaining)}
          </p>
        </div>

        {/* Question grid navigation (Moodle-style) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Danh sách câu hỏi</h3>
          <div className="grid grid-cols-5 gap-2">
            {quiz.questions.map((q, idx) => {
              const isAnswered = (currentAnswers[q.id] || []).length > 0;
              const isActive = activeQuestionIdx === idx;
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`aspect-square inline-flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : isAnswered
                      ? "bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                      : "bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handleSubmit(false)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" /> Nộp bài thi
          </button>
        </div>
      </div>

      {/* Main quiz interface (Col 3 on desktop) */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              Bài thi: {quiz.title}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Câu {activeQuestionIdx + 1} / {quiz.questions.length}
            </span>
          </div>

          {/* Question Text block */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Dạng:{" "}
                {activeQuestion.questionType === "single"
                  ? "Chọn một đáp án"
                  : activeQuestion.questionType === "multiple"
                  ? "Chọn nhiều đáp án"
                  : activeQuestion.questionType === "true_false"
                  ? "Đúng hoặc Sai"
                  : activeQuestion.questionType === "true_false_cluster"
                  ? "Cụm Đúng/Sai"
                  : "Điền câu trả lời ngắn"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Chủ đề: {activeQuestion.category}
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-800 pt-3 leading-relaxed">
              {activeQuestion.questionText}
            </h2>
          </div>

          {/* Answer Area depending on question type */}
          <div className="mt-6 space-y-3">
            {activeQuestion.questionType === "single" && (
              <div className="grid grid-cols-1 gap-2.5">
                {activeQuestion.options.map((option, idx) => {
                  const isChecked = (currentAnswers[activeQuestion.id] || []).includes(option);
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-indigo-50/75 border-indigo-200 text-indigo-950 font-medium shadow-sm"
                          : "bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${activeQuestion.id}`}
                        checked={isChecked}
                        onChange={() => handleSelectAnswer(activeQuestion.id, option, false)}
                        className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0"
                      />
                      <div className="flex items-start gap-1 text-sm">
                        <span className="font-bold text-slate-400 shrink-0 uppercase">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <span>{option}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {activeQuestion.questionType === "multiple" && (
              <div className="grid grid-cols-1 gap-2.5">
                {activeQuestion.options.map((option, idx) => {
                  const isChecked = (currentAnswers[activeQuestion.id] || []).includes(option);
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-indigo-50/75 border-indigo-200 text-indigo-950 font-medium shadow-sm"
                          : "bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSelectAnswer(activeQuestion.id, option, true)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 shrink-0"
                      />
                      <div className="flex items-start gap-1 text-sm">
                        <span className="font-bold text-slate-400 shrink-0 uppercase">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <span>{option}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {activeQuestion.questionType === "true_false" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {["Đúng", "Sai"].map((option, idx) => {
                  const isChecked = (currentAnswers[activeQuestion.id] || []).includes(option);
                  return (
                    <label
                      key={idx}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-indigo-50/75 border-indigo-200 text-indigo-950 font-medium shadow-sm"
                          : "bg-slate-50/50 border-slate-100 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${activeQuestion.id}`}
                        checked={isChecked}
                        onChange={() => handleSelectAnswer(activeQuestion.id, option, false)}
                        className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0"
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {activeQuestion.questionType === "true_false_cluster" && (
              <div className="grid grid-cols-1 gap-4">
                {activeQuestion.options.map((option, idx) => {
                   const answerValue = (currentAnswers[activeQuestion.id] || [])[idx];
                   return (
                     <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                       <span className="text-sm font-medium text-slate-800">{option}</span>
                       <div className="flex items-center gap-2 shrink-0">
                         {["Đúng", "Sai"].map(choice => (
                           <label key={choice} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${answerValue === choice ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                             <input type="radio" name={`q-${activeQuestion.id}-${idx}`} checked={answerValue === choice} onChange={() => handleClusterAnswer(activeQuestion.id, idx, choice, activeQuestion.options.length)} className="w-3.5 h-3.5 text-indigo-600" />
                             <span className="text-xs">{choice}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                   );
                })}
              </div>
            )}

            {activeQuestion.questionType === "short_answer" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Nhập câu trả lời ngắn của bạn:</label>
                <input
                  type="text"
                  placeholder="Nhập đáp án..."
                  value={currentAnswers[activeQuestion.id]?.[0] || ""}
                  onChange={(e) => handleTextChange(activeQuestion.id, e.target.value)}
                  className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-semibold text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Navigation between active questions */}
          <div className="flex items-center justify-between border-t border-slate-50 mt-8 pt-4">
            <button
              disabled={activeQuestionIdx === 0}
              onClick={() => setActiveQuestionIdx((prev) => prev - 1)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            >
              Câu trước
            </button>

            {activeQuestionIdx < quiz.questions.length - 1 ? (
              <button
                onClick={() => setActiveQuestionIdx((prev) => prev + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Tiếp tục <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Nộp bài thi <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Info advice card */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Hệ thống tự động chấm điểm chi tiết sẽ phân tích từng câu trả lời và so khớp với đáp án chuẩn. Khi nộp bài thi, kết quả sẽ được tải trực tiếp lên Google Sheets nếu trang tính của giáo viên được kết nối.
          </p>
        </div>
      </div>

      {/* Custom Confirmation Modal for Submitting */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="confirm-submit-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-xl">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Xác nhận nộp bài thi</h3>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn nộp bài thi? Hệ thống sẽ ghi nhận câu trả lời và tự động chấm điểm chi tiết cho bạn ngay lập tức.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer text-center"
              >
                Đồng ý nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
