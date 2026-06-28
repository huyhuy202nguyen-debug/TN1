import { Question, SubmissionResult } from "../types";

const SPREADSHEET_TITLE = "Hệ thống Thi Trắc nghiệm & Ngân hàng câu hỏi";
const QUESTION_SHEET = "Ngân hàng câu hỏi";
const RESULT_SHEET = "Kết quả thi";

/**
 * Creates a new Google Spreadsheet with two sheets: Question Bank and Results.
 */
export async function createQuizSpreadsheet(accessToken: string): Promise<{ spreadsheetId: string; url: string }> {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            title: QUESTION_SHEET,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: RESULT_SHEET,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to create Google Spreadsheet");
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const url = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize headers for both sheets
  await initializeSheetHeaders(accessToken, spreadsheetId);

  return { spreadsheetId, url };
}

/**
 * Initializes headers in the newly created spreadsheet
 */
async function initializeSheetHeaders(accessToken: string, spreadsheetId: string) {
  const questionHeaders = [
    "Mã Câu Hỏi (ID)",
    "Nội Dung Câu Hỏi",
    "Loại Câu Hỏi (single/multiple/true_false/true_false_cluster/short_answer)",
    "Các Lựa Chọn (cách nhau bằng dấu gạch đứng | )",
    "Đáp Án Đúng (cách nhau bằng dấu gạch đứng | )",
    "Lời Giải Thích Chi Tiết",
    "Danh Mục / Chủ Đề",
    "Độ Khó (easy/medium/hard)",
    "URL Hình Ảnh",
  ];

  const resultHeaders = [
    "Thời Gian Nộp Bài",
    "Họ và Tên Học Sinh",
    "Lớp",
    "Tên Bài Thi",
    "Điểm Số (Thang 10)",
    "Số Câu Đúng",
    "Tổng Số Câu Hỏi",
    "Chi Tiết Đáp Án",
  ];

  for (let i = 1; i <= 150; i++) {
    resultHeaders.push(`Câu ${i}`);
  }

  await writeSheetRange(accessToken, spreadsheetId, `${QUESTION_SHEET}!A1:I1`, [questionHeaders]);
  await writeSheetRange(accessToken, spreadsheetId, `${RESULT_SHEET}!A1:ZZ1`, [resultHeaders]);
}

/**
 * Checks if sheets exist in an existing spreadsheet, creates them if missing, and ensures headers exist.
 */
