import React from "react";
import { SubmissionResult, Quiz } from "../types";
import { Award, CheckCircle, XCircle, FileSpreadsheet, RefreshCw, AlertCircle, Home, HelpCircle, Check } from "lucide-react";
import { LatexRenderer } from "./LatexRenderer";

interface QuizResultsViewProps {
  quiz?: Quiz;
  result: SubmissionResult;
  isSyncing: boolean;
  syncError: string | null;
  spreadsheetId: string | null;
  isStudentMode?: boolean;
  onBackToHome: () => void;
  onRetrySync?: () => void;
}

export default function QuizResultsView({
  quiz,
  result,
  isSyncing,
  syncError,
  spreadsheetId,
  isStudentMode = false,
  onBackToHome,
  onRetrySync,
}: QuizResultsViewProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8.0) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (score >= 5.0) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-100";
  };

  const shouldShowScore = !isStudentMode || !quiz || quiz.showScore === "when_finished" || quiz.showScore === undefined;
  const shouldShowAnswers = !isStudentMode || !quiz || quiz.showAnswers === "when_finished" || quiz.showAnswers === undefined;
  const hideCorrectAnswerForWrong = isStudentMode && quiz?.hideCorrectAnswerForWrong;

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
            Học sinh: <strong className="text-slate-700 font-semibold">{result.studentName} {result.studentClass && `- Lớp: ${result.studentClass}`}</strong> | Bài thi:{" "}
            <strong className="text-slate-700 font-semibold">{result.quizTitle}</strong>
          </p>
          {!shouldShowScore && (
             <p className="text-xs text-amber-600 font-medium bg-amber-50 inline-block px-3 py-1 rounded-full mt-2">
               Điểm số đang được ẩn theo cài đặt của giáo viên.
             </p>
          )}
        </div>

        {shouldShowScore && (
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
        )}

        {/* Sheets Sync Status Badge */}
        <div className="pt-2">
          {isStudentMode ? (
            isSyncing ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang gửi kết quả về máy chủ...
              </div>
            ) : syncError ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Gửi kết quả thất bại: {syncError}
                </div>
                {onRetrySync && (
                  <button
                    onClick={onRetrySync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 animate-pulse" /> Thử gửi lại
                  </button>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-medium">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Kết quả thi đã được gửi cho giáo viên thành công!
              </div>
            )
          ) : spreadsheetId ? (
            isSyncing ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang đồng bộ kết quả thi lên Google Sheets...
              </div>
            ) : syncError ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Đồng bộ thất bại: {syncError}
                </div>
                {onRetrySync && (
                  <button
                    onClick={onRetrySync}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 animate-pulse" /> Thử gửi lại
                  </button>
                )}
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
      {shouldShowAnswers ? (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800">Báo cáo tự chấm điểm chi tiết</h2>

          <div className="space-y-4">
            {result.detailedGrades.map((grade, idx) => {
              const isCorrect = grade.isCorrect;
              const shouldHideCorrectAnswer = !isCorrect && hideCorrectAnswerForWrong;

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
                  <p className="text-sm font-semibold text-slate-800 mb-4"><LatexRenderer>{grade.questionText || quiz?.questions.find(q => q.id === grade.questionId)?.questionText || "Đang tải câu hỏi..."}</LatexRenderer></p>
                  {grade.imageUrl && (
                    <div className="mb-4">
                      <img src={grade.imageUrl} alt="Question image" className="max-h-48 object-contain rounded-lg border border-slate-200" />
                    </div>
                  )}

                  {(() => {
                    const qType = grade.questionType || quiz?.questions.find(q => q.id === grade.questionId)?.questionType;
                    const options = grade.options || quiz?.questions.find(q => q.id === grade.questionId)?.options || [];

                    if (qType === "case_study") {
                      const subGrades = grade.subGrades || [];
                      return (
                        <div className="space-y-4 border-l-2 border-indigo-100 pl-4 mt-2">
                          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Kết quả câu hỏi phụ:</p>
                          {subGrades.map((subG: any, sIdx: number) => {
                            const subIsCorrect = subG.isCorrect;
                            const subShouldHideCorrect = !subIsCorrect && hideCorrectAnswerForWrong;
                            return (
                              <div key={subG.questionId} className="p-3 bg-slate-50 border border-slate-100/80 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">Câu {sIdx + 1}</span>
                                    <span className="text-[10px] font-medium text-slate-400 uppercase">
                                      {subG.questionType === "single"
                                        ? "1 đáp án"
                                        : subG.questionType === "multiple"
                                        ? "Nhiều đáp án"
                                        : subG.questionType === "true_false"
                                        ? "Đúng/Sai"
                                        : "Trả lời ngắn"}
                                    </span>
                                  </div>
                                  {subIsCorrect ? (
                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded">
                                      <CheckCircle className="w-3 h-3" /> Đúng
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 bg-rose-50 px-1.5 py-0.5 rounded">
                                      <XCircle className="w-3 h-3" /> Sai
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-semibold text-slate-800 leading-relaxed"><LatexRenderer>{subG.questionText}</LatexRenderer></h4>
                                
                                {subG.options && subG.options.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {subG.options.map((subOpt: any, subOIdx: number) => {
                                      const isStudentChoice = subG.studentAnswers.includes(subOpt);
                                      const isCorrectChoice = subG.correctAnswers.includes(subOpt);
                                      
                                      let optStyle = "bg-white border-slate-100 text-slate-500";
                                      if (!subShouldHideCorrect && isCorrectChoice) {
                                         optStyle = "bg-emerald-50 border-emerald-100 text-emerald-800 font-medium";
                                      } else if (isStudentChoice) {
                                         optStyle = "bg-rose-50 border-rose-100 text-rose-800";
                                      }

                                      return (
                                        <div key={subOIdx} className={`text-[11px] px-2.5 py-1.5 border rounded-lg ${optStyle}`}>
                                          <span className="font-bold text-slate-400 mr-1 uppercase">{String.fromCharCode(65 + subOIdx)}.</span>
                                          <LatexRenderer>{subOpt}</LatexRenderer>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {subG.questionType === "true_false" && (
                                  <div className="flex gap-2">
                                    {["Đúng", "Sai"].map((choice: string) => {
                                      const isStudentChoice = subG.studentAnswers.includes(choice);
                                      const isCorrectChoice = subG.correctAnswers.includes(choice);
                                      
                                      let choiceStyle = "bg-white border-slate-100 text-slate-500";
                                      if (!subShouldHideCorrect && isCorrectChoice) {
                                        choiceStyle = "bg-emerald-50 border-emerald-100 text-emerald-800 font-semibold";
                                      } else if (isStudentChoice) {
                                        choiceStyle = "bg-rose-50 border-rose-100 text-rose-800";
                                      }

                                      return (
                                        <span key={choice} className={`px-2.5 py-1 text-[11px] border rounded-lg ${choiceStyle}`}>
                                          {choice}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}

                                {subG.questionType === "short_answer" && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="bg-white border border-slate-100 p-2 rounded-lg">
                                      <p className="text-[9px] uppercase font-bold text-slate-400">Bạn trả lời</p>
                                      <p className="text-xs font-semibold text-slate-700">{subG.studentAnswers[0] || "(Trống)"}</p>
                                    </div>
                                    {!subShouldHideCorrect && (
                                      <div className="bg-emerald-50/55 border border-emerald-100/50 p-2 rounded-lg">
                                        <p className="text-[9px] uppercase font-bold text-emerald-600">Đáp án chính xác</p>
                                        <p className="text-xs font-semibold text-emerald-800">{subG.correctAnswers.join(" | ")}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {!subShouldHideCorrect && subG.explanation && (
                                  <p className="text-[10px] text-slate-500 italic flex items-center gap-1 bg-white/50 p-1.5 rounded border border-slate-100/50 mt-1">
                                    <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    <span>Giải thích: <LatexRenderer>{subG.explanation}</LatexRenderer></span>
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Question Options preview */}
                        {options.length > 0 && qType !== "true_false_cluster" && (
                          <div className="flex flex-col gap-2 mb-4">
                            {options.map((opt, i) => {
                              const isStudentChoice = grade.studentAnswers.includes(opt);
                              const isCorrectChoice = grade.correctAnswers.includes(opt);
                              
                              let optStyle = "bg-white border-slate-200 text-slate-700";
                              if (!shouldHideCorrectAnswer && isCorrectChoice) {
                                 optStyle = "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium";
                              } else if (isStudentChoice) {
                                 optStyle = "bg-rose-50 border-rose-200 text-rose-800";
                              }

                              return (
                                <div key={i} className={`text-sm px-3 py-2 border rounded-lg ${optStyle}`}>
                                  <LatexRenderer>{opt}</LatexRenderer>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Answers display */}
                        {qType === "true_false_cluster" && options.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {options.map((opt, i) => {
                              const stAns = grade.studentAnswers[i];
                              const correctAns = grade.correctAnswers[i];
                              const isCorrectStatement = stAns === correctAns;
                              const isMissing = !stAns;
                              
                              return (
                                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg gap-2">
                                  <div className="text-sm text-slate-700 flex-1"><LatexRenderer>{opt}</LatexRenderer></div>
                                  <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
                                    <div className="flex flex-col items-end">
                                      <span className="text-[10px] text-slate-400 uppercase">Bạn chọn</span>
                                      <span className={isMissing ? "text-slate-500" : isCorrectStatement ? "text-emerald-600" : "text-rose-600"}>{stAns || "(Trống)"}</span>
                                    </div>
                                    {!shouldHideCorrectAnswer && (
                                      <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-slate-400 uppercase">Đáp án</span>
                                        <span className="text-emerald-600">{correctAns}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                              <p className="text-[10px] font-bold uppercase text-slate-400">Câu trả lời của bạn</p>
                              <p className={`text-xs font-semibold mt-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                                {grade.studentAnswers.length > 0 ? <LatexRenderer>{grade.studentAnswers.join(", ")}</LatexRenderer> : "(Bỏ trống)"}
                              </p>
                            </div>

                            {!shouldHideCorrectAnswer && (
                              <div className="bg-emerald-50/35 border border-emerald-100/50 rounded-xl p-3">
                                <p className="text-[10px] font-bold uppercase text-emerald-600">Đáp án chính xác</p>
                                <p className="text-xs font-semibold text-emerald-800 mt-1">
                                  <LatexRenderer>{grade.correctAnswers.join(", ")}</LatexRenderer>
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* AI Explanation Feedback */}
                  {!shouldHideCorrectAnswer && grade.explanation && (
                    <div className="bg-indigo-50/30 border border-indigo-100/40 rounded-xl p-3 flex items-start gap-2.5 text-xs">
                      <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-indigo-950 mb-0.5">Lời giải thích chi tiết:</p>
                        <div className="text-indigo-900 leading-relaxed italic">
                          <LatexRenderer>{grade.explanation}</LatexRenderer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
          <p className="text-sm font-medium text-slate-600">
            Chi tiết đề thi và đáp án đang được ẩn theo cài đặt của giáo viên.
          </p>
        </div>
      )}

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
