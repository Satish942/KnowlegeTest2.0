import React from 'react';

interface Props {
  text: string;
  searchTerm?: string;
}

/** Splits explanation text on [[IMG:...]] markers, then renders text with proper newline handling. */
const ExplanationRenderer: React.FC<Props> = ({ text, searchTerm }) => {
  if (!text) return null;

  const highlight = (str: string): React.ReactNode => {
    if (!searchTerm?.trim()) return str;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const segments = str.split(new RegExp(`(${escaped})`, 'gi'));
    return segments.map((seg, i) =>
      seg.toLowerCase() === searchTerm.toLowerCase()
        ? <mark key={i} className="search-highlight">{seg}</mark>
        : seg
    );
  };

  // Split on image markers first
  const parts = text.split(/(\[\[IMG:[^\]]*\]\])/g);

  return (
    <>
      {parts.map((part, i) => {
        const imgMatch = part.match(/^\[\[IMG:(.+)\]\]$/s);
        if (imgMatch) {
          return (
            <img
              key={i}
              src={imgMatch[1]}
              alt="explanation diagram"
              className="explanation-img"
            />
          );
        }
        // Split text on newlines and render each line as a paragraph
        const lines = part.split(/\r?\n/);
        return (
          <div key={i} className="text-left max-w-3xl">
            {lines.map((line, j) => (
              <p key={j} className="mb-2">
                {highlight(line)}
              </p>
            ))}
          </div>
        );
      })}
    </>
  );
};

export default ExplanationRenderer;
