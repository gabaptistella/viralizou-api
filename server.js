const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// TESTE
app.get("/", (req, res) => {
  res.send("Viralizou backend rodando 🚀");
});

// TESTE POST (GARANTIA)
app.post("/generate-reel", async (req, res) => {
  const { topic } = req.body;

  res.json({
    success: true,
    provider: "mock",
    roteiro: `Teste funcionando sobre: ${topic}`
  });
});

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});
