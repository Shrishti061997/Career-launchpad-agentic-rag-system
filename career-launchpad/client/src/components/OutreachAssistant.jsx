import { useState } from "react";
import { draftOutreach } from "../services/api.js";
import { SparkleIcon } from "./Icons.jsx";
import LoadingDots from "./LoadingDots.jsx";
import AIContentRenderer from "./AIContentRenderer.jsx";
import { useProfile } from "./ProfileContext.jsx";

export default function OutreachAssistant() {
  const { profile } = useProfile();
  const [targetPerson, setTargetPerson] = useState("");
  const [company, setCompany] = useState("");
  const [msgType, setMsgType] = useState("LinkedIn");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Build context from profile
  const context = [
    profile.name && `Name: ${profile.name}`,
    profile.education && profile.education,
    profile.skills && `Skills: ${profile.skills}`,
    profile.about && profile.about,
  ].filter(Boolean).join(". ");

  const handleSubmit = async () => {
    if (!targetPerson.trim() && !company.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await draftOutreach({
        targetPerson, company, context, msgType,
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
        <span className="tab-hero-badge">MAKE CONNECTIONS</span>
        <h2 className="tab-hero-title">Cold outreach that actually works</h2>
        <p className="tab-hero-sub">
          Get personalized, non-cringe messages that open doors and start conversations.
        </p>
      </div>

      <div className="form-grid">
        <div className="input-group">
          <label htmlFor="oa-person">Who do you want to reach?</label>
          <input
            id="oa-person"
            type="text"
            value={targetPerson}
            onChange={(e) => setTargetPerson(e.target.value)}
            placeholder="e.g. Hiring Manager, Department Head, HR Director..."
          />
        </div>
        <div className="input-group">
          <label htmlFor="oa-company">Company</label>
          <input
            id="oa-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Mayo Clinic, Google, Deloitte, local school district..."
          />
        </div>
        <div className="input-group full-width">
          <label>
            About You <span className="opt">(from your profile)</span>
          </label>
          <textarea
            value={context || "Fill in your profile to personalize outreach messages →"}
            readOnly
            rows={2}
            style={{ opacity: context ? 1 : 0.5 }}
          />
        </div>
        <div className="input-group full-width">
          <label>Message Type</label>
          <div className="chip-row">
            {["LinkedIn", "Cold Email", "Twitter/X DM"].map((t) => (
              <button
                key={t}
                className={`chip ${msgType === t ? "active" : ""}`}
                onClick={() => setMsgType(t)}
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
        disabled={loading || (!targetPerson.trim() && !company.trim())}
      >
        {loading ? (
          <LoadingDots text="Drafting your message" />
        ) : (
          <>
            <SparkleIcon /> Draft Outreach Messages
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
