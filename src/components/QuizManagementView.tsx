import React, { useState } from "react";
import { Quiz } from "../types";
import { Search, Clock, FileText, Share2, Trash2, Settings, Copy, ExternalLink, Play, Globe, Globe2, EyeOff, Settings2, BarChart2 } from "lucide-react";
import QuizConfigModal from "./QuizConfigModal";

interface QuizManagementViewProps {
  quizzes: Quiz[];
  onDeleteQuiz: (quizId: string) => void;
  onShareQuiz: (quiz: Quiz) => void;
  onStartQuiz: (quiz: Quiz) => void;
  onUnpublishQuiz: (quiz: Quiz) => void;
  onUpdateQuiz: (updatedQuiz: Quiz) => void;
  onViewStats: (quiz: Quiz) => void;
}

export default function QuizManagementView({ quizzes, onDeleteQuiz, onShareQuiz, onStartQuiz, onUnpublishQuiz, onUpdateQuiz, onViewStats }: QuizManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [editingConfigQuiz, setEditingConfigQuiz] = useState<Quiz | null>(null);
  
  // Extract unique subjects
  const subjects = Array.from(new Set(quizzes.map(q => q.subject).filter(Boolean))) as string[];

  const filteredQuizzes = quizzes.filter(q => {
    const matchSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        q.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSubject = filterSubject ? q.subject === filterSubject : true;
    return matchSearch && matchSubject;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-50 pb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" /> Quản lý đề thi xuất bản
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống quản lý, thống kê và chia sẻ các đề thi đã được tạo ra.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
             <div className="text-center px-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số</div>
                <div className="text-xl font-black text-indigo-700">{quizzes.length}</div>
             </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên hoặc mã đề..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-sm font-medium text-slate-700"
            />
          </div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-sm font-medium text-slate-700 sm:w-48"
          >
            <option value="">Tất cả môn học</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/50">
                <th className="p-4 font-semibold rounded-tl-lg">Thông tin đề thi</th>
                <th className="p-4 font-semibold">Cấu hình</th>
                <th className="p-4 font-semibold">Bảo mật</th>
                <th className="p-4 font-semibold text-right rounded-tr-lg">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredQuizzes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-400">
                    <p className="text-sm font-medium">Không tìm thấy đề thi nào.</p>
                  </td>
                </tr>
              ) : (
                filteredQuizzes.map(quiz => (
                  <tr key={quiz.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">{quiz.title}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">#{quiz.id.split("-").pop()}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {quiz.grade && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Khối {quiz.grade}</span>}
                          {quiz.subject && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{quiz.subject}</span>}
                          {quiz.publishedId ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Globe className="w-3 h-3" /> Đã xuất bản</span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1"><EyeOff className="w-3 h-3" /> Chưa xuất bản</span>
                          )}
                        </div>
                        {(quiz.startTime || quiz.endTime) && (
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {quiz.startTime ? `Từ ${new Date(quiz.startTime).toLocaleString('vi-VN')}` : 'Mở luôn'} - {quiz.endTime ? `Đến ${new Date(quiz.endTime).toLocaleString('vi-VN')}` : 'Không đóng'}
                            </span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 pt-1">
                          Tạo ngày: <span className="font-medium text-slate-500">{quiz.createdAt}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 align-top">
                       <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                             <span className="w-20 inline-block text-slate-400 text-[10px] uppercase font-bold">Thời gian:</span>
                             <span className="font-medium">{quiz.timeLimitMinutes === 0 ? "Không giới hạn" : `${quiz.timeLimitMinutes} phút`}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                             <span className="w-20 inline-block text-slate-400 text-[10px] uppercase font-bold">Số câu:</span>
                             <span className="font-medium">{quiz.isRandomized ? `${quiz.randomQuestionCount} (Ngẫu nhiên)` : quiz.questions.length}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                             <span className="w-20 inline-block text-slate-400 text-[10px] uppercase font-bold">Cấu hình:</span>
                             <span className="font-medium">
                               {[
                                 quiz.shuffleQuestions || quiz.isRandomized ? "Xáo trộn câu" : "",
                                 quiz.shuffleAnswers ? "Xáo trộn đáp án" : "",
                                 quiz.groupByType ? "Thi theo phần" : ""
                               ].filter(Boolean).join(", ") || "Mặc định"}
                             </span>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 align-top">
                      <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                             <span className="w-20 inline-block text-slate-400 text-[10px] uppercase font-bold">Mật khẩu:</span>
                             {quiz.password ? <span className="font-medium text-amber-600">{quiz.password}</span> : <span className="text-slate-400">Không</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                             <span className="w-20 inline-block text-slate-400 text-[10px] uppercase font-bold">Số lượt:</span>
                             <span className="font-medium">{quiz.maxAttempts ? quiz.maxAttempts : "Không giới hạn"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                             <span className="w-20 inline-block text-slate-400 text-[10px] uppercase font-bold">Giám sát:</span>
                             <span className="font-medium">{quiz.proctoringMode === "monitor_screen_exit" ? "Bật" : "Tắt"}</span>
                          </div>
                       </div>
                    </td>
                    <td className="p-4 align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        {quiz.publishedId && (
                          <button
                            onClick={() => onUnpublishQuiz(quiz)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Hủy xuất bản"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewStats(quiz)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Xem thống kê"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingConfigQuiz(quiz)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Thiết lập cấu hình"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onShareQuiz(quiz)}
                          className={`p-1.5 rounded-lg transition-colors ${quiz.publishedId ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          title={quiz.publishedId ? "Lấy link chia sẻ" : "Xuất bản và chia sẻ"}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onStartQuiz(quiz)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Làm bài thử"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteQuiz(quiz.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa đề thi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {editingConfigQuiz && (
        <QuizConfigModal
          quiz={editingConfigQuiz}
          onSave={(updatedQuiz) => {
            onUpdateQuiz(updatedQuiz);
            setEditingConfigQuiz(null);
          }}
          onClose={() => setEditingConfigQuiz(null)}
        />
      )}
    </div>
  );
}
