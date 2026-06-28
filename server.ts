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
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

// Initialize Firebase using the generated config
let db: any = null;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const firebaseApp = initializeApp(firebaseConfig);
    // CRITICAL: Must use the specific database ID from config
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("Firebase initialized successfully on the server.");
  } else {
    console.warn("firebase-applet-config.json not found. Firestore will not be available.");
  }
} catch (err) {
  console.error("Failed to initialize Firebase:", err);
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

// 3. API: Create a shared quiz link (stores quiz + teacher's token in Firestore)
app.post("/api/share-quiz", async (req, res) => {
  const { quiz, accessToken, spreadsheetId } = req.body;
  if (!quiz) {
    return res.status(400).json({ error: "Thiếu thông tin bài thi." });
  }
  
  // Use existing publishedId if available, otherwise generate a new one
  const shortId = quiz.publishedId || Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Ensure quiz object has the publishedId
  const quizToSave = { ...quiz, publishedId: shortId };
  
  if (!db) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình trên máy chủ." });
  }

  try {
    await setDoc(doc(db, "sharedQuizzes", shortId), {
      quiz: quizToSave,
      accessToken: accessToken || null,
      spreadsheetId: spreadsheetId || null,
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
  if (!db) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  try {
    const docSnap = await getDoc(doc(db, "sharedQuizzes", req.params.id.toUpperCase()));
    if (!docSnap.exists()) {
      return res.status(404).json({ error: "Không tìm thấy bài thi hoặc bài thi đã hết hạn." });
    }
    
    const data = docSnap.data();
    // We only send the quiz data back to the student, NEVER the accessToken!
    res.json({ success: true, quiz: data.quiz });
  } catch (error: any) {
    console.error("Error fetching shared quiz:", error);
    res.status(500).json({ error: "Không thể lấy thông tin bài thi." });
  }
});

// 6. API: Delete a shared quiz
app.delete("/api/shared-quiz/:id", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  try {
    await deleteDoc(doc(db, "sharedQuizzes", req.params.id.toUpperCase()));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting shared quiz:", error);
    res.status(500).json({ error: "Không thể xóa bài thi." });
  }
});

// 6.1. API: Refresh Google Access Token securely
app.post("/api/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Thiếu Refresh Token." });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: "Ứng dụng chưa được cấu hình GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trên server. Hãy cấu hình chúng trong phần Cài đặt bí mật." 
      });
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.error || "Không thể làm mới token.");
    }

    res.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error: any) {
    console.error("Lỗi khi làm mới Google Access Token:", error);
    res.status(500).json({ error: error.message || "Lỗi khi gia hạn Token." });
  }
});

// 5. API: Submit a quiz result directly to the teacher's Google Sheet
app.post("/api/submit-quiz/:id", async (req, res) => {
  if (!db) {
    return res.status(500).json({ error: "Cơ sở dữ liệu Firebase chưa được cấu hình." });
  }

  let data;
  try {
    const docSnap = await getDoc(doc(db, "sharedQuizzes", req.params.id.toUpperCase()));
    if (!docSnap.exists()) {
      return res.status(404).json({ error: "Không tìm thấy phiên làm bài (hoặc đã hết hạn)." });
    }
    data = docSnap.data();
  } catch (error: any) {
    console.error("Error fetching shared quiz for submission:", error);
    return res.status(500).json({ error: "Lỗi kết nối cơ sở dữ liệu." });
  }
  
  const { result } = req.body;
  const { accessToken, spreadsheetId } = data;
  
  if (!accessToken || !spreadsheetId) {
    return res.status(400).json({ error: "Bài thi này không được liên kết với Google Sheets của giáo viên." });
  }

  // We write to the teacher's sheet using the teacher's cached access token
  try {
    const RESULT_SHEET = "Kết quả thi";
    
    // Construct the row summary
    const detailSummary = result.detailedGrades
      .map((g: any, idx: number) => {
        const status = g.isCorrect ? "Đúng" : "Sai";
        return `${idx + 1}. [${status}] Đã chọn: ${g.studentAnswers.join(", ")} | Đáp án đúng: ${g.correctAnswers.join(", ")}`;
      })
      .join("\n");

    const row = [
      result.submittedAt,
      result.studentName,
      result.studentClass || "",
      result.quizId,
      result.quizTitle,
      result.score.toFixed(1),
      result.correctCount,
      result.totalQuestions,
      detailSummary,
    ];

    // Append individual answers for each question to support statistics
    result.detailedGrades.forEach((g: any) => {
      if (g.questionType === "case_study") {
        row.push(g.studentAnswers.join(" | "));
      } else {
        row.push(g.studentAnswers.join(", "));
      }
    });

    const makeRequest = async () => {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(RESULT_SHEET + "!A:ZZ")}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [row],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Không thể đồng bộ kết quả thi lên Google Sheets");
      }
    };

    // Retry up to 3 times with 1.5s interval
    let lastError: any = null;
    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        await makeRequest();
        success = true;
        break;
      } catch (err) {
        lastError = err;
        if (i < 2) {
          console.warn(`Retry ${i + 1}/3 backend append due to:`, err);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    if (!success) {
      throw lastError || new Error("Không thể đồng bộ kết quả thi lên Google Sheets sau 3 lần thử.");
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error submitting result to sheets:", error);
    res.status(500).json({ error: error.message || "Lỗi khi lưu kết quả." });
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
