// Même règle que le serveur (tournois/views.py, peut_modifier) : l'organisateur du tournoi,
// ou le staff pour un tournoi sans organisateur. Le serveur vérifie de toute façon chaque requête.
export const peutModifier = (user, organisateurId) => {
  if (!user?.id) return false
  if (organisateurId == null) return Boolean(user.is_staff)
  return organisateurId === user.id
}
