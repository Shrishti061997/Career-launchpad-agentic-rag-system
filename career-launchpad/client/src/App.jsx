import { useState, useEffect } from "react";
import { CompassIcon, PortfolioIcon, OutreachIcon, DatabaseIcon, SimulatorIcon, UserIcon, AgentIcon } from "./components/Icons.jsx";
import { ProfileProvider, useProfile } from "./components/ProfileContext.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import CareerCompass from "./components/CareerCompass.jsx";
import PortfolioBuilder from "./components/PortfolioBuilder.jsx";
import OutreachAssistant from "./components/OutreachAssistant.jsx";
import JobIntelligence from "./components/JobIntelligence.jsx";
import SkillSimulator from "./components/SkillSimulator.jsx";
import AgentChat from "./components/AgentChat.jsx";
import WelcomePage from "./components/WelcomePage.jsx";

const TABS = [
  { label: "Agent", icon: <AgentIcon />, component: <AgentChat /> },
  { label: "Job Matches", icon: <CompassIcon />, component: <CareerCompass /> },
  { label: "Portfolio", icon: <PortfolioIcon />, component: <PortfolioBuilder /> },
  { label: "Outreach", icon: <OutreachIcon />, component: <OutreachAssistant /> },
  { label: "Intelligence", icon: <DatabaseIcon />, component: <JobIntelligence /> },
  { label: "Skill Sim", icon: <SimulatorIcon />, component: <SkillSimulator /> },
];

function AppInner() {
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { profile, profiles, activeIndex, setShowPanel, getProfileLabel } = useProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = getProfileLabel(profile, activeIndex);
  const filledCount = profiles.filter((p) => !!(p.name || p.skills)).length;

  return (
    <div className={`app-root ${mounted ? "mounted" : ""}`}>
      <header className="header">
        <div className="logo-row">
          <div className="logo-icon">L</div>
          <span className="logo-text">Career Launchpad</span>
        </div>
        <p className="header-sub">
          AI-powered tools to discover, build, and network your way into your dream job
        </p>
      </header>

      <nav className="tab-bar">
        {TABS.map((tab, i) => (
          <button
            key={i}
            className={`tab-btn ${activeTab === i ? "active" : ""}`}
            onClick={() => setActiveTab(i)}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
        <button
          className="profile-btn"
          onClick={() => setShowPanel(true)}
        >
          <UserIcon />
          <span className="tab-label">{displayName}</span>
          {filledCount > 0 && (
            <span className="profile-count">{filledCount}/5</span>
          )}
          {!profile.skills && <span className="profile-dot" />}
        </button>
      </nav>

      <main key={activeIndex}>
        {TABS.map((tab, i) => (
          <div key={i} style={{ display: activeTab === i ? "block" : "none" }}>
            {tab.component}
          </div>
        ))}
      </main>

      <footer className="footer">
        Powered by NVIDIA NIM + RAG &middot; Your career, found smarter
      </footer>

      <ProfilePanel />
    </div>
  );
}

export default function App() {
  const [entered, setEntered] = useState(() => {
    try { return localStorage.getItem("career-launchpad-entered") === "true"; } catch { return false; }
  });

  const handleEnter = () => {
    setEntered(true);
    try { localStorage.setItem("career-launchpad-entered", "true"); } catch {}
  };

  if (!entered) {
    return <WelcomePage onEnter={handleEnter} />;
  }

  return (
    <ProfileProvider>
      <AppInner />
    </ProfileProvider>
  );
}
