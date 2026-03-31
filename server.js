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
    if (!topic) return res.status(400).json({ error: "Topic é obrigatório" });

    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const openaiPromise = fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You create viral scripts for Reels/TikTok. Always respond in ${lang}. Start with a strong hook, simple language, finish with call to action.` },
          { role: "user", content: `Create a viral script up to 30 seconds about: ${topic}` }
        ]
      })
    }).then(r => r.json());

    const claudePromise = fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: `Create a short viral reel script in ${lang}. Strong hook first. Topic: ${topic}` }]
      })
    }).then(r => r.json());

    const result = await Promise.any([openaiPromise, claudePromise]);

    if (result.choices) {
      return res.json({ success: true, provider: "openai", language: lang, roteiro: result.choices[0].message.content });
    }
    if (result.content) {
      return res.json({ success: true, provider: "claude", language: lang, roteiro: result.content[0].text });
    }
    return res.status(500).json({ error: "Nenhum provider respondeu corretamente" });
  } catch (error) {
    res.status(500).json({ error: "Erro interno", details: error.message });
  }
});

// 🎙️ TRANSCREVER ÁUDIO COM WHISPER
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo de áudio obrigatório" });

    const formData = new FormData();
    formData.append("file", req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, ...formData.getHeaders() },
      body: formData
    });

    const data = await response.json();
    if (!data.text) return res.status(500).json({ error: "Erro na transcrição", raw: data });

    return res.json({ success: true, text: data.text });
  } catch (error) {
    res.status(500).json({ error: "Erro interno", details: error.message });
  }
});

// 🎙️ TEXT TO SPEECH — ELEVENLABS
app.post("/text-to-speech", async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: "Texto obrigatório" });

    const voiceMap = {
      "pt_male": "pNInz6obpgDQGcFmaJgB",
      "pt_female": "EXAVITQu4vr4xnSDxMaL",
      "en_male": "VR6AewLTigWG4xSOukaG",
      "en_female": "MF3mGyEYCl7XYWbV9V6O",
      "es_male": "pNInz6obpgDQGcFmaJgB",
      "es_female": "EXAVITQu4vr4xnSDxMaL"
    };

    const voiceId = voiceMap[voice] || voiceMap["pt_female"];

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": process.env.ELEVENLABS_API_KEY },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: "Erro na geração de voz", raw: error });
    }

    const audioBuffer = await response.buffer();
    const audioBase64 = audioBuffer.toString("base64");
    return res.json({ success: true, audio: audioBase64, format: "mp3" });
  } catch (error) {
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
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: "Token inválido" });
});

app.post("/ig-webhook", async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== "instagram") return res.status(404).json({ error: "Not instagram" });

    for (const entry of body.entry) {
      for (const event of entry.messaging || []) await processIGEvent(event);
      for (const change of entry.changes || []) {
        if (change.field === "comments") await processComment(change.value);
      }
    }
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function processIGEvent(event) {
  try {
    const senderId = event.sender?.id;
    const message = event.message?.text?.toLowerCase();
    if (!senderId || !message) return;

    if (["parar", "stop", "unsubscribe"].includes(message)) {
      await addOptOut(senderId);
      await sendIGDM(senderId, "Você foi removido da lista ✅");
      return;
    }

    const flows = await getActiveFlows("dm_keyword");
    for (const flow of flows) {
      if (message.includes(flow.keyword.toLowerCase())) {
        const isOptedOut = await checkOptOut(senderId);
        if (isOptedOut) return;
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

    const flows = await getActiveFlows("comment_keyword");
    for (const flow of flows) {
      if (text.includes(flow.keyword.toLowerCase())) {
        const isOptedOut = await checkOptOut(userId);
        if (isOptedOut) return;
        if (flow.reply_comment) await replyComment(mediaId, comment.id, flow.comment_reply);
        if (flow.send_dm) await sendIGDM(userId, flow.response_message);
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
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.IG_ACCESS_TOKEN}` },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } })
    });
    return await response.json();
  } catch (error) {
    console.error("🚨 Erro sendIGDM:", error);
  }
}

