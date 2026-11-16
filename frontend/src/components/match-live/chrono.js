// Logique pure du tableau de marque (sans React) : facile à relire et à tester.

// Le serveur renvoie l'état du chrono au moment de la réponse ; on décompte localement depuis sa réception.
// Une seule requête par démarrage / pause au lieu d'une par seconde.
export const calculerChrono = (match, maintenant) => {
  const ecoule = match.chrono_en_cours ? Math.max(0, (maintenant - match._recuA) / 1000) : 0;
  const temps = Math.max(0, match.temps_restant_secondes - ecoule);
  const shotActif = match.shot_clock_secondes > 0;
  const shot = shotActif ? Math.max(0, match.shot_clock_secondes - ecoule) : match.shot_clock_secondes;
  return {
    // Arrondi supérieur : 9.4 s restantes s'affichent 10, comme sur un vrai tableau
    temps: Math.ceil(temps),
    shot: Math.ceil(shot),
    // Fin de période ou violation des 24 s : le serveur a déjà arrêté le chrono, il faut recharger
    aZero: match.chrono_en_cours && (temps === 0 || (shotActif && shot === 0)),
  };
};

export const avecHeureReception = (data) => ({ ...data, _recuA: Date.now() });

export const formaterTemps = (secondes) => {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${minutes}:${reste.toString().padStart(2, "0")}`;
};

// Nom de la période selon le nombre de périodes du règlement
export const nomPeriode = (periode, nbPeriodes = 4) => {
  if (periode > nbPeriodes) return `Prolongation ${periode - nbPeriodes}`;
  if (nbPeriodes === 1) return "Temps réglementaire";
  const nom = nbPeriodes === 2 ? "Mi-temps" : nbPeriodes === 4 ? "Quart" : "Période";
  const ordinal = periode === 1 ? (nom === "Mi-temps" || nom === "Période" ? "1re" : "1er") : `${periode}e`;
  return `${ordinal} ${nom}`;
};

// Évaluation simplifiée (même formule que le serveur)
export const evaluation = (stat) =>
  stat.points + stat.passes + stat.rebonds + stat.contres - stat.fautes;

export const meilleurJoueur = (stats) =>
  stats.length === 0
    ? null
    : stats.reduce((meilleur, stat) => (evaluation(stat) > evaluation(meilleur) ? stat : meilleur));

// Fautes personnelles avant exclusion (0 = jamais exclu)
export const limiteFautes = (match) => match.reglement?.fautes_exclusion ?? 5;

export const estExclu = (stat, match) => {
  const limite = limiteFautes(match);
  return limite > 0 && stat.fautes >= limite;
};
