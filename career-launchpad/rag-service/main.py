"""
FastAPI server for the RAG pipeline.
Handles semantic search, job discovery, skill simulation, and resume parsing.
"""

import os
from contextlib import asynccontextmanager

from openai import OpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag_engine import retrieve, get_stats, seed_database

# Load environment variables from root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# --- NVIDIA NIM Configuration 
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")


# --- Lifespan: warm up on startup 
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the embedding model and check database on startup."""
    stats = get_stats()
    if stats["total_documents"] == 0:
        print("⚠️  Database is empty! Run `python seed_data.py` first.")
    else:
        print(f"✅ RAG database ready: {stats['total_documents']} documents indexed.")
    yield


app = FastAPI(
    title="Career Launchpad RAG Service",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- Request/Response Models 

class RAGQueryRequest(BaseModel):
    """Request body for the main RAG query endpoint."""
    question: str = Field(..., min_length=3, max_length=1000, description="The user's question")
    top_k: int = Field(default=5, ge=1, le=10, description="Number of documents to retrieve")
    category: str | None = Field(default=None, description="Optional category filter")

class SearchRequest(BaseModel):
    """Request body for raw semantic search."""
    query: str = Field(..., min_length=3, max_length=500)
    top_k: int = Field(default=5, ge=1, le=10)
    category: str | None = None

class FetchJobsRequest(BaseModel):
    """Request body for fetching live jobs from Adzuna."""
    query: str = Field(default="jobs", min_length=2, max_length=200)
    country: str = Field(default="us", min_length=2, max_length=5)
    num_pages: int = Field(default=2, ge=1, le=5)

class DiscoverRequest(BaseModel):
    """Request body for discovering real jobs based on user profile."""
    skills: str = Field(default="", max_length=1000)
    interests: str = Field(default="", max_length=1000)
    education: str = Field(default="", max_length=500)
    country: str = Field(default="us", max_length=5)
    max_results: int = Field(default=30, ge=5, le=50)
    job_type: str = Field(default="all")  # "all", "jobs", "internships"

class SimulateRequest(BaseModel):
    """Request body for skill simulation - supports multiple new skills."""
    current_skills: str = Field(..., min_length=2, max_length=1000)
    new_skills: list[str] = Field(..., min_length=1, max_length=10)
    country: str = Field(default="us", max_length=5)


# --- LLM Integration 

RAG_SYSTEM_PROMPT = """You are an expert career advisor with access to REAL job posting data. 
Your answers must be grounded in the retrieved job postings provided below. 

When answering:
- Reference specific job titles, companies, and requirements from the data
- Quote actual salary ranges and skill requirements when relevant
- Be specific about what employers are ACTUALLY asking for, not generic advice
- If the retrieved data doesn't fully answer the question, say so honestly
- Highlight patterns you notice across multiple postings

