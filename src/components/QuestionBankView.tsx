import React, { useState } from "react";
import { Question } from "../types";
import { Search, Plus, Sparkles, Trash2, Edit2, Database, HelpCircle, Save, Check, RefreshCw, ListChecks, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseAzotaTextLocally } from "../utils";

interface QuestionBankViewProps {
  questions: Question[];
  onAddQuestions: (newQuestions: Question[]) => void;
  onDeleteQuestion: (id: string) => void;
  spreadsheetId: string | null;
  isLoading: boolean;
  onSyncToSheets: () => void;
}

export default function QuestionBankView({
  questions,
  onAddQuestions,
  onDeleteQuestion,
  spreadsheetId,
  isLoading,
  onSyncToSheets,
}: QuestionBankViewProps) {
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);

  // Tab for manual creation vs AI generator vs Bulk import
  const [activeFormTab, setActiveFormTab] = useState<"manual" | "bulk" | "ai" | null>(null);

  // Manual Question state (with support for unlimited options)
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<Question["questionType"]>("single");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [selectedCorrectOptionIdx, setSelectedCorrectOptionIdx] = useState<number>(0);
  const [correctAnswerIndices, setCorrectAnswerIndices] = useState<number[]>([]); // Keeps track of checked indices
  const [explanation, setExplanation] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<Question["difficulty"]>("medium");

  // Bulk Import state
  const [bulkText, setBulkText] = useState("");
  const [isBulkParsing, setIsBulkParsing] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");
  const [parsedBulkQuestions, setParsedBulkQuestions] = useState<Question[]>([]);

  // AI Generator state
  const [aiTopic, setAiTopic] = useState("");
  const [aiQuantity, setAiQuantity] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<Question["difficulty"] | "mixed">("mixed");
  const [aiCategory, setAiCategory] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Categories list extraction
  const categories = Array.from(new Set(questions.map((q) => q.category))).filter(Boolean);

  // Filters application
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.explanation.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || q.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === "all" || q.difficulty === selectedDifficulty;
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // Dynamic Options functions
  const addOption = () => {
    setOptions([...options, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return; // Keep at least 2 options
    const newOptions = options.filter((_, i) => i !== idx);
    setOptions(newOptions);
    
    // Adjust single choice selected index
    if (selectedCorrectOptionIdx === idx) {
      setSelectedCorrectOptionIdx(0);
    } else if (selectedCorrectOptionIdx > idx) {
      setSelectedCorrectOptionIdx(selectedCorrectOptionIdx - 1);
    }

    // Adjust multi choice selected indices
    const updatedIndices = correctAnswerIndices
      .filter((i) => i !== idx)
      .map((i) => (i > idx ? i - 1 : i));
    setCorrectAnswerIndices(updatedIndices);
  };

  // Handle manual question option change
  const handleOptionChange = (idx: number, val: string) => {
    const newOptions = [...options];
    newOptions[idx] = val;
    setOptions(newOptions);
  };

  const handleAddManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    let finalOptions: string[] = [];
    let finalCorrectAnswers: string[] = [];

    if (questionType === "single") {
      finalOptions = options.filter((o) => o.trim() !== "");
      finalCorrectAnswers = [finalOptions[selectedCorrectOptionIdx] || finalOptions[0]];
    } else if (questionType === "multiple") {
      finalOptions = options.filter((o) => o.trim() !== "");
      // Gather correct option values based on checked indexes
      finalCorrectAnswers = correctAnswerIndices.map(idx => options[idx]).filter(val => val !== undefined && val.trim() !== "");
      if (finalCorrectAnswers.length === 0 && finalOptions.length > 0) {
        finalCorrectAnswers = [finalOptions[0]];
      }
    } else if (questionType === "true_false") {
      finalOptions = ["Đúng", "Sai"];
      finalCorrectAnswers = [selectedCorrectOptionIdx === 0 ? "Đúng" : "Sai"];
    } else {
      // short_answer
      finalOptions = [];
      finalCorrectAnswers = [explanation.split("\n")[0] || "Đáp án"]; // Placeholder if explanation not set
    }

    const newQ: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      questionText,
      questionType,
      options: finalOptions,
      correctAnswers: finalCorrectAnswers,
      explanation: explanation || "Chưa có lời giải thích.",
      category: category.trim() || "Chung",
      difficulty,
    };

    onAddQuestions([newQ]);
    resetForm();
  };

  const resetForm = () => {
    setQuestionText("");
    setQuestionType("single");
    setOptions(["", "", "", ""]);
    setSelectedCorrectOptionIdx(0);
    setCorrectAnswerIndices([]);
    setExplanation("");
    setCategory("");
    setDifficulty("medium");
    setActiveFormTab(null);
  };

  const resetBulkForm = () => {
    setBulkText("");
    setIsBulkParsing(false);
    setBulkError(null);
    setBulkCategory("");
    setParsedBulkQuestions([]);
    setActiveFormTab(null);
  };

  const insertBulkSampleText = () => {
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
    setBulkText(sample);
    setBulkCategory("Lịch sử");
  };

  const handleParseBulkText = async () => {
    if (!bulkText.trim()) return;

    setIsBulkParsing(true);
    setBulkError(null);
    setParsedBulkQuestions([]);

    try {
      // Simulate slight delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const parsed = parseAzotaTextLocally(bulkText, bulkCategory.trim());
      
      if (parsed.length === 0) {
        throw new Error("Không tìm thấy câu hỏi nào. Vui lòng kiểm tra lại định dạng.");
      }

      const finalQ: Question[] = parsed.map((q, idx) => ({
        ...q,
        id: `q-bulk-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      }));
      
      setParsedBulkQuestions(finalQ);
    } catch (err: any) {
      console.error(err);
      setBulkError(err.message || "Đã xảy ra lỗi không xác định khi phân tích văn bản.");
    } finally {
      setIsBulkParsing(false);
    }
  };

  const handleSaveBulkToBank = () => {
    if (parsedBulkQuestions.length === 0) return;
    onAddQuestions(parsedBulkQuestions);
    resetBulkForm();
  };

  const handleGenerateAIQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    setIsAiGenerating(true);
    setAiError(null);

    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: aiTopic,
          quantity: aiQuantity,
          difficulty: aiDifficulty === "mixed" ? undefined : aiDifficulty,
          category: aiCategory.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Không thể sinh câu hỏi bằng AI");
      }

      const data = await res.json();
      if (data.success && data.questions) {
        // Assign local IDs to AI questions
        const questionsWithIds = data.questions.map((q: any) => ({
          ...q,
          id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }));
        onAddQuestions(questionsWithIds);
        setAiTopic("");
        setAiCategory("");
        setActiveFormTab(null);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Lỗi khi sinh câu hỏi. Hãy đảm bảo API Key đã được cấu hình.");
    } finally {
      setIsAiGenerating(false);
    }
  };



  return (
    <div className="space-y-6" id="question-bank-container">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" /> Ngân Hàng Câu Hỏi
          </h1>
          <p className="text-sm text-slate-500">
            Quản lý, phân loại và lưu trữ câu hỏi trắc nghiệm của bạn ({questions.length} câu hỏi)
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveFormTab(activeFormTab === "manual" ? null : "manual")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Soạn thủ công
          </button>
          <button
            onClick={() => setActiveFormTab(activeFormTab === "bulk" ? null : "bulk")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <ListChecks className="w-4 h-4" /> Nhập hàng loạt (Azota)
          </button>
          <button
            onClick={() => setActiveFormTab(activeFormTab === "ai" ? null : "ai")}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-violet-100 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Sinh đề bằng AI
          </button>
          {spreadsheetId && (
            <button
              onClick={onSyncToSheets}
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Đồng bộ lên Sheets
            </button>
          )}
        </div>
      </div>

      {/* AI, Manual, or Bulk Forms Drawer */}
      {activeFormTab === "manual" && (
        <form onSubmit={handleAddManualQuestion} className="bg-slate-50 border border-slate-100 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4 text-indigo-600" /> Thêm câu hỏi mới thủ công
            </h3>
            <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600">
              Hủy bỏ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-slate-600">Nội dung câu hỏi</label>
              <textarea
                required
                rows={3}
                placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full text-sm px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Loại câu hỏi</label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as Question["questionType"])}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                >
                  <option value="single">Trắc nghiệm 1 lựa chọn đúng</option>
                  <option value="multiple">Trắc nghiệm nhiều lựa chọn đúng</option>
                  <option value="true_false">Đúng / Sai</option>
                  <option value="short_answer">Trả lời ngắn</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Độ khó</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Question["difficulty"])}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Danh mục</label>
                  <input
                    type="text"
                    placeholder="Toán, Lý..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Answer Options section depends on questionType with support for unlimited options */}
          {questionType === "single" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Các đáp án lựa chọn (Chọn 1 đáp án đúng):</label>
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Thêm phương án
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                    <input
                      type="radio"
                      name="correct-option-manual"
                      checked={selectedCorrectOptionIdx === idx}
                      onChange={() => setSelectedCorrectOptionIdx(idx)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <input
                      type="text"
                      required={idx < 2}
                      placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}...`}
                      value={option}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="flex-1 text-xs bg-transparent focus:outline-none"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="text-slate-300 hover:text-rose-500 p-1"
                        title="Xóa phương án"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {questionType === "multiple" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Các đáp án lựa chọn (Tích chọn tất cả các đáp án đúng):</label>
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Thêm phương án
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={correctAnswerIndices.includes(idx)}
                      onChange={() => {
                        if (correctAnswerIndices.includes(idx)) {
                          setCorrectAnswerIndices(correctAnswerIndices.filter((i) => i !== idx));
                        } else {
                          setCorrectAnswerIndices([...correctAnswerIndices, idx]);
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <input
                      type="text"
                      required={idx < 2}
                      placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}...`}
                      value={option}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="flex-1 text-xs bg-transparent focus:outline-none"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="text-slate-300 hover:text-rose-500 p-1"
                        title="Xóa phương án"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {questionType === "true_false" && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-600">Chọn đáp án đúng:</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-200">
                  <input
                    type="radio"
                    name="tf-correct"
                    checked={selectedCorrectOptionIdx === 0}
                    onChange={() => setSelectedCorrectOptionIdx(0)}
                    className="w-4 h-4 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700">Đúng</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border border-slate-200">
                  <input
                    type="radio"
                    name="tf-correct"
                    checked={selectedCorrectOptionIdx === 1}
                    onChange={() => setSelectedCorrectOptionIdx(1)}
                    className="w-4 h-4 text-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700">Sai</span>
                </label>
              </div>
            </div>
          )}

          {questionType === "short_answer" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Từ khóa đáp án đúng:</label>
              <input
                type="text"
                required
                placeholder="Nhập từ khóa hoặc câu trả lời ngắn chuẩn xác..."
                value={explanation.split("\n")[0]}
                onChange={(e) => setExplanation(e.target.value + "\n" + explanation.split("\n").slice(1).join("\n"))}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Lời giải thích chi tiết (Dành cho Tự chấm điểm):</label>
            <textarea
              rows={2}
              placeholder="Nhập phần giải thích tại sao đáp án lại đúng giúp học sinh tự học..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full text-sm px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Lưu câu hỏi
            </button>
          </div>
        </form>
      )}

      {activeFormTab === "bulk" && (
        <div className="bg-amber-50/40 border border-amber-100 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
            <h3 className="font-semibold text-amber-900 flex items-center gap-2 text-sm">
              <ListChecks className="w-4 h-4 text-amber-600" /> Nhập hàng loạt câu hỏi (Azota-style)
            </h3>
            <button type="button" onClick={resetBulkForm} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
              Hủy bỏ
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Dán danh sách câu hỏi dạng thô (Hỗ trợ định dạng trắc nghiệm, đúng sai, trả lời ngắn):</span>
              <button
                type="button"
                onClick={insertBulkSampleText}
                className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                Nhập văn bản mẫu &rarr;
              </button>
            </div>

            <textarea
              rows={8}
              placeholder={`Ví dụ:
Câu 1: Hà Nội là thủ đô của nước nào?
A. Hàn Quốc
B. Việt Nam
C. Nhật Bản
D. Thái Lan
Đáp án: B

Câu 2: Công thức hóa học của nước tinh khiết là gì?
A. CO2
B. H2O
C. NaCl
D. H2SO4
Đáp án: B`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full text-xs font-mono px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 transition-all focus:ring-1 focus:ring-amber-500"
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="w-full sm:w-auto flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 shrink-0">Danh mục mặc định:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Địa lý, Toán..."
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full sm:w-48 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handleParseBulkText}
                disabled={isBulkParsing || !bulkText.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isBulkParsing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang phân tích dữ liệu...
                  </>
                ) : (
                  <>
                    <ListChecks className="w-3.5 h-3.5" /> Phân tích & Nhập hàng loạt
                  </>
                )}
              </button>
            </div>

            {bulkError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Display bulk parsed preview list */}
            {parsedBulkQuestions.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đã phân tích thành công: {parsedBulkQuestions.length} câu hỏi
                  </h3>
                  <button
                    type="button"
                    onClick={handleSaveBulkToBank}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    Lưu tất cả vào Ngân hàng câu hỏi &rarr;
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 bg-white rounded-xl p-3">
                  {parsedBulkQuestions.map((q, idx) => (
                    <div key={idx} className="text-xs border-b border-slate-100 pb-2.5 mb-2.5 last:border-0 last:pb-0">
                      <p className="font-bold text-slate-800">
                        {idx + 1}. {q.questionText}
                      </p>
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1 text-slate-500 pl-3">
                          {q.options.map((opt, oIdx) => (
                            <span key={oIdx} className={q.questionType === "true_false_cluster" ? (q.correctAnswers[oIdx] === "Đúng" ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold") : (q.correctAnswers.includes(opt) ? "text-emerald-600 font-semibold" : "")}>
                              {q.questionType === "true_false_cluster" ? opt : `${String.fromCharCode(65 + oIdx)}. ${opt}`} {q.questionType === "true_false_cluster" && `(${q.correctAnswers[oIdx]})`}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Dạng: {q.questionType === "single" ? "Trắc nghiệm 1 đáp án" : q.questionType === "multiple" ? "Trắc nghiệm nhiều đáp án" : q.questionType === "true_false" ? "Đúng/Sai" : q.questionType === "true_false_cluster" ? "Cụm Đúng/Sai" : "Trả lời ngắn"}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Đúng: {q.correctAnswers.join(", ")}</span>
                        {q.explanation && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-xs" title={q.explanation}>Giải thích: {q.explanation}</span>
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeFormTab === "ai" && (
        <form onSubmit={handleGenerateAIQuestions} className="bg-violet-50/50 border border-violet-100 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-violet-200 pb-3">
            <h3 className="font-semibold text-violet-950 flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-violet-600" /> Tự động sinh đề và câu hỏi bằng AI (Gemini 3.1 Pro)
            </h3>
            <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600">
              Hủy bỏ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-violet-900">Chủ đề mong muốn</label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Quang hợp sinh học 11, Công thức lượng giác lớp 10, English Tenses..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="w-full text-xs px-4 py-2.5 bg-white border border-violet-200 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-violet-900">Số lượng</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiQuantity}
                  onChange={(e) => setAiQuantity(parseInt(e.target.value) || 5)}
                  className="w-full text-xs px-3 py-2.5 bg-white border border-violet-200 rounded-xl focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-violet-900">Độ khó</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as any)}
                  className="w-full text-xs px-2 py-2.5 bg-white border border-violet-200 rounded-xl focus:outline-none focus:border-violet-500"
                >
                  <option value="mixed">Hỗn hợp</option>
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-violet-900">Danh mục</label>
                <input
                  type="text"
                  placeholder="Lớp 11, Toán..."
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  className="w-full text-xs px-2 py-2.5 bg-white border border-violet-200 rounded-xl focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-violet-600 italic">
              *Hệ thống sẽ tự tạo các dạng câu hỏi khác nhau (Đúng/Sai, 1 đáp án, nhiều đáp án, lời giải cực kỳ chi tiết) và đồng bộ.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isAiGenerating}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-55"
              >
                {isAiGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang thiết lập...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Tạo câu hỏi ngay
                  </>
                )}
              </button>
            </div>
          </div>

          {aiError && (
            <p className="text-rose-600 text-xs mt-2 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
              {aiError}
            </p>
          )}
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm nội dung câu hỏi hoặc lời giải..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
          >
            <option value="all">Tất cả chủ đề</option>
            {categories.map((cat, i) => (
              <option key={i} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
          >
            <option value="all">Tất cả độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl py-12 text-center text-slate-400 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-medium">Không tìm thấy câu hỏi nào phù hợp</p>
          <p className="text-xs max-w-xs mx-auto">
            Hãy soạn câu hỏi mới bằng nút "Soạn thủ công" hoặc dùng sức mạnh của "AI Sinh câu hỏi" để làm phong phú ngân hàng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q, index) => (
            <div
              key={q.id}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      Câu hỏi {index + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {q.questionType === "single"
                        ? "1 Lựa Chọn"
                        : q.questionType === "multiple"
                        ? "Nhiều Lựa Chọn"
                        : q.questionType === "true_false"
                        ? "Đúng/Sai"
                        : q.questionType === "true_false_cluster"
                        ? "Cụm Đúng/Sai"
                        : "Trả Lời Ngắn"}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        q.difficulty === "easy"
                          ? "text-emerald-700 bg-emerald-50"
                          : q.difficulty === "medium"
                          ? "text-amber-700 bg-amber-50"
                          : "text-rose-700 bg-rose-50"
                      }`}
                    >
                      {q.difficulty === "easy" ? "Dễ" : q.difficulty === "medium" ? "Trung bình" : "Khó"}
                    </span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Chủ đề: {q.category}
                    </span>
                  </div>
                  <h3 className="text-slate-800 font-semibold text-base pt-2 leading-relaxed">{q.questionText}</h3>
                </div>

                <button
                  onClick={() => {
                    setDeleteQuestionId(q.id);
                  }}
                  className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                  title="Xóa câu hỏi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Options display */}
              {q.options && q.options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pl-1">
                  {q.options.map((option, idx) => {
                    const isCluster = q.questionType === "true_false_cluster";
                    const isCorrect = isCluster ? q.correctAnswers[idx] === "Đúng" : q.correctAnswers.includes(option);
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 p-2.5 rounded-xl text-xs border ${
                          isCorrect
                            ? "bg-emerald-50/75 border-emerald-100 text-emerald-950 font-medium"
                            : isCluster ? "bg-rose-50/75 border-rose-100 text-rose-950 font-medium" : "bg-slate-50/50 border-slate-100 text-slate-600"
                        }`}
                      >
                        {!isCluster && (
                          <span className="font-bold text-slate-400 shrink-0 uppercase">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                        )}
                        <span>{option}</span>
                        {isCluster ? (
                           <span className={`ml-auto font-bold shrink-0 ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {q.correctAnswers[idx]}
                           </span>
                        ) : isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" /> : null}
                      </div>
                    );
                  })}
                </div>
              )}

              {q.questionType === "short_answer" && (
                <div className="mt-4 p-3 bg-emerald-50/40 border border-emerald-100/50 rounded-xl">
                  <p className="text-xs text-slate-500 font-medium">Đáp án chuẩn:</p>
                  <p className="text-sm font-semibold text-emerald-900 mt-1">{q.correctAnswers.join(" | ")}</p>
                </div>
              )}

              {/* Explanation display */}
              <div className="mt-4 pt-3 border-t border-slate-50 text-xs text-slate-500 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700">Lời giải chi tiết:</span>{" "}
                  <span className="italic">{q.explanation}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Confirmation Modal for Question Deletion */}
      {deleteQuestionId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="confirm-delete-question-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa câu hỏi</h3>
            </div>
            
            <p className="text-sm text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi không? Hành động này cũng sẽ đồng bộ lên Google Sheets nếu trang tính được kết nối.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteQuestionId(null)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteQuestion(deleteQuestionId);
                  setDeleteQuestionId(null);
                }}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer text-center"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
