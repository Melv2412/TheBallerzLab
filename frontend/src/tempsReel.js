import { useEffect, useRef, useState } from 'react'

// Direct en temps réel (Supabase Realtime). Sans ces deux variables, les pages gardent le rafraîchissement périodique.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_CLE = import.meta.env.VITE_SUPABASE_ANON_KEY

let clientPromesse = null

// Une seule connexion pour toute l'appli, chargée seulement quand une page de match s'ouvre
function client() {
  if (!clientPromesse) {
    clientPromesse = import('@supabase/realtime-js').then(({ RealtimeClient }) => new RealtimeClient(
      `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1`,
      { params: { apikey: SUPABASE_CLE }, accessToken: async () => SUPABASE_CLE },
    ))
  }
  return clientPromesse
}

export const tempsReelDisponible = () => Boolean(SUPABASE_URL && SUPABASE_CLE)

/**
 * Écoute le canal « match:<id> » : la base y signale chaque modification du match.
 * Retourne `connecte` (true quand l'écoute marche) : les pages ralentissent alors leur rafraîchissement.
 * `onChange` est appelé au plus une fois à la fois ; un signal reçu pendant un rechargement en relance un seul après.
 */
export function useTempsReelMatch(id, onChange) {
  const [connecte, setConnecte] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!tempsReelDisponible() || id == null) return undefined
    let actif = true
    let canal = null
    let enCours = false
    let aRefaire = false

    const recharger = async () => {
      if (enCours) {
        aRefaire = true
        return
      }
      enCours = true
      try {
        do {
          aRefaire = false
          await onChangeRef.current()
        } while (aRefaire && actif)
      } finally {
        enCours = false
      }
    }

    client().then((rt) => {
      if (!actif) return
      canal = rt.channel(`match:${id}`, { config: { private: true } })
      canal
        .on('broadcast', { event: 'change' }, () => { if (actif) recharger() })
        .subscribe((statut) => {
          if (!actif) return
          const ok = statut === 'SUBSCRIBED'
          setConnecte(ok)
          // Reconnecté après une coupure : des changements ont pu être manqués
          if (ok) recharger()
        })
    }).catch(() => setConnecte(false))

    return () => {
      actif = false
      setConnecte(false)
      if (canal) client().then((rt) => rt.removeChannel(canal))
    }
  }, [id])

  return connecte
}
