import { useState } from "react";
import { simulateSkill } from "../services/api.js";
import { SparkleIcon } from "./Icons.jsx";
import LoadingDots from "./LoadingDots.jsx";
import AIContentRenderer from "./AIContentRenderer.jsx";
import { useProfile } from "./ProfileContext.jsx";

const SKILL_SUGGESTIONS = [
  "Project Management", "SQL", "Python", "Leadership",
  "Public Speaking", "Data Analysis", "Excel", "Spanish",
];

export default function SkillSimulator() {
  const { profile, updateField } = useProfile();
  const [newSkills, setNewSkills] = useState([]);
  const [inputValue, setInputValue] = useState("");
  
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const currentChips = profile.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const addSkill = (skill) => {
    const s = skill.trim();
    if (
      !s ||
      newSkills.some((ns) => ns.toLowerCase() === s.toLowerCase()) ||
      currentChips.some((cs) => cs.toLowerCase() === s.toLowerCase())
    )
      return;
    setNewSkills((prev) => [...prev, s]);
    setInputValue("");
  };

  const removeSkill = (skill) => {
    setNewSkills((prev) => prev.filter((s) => s !== skill));
    // Clear results when skills change
    if (result) setResult(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill(inputValue);
    }
  };

  const handleSimulate = async () => {
    if (newSkills.length === 0 || !profile.skills.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await simulateSkill({
        currentSkills: profile.skills,
        newSkills: newSkills,
        country: profile.country,
        resumeText: profile.resumeText || "",
      });
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setNewSkills([]);
    setResult(null);
    setError(null);
  };

  const availableSuggestions = SKILL_SUGGESTIONS.filter(
    (s) =>
      !profile.skills.toLowerCase().includes(s.toLowerCase()) &&
      !newSkills.some((ns) => ns.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="tab-content">
      <div className="tab-hero">
        <span className="tab-hero-badge">SKILL SIMULATOR</span>
        <h2 className="tab-hero-title">What if I learn...</h2>
        <p className="tab-hero-sub">
          Stack multiple skills and see their combined impact on your job prospects.
          Add one at a time or combine several — the AI analyzes which combo unlocks
          the most roles and highest salaries.
        </p>
      </div>

      {/* Current skills */}
      <div className="form-grid">
        <div className="input-group full-width">
          <label htmlFor="sim-current">Your current skills</label>
          <input
            id="sim-current"
            type="text"
            value={profile.skills}
            onChange={(e) => updateField("skills", e.target.value)}
            placeholder="e.g. Python, ACLS certification, SQL, project management..."
          />
        </div>
      </div>

      {/* Skills display — current + hypothetical */}
      <div className="sim-skills-row">
        {currentChips.map((s) => (
          <span key={s} className="sim-skill-chip">{s}</span>
        ))}
        {newSkills.map((s) => (
          <span key={s} className="sim-skill-chip sim-skill-new">
            + {s}
            <button
              className="sim-skill-remove"
              onClick={() => removeSkill(s)}
              aria-label={`Remove ${s}`}
            >
              x
            </button>
          </span>
        ))}
      </div>

      {/* Add skill input */}
      <div className="sim-input-row">
        <div className="input-group" style={{ flex: 2 }}>
          <label htmlFor="sim-add">Add a hypothetical skill</label>
          <input
            id="sim-add"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a skill and press Enter..."
          />
        </div>
        <div className="input-group" style={{ flex: 0.7 }}>
          <label htmlFor="sim-country">Market</label>
          <select
            id="sim-country"
            value={profile.country}
            onChange={(e) => updateField("country", e.target.value)}
            className="sync-select"
          >
            <option value="us">US</option>
            <option value="gb">UK</option>
            <option value="ca">Canada</option>
            <option value="au">Australia</option>
            <option value="in">India</option>
          </select>
        </div>
      </div>

      {/* Quick suggestion chips */}
      <div className="sim-suggestions">
        <span className="sim-suggestions-label">Quick add:</span>
        {availableSuggestions.map((s) => (
          <button
            key={s}
            className="sim-suggestion-btn"
            onClick={() => addSkill(s)}
            disabled={loading}
          >
            + {s}
          </button>
        ))}
      </div>

      {/* Skill count + clear */}
      {newSkills.length > 0 && (
        <div className="sim-action-bar">
          <span className="sim-action-count">
            {newSkills.length} skill{newSkills.length > 1 ? "s" : ""} to simulate:{" "}
            <strong>{newSkills.join(" + ")}</strong>
          </span>
          <button className="sim-clear-btn" onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      {/* Simulate button */}
      <button
        className="cta-btn"
        onClick={handleSimulate}
        disabled={loading || newSkills.length === 0 || !profile.skills.trim()}
      >
        {loading ? (
          <LoadingDots
            text={`Simulating ${newSkills.length} skill${newSkills.length > 1 ? "s" : ""}`}
          />
        ) : (
          <>
            <SparkleIcon />
            {newSkills.length === 1
              ? `Simulate learning ${newSkills[0]}`
              : `Simulate ${newSkills.length} skills combined`}
          </>
        )}
      </button>

      {error && <div className="error-banner">{error}</div>}

      {/* Results */}
      {result && (
        <div className="fade-in">
          {/* Impact stats */}
          <div className="sim-stats-grid">
            <div className="sim-stat-card">
              <span className="sim-stat-label">Before</span>
              <span className="sim-stat-value">{result.before.total_found}</span>
              <span className="sim-stat-sub">jobs matched</span>
            </div>
            <div className="sim-stat-card sim-stat-highlight">
              <span className="sim-stat-label">
                After + {result.skills_added.length > 2
                  ? `${result.skills_added.length} skills`
                  : result.skills_added.join(" + ")}
              </span>
              <span className="sim-stat-value">{result.after.total_found}</span>
              <span className="sim-stat-sub">jobs matched</span>
            </div>
            <div className="sim-stat-card sim-stat-highlight">
              <span className="sim-stat-label">New unlocked</span>
              <span className="sim-stat-value sim-stat-green">
                +{result.new_unlocked}
              </span>
              <span className="sim-stat-sub">new roles</span>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="result-card">
            <AIContentRenderer text={result.data} />
          </div>

          {/* Unlocked jobs */}
          {result.unlocked_jobs && result.unlocked_jobs.length > 0 && (
            <div className="sim-unlocked-section">
              <h3 className="sim-unlocked-title">
                Unlocked with {result.skills_added.join(" + ")}
              </h3>
              {result.unlocked_jobs.map((job, i) => (
                <div key={job.id || i} className="sim-job-row sim-job-new">
                  <div className="sim-job-unlock-badge">NEW</div>
                  <div className="sim-job-info">
                    <span className="sim-job-title">{job.title}</span>
                    <span className="sim-job-company">
                      {job.company} · {job.location}
                    </span>
                  </div>
                  <div className="sim-job-right">
                    <span className="sim-job-salary">{job.salary_range}</span>
                    <span className="sim-job-date">{job.posted_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Existing matches */}
          {result.before_jobs && result.before_jobs.length > 0 && (
            <div className="sim-existing-section">
              <h3 className="sim-existing-title">
                Your existing matches ({result.before.total_found})
              </h3>
              {result.before_jobs.slice(0, 4).map((job, i) => (
                <div key={job.id || i} className="sim-job-row">
                  <div className="sim-job-info">
                    <span className="sim-job-title">{job.title}</span>
                    <span className="sim-job-company">
                      {job.company} · {job.location}
                    </span>
                  </div>
                  <div className="sim-job-right">
                    <span className="sim-job-salary">{job.salary_range}</span>
                  </div>
                </div>
              ))}
              {result.before.total_found > 4 && (
                <div className="sim-more-text">
                  + {result.before.total_found - 4} more existing matches
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
