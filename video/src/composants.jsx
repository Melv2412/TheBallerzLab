import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { couleurs, polices } from './theme';

// Fond commun : photo assombrie qui zoome lentement + halos orange/violet comme dans l'appli
export const Fond = ({ image, opacite = 0.28 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.08, 1.18]);
  return (
    <AbsoluteFill style={{ backgroundColor: couleurs.noir }}>
      {image && (
        <Img
          src={staticFile(`images/${image}`)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: opacite, transform: `scale(${zoom})`, filter: 'grayscale(35%) contrast(1.1)',
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 15% 20%, rgba(255,107,0,0.22) 0%, transparent 45%),
                       radial-gradient(circle at 85% 85%, rgba(139,92,246,0.20) 0%, transparent 45%),
                       linear-gradient(180deg, rgba(17,17,17,0.35) 0%, rgba(17,17,17,0.9) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Apparition avec ressort (0 → 1) à partir d'une image donnée
export const useApparition = (debut = 0, config = { damping: 14, mass: 0.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - debut, fps, config });
};

// Fondu d'entrée/sortie de chaque scène
export const TransitionScene = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacite = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const echelle = interpolate(frame, [0, 10], [1.04, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: opacite, transform: `scale(${echelle})` }}>{children}</AbsoluteFill>;
};

export const Logo = ({ taille = 140, style }) => (
  <div
    style={{
      fontFamily: polices.texte, fontWeight: 900, fontStyle: 'italic', fontSize: taille,
      letterSpacing: '-0.05em', color: couleurs.blanc, textTransform: 'uppercase', lineHeight: 1, ...style,
    }}
  >
    THE <span style={{ color: couleurs.orange }}>LAB</span>
  </div>
);

// Petit titre de section, barre orange à gauche comme .card-title-accent
export const Surtitre = ({ children, debut = 0 }) => {
  const p = useApparition(debut);
  return (
    <div
      style={{
        fontFamily: polices.titre, fontWeight: 700, fontSize: 30, letterSpacing: '0.25em',
        color: couleurs.orange, textTransform: 'uppercase', borderLeft: `6px solid ${couleurs.orange}`,
        paddingLeft: 18, opacity: p, transform: `translateX(${(1 - p) * -40}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const GrandTitre = ({ children, debut = 0, taille = 104 }) => {
  const p = useApparition(debut, { damping: 12 });
  return (
    <div
      style={{
        fontFamily: polices.texte, fontWeight: 900, fontStyle: 'italic', fontSize: taille, lineHeight: 0.95,
        letterSpacing: '-0.04em', color: couleurs.blanc, textTransform: 'uppercase',
        opacity: p, transform: `translateY(${(1 - p) * 60}px)`,
      }}
    >
      {children}
    </div>
  );
};

export const CarteVerre = ({ children, style }) => (
  <div
    style={{
      background: couleurs.verre, border: `1px solid ${couleurs.bordure}`, borderRadius: 28,
      boxShadow: '0 25px 70px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', ...style,
    }}
  >
    {children}
  </div>
);

// Ballon de basket en SVG
export const Ballon = ({ taille = 160, rotation = 0, style }) => (
  <svg width={taille} height={taille} viewBox="0 0 64 64" style={{ transform: `rotate(${rotation}deg)`, ...style }}>
    <defs>
      <radialGradient id="ballon" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ff9a3d" />
        <stop offset="100%" stopColor="#d45400" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#ballon)" stroke="#1a1a1a" strokeWidth="2.2" />
    <path
      d="M2 32h60M32 2v60M11 11c10 8 10 34 0 42M53 11c-10 8-10 34 0 42"
      fill="none" stroke="#1a1a1a" strokeWidth="2.2"
    />
  </svg>
);
