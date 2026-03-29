const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

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

    console.log("🚀 Gerando roteiro com OpenAI + Claude...");

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
            content: "Você cria roteiros virais curtos para reels com hooks fortes."
          },
          {
            role: "user",
            content: `Crie um roteiro viral de até 30 segundos sobre: ${topic}`
          }
        ]
      })
    }).then(res => res.json());

    // 🔵 CLAUDE
    const claudePromise = fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
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
    }).then(res => res.json());

    // ⚡ pega o mais rápido
    const result = await Promise.race([openaiPromise, claudePromise]);

    // 🧠 identifica quem respondeu
    if (result.choices) {
      return res.json({
        success: true,
        provider: "openai",
        roteiro: result.choices[0].message.content
      });
    }

    if (result.content) {
      return res.json({
        success: true,
        provider: "claude",
        roteiro: result.content[0].text
      });
    }

    return res.status(500).json({
      error: "Nenhum provider respondeu corretamente",
      raw: result
    });

  } catch (error) {
    console.error("Erro geral:", error);

    res.status(500).json({
      error: "Erro interno",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
