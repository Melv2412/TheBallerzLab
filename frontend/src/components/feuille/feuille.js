// Calculs de la feuille de match à partir des stats et de l'historique (sans React, testables)

export const evaluationStat = (s) => s.points + s.passes + s.rebonds + s.contres - s.fautes;

const actionsValides = (actions) => actions.filter((a) => !a.annulee);

// Points marqués par chaque équipe à chaque période : { periodes: [1, 2, ...], domicile: [..], exterieur: [..] }
export const scoreParPeriode = (actions, nbPeriodes, periodeActuelle = 1) => {
  const valides = actionsValides(actions).filter((a) => a.type === "stat" && a.champ === "points");
  const derniere = Math.max(nbPeriodes, periodeActuelle, ...valides.map((a) => a.periode));
  const periodes = Array.from({ length: derniere }, (_, i) => i + 1);
  const total = (cote, periode) =>
    valides.filter((a) => a.cote === cote && a.periode === periode).reduce((somme, a) => somme + a.valeur, 0);
  return {
    periodes,
    domicile: periodes.map((p) => total("domicile", p)),
    exterieur: periodes.map((p) => total("exterieur", p)),
  };
};

// Fautes d'équipe par période et temps morts pris, d'après l'historique
export const fautesEtTempsMorts = (actions, cote, periodes) => {
  const valides = actionsValides(actions).filter((a) => a.cote === cote);
  return {
    fautes: periodes.map((p) =>
      valides.filter((a) => a.type === "stat" && a.champ === "fautes" && a.periode === p).reduce((s, a) => s + a.valeur, 0),
    ),
    tempsMorts: valides.filter((a) => a.type === "temps_mort").length,
  };
};

export const totauxEquipe = (stats) =>
  stats.reduce(
    (t, s) => ({
      points: t.points + s.points,
      passes: t.passes + s.passes,
      rebonds: t.rebonds + s.rebonds,
      contres: t.contres + s.contres,
      fautes: t.fautes + s.fautes,
    }),
    { points: 0, passes: 0, rebonds: 0, contres: 0, fautes: 0 },
  );

// Libellé court d'une période sur la feuille : Q1..Q4 (ou P1..), puis PR1, PR2...
export const enTetePeriode = (periode, nbPeriodes) =>
  periode > nbPeriodes ? `PR${periode - nbPeriodes}` : `${nbPeriodes === 4 ? "Q" : "P"}${periode}`;
