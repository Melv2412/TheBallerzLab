import { useEffect, useRef } from 'react'

/**
 * Rappelle `charger` à intervalle régulier.
 *
 * - `delai` : nombre de millisecondes, ou fonction qui le calcule après chaque
 *   chargement (pour ralentir quand le match n'est pas en cours). `null` = pause.
 * - Suspendu quand l'onglet est caché (économise les requêtes et la batterie),
 *   et rechargé immédiatement quand on revient sur l'onglet.
 */
export function usePolling(charger, delai, deps) {
  const chargerRef = useRef(charger)
  const delaiRef = useRef(delai)
  chargerRef.current = charger
  delaiRef.current = delai

  useEffect(() => {
    let actif = true
    let timer = null

    const planifier = () => {
      clearTimeout(timer)
      const d = typeof delaiRef.current === 'function' ? delaiRef.current() : delaiRef.current
      if (d == null || document.hidden) return
      timer = setTimeout(tour, d)
    }

    const tour = async () => {
      try {
        await chargerRef.current()
      } finally {
        if (actif) planifier()
      }
    }

    const onVisibilite = () => {
      if (document.hidden) clearTimeout(timer)
      else tour()
    }

    tour()
    document.addEventListener('visibilitychange', onVisibilite)
    return () => {
      actif = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilite)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
