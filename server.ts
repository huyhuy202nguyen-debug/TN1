import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up support for large JSON payloads
app.use(express.json({ limit: "15mb" }));

import fs from "fs";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// Initialize Firebase Admin using the generated config
let adminDb: Firestore | null = null;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    
    let app;
    if (getApps().length === 0) {
      app = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    } else {
      app = getApps()[0];
    }

    const dbId = firebaseConfig.firestoreDatabaseId;
    if (dbId && dbId !== "(default)") {
      try {
        adminDb = getFirestore(app, dbId);
      } catch (e) {
        console.warn("Failed to initialize admin firestore with specific databaseId, falling back to default:", e);
        adminDb = getFirestore(app);
      }
    } else {
      adminDb = getFirestore(app);
    }
    console.log("Firebase Admin initialized successfully on the server.");
  } else {
    console.warn("firebase-applet-config.json not found. Firestore Admin will not be available.");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin:", err);
}

// Initialize Google GenAI client lazily
const getGenAI = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required.");
  }
  return new GoogleGenAI({ apiKey });
};

// Define the Question Schema structure for Gemini responseSchema
const questionSchema = {
  type: Type.OBJECT,
  properties: {
    questionText: {
      type: Type.STRING,
      description: "Nội dung câu hỏi hoàn chỉnh, không kèm số thứ tự (ví dụ: 'Thủ đô của Việt Nam là gì?')",
    },
    questionType: {
      type: Type.STRING,
      description: "Loại câu hỏi: 'single' (trắc nghiệm 1 đáp án), 'multiple' (trắc nghiệm nhiều đáp án), 'true_false' (đúng sai), 'short_answer' (trả lời ngắn)",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách các lựa chọn đáp án (để trống nếu là câu trả lời ngắn, đối với đúng_sai thì để ['Đúng', 'Sai'])",
    },
    correctAnswers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách các câu trả lời đúng (khớp chính xác với chuỗi lựa chọn trong options, hoặc là từ khóa đúng cho câu trả lời ngắn)",
    },
    explanation: {
      type: Type.STRING,
      description: "Lời giải thích chi tiết tại sao đáp án đó đúng và phân tích lỗi sai thường gặp (giúp tự chấm điểm chi tiết)",
    },
    category: {
      type: Type.STRING,
      description: "Chủ đề hoặc lĩnh vực của câu hỏi (ví dụ: 'Toán học', 'Lịch sử', 'Địa lý')",
    },
    difficulty: {
      type: Type.STRING,
      description: "Độ khó: 'easy' (Dễ), 'medium' (Trung bình), 'hard' (Khó)",
    },
  },
  required: ["questionText", "questionType", "options", "correctAnswers", "explanation", "category", "difficulty"],
};

