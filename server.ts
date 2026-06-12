import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Check configuration status endpoint
app.get("/api/config-status", (req, res) => {
  const firebaseConfigPath = path.join(process.cwd(), "src", "firebase-applet-config.json");
  const hasFirebaseConfig = fs.existsSync(firebaseConfigPath);
  const geminiKey = process.env.GEMINI_API_KEY;
  const hasGeminiKey = !!geminiKey && geminiKey !== "MY_GEMINI_API_KEY";

  res.json({
    firebaseConfigured: hasFirebaseConfig,
    geminiConfigured: hasGeminiKey,
  });
});

// AI Daily Homework & Study Summary Report generator
app.post("/api/generate-summary", async (req, res) => {
  try {
    const { childName, childYear, subjects, logs, parentNotes } = req.body;

    if (!childName || !logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: "Missing required childName or logs array" });
    }

    const ai = getGeminiClient();

    // Prepare clean context of child progress for the prompt
    const logDetails = logs.map(l => {
      const completionList = Object.entries(l.completions)
        .map(([subj, done]) => `${subj}: ${done ? "✅ 已完成 (Completed)" : "❌ 未完成 (Incomplete)"}`)
        .join(", ");
      return `- 日期 (Date): ${l.date}\n  進度: ${completionList}\n  備註 (Notes): ${l.notes || "無 (None)"}\n  完成率: ${(l.completedRatio * 100).toFixed(0)}%`;
    }).join("\n\n");

    const prompt = `您是一位溫柔、專業的小學與中學教育顧問。
請根據以下提供的學生功課與學習進度數據，撰寫一份專屬於家長的「每日/每週學習總結報告」。

學生資訊：
- 姓名：${childName} (${childYear})
- 追蹤項目：${subjects.join(", ")}

近期學習記錄：
${logDetails}

家長補充說明或備註：
${parentNotes || "無外加備註"}

撰寫指南：
1. 語言請以「繁體中文」為主（穿插部分英文翻譯，因應家長與小孩的可能雙語需求）。
2. 口吻要溫和、正面、富有鼓勵性、並具備教育專業度。
3. 內容架構包括：
   - **今日學習完成率摘要**：概括完成率及孩子的心態。
   - **亮點與表揚**：具體指出孩子做得好的功課或練習（例如鋼琴、數學、Flute自主完成），並給予誠懇鼓勵。
   - **需要關注與引導的領域**：若有未完成項目，請分析可能原因並提供給家長的「溫柔引導建议」或簡短的改進策略（例如調整時間、激發興趣等）。
   - **明日/後續小目標**：為孩子設定1-2個微小、具體且容易達成的後續進度目標。
4. 請使用漂亮的 Markdown 格式（例如使用粗體、星星、引用區塊等），使其在網頁上完美呈現。
5. 報告以精緻、精簡、實用為主（字數約 300 - 500 字）。
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      summary: response.text,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Gemini service error: ", error);
    res.status(500).json({
      success: false,
      error: error.message || "產生學習報告時遇到錯誤，請確認 GEMINI_API_KEY 設定是否正確。"
    });
  }
});

// Asynchronous wrapper for dev/production middleware bundle to satisfy esbuild CJS formatting
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for lightning fast developmental server proxy mapping
    const { createServer: createViteServer } = await import("vite");
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
