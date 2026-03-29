const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const multer = require("multer");
const FormData = require("form-data");

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

console.log("🔑 Claude key:", process.env.ANTHROPIC_API_KEY ? "OK ✅" : "UNDEFINED ❌");
console.log("🔑 OpenAI key:", process.env.OPENAI_API_KEY ? "OK ✅" : "UNDEFINED ❌");

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 GERAR REEL
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic é obrigatório" });
    }

    console.log("🚀 Gerando com OpenAI + Claude...");

    const openaiPromise = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você cria roteiros virais para Reels/TikTok. Comece com um hook forte, linguagem simples e finalize com call to action."
          },
          {
            role: "user",
            content: `Crie um roteiro viral de até 30 segundos sobre: ${topic}`
          }
        ]
      })
    }).then(r => r.json());

    const claudePromise = fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `Crie um roteiro viral curto para reels. Comece com um hook forte. Tema: ${topic}`
          }
        ]
      })
    }).then(r => r.json());

    const result = await Promise.any([openaiPromise, claudePromise]);

    if (result.choices) {
      console.log("✅ Respondeu: OpenAI");
      return res.json({
        success: true,
        provider: "openai",
        roteiro: result.choices[0].message.content
      });
    }

    if (result.content) {
      console.log("✅ Respondeu: Claude");
      return res.json({
        success: true,
        provider: "claude",
        roteiro: result.content[0].text
      });
    }

    return res.status(500).json({ error: "Nenhum provider respondeu corretamente", raw: result });

  } catch (error) {
    console.error("🚨 Erro geral:", error);
    res.status(500).json({ error: "Erro interno", details: error.message });
  }
});

// 🎙️ TRANSCREVER ÁUDIO COM WHISPER
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo de áudio obrigatório" });
    }

    console.log("🎙️ Transcrevendo áudio:", req.file.originalname);

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const data = await response.json();

    if (!data.text) {
      console.log("❌ Whisper erro:", data);
      return res.status(500).json({ error: "Erro na transcrição", raw: data });
    }

    console.log("✅ Transcrição concluída");
    return res.json({
      success: true,
      text: data.text
    });

  } catch (error) {
    console.error("🚨 Erro Whisper:", error);
    res.status(500).json({ error: "Erro interno", details: error.message });
  }
});

// 🔥 PING
app.get("/ping", (req, res) => {
  res.send("alive");
});

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
