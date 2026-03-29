const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔑 DIAGNÓSTICO DE KEYS (remova após confirmar que está funcionando)
console.log("🔑 Claude key:", process.env.ANTHROPIC_API_KEY ? "OK ✅" : "UNDEFINED ❌");
console.log("🔑 OpenAI key:", process.env.OPENAI_API_KEY ? "OK ✅" : "UNDEFINED ❌");

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 GERAR REEL (OPENAI + CLAUDE PARALELO)
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic é obrigatório"
      });
    }

    console.log("🚀 Gerando com OpenAI + Claude...");

    // 🟢 OPENAI
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
            content:
              "Você cria roteiros virais para Reels/TikTok. Comece com um hook forte, linguagem simples e finalize com call to action."
          },
          {
            role: "user",
            content: `Crie um roteiro viral de até 30 segundos sobre: ${topic}`
          }
        ]
      })
    }).then(r => r.json());

    // 🔵 CLAUDE
    const claudePromise = fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Crie um roteiro viral curto para reels. Comece com um hook forte. Tema: ${topic}`
          }
        ]
      })
    }).then(r => r.json());

    // ⚡ Pega o mais rápido que responder com sucesso
    const result = await Promise.any([openaiPromise, claudePromise]);

    // 🧠 Identifica quem respondeu
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

    console.log("❌ Resposta inválida:", result);
    return res.status(500).json({
      error: "Nenhum provider respondeu corretamente",
      raw: result
    });

  } catch (error) {
    console.error("🚨 Erro geral:", error);
    res.status(500).json({
      error: "Erro interno",
      details: error.message
    });
  }
});

// 🔥 PING (pra uptime robot)
app.get("/ping", (req, res) => {
  res.send("alive");
});

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
