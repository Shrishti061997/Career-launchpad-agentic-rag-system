import { createContext, useContext, useState, useEffect } from "react";

const ProfileContext = createContext(null);

const STORAGE_KEY = "career-launchpad-profiles";
const INDEX_KEY = "career-launchpad-active";

const EMPTY_PROFILE = {
  name: "",
  skills: "",
  interests: "",
  education: "",
  about: "",
  country: "us",
  resumeText: "",
  resumeFileName: "",
};

const INITIAL_PROFILES = [
  { ...EMPTY_PROFILE },
  { ...EMPTY_PROFILE },
  { ...EMPTY_PROFILE },
  { ...EMPTY_PROFILE },
  { ...EMPTY_PROFILE },
];

function loadProfiles() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 5) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_PROFILES;
}

function loadActiveIndex() {
  try {
    const saved = localStorage.getItem(INDEX_KEY);
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      if (idx >= 0 && idx < 5) return idx;
    }
  } catch {}
  return 0;
}

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState(loadProfiles);
  const [activeIndex, setActiveIndex] = useState(loadActiveIndex);
  const [showPanel, setShowPanel] = useState(false);

  // Save to localStorage whenever profiles or activeIndex change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch {}
  }, [profiles]);

  useEffect(() => {
    try {
      localStorage.setItem(INDEX_KEY, String(activeIndex));
    } catch {}
  }, [activeIndex]);

  const profile = profiles[activeIndex];

  const updateField = (field, value) => {
    setProfiles((prev) => {
      const updated = [...prev];
      updated[activeIndex] = { ...updated[activeIndex], [field]: value };
      return updated;
    });
  };

  const switchProfile = (index) => {
    setActiveIndex(index);
  };

  const clearProfile = (index) => {
    setProfiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...EMPTY_PROFILE };
      return updated;
    });
  };

  const getProfileLabel = (p, i) => {
    if (p.name) return p.name.split(" ")[0];
    if (p.skills) return `Profile ${i + 1}`;
    return `Slot ${i + 1}`;
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        profiles,
        activeIndex,
        updateField,
        switchProfile,
        clearProfile,
        getProfileLabel,
        showPanel,
        setShowPanel,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