// Helper function to call Gemini with a list of fallback models
async function generateQuizContentWithFallback(ai: GoogleGenAI, prompt: string, schema: any): Promise<any> {
  const modelsToTry = [
    { name: "gemini-3.5-flash", useThinking: false },
    { name: "gemini-3.1-flash-lite", useThinking: false },
    { name: "gemini-flash-latest", useThinking: false },
  ];

  let lastError: any = null;

  for (const modelInfo of modelsToTry) {
    try {
      console.log(`Attempting quiz content generation with model: ${modelInfo.name}`);
      const config: any = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: schema,
        },
      };

      if (modelInfo.useThinking) {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      const response = await ai.models.generateContent({
        model: modelInfo.name,
        contents: prompt,
        config,
      });

      if (response && response.text) {
        console.log(`Successfully generated quiz content using model: ${modelInfo.name}`);
        return response;
      }
    } catch (err: any) {
      console.warn(`Model ${modelInfo.name} failed during quiz generation:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`Tất cả các mô hình Gemini hỗ trợ đều gặp lỗi hoặc quá tải: ${lastError?.message || lastError}`);
}

// 1. API: Parse quiz content from copy-pasted text/Word content (Azota-like behavior)
app.post("/api/parse-quiz", async (req, res) => {
  try {
    const { text, defaultCategory } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Nội dung văn bản trống." });
    }

    const ai = getGenAI();

    const prompt = `Bạn là một hệ thống AI hỗ trợ giáo dục cực kỳ mạnh mẽ tương tự Azota. Hãy phân tích đoạn văn bản đề thi dưới đây (được sao chép từ tài liệu Word/PDF hoặc do người dùng tự soạn thảo) và trích xuất thành danh sách các câu hỏi trắc nghiệm có cấu trúc.

Văn bản cần phân tích:
"""
${text}
"""

Yêu cầu phân tích:
1. Nhận diện các câu hỏi, xác định rõ câu hỏi thuộc loại nào: trắc nghiệm 1 đáp án ('single'), trắc nghiệm nhiều đáp án ('multiple'), câu hỏi đúng sai ('true_false'), hoặc câu hỏi trả lời ngắn ('short_answer').
2. Tách số thứ tự câu hỏi ra khỏi nội dung câu hỏi.
3. Đối với các đáp án lựa chọn, loại bỏ ký tự tiêu đề như 'A.', 'B.', 'C.', 'D.' khỏi nội dung của lựa chọn trong mảng 'options', nhưng lưu giữ đầy đủ nội dung.
4. Xác định đáp án đúng dựa vào các ký hiệu gạch chân, in đậm, hoặc đáp án được chỉ định trong văn bản, hoặc tự suy luận đáp án đúng nếu văn bản không chỉ định trực tiếp.
5. Viết phần giải thích ('explanation') cực kỳ chi tiết, khoa học, chỉ ra lý do tại sao đáp án đó đúng và giải thích các lựa chọn sai để học sinh tự học hiệu quả.
6. Gán chủ đề mặc định là "${defaultCategory || "Chung"}" nếu không thể tự xác định cụ thể hơn từ nội dung.
7. Đánh giá độ khó ('difficulty') dựa trên mức độ tư duy của câu hỏi.`;

    const response = await generateQuizContentWithFallback(ai, prompt, questionSchema);

    const parsedText = response.text || "[]";
    const questions = JSON.parse(parsedText);
    res.json({ success: true, questions });
  } catch (error: any) {
    console.error("Error parsing quiz via Gemini:", error);
    res.status(500).json({ error: error.message || "Không thể phân tích đề thi. Hãy kiểm tra lại API Key hoặc cấu trúc văn bản." });
  }
});

// 2. API: Generate random or topic-based questions for the Question Bank (Moodle-like behavior)
app.post("/api/generate-questions", async (req, res) => {
  try {
    const { topic, quantity, difficulty, category } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Chủ đề sinh câu hỏi không được trống." });
    }

    const ai = getGenAI();
    const count = quantity ? parseInt(quantity) : 5;

    const prompt = `Bạn là một chuyên gia khảo thí và xây dựng ngân hàng đề thi chuyên nghiệp theo chuẩn Moodle. Hãy soạn thảo danh sách gồm ${count} câu hỏi chất lượng cao về chủ đề: "${topic}".

Yêu cầu đề thi:
- Độ khó mong muốn: ${difficulty || "Hỗn hợp (Dễ, Trung bình, Khó)"}
- Danh mục/Chủ đề: ${category || topic}
- Đảm bảo câu hỏi có tính thực tế, kích thích tư duy, phân loại học sinh tốt.
- Phải có đa dạng các loại câu hỏi bao gồm trắc nghiệm 1 đáp án ('single'), trắc nghiệm nhiều lựa chọn ('multiple'), đúng/sai ('true_false'), hoặc trả lời ngắn ('short_answer').
- Cung cấp lời giải thích chi tiết cho từng câu hỏi để bổ trợ quá trình ôn tập tự chấm điểm của học sinh.`;

    const response = await generateQuizContentWithFallback(ai, prompt, questionSchema);

    const parsedText = response.text || "[]";
    const questions = JSON.parse(parsedText);
    res.json({ success: true, questions });
  } catch (error: any) {
    console.error("Error generating questions via Gemini:", error);
    res.status(500).json({ error: error.message || "Không thể tự động sinh câu hỏi." });
  }
});

// 3. API: Create a shared quiz link (stores quiz in public Firestore, and teacher's token in secure private collection)
app.post("/api/share-quiz", async (req, res) => {
  const { quiz, accessToken, refreshToken, spreadsheetId } = req.body;
  if (!quiz) {
    return res.status(400).json({ error: "Thiếu thông tin bài thi." });
  }
  
  // Use existing publishedId if available, otherwise generate a new one
  const shortId = quiz.publishedId || Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Ensure quiz object has the publishedId
  const quizToSave = { ...quiz, publishedId: shortId };
  
  if (!adminDb) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình trên máy chủ." });
  }

  try {
    // 1. Save public quiz content (completely separate from credentials)
    const quizDocRef = adminDb.collection("sharedQuizzes").doc(shortId);
    await quizDocRef.set({
      quiz: quizToSave,
      createdAt: Date.now()
    });

    // 2. Fetch existing tokens if any to avoid overwriting with empty parameters
    const tokensDocRef = adminDb.collection("quizTokens").doc(shortId);
    let existingTokens: any = {};
    try {
      const tokensSnap = await tokensDocRef.get();
      if (tokensSnap.exists) {
        existingTokens = tokensSnap.data() || {};
      }
    } catch (e) {
      // Ignore
    }

    const finalRefreshToken = refreshToken || existingTokens.refreshToken || null;

    // 3. Save tokens into the secure private "quizTokens" collection (never accessible to the client)
    await tokensDocRef.set({
      accessToken: accessToken || existingTokens.accessToken || null,
      refreshToken: finalRefreshToken,
      spreadsheetId: spreadsheetId || existingTokens.spreadsheetId || null,
      createdAt: Date.now()
    });

    res.json({ success: true, shortId });
  } catch (error: any) {
    console.error("Error saving shared quiz to Firestore:", error);
    res.status(500).json({ error: "Không thể tạo liên kết chia sẻ." });
  }
});

// 4. API: Retrieve a shared quiz by short ID
app.get("/api/get-shared-quiz/:id", async (req, res) => {
  if (!adminDb) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  try {
    const shortId = req.params.id.toUpperCase();
    const docSnap = await adminDb.collection("sharedQuizzes").doc(shortId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Không tìm thấy bài thi hoặc bài thi đã hết hạn." });
    }
    
    const data = docSnap.data();
    if (!data || !data.quiz) {
      return res.status(404).json({ error: "Dữ liệu bài thi không hợp lệ." });
    }
    
    // We only send the quiz data back to the student, NO credentials exist in this collection anyway!
    
    // Asynchronously trigger background sync for any pending submissions
    triggerBackgroundSync(shortId).catch(err => console.error("Background sync error:", err));
    
    res.json({ success: true, quiz: data.quiz });
  } catch (error: any) {
    console.error("Error fetching shared quiz:", error);
    res.status(500).json({ error: "Không thể lấy thông tin bài thi." });
  }
});

// 6. API: Delete a shared quiz
app.delete("/api/shared-quiz/:id", async (req, res) => {
  if (!adminDb) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  try {
    const shortId = req.params.id.toUpperCase();
    // Delete both public quiz and private secure tokens
    await adminDb.collection("sharedQuizzes").doc(shortId).delete();
    await adminDb.collection("quizTokens").doc(shortId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting shared quiz:", error);
    res.status(500).json({ error: "Không thể xóa bài thi." });
  }
});

// Helper function to refresh Google access token using refresh token
async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.warn("GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET chưa được cấu hình trên server. Bỏ qua tự động refresh token.");
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (res.ok) {
      const data: any = await res.json();
      return data.access_token || null;
    } else {
      const errText = await res.text();
      console.error("Failed to refresh Google access token:", errText);
      return null;
    }
  } catch (error) {
    console.error("Error refreshing Google access token:", error);
    return null;
  }
}

// Core helper for writing to Google Sheets
async function appendResultToGoogleSheets(token: string, spreadsheetId: string, result: any): Promise<boolean> {
  const RESULT_SHEET = "Kết quả thi";
  const detailSummary = result.detailedGrades
    .map((g: any, idx: number) => {
      const status = g.isCorrect ? "Đúng" : "Sai";
      return `${idx + 1}. [${status}] Đã chọn: ${g.studentAnswers.join(", ")} | Đáp án đúng: ${g.correctAnswers.join(", ")}`;
    })
    .join("\n");

  let headers: string[] = [];
  try {
    const getHeadersRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(RESULT_SHEET + "!A1:ZZ1")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (getHeadersRes.ok) {
      const headerData: any = await getHeadersRes.json();
      if (headerData.values && headerData.values[0] && headerData.values[0].length > 0) {
        headers = headerData.values[0];
      }
    } else if (getHeadersRes.status === 401) {
      throw { status: 401, message: "Unauthorized" };
    }
  } catch (e: any) {
    if (e.status === 401) throw e;
    console.error("Failed to fetch existing headers from Google Sheets on backend:", e);
  }

  if (headers.length === 0) {
    headers = [
      "Thời Gian Nộp Bài",
      "Họ và Tên Học Sinh",
      "Lớp",
      "Mã Bài Thi (ID)",
      "Tên Bài Thi",
      "Điểm Số (Thang 10)",
      "Số Câu Đúng",
      "Tổng Số Câu Hỏi",
      "Chi Tiết Đáp Án",
    ];
    for (let i = 1; i <= Math.max(150, result.detailedGrades.length); i++) {
      headers.push(`Câu ${i}`);
    }
    try {
      const setHeadersRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(RESULT_SHEET + "!A1:ZZ1")}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: [headers] }),
        }
      );
      if (!setHeadersRes.ok && setHeadersRes.status === 401) {
        throw { status: 401, message: "Unauthorized" };
      }
    } catch (e: any) {
      if (e.status === 401) throw e;
      console.error("Failed to write backend fallback headers:", e);
    }
  }

  const row = headers.map((headerName: string) => {
    const norm = headerName.trim().toLowerCase();
    
    if (norm.includes("thời gian")) return result.submittedAt || "";
    if (norm.includes("họ và tên") || norm.includes("học sinh") || norm.includes("tên học sinh")) return result.studentName || "";
    if (norm.includes("lớp")) return result.studentClass || "";
    if (norm.includes("mã bài thi") || norm.includes("mã đề")) return result.quizId || "";
    if (norm.includes("tên bài thi") || norm.includes("tiêu đề") || norm.includes("tên đề")) return result.quizTitle || "";
    if (norm.includes("điểm") || norm.includes("score")) return typeof result.score === "number" ? result.score.toFixed(1) : String(result.score || "0.0");
    if (norm.includes("số câu đúng") || norm.includes("câu đúng")) return result.correctCount !== undefined ? result.correctCount : 0;
    if (norm.includes("tổng số câu") || norm.includes("tổng câu")) return result.totalQuestions !== undefined ? result.totalQuestions : 0;
    if (norm.includes("chi tiết đáp án") || norm.includes("chi tiết")) return detailSummary || "";
    
    const questionMatch = norm.match(/câu\s*(\d+)/);
    if (questionMatch) {
      const qNum = parseInt(questionMatch[1], 10);
      const grade = result.detailedGrades && result.detailedGrades[qNum - 1];
      if (grade && grade.studentAnswers) {
        return grade.questionType === "case_study" ? grade.studentAnswers.join(" | ") : grade.studentAnswers.join(", ");
      }
    }
    return "";
  });

  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(RESULT_SHEET + "!A:ZZ")}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!appendRes.ok) {
    if (appendRes.status === 401) {
      throw { status: 401, message: "Unauthorized" };
    }
    const errorData = await appendRes.json();
    throw new Error(errorData.error?.message || "Không thể đồng bộ kết quả thi lên Google Sheets");
  }

  return true;
}

// Background Task: Auto sync pending submissions
async function triggerBackgroundSync(shortId: string) {
  if (!adminDb) return;
  try {
    const submissionsRef = adminDb.collection("sharedQuizzes").doc(shortId).collection("submissions");
    const querySnapshot = await submissionsRef.where("synced", "==", false).get();
    if (querySnapshot.empty) return; // No pending submissions
    
    const tokenDoc = await adminDb.collection("quizTokens").doc(shortId).get();
    if (!tokenDoc.exists) return;
    
    const tokenData = tokenDoc.data() || {};
    let activeAccessToken = tokenData.accessToken;
    const refreshToken = tokenData.refreshToken;
    const spreadsheetId = tokenData.spreadsheetId;
    
    if (!activeAccessToken || !spreadsheetId) return;

    for (const doc of querySnapshot.docs) {
      const submission = doc.data();
      let writeSuccess = false;
      try {
        writeSuccess = await appendResultToGoogleSheets(activeAccessToken, spreadsheetId, submission.result);
      } catch (writeErr: any) {
        if (writeErr.status === 401 && refreshToken) {
          const newAccessToken = await refreshGoogleAccessToken(refreshToken);
          if (newAccessToken) {
            await adminDb.collection("quizTokens").doc(shortId).update({ accessToken: newAccessToken });
            activeAccessToken = newAccessToken; // Cập nhật token để dùng cho các bài tiếp theo
            writeSuccess = await appendResultToGoogleSheets(newAccessToken, spreadsheetId, submission.result);
          } else {
            console.warn(`[BackgroundSync] Failed to refresh token for quiz ${shortId}`);
            break; // Dừng lại vì không thể refresh token
          }
        } else {
          console.error(`[BackgroundSync] Failed to append result ${doc.id}:`, writeErr);
        }
      }
      
      if (writeSuccess) {
        await submissionsRef.doc(doc.id).update({ synced: true });
        console.log(`[BackgroundSync] Successfully synced background submission ${doc.id}`);
      }
    }
  } catch (err) {
    console.error(`[BackgroundSync] Error syncing pending submissions for ${shortId}:`, err);
  }
}

// 5. API: Submit a quiz result directly to the teacher's Google Sheet
app.post("/api/submit-quiz/:id", async (req, res) => {
  if (!adminDb) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  const shortId = req.params.id.toUpperCase();
  try {
    const docSnap = await adminDb.collection("sharedQuizzes").doc(shortId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Không tìm thấy phiên làm bài (hoặc đã hết hạn)." });
    }
  } catch (error: any) {
    console.error("Error fetching shared quiz for submission:", error);
    return res.status(500).json({ error: "Lỗi kết nối cơ sở dữ liệu." });
  }
  
  // Fetch secure tokens from private quizTokens collection
  let tokenData: any = {};
  try {
    const tokensSnap = await adminDb.collection("quizTokens").doc(shortId).get();
    if (tokensSnap.exists) {
      tokenData = tokensSnap.data() || {};
    }
  } catch (err) {
    console.error("Error fetching secure tokens for submission:", err);
  }
  
  const { result } = req.body;
  let activeAccessToken = tokenData.accessToken;
  const refreshToken = tokenData.refreshToken;
  const spreadsheetId = tokenData.spreadsheetId;
  
  if (!activeAccessToken || !spreadsheetId) {
    return res.status(400).json({ error: "Bài thi này không được liên kết với Google Sheets của giáo viên." });
  }

  // 1. Luôn lưu kết quả nộp bài của học sinh vào Firestore trước làm bản sao dự phòng cực kỳ an toàn
  const submissionId = Math.random().toString(36).substring(2, 15).toUpperCase();
  const submissionDocRef = adminDb.collection("sharedQuizzes").doc(shortId).collection("submissions").doc(submissionId);
  const submissionData = {
    id: submissionId,
    result,
    synced: false,
    createdAt: Date.now()
  };

  try {
    await submissionDocRef.set(submissionData);
    console.log(`Saved backup submission ${submissionId} to Firestore.`);
  } catch (err) {
    console.error("Failed to save backup submission to Firestore:", err);
  }

  // Khai báo hàm thực hiện ghi dữ liệu lên Google Sheets bằng một accessToken cụ thể
  // Gọi hàm appendResultToGoogleSheets (đã refactor lên global function)

  // Tiến hành ghi dữ liệu
  try {
    let writeSuccess = false;
    try {
      writeSuccess = await appendResultToGoogleSheets(activeAccessToken, spreadsheetId, result);
    } catch (writeErr: any) {
      // 2. Nếu lỗi do Token hết hạn (401), và giáo viên có cấu hình refreshToken
      if (writeErr.status === 401 && refreshToken) {
        console.log("Teacher access token expired (401). Attempting to refresh token...");
        const newAccessToken = await refreshGoogleAccessToken(refreshToken);
        if (newAccessToken) {
          console.log("Successfully refreshed teacher Google Access Token! Updating database...");
          try {
            await adminDb.collection("quizTokens").doc(shortId).update({
              accessToken: newAccessToken
            });
            activeAccessToken = newAccessToken;
          } catch (dbErr) {
            console.error("Failed to update new access token in Firestore:", dbErr);
          }

          // Thử ghi lại một lần nữa bằng access token mới
          console.log("Retrying sheet append with new access token...");
          writeSuccess = await appendResultToGoogleSheets(newAccessToken, spreadsheetId, result);
        } else {
          console.warn("Failed to refresh Google access token. Proceeding to background sync flow.");
          throw writeErr;
        }
      } else {
        throw writeErr;
      }
    }

    if (writeSuccess) {
      // 3. Nếu đồng bộ thành công, cập nhật trạng thái synced: true trong Firestore
      try {
        await submissionDocRef.update({ synced: true });
      } catch (dbErr) {
        console.error("Failed to update submission sync state:", dbErr);
      }
      
      // Asynchronously trigger background sync for any OTHER pending submissions
      triggerBackgroundSync(shortId).catch(err => console.error("Background sync error:", err));
      
      return res.json({ success: true, pendingSync: false });
    } else {
      throw new Error("Lưu kết quả lên Google Sheets không thành công.");
    }

  } catch (error: any) {
    console.error("Error submitting result, moving to offline/background queue:", error);
    // 4. Nếu có lỗi xảy ra hoặc token bị lỗi mà không thể tự làm mới,
    // chúng ta vẫn trả về success cho học sinh để các em không lo lắng,
    // và thông báo kết quả sẽ đồng bộ sau khi giáo viên trực tiếp mở app.
    
    // Asynchronously trigger background sync anyway (just in case)
    triggerBackgroundSync(shortId).catch(err => console.error("Background sync error:", err));
    
    return res.json({ 
      success: true, 
      pendingSync: true, 
      message: "Bài làm của em đã được nộp thành công lên hệ thống lưu trữ dự phòng. Kết quả sẽ tự động đồng bộ sang Google Sheets của giáo viên khi giáo viên trực tuyến." 
    });
  }
});

// 7. API: Get unsynced submissions for a shared quiz
app.get("/api/get-pending-submissions/:id", async (req, res) => {
  if (!adminDb) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  const shortId = req.params.id.toUpperCase();
  try {
    const submissionsRef = adminDb.collection("sharedQuizzes").doc(shortId).collection("submissions");
    const querySnapshot = await submissionsRef.where("synced", "==", false).get();
    const pending: any[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      pending.push({
        id: doc.id,
        result: data.result,
        createdAt: data.createdAt
      });
    });
    res.json({ success: true, submissions: pending });
  } catch (error: any) {
    console.error("Error fetching pending submissions:", error);
    res.status(500).json({ error: "Không thể lấy danh sách bài nộp chưa đồng bộ." });
  }
});

// 8. API: Mark a submission as synced
app.post("/api/mark-submission-synced/:quizId/:submissionId", async (req, res) => {
  if (!adminDb) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  const { quizId, submissionId } = req.params;
  try {
    const docRef = adminDb.collection("sharedQuizzes").doc(quizId.toUpperCase()).collection("submissions").doc(submissionId.toUpperCase());
    await docRef.update({ synced: true });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error marking submission as synced:", error);
    res.status(500).json({ error: "Không thể cập nhật trạng thái đồng bộ." });
  }
});

// Serve Vite front-end
async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
