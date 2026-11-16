import React from "react";

// Terrain de basket vu de dessus : ligne médiane, cercle central, raquettes et arceaux
export function IconeTerrain({ className = "w-6 h-5" }) {
  return (
    <svg viewBox="0 0 48 32" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="29" rx="2" />
      <line x1="24" y1="1.5" x2="24" y2="30.5" />
      <circle cx="24" cy="16" r="4.5" />
      <rect x="1.5" y="10" width="8" height="12" />
      <rect x="38.5" y="10" width="8" height="12" />
      <path d="M9.5 9.5a7 7 0 0 1 0 13" />
      <path d="M38.5 9.5a7 7 0 0 0 0 13" />
      <circle cx="4.5" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="43.5" cy="16" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
