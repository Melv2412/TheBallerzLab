// Match resté « en cours » sans aucune activité depuis longtemps : sans doute oublié
export const HEURES_SANS_ACTIVITE = 3;

export function matchsOublies(matchs, maintenant = Date.now(), heures = HEURES_SANS_ACTIVITE) {
  const limite = maintenant - heures * 3600 * 1000;
  return matchs.filter((m) => m.statut === "en_cours" && m.updated_at && new Date(m.updated_at).getTime() < limite);
}
