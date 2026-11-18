// Même règle que le serveur (tournois/views.py, peut_modifier) : l'organisateur du tournoi,
// ou le staff pour un tournoi sans organisateur. Le serveur vérifie de toute façon chaque requête.
// Réglages réservés à l'organisateur lui-même : le staff n'est pas concerné
export const estOrganisateur = (user, organisateurId) =>
  Boolean(user?.id) && organisateurId != null && organisateurId === user.id

export const peutModifier = (user, organisateurId) => {
  if (!user?.id) return false
  if (organisateurId == null) return Boolean(user.is_staff)
  return organisateurId === user.id
}

// Un tournoi clôturé est en lecture seule, même pour son organisateur
export const peutEditer = (user, organisateurId, clotureLe) =>
  !clotureLe && peutModifier(user, organisateurId)