Format your response with:
- Clear headings (##) for sections
- **Bold** for key insights
- Bullet points for lists of skills or requirements
- Include specific data points (salaries, company names, etc.)

You are helping people understand the REAL job market based on actual postings, 
not giving generic career advice. Ground everything in the data."""


def build_rag_prompt(question: str, retrieved_docs: list[dict]) -> str:
    """
    Construct the augmented prompt by injecting retrieved documents
    as context before the user's question.
    """
    context_parts = []
    for i, doc in enumerate(retrieved_docs, 1):
        meta = doc["metadata"]
        context_parts.append(
            f"--- Job Posting {i} ---\n"
            f"Title: {meta['title']}\n"
            f"Company: {meta['company']}\n"
            f"Location: {meta['location']}\n"
            f"Salary: {meta['salary_range']}\n"
            f"Experience: {meta['experience_level']}\n"
            f"Category: {meta['category']}\n"
            f"Full Details:\n{doc['document']}\n"
        )

    context_block = "\n".join(context_parts)

    return (
        f"Here are the most relevant job postings from our database:\n\n"
        f"{context_block}\n\n"
        f"Based on these REAL job postings, answer the following question:\n\n"
        f"{question}"
    )


async def generate_rag_answer(question: str, retrieved_docs: list[dict]) -> str:
    """Send retrieved context + question to NVIDIA NIM for an augmented answer."""
    if not NVIDIA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="NVIDIA_API_KEY not set. Add it to your .env file.",
        )

    # NVIDIA NIM uses OpenAI-compatible API format
    client = OpenAI(
        api_key=NVIDIA_API_KEY,
        base_url=NVIDIA_BASE_URL,
    )
    user_message = build_rag_prompt(question, retrieved_docs)

    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=1500,
            temperature=0.7,
            top_p=0.9,
            messages=[
                {"role": "system", "content": RAG_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NVIDIA NIM API error: {str(e)}")


# --- Endpoints 

@app.get("/health")
async def health_check():
    stats = get_stats()
    return {
        "status": "ok",
        "service": "rag",
        "documents_indexed": stats["total_documents"],
    }


@app.get("/rag/stats")
async def database_stats():
    """Return database statistics including categories and document count."""
    return get_stats()


@app.post("/rag/search")
async def semantic_search(req: SearchRequest):
    """
    Raw semantic search — returns matching documents without LLM generation.
    Useful for debugging and understanding what the retriever finds.
    """
    results = retrieve(
        query=req.query,
        top_k=req.top_k,
        category_filter=req.category,
    )

    return {
        "query": req.query,
        "results": [
            {
                "id": r["id"],
                "title": r["metadata"]["title"],
                "company": r["metadata"]["company"],
                "category": r["metadata"]["category"],
                "salary": r["metadata"]["salary_range"],
                "relevance_score": round(1 - r["distance"], 3),  # Convert distance to similarity
                "snippet": r["document"][:300] + "...",
            }
            for r in results
        ],
    }


@app.post("/rag/query")
async def rag_query(req: RAGQueryRequest):
    """
    Main RAG endpoint — retrieves relevant documents then generates
    an AI answer grounded in real job posting data.
    
    This is the full RAG pipeline:
    1. Embed the question
    2. Search ChromaDB for relevant job postings
    3. Inject retrieved postings into the LLM prompt
    4. Return the LLM's data-grounded answer
    """
    # Step 1 & 2: Retrieve relevant documents
    retrieved = retrieve(
        query=req.question,
        top_k=req.top_k,
        category_filter=req.category,
    )

    if not retrieved:
        return {
            "answer": "No relevant job postings found in the database. Try seeding the database first with `python seed_data.py`.",
            "sources": [],
            "question": req.question,
        }

    # Step 3 & 4: Generate augmented answer
    answer = await generate_rag_answer(req.question, retrieved)

    # Return answer with source metadata
    sources = [
        {
            "title": r["metadata"]["title"],
            "company": r["metadata"]["company"],
            "category": r["metadata"]["category"],
            "salary": r["metadata"]["salary_range"],
            "relevance": round(1 - r["distance"], 3),
        }
        for r in retrieved
    ]

    # Calculate confidence (average relevance of top sources)
    avg_relevance = sum(1 - r["distance"] for r in retrieved) / len(retrieved) if retrieved else 0
    confidence = round(avg_relevance * 100)

    return {
        "answer": answer,
        "sources": sources,
        "question": req.question,
        "documents_searched": get_stats()["total_documents"],
        "confidence": confidence,
    }


@app.post("/rag/seed")
async def reseed_database():
    """Re-seed the database from the JSON data file."""
    try:
        count = seed_database()
        return {"status": "ok", "documents_indexed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/fetch")
async def fetch_live_jobs(req: FetchJobsRequest):
    """
    Fetch real-time job postings from Adzuna API and index them
    into ChromaDB alongside the existing seed data.
    
    Requires ADZUNA_APP_ID and ADZUNA_APP_KEY in .env
    """
    try:
        from fetch_live_jobs import fetch_and_index

        result = fetch_and_index(
            query=req.query,
            country=req.country,
            num_pages=req.num_pages,
            results_per_page=20,
        )
        return {
            "status": "ok",
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch jobs: {str(e)}")


@app.post("/rag/discover")
async def discover_jobs(req: DiscoverRequest):
    """
    Discover real job openings based on a user's profile.
    
    Takes skills, interests, and education → builds smart search queries →
    searches Adzuna for real, currently available positions → returns parsed listings.
    
    Used by Career Compass to show REAL jobs instead of generic advice.
    """
    from fetch_live_jobs import search_adzuna, parse_adzuna_job

    skills = req.skills.strip()
    interests = req.interests.strip()
    education = req.education.strip()

    if not skills and not interests:
        raise HTTPException(status_code=400, detail="Provide at least skills or interests.")

    # Build multiple targeted search queries from the user's profile
    queries = []
    type_suffix = ""
    if req.job_type == "internships":
        type_suffix = " internship"
    elif req.job_type == "jobs":
        type_suffix = ""

    # Soft skills don't work as direct Adzuna searches
    # "Leadership" returns nothing useful, but "leadership manager" does
    SOFT_SKILLS = {
        "leadership", "communication", "teamwork", "problem solving",
        "critical thinking", "time management", "collaboration",
        "stakeholder management", "cross-functional collaboration",
        "product execution", "project management", "mentoring",
        "public speaking", "negotiation", "conflict resolution",
        "decision making", "strategic thinking", "adaptability",
        "emotional intelligence", "team management",
    }

    # Role keywords that soft skills map to (for better Adzuna results)
    SOFT_TO_ROLE = {
        "leadership": "manager",
        "stakeholder management": "product manager",
        "cross-functional collaboration": "program manager",
        "product execution": "product manager",
        "team management": "team lead",
        "mentoring": "senior",
        "strategic thinking": "director",
        "project management": "project manager",
        "public speaking": "communications",
    }

    if skills:
        skill_terms = [s.strip() for s in skills.split(",") if s.strip()]
        hard_skills = []
        soft_skills = []

        for term in skill_terms:
            if term.lower() in SOFT_SKILLS:
                soft_skills.append(term)
            else:
                hard_skills.append(term)

        # Hard skills: search directly (these work well on Adzuna)
        if len(hard_skills) >= 2:
            queries.append(" ".join(hard_skills[:3]) + type_suffix)
        for term in hard_skills[:4]:
            queries.append(f"{term}{type_suffix}")

        # Soft skills: convert to role-based queries
        for term in soft_skills[:3]:
            role = SOFT_TO_ROLE.get(term.lower(), term.lower())
            queries.append(f"{role}{type_suffix}")

        # Combine hard + soft for hybrid queries (e.g. "Python manager")
        if hard_skills and soft_skills:
            role = SOFT_TO_ROLE.get(soft_skills[0].lower(), soft_skills[0].lower())
            queries.append(f"{hard_skills[0]} {role}{type_suffix}")

    # Add interest-based queries
    if interests:
        interest_terms = [s.strip() for s in interests.split(",") if s.strip()]
        for term in interest_terms[:3]:
            queries.append(term + type_suffix)

    # Deduplicate queries
    seen = set()
    unique_queries = []
    for q in queries:
        q_lower = q.lower()
        if q_lower not in seen:
            seen.add(q_lower)
            unique_queries.append(q)

    # Limit to 7 queries max
    unique_queries = unique_queries[:7]

    # Search Adzuna for each query
    all_jobs = []
    results_per_query = max(5, req.max_results // len(unique_queries))

    for query in unique_queries:
        try:
            raw = search_adzuna(
                query=query,
                country=req.country,
                page=1,
                results_per_page=min(results_per_query, 20),
            )
            for job in raw.get("results", []):
                parsed = parse_adzuna_job(job)
                parsed["matched_query"] = query
                all_jobs.append(parsed)
        except Exception as e:
            print(f"⚠️ Search failed for '{query}': {e}")
            continue

    # Deduplicate by job ID
    seen_ids = set()
    unique_jobs = []
    for job in all_jobs:
        if job["id"] not in seen_ids:
            seen_ids.add(job["id"])
            unique_jobs.append(job)

    # Filter by job type
    if req.job_type == "internships":
        unique_jobs = [j for j in unique_jobs if "intern" in j.get("title", "").lower() or "intern" in j.get("experience_level", "").lower()]
    elif req.job_type == "jobs":
        unique_jobs = [j for j in unique_jobs if "intern" not in j.get("title", "").lower()]

    # Limit total results
    unique_jobs = unique_jobs[:req.max_results]

    return {
        "jobs": unique_jobs,
        "queries_used": unique_queries,
        "total_found": len(unique_jobs),
        "country": req.country,
    }


SIMULATE_SYSTEM_PROMPT = """You are an expert career advisor analyzing how learning NEW skill(s) changes someone's job prospects.

You are given:
1. Jobs matched with CURRENT skills (before)
2. Jobs matched with CURRENT + NEW skill(s) (after)
3. Jobs that are NEW - only accessible after learning the skill(s)

Adapt your analysis to the person's field. If they're in tech, talk about coding skills. If they're in healthcare, talk about certifications. If they're in business, talk about credentials. Match your advice to their industry.

Provide a concise, data-driven analysis. Structure EXACTLY as:

## Impact of learning [skill(s)]

**ROI summary**: [1 sentence - is this worth the investment?]

### What unlocks
- [Which specific new job titles/companies become accessible]
- [Salary range change]

### Time investment estimate
- [Realistic time to learn - if multiple skills, estimate combined time and whether they should be learned together or sequentially]
- [Best learning path - could be a course, project, certification, clinical hours, workshop, etc. depending on the field]

### Synergy analysis (if multiple skills)
- [Do these skills multiply each other's value?]
- [Would learning them in a specific order be more effective?]
- [Compare: combined value vs learning just the single highest-impact one]

### Verdict
[2-3 sentences: Should they invest in this? If multiple skills, recommend priority order. Be honest - if the impact is low, say so.]

Be specific. Reference actual job titles and companies from the data. No generic advice."""


@app.post("/rag/simulate")
async def simulate_skill(req: SimulateRequest):
    """
    Simulate the impact of learning one or more new skills on job prospects.

    Searches Adzuna for before (current skills) and after (current + new skills),
    compares results, then uses LLM to generate an ROI analysis.
    """
    from fetch_live_jobs import search_adzuna, parse_adzuna_job
    import time as _time

    current = req.current_skills.strip()
    new_skills = [s.strip() for s in req.new_skills if s.strip()]

    if not new_skills:
        raise HTTPException(status_code=400, detail="Provide at least one new skill.")

    skills_label = " + ".join(new_skills)

    # Soft skills that don't work as direct search terms
    SOFT_SKILLS = {
        "leadership", "communication", "teamwork", "problem solving",
        "critical thinking", "stakeholder management", "cross-functional collaboration",
        "product execution", "project management", "collaboration", "mentoring",
    }
    SOFT_TO_ROLE = {
        "leadership": "manager", "stakeholder management": "product manager",
        "cross-functional collaboration": "program manager",
        "product execution": "product manager", "project management": "project manager",
    }

    # Search with current skills only (filter soft skills for better queries)
    before_jobs = []
    skill_terms = [s.strip() for s in current.split(",") if s.strip()]
    hard_terms = [s for s in skill_terms if s.lower() not in SOFT_SKILLS]
    soft_terms = [s for s in skill_terms if s.lower() in SOFT_SKILLS]

    # Build before query from hard skills + role mappings of soft skills
    query_parts = hard_terms[:3]
    for s in soft_terms[:2]:
        query_parts.append(SOFT_TO_ROLE.get(s.lower(), s.lower()))
    query_before = " ".join(query_parts[:4])
    try:
        raw = search_adzuna(query_before, req.country, 1, 20)
        for j in raw.get("results", []):
            before_jobs.append(parse_adzuna_job(j))
    except Exception as e:
        print(f"Search before failed: {e}")

    # Search with current skills + ALL new skills combined
    after_jobs = []

    # Combined query: current + all new skills together (map soft to roles)
    new_mapped = [SOFT_TO_ROLE.get(s.lower(), s) for s in new_skills]
    query_combined = f"{query_before} {' '.join(new_mapped)}"
    try:
        raw = search_adzuna(query_combined, req.country, 1, 20)
        for j in raw.get("results", []):
            after_jobs.append(parse_adzuna_job(j))
    except Exception:
        pass

    # Also search each new skill individually to catch niche roles
    for skill in new_skills:
        search_term = SOFT_TO_ROLE.get(skill.lower(), skill)
        try:
            raw = search_adzuna(search_term, req.country, 1, 10)
            for j in raw.get("results", []):
                after_jobs.append(parse_adzuna_job(j))
            _time.sleep(0.3)  # Be nice to API
        except Exception:
            pass

    # If multiple skills, also search interesting pairs
    if len(new_skills) >= 2:
        for i in range(min(len(new_skills) - 1, 3)):
            s1 = SOFT_TO_ROLE.get(new_skills[i].lower(), new_skills[i])
            s2 = SOFT_TO_ROLE.get(new_skills[i + 1].lower(), new_skills[i + 1])
            pair = f"{s1} {s2}"
            try:
                raw = search_adzuna(pair, req.country, 1, 10)
                for j in raw.get("results", []):
                    after_jobs.append(parse_adzuna_job(j))
                _time.sleep(0.3)
            except Exception:
                pass

    # Deduplicate after_jobs
    seen = set()
    unique_after = []
    for j in after_jobs:
        if j["id"] not in seen:
            seen.add(j["id"])
            unique_after.append(j)

    # Find truly new jobs (in after but not before)
    before_ids = {j["id"] for j in before_jobs}
    unlocked = [j for j in unique_after if j["id"] not in before_ids]

    # Build LLM prompt
    def jobs_summary(jobs, limit=12):
        lines = []
        for j in jobs[:limit]:
            lines.append(f"- {j['title']} at {j['company']} | {j['location']} | {j['salary_range']}")
        return "\n".join(lines) if lines else "- No jobs found"

    multi_label = (
        f"the combination of: {skills_label}"
        if len(new_skills) > 1
        else new_skills[0]
    )

    user_msg = f"""Current skills: {current}
New skill(s) being considered: {skills_label}
Number of new skills: {len(new_skills)}

=== BEFORE (current skills only): {len(before_jobs)} jobs ===
{jobs_summary(before_jobs)}

=== AFTER (current + {skills_label}): {len(unique_after)} jobs ===
{jobs_summary(unique_after)}

=== NEW UNLOCKED JOBS (only accessible with {skills_label}): {len(unlocked)} jobs ===
{jobs_summary(unlocked)}

Analyze the ROI of learning {multi_label} for this person.
{"Compare the combined value vs learning each skill individually. Would they be better off learning these together or picking just one?" if len(new_skills) > 1 else ""}"""

    # Get AI analysis
    ai_text = ""
    if NVIDIA_API_KEY:
        try:
            client = OpenAI(api_key=NVIDIA_API_KEY, base_url=NVIDIA_BASE_URL)
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=1200,
                temperature=0.7,
                messages=[
                    {"role": "system", "content": SIMULATE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
            )
            ai_text = response.choices[0].message.content or ""
        except Exception as e:
            ai_text = f"AI analysis unavailable: {str(e)}"
    else:
        ai_text = "Configure NVIDIA_API_KEY to get AI-powered skill analysis."

    return {
        "data": ai_text,
        "skills_added": new_skills,
        "before": {"total_found": len(before_jobs)},
        "after": {"total_found": len(unique_after)},
        "new_unlocked": len(unlocked),
        "before_jobs": [
            {"id": j["id"], "title": j["title"], "company": j["company"],
             "location": j["location"], "salary_range": j["salary_range"]}
            for j in before_jobs[:8]
        ],
        "unlocked_jobs": [
            {"id": j["id"], "title": j["title"], "company": j["company"],
             "location": j["location"], "salary_range": j["salary_range"],
             "posted_date": j["posted_date"]}
            for j in unlocked[:10]
        ],
    }


# --- Resume Parsing 

@app.post("/rag/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """
    Extract text from a PDF resume and optionally auto-extract
    name, skills, and education using the LLM.
    """
    import io

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        from pypdf import PdfReader

        content = await file.read()
        reader = PdfReader(io.BytesIO(content))

        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text.strip())

        full_text = "\n\n".join(text_parts)

        if not full_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this PDF. It may be image-based — try a text-based PDF."
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing error: {str(e)}")

    # Use LLM to auto-extract structured fields from resume
    extracted = {}
    if NVIDIA_API_KEY and len(full_text) > 50:
        try:
            client = OpenAI(api_key=NVIDIA_API_KEY, base_url=NVIDIA_BASE_URL)
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=500,
                temperature=0.2,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Extract structured info from this resume. "
                            "Return ONLY a JSON object with these fields (use empty string if not found):\n"
                            '{"name": "full name", "skills": "comma-separated skills/technologies", '
                            '"education": "most recent degree and school"}\n'
                            "No markdown, no explanation, just the JSON."
                        ),
                    },
                    {"role": "user", "content": full_text[:3000]},
                ],
            )
            import json
            raw = response.choices[0].message.content.strip()
            # Strip markdown fences if present
            raw = raw.replace("```json", "").replace("```", "").strip()
            extracted = json.loads(raw)
        except Exception as e:
            print(f"Auto-extract failed (non-critical): {e}")

    return {
        "text": full_text,
        "pages": len(reader.pages),
        "characters": len(full_text),
        "extracted": extracted,
    }
