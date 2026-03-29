const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔥 IMPORTANTE
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 GERAR REEL COM GPT
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic, provider = "openai" } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic é obrigatório"
      });
    }

    let roteiro = "";

    // 🟢 OPENAI
    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
              content: "Você cria roteiros virais para Reels/TikTok com hooks fortes."
            },
            {
              role: "user",
              content: `Crie um roteiro viral curto sobre: ${topic}`
            }
          ]
        })
      });

      const data = await response.json();
      roteiro = data.choices?.[0]?.message?.content;
    }

    // 🔵 CLAUDE
    if (provider === "claude") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: `Crie um roteiro viral curto para reels sobre: ${topic}`
            }
          ]
        })
      });

      const data = await response.json();
      roteiro = data.content?.[0]?.text;
    }

    res.json({
      success: true,
      provider,
      roteiro
    });

  } catch (error) {
    res.status(500).json({
      error: "Erro interno",
      details: error.message
    });
  }
}); {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "Topic é obrigatório"
      });
    }

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
            content: "Você é especialista em criar roteiros virais para Reels/TikTok curtos, com hooks fortes e linguagem simples."
          },
          {
            role: "user",
            content: `Crie um roteiro viral de até 30 segundos sobre: ${topic}. Comece com um hook forte.`
          }
        ]
      })
    });

    const data = await response.json();

    const roteiro = data.choices?.[0]?.message?.content || "Erro ao gerar roteiro";

    res.json({
      success: true,
      provider: "openai",
      roteiro
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
  console.log("Rodando na porta " + PORT);
});
