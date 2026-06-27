import React from "react";
import { SubmissionResult } from "../types";
import { Award, CheckCircle, XCircle, FileSpreadsheet, RefreshCw, AlertCircle, Home, HelpCircle, Check } from "lucide-react";

interface QuizResultsViewProps {
  result: SubmissionResult;
  isSyncing: boolean;
  syncError: string | null;
  spreadsheetId: string | null;
  onBackToHome: () => void;
}

export default function QuizResultsView({
  result,
  isSyncing,
  syncError,
  spreadsheetId,
  onBackToHome,
}: QuizResultsViewProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8.0) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (score >= 5.0) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-100";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" id="quiz-results-container">
      {/* Score Summary Banner */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-4">
        <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
          <Award className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-800">Kết quả thi trắc nghiệm</h1>
          <p className="text-xs text-slate-400">
            Học sinh: <strong className="text-slate-700 font-semibold">{result.studentName}</strong> | Bài thi:{" "}
            <strong className="text-slate-700 font-semibold">{result.quizTitle}</strong>
          </p>
        </div>

        {/* Big Score Bubble */}
        <div className="flex justify-center items-center gap-6 py-2">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Điểm số</p>
            <div
              className={`text-4xl sm:text-5xl font-black px-6 py-3 rounded-2xl border ${getScoreColor(
                result.score
              )} font-mono mt-1`}
            >
              {result.score.toFixed(1)}
            </div>
          </div>

          <div className="text-left space-y-1">
            <p className="text-xs text-slate-500 font-medium">
              Số câu trả lời đúng:{" "}
              <strong className="text-slate-800 font-bold">
                {result.correctCount} / {result.totalQuestions}
              </strong>
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Tỷ lệ chính xác:{" "}
              <strong className="text-slate-800 font-bold">
                {Math.round((result.correctCount / result.totalQuestions) * 100)}%
              </strong>
            </p>
            <p className="text-xs text-slate-400">Nộp lúc: {result.submittedAt}</p>
          </div>
        </div>

        {/* Sheets Sync Status Badge */}
        <div className="pt-2">
          {spreadsheetId ? (
            isSyncing ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang đồng bộ kết quả thi lên Google Sheets...
              </div>
            ) : syncError ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Đồng bộ thất bại: {syncError}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-medium">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> Kết quả thi đã được đồng bộ lên Google Sheets tự động!
              </div>
            )
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Chưa liên kết Google Sheets. Kết quả thi chỉ được lưu tạm thời.
            </div>
          )}
        </div>
      </div>

      {/* Detailed Evaluation Section */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-800">Báo cáo tự chấm điểm chi tiết</h2>

        <div className="space-y-4">
          {result.detailedGrades.map((grade, idx) => {
            const isCorrect = grade.isCorrect;
            return (
              <div
                key={grade.questionId}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all border-l-4 ${
                  isCorrect ? "border-l-emerald-500 border-slate-100" : "border-l-rose-500 border-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      Câu hỏi {idx + 1}
                    </span>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" /> Chính xác
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3" /> Chưa đúng
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text preview */}
                <p className="text-sm font-semibold text-slate-800 mb-4">{grade.explanation.split("---")[0] || "Đang tải câu hỏi..."}</p>

                {/* Answers display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Câu trả lời của bạn</p>
                    <p className={`text-xs font-semibold mt-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                      {grade.studentAnswers.length > 0 ? grade.studentAnswers.join(", ") : "(Bỏ trống)"}
                    </p>
                  </div>

                  <div className="bg-emerald-50/35 border border-emerald-100/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase text-emerald-600">Đáp án chính xác</p>
                    <p className="text-xs font-semibold text-emerald-800 mt-1">
                      {grade.correctAnswers.join(", ")}
                    </p>
                  </div>
                </div>

                {/* AI Explanation Feedback */}
                {grade.explanation && (
                  <div className="bg-indigo-50/30 border border-indigo-100/40 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                    <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-indigo-950 mb-0.5">Lời giải thích chi tiết:</p>
                      <p className="text-indigo-900 leading-relaxed italic">{grade.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Back home action */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" /> Quay lại Trang chủ
        </button>
      </div>
    </div>
  );
}
