import React, { useState } from "react";
import { Question, Quiz } from "../types";
import { FileText, Sparkles, Database, Clock, Play, Plus, Trash2, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Check, ListChecks } from "lucide-react";
import { parseAzotaTextLocally } from "../utils";

interface QuizBuilderViewProps {
  questionBank: Question[];
  onAddQuiz: (quiz: Quiz) => void;
  onAddQuestions: (questions: Question[]) => void;
}

export default function QuizBuilderView({ questionBank, onAddQuiz, onAddQuestions }: QuizBuilderViewProps) {
  // Navigation tabs for creation method
  const [methodTab, setMethodTab] = useState<"azota" | "bank">("azota");

  // General Quiz State
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(15);

  // 1. "Azota" State: raw text parsing
  const [rawText, setRawText] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);

  // 2. "Bank Selection" State
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Handles adding parsed questions to the current quiz selection and the bank
  const handleImportParsedToBank = () => {
    if (parsedQuestions.length === 0) return;
    onAddQuestions(parsedQuestions);
    // Auto-select them for the current quiz creation
    const ids = parsedQuestions.map((q) => q.id);
    setSelectedBankQuestionIds([...selectedBankQuestionIds, ...ids]);
    setParsedQuestions([]);
    setRawText("");
    setNotification({
      message: `Đã nhập thành công ${ids.length} câu hỏi vào Ngân hàng câu hỏi!`,
      type: "success",
    });
  };

  const handleParseText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsParsing(true);
    setParseError(null);
    setParsedQuestions([]);

    try {
      // Simulate slight delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const parsed = parseAzotaTextLocally(rawText, defaultCategory.trim());
      
      if (parsed.length === 0) {
        throw new Error("Không tìm thấy câu hỏi nào. Vui lòng kiểm tra lại định dạng.");
      }

      const finalQ: Question[] = parsed.map((q, idx) => ({
        ...q,
        id: `q-parsed-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      }));
      
      setParsedQuestions(finalQ);
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || "Đã xảy ra lỗi không xác định khi phân tích văn bản.");
    } finally {
      setIsParsing(false);
    }
  };

  const toggleBankQuestionSelection = (id: string) => {
    if (selectedBankQuestionIds.includes(id)) {
      setSelectedBankQuestionIds(selectedBankQuestionIds.filter((qid) => qid !== id));
    } else {
      setSelectedBankQuestionIds([...selectedBankQuestionIds, id]);
    }
  };

  // Build the quiz out of selected questions
  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();

    let finalQuestions: Question[] = [];

    if (methodTab === "azota") {
      // If we parsed questions, we should include them
      if (parsedQuestions.length > 0) {
        // Auto import them
        onAddQuestions(parsedQuestions);
        finalQuestions = [...parsedQuestions];
        setParsedQuestions([]);
      } else {
        setNotification({
          message: "Vui lòng dán văn bản đề thi và ấn nút Phân tích câu hỏi trước khi tạo bài thi.",
          type: "error",
        });
        return;
      }
    } else {
      // Pull questions from bank
      finalQuestions = questionBank.filter((q) => selectedBankQuestionIds.includes(q.id));
      if (finalQuestions.length === 0) {
        setNotification({
          message: "Vui lòng tích chọn ít nhất 1 câu hỏi từ Ngân hàng câu hỏi bên dưới.",
          type: "error",
        });
        return;
      }
    }

    if (!quizTitle.trim()) {
      setNotification({
        message: "Vui lòng nhập Tiêu đề bài thi.",
        type: "error",
      });
      return;
    }

    const newQuiz: Quiz = {
      id: `quiz-${Date.now()}`,
      title: quizTitle.trim(),
      description: quizDescription.trim() || "Không có mô tả.",
      questions: finalQuestions,
      timeLimitMinutes: timeLimit,
      createdAt: new Date().toLocaleString("vi-VN"),
    };

    onAddQuiz(newQuiz);

    // Clear state
    setQuizTitle("");
    setQuizDescription("");
    setSelectedBankQuestionIds([]);
    setNotification({
      message: "Đã tạo bài thi thành công! Bài thi của bạn đã sẵn sàng được học sinh tham gia.",
      type: "success",
    });
  };

  const insertSampleText = () => {
    const sample = `Phần 1. TRẮC NGHIỆM
Câu 1. Trong cuộc khai thác thuộc địa lần thứ hai ở Đông Dương 1919-1929, thực dân Pháp tập trung đầu tư vào
*A. Ngành chế tạo máy.      B. Công nghiệp luyện kim.
C. Đồn điền cao su.        D. Công nghiệp hóa chất.

Câu 2. Nội dung nào sau đây phản ánh đúng tình hình Việt Nam sau Hiệp định Giơnevơ năm 1954 về Đông Dương?
A. Đất nước tạm thời bị chia cắt làm hai miền Nam, Bắc. 
*B. Miền Bắc chưa được giải phóng. 
C. Miền Nam đã được giải phóng.
D. Cả nước được giải phóng và tiến lên xây dựng chủ nghĩa xã hội. 

PHẦN II. Câu trắc nghiệm đúng sai.
Câu 3. Một cuộc thi bắn cung có 20 người tham gia. Trong lần bắn đầu tiên có 18 người bắn trúng mục tiêu.
*a)[0,NB] Số người bắn trượt mục tiêu trong lần đầu tiên là 2.
b)[1,NB] Số người bắn trượt mục tiêu trong lần bắn thứ hai là 6.
c)[2,TH] Số người bắn trượt mục tiêu trong lần bắn thứ nhất và thứ hai nhiều nhất là 8.
*d)[3,VD] Số người bắn trúng mục tiêu trong cả ba lần bắn ít nhất là 3.`;
    setRawText(sample);
    setDefaultCategory("Lịch sử");
  };

  return (
    <div className="space-y-6" id="quiz-builder-container">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" /> Soạn Đề Thi Nhanh
        </h1>
        <p className="text-sm text-slate-500">
          Thiết lập tiêu đề bài thi và tự động sinh đề bằng AI (Azota-style) hoặc lựa chọn từ ngân hàng (Moodle-style)
        </p>
      </div>

      {/* Main Settings Form */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">
          Bước 1: Thông tin cấu trúc bài thi
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-600">Tiêu đề bài thi *</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Kiểm tra 15 phút - Địa lý 11, Đề khảo sát giữa kỳ II môn Toán..."
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" /> Thời gian làm bài (Phút)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 15)}
              className="w-full text-xs px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>

          <div className="md:col-span-3 space-y-2">
            <label className="text-xs font-semibold text-slate-600">Mô tả hoặc Hướng dẫn làm bài</label>
            <textarea
              rows={2}
              placeholder="Hướng dẫn học sinh đọc kỹ câu hỏi và nộp bài trước khi hết giờ..."
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      {/* Selection of Method */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2">
            Bước 2: Tạo lập nội dung câu hỏi bài thi
          </h2>
          <p className="text-xs text-slate-400">Chọn phương thức lấy câu hỏi đưa vào đề thi</p>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-100 pb-px">
          <button
            onClick={() => setMethodTab("azota")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              methodTab === "azota"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Sparkles className="w-4 h-4" /> Tự động phân tích từ Văn bản/Word (Azota-style)
          </button>
          <button
            onClick={() => setMethodTab("bank")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              methodTab === "bank"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Database className="w-4 h-4" /> Chọn từ Ngân hàng câu hỏi ({questionBank.length} câu có sẵn)
          </button>
        </div>

        {/* 1. Azota Input Pane */}
        {methodTab === "azota" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Dán đề thi dạng thô (Word hoặc văn bản tự soạn):</span>
              <button
                type="button"
                onClick={insertSampleText}
                className="text-[11px] text-indigo-600 hover:underline font-semibold"
              >
                Nhập văn bản mẫu &rarr;
              </button>
            </div>

            <textarea
              rows={8}
              placeholder="Ví dụ:
Câu 1: Hà Nội là thủ đô của nước nào?
A. Pháp
B. Việt Nam
C. Mỹ
D. Lào

Câu 2: Việt Nam nằm ở châu Á?
A. Đúng
B. Sai..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full text-xs font-mono px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all focus:ring-1 focus:ring-indigo-400"
            />

            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <input
                type="text"
                placeholder="Nhập chủ đề/danh mục chung (ví dụ: Địa lý, Toán học...)"
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                className="w-full sm:w-64 text-xs px-3 py-2 border border-slate-200 rounded-lg"
              />

              <button
                onClick={handleParseText}
                disabled={isParsing || !rawText.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang phân tích dữ liệu...
                  </>
                ) : (
                  <>
                    <ListChecks className="w-3.5 h-3.5" /> Phân tích câu hỏi tự động
                  </>
                )}
              </button>
            </div>

            {parseError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Display parsed result preview */}
            {parsedQuestions.length > 0 && (
              <div className="border border-indigo-100 bg-indigo-50/20 rounded-xl p-4 mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Kết quả phân tích thành công: {parsedQuestions.length} câu hỏi
                  </h3>
                  <button
                    onClick={handleImportParsedToBank}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold"
                  >
                    Lưu tất cả vào Ngân hàng câu hỏi &rarr;
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 bg-white rounded-xl p-3">
                  {parsedQuestions.map((q, idx) => (
                    <div key={idx} className="text-xs border-b border-slate-50 pb-2 mb-2 last:border-0 last:pb-0">
                      <p className="font-bold text-slate-800">
                        {idx + 1}. {q.questionText}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Dạng: {q.questionType === "single" ? "Trắc nghiệm 1 đáp án" : q.questionType === "multiple" ? "Trắc nghiệm nhiều đáp án" : q.questionType === "true_false" ? "Đúng/Sai" : q.questionType === "true_false_cluster" ? "Cụm Đúng/Sai" : "Trả lời ngắn"} | Đúng: {q.correctAnswers.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Bank Selector Pane */}
        {methodTab === "bank" && (
          <div className="space-y-4">
            {questionBank.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-400 font-medium">Ngân hàng câu hỏi của bạn hiện tại chưa có dữ liệu.</p>
                <button
                  type="button"
                  onClick={() => setMethodTab("azota")}
                  className="text-xs text-indigo-600 hover:underline mt-1 font-semibold"
                >
                  Hãy dán đề thi bên tab tự động để nạp dữ liệu câu hỏi trước &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">Tích chọn các câu hỏi đưa vào bài thi:</span>
                <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-xl p-3 divide-y divide-slate-50 space-y-3 bg-slate-50/50">
                  {questionBank.map((q) => {
                    const isSelected = selectedBankQuestionIds.includes(q.id);
                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleBankQuestionSelection(q.id)}
                        className={`p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected ? "bg-indigo-50 border border-indigo-100" : "hover:bg-white border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handled by div onClick
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5 shrink-0"
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-slate-800">{q.questionText}</p>
                          <div className="flex gap-2">
                            <span className="text-[9px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {q.category}
                            </span>
                            <span className="text-[9px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              {q.difficulty}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-xs text-right text-slate-500 font-medium pt-1">
                  Đã chọn <strong className="text-indigo-600 font-bold">{selectedBankQuestionIds.length}</strong> /{" "}
                  {questionBank.length} câu hỏi.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Build Action */}
        <div className="border-t border-slate-50 pt-5 flex justify-end">
          <button
            onClick={handleCreateQuiz}
            className="inline-flex items-center gap-1.5 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
          >
            Hoàn tất thiết lập & Tạo đề thi <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Custom Notification Modal */}
      {notification && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="builder-notification-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 transform scale-100 transition-all">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${notification.type === "success" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                {notification.type === "success" ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-slate-900">Thông báo hệ thống</h3>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed">
              {notification.message}
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setNotification(null)}
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
