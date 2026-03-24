import { Router } from "express";
import multer from "multer";
import { askLLM } from "../services/llm.js";
import {
  SYSTEM_PROMPT as CAREER_PROMPT,
  buildMessage as buildCareerMsg,
} from "../prompts/careerCompass.js";
import {
  SYSTEM_PROMPT as PORTFOLIO_PROMPT,
  buildMessage as buildPortfolioMsg,
} from "../prompts/portfolioBuilder.js";
import {
  SYSTEM_PROMPT as OUTREACH_PROMPT,
  buildMessage as buildOutreachMsg,
} from "../prompts/outreachAssistant.js";

const router = Router();
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";

// Validation Helpers 
function validateCareer(body) {
  const { skills, interests } = body;
  if (!skills?.trim() && !interests?.trim()) {
    return "Please provide at least your skills or interests.";
  }
  return null;
}

function validatePortfolio(body) {
  const { targetRole } = body;
  if (!targetRole?.trim()) {
    return "Please provide a target role.";
  }
  return null;
}

function validateOutreach(body) {
  const { targetPerson, company } = body;
  if (!targetPerson?.trim() && !company?.trim()) {
    return "Please provide a target person or company.";
  }
  return null;
}

// POST /api/ai/career 
// Now powered by real job postings from Adzuna API!
// Flow: Fetch real jobs → Inject into prompt → AI analyzes matches
router.post("/career", async (req, res) => {
  const error = validateCareer(req.body);
  if (error) return res.status(400).json({ error });

  const { skills, interests, education, country, resumeText, jobType } = req.body;

  // Step 1: Fetch real job postings from Adzuna via RAG service
  let realJobs = [];
  let queriesUsed = [];
  try {
    const discoverRes = await fetch(`${RAG_SERVICE_URL}/rag/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skills: skills || "",
        interests: interests || "",
        education: education || "",
        country: country || "us",
        max_results: 30,
        job_type: jobType || "all",
      }),
    });
    if (discoverRes.ok) {
      const discoverData = await discoverRes.json();
      realJobs = discoverData.jobs || [];
      queriesUsed = discoverData.queries_used || [];
    }
  } catch (err) {
    console.warn("Could not fetch live jobs (Adzuna may be unavailable):", err.message);
  }

  // Step 2: Build prompt with real job data + resume and send to LLM
  const userMessage = buildCareerMsg({
    skills,
    interests,
    education,
    jobs: realJobs,
    resumeText: resumeText || "",
  });
  const result = await askLLM(CAREER_PROMPT, userMessage);

  if (!result.success) {
    return res.status(502).json({ error: result.error });
  }

  // Step 3: Return AI analysis + raw job listings
  res.json({
    data: result.data,
    usage: result.usage,
    jobs: realJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salary_range: j.salary_range,
      experience_level: j.experience_level,
      category: j.category,
      posted_date: j.posted_date,
      redirect_url: j.redirect_url || "",
      description: j.description?.slice(0, 200) + "...",
    })),
    queries_used: queriesUsed,
    total_jobs_found: realJobs.length,
  });
});

// POST /api/ai/portfolio 
router.post("/portfolio", async (req, res) => {
  const error = validatePortfolio(req.body);
  if (error) return res.status(400).json({ error });

  const userMessage = buildPortfolioMsg(req.body);
  const result = await askLLM(PORTFOLIO_PROMPT, userMessage);

  if (!result.success) {
    return res.status(502).json({ error: result.error });
  }

  res.json({ data: result.data, usage: result.usage });
});

// POST /api/ai/outreach 
router.post("/outreach", async (req, res) => {
  const error = validateOutreach(req.body);
  if (error) return res.status(400).json({ error });

  const userMessage = buildOutreachMsg(req.body);
  const result = await askLLM(OUTREACH_PROMPT, userMessage);

  if (!result.success) {
    return res.status(502).json({ error: result.error });
  }

  res.json({ data: result.data, usage: result.usage });
});

// POST /api/ai/parse-resume 
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/parse-resume", upload.single("resume"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  if (req.file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Only PDF files are supported." });
  }

  try {
    // Forward the PDF to the Python RAG service for text extraction
    const formData = new FormData();
    formData.append("file", new Blob([req.file.buffer], { type: "application/pdf" }), req.file.originalname);

    const response = await fetch(`${RAG_SERVICE_URL}/rag/parse-resume`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Resume parsing failed.");
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Resume parse error:", err.message);
    res.status(502).json({ error: `Resume parsing failed: ${err.message}` });
  }
});

// POST /api/ai/agent - AI agent that picks the right tool
const AGENT_SYSTEM_PROMPT = `You are a career assistant agent. Based on the user's message, decide which tool to use and extract the parameters.

Available tools:
1. job_search - Find jobs matching the user's profile. Use when they ask about jobs, openings, roles, hiring, applications.
2. skill_simulate - Simulate impact of learning a new skill. Use when they ask "what should I learn", "what if I learn X", skill ROI.
3. portfolio - Generate a project/credential roadmap. Use when they ask about portfolio, projects, what to build, certifications.
4. outreach - Draft cold outreach messages. Use when they ask about networking, reaching out, cold emails, contacting someone.
5. market_intel - Answer questions about the job market using RAG. Use when they ask general questions about trends, salaries, in-demand skills, or comparisons.

Respond ONLY with valid JSON (no markdown, no backticks):
{"tool": "tool_name", "params": {}, "reasoning": "why this tool"}

For skill_simulate, params must include: {"new_skills": ["skill1", "skill2"]}
For portfolio, params must include: {"target_role": "role name"}
For outreach, params must include: {"target_person": "name/role", "company": "company name"}
For market_intel, params must include: {"question": "the question to search"}
For job_search, params can be empty: {}`;

router.post("/agent", async (req, res) => {
  const { message, skills, interests, education, country, resumeText } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Please provide a message." });
  }

  const userContext = [
    `User message: ${message}`,
    skills ? `Skills: ${skills}` : "",
    interests ? `Interests: ${interests}` : "",
    education ? `Education: ${education}` : "",
  ].filter(Boolean).join("\n");

  // Step 1: Ask LLM to pick the right tool
  let toolChoice;
  try {
    const routeResult = await askLLM(AGENT_SYSTEM_PROMPT, userContext);
    if (!routeResult.success) throw new Error(routeResult.error);
    const cleaned = routeResult.data.replace(/```json|```/g, "").trim();
    toolChoice = JSON.parse(cleaned);
  } catch (err) {
    return res.status(502).json({ error: `Agent routing failed: ${err.message}` });
  }

  const tool = toolChoice.tool;
  let answer = "";
  let sources = null;
  let jobs = null;
  let confidence = null;

  try {
    // Step 2: Call the right backend based on tool choice
    if (tool === "job_search") {
      const discoverRes = await fetch(`${RAG_SERVICE_URL}/rag/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: skills || "", interests: interests || "", education: education || "", country: country || "us", max_results: 15 }),
      });
      if (discoverRes.ok) {
        const discoverData = await discoverRes.json();
        jobs = (discoverData.jobs || []).slice(0, 10).map(j => ({
          title: j.title, company: j.company, location: j.location,
          salary_range: j.salary_range, redirect_url: j.redirect_url || "",
        }));
      }
      const jobSummary = jobs?.length ? jobs.map(j => `${j.title} at ${j.company} (${j.salary_range})`).join("\n") : "No jobs found.";
      const resumeSnippet = resumeText ? `\nResume summary: ${resumeText.slice(0, 1500)}` : "";
      const llm = await askLLM(
        "You are a career advisor. Analyze these real job matches for the user. Be concise. Mention top 3 fits and why they match this specific person's background.",
        `User profile:\n${userContext}${resumeSnippet}\n\nJobs found:\n${jobSummary}`
      );
      answer = llm.success ? llm.data : "Found jobs but couldn't generate analysis.";

    } else if (tool === "skill_simulate") {
      const newSkills = toolChoice.params?.new_skills || [message.replace(/.*learn\s*/i, "").trim()];
      const currentSkills = skills || "general skills";
      const simRes = await fetch(`${RAG_SERVICE_URL}/rag/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_skills: currentSkills, new_skills: newSkills, country: country || "us" }),
      });
      if (simRes.ok) {
        const simData = await simRes.json();
        answer = simData.data || "";
        if (simData.before && simData.after) {
          const stats = `\n\n**Quick stats**: ${simData.before.total_found} jobs before, ${simData.after.total_found} after. ${simData.new_unlocked || 0} new roles unlocked.`;
          answer = (answer || "Simulation ran but no LLM analysis was returned.") + stats;
        }
        if (simData.unlocked_jobs?.length) {
          jobs = simData.unlocked_jobs.map(j => ({
            title: j.title, company: j.company, location: j.location,
            salary_range: j.salary_range, redirect_url: "",
          }));
        }
        if (!answer) answer = "Simulation complete but no analysis was generated. Try the Skill Sim tab directly for full results.";
      } else {
        const errBody = await simRes.json().catch(() => ({}));
        answer = `Skill simulation failed: ${errBody.detail || "unknown error"}. Make sure you have skills in your profile.`;
      }

    } else if (tool === "portfolio") {
      const targetRole = toolChoice.params?.target_role || message.replace(/.*portfolio\s*(for)?\s*/i, "").trim() || "general";
      const llm = await askLLM(PORTFOLIO_PROMPT, buildPortfolioMsg({
        targetRole, currentSkills: skills || "", timeframe: "3 months", resumeText: resumeText || "",
      }));
      answer = llm.success ? llm.data : "Portfolio generation failed. Try the Portfolio tab directly.";

    } else if (tool === "outreach") {
      const person = toolChoice.params?.target_person || "Hiring Manager";
      const company = toolChoice.params?.company || "the company";
      const llm = await askLLM(OUTREACH_PROMPT, buildOutreachMsg({
        targetPerson: person, company, context: "", msgType: "linkedin", resumeText: resumeText || "",
      }));
      answer = llm.success ? llm.data : "Outreach draft failed. Try the Outreach tab directly.";

    } else if (tool === "market_intel") {
      const question = toolChoice.params?.question || message;
      const ragRes = await fetch(`${RAG_SERVICE_URL}/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, top_k: 5 }),
      });
      if (ragRes.ok) {
        const ragData = await ragRes.json();
        answer = ragData.answer || "No answer generated.";
        sources = ragData.sources;
        confidence = ragData.confidence;
      } else {
        answer = "Market intelligence query failed. Make sure the RAG service is running and the database is seeded.";
      }

    } else {
      const llm = await askLLM(
        "You are a helpful career advisor. Answer the user's question concisely.",
        userContext
      );
      answer = llm.success ? llm.data : "I couldn't process that request.";
    }
  } catch (err) {
    console.error("Agent tool execution error:", err.message);
    answer = `Tool execution failed: ${err.message}`;
  }

  res.json({
    answer,
    tool_used: tool,
    reasoning: toolChoice.reasoning,
    sources,
    jobs,
    confidence,
  });
});

export default router;
