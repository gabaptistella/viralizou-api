const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Backend funcionando 🚀");
});

app.post("/generate-reel", async (req, res) => {
  const { topic } = req.body;

  try {
    let roteiro = "Teste funcionando";
    let provider = "mock";

    res.json({ success: true, provider, roteiro });

  } catch (error) {
    res.status(500).json({
      error: "Erro",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});
