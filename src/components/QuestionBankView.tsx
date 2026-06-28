import React, { useState } from "react";
import { Question, SubQuestion } from "../types";
import { Search, Plus, Sparkles, Trash2, Edit2, Database, HelpCircle, Save, Check, RefreshCw, ListChecks, AlertCircle, CheckCircle2, Image as ImageIcon, X } from "lucide-react";
import { parseAzotaTextLocally } from "../utils";
import { LatexRenderer } from "./LatexRenderer";

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
  const [imageUrl, setImageUrl] = useState("");
  const [questionType, setQuestionType] = useState<Question["questionType"]>("single");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [selectedCorrectOptionIdx, setSelectedCorrectOptionIdx] = useState<number>(0);
  const [correctAnswerIndices, setCorrectAnswerIndices] = useState<number[]>([]); // Keeps track of checked indices
  const [explanation, setExplanation] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<Question["difficulty"]>("medium");

  // Sub-question states for Case Study
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [isAddingSubQ, setIsAddingSubQ] = useState(false);
  const [editingSubQId, setEditingSubQId] = useState<string | null>(null);
  const [subQText, setSubQText] = useState("");
  const [subQType, setSubQType] = useState<SubQuestion["questionType"]>("single");
  const [subQOptions, setSubQOptions] = useState<string[]>(["", "", "", ""]);
  const [subQSelectedCorrectIdx, setSubQSelectedCorrectIdx] = useState<number>(0);
  const [subQCorrectAnswerIndices, setSubQCorrectAnswerIndices] = useState<number[]>([]);
  const [subQExplanation, setSubQExplanation] = useState("");

  // Bulk Import state
  const [bulkText, setBulkText] = useState("");
  const [pastedImages, setPastedImages] = useState<Record<string, string>>({});
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
    } else if (questionType === "case_study") {
      finalOptions = [];
      finalCorrectAnswers = [];
    } else {
      // short_answer
      finalOptions = [];
      finalCorrectAnswers = [explanation.split("\n")[0] || "Đáp án"]; // Placeholder if explanation not set
    }

    const newQ: Question = {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      questionText,
      imageUrl: imageUrl || undefined,
      questionType,
      options: finalOptions,
      correctAnswers: finalCorrectAnswers,
      explanation: explanation || "Chưa có lời giải thích.",
      category: category.trim() || "Chung",
      difficulty,
      subQuestions: questionType === "case_study" ? subQuestions : undefined,
    };

    onAddQuestions([newQ]);
    resetForm();
  };

  const resetSubQForm = () => {
    setSubQText("");
    setSubQType("single");
    setSubQOptions(["", "", "", ""]);
    setSubQSelectedCorrectIdx(0);
    setSubQCorrectAnswerIndices([]);
    setSubQExplanation("");
    setIsAddingSubQ(false);
    setEditingSubQId(null);
  };

  const handleSaveSubQuestion = () => {
    if (!subQText.trim()) return;

    let finalSubOptions: string[] = [];
    let finalSubCorrectAnswers: string[] = [];

    if (subQType === "single") {
      finalSubOptions = subQOptions.filter((o) => o.trim() !== "");
      finalSubCorrectAnswers = [finalSubOptions[subQSelectedCorrectIdx] || finalSubOptions[0]];
    } else if (subQType === "multiple") {
      finalSubOptions = subQOptions.filter((o) => o.trim() !== "");
      finalSubCorrectAnswers = subQCorrectAnswerIndices.map(idx => subQOptions[idx]).filter(val => val !== undefined && val.trim() !== "");
      if (finalSubCorrectAnswers.length === 0 && finalSubOptions.length > 0) {
        finalSubCorrectAnswers = [finalSubOptions[0]];
      }
    } else if (subQType === "true_false") {
      finalSubOptions = ["Đúng", "Sai"];
      finalSubCorrectAnswers = [subQSelectedCorrectIdx === 0 ? "Đúng" : "Sai"];
    } else {
      // short_answer
      finalSubOptions = [];
      finalSubCorrectAnswers = [subQExplanation.split("\n")[0] || "Đáp án"];
    }

    const subQData: SubQuestion = {
      id: editingSubQId || `subq-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      questionText: subQText,
      questionType: subQType,
      options: finalSubOptions,
      correctAnswers: finalSubCorrectAnswers,
      explanation: subQExplanation || "Chưa có giải thích.",
    };

    if (editingSubQId) {
      setSubQuestions(subQuestions.map(sq => sq.id === editingSubQId ? subQData : sq));
    } else {
      setSubQuestions([...subQuestions, subQData]);
    }

    resetSubQForm();
  };

  const handleEditSubQuestionClick = (sq: SubQuestion) => {
    setEditingSubQId(sq.id);
    setSubQText(sq.questionText);
    setSubQType(sq.questionType);
    setSubQExplanation(sq.explanation);
    setIsAddingSubQ(true);

    if (sq.questionType === "single") {
      setSubQOptions(sq.options.length > 0 ? sq.options : ["", "", "", ""]);
      const idx = sq.options.indexOf(sq.correctAnswers[0]);
      setSubQSelectedCorrectIdx(idx >= 0 ? idx : 0);
    } else if (sq.questionType === "multiple") {
      setSubQOptions(sq.options.length > 0 ? sq.options : ["", "", "", ""]);
      const idxs = sq.correctAnswers.map(ans => sq.options.indexOf(ans)).filter(i => i >= 0);
      setSubQCorrectAnswerIndices(idxs);
    } else if (sq.questionType === "true_false") {
      setSubQSelectedCorrectIdx(sq.correctAnswers[0] === "Đúng" ? 0 : 1);
    }
  };

  const handleDeleteSubQuestion = (id: string) => {
    setSubQuestions(subQuestions.filter(sq => sq.id !== id));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setQuestionText("");
    setImageUrl("");
    setQuestionType("single");
    setOptions(["", "", "", ""]);
    setSelectedCorrectOptionIdx(0);
    setCorrectAnswerIndices([]);
    setExplanation("");
    setCategory("");
    setDifficulty("medium");
    setSubQuestions([]);
    resetSubQForm();
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
    const sample = `Phần 1. TRẮC NGHIỆM ĐƠN
Câu 1. Thủ đô của Việt Nam là thành phố nào sau đây?
A. Thành phố Hồ Chí Minh.
*B. Hà Nội.
C. Đà Nẵng.
D. Hải Phòng.
Giải thích: Hà Nội là thủ đô của nước Cộng hòa xã hội chủ nghĩa Việt Nam.

Câu 2. Các hành tinh nào sau đây trong Hệ Mặt Trời là hành tinh khí khổng lồ?
*A. Sao Mộc.
*B. Sao Thổ.
C. Trái Đất.
D. Sao Hỏa.
Giải thích: Sao Mộc và Sao Thổ là hai hành tinh khí khổng lồ lớn nhất Hệ Mặt Trời.

Câu 3. Đúng hay Sai: Trái Đất quay xung quanh Mặt Trăng?
A. Đúng.
*B. Sai.
Giải thích: Trái Đất quay xung quanh Mặt Trời, còn Mặt Trăng quay xung quanh Trái Đất.

Câu 4. Kim loại nào dẫn điện tốt nhất ở điều kiện thường?
Đáp án: Bạc
Giải thích: Bạc (Ag) là kim loại có độ dẫn điện tốt nhất, sau đó đến Đồng (Cu) và Vàng (Au).

Phần 2. TRẮC NGHIỆM ĐÚNG SAI (THEO CỤM)
Câu 5. Một cuộc thi bắn cung có 20 người tham gia. Trong lần bắn đầu tiên có 18 người bắn trúng mục tiêu.
*a)[NB] Số người bắn trượt mục tiêu trong lần đầu tiên là 2.
b)[NB] Số người bắn trượt mục tiêu trong lần bắn thứ hai là 6.
c)[TH] Số người bắn trượt mục tiêu trong lần bắn thứ nhất và thứ hai nhiều nhất là 8.
*d)[VD] Số người bắn trúng mục tiêu trong cả ba lần bắn ít nhất là 3.