export async function setupExistingSpreadsheet(accessToken: string, spreadsheetId: string): Promise<void> {
  // 1. Fetch spreadsheet metadata to check available sheets
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Không tìm thấy Google Sheet với ID này. Hãy kiểm tra lại quyền truy cập hoặc ID.");
  }

  const data = await response.json();
  const sheets = data.sheets || [];
  const sheetTitles = sheets.map((s: any) => s.properties.title);

  const requests: any[] = [];
  const missingQuestionSheet = !sheetTitles.includes(QUESTION_SHEET);
  const missingResultSheet = !sheetTitles.includes(RESULT_SHEET);

  if (missingQuestionSheet) {
    requests.push({
      addSheet: {
        properties: {
          title: QUESTION_SHEET,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (missingResultSheet) {
    requests.push({
      addSheet: {
        properties: {
          title: RESULT_SHEET,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  if (requests.length > 0) {
    const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });
    if (!updateResponse.ok) {
      throw new Error("Không thể thêm các trang tính mới tự động.");
    }
  }

  // Double check and enforce headers
  await initializeSheetHeaders(accessToken, spreadsheetId);
}

/**
 * Writes values to a specific range in a spreadsheet.
 */
async function writeSheetRange(accessToken: string, spreadsheetId: string, range: string, values: any[][]) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Failed to write to range ${range}`);
  }
}

/**
 * Fetches all questions from the Question Bank sheet.
 */
export async function fetchQuestionsFromSheet(accessToken: string, spreadsheetId: string): Promise<Question[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(QUESTION_SHEET + "!A2:I1000")}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    // If the sheet doesn't exist, setup first and retry
    await setupExistingSpreadsheet(accessToken, spreadsheetId);
    return [];
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .filter((row: any[]) => row && row[1]) // Must have question text
    .map((row: any[], index: number) => {
      const id = row[0] || `q-${index + 1}-${Date.now()}`;
      const questionText = row[1] || "";
      const questionType = (row[2] || "single") as Question["questionType"];
      
      // Parse pipe (|) separated strings
      const options = row[3] ? row[3].split("|").map((s: string) => s.trim()) : [];
      const correctAnswers = row[4] ? row[4].split("|").map((s: string) => s.trim()) : [];
      
      const explanation = row[5] || "";
      const category = row[6] || "Chung";
      const difficulty = (row[7] || "medium") as Question["difficulty"];
      const imageUrl = row[8] || undefined;

      return {
        id,
        questionText,
        questionType,
        options,
        correctAnswers,
        explanation,
        category,
        difficulty,
        imageUrl,
      };
    });
}

/**
 * Fetches all results from the Results sheet.
 */
export async function fetchResultsFromSheet(accessToken: string, spreadsheetId: string): Promise<any[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(RESULT_SHEET + "!A2:EZ1000")}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    if (errorData.error?.code === 400 && errorData.error?.message?.includes("Unable to parse range")) {
      // Sheet might not exist, return empty
      return [];
    }
    throw new Error(errorData.error?.message || "Failed to fetch results");
  }

  const data = await response.json();
  const rows = data.values || [];
  
  return rows.map((row: any[]) => {
    return {
      submittedAt: row[0] || "",
      studentName: row[1] || "",
      studentClass: row[2] || "",
      quizId: row[3] || "",
      quizTitle: row[4] || "",
      score: parseFloat(row[5] || "0"),
      correctCount: parseInt(row[6] || "0", 10),
      totalQuestions: parseInt(row[7] || "0", 10),
      detailSummary: row[8] || "",
      questionAnswers: row.slice(9) // Array of answers starting from column J (index 9)
    };
  });
}

/**
 * Appends new questions to the Question Bank sheet.
 */
export async function appendQuestionsToSheet(accessToken: string, spreadsheetId: string, questions: Question[]): Promise<void> {
  const rows = questions.map((q) => [
    q.id,
    q.questionText,
    q.questionType,
    q.options.join(" | "),
    q.correctAnswers.join(" | "),
    q.explanation,
    q.category,
    q.difficulty,
    q.imageUrl || "",
  ]);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(QUESTION_SHEET + "!A:I")}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Không thể đồng bộ câu hỏi lên Google Sheets");
  }
}

/**
 * Re-saves the entire Question Bank sheet (overwriting current questions to handle edits/deletions).
 */
export async function syncAllQuestionsToSheet(accessToken: string, spreadsheetId: string, questions: Question[]): Promise<void> {
  // First clear the old values
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(QUESTION_SHEET + "!A2:I1000")}:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (questions.length === 0) return;

  // Then write the new values starting at row 2
  const range = `${QUESTION_SHEET}!A2:I${questions.length + 1}`;
  const rows = questions.map((q) => [
    q.id,
    q.questionText,
    q.questionType,
    q.options.join(" | "),
    q.correctAnswers.join(" | "),
    q.explanation,
    q.category,
    q.difficulty,
    q.imageUrl || "",
  ]);

  await writeSheetRange(accessToken, spreadsheetId, range, rows);
}

/**
 * Appends a new Quiz Result submission row to the Results sheet.
 */
export async function appendResultToSheet(accessToken: string, spreadsheetId: string, result: SubmissionResult): Promise<void> {
  const detailSummary = result.detailedGrades
    .map((g, idx) => {
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
  result.detailedGrades.forEach(g => {
    row.push(g.studentAnswers.join(", "));
  });

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
}
