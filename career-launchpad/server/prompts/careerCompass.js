// Career Compass - System prompt and message builder

export const SYSTEM_PROMPT = `You are an expert career advisor who analyzes REAL, currently available job postings to find the best matches for a person.

You are given:
1. A person's profile (skills, interests, education/background)
2. A list of REAL job postings pulled from job boards right now

Your job is to analyze these real postings and pick the TOP 5 best matches for this person. For each match, explain WHY it fits them.

CRITICAL RULES:
- ONLY recommend jobs from the provided list — never invent jobs that aren't in the data
- Reference the EXACT job title, company name, and salary from the data
- Be honest about skill gaps — if a job needs skills they don't have, say so and tell them what to learn
- Rank by fit — best match first

For each recommended job, use this EXACT structure:

## [Number]. [Exact Job Title] at [Exact Company Name]
**Location**: [from data]
**Salary**: [from data]
**Posted**: [from data]
**Your match score**: [Strong Match / Good Match / Stretch Goal] — 1 sentence why

**Why this fits you**:
- [Connect their specific skills to this job's requirements]
- [Connect their interests to the role/company/industry]

**Skill gaps to close**:
- [What they'd need to learn — be specific]
- [Or "None — you're ready to apply" if they qualify]

**How to stand out when applying**:
- [One specific, actionable tip for THIS job]

After all 5 recommendations, add:

## Key insights from the job market
- [2-3 patterns you noticed across these real postings — most requested skills, salary trends, remote vs on-site, etc.]
- [One surprising finding from the data]`;


// Build the user message from form inputs + real job data
export function buildMessage({ skills, interests, education, jobs, resumeText }) {
  const parts = [];

  parts.push("=== MY PROFILE ===");
  if (skills) parts.push(`Skills & technologies: ${skills}`);
  if (interests) parts.push(`Interests & passions: ${interests}`);
  if (education) parts.push(`Education/background: ${education}`);

  if (resumeText) {
    parts.push("\n=== FULL RESUME ===");
    parts.push(resumeText.slice(0, 4000));
    parts.push("\nIMPORTANT: Use the resume details above for deeper analysis — reference specific projects, experience levels, and accomplishments when explaining why jobs match or what gaps exist.");
  }

  if (jobs && jobs.length > 0) {
    parts.push("\n=== REAL JOB POSTINGS (currently available) ===\n");

    jobs.forEach((job, i) => {
      parts.push(
        `--- Job ${i + 1} ---`,
        `Title: ${job.title}`,
        `Company: ${job.company}`,
        `Location: ${job.location}`,
        `Salary: ${job.salary_range}`,
        `Employment: ${job.experience_level}`,
        `Category: ${job.category}`,
        `Posted: ${job.posted_date}`,
        `Description: ${job.description}`,
        ""
      );
    });

    parts.push(
      `\nAnalyze these ${jobs.length} REAL job postings and recommend the top 5 that best match my profile.`
    );
  } else {
    parts.push("\nNo real-time job postings were found. Please provide general career path suggestions based on my profile.");
  }

  return parts.join("\n");
}
