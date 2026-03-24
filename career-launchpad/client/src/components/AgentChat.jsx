import { useState, useRef, useEffect } from "react";
import { agentChat } from "../services/api.js";
import { SparkleIcon } from "./Icons.jsx";
import LoadingDots from "./LoadingDots.jsx";
import AIContentRenderer from "./AIContentRenderer.jsx";
import { useProfile } from "./ProfileContext.jsx";

const STARTER_PROMPTS = [
  "Find me jobs that match my resume",
  "What skills should I learn next?",
  "Build me a portfolio for my target role",
  "What does the job market look like for my field?",
  "Draft a cold outreach message for a hiring manager",
  "Simulate adding Project Management to my skills",
];

export default function AgentChat() {
  const { profile } = useProfile();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text = null) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const res = await agentChat({
        message: msg,
        skills: profile.skills || "",
        interests: profile.interests || "",
        education: profile.education || "",
        country: profile.country || "us",
        resumeText: profile.resumeText || "",
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: res.answer,
          tool: res.tool_used,
          confidence: res.confidence,
          sources: res.sources,
          jobs: res.jobs,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: `Something went wrong: ${err.message}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="tab-content">
      <div className="tab-hero">
        <span className="tab-hero-badge">AI AGENT</span>
        <h2 className="tab-hero-title">Ask me anything about your career</h2>
        <p className="tab-hero-sub">
          I'll figure out which tool to use — job search, skill simulation,
          portfolio advice, market intelligence, or outreach drafting.
        </p>
      </div>

      {/* Chat messages */}
      <div className="agent-chat">
        {messages.length === 0 && !loading && (
          <div className="agent-starters">
            <p className="agent-starters-label">Try something:</p>
            <div className="agent-starters-grid">
              {STARTER_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  className="agent-starter-btn"
                  onClick={() => send(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
            {msg.role === "user" ? (
              <div className="agent-user-bubble">{msg.text}</div>
            ) : (
              <div className="agent-response">
                {msg.tool && (
                  <span className="agent-tool-badge">
                    Used: {msg.tool}
                  </span>
                )}
                {msg.confidence != null && (
                  <span className="confidence-badge" style={{ marginLeft: msg.tool ? 8 : 0 }}>
                    <span className="confidence-value">{msg.confidence}%</span>
                    <span className="confidence-label">grounded</span>
                  </span>
                )}
                <div className="result-card" style={{ marginTop: msg.tool ? 10 : 0 }}>
                  <AIContentRenderer text={msg.text} />
                </div>
                {msg.jobs && msg.jobs.length > 0 && (
                  <div className="agent-jobs-preview">
                    <p className="agent-jobs-label">{msg.jobs.length} jobs found — top matches:</p>
                    {msg.jobs.slice(0, 3).map((j, k) => (
                      <div key={k} className="agent-job-row">
                        <div className="agent-job-info">
                          <span className="agent-job-title">{j.title}</span>
                          <span className="agent-job-company">{j.company}</span>
                        </div>
                        {j.salary_range && j.salary_range !== "Not specified" && (
                          <span className="agent-job-salary">{j.salary_range}</span>
                        )}
                        {j.redirect_url && (
                          <a href={j.redirect_url} target="_blank" rel="noopener noreferrer" className="job-apply-btn">Apply</a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="agent-sources">
                    {msg.sources.slice(0, 3).map((s, k) => (
                      <span key={k} className="source-chip">
                        <span className="source-title">{s.title}</span>
                        <span className="source-relevance">{Math.round(s.relevance * 100)}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="agent-msg agent-msg-agent">
            <div className="agent-thinking">
              <LoadingDots text="Thinking" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="agent-input-bar">
        <textarea
          className="agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={profile.skills ? "Ask anything about your career..." : "Set up your profile first for personalized results..."}
          rows={1}
        />
        <button
          className="agent-send-btn"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          <SparkleIcon /> Send
        </button>
      </div>
    </div>
  );
}
