const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const multer = require("multer");
const FormData = require("form-data");

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

console.log("🔑 Claude key:", process.env.ANTHROPIC_API_KEY ? "OK ✅" : "UNDEFINED ❌");
console.log("🔑 OpenAI key:", process.env.OPENAI_API_KEY ? "OK ✅" : "UNDEFINED ❌");
console.log("🔑 ElevenLabs key:", process.env.ELEVENLABS_API_KEY ? "OK ✅" : "UNDEFINED ❌");
console.log("🔑 IG Token:", process.env.IG_ACCESS_TOKEN ? "OK ✅" : "UNDEFINED ❌");

app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// 🎯 GERAR REEL
app.post("/generate-reel", async (req, res) => {
  try {
    const { topic, language } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic é obrigatório" });
    }

    const langMap = {
      "pt": "português brasileiro",
      "en": "English",
      "es": "español"
    };
    const lang = langMap[language] || "português brasileiro";

    console.log(`🚀 Gerando em ${lang}...`);

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
            content: `You create viral scripts for Reels/TikTok. Always respond in ${lang}. Start with a strong hook, simple language, finish with call to action.`
          },
          {
            role: "user",
            content: `Create a viral script up to 30 seconds about: ${topic}`
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
            content: `Create a short viral reel script in ${lang}. Strong hook first. Topic: ${topic}`
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
        language: lang,
        roteiro: result.choices[0].message.content
      });
    }

    if (result.content) {
      console.log("✅ Respondeu: Claude");
      return res.json({
        success: true,
        provider: "claude",
        language: lang,
        roteiro: result.content[0].text
      });
    }

    return res.status(500).json({ error: "Nenhum provider respondeu corretamente" });

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

    console.log("🎙️ Transcrevendo:", req.file.originalname);

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
      return res.status(500).json({ error: "Erro na transcrição", raw: data });
    }

    console.log("✅ Transcrição concluída");
    return res.json({ success: true, text: data.text });

  } catch (error) {
    console.error("🚨 Erro Whisper:", error);
    res.status(500).json({ error: "Erro interno", details: error.message });
  }
});

// 🎙️ TEXT TO SPEECH — ELEVENLABS
app.post("/text-to-speech", async (req, res) => {
  try {
    const { text, voice, language } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto obrigatório" });
    }

    const voiceMap = {
      "pt_male": "pNInz6obpgDQGcFmaJgB",
      "pt_female": "EXAVITQu4vr4xnSDxMaL",
      "en_male": "VR6AewLTigWG4xSOukaG",
      "en_female": "MF3mGyEYCl7XYWbV9V6O",
      "es_male": "pNInz6obpgDQGcFmaJgB",
      "es_female": "EXAVITQu4vr4xnSDxMaL"
    };

    const voiceId = voiceMap[voice] || voiceMap["pt_female"];

    console.log(`🎙️ Gerando voz: ${voice}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: "Erro na geração de voz", raw: error });
    }

    const audioBuffer = await response.buffer();
    const audioBase64 = audioBuffer.toString("base64");

    console.log("✅ Voz gerada com sucesso");
    return res.json({ success: true, audio: audioBase64, format: "mp3" });

  } catch (error) {
    console.error("🚨 Erro ElevenLabs:", error);
    res.status(500).json({ error: "Erro interno", details: error.message });
  }
});

// 🤖 AUTODM — WEBHOOK INSTAGRAM
app.get("/ig-webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || "viralizou2026";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado!");
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: "Token inválido" });
});

app.post("/ig-webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "instagram") {
      return res.status(404).json({ error: "Not instagram" });
    }

    for (const entry of body.entry) {
      for (const event of entry.messaging || []) {
        await processIGEvent(event);
      }
      for (const change of entry.changes || []) {
        if (change.field === "comments") {
          await processComment(change.value);
        }
      }
    }

    return res.status(200).json({ status: "ok" });

  } catch (error) {
    console.error("🚨 Webhook erro:", error);
    res.status(500).json({ error: error.message });
  }
});

async function processIGEvent(event) {
  try {
    const senderId = event.sender?.id;
    const message = event.message?.text?.toLowerCase();
    if (!senderId || !message) return;

    console.log(`📩 DM recebida de ${senderId}: ${message}`);

    const flows = await getActiveFlows("dm_keyword");
    for (const flow of flows) {
      if (message.includes(flow.keyword.toLowerCase())) {
        console.log(`🎯 Gatilho ativado: ${flow.keyword}`);
        await sendIGDM(senderId, flow.response_message);
        await logDM(senderId, flow.id, message);
        break;
      }
    }
  } catch (error) {
    console.error("🚨 Erro processIGEvent:", error);
  }
}

async function processComment(comment) {
  try {
    const userId = comment.from?.id;
    const text = comment.text?.toLowerCase();
    const mediaId = comment.media?.id;
    if (!userId || !text) return;

    console.log(`💬 Comentário de ${userId}: ${text}`);

    const flows = await getActiveFlows("comment_keyword");
    for (const flow of flows) {
      if (text.includes(flow.keyword.toLowerCase())) {
        console.log(`🎯 Comentário gatilho: ${flow.keyword}`);
        if (flow.reply_comment) {
          await replyComment(mediaId, comment.id, flow.comment_reply);
        }
        if (flow.send_dm) {
          await sendIGDM(userId, flow.response_message);
        }
        await logDM(userId, flow.id, text);
        break;
      }
    }
  } catch (error) {
    console.error("🚨 Erro processComment:", error);
  }
}

async function sendIGDM(recipientId, message) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.IG_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message }
        })
      }
    );
    const data = await response.json();
    console.log("✅ DM enviada:", data);
    return data;
  } catch (error) {
    console.error("🚨 Erro sendIGDM:", error);
  }
}

async function replyComment(mediaId, commentId, message) {
  try {
    await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.IG_ACCESS_TOKEN}`
        },
        body: JSON.stringify({ message })
      }
    );
    console.log("✅ Comentário respondido");
  } catch (error) {
    console.error("🚨 Erro replyComment:", error);
  }
}

