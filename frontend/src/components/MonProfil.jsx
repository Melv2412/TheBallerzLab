import React, { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { devenirOrganisateur, messageErreur } from '../api'
import { useAuth } from '../AuthContext'
import { IconeJoueur } from './Icones'

// Une explication par type de compte (voir organisateurs.py côté serveur)
function TypeDeCompte({ user }) {
  const { rafraichirProfil } = useAuth()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const demander = async () => {
    setEnvoi(true)
    setErreur('')
    try {
      await devenirOrganisateur()
      await rafraichirProfil()
    } catch (error) {
      setErreur(messageErreur(error))
    } finally {
      setEnvoi(false)
    }
  }

  if (user.type_compte === 'organisateur') {
    return <p className="text-sm text-gray-300">✅ Compte organisateur validé : tu peux créer des tournois.</p>
  }
  if (user.type_compte === 'organisateur_en_attente') {
    return (
      <p className="text-sm text-gray-300">
        <span className="animate-sablier mr-1" aria-hidden="true">⏳</span>
        Demande organisateur envoyée : l'équipe THE LAB la valide au plus vite.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300">Compte joueur. Tu veux aussi organiser des tournois ?</p>
      <button onClick={demander} disabled={envoi} className="text-xs font-black uppercase tracking-widest text-primary-orange border border-primary-orange/40 rounded-xl px-4 py-2 hover:bg-primary-orange/10 disabled:opacity-50">
        {envoi ? 'Envoi…' : 'Demander un compte organisateur'}
      </button>
      {erreur && <p className="text-xs text-red-400">{erreur}</p>}
    </div>
  )
}

// « Mon profil » : la fiche athlète du compte, ou une explication tant qu'il n'est relié à aucune fiche
export default function MonProfil() {
  const { user, rafraichirProfil } = useAuth()
  const [aJour, setAJour] = useState(false)

  useEffect(() => {
    // La fiche a pu être reliée depuis le dernier chargement du profil
    if (user) rafraichirProfil().finally(() => setAJour(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) return <Navigate to="/login" replace />
  if (user.athlete) return <Navigate to={`/athlete/${user.athlete}`} replace />
  if (!aJour) return <div className="text-center py-10 animate-pulse">Chargement du profil...</div>

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <header className="glass-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl text-gray-500 shrink-0"><IconeJoueur /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter truncate">{user.username}</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Mon profil</p>
        </div>
      </header>

      <section className="glass-card p-6 space-y-3">
        <h2 className="font-black uppercase">Pas encore de profil joueur</h2>
        <p className="text-sm text-gray-300">
          Ton profil (stats de carrière, tournois, photo) apparaît dès que tu rejoins ton équipe avec son{' '}
          <b>lien d'invitation</b>. Demande-le à ton capitaine ou à l'organisateur du tournoi, ouvre-le en étant
          connecté, puis choisis ton nom (« C'est moi ») ou inscris-toi avec ton numéro.
        </p>
        <p className="text-xs text-gray-500">Rien n'est créé tant que tu n'as pas rejoint une équipe.</p>
      </section>

      <section className="glass-card p-6">
        <TypeDeCompte user={user} />
      </section>

      <Link to="/" className="inline-block text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary-orange">
        ← Retour aux tournois
      </Link>
    </div>
  )
}
