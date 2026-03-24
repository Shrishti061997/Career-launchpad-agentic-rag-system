import { Router } from "express";

const router = Router();

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";

// Proxy helper - forwards requests to the Python RAG service.
async function proxyToRAG(endpoint, body = null, method = "POST") {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${RAG_SERVICE_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.detail || data.error || "RAG service error";
    throw new Error(errorMsg);
  }

  return data;
}

// POST /api/rag/query - Full RAG pipeline 
router.post("/query", async (req, res) => {
  const { question, top_k, category } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: "Please provide a question." });
  }

  try {
    const result = await proxyToRAG("/rag/query", {
      question: question.trim(),
      top_k: top_k || 5,
      category: category || null,
    });
    res.json(result);
  } catch (err) {
    console.error("RAG query error:", err.message);
    res.status(502).json({
      error: `RAG service error: ${err.message}. Make sure the Python RAG service is running on port 8000.`,
    });
  }
});

// POST /api/rag/search - Raw semantic search 
router.post("/search", async (req, res) => {
  const { query, top_k, category } = req.body;

  if (!query?.trim()) {
    return res.status(400).json({ error: "Please provide a search query." });
  }

  try {
    const result = await proxyToRAG("/rag/search", {
      query: query.trim(),
      top_k: top_k || 5,
      category: category || null,
    });
    res.json(result);
  } catch (err) {
    console.error("RAG search error:", err.message);
    res.status(502).json({ error: `RAG service error: ${err.message}` });
  }
});

// GET /api/rag/stats - Database stats 
router.get("/stats", async (_req, res) => {
  try {
    const result = await proxyToRAG("/rag/stats", null, "GET");
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `RAG service unavailable: ${err.message}` });
  }
});

// POST /api/rag/fetch - Fetch live jobs from Adzuna 
router.post("/fetch", async (req, res) => {
  const { query, country, num_pages } = req.body;

  try {
    const result = await proxyToRAG("/rag/fetch", {
      query: query || "artificial intelligence",
      country: country || "us",
      num_pages: num_pages || 2,
    });
    res.json(result);
  } catch (err) {
    console.error("RAG fetch error:", err.message);
    res.status(502).json({ error: `Live fetch error: ${err.message}` });
  }
});

// POST /api/rag/discover - Find real jobs for a user 
router.post("/discover", async (req, res) => {
  const { skills, interests, education, country } = req.body;

  if (!skills?.trim() && !interests?.trim()) {
    return res.status(400).json({ error: "Provide at least skills or interests." });
  }

  try {
    const result = await proxyToRAG("/rag/discover", {
      skills: skills || "",
      interests: interests || "",
      education: education || "",
      country: country || "us",
      max_results: 30,
    });
    res.json(result);
  } catch (err) {
    console.error("RAG discover error:", err.message);
    res.status(502).json({ error: `Discover error: ${err.message}` });
  }
});

// POST /api/rag/simulate - Skill simulation 
router.post("/simulate", async (req, res) => {
  const { current_skills, new_skills, country } = req.body;

  if (!current_skills?.trim() || !new_skills?.length) {
    return res.status(400).json({ error: "Provide current skills and at least one new skill." });
  }

  try {
    const result = await proxyToRAG("/rag/simulate", {
      current_skills,
      new_skills: Array.isArray(new_skills) ? new_skills : [new_skills],
      country: country || "us",
    });
    res.json(result);
  } catch (err) {
    console.error("Simulate error:", err.message);
    res.status(502).json({ error: `Simulation error: ${err.message}` });
  }
});

export default router;
