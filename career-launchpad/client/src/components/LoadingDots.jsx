import { useState, useEffect } from "react";

export default function LoadingDots({ text = "Thinking" }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-dots">
      <div className="pulse-orb" />
      <span>{text}{dots}</span>
    </div>
  );
}
