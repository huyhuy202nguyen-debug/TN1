import React, { useState, useEffect } from "react";
import { Quiz } from "../types";
import { fetchResultsFromSheet } from "../lib/googleSheets";
import { getAccessToken } from "../lib/firebase";
import { 
  ArrowLeft, 
  Loader2, 
  BarChart2, 
  Users, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  Calendar, 
  User, 
  ChevronRight, 
  BookOpen,
  Filter,
  Download
} from "lucide-react";
import { LatexRenderer } from "./LatexRenderer";

interface QuizStatsViewProps {
  quiz: Quiz;
  spreadsheetId: string | null;
  onBack: () => void;
}

type SubTab = "stats" | "submissions";

export default function QuizStatsView({ quiz, spreadsheetId, onBack }: QuizStatsViewProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("submissions");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // Search & Filter state for submissions
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      if (!spreadsheetId) {
        setLoading(false);
        setError("Vui lòng liên kết Google Sheets ở trang chủ để xem thống kê.");
        return;
      }
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Vui lòng đăng nhập lại Google.");
        
        const allResults = await fetchResultsFromSheet(token, spreadsheetId);
        // Filter by quizId
        const quizResults = allResults.filter(r => r.quizId === quiz.id);
        
        // Sort submissions newest first by default
        quizResults.sort((a, b) => {
          const dateA = new Date(a.submittedAt.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
          const dateB = new Date(b.submittedAt.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
          return dateB.getTime() - dateA.getTime();
        });

        setResults(quizResults);
      } catch (err: any) {
        setError(err.message || "Lỗi khi tải dữ liệu thống kê.");
      } finally {
        setLoading(false);
      }
    };
    
    loadStats();
  }, [quiz.id, spreadsheetId]);

  // Helper to determine if a specific question submission was completely correct
  const isQuestionSubmissionCorrect = (q: any, rawAns: string) => {
    if (!rawAns) return false;
    const studentAns = q.questionType === "case_study" ? rawAns.split(" | ") : rawAns.split(", ");
    const correctAnswers = q.correctAnswers || [];
    
    if (q.questionType === "case_study") {
      const subGrades = (q.subQuestions || []).map((subQ: any, sIdx: number) => {
        const subRawAns = studentAns[sIdx] || "";
        const subStudentAns = subRawAns && subRawAns !== "(Trống)" ? subRawAns.split(", ") : [];
        const subCorrectAnswers = subQ.correctAnswers || [];
        
        if (subQ.questionType === "single" || subQ.questionType === "true_false") {
          return (
            subStudentAns.length === 1 &&
            subCorrectAnswers.length === 1 &&
            subStudentAns[0].toLowerCase().trim() === subCorrectAnswers[0].toLowerCase().trim()
          );
        } else if (subQ.questionType === "multiple") {
          const sortedStudent = [...subStudentAns].sort();
          const sortedCorrect = [...subCorrectAnswers].sort();
          return (
            sortedStudent.length === sortedCorrect.length &&
            sortedStudent.every((val, idx) => val.toLowerCase().trim() === sortedCorrect[idx].toLowerCase().trim())
          );
        } else if (subQ.questionType === "short_answer") {
          return (
            subStudentAns.length === 1 &&
            subCorrectAnswers.some((ans: string) => ans.toLowerCase().trim() === subStudentAns[0].toLowerCase().trim())
          );
        }
        return false;
      });
      return subGrades.every(sg => sg === true);
    } else if (q.questionType === "single" || q.questionType === "true_false") {
      return (
        studentAns.length === 1 &&
        correctAnswers.length === 1 &&
        studentAns[0].toLowerCase().trim() === correctAnswers[0].toLowerCase().trim()
      );
    } else if (q.questionType === "multiple") {
      const sortedStudent = studentAns.map((v: string) => v.toLowerCase().trim()).sort();
      const sortedCorrect = correctAnswers.map((v: string) => v.toLowerCase().trim()).sort();
      return (
        sortedStudent.length === sortedCorrect.length &&
        sortedStudent.every((val, idx) => val === sortedCorrect[idx])
      );
    } else if (q.questionType === "true_false_cluster") {
      return (
        studentAns.length === correctAnswers.length &&
        studentAns.every((ans, i) => ans.toLowerCase().trim() === correctAnswers[i].toLowerCase().trim())
      );
    } else if (q.questionType === "short_answer") {
      return (
        studentAns.length === 1 &&
        correctAnswers.some((ans: string) => ans.toLowerCase().trim() === studentAns[0].toLowerCase().trim())
      );
    }
    return false;
  };

  // Calculate statistics for each question
  const calculateQuestionStats = (qIndex: number) => {
     const question = quiz.questions[qIndex];
     const totalSubmissions = results.length;
     if (totalSubmissions === 0) return { total: 0, breakdown: {}, correctCount: 0 };
     
     const breakdown: Record<string, number> = {};
     let correctCount = 0;
     
     results.forEach(r => {
        const rawAns = r.questionAnswers[qIndex];
        const ans = rawAns || "(Trống)";
        breakdown[ans] = (breakdown[ans] || 0) + 1;
        
        if (isQuestionSubmissionCorrect(question, rawAns)) {
           correctCount++;
        }
     });
     
     return { total: totalSubmissions, breakdown, correctCount };
  };

  // Get unique student classes
  const classes = Array.from(new Set(results.map(r => r.studentClass).filter(Boolean))) as string[];

  // Filtered submissions list
  const filteredSubmissions = results.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass ? r.studentClass === filterClass : true;
    return matchesSearch && matchesClass;
  });

  const getScoreBadgeStyle = (score: number) => {
    if (score >= 8.0) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (score >= 5.0) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-rose-50 text-rose-700 border-rose-100";
  };

  // Reconstruct detailed grades for the selected submission
  const getDetailedGradesForSelected = () => {
    if (!selectedSubmission) return [];
    
    return quiz.questions.filter(Boolean).map((q, idx) => {
      const rawAns = selectedSubmission.questionAnswers[idx];
      const studentAns = rawAns ? (q.questionType === "case_study" ? rawAns.split(" | ") : rawAns.split(", ")) : [];
      const correctAnswers = q.correctAnswers || [];
      const options = q.options || [];
      
      let isCorrect = false;
      let subGrades: any[] = [];

      if (q.questionType === "case_study") {
        subGrades = (q.subQuestions || []).map((subQ, sIdx) => {
          const subRawAns = studentAns[sIdx] || "";
          const subStudentAns = subRawAns && subRawAns !== "(Trống)" ? subRawAns.split(", ") : [];
          const subCorrectAnswers = subQ.correctAnswers || [];
          
          let subIsCorrect = false;
          if (subQ.questionType === "single" || subQ.questionType === "true_false") {
            subIsCorrect =
              subStudentAns.length === 1 &&
              subCorrectAnswers.length === 1 &&
              subStudentAns[0].toLowerCase().trim() === subCorrectAnswers[0].toLowerCase().trim();
          } else if (subQ.questionType === "multiple") {
            const sortedStudent = [...subStudentAns].sort();
            const sortedCorrect = [...subCorrectAnswers].sort();
            subIsCorrect =
              sortedStudent.length === sortedCorrect.length &&
              sortedStudent.every((val, idx) => val.toLowerCase().trim() === sortedCorrect[idx].toLowerCase().trim());
          } else if (subQ.questionType === "short_answer") {
            subIsCorrect =
              subStudentAns.length === 1 &&
              subCorrectAnswers.some((ans) => ans.toLowerCase().trim() === subStudentAns[0].toLowerCase().trim());
          }

          return {
            questionId: subQ.id,
            questionText: subQ.questionText,
            questionType: subQ.questionType,
            isCorrect: subIsCorrect,
            studentAnswers: subStudentAns,
            correctAnswers: subCorrectAnswers,
            options: subQ.options || [],
            explanation: subQ.explanation || "",
          };
        });
        isCorrect = subGrades.every(sg => sg.isCorrect);
      } else if (q.questionType === "single" || q.questionType === "true_false") {
        isCorrect =
          studentAns.length === 1 &&
          correctAnswers.length === 1 &&
          studentAns[0] === correctAnswers[0];
      } else if (q.questionType === "multiple") {
        isCorrect =
          studentAns.length === correctAnswers.length &&
          studentAns.every((ans) => correctAnswers.includes(ans));
      } else if (q.questionType === "true_false_cluster") {
        isCorrect =
          studentAns.length === correctAnswers.length &&
          studentAns.every((ans, i) => ans === correctAnswers[i]);
      } else {
        isCorrect = studentAns.join(", ") === correctAnswers.join(", ");
      }

      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        isCorrect,
        studentAnswers: studentAns,
        correctAnswers,
        options,
        explanation: q.explanation || "",
        imageUrl: q.imageUrl,
        subGrades,
      };
    });
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;

    const headers = [
      "STT",
      "Họ và tên",
      "Lớp",
      "Thời gian nộp",
      "Số câu đúng",
      "Tổng số câu",
      "Điểm số"
    ];

    quiz.questions.forEach((_, idx) => {
      headers.push(`Câu ${idx + 1}`);
    });

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.join(",")];

    results.forEach((res, index) => {
      const rowData = [
        index + 1,
        res.studentName,
        res.studentClass || "",
        res.submittedAt,
        res.correctCount,
        res.totalQuestions,
        res.score.toFixed(1)
      ];

      quiz.questions.forEach((_, idx) => {
        const rawAns = res.questionAnswers[idx] || "";
        rowData.push(rawAns);
      });

      csvRows.push(rowData.map(escapeCSV).join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeTitle = quiz.title.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, "").replace(/\s+/g, "_");
    link.setAttribute("download", `diem_thi_${safeTitle || "de_thi"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Thống kê kết quả thi</h2>
            <p className="text-sm text-slate-500">Đề thi: {quiz.title}</p>
          </div>
        </div>

        {results.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-4 h-4" /> Xuất file điểm (.csv)
          </button>
        )}
      </div>
      
      {loading ? (
        <div className="flex items-center gap-2 p-8 justify-center bg-white border border-slate-100 rounded-2xl shadow-sm">
           <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
           <span className="text-sm text-slate-600">Đang tải dữ liệu từ Google Sheets...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 border border-rose-100 rounded-2xl shadow-sm">
           <p className="text-sm text-rose-700 font-medium">{error}</p>
        </div>
      ) : results.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl shadow-sm">
           <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
           <p className="text-sm text-slate-600 font-medium">Chưa có kết quả thi nào được ghi nhận cho đề thi này.</p>
        </div>
      ) : (
        <div className="space-y-6">
           {/* Top Stats Cards */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
                 <p className="text-xs font-bold uppercase text-slate-400 mb-1">Số lượt nộp bài</p>
                 <p className="text-2xl font-bold text-indigo-600">{results.length}</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
                 <p className="text-xs font-bold uppercase text-slate-400 mb-1">Điểm trung bình</p>
                 <p className="text-2xl font-bold text-emerald-600">
                    {(results.reduce((acc, r) => acc + r.score, 0) / results.length).toFixed(1)} / 10
                 </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
                 <p className="text-xs font-bold uppercase text-slate-400 mb-1">Điểm cao nhất</p>
                 <p className="text-2xl font-bold text-blue-600">
                    {Math.max(...results.map(r => r.score)).toFixed(1)}
                 </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
                 <p className="text-xs font-bold uppercase text-slate-400 mb-1">Điểm thấp nhất</p>
                 <p className="text-2xl font-bold text-amber-600">
                    {Math.min(...results.map(r => r.score)).toFixed(1)}
                 </p>
              </div>
           </div>

           {/* Tab selection */}
           <div className="flex border-b border-slate-200">
             <button
               onClick={() => { setActiveSubTab("submissions"); setSelectedSubmission(null); }}
               className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-2 ${
                 activeSubTab === "submissions" && !selectedSubmission
                   ? "border-indigo-600 text-indigo-600"
                   : "border-transparent text-slate-500 hover:text-slate-800"
               }`}
             >
               <Users className="w-4 h-4" /> Danh sách bài làm ({results.length})
             </button>
             <button
               onClick={() => { setActiveSubTab("stats"); setSelectedSubmission(null); }}
               className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-2 ${
                 activeSubTab === "stats" && !selectedSubmission
                   ? "border-indigo-600 text-indigo-600"
                   : "border-transparent text-slate-500 hover:text-slate-800"
               }`}
             >
               <BarChart2 className="w-4 h-4" /> Thống kê câu hỏi
             </button>
           </div>

           {/* Content depending on active sub-tab */}
           {selectedSubmission ? (
             /* DETAILED INDIVIDUAL STUDENT SUBMISSION TEST PAPER VIEW */
             <div className="space-y-6">
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
                      <div className="space-y-1">
                         <button
                           onClick={() => setSelectedSubmission(null)}
                           className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 mb-2 cursor-pointer"
                         >
                            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách
                         </button>
                         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                           <User className="w-5 h-5 text-slate-500" />
                           Chi tiết bài làm: {selectedSubmission.studentName}
                         </h3>
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            {selectedSubmission.studentClass && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Lớp: {selectedSubmission.studentClass}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Nộp lúc: {selectedSubmission.submittedAt}
                            </span>
                         </div>
                      </div>

                      <div className={`px-4 py-3 border rounded-xl flex flex-col items-center justify-center shrink-0 min-w-[120px] ${getScoreBadgeStyle(selectedSubmission.score)}`}>
                         <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Điểm số</span>
                         <span className="text-2xl font-black">{selectedSubmission.score.toFixed(1)}</span>
                         <span className="text-[10px] font-medium mt-0.5">Đúng {selectedSubmission.correctCount}/{selectedSubmission.totalQuestions} câu</span>
                      </div>
                   </div>

                   {/* Submissions detailed list */}
                   <div className="space-y-6">
                     {getDetailedGradesForSelected().map((grade, idx) => {
                       const isCorrect = grade.isCorrect;
                       return (
                         <div
                           key={grade.questionId}
                           className={`bg-white border rounded-xl p-5 transition-all border-l-4 ${
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
                                   <CheckCircle className="w-3 h-3" /> Đúng
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                                   <XCircle className="w-3 h-3" /> Sai
                                 </span>
                               )}
                             </div>
                           </div>

                           {/* Question Text */}
                           <div className="text-sm font-semibold text-slate-800 mb-4">
                             <LatexRenderer>{grade.questionText || "Đang tải câu hỏi..."}</LatexRenderer>
                           </div>

                           {grade.imageUrl && (
                             <div className="mb-4">
                               <img src={grade.imageUrl} alt="Question image" className="max-h-48 object-contain rounded-lg border border-slate-200" />
                             </div>
                           )}

                           {/* Options list */}
                           {grade.options.length > 0 && grade.questionType !== "true_false_cluster" && grade.questionType !== "case_study" && (
                             <div className="flex flex-col gap-2 mb-4">
                               {grade.options.map((opt, i) => {
                                 const isStudentChoice = grade.studentAnswers.includes(opt);
                                 const isCorrectChoice = grade.correctAnswers.includes(opt);
                                 
                                 let optStyle = "bg-white border-slate-200 text-slate-700";
                                 if (isCorrectChoice) {
                                    optStyle = "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium";
                                 } else if (isStudentChoice) {
                                    optStyle = "bg-rose-50 border-rose-200 text-rose-800";
                                 }

                                 return (
                                   <div key={i} className={`text-sm px-3 py-2 border rounded-lg ${optStyle}`}>
                                     <LatexRenderer>{opt}</LatexRenderer>
                                   </div>
                                 );
                               })}
                             </div>
                           )}

                           {/* True False Cluster Layout */}
                           {grade.questionType !== "case_study" && grade.questionType === "true_false_cluster" && grade.options.length > 0 ? (
                             <div className="space-y-2 mb-4">
                               {grade.options.map((opt, i) => {
                                 const stAns = grade.studentAnswers[i];
                                 const correctAns = grade.correctAnswers[i];
                                 const isCorrectStatement = stAns === correctAns;
                                 const isMissing = !stAns;
                                 
                                 return (
                                   <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg gap-2">
                                     <div className="text-sm text-slate-700 flex-1"><LatexRenderer>{opt}</LatexRenderer></div>
                                     <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
                                       <div className="flex flex-col items-end">
                                         <span className="text-[10px] text-slate-400 uppercase">Học sinh chọn</span>
                                         <span className={isMissing ? "text-slate-500" : isCorrectStatement ? "text-emerald-600" : "text-rose-600"}>{stAns || "(Trống)"}</span>
                                       </div>
                                       <div className="flex flex-col items-end">
                                         <span className="text-[10px] text-slate-400 uppercase">Đáp án đúng</span>
                                         <span className="text-emerald-600">{correctAns}</span>
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           ) : grade.questionType !== "case_study" ? (
                             /* Default answers display */
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                               <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                 <p className="text-[10px] font-bold uppercase text-slate-400">Trả lời của học sinh</p>
                                 <p className={`text-xs font-semibold mt-1 ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                                   {grade.studentAnswers.length > 0 ? <LatexRenderer>{grade.studentAnswers.join(", ")}</LatexRenderer> : "(Bỏ trống)"}
                                 </p>
                               </div>

                               <div className="bg-emerald-50/35 border border-emerald-100/50 rounded-xl p-3">
                                 <p className="text-[10px] font-bold uppercase text-emerald-600">Đáp án chính xác</p>
                                 <p className="text-xs font-semibold text-emerald-800 mt-1">
                                   <LatexRenderer>{grade.correctAnswers.join(", ")}</LatexRenderer>
                                 </p>
                               </div>
                             </div>
                           ) : null}

                           {/* Explanation */}
                           {grade.explanation && (
                             <div className="bg-indigo-50/30 border border-indigo-100/40 rounded-xl p-3 flex items-start gap-2.5 text-xs mt-3">
                               <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                               <div className="space-y-1 text-indigo-900">
                                 <p className="font-bold">Lời giải chi tiết:</p>
                                 <div className="opacity-90 leading-relaxed"><LatexRenderer>{grade.explanation}</LatexRenderer></div>
                               </div>
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>
                </div>
             </div>
           ) : activeSubTab === "submissions" ? (
             /* SUBMISSIONS LIST WITH ADVANCED SEARCH AND CLASS FILTERING */
             <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm học sinh theo tên..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-400 bg-white"
                    />
                  </div>
                  
                  {classes.length > 0 && (
                    <div className="flex items-center gap-2 min-w-[180px]">
                      <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                      <select
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-white cursor-pointer"
                      >
                        <option value="">Tất cả các lớp</option>
                        {classes.map(c => (
                          <option key={c} value={c}>Lớp {c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                         <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                               <th className="p-4 w-12 text-center">STT</th>
                               <th className="p-4">Họ và tên</th>
                               <th className="p-4">Lớp</th>
                               <th className="p-4">Thời gian nộp</th>
                               <th className="p-4 text-center">Số câu đúng</th>
                               <th className="p-4 text-center">Điểm số</th>
                               <th className="p-4 text-right">Chi tiết</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {filteredSubmissions.length === 0 ? (
                               <tr>
                                  <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                                     Không tìm thấy bài làm nào khớp với điều kiện.
                                  </td>
                               </tr>
                            ) : (
                               filteredSubmissions.map((res, index) => {
                                 // Initials for avatar
                                 const initials = res.studentName
                                   .split(" ")
                                   .slice(-2)
                                   .map((n: string) => n[0])
                                   .join("")
                                   .toUpperCase();
                                   
                                 return (
                                   <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                                      <td className="p-4 text-center text-xs font-semibold text-slate-400">
                                         {index + 1}
                                      </td>
                                      <td className="p-4">
                                         <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                                               {initials || <User className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                               {res.studentName}
                                            </span>
                                         </div>
                                      </td>
                                      <td className="p-4 text-sm text-slate-600 font-medium">
                                         {res.studentClass ? `Lớp ${res.studentClass}` : "—"}
                                      </td>
                                      <td className="p-4 text-xs text-slate-500 font-medium">
                                         {res.submittedAt}
                                      </td>
                                      <td className="p-4 text-center text-sm font-semibold text-slate-700">
                                         {res.correctCount} / {res.totalQuestions}
                                      </td>
                                      <td className="p-4">
                                         <div className="flex justify-center">
                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${getScoreBadgeStyle(res.score)}`}>
                                               {res.score.toFixed(1)} / 10
                                            </span>
                                         </div>
                                      </td>
                                      <td className="p-4 text-right">
                                         <button
                                           onClick={() => setSelectedSubmission(res)}
                                           className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/40 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                         >
                                            <Eye className="w-3.5 h-3.5" /> Xem bài làm
                                         </button>
                                      </td>
                                   </tr>
                                 );
                               })
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
           ) : (
             /* QUESTION-BY-QUESTION ANALYSIS TAB */
             <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-base font-bold text-slate-800">Thống kê chi tiết theo câu hỏi</h3>
                 <p className="text-xs text-slate-500">
                   Dữ liệu được thống kê trực tiếp từ bài làm của học sinh.
                 </p>
               </div>
               <div className="space-y-8">
                  {quiz.questions.map((q, idx) => {
                     const stats = calculateQuestionStats(idx);
                     const correctRate = stats.total > 0 ? (stats.correctCount / stats.total) * 100 : 0;
                     return (
                       <div key={q.id} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                         <p className="text-sm font-semibold text-slate-800 mb-2 flex items-start gap-2">
                           <span className="text-indigo-600 mt-1">Câu {idx + 1}:</span>
                           <span className="flex-1"><LatexRenderer>{q.questionText}</LatexRenderer></span>
                         </p>
                         <div className="flex items-center gap-3 mb-4 ml-10">
                           <span className="text-xs font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                             Tỉ lệ đúng: {correctRate.toFixed(1)}%
                           </span>
                           <span className="text-xs font-medium text-slate-500">
                             {stats.correctCount} / {stats.total} học sinh trả lời đúng
                           </span>
                         </div>
                         
                         <div className="space-y-3 pl-10 border-l-2 border-slate-100 ml-10">
                           {Object.entries(stats.breakdown).sort((a,b) => b[1] - a[1]).map(([ans, count]) => {
                             const isCorrectAns = ans === q.correctAnswers.join(", ");
                             const pct = (count / stats.total) * 100;
                             return (
                               <div key={ans} className="flex items-center gap-4 text-sm">
                                 <div className="w-1/3 truncate text-slate-700" title={ans}>
                                   <LatexRenderer>{ans}</LatexRenderer>
                                   {isCorrectAns && <span className="ml-2 text-[10px] text-emerald-600 font-bold uppercase">(Đáp án)</span>}
                                 </div>
                                 <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                   <div 
                                     className={`h-full ${isCorrectAns ? "bg-emerald-500" : "bg-slate-400"}`} 
                                     style={{ width: `${pct}%` }} 
                                   />
                                 </div>
                                 <div className="w-20 text-right text-xs font-semibold text-slate-600">
                                   {count} ({pct.toFixed(0)}%)
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     );
                  })}
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
}