async function replyComment(mediaId, commentId, message) {
  try {
    await fetch(`https://graph.facebook.com/v18.0/${mediaId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.IG_ACCESS_TOKEN}` },
      body: JSON.stringify({ message })
    });
  } catch (error) {
    console.error("🚨 Erro replyComment:", error);
  }
}

async function getActiveFlows(trigger_type) {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_flows?status=eq.active&trigger_type=eq.${trigger_type}`,
      { headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
    );
    return await response.json();
  } catch (error) {
    return [];
  }
}

async function logDM(userId, flowId, triggerText) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/autodm_logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ ig_user_id: userId, flow_id: flowId, trigger_text: triggerText, sent_at: new Date().toISOString() })
    });
  } catch (error) {
    console.error("🚨 Erro logDM:", error);
  }
}

async function checkOptOut(igUserId) {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_optouts?ig_user_id=eq.${igUserId}`,
      { headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
    );
    const data = await response.json();
    return data.length > 0;
  } catch (error) {
    return false;
  }
}

async function addOptOut(igUserId) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/autodm_optouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ ig_user_id: igUserId, opted_out_at: new Date().toISOString() })
    });
  } catch (error) {
    console.error("🚨 Erro addOptOut:", error);
  }
}

// 📊 AUTODM — CRIAR FLUXO
app.post("/autodm/flows", async (req, res) => {
  try {
    const { user_id, name, trigger_type, keyword, response_message, reply_comment, comment_reply, send_dm } = req.body;
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/autodm_flows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ user_id, name, trigger_type, keyword, response_message, reply_comment: reply_comment || false, comment_reply: comment_reply || "", send_dm: send_dm || true, status: "active", created_at: new Date().toISOString() })
    });
    const data = await response.json();
    return res.json({ success: true, flow: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 AUTODM — LISTAR FLUXOS
app.get("/autodm/flows/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/autodm_flows?user_id=eq.${user_id}`,
      { headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
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
      { headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
    );
    const logs = await response.json();
    return res.json({ success: true, total_dms: logs.length, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🤖 AUTODM — GERAR MENSAGEM
app.post("/autodm/generate-message", async (req, res) => {
  try {
    const { keyword, niche, objective, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: `Crie uma mensagem direta para Instagram em ${lang}. Palavra-chave: ${keyword}. Nicho: ${niche}. Objetivo: ${objective}. Máximo 3 frases, natural, com CTA. Retorne apenas a mensagem.` }]
      })
    });
    const data = await response.json();
    return res.json({ success: true, message: data.content[0].text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🧠 ANALISAR ESTILO
app.post("/autodm/analyze-style", async (req, res) => {
  try {
    const { captions, user_id, language } = req.body;
    if (!captions) return res.status(400).json({ error: "Legendas obrigatórias" });

    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: `Analise o estilo dessas legendas em ${lang}:\n\n${captions}\n\nRetorne JSON: {"tone":"...","emoji_usage":"baixo/moderado/alto","vocabulary":"simples/técnico/coloquial","favorite_cta":"...","summary":"..."}. Apenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_styles`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}`, "Prefer": "return=representation" },
      body: JSON.stringify({ user_id, tone: analysis.tone, emoji_usage: analysis.emoji_usage, vocabulary: analysis.vocabulary, favorite_cta: analysis.favorite_cta, raw_analysis: JSON.stringify(analysis) })
    });

    return res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🛠️ FERRAMENTAS — BIO IA
app.post("/tools/generate-bio", async (req, res) => {
  try {
    const { niche, diferencial, cta, emojis, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: `Crie 5 opções de bio para Instagram em ${lang}. Nicho: ${niche}. Diferencial: ${diferencial}. CTA: ${cta}. Emojis: ${emojis ? "sim" : "não"}. Max 150 chars cada. Retorne JSON: {"bios":["bio1","bio2","bio3","bio4","bio5"]}. Apenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return res.json({ success: true, bios: result.bios });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🛠️ FERRAMENTAS — KIT LANÇAMENTO POR PLANO
app.post("/tools/generate-launch-kit", async (req, res) => {
  try {
    const { product, price, audience, benefit, date, platform, language, plan } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    // Configurar por plano
    const planConfig = {
      "free": null, // Sem acesso
      "creator": {
        max_tokens: 1500,
        dias: 3,
        posts: 3,
        stories: 3,
        label: "Kit Básico (3 dias)"
      },
      "business": {
        max_tokens: 2500,
        dias: 7,
        posts: 7,
        stories: 10,
        label: "Kit Completo (7 dias)"
      },
      "agency": {
        max_tokens: 4000,
        dias: 14,
        posts: 14,
        stories: 21,
        label: "Kit Premium (14 dias)"
      }
    };

    const userPlan = plan || "creator";

    if (userPlan === "free") {
      return res.status(403).json({
        error: "Kit de Lançamento disponível a partir do plano Creator",
        upgrade_required: true
      });
    }

    const config = planConfig[userPlan] || planConfig["creator"];

    const promptByPlan = {
      "creator": `Crie kit de lançamento BÁSICO em ${lang} para ${config.dias} dias.
Produto: ${product}. Preço: ${price}. Público: ${audience}. 
Benefício: ${benefit}. Data: ${date}. Plataforma: ${platform}.

Retorne JSON COMPACTO e VÁLIDO:
{
  "label": "${config.label}",
  "cronograma": [
    {"dia": 3, "tipo": "teaser", "conteudo": "..."},
    {"dia": 1, "tipo": "lançamento", "conteudo": "..."},
    {"dia": 0, "tipo": "ultimo_dia", "conteudo": "..."}
  ],
  "posts": [
    {"dia": 3, "hook": "...", "cta": "..."},
    {"dia": 1, "hook": "...", "cta": "..."},
    {"dia": 0, "hook": "...", "cta": "..."}
  ],
  "stories": [
    {"dia": 3, "texto": "..."},
    {"dia": 1, "texto": "..."},
    {"dia": 0, "texto": "..."}
  ],
  "autodm": {"keyword": "...", "mensagem": "..."},
  "hashtags": ["#h1", "#h2", "#h3"]
}
Apenas JSON válido e completo.`,

      "business": `Crie kit de lançamento COMPLETO em ${lang} para ${config.dias} dias.
Produto: ${product}. Preço: ${price}. Público: ${audience}.
Benefício: ${benefit}. Data: ${date}. Plataforma: ${platform}.

Retorne JSON VÁLIDO:
{
  "label": "${config.label}",
  "cronograma": [
    {"dia": 7, "tipo": "aquecimento", "conteudo": "..."},
    {"dia": 5, "tipo": "prova_social", "conteudo": "..."},
    {"dia": 3, "tipo": "teaser", "conteudo": "..."},
    {"dia": 1, "tipo": "lancamento", "conteudo": "..."},
    {"dia": 0, "tipo": "ultimo_dia", "conteudo": "..."}
  ],
  "posts": [
    {"dia": 7, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 5, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 3, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 1, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 0, "hook": "...", "desenvolvimento": "...", "cta": "..."}
  ],
  "stories": [
    {"dia": 7, "stories": ["...", "...", "..."]},
    {"dia": 3, "stories": ["...", "...", "..."]},
    {"dia": 1, "stories": ["...", "...", "..."]},
    {"dia": 0, "stories": ["...", "..."]}
  ],
  "autodm": {
    "keyword": "...",
    "mensagens": ["msg1", "msg2", "msg3"]
  },
  "email": {"assunto": "...", "corpo": "..."},
  "hashtags": ["#h1", "#h2", "#h3", "#h4", "#h5"]
}
Apenas JSON válido e completo.`,

      "agency": `Crie kit de lançamento PREMIUM em ${lang} para ${config.dias} dias.
Produto: ${product}. Preço: ${price}. Público: ${audience}.
Benefício: ${benefit}. Data: ${date}. Plataforma: ${platform}.

Retorne JSON VÁLIDO:
{
  "label": "${config.label}",
  "cronograma": [
    {"dia": 14, "tipo": "pre_aquecimento", "conteudo": "..."},
    {"dia": 10, "tipo": "aquecimento", "conteudo": "..."},
    {"dia": 7, "tipo": "prova_social", "conteudo": "..."},
    {"dia": 5, "tipo": "teaser", "conteudo": "..."},
    {"dia": 3, "tipo": "urgencia", "conteudo": "..."},
    {"dia": 1, "tipo": "lancamento", "conteudo": "..."},
    {"dia": 0, "tipo": "ultimo_dia", "conteudo": "..."}
  ],
  "posts": [
    {"dia": 14, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 10, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 7, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 5, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 3, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 1, "hook": "...", "desenvolvimento": "...", "cta": "..."},
    {"dia": 0, "hook": "...", "desenvolvimento": "...", "cta": "..."}
  ],
  "stories": [
    {"dia": 14, "stories": ["...", "...", "..."]},
    {"dia": 10, "stories": ["...", "...", "..."]},
    {"dia": 7, "stories": ["...", "...", "..."]},
    {"dia": 5, "stories": ["...", "...", "..."]},
    {"dia": 3, "stories": ["...", "...", "..."]},
    {"dia": 1, "stories": ["...", "...", "..."]},
    {"dia": 0, "stories": ["...", "..."]}
  ],
  "autodm": {
    "keyword": "...",
    "mensagens": ["msg1", "msg2", "msg3", "msg4"]
  },
  "email": {"assunto": "...", "corpo": "..."},
  "script_youtube": "...",
  "roteiro_live": "...",
  "hashtags": ["#h1", "#h2", "#h3", "#h4", "#h5"]
}
Apenas JSON válido e completo.`
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: config.max_tokens,
        messages: [{ role: "user", content: promptByPlan[userPlan] }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return res.json({ success: true, plan: userPlan, kit: result });
  } catch (error) {
    console.error("🚨 Erro launch kit:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🛠️ FERRAMENTAS — YOUTUBE
app.post("/tools/generate-youtube", async (req, res) => {
  try {
    const { topic, niche, keyword, duration, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: `Crie pacote YouTube em ${lang}. Tema: ${topic}. Nicho: ${niche}. Keyword: ${keyword}. Duração: ${duration}min. Retorne JSON: {"titulos":["t1","t2","t3","t4","t5"],"descricao":"...","tags":["tag1"],"hashtags":["#h1"],"thumbnail":{"texto_principal":"...","subtexto":"...","cor_sugerida":"..."},"tela_final":"..."}. Apenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return res.json({ success: true, youtube: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🛠️ FERRAMENTAS — MELHOR HORÁRIO
app.post("/tools/best-time", async (req, res) => {
  try {
    const { niche, country, platform, content_type, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: `Analise melhor horário para postar em ${lang}. Nicho: ${niche}. País: ${country}. Plataforma: ${platform}. Tipo: ${content_type}. Retorne JSON: {"calendario":[{"dia":"Segunda","melhor":"19h","bom":"12h","evitar":"6h"},{"dia":"Terça","melhor":"20h","bom":"18h","evitar":"8h"},{"dia":"Quarta","melhor":"19h","bom":"21h","evitar":"7h"},{"dia":"Quinta","melhor":"18h","bom":"20h","evitar":"9h"},{"dia":"Sexta","melhor":"17h","bom":"19h","evitar":"10h"},{"dia":"Sábado","melhor":"10h","bom":"15h","evitar":"22h"},{"dia":"Domingo","melhor":"11h","bom":"16h","evitar":"23h"}],"insights":"...","dica_personalizada":"..."}. Apenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return res.json({ success: true, horarios: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🛠️ FERRAMENTAS — COLLAB
app.post("/tools/generate-collab", async (req, res) => {
  try {
    const { my_niche, my_followers, partner_username, objective, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: `Crie estratégia de collab em ${lang}. Meu nicho: ${my_niche}. Meus seguidores: ${my_followers}. Parceiro: @${partner_username}. Objetivo: ${objective}. Retorne JSON: {"compatibilidade":{"score":85,"descricao":"..."},"pontos_positivos":["p1","p2","p3"],"formatos_sugeridos":["f1","f2","f3"],"roteiro":"...","dm_abordagem":"...","contrato_basico":"..."}. Apenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    return res.json({ success: true, collab: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🎨 GERADOR DE CARROSSEL COM IA
app.post("/tools/generate-carousel", async (req, res) => {
  try {
    const { tema, niche, slides_count, style, font, language, formato, finalidade } = req.body;

    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const styleMap = {
      "minimal": { cor_fundo: "#FFFFFF", cor_texto: "#000000" },
      "colorido": { cor_fundo: "#7C3AED", cor_texto: "#FFFFFF" },
      "dark": { cor_fundo: "#0A0A0F", cor_texto: "#FFFFFF" },
      "profissional": { cor_fundo: "#1E293B", cor_texto: "#FFFFFF" },
      "aesthetic": { cor_fundo: "#FDF2F8", cor_texto: "#831843" }
    };

    const sizeMap = {
      "quadrado": { width: 1080, height: 1080, ratio: "1:1" },
      "retrato": { width: 1080, height: 1350, ratio: "4:5" },
      "stories": { width: 1080, height: 1920, ratio: "9:16" },
      "paisagem": { width: 1080, height: 566, ratio: "1.91:1" }
    };

    const cores = styleMap[style] || styleMap["dark"];
    const size = sizeMap[formato] || sizeMap["quadrado"];

    const finalidadePrompts = {
      "carrossel": `- Slide 1: capa com hook forte\n- Slides intermediários: conteúdo em tópicos\n- Último slide: CTA`,
      "post": `- Apenas 1 slide impactante\n- Texto curto e direto`,
      "stories": `- Cada story independente\n- Texto mínimo\n- CTA no último`,
      "produto": `- Slide 1: headline\n- Slide 2: benefícios\n- Slide 3: prova social\n- Slide 4: preço + CTA`
    };

    const estrutura = finalidadePrompts[finalidade] || finalidadePrompts["carrossel"];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: `Crie ${finalidade} para Instagram em ${lang}.\nTema: ${tema}\nNicho: ${niche}\nSlides: ${slides_count}\nFormato: ${formato} (${size.width}x${size.height}px)\n\nEstrutura:\n${estrutura}\n\nRegras:\n- Títulos max 5 palavras\n- Max 3 bullet points por slide\n- Um emoji por slide\n- Sugestão de imagem em inglês por slide\n\nRetorne JSON:\n{\n"slides":[{"numero":1,"titulo":"...","corpo":"...","emoji":"🔥","cor_fundo":"${cores.cor_fundo}","cor_texto":"${cores.cor_texto}","image_suggestion":"..."}],\n"legenda":"...","hashtags":["..."],"cta":"...","tamanho":"${size.width}x${size.height}","formato":"${formato}"\n}\nApenas JSON válido.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return res.json({ success: true, carousel: result, size });
  } catch (error) {
    console.error("🚨 Erro generate-carousel:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📸 CARROSSEL A PARTIR DE FOTOS
app.post("/tools/generate-carousel-from-photos", upload.array("photos", 10), async (req, res) => {
  try {
    const { context, tone, language } = req.body;
    const photos = req.files;

    if (!photos || photos.length === 0) {
      return res.status(400).json({ error: "Fotos obrigatórias" });
    }

    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const toneMap = {
      "inspiracional": "inspirador, motivacional e emocionante",
      "educativo": "informativo, claro e educativo",
      "divertido": "descontraído, divertido e leve",
      "vendas": "persuasivo, focado em conversão e urgência"
    };

    const toneDesc = toneMap[tone] || toneMap["inspiracional"];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `Crie textos para carrossel do Instagram em ${lang}.
Contexto: ${context}
Tom: ${toneDesc}
Número de slides: ${photos.length}

Slide 1 = capa com hook forte.
Último slide = CTA.

Retorne JSON:
{
  "slides": [
    {
      "numero": 1,
      "titulo": "título max 5 palavras",
      "texto": "max 2 frases",
      "emoji": "🔥",
      "cor_texto": "#FFFFFF",
      "cor_fundo_overlay": "rgba(0,0,0,0.5)"
    }
  ],
  "legenda": "legenda completa com emojis",
  "hashtags": ["#hash1", "#hash2"],
  "cta": "call to action"
}
Apenas JSON válido.`
        }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    const photosBase64 = photos.map((photo, index) => ({
      index,
      base64: `data:${photo.mimetype};base64,${photo.buffer.toString("base64")}`,
      filename: photo.originalname
    }));

    return res.json({
      success: true,
      slides: result.slides,
      photos: photosBase64,
      legenda: result.legenda,
      hashtags: result.hashtags,
      cta: result.cta,
      total_photos: photos.length
    });

  } catch (error) {
    console.error("🚨 Erro carousel-from-photos:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🎨 GERAR IMAGEM COM DALL-E
app.post("/tools/generate-image", async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt obrigatório" });

    const stylePrompts = {
      "realista": "photorealistic, high quality, professional photography",
      "ilustracao": "digital illustration, flat design, colorful",
      "digital": "3D render, cinema 4D, professional digital art",
      "minimalista": "minimalist, clean, simple, modern design",
      "cartoon": "cartoon style, fun, colorful, animated illustration"
    };

    const styleAdd = stylePrompts[style] || stylePrompts["digital"];
    const fullPrompt = `${prompt}, ${styleAdd}, purple and cyan color palette, dark background, modern, high quality, 1080x1080`;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url"
      })
    });

    const data = await response.json();

    if (!data.data?.[0]?.url) {
      return res.status(500).json({ error: "Erro ao gerar imagem", raw: data });
    }

    return res.json({
      success: true,
      image_url: data.data[0].url,
      revised_prompt: data.data[0].revised_prompt
    });

  } catch (error) {
    console.error("🚨 Erro generate-image:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📊 ANALYTICS — ANALISAR PERFIL
app.post("/analytics/analyze-profile", async (req, res) => {
  try {
    const { username, user_id, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: `Analise esse perfil do Instagram em ${lang}:\n\nUsername: @${username}\n\nRetorne JSON:\n{"score":78,"score_label":"Muito bom","engagement_rate":4.2,"engagement_label":"Acima da média","crescimento_mensal":"+2.3k","melhor_horario":"Terça e Quinta às 19h","tipo_conteudo_top":"Reels","insights":["insight1","insight2","insight3"],"sugestoes":["sugestao1","sugestao2","sugestao3"],"score_breakdown":{"engajamento":85,"crescimento":70,"consistencia":75,"qualidade":80},"posts_patrocinados_estimativa":2,"valor_publi_estimado":"R$500-2000"}\nApenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

    await fetch(`${process.env.SUPABASE_URL}/rest/v1/analytics_usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ user_id, username_analyzed: username, type: "profile", created_at: new Date().toISOString() })
    });

    return res.json({ success: true, username, analysis });
  } catch (error) {
    console.error("🚨 Erro analyze-profile:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📊 ANALYTICS — ANALISAR CONCORRENTE
app.post("/analytics/analyze-competitor", async (req, res) => {
  try {
    const { username, my_username, my_followers, language } = req.body;
    const langMap = { "pt": "português brasileiro", "en": "English", "es": "español" };
    const lang = langMap[language] || "português brasileiro";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: `Analise concorrente do Instagram em ${lang}.\nMeu perfil: @${my_username} (${my_followers} seguidores)\nConcorrente: @${username}\n\nRetorne JSON:\n{"competitor":{"username":"${username}","score":71,"followers_estimate":"50k-100k","engagement_rate":2.8,"posts_per_week":4,"melhor_horario":"20h","niche":"Fitness","top_hashtags":["#fitness","#saude"],"sponsored_posts_estimate":3,"valor_publi_estimado":"R$500-2000"},"benchmarking":{"engajamento":{"eu":4.2,"concorrente":2.8,"vencedor":"eu"},"crescimento":{"eu":"+2.3k/mês","concorrente":"+1.1k/mês","vencedor":"eu"},"consistencia":{"eu":"3x/semana","concorrente":"4x/semana","vencedor":"concorrente"}},"analise_geral":"...","sugestoes_para_superar":["s1","s2","s3"],"pontos_fortes_concorrente":["p1","p2"],"oportunidades":["o1","o2"]}\nApenas JSON.` }]
      })
    });

    const data = await response.json();
    const clean = data.content[0].text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return res.json({ success: true, competitor_analysis: result });
  } catch (error) {
    console.error("🚨 Erro analyze-competitor:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📊 ANALYTICS — VERIFICAR USO
app.get("/analytics/usage/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const mesAno = new Date().toISOString().slice(0, 7);

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/analytics_usage?user_id=eq.${user_id}&mes_ano=eq.${mesAno}`,
      { headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
    );
    const data = await response.json();
    return res.json({ success: true, analises_usadas: data.length, mes_ano: mesAno });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👑 ADMIN — MÉTRICAS
app.get("/admin/metrics", async (req, res) => {
  try {
    const subsResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/subscriptions?select=plan,status`,
      { headers: { "apikey": process.env.SUPABASE_ANON_KEY, "Authorization": `Bearer ${process.env.SUPABASE_ANON_KEY}` } }
    );

    const subs = await subsResponse.json();

    const planPrices = {
      "creator": 39.90,
      "business": 79.90,
      "agency": 167.90,
      "free": 0
    };

    let mrr = 0;
    let paidUsers = 0;
    let freeUsers = 0;
    const planCount = { creator: 0, business: 0, agency: 0, free: 0 };

    if (Array.isArray(subs)) {
      subs.forEach(sub => {
        if (sub.status === "active") {
          const plan = sub.plan || "free";
          planCount[plan] = (planCount[plan] || 0) + 1;
          mrr += planPrices[plan] || 0;
          if (plan !== "free") paidUsers++;
          else freeUsers++;
        }
      });
    }

    const totalUsers = paidUsers + freeUsers;
    const metaAnual = 1000000;
    const arrAtual = mrr * 12;
    const progressoPercent = (arrAtual / metaAnual * 100).toFixed(2);
    const faltaParaMeta = metaAnual - arrAtual;
    const usuariosPagosNecessarios = Math.ceil(faltaParaMeta / (39.90 * 12));

    return res.json({
      success: true,
      metrics: {
        total_users: totalUsers,
        paid_users: paidUsers,
        free_users: freeUsers,
        mrr: mrr.toFixed(2),
        arr: arrAtual.toFixed(2),
        meta_anual: metaAnual,
        progresso_percent: progressoPercent,
        falta_para_meta: faltaParaMeta.toFixed(2),
        usuarios_pagos_necessarios: usuariosPagosNecessarios,
        plan_breakdown: planCount
      }
    });
  } catch (error) {
    console.error("🚨 Erro admin metrics:", error);
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
