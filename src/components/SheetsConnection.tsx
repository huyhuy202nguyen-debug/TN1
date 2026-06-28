import React, { useState, useEffect } from "react";
import { FileSpreadsheet, CheckCircle, RefreshCw, LogOut, Sparkles, AlertCircle } from "lucide-react";
import { User } from "firebase/auth";
import { createQuizSpreadsheet, setupExistingSpreadsheet } from "../lib/googleSheets";

const SPREADSHEET_TITLE = "Hệ thống Thi Trắc nghiệm & Ngân hàng câu hỏi";

interface SheetsConnectionProps {
  user: User | null;
  needsAuth: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  isLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onSpreadsheetConnected: (id: string, url: string) => void;
  onRefreshQuestions: () => void;
}

export default function SheetsConnection({
  user,
  needsAuth,
  spreadsheetId,
  spreadsheetUrl,
  isLoading,
  onLogin,
  onLogout,
  onSpreadsheetConnected,
  onRefreshQuestions,
}: SheetsConnectionProps) {
  const [inputUrlOrId, setInputUrlOrId] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsExpired(false);
      return;
    }

    const checkToken = async () => {
      const { isGoogleTokenExpired } = await import("../lib/firebase");
      setIsExpired(isGoogleTokenExpired());
    };

    checkToken();
    const interval = setInterval(checkToken, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [user]);

  const extractSpreadsheetId = (input: string): string => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return input.trim();
  };

  const handleCreateNewSheet = async () => {
    setErrorMsg(null);
    setLocalLoading(true);
    try {
      const accessToken = (await import("../lib/firebase")).getAccessToken();
      if (!accessToken) {
        throw new Error("Không có quyền truy cập Google. Vui lòng đăng nhập lại.");
      }
      const { spreadsheetId: newId, url } = await createQuizSpreadsheet(accessToken);
      onSpreadsheetConnected(newId, url);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể tạo Google Sheet mới.");
    } finally {
      setLocalLoading(false);
    }
  };

  const handleConnectExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const id = extractSpreadsheetId(inputUrlOrId);
    if (!id) {
      setErrorMsg("Vui lòng nhập ID hoặc URL bảng tính.");
      return;
    }

    setLocalLoading(true);
    try {
      const accessToken = (await import("../lib/firebase")).getAccessToken();
      if (!accessToken) {
        throw new Error("Không có quyền truy cập Google. Vui lòng đăng nhập lại.");
      }
      await setupExistingSpreadsheet(accessToken, id);
      const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
      onSpreadsheetConnected(id, url);
      setInputUrlOrId("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể kết nối đến Google Sheet. Vui lòng kiểm tra quyền truy cập.");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm mb-8 transition-all hover:shadow-md" id="google-sheets-section">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-5 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Đồng bộ Google Sheets</h2>
            <p className="text-xs text-slate-500">Tự động đồng bộ Ngân hàng câu hỏi và Kết quả thi trực tuyến</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || "Avatar"}
                className="w-6 h-6 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="text-left">
              <p className="text-xs font-medium text-slate-700 max-w-[150px] truncate">
                {user.displayName || user.email}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {needsAuth ? (
        <div className="text-center py-6">
          <div className="max-w-md mx-auto">
            <p className="text-slate-600 text-sm mb-5 leading-relaxed">
              Hãy kết nối tài khoản Google của bạn để tự động lưu câu hỏi và kết quả thi trực tuyến trên <strong>Google Trang tính (Google Sheets)</strong>.
            </p>
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium text-sm rounded-xl hover:bg-slate-800 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-5.84-4.53z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.85 2.99c.87-2.6 3.3-4.67 6.13-4.67z"
                />
              </svg>
              Đồng ý và kết nối Google Account
            </button>
          </div>
        </div>
      ) : isExpired ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5.5 h-5.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Phiên kết nối Google đã hết hạn</h3>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Để bảo mật, Google giới hạn thời gian kết nối của mỗi phiên làm việc là <strong>1 giờ</strong>. Hãy bấm làm mới kết nối để tiếp tục tự động đồng bộ câu hỏi và kết quả thi.
              </p>
              {spreadsheetId && (
                <a
                  href={spreadsheetUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-800 hover:underline inline-flex items-center gap-1 mt-2 font-medium"
                >
                  Bảng tính đang liên kết &rarr;
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={onLogin}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Làm mới kết nối
            </button>
            {spreadsheetId && (
              <button
                onClick={() => onSpreadsheetConnected("", "")}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Hủy liên kết
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {spreadsheetId ? (
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Đã kết nối thành công!</p>
                  <a
                    href={spreadsheetUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                  >
                    Xem Google Sheet của bạn &rarr;
                  </a>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={onRefreshQuestions}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  title="Tải lại câu hỏi từ Google Sheet"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Tải lại dữ liệu
                </button>
                <button
                  onClick={() => onSpreadsheetConnected("", "")}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 text-xs font-semibold rounded-lg transition-colors"
                >
                  Hủy kết nối
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold uppercase mb-2">
                    <Sparkles className="w-3 h-3" /> Khuyên dùng
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Tạo mới bảng tính tự động</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Tạo một bảng tính mới mang tên <strong>"{SPREADSHEET_TITLE}"</strong> trong Google Drive của bạn. Các cấu trúc cột của ngân hàng câu hỏi và kết quả thi sẽ được cài đặt chính xác tự động.
                  </p>
                </div>
                <button
                  onClick={handleCreateNewSheet}
                  disabled={localLoading || isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {localLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang thiết lập...
                    </>
                  ) : (
                    "Khởi tạo bảng tính mới"
                  )}
                </button>
              </div>

              <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Liên kết bảng tính hiện có</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Nếu bạn đã có sẵn Google Sheet hoặc muốn liên kết lại bảng tính cũ, vui lòng dán đường link URL hoặc ID của bảng tính đó vào đây.
                  </p>
                </div>

                <form onSubmit={handleConnectExisting} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Dán ID hoặc URL bảng tính..."
                    value={inputUrlOrId}
                    onChange={(e) => setInputUrlOrId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={localLoading || isLoading || !inputUrlOrId.trim()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-slate-800 text-white font-semibold text-xs rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                  >
                    Kết nối ngay
                  </button>
                </form>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
