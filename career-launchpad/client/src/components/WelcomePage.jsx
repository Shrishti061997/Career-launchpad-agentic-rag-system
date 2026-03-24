import { useState, useEffect } from "react";

export default function WelcomePage({ onEnter }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="welcome-page" style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s" }}>
      {/* Nav */}
      <nav className="welcome-nav">
        <div className="welcome-nav-logo">
          <div style={{
            width: 32, height: 32, background: "var(--text)",
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 15
          }}>L</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>Career Launchpad</span>
        </div>
        <button className="welcome-nav-btn" onClick={onEnter}>Get started</button>
      </nav>

      {/* Hero */}
      <div className="welcome-hero">
        <span className="welcome-hero-badge">AI-powered career tools</span>
        <h1 className="welcome-hero-title">
          Your next job,<br />found smarter.
        </h1>
        <p className="welcome-hero-sub">
          See what you qualify for today. Simulate who you could be tomorrow. Build the proof, write the message, land the job.
        </p>
        <button className="welcome-cta" onClick={onEnter}>
          Start exploring <span className="welcome-cta-arrow">→</span>
        </button>
      </div>

      {/* Illustration */}
      <div className="welcome-illustration">
        <svg viewBox="0 0 480 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Background shapes */}
          <rect x="0" y="40" width="480" height="140" rx="16" fill="#f7f3ec" />

          {/* Resume document */}
          <rect x="40" y="55" width="80" height="105" rx="6" fill="#ffffff" stroke="#ede8df" strokeWidth="1.5" />
          <rect x="52" y="70" width="36" height="4" rx="2" fill="#ddd6ca" />
          <rect x="52" y="80" width="56" height="3" rx="1.5" fill="#ede8df" />
          <rect x="52" y="88" width="48" height="3" rx="1.5" fill="#ede8df" />
          <rect x="52" y="96" width="52" height="3" rx="1.5" fill="#ede8df" />
          <rect x="52" y="108" width="30" height="4" rx="2" fill="#ddd6ca" />
          <rect x="52" y="118" width="56" height="3" rx="1.5" fill="#ede8df" />
          <rect x="52" y="126" width="44" height="3" rx="1.5" fill="#ede8df" />
          <rect x="52" y="134" width="50" height="3" rx="1.5" fill="#ede8df" />
          <text x="80" y="48" textAnchor="middle" fontSize="11" fontWeight="600" fill="#8a8478">Resume</text>

          {/* Arrow 1 */}
          <path d="M130 108 L165 108" stroke="#c07832" strokeWidth="2" strokeDasharray="4 3" />
          <polygon points="165,104 173,108 165,112" fill="#c07832" />

          {/* AI brain circle */}
          <circle cx="210" cy="108" r="34" fill="#ffffff" stroke="#ede8df" strokeWidth="1.5" />
          <text x="210" y="100" textAnchor="middle" fontSize="22" fill="#c07832">⚡</text>
          <text x="210" y="118" textAnchor="middle" fontSize="10" fontWeight="600" fill="#8a8478">AI</text>
          <text x="210" y="48" textAnchor="middle" fontSize="11" fontWeight="600" fill="#8a8478">Analyze</text>

          {/* Arrow 2 */}
          <path d="M248 108 L283 108" stroke="#c07832" strokeWidth="2" strokeDasharray="4 3" />
          <polygon points="283,104 291,108 283,112" fill="#c07832" />

          {/* Job cards stack */}
          <rect x="300" y="65" width="140" height="36" rx="6" fill="#ffffff" stroke="#ede8df" strokeWidth="1.5" />
          <rect x="312" y="74" width="60" height="4" rx="2" fill="#2c2a25" />
          <rect x="312" y="84" width="40" height="3" rx="1.5" fill="#5a8f3e" />
          <rect x="390" y="74" width="38" height="16" rx="8" fill="#f7f3ec" stroke="#ede8df" strokeWidth="1" />
          <text x="409" y="85" textAnchor="middle" fontSize="8" fontWeight="600" fill="#5a8f3e">$140K</text>

          <rect x="300" y="108" width="140" height="36" rx="6" fill="#ffffff" stroke="#ede8df" strokeWidth="1.5" />
          <rect x="312" y="117" width="52" height="4" rx="2" fill="#2c2a25" />
          <rect x="312" y="127" width="36" height="3" rx="1.5" fill="#5a8f3e" />
          <rect x="390" y="117" width="38" height="16" rx="8" fill="#f7f3ec" stroke="#ede8df" strokeWidth="1" />
          <text x="409" y="128" textAnchor="middle" fontSize="8" fontWeight="600" fill="#5a8f3e">$155K</text>

          <text x="370" y="48" textAnchor="middle" fontSize="11" fontWeight="600" fill="#8a8478">Real matches</text>

          {/* Decorative dots */}
          <circle cx="30" cy="175" r="3" fill="#ede8df" />
          <circle cx="450" cy="60" r="3" fill="#ede8df" />
          <circle cx="240" cy="175" r="2" fill="#ede8df" />
        </svg>
      </div>

      {/* Features */}
      <div className="welcome-features">
        {[
          { num: "01", title: "Job Matches", desc: "Real jobs ranked by AI based on your resume." },
          { num: "02", title: "Skill Simulator", desc: "See how new skills change your job prospects." },
          { num: "03", title: "Portfolio Builder", desc: "Project roadmap tailored to your target role." },
          { num: "04", title: "Job Intelligence", desc: "Ask questions, get answers grounded in real data." },
        ].map((f, i) => (
          <div key={i} className="welcome-feature">
            <span className="welcome-feature-num">{f.num}</span>
            <div className="welcome-feature-title">{f.title}</div>
            <div className="welcome-feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
