const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 GERAR REEL
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic, provider = "openai" } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic é obrigatório"
      });
    }

    let roteiro = "";
    let usedProvider = provider;

    console.log("👉 Provider:", provider);
    console.log("👉 Topic:", topic);

    // =========================
    // 🔵 CLAUDE
    // =========================
    if (provider === "claude") {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 200,
            messages: [
              {
                role: "user",
                content: `Crie um roteiro viral curto para reels sobre: ${topic}`
              }
            ]
          })
        });

        const data = await response.json();
        console.log("🔥 Claude response:", data);

        if (data.content && data.content.length > 0) {
          roteiro = data.content[0].text;
        } else {
          throw new Error(data.error?.message || "Claude falhou");
        }

      } catch (err) {
        console.log("❌ Claude falhou, usando OpenAI fallback...");
        usedProvider = "openai";
      }
    }

    // =========================
    // 🟢 OPENAI (fallback ou padrão)
    // =========================
    if (provider === "openai" || usedProvider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 150,
          messages: [
            {
              role: "system",
              content: "Você cria roteiros virais curtos para Reels/TikTok com hooks fortes."
            },
            {
              role: "user",
              content: `Crie um roteiro viral de até 30 segundos sobre: ${topic}`
            }
          ]
        })
      });

      const data = await response.json();
      console.log("🧠 OpenAI response:", data);

      roteiro = data.choices?.[0]?.message?.content || "Erro OpenAI";
    }

    res.json({
      success: true,
      provider: usedProvider,
      roteiro
    });

  } catch (error) {
    console.error("🚨 Erro geral:", error);

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