async function getActiveFlows(trigger_type) {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_flows?status=eq.active&trigger_type=eq.${trigger_type}`,
      {
        headers: {
          "apikey": process.env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      }
    );
    return await response.json();
  } catch (error) {
    console.error("🚨 Erro getActiveFlows:", error);
    return [];
  }
}

async function logDM(userId, flowId, triggerText) {
  try {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_logs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          ig_user_id: userId,
          flow_id: flowId,
          trigger_text: triggerText,
          sent_at: new Date().toISOString()
        })
      }
    );
  } catch (error) {
    console.error("🚨 Erro logDM:", error);
  }
}

// 📊 AUTODM — CRIAR FLUXO
app.post("/autodm/flows", async (req, res) => {
  try {
    const { user_id, name, trigger_type, keyword, response_message, reply_comment, comment_reply, send_dm } = req.body;

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_flows`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          user_id,
          name,
          trigger_type,
          keyword,
          response_message,
          reply_comment: reply_comment || false,
          comment_reply: comment_reply || "",
          send_dm: send_dm || true,
          status: "active",
          created_at: new Date().toISOString()
        })
      }
    );

    const data = await response.json();
    console.log("✅ Fluxo criado:", data);
    return res.json({ success: true, flow: data });

  } catch (error) {
    console.error("🚨 Erro criar fluxo:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📊 AUTODM — LISTAR FLUXOS
app.get("/autodm/flows/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_flows?user_id=eq.${user_id}`,
      {
        headers: {
          "apikey": process.env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      }
    );

    const flows = await response.json();
    return res.json({ success: true, flows });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 AUTODM — MÉTRICAS
app.get("/autodm/stats/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_logs?flow_id=in.(select id from autodm_flows where user_id='${user_id}')`,
      {
        headers: {
          "apikey": process.env.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      }
    );

    const logs = await response.json();
    return res.json({ success: true, total_dms: logs.length, logs });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🤖 AUTODM — GERAR MENSAGEM COM CLAUDE
app.post("/autodm/generate-message", async (req, res) => {
  try {
    const { keyword, niche, objective, language } = req.body;

    const langMap = {
      "pt": "português brasileiro",
      "en": "English",
      "es": "español"
    };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
            content: `Crie uma mensagem direta para Instagram em ${lang}.
            Palavra-chave que ativou: ${keyword}
            Nicho: ${niche}
            Objetivo: ${objective}
            
            A mensagem deve:
            - Ser pessoal e natural (não parecer bot)
            - Máximo 3 frases
            - Incluir CTA
            - Tom amigável
            
            Retorne apenas a mensagem, sem explicações.`
          }
        ]
      })
    });

    const data = await response.json();
    return res.json({ success: true, message: data.content[0].text });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔥 PING
app.get("/ping", (req, res) => {
  res.send("alive");
});

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});
