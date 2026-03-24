import { useState, useEffect } from "react";
import { ragQuery, ragStats, fetchLiveJobs } from "../services/api.js";
import { SparkleIcon } from "./Icons.jsx";
import LoadingDots from "./LoadingDots.jsx";
import AIContentRenderer from "./AIContentRenderer.jsx";

const EXAMPLE_QUESTIONS = [
  "What skills are most in-demand right now?",
  "Which companies are hiring and what do they pay?",
  "What's the salary range for entry-level vs senior roles?",
  "Are there remote-friendly jobs? What do they look for?",
  "What certifications or qualifications come up the most?",
  "What soft skills do employers actually mention in postings?",
];

export default function JobIntelligence() {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Live sync state
  const [syncQuery, setSyncQuery] = useState("");
  const [syncCountry, setSyncCountry] = useState("us");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [showSync, setShowSync] = useState(false);

  // Load database stats on mount
  const refreshStats = () => {
    ragStats()
      .then(setStats)
      .catch(() => setStats(null));
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleQuery = async (q = null) => {
    const queryText = q || question;
    if (!queryText.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    if (q) setQuestion(q);

    try {
      const response = await ragQuery({
        question: queryText.trim(),
        top_k: 5,
        category,
      });
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!syncQuery.trim()) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const response = await fetchLiveJobs({
        query: syncQuery.trim(),
        country: syncCountry,
        num_pages: 2,
      });
      setSyncResult(response);
      refreshStats(); // Refresh stats after syncing
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-hero">
        <span className="tab-hero-badge">RAG-POWERED</span>
        <h2 className="tab-hero-title">Job market intelligence</h2>
        <p className="tab-hero-sub">
          Ask questions about real job postings. Answers are grounded in actual data
          from our vector database — not generic AI advice.
        </p>
      </div>

      {/* Database stats bar */}
      {stats && stats.total_documents > 0 && (
        <div className="rag-stats-bar">
          <span className="rag-stat">
            <span className="rag-stat-dot" />
            {stats.total_documents} job postings indexed
          </span>
          <span className="rag-stat">
            {stats.categories?.length || 0} categories
          </span>
          <span className="rag-stat rag-stat-model">
            Embeddings: {stats.embedding_model}
          </span>
        </div>
      )}

      {/* Live Sync Toggle */}
      <button
        className="sync-toggle"
        onClick={() => setShowSync(!showSync)}
      >
        <span className="sync-icon">⟳</span>
        {showSync ? "Hide live sync" : "Sync real-time jobs from Adzuna"}
      </button>

      {/* Live Sync Panel */}
      {showSync && (
        <div className="sync-panel fade-in">
          <p className="sync-panel-title">Pull live job postings into the vector database</p>
          <div className="sync-row">
            <div className="input-group" style={{ flex: 2 }}>
              <label htmlFor="sync-query">Search keywords</label>
              <input
                id="sync-query"
                type="text"
                value={syncQuery}
                onChange={(e) => setSyncQuery(e.target.value)}
                placeholder="e.g. nursing, marketing, data science, teaching..."
              />
            </div>
            <div className="input-group" style={{ flex: 0.7 }}>
              <label htmlFor="sync-country">Country</label>
              <select
                id="sync-country"
                value={syncCountry}
                onChange={(e) => setSyncCountry(e.target.value)}
                className="sync-select"
              >
                <option value="us">US</option>
                <option value="gb">UK</option>
                <option value="ca">Canada</option>
                <option value="au">Australia</option>
                <option value="de">Germany</option>
                <option value="fr">France</option>
                <option value="in">India</option>
              </select>
            </div>
            <button
              className="sync-btn"
              onClick={handleSync}
              disabled={syncing || !syncQuery.trim()}
            >
              {syncing ? "Syncing..." : "Fetch & Index"}
            </button>
          </div>
          {syncError && <div className="error-banner" style={{ marginTop: 10 }}>{syncError}</div>}
          {syncResult && (
            <div className="sync-success">
              Fetched {syncResult.fetched} jobs, indexed {syncResult.indexed} unique postings.
              Total in database: {syncResult.total_in_db}
            </div>
          )}
        </div>
      )}

      {/* Question input */}
      <div className="form-grid" style={{ marginTop: 20 }}>
        <div className="input-group full-width">
          <label htmlFor="rag-question">Ask about the job market</label>
          <textarea
            id="rag-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. What skills do employers look for in my field?"
            rows={3}
          />
        </div>

        {/* Category filter */}
        {stats?.categories && (
          <div className="input-group full-width">
            <label>Filter by category <span className="opt">(optional)</span></label>
            <div className="chip-row">
              <button
                className={`chip ${category === null ? "active" : ""}`}
                onClick={() => setCategory(null)}
              >
                All
              </button>
              {stats.categories.map((cat) => (
                <button
                  key={cat}
                  className={`chip ${category === cat ? "active" : ""}`}
                  onClick={() => setCategory(cat === category ? null : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        className="cta-btn"
        onClick={() => handleQuery()}
        disabled={loading || !question.trim()}
      >
        {loading ? (
          <LoadingDots text="Searching & analyzing" />
        ) : (
          <>
            <SparkleIcon /> Search Job Postings & Analyze
          </>
        )}
      </button>

      {/* Example questions */}
      {!result && !loading && (
        <div className="example-questions">
          <p className="example-label">Try asking:</p>
          <div className="example-grid">
            {EXAMPLE_QUESTIONS.map((q, i) => (
              <button
                key={i}
                className="example-btn"
                onClick={() => handleQuery(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {/* Results */}
      {result && (
        <div className="fade-in">
          {/* Sources panel */}
          {result.sources && result.sources.length > 0 && (
            <div className="sources-panel">
              <p className="sources-title">
                Retrieved {result.sources.length} relevant postings from {result.documents_searched} total
              </p>
              <div className="sources-list">
                {result.sources.map((source, i) => (
                  <div key={i} className="source-chip">
                    <span className="source-title">{source.title}</span>
                    <span className="source-company">{source.company}</span>
                    <span className="source-relevance">
                      {Math.round(source.relevance * 100)}% match
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI answer */}
          <div className="result-card">
            {result.confidence != null && (
              <div className="confidence-badge">
                <span className="confidence-value">{result.confidence}%</span>
                <span className="confidence-label">grounded in data</span>
              </div>
            )}
            <AIContentRenderer text={result.answer} />
          </div>
        </div>
      )}
    </div>
  );
}
