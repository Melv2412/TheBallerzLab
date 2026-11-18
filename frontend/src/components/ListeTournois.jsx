import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTournois, createTournoi, getCorbeille, devenirOrganisateur, messageErreur, updateTournoi } from '../api'
import { useAuth } from '../AuthContext'
import { estOrganisateur, peutModifier } from '../permissions'
import { FormulaireReglement } from './reglement/FormulaireReglement'
import { NOMS_PRESETS, typeReglement, usePresets } from './reglement/presets'
import { BasculeVisibilite, ModalPasserPrive, confirmationPriveRequise } from './tournoi/BasculeVisibilite'
import { ModalCorbeille } from './tournoi/ModalCorbeille'
import { ModalSuppressionTournoi } from './tournoi/ModalSuppressionTournoi'

const FORMULAIRE_VIDE = {
  nom: '',
  date_debut: '',
  date_fin: '',
  has_8emes: false,
  has_quarts: false,
  has_demis: false,
  has_finale: true,
  reglement: null, // null = FIBA (défaut du serveur)
  prive: false,
}

function ListeTournois() {
  const { user, rafraichirProfil } = useAuth()
  // undefined = profil pas encore chargé : on laisse essayer, le serveur tranchera
  const enAttenteValidation = user?.type_compte === 'organisateur_en_attente'
  const compteJoueur = user?.type_compte === 'joueur'
  const [proposerOrga, setProposerOrga] = useState(false)
  const [demandeEnCours, setDemandeEnCours] = useState(false)

  const demanderCompteOrga = async () => {
    setDemandeEnCours(true)
    try {
      await devenirOrganisateur()
      await rafraichirProfil()
      setProposerOrga(false)
      setAvertissement("Demande envoyée ! L'équipe THE LAB valide ton compte organisateur au plus vite.")
    } catch (error) {
      setProposerOrga(false)
      setAvertissement(messageErreur(error))
    } finally {
      setDemandeEnCours(false)
    }
  }
  const limiteAtteinte = user?.limite_tournois_actifs != null && user.tournois_actifs >= user.limite_tournois_actifs
  const [avertissement, setAvertissement] = useState('')

  const ouvrirCreation = () => {
    if (compteJoueur) {
      setProposerOrga(true)
    } else if (enAttenteValidation) {
      setAvertissement("Ton compte organisateur est en attente de validation par l'équipe THE LAB. Tu pourras créer des tournois dès qu'il sera validé.")
    } else if (limiteAtteinte) {
      setAvertissement(`Tu as déjà ${user.limite_tournois_actifs} tournois en cours ou à venir. Un tournoi libère sa place une fois clôturé ou sa date de fin passée.`)
    } else {
      setShowModal(true)
    }
  }
  const [tournois, setTournois] = useState([])
  const [pageSuivante, setPageSuivante] = useState(null)
  const [chargementSuite, setChargementSuite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState(FORMULAIRE_VIDE)
  const [personnaliser, setPersonnaliser] = useState(false)
  const presets = usePresets()
  const reglementChoisi = formData.reglement || presets?.presets.fiba
  const [aSupprimer, setASupprimer] = useState(null)
  const [corbeille, setCorbeille] = useState([])
  const [voirCorbeille, setVoirCorbeille] = useState(false)
  const gereDesTournois = Boolean(user) && !compteJoueur
  const [aRendrePrive, setARendrePrive] = useState(null)
  const [visibiliteEnCours, setVisibiliteEnCours] = useState(null)

  const changerVisibilite = async (tournoi, prive) => {
    setVisibiliteEnCours(tournoi.id)
    try {
      const { data } = await updateTournoi(tournoi.slug, { prive })
      setTournois((liste) => liste.map((t) => (t.id === tournoi.id ? { ...t, prive: data.prive } : t)))
    } catch (error) {
      setAvertissement(messageErreur(error, 'Impossible de changer la visibilité du tournoi.'))
    } finally {
      setVisibiliteEnCours(null)
      setARendrePrive(null)
    }
  }

  const basculerVisibilite = (tournoi) => {
    if (confirmationPriveRequise(tournoi)) setARendrePrive(tournoi)
    else changerVisibilite(tournoi, !tournoi.prive)
  }

  const chargerCorbeille = async () => {
    try {
      const { data } = await getCorbeille()
      setCorbeille(data)
    } catch (error) {
      console.error('Erreur lors du chargement de la corbeille:', error)
    }
  }

  useEffect(() => {
    if (gereDesTournois) chargerCorbeille()
  }, [gereDesTournois])

  // Après une suppression ou une restauration : listes et compteur de tournois à jour
  const actualiserApresSuppression = async () => {
    await Promise.all([loadTournois(searchTerm), chargerCorbeille(), rafraichirProfil()])
  }

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadTournois(searchTerm)
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  const loadTournois = async (search = '') => {
    try {
      const { data } = await getTournois(search)
      setTournois(data.results || [])
      setPageSuivante(data.next ? 2 : null)
    } catch (error) {
      console.error('Erreur lors du chargement des tournois:', error)
      setTournois([])
      setPageSuivante(null)
    } finally {
      setLoading(false)
    }
  }

  const chargerPlus = async () => {
    setChargementSuite(true)
    try {
      const { data } = await getTournois(searchTerm, pageSuivante)
      setTournois((precedents) => [...precedents, ...(data.results || [])])
      setPageSuivante(data.next ? pageSuivante + 1 : null)
    } catch (error) {
      console.error('Erreur lors du chargement des tournois:', error)
    } finally {
      setChargementSuite(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { reglement, ...donnees } = formData
      await createTournoi(reglement ? formData : donnees)
      setShowModal(false)
      setFormData(FORMULAIRE_VIDE)
      setPersonnaliser(false)
      rafraichirProfil()
      setTimeout(() => {
        loadTournois()
      }, 100)
    } catch (error) {
      alert(messageErreur(error, 'Erreur lors de la création du tournoi.'))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="text-6xl mb-4">🏀</div>
        <div className="text-xl athletic-font text-primary-orange">Échauffement en cours...</div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in relative">
      {/* Image de fond streetball avec transparence */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-8 pointer-events-none z-0"
        style={{ 
          backgroundImage: 'url(/images/backgrounds/streetball-calm.jpg)',
          filter: 'grayscale(40%) brightness(0.65)',
          backgroundPosition: 'center 30%'
        }}
      />
      
      {/* Overlay gradient pour meilleure lisibilité */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70 pointer-events-none z-0" />
      
      {/* Contenu principal */}
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div className="card-title-accent">
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter">
            {user ? 'Mes Tournois' : 'Découvrir The Lab'}
          </h1>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">
            {user ? 'Saison 2026 • Vos compétitions' : 'Saison 2026 • Tout l\'agenda basket'}
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
          {corbeille.length > 0 && (
            <button
              type="button"
              onClick={() => setVoirCorbeille(true)}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase text-xs tracking-widest whitespace-nowrap"
            >
              Corbeille ({corbeille.length})
            </button>
          )}
          {/* Barre de Recherche */}
          <div className="relative group w-full md:w-80">
            <input 
              type="text"
              placeholder="Rechercher un tournoi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-12 text-sm focus:outline-none focus:border-primary-orange/50 transition-all placeholder:text-gray-600 font-bold"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary-orange transition-colors">🔍</span>
          </div>

          {user && (
            <button
              onClick={ouvrirCreation}
              className="btn-basketball flex items-center gap-3 w-full md:w-auto justify-center whitespace-nowrap"
            >
              <span className="text-xl">+</span> Créer un Tournoi
            </button>
          )}
        </div>
      </div>

      {user && enAttenteValidation && (
        <p className="mb-6 -mt-4 flex items-center gap-2 text-xs text-gray-400 border-l-2 border-primary-orange/50 pl-3 py-1">
          <span className="animate-sablier" aria-hidden="true">⏳</span>
          <span>
            <span className="text-primary-orange font-bold">Compte organisateur en attente de validation</span>
            <span className="hidden sm:inline"> · tu pourras créer des tournois dès qu'il sera validé</span>
          </span>
        </p>
      )}

      {proposerOrga && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setProposerOrga(false)}>
          <div className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-md text-center shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-4">🏀</div>
            <p className="text-gray-200 mb-2 font-bold">Tu as un compte joueur.</p>
            <p className="text-gray-400 text-sm mb-6">
              Pour organiser des tournois, demande un compte organisateur : l'équipe THE LAB le valide, puis tu pourras créer tes tournois.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setProposerOrga(false)} className="flex-1 py-4 rounded-xl border border-white/10 text-gray-300 font-bold">Annuler</button>
              <button onClick={demanderCompteOrga} disabled={demandeEnCours} className="btn-basketball flex-1 py-4 disabled:opacity-50">
                {demandeEnCours ? 'Envoi…' : 'Demander'}
              </button>
            </div>
          </div>
        </div>
      )}

      {avertissement && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setAvertissement('')}>
          <div className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-8 w-full max-w-md text-center shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-4">{enAttenteValidation ? <span className="animate-sablier">⏳</span> : '🏁'}</div>
            <p className="text-gray-200 mb-6">{avertissement}</p>
            <button onClick={() => setAvertissement('')} className="btn-basketball w-full py-4">Compris</button>
          </div>
        </div>
      )}

      {tournois.length === 0 ? (
        <div className="glass-card p-20 text-center">
          <h2 className="text-3xl font-bold mb-4">Aucun Tournoi Trouvé</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Préparez votre sifflet et organisez votre première compétition dès aujourd'hui.</p>
          {user && (
            <button
              onClick={ouvrirCreation}
              className="btn-basketball"
            >
              Lancer un tournoi
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tournois.map((tournoi) => (
            <div
              key={tournoi.id}
              className="glass-card group relative overflow-hidden flex flex-col hover-lift"
            >
              
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-2">
                    <div className="bg-primary-orange/10 text-primary-orange px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-primary-orange/20 w-fit">
                      {tournoi.organisateur_nom || 'Sans organisateur'}
                    </div>
                    {estOrganisateur(user, tournoi.organisateur) && (
                      <BasculeVisibilite
                        tournoi={tournoi}
                        enCours={visibiliteEnCours === tournoi.id}
                        onBascule={basculerVisibilite}
                      />
                    )}
                    {tournoi.cloture_le && (
                      <span className="bg-white/5 text-gray-300 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-white/10 w-fit">
                        Clôturé
                      </span>
                    )}
                  </div>
                  {peutModifier(user, tournoi.organisateur) && (
                    <button
                      onClick={() => setASupprimer(tournoi)}
                      aria-label={`Supprimer ${tournoi.nom}`}
                      className="text-gray-600 hover:text-red-500 transition-colors p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
                
                <h2 className="text-3xl font-black mb-2 leading-tight group-hover:text-primary-orange transition-colors">
                  {tournoi.nom}
                </h2>
                
                <div className="flex items-center gap-2 text-gray-400 font-bold text-xs uppercase mb-6">
                  <span>{new Date(tournoi.date_debut).toLocaleDateString('fr-FR')}</span>
                  <span>-</span>
                  <span>{new Date(tournoi.date_fin).toLocaleDateString('fr-FR')}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="block text-[10px] text-gray-500 font-black uppercase tracking-tighter">Équipes</span>
                    <span className="text-xl font-black">{tournoi.equipes_count || 0}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="block text-[10px] text-gray-500 font-black uppercase tracking-tighter">Matchs</span>
                    <span className="text-xl font-black">{tournoi.matchs_count || 0}</span>
                  </div>
                </div>

                <Link
                  to={`/tournoi/${tournoi.slug}`}
                  className="btn-basketball w-full flex items-center justify-center gap-2"
                >
                  Accéder au Terrain <span>➔</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {pageSuivante && (
        <div className="flex justify-center mt-10">
          <button
            onClick={chargerPlus}
            disabled={chargementSuite}
            className="px-8 py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase text-xs tracking-widest disabled:opacity-50"
          >
            {chargementSuite ? 'Chargement...' : 'Voir plus de tournois'}
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-10 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in ring-8 ring-primary-orange/5">
            <h2 className="text-2xl sm:text-4xl font-black mb-6 sm:mb-8 italic tracking-tighter uppercase text-white">Nouveau Championnat</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Nom du Tournoi</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NBA Summer League"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none placeholder:text-gray-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Date Début</label>
                  <input
                    type="date"
                    required
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Date Fin</label>
                  <input
                    type="date"
                    required
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <label className="block text-[10px] font-black text-primary-orange mb-4 uppercase tracking-[0.2em]">Visibilité</label>
                <div className="flex gap-2">
                  {[{ valeur: false, label: 'Public' }, { valeur: true, label: 'Privé' }].map(({ valeur, label }) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={formData.prive === valeur}
                      onClick={() => setFormData({ ...formData, prive: valeur })}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.prive === valeur ? 'bg-primary-orange text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-3">
                  {formData.prive ? "Visible seulement par toi et l'équipe THE LAB. Les liens d'invitation restent actifs." : 'Visible par tout le monde.'}
                </p>
              </div>

              {/* Phases Selection */}
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <label className="block text-[10px] font-black text-primary-orange mb-4 uppercase tracking-[0.2em]">Format de la Phase Finale</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'has_8emes', label: '8èmes' },
                    { id: 'has_quarts', label: 'Quarts' },
                    { id: 'has_demis', label: 'Demis' },
                    { id: 'has_finale', label: 'Finale' }
                  ].map(phase => (
                    <label key={phase.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData[phase.id]}
                          onChange={(e) => setFormData({ ...formData, [phase.id]: e.target.checked })}
                          className="sr-only peer"
                          disabled={phase.id === 'has_finale'}
                        />
                        <div className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${formData[phase.id] ? 'bg-primary-orange border-primary-orange' : 'border-white/10 group-hover:border-white/30'}`}>
                          {formData[phase.id] && <span className="text-white text-[10px]">✓</span>}
                        </div>
                      </div>
                      <span className={`text-xs font-black uppercase tracking-widest ${formData[phase.id] ? 'text-white' : 'text-gray-500'}`}>{phase.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Règlement */}
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <label className="block text-[10px] font-black text-primary-orange mb-4 uppercase tracking-[0.2em]">Règlement</label>
                {!personnaliser ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {presets && Object.keys(presets.presets).map((nom) => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setFormData({ ...formData, reglement: { ...presets.presets[nom] } })}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${typeReglement(reglementChoisi, presets.presets) === nom ? 'bg-primary-orange text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        {NOMS_PRESETS[nom]}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, reglement: { ...reglementChoisi } })
                        setPersonnaliser(true)
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 text-gray-400 hover:text-white"
                    >
                      Personnaliser…
                    </button>
                  </div>
                ) : (
                  <FormulaireReglement
                    reglement={formData.reglement}
                    donnees={presets}
                    onChange={(reglement) => setFormData({ ...formData, reglement })}
                  />
                )}
                <p className="text-[10px] text-gray-600 mt-3">Modifiable ensuite dans l'onglet Paramètres du tournoi.</p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="btn-basketball flex-1 py-5"
                >
                  Valider l'Inscription
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/5 text-gray-400 py-5 rounded-2xl font-black hover:bg-white/10 transition-colors uppercase tracking-widest"
                >
                  Fermer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {aSupprimer && (
        <ModalSuppressionTournoi
          tournoi={aSupprimer}
          onFermer={() => setASupprimer(null)}
          onSupprime={async () => {
            setASupprimer(null)
            await actualiserApresSuppression()
          }}
        />
      )}

      {aRendrePrive && (
        <ModalPasserPrive
          tournoi={aRendrePrive}
          enCours={visibiliteEnCours === aRendrePrive.id}
          onAnnuler={() => setARendrePrive(null)}
          onConfirmer={() => changerVisibilite(aRendrePrive, true)}
        />
      )}

      {voirCorbeille && (
        <ModalCorbeille
          tournois={corbeille}
          onFermer={() => setVoirCorbeille(false)}
          onChange={actualiserApresSuppression}
        />
      )}
      </div>
    </div>
  )
}

export default ListeTournois
