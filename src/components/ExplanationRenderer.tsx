import React from 'react';

interface Props {
  text: string;
  searchTerm?: string; // optional: highlight a search term
}

/** Splits explanation text on [[IMG:...]] markers and renders text + images. */
const ExplanationRenderer: React.FC<Props> = ({ text, searchTerm }) => {
  if (!text) return null;

  const parts = text.split(/(\[\[IMG:[^\]]*\]\])/g);

  const highlight = (str: string): React.ReactNode => {
    if (!searchTerm?.trim()) return str;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const segments = str.split(new RegExp(`(${escaped})`, 'gi'));
    return segments.map((seg, i) =>
      seg.toLowerCase() === searchTerm.toLowerCase()
        ? <mark key={i} className="search-highlight">{seg}</mark>
        : seg
    );
  };

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
        return <span key={i}>{highlight(part)}</span>;
      })}
    </>
  );
};

export default ExplanationRenderer;
