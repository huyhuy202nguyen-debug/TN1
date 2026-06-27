import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up support for large JSON payloads (e.g., parsing large text or word files)
app.use(express.json({ limit: "15mb" }));

// Initialize Google GenAI client lazily or immediately.
// We handle missing key gracefully by checking in the route.
const getGenAI = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required. Please set it in AI Studio Secrets.");
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

// Serve Vite front-end
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
