import { useState } from "react";
import { useProfile } from "./ProfileContext.jsx";
import { parseResume } from "../services/api.js";

export default function ProfilePanel() {
  const {
    profile,
    profiles,
    activeIndex,
    updateField,
    switchProfile,
    clearProfile,
    getProfileLabel,
    showPanel,
    setShowPanel,
  } = useProfile();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  if (!showPanel) return null;

  const hasData = (p) => !!(p.name || p.skills);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Please upload a PDF file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Max 10MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const result = await parseResume(file);
      updateField("resumeText", result.text);
      updateField("resumeFileName", file.name);

      // Auto-fill empty fields from parsed resume if available
      if (result.extracted) {
        if (!profile.name && result.extracted.name) {
          updateField("name", result.extracted.name);
        }
        if (!profile.skills && result.extracted.skills) {
          updateField("skills", result.extracted.skills);
        }
        if (!profile.education && result.extracted.education) {
          updateField("education", result.extracted.education);
        }
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const removeResume = () => {
    updateField("resumeText", "");
    updateField("resumeFileName", "");
  };

  return (
    <>
      <div className="profile-backdrop" onClick={() => setShowPanel(false)} />

      <div className="profile-panel">
        <div className="profile-panel-header">
          <h3 className="profile-panel-title">Profiles</h3>
          <button
            className="profile-panel-close"
            onClick={() => setShowPanel(false)}
          >
            &times;
          </button>
        </div>

        <p className="profile-panel-desc">
          Upload a resume for deep analysis, or fill fields manually.
          5 slots — switch between profiles to compare.
        </p>

        {/* Profile slot switcher */}
        <div className="profile-slots">
          {profiles.map((p, i) => (
            <button
              key={i}
              className={`profile-slot ${activeIndex === i ? "active" : ""}`}
              onClick={() => switchProfile(i)}
            >
              <span
                className="profile-slot-avatar"
                style={{
                  background: hasData(p)
                    ? `hsl(${i * 72}, 60%, 45%)`
                    : undefined,
                }}
              >
                {hasData(p) ? (p.name?.[0]?.toUpperCase() || (i + 1)) : (i + 1)}
              </span>
              <span className="profile-slot-name">
                {getProfileLabel(p, i)}
              </span>
              {hasData(p) && <span className="profile-slot-dot" />}
            </button>
          ))}
        </div>

        {/* Resume Upload */}
        <div className="resume-upload-section">
          <label className="resume-upload-label">Resume (PDF)</label>
          {profile.resumeFileName ? (
            <div className="resume-uploaded">
              <div className="resume-file-info">
                <span className="resume-file-icon">PDF</span>
                <div className="resume-file-details">
                  <span className="resume-file-name">{profile.resumeFileName}</span>
                  <span className="resume-file-status">
                    {profile.resumeText.length.toLocaleString()} chars extracted
                  </span>
                </div>
              </div>
              <button className="resume-remove-btn" onClick={removeResume}>
                Remove
              </button>
            </div>
          ) : (
            <div className="resume-dropzone">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="resume-file-input"
                id={`resume-upload-${activeIndex}`}
              />
              <label
                htmlFor={`resume-upload-${activeIndex}`}
                className="resume-dropzone-label"
              >
                {uploading ? (
                  <span className="resume-uploading">Parsing resume...</span>
                ) : (
                  <>
                    <span className="resume-dropzone-icon">+</span>
                    <span>Upload PDF resume</span>
                    <span className="resume-dropzone-hint">
                      AI reads your projects, experience &amp; skills
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
          {uploadError && (
            <div className="resume-error">{uploadError}</div>
          )}
          {profile.resumeText && (
            <div className="resume-preview">
              <details>
                <summary className="resume-preview-toggle">
                  Preview extracted text
                </summary>
                <pre className="resume-preview-text">
                  {profile.resumeText.slice(0, 800)}
                  {profile.resumeText.length > 800 && "..."}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Profile form */}
        <div className="profile-form">
          <div className="input-group">
            <label>Full Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="input-group">
            <label>Skills & Technologies</label>
            <textarea
              rows={3}
              value={profile.skills}
              onChange={(e) => updateField("skills", e.target.value)}
              placeholder="e.g. Python, patient care, Excel, teaching, sales..."
            />
          </div>

          <div className="input-group">
            <label>Interests & Passions</label>
            <textarea
              rows={2}
              value={profile.interests}
              onChange={(e) => updateField("interests", e.target.value)}
              placeholder="e.g. healthcare, tech, education, finance..."
            />
          </div>

          <div className="input-group">
            <label>Education / Background</label>
            <input
              type="text"
              value={profile.education}
              onChange={(e) => updateField("education", e.target.value)}
              placeholder="e.g. Nursing student at NYU, CS major at Berkeley..."
            />
          </div>

          <div className="input-group">
            <label>
              About <span className="opt">(used in outreach)</span>
            </label>
            <textarea
              rows={2}
              value={profile.about}
              onChange={(e) => updateField("about", e.target.value)}
              placeholder="e.g. Led a patient safety initiative, built a marketing campaign..."
            />
          </div>

          <div className="input-group">
            <label>Job Market</label>
            <select
              className="sync-select"
              value={profile.country}
              onChange={(e) => updateField("country", e.target.value)}
            >
              <option value="us">United States</option>
              <option value="gb">United Kingdom</option>
              <option value="ca">Canada</option>
              <option value="au">Australia</option>
              <option value="in">India</option>
            </select>
          </div>
        </div>

        <div className="profile-actions">
          {hasData(profile) && (
            <button
              className="profile-clear-btn"
              onClick={() => clearProfile(activeIndex)}
            >
              Clear this profile
            </button>
          )}
          {hasData(profile) && (
            <div className="profile-saved-badge">
              {profile.resumeText
                ? "Resume loaded. AI uses your full background across all tabs."
                : "Saved. All tabs use this profile."}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