Phần 3. CÂU HỎI CHÙM / ĐỌC HIỂU / CASE STUDY
Dữ kiện chung:
Trái Đất là hành tinh thứ ba tính từ Mặt Trời, đồng thời cũng là hành tinh đất đá lớn nhất trong Hệ Mặt Trời. Nước lỏng bao phủ khoảng 70.8% bề mặt Trái Đất, tạo điều kiện thuận lợi cho sự sống phát triển bền vững.

[Câu phụ 1] Trái Đất là hành tinh thứ mấy tính từ Mặt Trời?
A. Thứ nhất.
B. Thứ hai.
*C. Thứ ba.
D. Thứ tư.
Giải thích: Theo thứ tự xa dần Mặt Trời: Sao Thủy, Sao Kim, Trái Đất.

[Câu phụ 2] Đúng hay Sai: Nước phủ khoảng 30% bề mặt Trái Đất?
A. Đúng.
*B. Sai.
Giải thích: Nước lỏng bao phủ khoảng 70.8% bề mặt Trái Đất, còn lại là đất liền chiếm khoảng 29.2%.

[Câu phụ 3] Hành tinh đất đá lớn nhất trong Hệ Mặt Trời là gì?
Đáp án: Trái Đất
Giải thích: Trái Đất là hành tinh lớn nhất trong số bốn hành tinh đất đá (Sao Thủy, Sao Kim, Trái Đất, Sao Hỏa).`;
    setBulkText(sample);
    setBulkCategory("Khoa học & Đời sống");
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

      const finalQ: Question[] = parsed.map((q, idx) => {
        let text = q.questionText;
        let imgUrl = q.imageUrl;
        
        // Match all [IMAGE:id] tags in the question text
        const imageMatches = Array.from(text.matchAll(/\[IMAGE:(img_[^\]]+)\]/g));
        if (imageMatches.length > 0) {
          // Find the first valid image
          for (const match of imageMatches) {
            const imgId = match[1];
            if (pastedImages[imgId]) {
              imgUrl = pastedImages[imgId];
              break; // Take the first image found
            }
          }
          // Remove all image tags from the text
          text = text.replace(/\[IMAGE:(img_[^\]]+)\]/g, '').trim();
        }

        return {
          ...q,
          id: `q-bulk-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          questionText: text,
          imageUrl: imgUrl
        };
      });
      
      setParsedBulkQuestions(finalQ);
    } catch (err: any) {
      console.error(err);
      setBulkError(err.message || "Đã xảy ra lỗi không xác định khi phân tích văn bản.");
    } finally {
      setIsBulkParsing(false);
    }
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        hasImage = true;
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault(); // Stop default pasting only if we found an image
          const reader = new FileReader();
          reader.onloadend = () => {
            const imgId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            setPastedImages(prev => ({ ...prev, [imgId]: reader.result as string }));
            
            // Insert placeholder at cursor
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const placeholder = `[IMAGE:${imgId}]`;
            
            setBulkText(prev => prev.substring(0, start) + placeholder + prev.substring(end));
            
            // Wait for render then move cursor
            setTimeout(() => {
              target.selectionStart = target.selectionEnd = start + placeholder.length;
              target.focus();
            }, 0);
          };
          reader.readAsDataURL(file);
          break; // Only handle the first image pasted to avoid complex multi-image insertions
        }
      }
    }
  };

  const handleBulkImageUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newQuestions = [...parsedBulkQuestions];
        newQuestions[idx] = { ...newQuestions[idx], imageUrl: reader.result as string };
        setParsedBulkQuestions(newQuestions);
      };
      reader.readAsDataURL(file);
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">Nội dung câu hỏi</label>
                <label className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Thêm hình ảnh
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              <textarea
                required
                rows={3}
                placeholder={questionType === "case_study" ? "Nhập dữ kiện chung, đoạn văn, ngữ cảnh học thuật cho các câu hỏi nhỏ..." : "Nhập nội dung câu hỏi trắc nghiệm..."}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full text-sm px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {imageUrl && (
                <div className="relative inline-block mt-2">
                  <img src={imageUrl} alt="Question" className="h-32 object-contain rounded-lg border border-slate-200" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-2 -right-2 bg-white border border-slate-200 text-rose-500 rounded-full p-1 shadow-sm hover:bg-rose-50 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
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
                  <option value="case_study">Câu hỏi chùm (Dữ kiện chung / Case Study)</option>
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

          {questionType === "case_study" && (
            <div className="p-5 bg-indigo-50/30 border border-indigo-100 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Danh sách câu hỏi phụ liên quan</h4>
                  <p className="text-[10px] text-slate-500">Các câu hỏi nhỏ sẽ hiển thị trực tiếp bên dưới dữ kiện chung này.</p>
                </div>
                {!isAddingSubQ && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSubQ(true);
                      setEditingSubQId(null);
                      setSubQText("");
                      setSubQType("single");
                      setSubQOptions(["", "", "", ""]);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-100/80 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi phụ
                  </button>
                )}
              </div>

              {/* Render existing sub-questions list */}
              {subQuestions.length > 0 ? (
                <div className="space-y-2">
                  {subQuestions.map((sq, sIdx) => (
                    <div key={sq.id} className="flex items-start justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-xs gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Câu {sIdx + 1}</span>
                          <span className="text-[9px] font-bold uppercase text-slate-400">
                            {sq.questionType === "single"
                              ? "Trắc nghiệm 1 đáp án"
                              : sq.questionType === "multiple"
                              ? "Trắc nghiệm nhiều đáp án"
                              : sq.questionType === "true_false"
                              ? "Đúng / Sai"
                              : "Trả lời ngắn"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800">{sq.questionText}</p>
                        {sq.options.length > 0 && (
                          <p className="text-[10px] text-slate-400">
                            Đáp án đúng: <span className="text-emerald-600 font-semibold">{sq.correctAnswers.join(", ")}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditSubQuestionClick(sq)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubQuestion(sq.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !isAddingSubQ ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white/40">
                    <p className="text-xs text-slate-400">Chưa có câu hỏi phụ nào được thêm. Vui lòng thêm ít nhất một câu hỏi nhỏ để lưu.</p>
                  </div>
                ) : null
              )}

              {/* Sub question Inline Form */}
              {isAddingSubQ && (
                <div className="bg-white border border-slate-200/80 p-4 rounded-xl space-y-4 shadow-sm">
                  <h5 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    {editingSubQId ? "Chỉnh sửa câu hỏi phụ" : "Soạn câu hỏi phụ mới"}
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Nội dung câu hỏi nhỏ</label>
                      <input
                        type="text"
                        placeholder="Nhập nội dung câu hỏi..."
                        value={subQText}
                        onChange={(e) => setSubQText(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Loại câu hỏi nhỏ</label>
                      <select
                        value={subQType}
                        onChange={(e) => {
                          setSubQType(e.target.value as any);
                          setSubQOptions(["", "", "", ""]);
                          setSubQSelectedCorrectIdx(0);
                          setSubQCorrectAnswerIndices([]);
                        }}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none"
                      >
                        <option value="single">Trắc nghiệm 1 lựa chọn</option>
                        <option value="multiple">Trắc nghiệm nhiều lựa chọn</option>
                        <option value="true_false">Đúng / Sai</option>
                        <option value="short_answer">Trả lời ngắn</option>
                      </select>
                    </div>
                  </div>

                  {/* Sub Question Options & Correct Answers */}
                  {(subQType === "single" || subQType === "multiple") && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                        <span>Danh sách đáp án</span>
                        <button
                          type="button"
                          onClick={() => setSubQOptions([...subQOptions, ""])}
                          className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded hover:bg-indigo-100"
                        >
                          + Thêm đáp án
                        </button>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {subQOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-slate-50/50 p-1.5 rounded-lg border border-slate-150">
                            {subQType === "single" ? (
                              <input
                                type="radio"
                                name="subq-correct-single"
                                checked={subQSelectedCorrectIdx === idx}
                                onChange={() => setSubQSelectedCorrectIdx(idx)}
                                className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                              />
                            ) : (
                              <input
                                type="checkbox"
                                checked={subQCorrectAnswerIndices.includes(idx)}
                                onChange={() => {
                                  if (subQCorrectAnswerIndices.includes(idx)) {
                                    setSubQCorrectAnswerIndices(subQCorrectAnswerIndices.filter(i => i !== idx));
                                  } else {
                                    setSubQCorrectAnswerIndices([...subQCorrectAnswerIndices, idx]);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-indigo-600 rounded"
                              />
                            )}
                            <input
                              type="text"
                              placeholder={`Lựa chọn ${String.fromCharCode(65 + idx)}...`}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...subQOptions];
                                newOpts[idx] = e.target.value;
                                setSubQOptions(newOpts);
                              }}
                              className="flex-1 text-[11px] bg-transparent focus:outline-none"
                            />
                            {subQOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = subQOptions.filter((_, i) => i !== idx);
                                  setSubQOptions(filtered);
                                }}
                                className="text-slate-300 hover:text-rose-500 p-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {subQType === "true_false" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Đáp án đúng</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setSubQSelectedCorrectIdx(0)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border ${subQSelectedCorrectIdx === 0 ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                        >
                          Đúng
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubQSelectedCorrectIdx(1)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border ${subQSelectedCorrectIdx === 1 ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                        >
                          Sai
                        </button>
                      </div>
                    </div>
                  )}

                  {subQType === "short_answer" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Từ khóa đáp án đúng</label>
                      <input
                        type="text"
                        placeholder="Nhập câu trả lời ngắn chuẩn xác..."
                        value={subQExplanation}
                        onChange={(e) => setSubQExplanation(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Lời giải thích cho câu hỏi nhỏ này</label>
                    <input
                      type="text"
                      placeholder="Lời giải thích vì sao đáp án đúng..."
                      value={subQExplanation}
                      disabled={subQType === "short_answer"}
                      onChange={(e) => setSubQExplanation(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={resetSubQForm}
                      className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSubQuestion}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                    >
                      Lưu câu hỏi phụ
                    </button>
                  </div>
                </div>
              )}
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

          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left Column: Rendered Questions */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between h-6">
                <span className="text-xs font-semibold text-slate-700">Xem trước hiển thị:</span>
                {parsedBulkQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveBulkToBank}
                    className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Lưu {parsedBulkQuestions.length} câu vào Ngân hàng
                  </button>
                )}
              </div>

              <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-4 min-h-[400px] max-h-[600px] overflow-y-auto space-y-2">
                {parsedBulkQuestions.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-20">
                    Chưa có câu hỏi nào được phân tích.<br/>Hãy nhập văn bản bên phải và nhấn Phân tích.
                  </div>
                ) : (
                  parsedBulkQuestions.map((q, idx) => (
                    <div key={idx} className="text-xs border border-slate-200 bg-white rounded-lg p-3 mb-2.5 last:mb-0 shadow-sm relative group">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-bold text-slate-800 flex-1">
                          {idx + 1}. <LatexRenderer>{q.questionText}</LatexRenderer>
                        </p>
                        <label className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 px-2 py-1 rounded">
                          <ImageIcon className="w-3.5 h-3.5" /> Ảnh
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBulkImageUpload(idx, e)} />
                        </label>
                      </div>
                      
                      {q.imageUrl && (
                        <div className="relative inline-block mt-2">
                          <img src={q.imageUrl} alt="Question" className="h-24 object-contain rounded-lg border border-slate-200" />
                          <button
                            type="button"
                            onClick={() => {
                              const newQuestions = [...parsedBulkQuestions];
                              newQuestions[idx] = { ...newQuestions[idx], imageUrl: undefined };
                              setParsedBulkQuestions(newQuestions);
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 text-rose-500 rounded-full p-0.5 shadow-sm hover:bg-rose-50 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-slate-500 pl-3">
                          {q.options.map((opt, oIdx) => (
                            <span key={oIdx} className={q.questionType === "true_false_cluster" ? (q.correctAnswers[oIdx] === "Đúng" ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold") : (q.correctAnswers.includes(opt) ? "text-emerald-600 font-semibold" : "")}>
                              {q.questionType === "true_false_cluster" ? <LatexRenderer>{opt}</LatexRenderer> : <>{String.fromCharCode(65 + oIdx)}. <LatexRenderer>{opt}</LatexRenderer></>} {q.questionType === "true_false_cluster" && `(${q.correctAnswers[oIdx]})`}
                            </span>
                          ))}
                        </div>
                      )}

                      {q.questionType === "case_study" && q.subQuestions && q.subQuestions.length > 0 && (
                        <div className="mt-3 pl-3 border-l-2 border-indigo-100 space-y-3 bg-indigo-50/10 p-2.5 rounded-lg">
                          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Các câu hỏi liên quan ({q.subQuestions.length} câu):</p>
                          {q.subQuestions.map((subQ, sIdx) => (
                            <div key={subQ.id} className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2 text-[11px]">
                              <div className="flex items-start gap-1">
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">Câu {sIdx + 1}</span>
                                <h4 className="font-semibold text-slate-800 leading-relaxed pl-1"><LatexRenderer>{subQ.questionText}</LatexRenderer></h4>
                              </div>
                              
                              {subQ.options && subQ.options.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[10px]">
                                  {subQ.options.map((subOpt, oIdx) => {
                                    const isCorrect = subQ.correctAnswers.includes(subOpt);
                                    return (
                                      <div
                                        key={oIdx}
                                        className={`flex items-center gap-1.5 p-1 rounded border ${
                                          isCorrect
                                            ? "bg-emerald-50 border-emerald-100 text-emerald-950 font-medium"
                                            : "bg-white border-slate-100 text-slate-500"
                                        }`}
                                      >
                                        <span className="font-bold text-slate-400 shrink-0 uppercase">{String.fromCharCode(65 + oIdx)}.</span>
                                        <span><LatexRenderer>{subOpt}</LatexRenderer></span>
                                        {isCorrect && <Check className="w-2.5 h-2.5 text-emerald-600 ml-auto shrink-0" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {subQ.questionType === "short_answer" && (
                                <div className="mt-1 p-1.5 bg-emerald-50 border border-emerald-100 rounded text-[10px]">
                                  <span className="text-slate-500 font-medium">Đáp án: </span>
                                  <span className="font-semibold text-emerald-900">{subQ.correctAnswers.join(" | ")}</span>
                                </div>
                              )}

                              {subQ.explanation && (
                                <p className="text-[9px] text-slate-500 italic pt-1 border-t border-slate-100/60 flex items-center gap-1">
                                  <HelpCircle className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                  <span>Giải thích: <LatexRenderer>{subQ.explanation}</LatexRenderer></span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        <span>Dạng: {q.questionType === "single" ? "Trắc nghiệm 1 đáp án" : q.questionType === "multiple" ? "Trắc nghiệm nhiều đáp án" : q.questionType === "true_false" ? "Đúng/Sai" : q.questionType === "true_false_cluster" ? "Cụm Đúng/Sai" : q.questionType === "case_study" ? "Câu hỏi chùm / Case Study" : "Trả lời ngắn"}</span>
                        {q.questionType !== "case_study" && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">Đúng: {q.correctAnswers.join(", ")}</span>
                          </>
                        )}
                        {q.explanation && q.questionType !== "case_study" && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-xs" title={q.explanation}>Giải thích: {q.explanation}</span>
                          </>
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Raw Text Input */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between h-6">
                <span className="text-xs font-semibold text-slate-700">Soạn thảo văn bản thô (Hỗ trợ Ctrl+V dán ảnh):</span>
                <button
                  type="button"
                  onClick={insertBulkSampleText}
                  className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  Nhập văn bản mẫu
                </button>
              </div>

              <textarea
                rows={16}
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
                onPaste={handleTextareaPaste}
                className="w-full text-xs font-mono px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 transition-all focus:ring-1 focus:ring-amber-500"
                style={{ minHeight: "400px" }}
              />

              <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
                <div className="w-full xl:w-auto flex flex-row items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Danh mục:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Địa lý, Toán..."
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[120px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleParseBulkText}
                  disabled={isBulkParsing || !bulkText.trim()}
                  className="w-full xl:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isBulkParsing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang phân tích...
                    </>
                  ) : (
                    <>
                      <ListChecks className="w-3.5 h-3.5" /> Phân tích văn bản
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
            </div>

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
                  <h3 className="text-slate-800 font-semibold text-base pt-2 leading-relaxed"><LatexRenderer>{q.questionText}</LatexRenderer></h3>
                  {q.imageUrl && (
                    <div className="mt-3">
                      <img src={q.imageUrl} alt="Question image" className="max-h-48 object-contain rounded-lg border border-slate-200" />
                    </div>
                  )}
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

              {q.questionType === "case_study" && q.subQuestions && q.subQuestions.length > 0 && (
                <div className="mt-4 space-y-4 border-l-2 border-indigo-100 pl-4">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Các câu hỏi liên quan ({q.subQuestions.length} câu):</p>
                  {q.subQuestions.map((subQ, sIdx) => (
                    <div key={subQ.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/80 space-y-2">
                      <div className="flex items-start gap-1">
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">Câu {sIdx + 1}</span>
                        <h4 className="text-xs font-semibold text-slate-800 leading-relaxed pl-1"><LatexRenderer>{subQ.questionText}</LatexRenderer></h4>
                      </div>
                      
                      {subQ.options && subQ.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {subQ.options.map((subOpt, oIdx) => {
                            const isCorrect = subQ.correctAnswers.includes(subOpt);
                            return (
                              <div
                                key={oIdx}
                                className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[11px] border ${
                                  isCorrect
                                    ? "bg-emerald-50/80 border-emerald-100 text-emerald-950 font-medium"
                                    : "bg-white border-slate-100 text-slate-600"
                                }`}
                              >
                                <span className="font-bold text-slate-400 shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                                <span>{subOpt}</span>
                                {isCorrect && <Check className="w-3 h-3 text-emerald-600 ml-auto shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {subQ.questionType === "short_answer" && (
                        <div className="mt-1 p-2 bg-emerald-50/30 rounded-lg">
                          <p className="text-[10px] text-slate-500 font-medium">Đáp án:</p>
                          <p className="text-xs font-semibold text-emerald-900">{subQ.correctAnswers.join(" | ")}</p>
                        </div>
                      )}

                      {subQ.explanation && (
                        <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-100 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 shrink-0" />
                          <span>Giải thích: <LatexRenderer>{subQ.explanation}</LatexRenderer></span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Explanation display */}
              <div className="mt-4 pt-3 border-t border-slate-50 text-xs text-slate-500 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-700">Lời giải chi tiết:</span>{" "}
                  <span className="italic"><LatexRenderer>{q.explanation}</LatexRenderer></span>
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
