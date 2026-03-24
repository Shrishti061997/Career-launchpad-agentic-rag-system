import React from "react";

// Renders inline markdown-like formatting (bold text)
function renderInline(str) {
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="ai-bold">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

// Renders AI response text with basic markdown formatting:
export default function AIContentRenderer({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="ai-list">
          {listBuffer.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={i} className="ai-h3">{line.slice(4)}</h4>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={i} className="ai-h2">{line.slice(3)}</h3>
      );
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={i} className="ai-h1">{line.slice(2)}</h2>
      );
    } else if (/^[-*•]\s/.test(line)) {
      listBuffer.push(line.replace(/^[-*•]\s/, ""));
    } else if (/^\d+\.\s/.test(line)) {
      listBuffer.push(line);
    } else if (line.trim() === "---") {
      flushList();
      elements.push(<hr key={i} className="ai-hr" />);
    } else if (line.trim() === "") {
      flushList();
      elements.push(<div key={i} className="ai-spacer" />);
    } else {
      flushList();
      elements.push(
        <p key={i} className="ai-paragraph">{renderInline(line)}</p>
      );
    }
  }

  flushList();

  return <div className="ai-content">{elements}</div>;
}
