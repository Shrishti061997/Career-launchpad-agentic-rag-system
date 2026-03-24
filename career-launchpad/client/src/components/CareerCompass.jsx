import { useState } from "react";
import { discoverCareers } from "../services/api.js";
import { SparkleIcon } from "./Icons.jsx";
import LoadingDots from "./LoadingDots.jsx";
import AIContentRenderer from "./AIContentRenderer.jsx";
import { useProfile } from "./ProfileContext.jsx";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const posted = new Date(dateStr);
    const now = new Date();
    const diffMs = now - posted;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  } catch {
    return dateStr;
  }
}

export default function CareerCompass() {
  const { profile, updateField } = useProfile();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [jobType, setJobType] = useState("all");

  const handleSubmit = async () => {
    if (!profile.skills.trim() && !profile.interests.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setShowAllJobs(false);

    try {
      const response = await discoverCareers({
        skills: profile.skills,
        interests: profile.interests,
        education: profile.education,
        country: profile.country,
        resumeText: profile.resumeText || "",
        jobType,
      });
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const visibleJobs = result?.jobs
    ? showAllJobs ? result.jobs : result.jobs.slice(0, 6)
    : [];

  return (
    <div className="tab-content">
      <div className="tab-hero">
        <span className="tab-hero-badge">REAL JOB MATCHES</span>
        <h2 className="tab-hero-title">Find real jobs that match you</h2>
        <p className="tab-hero-sub">
          We search live job postings based on your skills, then AI analyzes which
          ones are the best fit — with actual companies, salaries, and apply links.
        </p>
      </div>

      <div className="form-grid">
        <div className="input-group">
          <label htmlFor="cc-skills">Your Skills & Technologies</label>
          <textarea
            id="cc-skills"
            value={profile.skills}
            onChange={(e) => updateField("skills", e.target.value)}
            placeholder="e.g. Python, nursing, accounting, teaching, project management, sales..."
            rows={3}
          />
        </div>
        <div className="input-group">
          <label htmlFor="cc-interests">Interests & Passions</label>
          <textarea
            id="cc-interests"
            value={profile.interests}
            onChange={(e) => updateField("interests", e.target.value)}
            placeholder="e.g. healthcare, finance, education, tech, marketing, design..."
            rows={3}
          />
        </div>
        <div className="input-group">
          <label htmlFor="cc-education">
            Education / Background <span className="opt">(optional)</span>
          </label>
          <input
            id="cc-education"
            type="text"
            value={profile.education}
            onChange={(e) => updateField("education", e.target.value)}
            placeholder="e.g. Nursing student at NYU, CS junior at Berkeley, MBA candidate..."
          />
        </div>
        <div className="input-group">
          <label htmlFor="cc-country">Job Market</label>
          <select
            id="cc-country"
            value={profile.country}
            onChange={(e) => updateField("country", e.target.value)}
            className="sync-select"
          >
            <option value="us">United States</option>
            <option value="gb">United Kingdom</option>
            <option value="ca">Canada</option>
            <option value="au">Australia</option>
            <option value="de">Germany</option>
            <option value="fr">France</option>
            <option value="in">India</option>
          </select>
        </div>
      </div>

      <div className="input-group" style={{ marginBottom: 16 }}>
        <label>Looking for</label>
        <div className="chip-row">
          {[
            { value: "all", label: "All" },
            { value: "jobs", label: "Full-time Jobs" },
            { value: "internships", label: "Internships" },
          ].map((t) => (
            <button
              key={t.value}
              className={`chip ${jobType === t.value ? "active" : ""}`}
              onClick={() => setJobType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="cta-btn"
        onClick={handleSubmit}
        disabled={loading || (!profile.skills.trim() && !profile.interests.trim())}
      >
        {loading ? (
          <LoadingDots text="Searching live jobs & analyzing" />
        ) : (
          <>
            <SparkleIcon /> Find My Job Matches
          </>
        )}
      </button>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <div className="fade-in">
          {/* Search summary */}
          {result.total_jobs_found > 0 && (
            <div className="rag-stats-bar" style={{ marginTop: 20 }}>
              <span className="rag-stat">
                <span className="rag-stat-dot" />
                {result.total_jobs_found} live jobs found
              </span>
              {result.queries_used?.length > 0 && (
                <span className="rag-stat rag-stat-model">
                  Searched: {result.queries_used.join(", ")}
                </span>
              )}
            </div>
          )}

          {/* Real Job Listings FIRST */}
          {result.jobs && result.jobs.length > 0 && (
            <div className="jobs-section">
              <h3 className="jobs-section-title">
                {result.jobs.length} jobs matched to your profile
              </h3>
              <div className="jobs-grid">
                {visibleJobs.map((job, i) => (
                  <div key={job.id || i} className="job-card">
                    <div className="job-card-header">
                      <h4 className="job-card-title">{job.title}</h4>
                      <span className="job-card-date">{timeAgo(job.posted_date)}</span>
                    </div>
                    <p className="job-card-company">{job.company}</p>
                    <div className="job-card-meta">
                      <span className="job-meta-tag job-meta-location">{job.location}</span>
                      {job.salary_range && job.salary_range !== "Not specified" && (
                        <span className="job-meta-tag job-meta-salary">{job.salary_range}</span>
                      )}
                      {job.category && (
                        <span className="job-meta-tag job-meta-category">{job.category}</span>
                      )}
                    </div>
                    <p className="job-card-desc">{job.description}</p>
                    <div className="job-card-footer">
                      <span className="job-card-type">{job.experience_level}</span>
                      {job.redirect_url && (
                        <a
                          href={job.redirect_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="job-apply-btn"
                        >
                          Apply Now
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {result.jobs.length > 6 && !showAllJobs && (
                <button
                  className="show-more-btn"
                  onClick={() => setShowAllJobs(true)}
                >
                  Show all {result.jobs.length} jobs
                </button>
              )}
            </div>
          )}

          {/* AI Analysis BELOW - collapsible */}
          {result.data && (
            <details className="ai-analysis-details" open>
              <summary className="ai-analysis-toggle">
                AI analysis - why these jobs fit you
              </summary>
              <div className="result-card" style={{ marginTop: 8 }}>
                {result.total_jobs_found > 0 && (
                  <div className="confidence-badge">
                    <span className="confidence-value">{result.total_jobs_found}</span>
                    <span className="confidence-label">live postings analyzed</span>
                  </div>
                )}
                <AIContentRenderer text={result.data} />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
