import React, { useState, useEffect } from 'react';
import { Quiz } from '../types';
import { X, Clock, AlertCircle } from 'lucide-react';

interface QuizConfigModalProps {
  quiz: Quiz;
  onSave: (updatedQuiz: Quiz) => void;
  onClose: () => void;
}

export default function QuizConfigModal({ quiz, onSave, onClose }: QuizConfigModalProps) {
  const [timeLimit, setTimeLimit] = useState(quiz.timeLimitMinutes || 15);
  const [startTime, setStartTime] = useState(quiz.startTime || "");
  const [endTime, setEndTime] = useState(quiz.endTime || "");
  const [shuffleQuestions, setShuffleQuestions] = useState(quiz.shuffleQuestions || false);
  const [groupByType, setGroupByType] = useState(quiz.groupByType || false);
  const [shuffleAnswers, setShuffleAnswers] = useState(quiz.shuffleAnswers || false);
  const [showScore, setShowScore] = useState(quiz.showScore || "when_finished");
  const [showAnswers, setShowAnswers] = useState(quiz.showAnswers || "when_finished");
  const [hideCorrectAnswerForWrong, setHideCorrectAnswerForWrong] = useState(quiz.hideCorrectAnswerForWrong || false);
  const [maxAttempts, setMaxAttempts] = useState<number | "">(quiz.maxAttempts ?? "");
  const [quizPassword, setQuizPassword] = useState(quiz.password || "");
  const [proctoringMode, setProctoringMode] = useState(quiz.proctoringMode || "off");

  const handleSave = () => {
    onSave({
      ...quiz,
      timeLimitMinutes: timeLimit,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      shuffleQuestions,
      groupByType,
      shuffleAnswers,
      showScore,
      showAnswers,
      hideCorrectAnswerForWrong,
      maxAttempts: maxAttempts === "" ? undefined : maxAttempts,
      password: quizPassword,
      proctoringMode,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-50 rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Cấu hình đề thi</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Settings Form */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-50 pb-2">
              THỜI GIAN
            </h2>
            <div className="grid grid-cols-1 gap-4">
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
                  className="w-full text-xs px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 transition-all"
                />
              </div>

              <div className="space-y-2 mt-2">
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
                <span className="text-xs text-slate-400 font-normal ml-2">Phần trắc nghiệm, nhiều đáp án, đúng/sai, trả lời ngắn, câu hỏi chùm được phân biệt, không trộn lẫn</span>
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
                    <input type="radio" name="showAnswers" value="when_reach_score" checked={showAnswers === "when_reach_score"} onChange={() => setShowAnswers("when_reach_score")} className="accent-indigo-600 w-4 h-4" /> Khi đạt đến điểm số
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
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Lưu Cấu Hình
          </button>
        </div>
      </div>
    </div>
  );
}
