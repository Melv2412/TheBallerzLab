import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { couleurs, polices } from './theme';
import { Ballon, CarteVerre, Fond, GrandTitre, Logo, Surtitre, useApparition } from './composants';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

// 1. Intro : le ballon tombe, rebondit, puis le logo claque à l'écran
export const SceneIntro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chute = spring({ frame, fps, config: { damping: 7, mass: 0.9, stiffness: 120 } });
  const yBallon = interpolate(chute, [0, 1], [-700, 0]);
  const sortieBallon = interpolate(frame, [18, 30], [1, 0], clamp);
  const logo = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 160 } });
  const trait = interpolate(frame, [30, 48], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sousTitre = spring({ frame: frame - 36, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill>
      <Fond image="streetball-calm.jpg" opacite={0.22} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', transform: `translateY(${yBallon}px) scale(${sortieBallon})`, opacity: sortieBallon }}>
          <Ballon taille={220} rotation={frame * 9} />
        </div>
        <div style={{ textAlign: 'center', transform: `scale(${interpolate(logo, [0, 1], [2.4, 1])})`, opacity: logo }}>
          <Logo taille={230} />
          <div
            style={{
              height: 10, background: couleurs.orange, borderRadius: 5, margin: '24px auto 0',
              width: `${trait * 100}%`, boxShadow: `0 0 30px ${couleurs.orange}`,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute', top: 700, fontFamily: polices.titre, fontWeight: 600, fontSize: 40,
            letterSpacing: '0.35em', color: couleurs.gris, textTransform: 'uppercase',
            opacity: sousTitre, transform: `translateY(${(1 - sousTitre) * 30}px)`,
          }}
        >
          Tournois de basket · Stats en direct
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 2. Le problème : des feuilles de match qui s'empilent dans le désordre
const FEUILLES = [
  { x: -560, y: -170, r: -14, titre: 'Feuille de match', ligne: 'A 48 – 52 B ?', d: 4 },
  { x: 470, y: -230, r: 11, titre: 'Fautes', ligne: '#7  ✕ ✕ ✕ ✕ ?', d: 12 },
  { x: -430, y: 230, r: 8, titre: 'Classement', ligne: 'Poule A… ou B ?', d: 20 },
  { x: 520, y: 200, r: -9, titre: 'Stats', ligne: 'Rebonds : ???', d: 28 },
  { x: 0, y: 290, r: 3, titre: 'Chrono', ligne: '08:4? / 24 s', d: 36 },
];

export const SceneProbleme = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Fond image="team-official.jpg" opacite={0.18} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {FEUILLES.map((f) => {
          const p = spring({ frame: frame - f.d, fps, config: { damping: 11 } });
          const flottement = Math.sin((frame + f.d * 7) / 14) * 8;
          return (
            <div
              key={f.titre}
              style={{
                position: 'absolute', width: 380, padding: '26px 30px', background: '#f4efe6', borderRadius: 6,
                boxShadow: '0 20px 50px rgba(0,0,0,0.55)', color: '#222', fontFamily: polices.texte,
                opacity: p,
                transform: `translate(${f.x * p}px, ${f.y * p + flottement}px) rotate(${f.r * p}deg) scale(${0.6 + 0.4 * p})`,
              }}
            >
              <div style={{ fontFamily: polices.titre, fontWeight: 700, fontSize: 30, textTransform: 'uppercase', borderBottom: '2px solid #bbb', paddingBottom: 8 }}>
                {f.titre}
              </div>
              <div style={{ fontSize: 30, marginTop: 14, fontStyle: 'italic', color: '#b42318' }}>{f.ligne}</div>
              <div style={{ height: 10, background: '#ddd', marginTop: 16, width: '85%' }} />
              <div style={{ height: 10, background: '#ddd', marginTop: 10, width: '60%' }} />
            </div>
          );
        })}
        <div style={{ textAlign: 'center', zIndex: 2 }}>
          <Surtitre debut={2}>Le problème</Surtitre>
          <div style={{ height: 20 }} />
          <GrandTitre debut={10} taille={120}>
            Trop de <span style={{ color: couleurs.orange }}>papier.</span>
          </GrandTitre>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 3. Le tournoi : équipes qui arrivent puis tableau final qui se dessine
const EQUIPES = ['Lions', 'Panthers', 'Hornets', 'Wolves', 'Falcons', 'Titans', 'Sharks', 'Bulls'];

const Pastille = ({ nom, debut }) => {
  const p = useApparition(debut);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderRadius: 16,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        opacity: p, transform: `translateX(${(1 - p) * 50}px)`,
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${couleurs.orange}, ${couleurs.violet})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: polices.titre, fontWeight: 700, fontSize: 24, color: '#fff',
        }}
      >
        {nom[0]}
      </div>
      <div style={{ fontFamily: polices.titre, fontWeight: 600, fontSize: 30, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {nom}
      </div>
    </div>
  );
};

export const SceneTournoi = () => {
  const frame = useCurrentFrame();
  const trace = (debut) => interpolate(frame, [debut, debut + 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const tours = [
    { x: 0, cases: 4, debut: 70, label: 'Quarts' },
    { x: 1, cases: 2, debut: 92, label: 'Demis' },
    { x: 2, cases: 1, debut: 114, label: 'Finale' },
  ];
  return (
    <AbsoluteFill>
      <Fond image="team-official.jpg" opacite={0.2} />
      <AbsoluteFill style={{ padding: '110px 130px', flexDirection: 'row', gap: 70 }}>
        <div style={{ width: 640 }}>
          <Surtitre>Crée ton tournoi</Surtitre>
          <div style={{ height: 22 }} />
          <GrandTitre debut={6} taille={96}>Interpromo</GrandTitre>
          <div style={{ fontFamily: polices.digital, fontSize: 26, color: couleurs.gris, marginTop: 18, opacity: useApparition(12) }}>
            22/01/2026 — 23/01/2026
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 40 }}>
            {EQUIPES.map((nom, i) => <Pastille key={nom} nom={nom} debut={16 + i * 6} />)}
          </div>
        </div>
        <CarteVerre style={{ flex: 1, padding: 44, display: 'flex', gap: 40, opacity: useApparition(60) }}>
          {tours.map((tour) => (
            <div key={tour.label} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontFamily: polices.titre, fontWeight: 700, fontSize: 26, color: couleurs.orange, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
                {tour.label}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                {Array.from({ length: tour.cases }).map((_, i) => {
                  const p = trace(tour.debut + i * 4);
                  const finale = tour.cases === 1;
                  return (
                    <div
                      key={i}
                      style={{
                        height: 86, borderRadius: 14, position: 'relative', overflow: 'hidden',
                        border: `2px solid ${finale ? couleurs.jaune : 'rgba(255,255,255,0.15)'}`,
                        boxShadow: finale ? `0 0 ${40 * p}px rgba(255,215,0,0.45)` : 'none', opacity: p,
                      }}
                    >
                      <div style={{ position: 'absolute', inset: 0, width: `${p * 100}%`, background: finale ? 'rgba(255,215,0,0.12)' : 'rgba(255,107,0,0.12)' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: polices.titre, fontSize: 28, color: '#fff', textTransform: 'uppercase' }}>
                        {finale ? '🏆 Champion' : 'Match ' + (i + 1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CarteVerre>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 4. Le live : table de marque avec chrono, shot clock, score et fautes
const Chiffres = ({ children, taille, couleur = '#fff', style }) => (
  <div style={{ fontFamily: polices.digital, fontWeight: 900, fontSize: taille, color: couleur, letterSpacing: '0.04em', ...style }}>{children}</div>
);

const scoreA = (f) => 52 + (f > 60 ? 2 : 0) + (f > 120 ? 3 : 0);
const scoreB = (f) => 49 + (f > 90 ? 2 : 0) + (f > 150 ? 1 : 0);

export const SceneLive = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entree = useApparition(0, { damping: 13 });
  const secondes = Math.max(0, 6 * 60 + 12 - Math.floor(frame / fps));
  const chrono = `${String(Math.floor(secondes / 60)).padStart(2, '0')}:${String(secondes % 60).padStart(2, '0')}`;
  // Remis à 24 après le panier à 3 points (image 120)
  const shotClock = Math.max(0, 24 - Math.floor((frame < 120 ? frame : frame - 120) / fps));
  // Petit "pop" quand le score change
  const pop = (seuils) => seuils.reduce((acc, s) => acc + spring({ frame: frame - s, fps, config: { damping: 8 } }) * (frame >= s && frame < s + 20 ? 1 : 0), 0);
  const fautesB = frame > 100 ? 4 : 3;
  const live = 0.5 + 0.5 * Math.sin(frame / 4);

  const Equipe = ({ nom, score, popEchelle, fautes, timeouts, cote }) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontFamily: polices.titre, fontWeight: 700, fontSize: 52, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{nom}</div>
      <Chiffres taille={190} couleur={cote === 'A' ? couleurs.orange : '#fff'} style={{ transform: `scale(${1 + popEchelle * 0.18})`, margin: '6px 0' }}>
        {score}
      </Chiffres>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 6 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ width: 22, height: 22, borderRadius: 11, background: i < fautes ? '#ef4444' : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
      <div style={{ fontFamily: polices.titre, fontSize: 24, color: couleurs.gris, marginTop: 14, letterSpacing: '0.2em' }}>
        FAUTES · TEMPS MORTS {timeouts}
      </div>
    </div>
  );

  return (
    <AbsoluteFill>
      <Fond image="action-game.jpg" opacite={0.25} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: entree }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: '#ef4444', opacity: live, boxShadow: '0 0 20px #ef4444' }} />
          <Surtitre>Table de marque en direct</Surtitre>
        </div>
        <CarteVerre style={{ width: 1500, padding: '50px 60px', transform: `translateY(${(1 - entree) * 80}px)`, opacity: entree }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Equipe nom="Lions" score={scoreA(frame)} popEchelle={pop([61, 121])} fautes={2} timeouts={3} cote="A" />
            <div style={{ width: 420, textAlign: 'center' }}>
              <div style={{ fontFamily: polices.titre, fontSize: 30, color: couleurs.gris, letterSpacing: '0.3em' }}>3E QUART</div>
              <Chiffres taille={120} couleur={couleurs.jaune} style={{ margin: '10px 0' }}>{chrono}</Chiffres>
              <div style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 16, background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.5)' }}>
                <Chiffres taille={70} couleur="#ef4444">{String(shotClock).padStart(2, '0')}</Chiffres>
              </div>
              <div style={{ fontFamily: polices.titre, fontSize: 22, color: couleurs.gris, marginTop: 10, letterSpacing: '0.3em' }}>SHOT CLOCK</div>
            </div>
            <Equipe nom="Panthers" score={scoreB(frame)} popEchelle={pop([91, 151])} fautes={fautesB} timeouts={2} cote="B" />
          </div>
        </CarteVerre>
        <div style={{ display: 'flex', gap: 22, opacity: useApparition(24) }}>
          {['+1', '+2', '+3', 'REB', 'PASSE', 'CONTRE', 'FAUTE'].map((b, i) => {
            const actif = (frame > 55 + i * 12 && frame < 70 + i * 12);
            return (
              <div
                key={b}
                style={{
                  padding: '16px 30px', borderRadius: 14, fontFamily: polices.titre, fontWeight: 700, fontSize: 30, color: '#fff',
                  background: actif ? couleurs.orange : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  transform: `scale(${actif ? 1.08 : 1})`,
                }}
              >
                {b}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 5. Les stats : barres qui montent, puis classement avec le MVP
const JOUEURS = [
  { nom: 'K. Diallo', eq: 'Lions', eval: 31, pts: 24, reb: 9, pas: 6 },
  { nom: 'T. Martin', eq: 'Panthers', eval: 26, pts: 19, reb: 5, pas: 8 },
  { nom: 'S. Nguyen', eq: 'Hornets', eval: 22, pts: 14, reb: 11, pas: 3 },
];

export const SceneStats = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const compteur = (valeur, debut) => Math.round(valeur * interpolate(frame, [debut, debut + 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const stats = [
    { label: 'Points', valeur: 24, max: 30, couleur: couleurs.orange },
    { label: 'Rebonds', valeur: 9, max: 15, couleur: couleurs.violet },
    { label: 'Passes', valeur: 6, max: 12, couleur: couleurs.jaune },
  ];
  return (
    <AbsoluteFill>
      <Fond image="jordan-focus.jpg" opacite={0.22} />
      <AbsoluteFill style={{ padding: '120px 130px', flexDirection: 'row', gap: 80 }}>
        <div style={{ width: 700 }}>
          <Surtitre>Stats automatiques</Surtitre>
          <div style={{ height: 22 }} />
          <GrandTitre debut={4} taille={90}>Chaque action <span style={{ color: couleurs.orange }}>compte.</span></GrandTitre>
          <div style={{ marginTop: 50, display: 'flex', flexDirection: 'column', gap: 30 }}>
            {stats.map((s, i) => {
              const debut = 14 + i * 8;
              const v = compteur(s.valeur, debut);
              return (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: polices.titre, fontSize: 32, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <span>{s.label}</span>
                    <span style={{ fontFamily: polices.digital, color: s.couleur }}>{v}</span>
                  </div>
                  <div style={{ height: 18, borderRadius: 9, background: 'rgba(255,255,255,0.08)', marginTop: 10 }}>
                    <div style={{ height: '100%', borderRadius: 9, width: `${(v / s.max) * 100}%`, background: s.couleur, boxShadow: `0 0 20px ${s.couleur}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <CarteVerre style={{ flex: 1, padding: 46, alignSelf: 'center' }}>
          <div style={{ fontFamily: polices.titre, fontWeight: 700, fontSize: 30, color: couleurs.orange, letterSpacing: '0.2em', marginBottom: 24 }}>CLASSEMENT · ÉVALUATION</div>
          {JOUEURS.map((j, i) => {
            const p = spring({ frame: frame - (60 + i * 10), fps, config: { damping: 13 } });
            const mvp = i === 0;
            const badge = spring({ frame: frame - 100, fps, config: { damping: 8 } });
            return (
              <div
                key={j.nom}
                style={{
                  display: 'flex', alignItems: 'center', gap: 22, padding: '22px 26px', borderRadius: 18, marginBottom: 14,
                  background: mvp ? 'rgba(255,215,0,0.10)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${mvp ? 'rgba(255,215,0,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  opacity: p, transform: `translateX(${(1 - p) * 80}px)`,
                }}
              >
                <div style={{ fontFamily: polices.digital, fontSize: 40, color: mvp ? couleurs.jaune : couleurs.gris, width: 50 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: polices.titre, fontWeight: 700, fontSize: 36, color: '#fff', textTransform: 'uppercase' }}>{j.nom}</div>
                  <div style={{ fontFamily: polices.texte, fontSize: 22, color: couleurs.gris }}>{j.eq} · {j.pts} pts · {j.reb} reb · {j.pas} pas</div>
                </div>
                {mvp && (
                  <div
                    style={{
                      fontFamily: polices.titre, fontWeight: 700, fontSize: 26, color: '#111', background: couleurs.jaune,
                      padding: '8px 18px', borderRadius: 12, transform: `scale(${badge})`, letterSpacing: '0.1em',
                    }}
                  >
                    👑 MVP
                  </div>
                )}
                <div style={{ fontFamily: polices.digital, fontSize: 44, color: mvp ? couleurs.jaune : '#fff', width: 80, textAlign: 'right' }}>{j.eval}</div>
              </div>
            );
          })}
        </CarteVerre>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 6. Le public : téléphone qui affiche le score en direct
export const ScenePublic = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tel = spring({ frame, fps, config: { damping: 14 } });
  const notif = (debut) => spring({ frame: frame - debut, fps, config: { damping: 12 } });
  const live = 0.5 + 0.5 * Math.sin(frame / 4);
  const score = frame > 45 ? 59 : 57;
  const notifs = [
    { texte: '🏀 Diallo +2 · Lions 59 – 52', debut: 46, y: -150 },
    { texte: '⏱ Temps mort Panthers', debut: 70, y: 40 },
  ];
  return (
    <AbsoluteFill>
      <Fond image="streetball-calm.jpg" opacite={0.22} />
      <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: '0 150px', gap: 120 }}>
        <div style={{ width: 760 }}>
          <Surtitre>Pour le public</Surtitre>
          <div style={{ height: 22 }} />
          <GrandTitre debut={4} taille={100}>Suivi en <span style={{ color: couleurs.orange }}>temps réel.</span></GrandTitre>
          <div style={{ fontFamily: polices.texte, fontSize: 34, color: couleurs.gris, marginTop: 30, lineHeight: 1.4, opacity: useApparition(14) }}>
            Score, chrono et stats des joueurs, sur n'importe quel téléphone. Sans application à installer.
          </div>
        </div>
        <div style={{ position: 'relative', transform: `translateY(${(1 - tel) * 400}px) rotate(${(1 - tel) * 10}deg)`, opacity: tel }}>
          <div
            style={{
              width: 400, height: 800, borderRadius: 60, background: '#0b0b0b', border: '10px solid #2a2a2a',
              boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 80px rgba(255,107,0,0.15)', padding: 26, display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ width: 120, height: 26, borderRadius: 13, background: '#000', alignSelf: 'center', marginBottom: 30 }} />
            <Logo taille={46} style={{ textAlign: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: '#ef4444', opacity: live }} />
              <div style={{ fontFamily: polices.titre, fontSize: 22, color: '#ef4444', letterSpacing: '0.3em' }}>LIVE · 4E QUART</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 30, fontFamily: polices.titre, fontSize: 28, color: '#fff' }}>
              <span>LIONS</span><span>PANTHERS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6 }}>
              <Chiffres taille={84} couleur={couleurs.orange}>{score}</Chiffres>
              <Chiffres taille={84}>52</Chiffres>
            </div>
            <Chiffres taille={46} couleur={couleurs.jaune} style={{ textAlign: 'center', marginTop: 16 }}>
              {`02:${String(Math.max(0, 41 - Math.floor(frame / fps))).padStart(2, '0')}`}
            </Chiffres>
            <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Diallo · 28 pts', 'Martin · 21 pts', 'Nguyen · 16 pts'].map((l, i) => (
                <div key={l} style={{ padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', fontFamily: polices.texte, fontSize: 22, color: i === 0 ? couleurs.jaune : '#ddd' }}>
                  {l}
                </div>
              ))}
            </div>
          </div>
          {notifs.map((n) => {
            const p = notif(n.debut);
            return (
              <div
                key={n.texte}
                style={{
                  position: 'absolute', left: 350, top: 330 + n.y, padding: '20px 28px', borderRadius: 20,
                  background: 'rgba(30,30,30,0.92)', border: `1px solid ${couleurs.bordure}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                  fontFamily: polices.texte, fontWeight: 700, fontSize: 26, color: '#fff', whiteSpace: 'nowrap',
                  opacity: p, transform: `translateX(${(1 - p) * 60}px) scale(${0.8 + 0.2 * p})`,
                }}
              >
                {n.texte}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 7. Outro : logo + slogan
export const SceneOutro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 11 } });
  const slogan = spring({ frame: frame - 14, fps, config: { damping: 14 } });
  const halo = 0.6 + 0.4 * Math.sin(frame / 10);
  return (
    <AbsoluteFill>
      <Fond image="action-game.jpg" opacite={0.16} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: 450, background: `radial-gradient(circle, rgba(255,107,0,${0.22 * halo}) 0%, transparent 65%)` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 40, transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`, opacity: logo }}>
          <Ballon taille={170} rotation={frame * 2} />
          <Logo taille={220} />
        </div>
        <div
          style={{
            marginTop: 40, fontFamily: polices.titre, fontWeight: 700, fontSize: 64, color: '#fff', textTransform: 'uppercase',
            letterSpacing: '0.12em', opacity: slogan, transform: `translateY(${(1 - slogan) * 30}px)`,
          }}
        >
          Ton terrain, <span style={{ color: couleurs.orange }}>tes règles.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
