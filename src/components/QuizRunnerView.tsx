import React, { useState, useEffect, useRef } from "react";
import { Quiz, AnswerSubmission, Question } from "../types";
import { Clock, User, Award, HelpCircle, ArrowRight, Play, CheckCircle, AlertTriangle, X } from "lucide-react";
import { LatexRenderer } from "./LatexRenderer";

interface QuizTimerProps {
  endTime: number;
  onTimeUp: () => void;
  isStarted: boolean;
}

const QuizTimer = React.memo(({ endTime, onTimeUp, isStarted }: QuizTimerProps) => {
  const calculateRemaining = () => Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const [secondsRemaining, setSecondsRemaining] = useState(calculateRemaining);

  useEffect(() => {
    if (!isStarted || endTime <= 0) return;

    setSecondsRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStarted, endTime, onTimeUp]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 text-center shadow animate-fade-in">
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
  );
});

interface QuizRunnerViewProps {
  quiz: Quiz;
  onSubmitQuiz: (studentName: string, studentClass: string, submissions: AnswerSubmission[], drawnQuestions?: Question[]) => void;
}

export default function QuizRunnerView({ quiz, onSubmitQuiz }: QuizRunnerViewProps) {
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [dynamicInfo, setDynamicInfo] = useState<Record<string, string>>({});
  const [passwordInput, setPasswordInput] = useState("");
  
  const [isStarted, setIsStarted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [nameError, setNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Randomize questions if configured
  const [examQuestions, setExamQuestions] = useState(quiz.questions);

  // Active exam state
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string[]>>({});
  const [examEndTime, setExamEndTime] = useState<number>(0);

  // Active index for scrolling or pagination focus
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // Proctoring state
  const [violations, setViolations] = useState(0);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(`quiz_session_${quiz.id}`);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.isStarted) {
          // If the saved exam already expired, don't restore it
          if (quiz.timeLimitMinutes > 0 && session.examEndTime && Date.now() > session.examEndTime) {
            localStorage.removeItem(`quiz_session_${quiz.id}`);
            return;
          }
          setStudentName(session.studentName || "");
          setStudentClass(session.studentClass || "");
          setDynamicInfo(session.dynamicInfo || {});
          setExamQuestions(session.examQuestions || quiz.questions);
          setCurrentAnswers(session.currentAnswers || {});
          setActiveQuestionIdx(session.activeQuestionIdx || 0);
          setViolations(session.violations || 0);
          setExamEndTime(session.examEndTime || 0);
          setIsStarted(true);
        }
      } catch (err) {
        console.error("Failed to parse saved quiz session", err);
      }
    }
  }, [quiz.id]);

  // Save session to localStorage on state changes
  useEffect(() => {
    if (isStarted) {
      const session = {
        studentName,
        studentClass,
        dynamicInfo,
        isStarted,
        examQuestions,
        currentAnswers,
        activeQuestionIdx,
        violations,
        examEndTime
      };
      localStorage.setItem(`quiz_session_${quiz.id}`, JSON.stringify(session));
    }
  }, [isStarted, studentName, studentClass, dynamicInfo, examQuestions, currentAnswers, activeQuestionIdx, violations, examEndTime, quiz.id]);

  // Proctoring visibility setup
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isStarted && quiz.proctoringMode === "monitor_screen_exit") {
        setViolations(v => v + 1);
        alert("Cảnh báo: Bạn đã thoát khỏi màn hình làm bài!");
      }
    };
    
    if (quiz.proctoringMode === "monitor_screen_exit") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (quiz.proctoringMode === "monitor_screen_exit") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [isStarted]);

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quiz.password && passwordInput !== quiz.password) {
      setPasswordError("Mật khẩu không chính xác.");
      return;
    }
    
    if (quiz.requireStudentInfo && quiz.studentInfoFields) {
      let missingField = false;
      quiz.studentInfoFields.forEach(field => {
        const val = dynamicInfo[field.id];
        if (!val || !val.trim()) {
          missingField = true;
        }
      });
      if (missingField) {
        setNameError("Vui lòng điền đầy đủ các thông tin yêu cầu.");
        return;
      }
    } else if (!studentName.trim()) {
      setNameError("Vui lòng nhập Họ và Tên của bạn để bắt đầu làm bài.");
      return;
    }
    
    // Extract studentName if it was collected in dynamic info (heuristically)
    let finalStudentName = studentName;
    if (quiz.requireStudentInfo && quiz.studentInfoFields && quiz.studentInfoFields.length > 0) {
      const nameField = quiz.studentInfoFields.find(f => f.label.toLowerCase().includes("tên") || f.label.toLowerCase().includes("name"));
      if (nameField) {
        finalStudentName = dynamicInfo[nameField.id];
      } else {
        // Fallback to the first collected field
        finalStudentName = dynamicInfo[quiz.studentInfoFields[0].id] || "Không xác định";
      }
    }
    setStudentName(finalStudentName);
    
    // Prepare randomized questions if configured
    let preparedQuestions = quiz.questions;
    
    if (quiz.isRandomized) {
      const shuffled = [...preparedQuestions].sort(() => Math.random() - 0.5);
      preparedQuestions = shuffled.slice(0, quiz.randomQuestionCount || 10);
    }
    
    if (quiz.groupByType) {
      const getPriority = (q: Question) => {
        if (q.questionType === "single") return 1;
        if (q.questionType === "multiple") return 2;
        if (q.questionType === "true_false" || q.questionType === "true_false_cluster") return 3;
        if (q.questionType === "short_answer") return 4;
        if (q.questionType === "case_study") return 5;
        return 6;
      };

      // Group questions
      const groups: Record<number, Question[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      preparedQuestions.forEach((q) => {
        const priority = getPriority(q);
        groups[priority].push(q);
      });

      // Shuffle within each group if shuffleQuestions is active
      if (quiz.shuffleQuestions) {
        Object.keys(groups).forEach((key) => {
          const priority = Number(key);
          groups[priority] = [...groups[priority]].sort(() => Math.random() - 0.5);
        });
      }

      preparedQuestions = [
        ...groups[1],
        ...groups[2],
        ...groups[3],
        ...groups[4],
        ...groups[5],
        ...groups[6],
      ];
    } else {
      // Shuffle the final list of questions if configured (and if not already randomized from bank)
      if (quiz.shuffleQuestions && !quiz.isRandomized) {
        preparedQuestions = [...preparedQuestions].sort(() => Math.random() - 0.5);
      }
    }
    
    // Shuffle answers within each question if configured
    if (quiz.shuffleAnswers) {
      preparedQuestions = preparedQuestions.map(q => {
        if ((q.questionType === "single" || q.questionType === "multiple") && q.options) {
          return {
            ...q,
            options: [...q.options].sort(() => Math.random() - 0.5)
          };
        }
        return q;
      });
    }

    setExamQuestions(preparedQuestions);
    
    const endTime = Date.now() + quiz.timeLimitMinutes * 60 * 1000;
    setExamEndTime(endTime);
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

  const constructStudentInfoString = () => {
    if (quiz.requireStudentInfo && quiz.studentInfoFields) {
      // Get all fields except the one we guessed is the name
      const nameField = quiz.studentInfoFields.find(f => f.label.toLowerCase().includes("tên") || f.label.toLowerCase().includes("name"));
      const otherFields = quiz.studentInfoFields.filter(f => f.id !== nameField?.id);
      
      const infoParts = otherFields.map(f => `${f.label}: ${dynamicInfo[f.id] || ""}`);
      if (quiz.proctoringMode === "monitor_screen_exit" && violations > 0) {
        infoParts.push(`Cảnh báo giám sát: ${violations} lần thoát màn hình`);
      }
      return infoParts.join(" | ");
    }
    
    // Fallback if no dynamic info
    const infoParts = [];
    if (studentClass.trim()) {
      infoParts.push(studentClass.trim());
    }
    if (quiz.proctoringMode === "monitor_screen_exit" && violations > 0) {
      infoParts.push(`Cảnh báo giám sát: ${violations} lần thoát màn hình`);
    }
    return infoParts.join(" | ");
  };

  const compileSubmissions = (): AnswerSubmission[] => {
    const compiledAnswers: AnswerSubmission[] = [];
    examQuestions.forEach((q) => {
      if (q.questionType === "case_study" && q.subQuestions) {
        q.subQuestions.forEach((subQ) => {
          const subAnsId = `${q.id}_${subQ.id}`;
          compiledAnswers.push({
            questionId: subAnsId,
            selectedAnswers: currentAnswers[subAnsId] || [],
          });
        });
        compiledAnswers.push({
          questionId: q.id,
          selectedAnswers: [],
        });
      } else {
        compiledAnswers.push({
          questionId: q.id,
          selectedAnswers: currentAnswers[q.id] || [],
        });
      }
    });
    return compiledAnswers;
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirm(false);
    localStorage.removeItem(`quiz_session_${quiz.id}`);

    const compiledAnswers = compileSubmissions();
    onSubmitQuiz(studentName.trim(), constructStudentInfoString(), compiledAnswers, examQuestions);
  };

  const handleSubmit = (auto: boolean = false) => {
    if (auto) {
      localStorage.removeItem(`quiz_session_${quiz.id}`);
      const compiledAnswers = compileSubmissions();
      onSubmitQuiz(studentName.trim(), constructStudentInfoString(), compiledAnswers, examQuestions);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  const now = new Date();
  const isBeforeStart = quiz.startTime && new Date(quiz.startTime) > now;
  const isAfterEnd = quiz.endTime && new Date(quiz.endTime) < now;
  const isTimeLocked = isBeforeStart || isAfterEnd;

  if (!isStarted) {
    if (isTimeLocked) {
      return (
        <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-2xl p-8 shadow-md text-center" id="quiz-runner-start">
          <div className="inline-flex p-4 bg-amber-50 text-amber-600 rounded-2xl mb-4">
            <Clock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 leading-tight mb-2">{quiz.title}</h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">Đề thi hiện không trong thời gian cho phép.</p>
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 inline-block text-left mb-6">
            {quiz.startTime && (
              <p className="text-sm text-slate-700"><strong>Mở lúc:</strong> {new Date(quiz.startTime).toLocaleString('vi-VN')}</p>
            )}
            {quiz.endTime && (
              <p className="text-sm text-slate-700"><strong>Đóng lúc:</strong> {new Date(quiz.endTime).toLocaleString('vi-VN')}</p>
            )}
          </div>
        </div>
      );
    }

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
            <p className="text-lg font-bold text-indigo-600">{examQuestions.length} câu</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-slate-400">Thời gian làm bài</p>
            <p className="text-lg font-bold text-indigo-600">
              {quiz.timeLimitMinutes > 0 ? `${quiz.timeLimitMinutes} phút` : "Không giới hạn"}
            </p>
          </div>
        </div>

        <form onSubmit={handleStartExam} className="space-y-4">
          {quiz.requireStudentInfo && quiz.studentInfoFields && quiz.studentInfoFields.length > 0 ? (
            quiz.studentInfoFields.map((field, idx) => {
              // Special case: Try to link the first field that looks like "name" to studentName state
              // But for simplicity, we just bind to dynamicInfo. We extract studentName in handleStartExam.
              return (
                <div key={field.id} className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    {idx === 0 && <User className="w-3.5 h-3.5 text-indigo-600" />} {field.label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Nhập ${field.label.toLowerCase()}...`}
                    value={dynamicInfo[field.id] || ""}
                    onChange={(e) => {
                      setDynamicInfo({ ...dynamicInfo, [field.id]: e.target.value });
                      setNameError("");
                    }}
                    className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold text-slate-800"
                  />
                </div>
              );
            })
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-600" /> Nhập Họ và Tên của học sinh để bắt đầu <span className="text-red-500">*</span>:
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
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  Lớp (Tuỳ chọn):
                </label>
                <input
                  type="text"
                  placeholder="Nhập lớp của bạn (ví dụ: 10A1)..."
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold text-slate-800"
                />
              </div>
            </>
          )}

          {nameError && (
            <p className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" /> {nameError}
            </p>
          )}

          {quiz.password && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                Mật khẩu đề thi <span className="text-red-500">*</span>:
              </label>
              <input
                type="password"
                required
                placeholder="Nhập mật khẩu..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError("");
                }}
                className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-semibold text-slate-800"
              />
              {passwordError && (
                <p className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> {passwordError}
                </p>
              )}
            </div>
          )}

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

  const getSectionHeaderForQuestion = (q: Question, questionsList: Question[]) => {
    const getPriority = (quest: Question) => {
      if (quest.questionType === "single") return 1;
      if (quest.questionType === "multiple") return 2;
      if (quest.questionType === "true_false" || quest.questionType === "true_false_cluster") return 3;
      if (quest.questionType === "short_answer") return 4;
      if (quest.questionType === "case_study") return 5;
      return 6;
    };

    const currentPriority = getPriority(q);
    const presentPriorities = Array.from(new Set(questionsList.map(getPriority))).sort((a, b) => a - b);
    const index = presentPriorities.indexOf(currentPriority);
    const partNumbers = ["I", "II", "III", "IV", "V", "VI"];
    const partNum = partNumbers[index] || (index + 1).toString();

    let title = "";
    let desc = "";
    if (currentPriority === 1) {
      title = `PHẦN ${partNum}: TRẮC NGHIỆM MỘT LỰA CHỌN`;
      desc = "Mỗi câu hỏi chỉ có một phương án trả lời đúng.";
    } else if (currentPriority === 2) {
      title = `PHẦN ${partNum}: TRẮC NGHIỆM NHIỀU LỰA CHỌN`;
      desc = "Mỗi câu hỏi có thể có nhiều phương án trả lời đúng.";
    } else if (currentPriority === 3) {
      title = `PHẦN ${partNum}: CÂU HỎI ĐÚNG / SAI`;
      desc = "Với mỗi ý/mệnh đề, hãy chọn Đúng hoặc Sai.";
    } else if (currentPriority === 4) {
      title = `PHẦN ${partNum}: CÂU HỎI TRẢ LỜI NGẮN`;
      desc = "Hãy điền đáp án ngắn chính xác vào ô trống.";
    } else if (currentPriority === 5) {
      title = `PHẦN ${partNum}: CÂU HỎI CHÙM / CASE STUDY`;
      desc = "Đọc kỹ dữ kiện và trả lời các câu hỏi phụ liên quan.";
    } else {
      title = `PHẦN ${partNum}: CÁC CÂU HỎI KHÁC`;
      desc = "Câu hỏi tự luận hoặc định dạng khác.";
    }

    return { title, desc };
  };

  const activeQuestion = examQuestions[activeQuestionIdx];

  return (
    <div 
      className={`grid grid-cols-1 lg:grid-cols-4 gap-6 ${quiz.proctoringMode !== "off" ? "select-none" : ""}`} 
      id="quiz-runner-active"
      onCopy={(e) => quiz.proctoringMode !== "off" && e.preventDefault()}
      onCut={(e) => quiz.proctoringMode !== "off" && e.preventDefault()}
      onPaste={(e) => quiz.proctoringMode !== "off" && e.preventDefault()}
      onContextMenu={(e) => quiz.proctoringMode !== "off" && e.preventDefault()}
    >
      {/* Question Navigation & Timer block (Col 1 on desktop) */}
      <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 h-fit order-first lg:order-last">
        {/* Timer Panel */}
        {quiz.timeLimitMinutes > 0 && (
          <QuizTimer endTime={examEndTime} onTimeUp={() => handleSubmit(true)} isStarted={isStarted} />
        )}

        {/* Question grid navigation (Moodle-style) */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Danh sách câu hỏi</h3>
          
          {quiz.groupByType ? (
            <div className="space-y-4">
              {(() => {
                const getPriority = (quest: Question) => {
                  if (quest.questionType === "single") return 1;
                  if (quest.questionType === "multiple") return 2;
                  if (quest.questionType === "true_false" || quest.questionType === "true_false_cluster") return 3;
                  if (quest.questionType === "short_answer") return 4;
                  if (quest.questionType === "case_study") return 5;
                  return 6;
                };

                const presentPriorities = Array.from(new Set(examQuestions.map(getPriority))).sort((a: number, b: number) => a - b);
                const partNumbers = ["I", "II", "III", "IV", "V", "VI"];

                return presentPriorities.map((priority, pIdx) => {
                  const partNum = partNumbers[pIdx] || (pIdx + 1).toString();
                  let partLabel = "";
                  if (priority === 1) partLabel = `Phần ${partNum}: Trắc nghiệm`;
                  else if (priority === 2) partLabel = `Phần ${partNum}: Nhiều đáp án`;
                  else if (priority === 3) partLabel = `Phần ${partNum}: Đúng/Sai`;
                  else if (priority === 4) partLabel = `Phần ${partNum}: Điền ngắn`;
                  else if (priority === 5) partLabel = `Phần ${partNum}: Câu hỏi chùm`;
                  else partLabel = `Phần ${partNum}: Khác`;

                  const matchingQuestions = examQuestions
                    .map((q, originalIdx) => ({ q, originalIdx }))
                    .filter(item => getPriority(item.q) === priority);

                  return (
                    <div key={priority} className="space-y-1.5">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{partLabel}</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {matchingQuestions.map(({ q, originalIdx }) => {
                          const isAnswered = (currentAnswers[q.id] || []).length > 0;
                          const isActive = activeQuestionIdx === originalIdx;
                          return (
                            <button
                              key={q.id}
                              onClick={() => setActiveQuestionIdx(originalIdx)}
                              className={`aspect-square inline-flex items-center justify-center text-xs font-bold rounded-lg transition-all ${
                                isActive
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : isAnswered
                                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                                  : "bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {originalIdx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {examQuestions.map((q, idx) => {
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
          )}

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
              Câu {activeQuestionIdx + 1} / {examQuestions.length}
            </span>
          </div>

          {quiz.groupByType && (
            (() => {
              const { title, desc } = getSectionHeaderForQuestion(activeQuestion, examQuestions);
              return (
                <div className="mb-5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                  <h3 className="text-xs font-black text-indigo-950 tracking-wider uppercase mb-1">{title}</h3>
                  <p className="text-[11px] text-indigo-600 font-medium leading-relaxed">{desc}</p>
                </div>
              );
            })()
          )}

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
              <LatexRenderer>{activeQuestion.questionText}</LatexRenderer>
            </h2>
            {activeQuestion.imageUrl && (
              <div className="mt-4">
                <img 
                  src={activeQuestion.imageUrl} 
                  alt="Question image" 
                  className="max-h-64 object-contain rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => setZoomedImage(activeQuestion.imageUrl!)}
                />
              </div>
            )}
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
                        <span><LatexRenderer>{option}</LatexRenderer></span>
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
                        <span><LatexRenderer>{option}</LatexRenderer></span>
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
                       <span className="text-sm font-medium text-slate-800"><LatexRenderer>{option}</LatexRenderer></span>
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

            {activeQuestion.questionType === "case_study" && activeQuestion.subQuestions && activeQuestion.subQuestions.length > 0 && (
              <div className="space-y-6 border-l-2 border-indigo-100 pl-4">
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 mb-2">
                  <p className="text-xs text-indigo-950 font-semibold">Đây là câu hỏi dạng đọc hiểu / tình huống có chứa {activeQuestion.subQuestions.length} câu hỏi phụ. Hãy trả lời lần lượt từng câu hỏi bên dưới.</p>
                </div>
                {activeQuestion.subQuestions.map((subQ, sIdx) => {
                  const subAnsId = `${activeQuestion.id}_${subQ.id}`;
                  return (
                    <div key={subQ.id} className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-3">
                      <div className="flex items-start gap-1.5 border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">Câu {sIdx + 1}</span>
                        <h4 className="text-sm font-semibold text-slate-800 leading-relaxed"><LatexRenderer>{subQ.questionText}</LatexRenderer></h4>
                      </div>

                      {/* Single Choice Sub-question */}
                      {subQ.questionType === "single" && (
                        <div className="grid grid-cols-1 gap-2">
                          {subQ.options.map((option, optIdx) => {
                            const isChecked = (currentAnswers[subAnsId] || []).includes(option);
                            return (
                              <label
                                key={optIdx}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-medium"
                                    : "bg-slate-50/30 border-slate-100 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`subq-${subAnsId}`}
                                  checked={isChecked}
                                  onChange={() => handleSelectAnswer(subAnsId, option, false)}
                                  className="w-3.5 h-3.5 text-indigo-600 mt-0.5"
                                />
                                <span className="font-bold text-slate-400 shrink-0 uppercase">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span>{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Multiple Choice Sub-question */}
                      {subQ.questionType === "multiple" && (
                        <div className="grid grid-cols-1 gap-2">
                          {subQ.options.map((option, optIdx) => {
                            const isChecked = (currentAnswers[subAnsId] || []).includes(option);
                            return (
                              <label
                                key={optIdx}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-medium"
                                    : "bg-slate-50/30 border-slate-100 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleSelectAnswer(subAnsId, option, true)}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded mt-0.5"
                                />
                                <span className="font-bold text-slate-400 shrink-0 uppercase">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span>{option}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* True False Sub-question */}
                      {subQ.questionType === "true_false" && (
                        <div className="flex gap-4">
                          {["Đúng", "Sai"].map((choice, optIdx) => {
                            const isChecked = (currentAnswers[subAnsId] || []).includes(choice);
                            return (
                              <label
                                key={optIdx}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-medium"
                                    : "bg-slate-50/30 border-slate-100 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`subq-${subAnsId}`}
                                  checked={isChecked}
                                  onChange={() => handleSelectAnswer(subAnsId, choice, false)}
                                  className="w-3.5 h-3.5 text-indigo-600"
                                />
                                <span>{choice}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Short Answer Sub-question */}
                      {subQ.questionType === "short_answer" && (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Nhập đáp án ngắn..."
                            value={currentAnswers[subAnsId]?.[0] || ""}
                            onChange={(e) => handleTextChange(subAnsId, e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
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

            {activeQuestionIdx < examQuestions.length - 1 ? (
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

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center pointer-events-none">
            <button 
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md pointer-events-auto transition-colors"
              onClick={() => setZoomedImage(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={zoomedImage} 
              alt="Zoomed" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl pointer-events-auto cursor-default border border-white/10" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
