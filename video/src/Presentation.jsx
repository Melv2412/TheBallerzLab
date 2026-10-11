import React from 'react';
import { AbsoluteFill, Audio, Sequence, Series, interpolate, staticFile, useCurrentFrame } from 'remotion';
import voix from './voix.json';
import { FPS, MARGE_APRES, MARGE_AVANT, couleurs, polices } from './theme';
import { TransitionScene } from './composants';
import { SceneIntro, SceneLive, SceneOutro, SceneProbleme, ScenePublic, SceneStats, SceneTournoi } from './scenes';

const COMPOSANTS = {
  intro: SceneIntro,
  probleme: SceneProbleme,
  tournoi: SceneTournoi,
  live: SceneLive,
  stats: SceneStats,
  public: ScenePublic,
  outro: SceneOutro,
};

// La durée de chaque scène suit celle de sa voix off (voir scripts/generer_voix.py)
export const scenes = voix.scenes.map((s) => ({
  ...s,
  dureeVoix: Math.ceil(s.duree * FPS),
  duree: Math.ceil(s.duree * FPS) + MARGE_AVANT + MARGE_APRES,
}));

export const dureeTotale = scenes.reduce((total, s) => total + s.duree, 0);

// Découpe le texte sur la ponctuation (puis par 8 mots max), affiché au prorata de la longueur
const decouper = (texte, motsMax = 8) =>
  texte
    .split(/(?<=[,.:])\s+/)
    .flatMap((phrase) => {
      const mots = phrase.split(' ');
      const morceaux = [];
      for (let i = 0; i < mots.length; i += motsMax) morceaux.push(mots.slice(i, i + motsMax).join(' '));
      return morceaux;
    });

const SousTitres = ({ texte, dureeVoix }) => {
  const frame = useCurrentFrame();
  const morceaux = decouper(texte);
  const total = morceaux.reduce((n, m) => n + m.length, 0);
  let debut = 0;
  const plages = morceaux.map((m) => {
    const fin = debut + (m.length / total) * dureeVoix;
    const plage = { texte: m, debut, fin };
    debut = fin;
    return plage;
  });
  const actuel = plages.find((p) => frame >= p.debut && frame < p.fin) ?? (frame >= dureeVoix ? plages[plages.length - 1] : null);
  if (!actuel || frame > dureeVoix + 10) return null;
  const opacite = interpolate(frame, [actuel.debut, actuel.debut + 4], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70 }}>
      <div
        style={{
          fontFamily: polices.texte, fontWeight: 700, fontSize: 40, color: couleurs.blanc, textAlign: 'center',
          background: 'rgba(0,0,0,0.6)', padding: '12px 30px', borderRadius: 14, maxWidth: 1500, opacity: opacite,
        }}
      >
        {actuel.texte}
      </div>
    </AbsoluteFill>
  );
};

export const Presentation = ({ sousTitres }) => (
  <AbsoluteFill style={{ backgroundColor: couleurs.noir }}>
    <Series>
      {scenes.map((s) => {
        const Scene = COMPOSANTS[s.id];
        return (
          <Series.Sequence key={s.id} durationInFrames={s.duree} name={s.id}>
            <TransitionScene>
              <Scene />
            </TransitionScene>
            <Sequence from={MARGE_AVANT} name={`voix-${s.id}`}>
              <Audio src={staticFile(s.audio)} />
              {sousTitres && <SousTitres texte={s.texte} dureeVoix={s.dureeVoix} />}
            </Sequence>
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
