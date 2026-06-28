import React, { useState } from "react";
import { Question, Quiz, StudentInfoField } from "../types";
import { FileText, Sparkles, Database, Clock, Play, Plus, Trash2, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Check, ListChecks, Pin } from "lucide-react";
import { parseAzotaTextLocally } from "../utils";
import { LatexRenderer } from "./LatexRenderer";

interface QuizBuilderViewProps {
  questionBank: Question[];
  onAddQuiz: (quiz: Quiz) => void;
  onAddQuestions: (questions: Question[]) => void;
}

interface StructureRule {
  id: string;
  category: string;
  questionType: "all" | "single" | "multiple" | "true_false" | "true_false_cluster" | "short_answer";
  difficulty: "all" | "easy" | "medium" | "hard";
  count: number;
}

export default function QuizBuilderView({ questionBank, onAddQuiz, onAddQuestions }: QuizBuilderViewProps) {
  // Navigation tabs for creation method
  const [methodTab, setMethodTab] = useState<"azota" | "bank" | "structure" | "random">("azota");

  // Structure Creation State
  const [structureRules, setStructureRules] = useState<StructureRule[]>([
    { id: "rule-1", category: "all", questionType: "all", difficulty: "all", count: 5 }
  ]);

  // General Quiz State
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(15);
  const [quizGrade, setQuizGrade] = useState("");
  const [quizSubject, setQuizSubject] = useState("");
  const [quizPurpose, setQuizPurpose] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [groupByType, setGroupByType] = useState(false);
  
  // Results visibility state
  const [showScore, setShowScore] = useState<"no" | "when_finished" | "when_all_finished">("when_finished");
  const [showAnswers, setShowAnswers] = useState<"no" | "when_finished" | "when_all_finished" | "when_reach_score">("when_finished");
  const [hideCorrectAnswerForWrong, setHideCorrectAnswerForWrong] = useState(false);

  // Security settings state
  const [maxAttempts, setMaxAttempts] = useState<number | "">("");
  const [quizPassword, setQuizPassword] = useState("");
  const [proctoringMode, setProctoringMode] = useState<"off" | "monitor_screen_exit">("off");
  const [requireStudentInfo, setRequireStudentInfo] = useState(true);
  const [studentInfoFields, setStudentInfoFields] = useState<StudentInfoField[]>([
    { id: "field-1", label: "Họ và tên", type: "text" },
    { id: "field-2", label: "Lớp", type: "text" },
    { id: "field-3", label: "Trường", type: "text" }
  ]);
  
  // 1. "Azota" State: raw text parsing
  const [rawText, setRawText] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [pastedImages, setPastedImages] = useState<Record<string, string>>({});

  // 2. "Bank Selection" State
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<string[]>([]);
  
  // 3. "Random" State
  const [randomCount, setRandomCount] = useState(10);
  
  // Pinned Questions state (always included in Matrix or Random)
  const [pinnedQuestionIds, setPinnedQuestionIds] = useState<string[]>([]);
  const [pinSearchText, setPinSearchText] = useState("");
  const [pinCategoryFilter, setPinCategoryFilter] = useState("all");

  const togglePinnedQuestionSelection = (id: string) => {
    if (pinnedQuestionIds.includes(id)) {
      setPinnedQuestionIds(pinnedQuestionIds.filter((qid) => qid !== id));
    } else {
      setPinnedQuestionIds([...pinnedQuestionIds, id]);
    }
  };

  const filteredQuestionsForPin = questionBank.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(pinSearchText.toLowerCase());
    const matchesCategory = pinCategoryFilter === "all" || q.category === pinCategoryFilter;
    return matchesSearch && matchesCategory;
  });
  
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

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let hasImage = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        hasImage = true;
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onloadend = () => {
            const imgId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            setPastedImages(prev => ({ ...prev, [imgId]: reader.result as string }));
            
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const placeholder = `[IMAGE:${imgId}]`;
            
            setRawText(prev => prev.substring(0, start) + placeholder + prev.substring(end));
            
            setTimeout(() => {
              target.selectionStart = target.selectionEnd = start + placeholder.length;
              target.focus();
            }, 0);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleParseText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsParsing(true);
    setParseError(null);
    setParsedQuestions([]);

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const parsed = parseAzotaTextLocally(rawText, defaultCategory.trim());
      
      if (parsed.length === 0) {
        throw new Error("Không tìm thấy câu hỏi nào. Vui lòng kiểm tra lại định dạng.");
      }

      const finalQ: Question[] = parsed.map((q, idx) => {
        let text = q.questionText;
        let imgUrl = q.imageUrl;
        
        const imageMatches = Array.from(text.matchAll(/\[IMAGE:(img_[^\]]+)\]/g));
        if (imageMatches.length > 0) {
          for (const match of imageMatches) {
            const imgId = match[1];
            if (pastedImages[imgId]) {
              imgUrl = pastedImages[imgId];
              break;
            }
          }
          text = text.replace(/\[IMAGE:(img_[^\]]+)\]/g, '').trim();
        }

        return {
          ...q,
          id: `q-parsed-${idx}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          questionText: text,
          imageUrl: imgUrl
        };
      });
      
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
    let isRandomized = false;
    let quizRandomCount = 0;

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
    } else if (methodTab === "bank") {
      // Pull questions from bank
      finalQuestions = questionBank.filter((q) => selectedBankQuestionIds.includes(q.id));
      if (finalQuestions.length === 0) {
        setNotification({
          message: "Vui lòng tích chọn ít nhất 1 câu hỏi từ Ngân hàng câu hỏi bên dưới.",
          type: "error",
        });
        return;
      }
    } else if (methodTab === "random") {
      if (questionBank.length === 0) {
        setNotification({
          message: "Ngân hàng câu hỏi trống. Không thể tạo đề ngẫu nhiên.",
          type: "error",
        });
        return;
      }
      isRandomized = true;
      quizRandomCount = Math.min(randomCount, questionBank.length);
      // We don't save specific questions to finalQuestions here if we randomize at runtime, but we might want to save ALL bank questions into the quiz so it has the pool to pull from when shared. Or the server fetches them. Wait, if it's a shared quiz, it only gets what's in `questions`. 
      // If `questions` is the pool, we can just put the whole bank in `questions`.
      finalQuestions = [...questionBank];
    } else if (methodTab === "structure") {
      if (questionBank.length === 0) {
        setNotification({
          message: "Ngân hàng câu hỏi trống. Không thể tạo đề theo cấu trúc.",
          type: "error",
        });
        return;
      }

      // Start with all pinned questions that must always be included
      const pinnedQuestions = questionBank.filter(q => pinnedQuestionIds.includes(q.id));
      let selectedQuestions: Question[] = [...pinnedQuestions];
      let ruleErrors: string[] = [];

      structureRules.forEach((rule, ruleIdx) => {
        const matchesRule = (q: Question) => {
          const matchesCategory = rule.category === "all" || q.category === rule.category;
          const matchesType = rule.questionType === "all" || q.questionType === rule.questionType;
          const matchesDifficulty = rule.difficulty === "all" || q.difficulty === rule.difficulty;
          return matchesCategory && matchesType && matchesDifficulty;
        };

        // How many of the already selected/pinned questions match this rule's criteria?
        const matchingPinnedCount = pinnedQuestions.filter(matchesRule).length;
        const neededCount = Math.max(0, rule.count - matchingPinnedCount);

        const pool = questionBank.filter(q => {
          const matchesFilters = matchesRule(q);
          const isNotAlreadySelected = !selectedQuestions.some(sq => sq.id === q.id);
          return matchesFilters && isNotAlreadySelected;
        });

        if (pool.length < neededCount) {
          const categoryName = rule.category === "all" ? "Tất cả" : rule.category;
          const typeName = rule.questionType === "all" ? "Tất cả" : rule.questionType;
          const diffName = rule.difficulty === "all" ? "Tất cả" : rule.difficulty;
          ruleErrors.push(
            `Dòng cấu trúc ${ruleIdx + 1} (${categoryName} | ${typeName} | ${diffName}): Yêu cầu tổng ${rule.count} câu (đã đáp ứng ${matchingPinnedCount} câu cố định), cần thêm ${neededCount} câu ngẫu nhiên nhưng ngân hàng chỉ còn ${pool.length} câu phù hợp chưa chọn.`
          );
        } else {
          // Pick neededCount randomly from pool
          const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
          const selectedForThisRule = shuffledPool.slice(0, neededCount);
          selectedQuestions.push(...selectedForThisRule);
        }
      });

      if (ruleErrors.length > 0) {
        setNotification({
          message: `Không đủ câu hỏi trong ngân hàng để đáp ứng cấu trúc đề thi:\n\n${ruleErrors.join("\n")}`,
          type: "error",
        });
        return;
      }

      finalQuestions = selectedQuestions;
    }

    if (!quizTitle.trim()) {
      setNotification({
        message: "Vui lòng nhập Tên bài thi.",
        type: "error",
      });
      return;
    }

    if (!quizGrade || !quizSubject) {
      setNotification({
        message: "Vui lòng chọn khối học và môn học.",
        type: "error",
      });
      return;
    }

    if (!quizPurpose) {
      setNotification({
        message: "Vui lòng chọn mục đích tạo đề.",
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
      isRandomized: isRandomized,
      randomQuestionCount: quizRandomCount,
      pinnedQuestionIds: (methodTab === "random" || methodTab === "structure") ? pinnedQuestionIds : undefined,
      grade: quizGrade,
      subject: quizSubject,
      purpose: quizPurpose,
      maxAttempts: maxAttempts === "" ? undefined : maxAttempts,
      password: quizPassword,
      proctoringMode: proctoringMode,
      requireStudentInfo: requireStudentInfo,
      studentInfoFields: studentInfoFields,
      shuffleQuestions,
      shuffleAnswers,
      groupByType,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      showScore,
      showAnswers,
      hideCorrectAnswerForWrong,
    };

    onAddQuiz(newQuiz);

    // Clear state
    setQuizTitle("");
    setQuizDescription("");
    setQuizGrade("");
    setQuizSubject("");
    setQuizPurpose("");
    setStartTime("");
    setEndTime("");
    setShuffleQuestions(false);
    setShuffleAnswers(false);
    setGroupByType(false);
    setShowScore("when_finished");
    setShowAnswers("when_finished");
    setHideCorrectAnswerForWrong(false);
    setSelectedBankQuestionIds([]);
    setPinnedQuestionIds([]);
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

  const renderPinnedQuestionsSection = () => {
    return (
      <div className="space-y-4 bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Pin className="w-4 h-4 fill-indigo-100" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">CÂU HỎI LUÔN CÓ TRONG ĐỀ (CỐ ĐỊNH)</h4>
              <p className="text-[10px] text-slate-400">Tích chọn các câu hỏi bắt buộc xuất hiện trong đề thi (cho cả sinh ngẫu nhiên và cấu trúc).</p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
            Đã ghim: {pinnedQuestionIds.length} câu
          </span>
        </div>

        {questionBank.length === 0 ? (
          <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-100">
            <p className="text-xs text-slate-400 italic">Chưa có câu hỏi nào trong ngân hàng.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Tìm câu hỏi muốn ghim luôn có trong đề..."
                value={pinSearchText}
                onChange={(e) => setPinSearchText(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
              <select
                value={pinCategoryFilter}
                onChange={(e) => setPinCategoryFilter(e.target.value)}
                className="text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-indigo-500 transition-all"
              >
                <option value="all">Tất cả chủ đề</option>
                {Array.from(new Set(questionBank.map(q => q.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl p-2 divide-y divide-slate-100/50 bg-slate-50/20">
              {filteredQuestionsForPin.map((q) => {
                const isPinned = pinnedQuestionIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => togglePinnedQuestionSelection(q.id)}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-start gap-3 my-1 border ${
                      isPinned 
                        ? "bg-indigo-50/50 border-indigo-200/70 shadow-sm" 
                        : "hover:bg-white border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={() => {}} // handled by parent click
                      className="mt-1 h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-medium text-slate-800 line-clamp-2">
                        <LatexRenderer>{q.questionText}</LatexRenderer>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[9px] font-medium bg-white border border-slate-150 text-slate-500 px-1.5 py-0.5 rounded">
                          {q.category || "Chung"}
                        </span>
                        <span className="text-[9px] font-medium bg-white border border-slate-150 text-slate-500 px-1.5 py-0.5 rounded">
                          {q.questionType === "single" ? "1 đáp án" : q.questionType === "multiple" ? "Nhiều đáp án" : q.questionType === "true_false" ? "Đúng/Sai" : q.questionType === "true_false_cluster" ? "Cụm Đúng/Sai" : q.questionType === "case_study" ? "Câu hỏi chùm / Case" : "Trả lời ngắn"}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                          q.difficulty === "easy" ? "text-emerald-600 bg-emerald-50" : q.difficulty === "medium" ? "text-amber-600 bg-amber-50" : "text-rose-600 bg-rose-50"
                        }`}>
                          {q.difficulty === "easy" ? "Dễ" : q.difficulty === "medium" ? "T.Bình" : "Khó"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredQuestionsForPin.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">Không tìm thấy câu hỏi phù hợp.</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
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
          CẤU HÌNH CHUNG
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-600">Tên đề thi <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="Nhập tên..."
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
            />
            {/* Vui lòng nhập tên đề thi */}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Khối học <span className="text-red-500">*</span></label>
            <select
              value={quizGrade}
              onChange={(e) => setQuizGrade(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
            >
              <option value="">---Chọn khối---</option>
              <option value="10">Khối 10</option>
              <option value="11">Khối 11</option>
              <option value="12">Khối 12</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Môn học <span className="text-red-500">*</span></label>
            <select
              value={quizSubject}
              onChange={(e) => setQuizSubject(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
            >
              <option value="">---Chọn môn---</option>
              <option value="Toán">Toán</option>
              <option value="Ngữ văn">Ngữ văn</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Hóa học">Hóa học</option>
              <option value="Sinh học">Sinh học</option>
              <option value="Lịch sử">Lịch sử</option>
              <option value="Địa lý">Địa lý</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-600">Mục đích tạo đề <span className="text-red-500">*</span></label>
            <select
              value={quizPurpose}
              onChange={(e) => setQuizPurpose(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
            >
              <option value="">---Chọn mục đích---</option>
              <option value="KiemTra">Kiểm tra / Đánh giá</option>
              <option value="LuyenTap">Luyện tập / Ôn tập</option>
              <option value="ThiThu">Thi thử</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2 mt-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" /> Thời gian làm bài (Phút)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 15)}
              className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
            />
          </div>

          <div className="md:col-span-2 space-y-2 mt-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" /> Thời gian giao đề
            </label>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Từ</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Đến</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-1">Chỉ được phép gia hạn thêm 'Thời gian giao đề' hoặc 'Thời gian làm bài'. Việc sửa cấu hình lùi thời gian khi học sinh đã thi có thể làm mất dữ liệu bài làm của học sinh. Bỏ trống nếu không muốn giới hạn thời gian.</p>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-600">Mô tả</label>
            <textarea
              rows={3}
              placeholder="Nhập mô tả..."
              value={quizDescription}
              onChange={(e) => setQuizDescription(e.target.value)}
              className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Test Options Configuration */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">
          TÙY CHỌN BÀI THI
        </h2>
        
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            Xáo trộn câu hỏi
            <span className="text-xs text-slate-400 font-normal ml-2">Đảo vị trí ngẫu nhiên các câu hỏi cho từng học sinh</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={shuffleAnswers}
              onChange={(e) => setShuffleAnswers(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            Xáo trộn đáp án
            <span className="text-xs text-slate-400 font-normal ml-2">Đảo vị trí ngẫu nhiên các đáp án A, B, C, D</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={groupByType}
              onChange={(e) => setGroupByType(e.target.checked)}
              className="accent-indigo-600 w-4 h-4 rounded"
            />
            Thi theo phần (Phân nhóm câu hỏi theo loại)
            <span className="text-xs text-slate-400 font-normal ml-2">Phần trắc nghiệm, nhiều đáp án, đúng/sai, trả lời ngắn được phân biệt, không trộn lẫn</span>
          </label>
        </div>
      </div>

      {/* Results Visibility Options */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 tracking-wider mb-4 border-b border-slate-50 pb-2">
          Điểm và đáp án khi làm xong
        </h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 col-span-1">Cho xem điểm</label>
            <div className="md:col-span-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showScore" value="no" checked={showScore === "no"} onChange={() => setShowScore("no")} className="accent-indigo-600 w-4 h-4" /> Không
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showScore" value="when_finished" checked={showScore === "when_finished"} onChange={() => setShowScore("when_finished")} className="accent-indigo-600 w-4 h-4" /> Khi làm bài xong
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showScore" value="when_all_finished" checked={showScore === "when_all_finished"} onChange={() => setShowScore("when_all_finished")} className="accent-indigo-600 w-4 h-4" /> Khi tất cả thi xong
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 col-span-1">Cho xem đề thi và đáp án</label>
            <div className="md:col-span-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showAnswers" value="no" checked={showAnswers === "no"} onChange={() => setShowAnswers("no")} className="accent-indigo-600 w-4 h-4" /> Không
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showAnswers" value="when_finished" checked={showAnswers === "when_finished"} onChange={() => setShowAnswers("when_finished")} className="accent-indigo-600 w-4 h-4" /> Khi làm bài xong
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showAnswers" value="when_all_finished" checked={showAnswers === "when_all_finished"} onChange={() => setShowAnswers("when_all_finished")} className="accent-indigo-600 w-4 h-4" /> Khi tất cả thi xong
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input type="radio" name="showAnswers" value="when_reach_score" checked={showAnswers === "when_reach_score"} onChange={() => setShowAnswers("when_reach_score")} className="accent-indigo-600 w-4 h-4" /> Khi đạt đến số điểm nhất định
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-2">
            <div className="col-span-1">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Ẩn đáp án cho câu trả lời sai</label>
              <p className="text-[10px] text-slate-400">Khi bật tính năng này hệ thống sẽ ẩn đáp án đúng và giải thích của câu hỏi đối với những câu học sinh trả lời sai</p>
            </div>
            <div className="md:col-span-3 flex items-center h-full">
              <button
                type="button"
                role="switch"
                aria-checked={hideCorrectAnswerForWrong}
                onClick={() => setHideCorrectAnswerForWrong(!hideCorrectAnswerForWrong)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${hideCorrectAnswerForWrong ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <span className="sr-only">Ẩn đáp án cho câu trả lời sai</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${hideCorrectAnswerForWrong ? 'translate-x-2' : '-translate-x-2'}`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security / Online Test Configuration */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">
          BẢO MẬT
        </h2>

        <div className="space-y-6">
          {/* Max Attempts */}
          <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 col-span-1">Số lượt làm</label>
            <div className="md:col-span-3">
              <input
                type="number"
                min={0}
                placeholder="0"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value === "" ? "" : parseInt(e.target.value))}
                className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">*Nhập 0 hoặc để trống để không giới hạn số lượt làm đề thi</p>
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 col-span-1">Mật khẩu đề thi</label>
            <div className="md:col-span-3">
              <input
                type="text"
                placeholder="Nhập mật khẩu ..."
                value={quizPassword}
                onChange={(e) => setQuizPassword(e.target.value)}
                className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
              />
            </div>
          </div>

          {/* Proctoring */}
          <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-2">
            <div className="col-span-1 space-y-0.5">
              <label className="text-xs font-semibold text-slate-700 block">Giám sát tự động</label>
              <span className="text-[10px] text-slate-400 block">Hỗ trợ giám sát thoát màn hình tốt nhất trên trình duyệt máy tính</span>
            </div>
            <div className="md:col-span-3 flex items-center gap-6 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="proctoringMode"
                  value="off"
                  checked={proctoringMode === "off"}
                  onChange={() => setProctoringMode("off")}
                  className="accent-indigo-600 w-4 h-4"
                />
                Tắt
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="radio"
                  name="proctoringMode"
                  value="monitor_screen_exit"
                  checked={proctoringMode === "monitor_screen_exit"}
                  onChange={() => setProctoringMode("monitor_screen_exit")}
                  className="accent-indigo-600 w-4 h-4"
                />
                Giám sát thoát màn hình <AlertCircle className="w-3.5 h-3.5 text-slate-400 inline" />
              </label>
            </div>
          </div>

          {/* Student Info Verification */}
          <div className="grid grid-cols-1 md:grid-cols-4 items-start gap-2 border-t border-slate-50 pt-6">
            <div className="col-span-1 space-y-0.5">
              <label className="text-xs font-semibold text-slate-700 block">Xác thực thông tin học sinh</label>
              <span className="text-[10px] text-slate-400 block">Khi học sinh vào làm bài sẽ phải khai báo thêm các thông tin mà bạn yêu cầu.</span>
            </div>
            <div className="md:col-span-3">
              <label className="relative inline-flex items-center cursor-pointer mb-4">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={requireStudentInfo}
                  onChange={(e) => setRequireStudentInfo(e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>

              {requireStudentInfo && (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-slate-700 mb-3">Cấu hình Form xác thực</h3>
                  <div className="space-y-2 mb-3">
                    {studentInfoFields.map((field, idx) => (
                      <div key={field.id} className="flex gap-2 items-center bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
                        <div className="bg-slate-50 text-slate-500 text-[11px] font-medium px-3 py-2 rounded border border-slate-100 w-24 text-center shrink-0">
                          Thông tin {idx + 1}
                        </div>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const newFields = [...studentInfoFields];
                            newFields[idx].label = e.target.value;
                            setStudentInfoFields(newFields);
                          }}
                          className="flex-1 text-xs px-3 py-2 bg-transparent focus:outline-none font-medium text-slate-800"
                          placeholder="Nhập tên trường thông tin..."
                        />
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const newFields = [...studentInfoFields];
                            newFields[idx].type = e.target.value;
                            setStudentInfoFields(newFields);
                          }}
                          className="text-xs px-2 py-2 bg-transparent border-l border-slate-100 focus:outline-none text-slate-500 min-w-[120px]"
                        >
                          <option value="text">Trả lời ngắn</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setStudentInfoFields(studentInfoFields.filter(f => f.id !== field.id));
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentInfoFields([
                          ...studentInfoFields,
                          { id: `field-${Date.now()}`, label: "", type: "text" }
                        ]);
                      }}
                      className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm thông tin
                    </button>
                    <span className="text-[10px] text-slate-500">*Click vào nút "Thêm thông tin" để thêm các thuộc tính giúp định danh học sinh.</span>
                  </div>
                </div>
              )}
            </div>
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
          <button
            onClick={() => setMethodTab("structure")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              methodTab === "structure"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <ListChecks className="w-4 h-4" /> Tạo đề theo cấu trúc ma trận
          </button>
          <button
            onClick={() => setMethodTab("random")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 cursor-pointer ${
              methodTab === "random"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <RefreshCw className="w-4 h-4" /> Tạo đề ngẫu nhiên
          </button>
        </div>

        {/* 1. Azota Input Pane */}
        {methodTab === "azota" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Dán đề thi dạng thô (Word hoặc văn bản tự soạn, Hỗ trợ Ctrl+V dán ảnh):</span>
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
              onPaste={handleTextareaPaste}
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
                        {idx + 1}. <LatexRenderer>{q.questionText}</LatexRenderer>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Dạng: {q.questionType === "single" ? "Trắc nghiệm 1 đáp án" : q.questionType === "multiple" ? "Trắc nghiệm nhiều đáp án" : q.questionType === "true_false" ? "Đúng/Sai" : q.questionType === "true_false_cluster" ? "Cụm Đúng/Sai" : q.questionType === "case_study" ? "Câu hỏi chùm / Case Study" : "Trả lời ngắn"} | Đúng: {q.correctAnswers.join(", ")}
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
                          <p className="text-xs font-semibold text-slate-800"><LatexRenderer>{q.questionText}</LatexRenderer></p>
                          {q.imageUrl && (
                            <div className="mt-1.5">
                              <img src={q.imageUrl} alt="Question image" className="max-h-24 object-contain rounded border border-slate-200" />
                            </div>
                          )}
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

        {/* 3. Random Selection Pane */}
        {methodTab === "random" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-100 rounded-xl space-y-4">
              <div className="p-3 bg-white border border-slate-200 rounded-full shadow-sm text-indigo-600">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Tạo đề thi ngẫu nhiên</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Hệ thống sẽ chọn ngẫu nhiên các câu hỏi từ ngân hàng mỗi khi học sinh làm bài.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="text-xs font-semibold text-slate-700">Số lượng câu hỏi (tối đa {questionBank.length}):</label>
                <input
                  type="number"
                  min="1"
                  max={questionBank.length || 1}
                  value={randomCount}
                  onChange={(e) => setRandomCount(parseInt(e.target.value) || 1)}
                  className="w-24 text-center text-sm font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>

            {renderPinnedQuestionsSection()}
          </div>
        )}

        {/* 4. Structure Selection Pane */}
        {methodTab === "structure" && (
          <div className="space-y-6">
            {questionBank.length === 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">CẤU TRÚC MA TRẬN ĐỀ THI</h3>
                </div>
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-400 font-medium">Ngân hàng câu hỏi trống. Không thể thiết lập cấu trúc.</p>
                  <button
                    type="button"
                    onClick={() => setMethodTab("azota")}
                    className="text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    Hãy nhập/phân tích câu hỏi trước để đưa vào ngân hàng &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 4.1 Collapsible/Searchable Pinned Questions list */}
                {renderPinnedQuestionsSection()}

                {/* 4.2 Matrix Configuration */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">CẤU TRÚC MA TRẬN ĐỀ THI</h3>
                      <p className="text-[11px] text-slate-400">Chọn chủ đề, định dạng câu hỏi và mức độ khó để tạo đề tự động từ ngân hàng.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStructureRules([
                          ...structureRules,
                          {
                            id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                            category: "all",
                            questionType: "all",
                            difficulty: "all",
                            count: 5
                          }
                        ]);
                      }}
                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm cấu trúc
                    </button>
                  </div>

                  <div className="space-y-3">
                    {structureRules.length > 0 && (
                      <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-3">Chủ đề / Danh mục</div>
                        <div className="col-span-3">Dạng câu hỏi</div>
                        <div className="col-span-2">Mức độ khó</div>
                        <div className="col-span-2 text-center">Số lượng câu</div>
                        <div className="col-span-1 text-center font-bold">Đáp ứng</div>
                        <div className="col-span-1 text-right">Hành động</div>
                      </div>
                    )}

                    {structureRules.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-400 font-medium">Chưa có dòng cấu trúc nào được thiết lập.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setStructureRules([{ id: `rule-${Date.now()}`, category: "all", questionType: "all", difficulty: "all", count: 5 }]);
                          }}
                          className="text-xs text-indigo-600 hover:underline mt-1 font-semibold"
                        >
                          Thêm dòng cấu trúc đầu tiên &rarr;
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {structureRules.map((rule, idx) => {
                          const uniqueCats = Array.from(new Set(questionBank.map(q => q.category).filter(Boolean)));
                          
                          // Count total matching in bank
                          const matchingCount = questionBank.filter(q => {
                            const matchesCategory = rule.category === "all" || q.category === rule.category;
                            const matchesType = rule.questionType === "all" || q.questionType === rule.questionType;
                            const matchesDifficulty = rule.difficulty === "all" || q.difficulty === rule.difficulty;
                            return matchesCategory && matchesType && matchesDifficulty;
                          }).length;

                          // Count matching in pinned/always included list
                          const pinnedMatchingCount = questionBank.filter(q => {
                            const isPinned = pinnedQuestionIds.includes(q.id);
                            const matchesCategory = rule.category === "all" || q.category === rule.category;
                            const matchesType = rule.questionType === "all" || q.questionType === rule.questionType;
                            const matchesDifficulty = rule.difficulty === "all" || q.difficulty === rule.difficulty;
                            return isPinned && matchesCategory && matchesType && matchesDifficulty;
                          }).length;

                          return (
                            <div
                              key={rule.id}
                              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm"
                            >
                              {/* Category */}
                              <div className="col-span-1 md:col-span-3 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase md:hidden block">Chủ đề</label>
                                <select
                                  value={rule.category}
                                  onChange={(e) => {
                                    const newRules = [...structureRules];
                                    newRules[idx].category = e.target.value;
                                    setStructureRules(newRules);
                                  }}
                                  className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                                >
                                  <option value="all">Tất cả chủ đề</option>
                                  {uniqueCats.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Question Type */}
                              <div className="col-span-1 md:col-span-3 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase md:hidden block">Dạng câu hỏi</label>
                                <select
                                  value={rule.questionType}
                                  onChange={(e) => {
                                    const newRules = [...structureRules];
                                    newRules[idx].questionType = e.target.value as any;
                                    setStructureRules(newRules);
                                  }}
                                  className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                                >
                                  <option value="all">Tất cả dạng câu hỏi</option>
                                  <option value="single">Trắc nghiệm 1 đáp án</option>
                                  <option value="multiple">Trắc nghiệm nhiều đáp án</option>
                                  <option value="true_false">Đúng / Sai đơn</option>
                                  <option value="true_false_cluster">Cụm Đúng / Sai</option>
                                  <option value="short_answer">Trả lời ngắn</option>
                                  <option value="case_study">Câu hỏi chùm / Case Study</option>
                                </select>
                              </div>

                              {/* Difficulty */}
                              <div className="col-span-1 md:col-span-2 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase md:hidden block">Mức độ khó</label>
                                <select
                                  value={rule.difficulty}
                                  onChange={(e) => {
                                    const newRules = [...structureRules];
                                    newRules[idx].difficulty = e.target.value as any;
                                    setStructureRules(newRules);
                                  }}
                                  className="w-full text-xs px-2.5 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                                >
                                  <option value="all">Tất cả độ khó</option>
                                  <option value="easy">Dễ / Nhận biết</option>
                                  <option value="medium">Trung bình / Thông hiểu</option>
                                  <option value="hard">Khó / Vận dụng</option>
                                </select>
                              </div>

                              {/* Question Count */}
                              <div className="col-span-1 md:col-span-2 space-y-1 text-center">
                                <label className="text-[9px] font-bold text-slate-400 uppercase md:hidden block">Số lượng câu</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={rule.count}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    const newRules = [...structureRules];
                                    newRules[idx].count = val;
                                    setStructureRules(newRules);
                                  }}
                                  className="w-full text-center text-xs font-bold px-2 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                                />
                                {pinnedMatchingCount > 0 && (
                                  <div className="text-[9px] font-bold text-indigo-600 mt-1">
                                    Đã ghim: {pinnedMatchingCount} câu
                                  </div>
                                )}
                              </div>

                              {/* Real-time Matching Count */}
                              <div className="col-span-1 md:col-span-1 text-center flex items-center justify-center">
                                <div className="space-y-1 w-full text-center">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase md:hidden block mb-1">Đáp ứng</label>
                                  <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded-lg ${
                                    matchingCount === 0 
                                      ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                      : matchingCount < rule.count
                                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  }`}>
                                    {matchingCount} câu
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="col-span-1 md:col-span-1 text-right flex items-center justify-end">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase md:hidden block mb-1">Xóa</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStructureRules(structureRules.filter(r => r.id !== rule.id));
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xóa cấu trúc này"
                                  >
                                    <Trash2 className="w-4.5 h-4.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Structure Summary card */}
                {structureRules.length > 0 && (
                  <div className="mt-4 p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-white border border-indigo-100 rounded-xl text-indigo-600">
                        <ListChecks className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-950">Định lượng đề thi theo cấu trúc</p>
                        <p className="text-[10px] text-indigo-600">Kiểm tra độ phủ và sự phù hợp của ngân hàng câu hỏi để sinh đề nhanh.</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-slate-500 font-medium">Tổng số câu cấu hình:</p>
                      <div className="text-[11px] text-slate-600 font-medium space-y-0.5">
                        <div>Cố định (đã ghim): <span className="font-bold text-slate-800">{pinnedQuestionIds.length} câu</span></div>
                        <div>Ngẫu nhiên thêm: <span className="font-bold text-slate-800">
                          {structureRules.reduce((sum, r) => {
                            const matchingPinnedCount = questionBank.filter(q => {
                              const isPinned = pinnedQuestionIds.includes(q.id);
                              const matchesCategory = r.category === "all" || q.category === r.category;
                              const matchesType = r.questionType === "all" || q.questionType === r.questionType;
                              const matchesDifficulty = r.difficulty === "all" || q.difficulty === r.difficulty;
                              return isPinned && matchesCategory && matchesType && matchesDifficulty;
                            }).length;
                            return sum + Math.max(0, r.count - matchingPinnedCount);
                          }, 0)} câu
                        </span></div>
                      </div>
                      <p className="text-sm font-black text-indigo-600 font-mono">
                        Tổng cộng: {pinnedQuestionIds.length + structureRules.reduce((sum, r) => {
                          const matchingPinnedCount = questionBank.filter(q => {
                            const isPinned = pinnedQuestionIds.includes(q.id);
                            const matchesCategory = r.category === "all" || q.category === r.category;
                            const matchesType = r.questionType === "all" || q.questionType === r.questionType;
                            const matchesDifficulty = r.difficulty === "all" || q.difficulty === r.difficulty;
                            return isPinned && matchesCategory && matchesType && matchesDifficulty;
                          }).length;
                          return sum + Math.max(0, r.count - matchingPinnedCount);
                        }, 0)} câu hỏi
                      </p>
                    </div>
                  </div>
                )}
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
