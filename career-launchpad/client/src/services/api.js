// API Service - Handles all communication with the backend

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function post(url, body) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error || "Something went wrong. Please try again.",
        response.status
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError(
      "Unable to reach the server. Make sure the backend is running on port 3001.",
      0
    );
  }
}

async function get(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data.error || "Request failed.", response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the server.", 0);
  }
}

// GenAI Endpoints (/api/ai/*) 

export async function discoverCareers({ skills, interests, education, country, resumeText, jobType }) {
  return post("/api/ai/career", { skills, interests, education, country, resumeText, jobType });
}

export async function generatePortfolio({ targetRole, currentSkills, timeframe, resumeText }) {
  return post("/api/ai/portfolio", { targetRole, currentSkills, timeframe, resumeText });
}

export async function draftOutreach({ targetPerson, company, context, msgType, resumeText }) {
  return post("/api/ai/outreach", { targetPerson, company, context, msgType, resumeText });
}

// RAG Endpoints (/api/rag/*) 

// Job Intelligence - Full RAG query (retrieve + generate)
export async function ragQuery({ question, top_k = 5, category = null }) {
  return post("/api/rag/query", { question, top_k, category });
}

// Semantic Search - Raw vector search without LLM generation
export async function ragSearch({ query, top_k = 5, category = null }) {
  return post("/api/rag/search", { query, top_k, category });
}

// RAG Stats - Get database statistics
export async function ragStats() {
  return get("/api/rag/stats");
}

// Fetch Live Jobs - Pull real-time jobs from Adzuna and index into ChromaDB
export async function fetchLiveJobs({ query = "jobs", country = "us", num_pages = 2 } = {}) {
  return post("/api/rag/fetch", { query, country, num_pages });
}

// Skill Simulator - Compare job prospects before/after learning new skills
export async function simulateSkill({ currentSkills, newSkills, country = "us" }) {
  return post("/api/rag/simulate", {
    current_skills: currentSkills,
    new_skills: Array.isArray(newSkills) ? newSkills : [newSkills],
    country,
  });
}

// Parse Resume - Upload a PDF and extract text
export async function parseResume(file) {
  const formData = new FormData();
  formData.append("resume", file);

  try {
    const response = await fetch("/api/ai/parse-resume", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(data.error || "Failed to parse resume.", response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the server.", 0);
  }
}

// Agent Chat - AI decides which tool to call
export async function agentChat({ message, skills, interests, education, country, resumeText }) {
  return post("/api/ai/agent", { message, skills, interests, education, country, resumeText });
}
