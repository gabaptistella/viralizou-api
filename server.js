const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 CLAUDE DEBUG (SEM FALLBACK)
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic é obrigatório"
      });
    }

    console.log("👉 Testando Claude...");
    console.log("👉 API KEY:", ANTHROPIC_API_KEY ? "OK" : "MISSING");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
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

    console.log("🔥 Claude response:", JSON.stringify(data, null, 2));

    // 👇 resposta detalhada
    if (data.content && data.content.length > 0) {
      return res.json({
        success: true,
        provider: "claude",
        roteiro: data.content[0].text
      });
    }

    // 👇 mostra erro real
    return res.status(500).json({
      error: "Claude não respondeu corretamente",
      full_response: data
    });

  } catch (error) {
    console.error("🚨 Erro geral:", error);

    res.status(500).json({
      error: "Erro interno",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
