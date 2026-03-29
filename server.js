const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔑 KEYS
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 GERAR REEL (COM FALLBACK)
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic, provider = "auto" } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic é obrigatório"
      });
    }

    let roteiro = "";
    let usedProvider = "";

    // =========================
    // 🟢 TENTA OPENAI PRIMEIRO
    // =========================
    if (provider === "openai" || provider === "auto") {
      try {
        console.log("👉 Tentando OpenAI...");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Você cria roteiros virais para Reels/TikTok com hooks fortes."
              },
              {
                role: "user",
                content: `Crie um roteiro viral curto de até 30s sobre: ${topic}`
              }
            ]
          })
        });

        const data = await response.json();

        roteiro = data.choices?.[0]?.message?.content;

        if (roteiro) {
          usedProvider = "openai";
          return res.json({
            success: true,
            provider: usedProvider,
            roteiro
          });
        }

      } catch (err) {
        console.log("❌ OpenAI falhou:", err.message);
      }
    }

    // =========================
    // 🔵 FALLBACK CLAUDE
    // =========================
    if (provider === "claude" || provider === "auto") {
      try {
        console.log("👉 Tentando Claude...");

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: `Crie um roteiro viral curto para reels sobre: ${topic}`
              }
            ]
          })
        });

        const data = await response.json();

        if (data.content && data.content.length > 0) {
          roteiro = data.content[0].text;
          usedProvider = "claude";

          return res.json({
            success: true,
            provider: usedProvider,
            roteiro
          });
        }

        console.log("❌ Claude resposta inválida:", data);

      } catch (err) {
        console.log("❌ Claude falhou:", err.message);
      }
    }

    // =========================
    // ❌ SE TUDO FALHAR
    // =========================
    return res.status(500).json({
      error: "Nenhum provider respondeu",
    });

  } catch (error) {
    res.status(500).json({
      error: "Erro interno",
      details: error.message
    });
  }
});

// OUTRO ENDPOINT
app.post("/transcribe", (req, res) => {
  res.json({
    message: "Aqui vamos usar Whisper em breve 🔥"
  });
});

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
