import React from "react";

// Icônes au trait, à la taille et à la couleur du texte qui les entoure (1em, currentColor)
function Icone({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block ${className}`}
    >
      {children}
    </svg>
  );
}

export function IconeJoueur({ className }) {
  return (
    <Icone className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </Icone>
  );
}

export function IconeAjoutJoueur({ className }) {
  return (
    <Icone className={className}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <path d="M19 8v6M16 11h6" />
    </Icone>
  );
}

export function IconeLoupe({ className }) {
  return (
    <Icone className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Icone>
  );
}
