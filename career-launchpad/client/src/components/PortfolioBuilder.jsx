import { useState } from "react";
import { generatePortfolio } from "../services/api.js";
import { SparkleIcon } from "./Icons.jsx";
import LoadingDots from "./LoadingDots.jsx";
import AIContentRenderer from "./AIContentRenderer.jsx";
import { useProfile } from "./ProfileContext.jsx";

export default function PortfolioBuilder() {
  const { profile } = useProfile();
  const [targetRole, setTargetRole] = useState("");
  const [timeframe, setTimeframe] = useState("3 months");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!targetRole.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await generatePortfolio({
        targetRole,
        currentSkills: profile.skills,
        timeframe,
        resumeText: profile.resumeText || "",
      });
      setResult(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-hero">
        <span className="tab-hero-badge">BUILD YOUR PROOF</span>
        <h2 className="tab-hero-title">Projects that get you hired</h2>
        <p className="tab-hero-sub">
          Get a personalized roadmap of portfolio projects tailored to your dream role.
        </p>
      </div>

      <div className="form-grid">
        <div className="input-group full-width">
          <label htmlFor="pb-role">Target Role / Job Title</label>
          <input
            id="pb-role"
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Registered Nurse, Marketing Manager, ML Engineer, Teacher..."
          />
        </div>
        <div className="input-group">
          <label htmlFor="pb-skills">
            Current Skills <span className="opt">(optional)</span>
          </label>
          <textarea
            id="pb-skills"
            value={profile.skills}
            readOnly
            placeholder="Set your skills in the profile panel →"
            rows={3}
          />
        </div>
        <div className="input-group">
          <label>Timeframe</label>
          <div className="chip-row">
            {["1 month", "3 months", "6 months"].map((t) => (
              <button
                key={t}
                className={`chip ${timeframe === t ? "active" : ""}`}
                onClick={() => setTimeframe(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        className="cta-btn"
        onClick={handleSubmit}
        disabled={loading || !targetRole.trim()}
      >
        {loading ? (
          <LoadingDots text="Crafting your roadmap" />
        ) : (
          <>
            <SparkleIcon /> Generate Portfolio Roadmap
          </>
        )}
      </button>

      {error && <div className="error-banner">{error}</div>}
      {result && (
        <div className="result-card fade-in">
          <AIContentRenderer text={result} />
        </div>
      )}
    </div>
  );
}
