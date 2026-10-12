import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTournois, createTournoi, deleteTournoi } from '../api'
import { useAuth } from '../AuthContext'

function ListeTournois() {
  const { user } = useAuth()
  const [tournois, setTournois] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    date_debut: '',
    date_fin: '',
    has_8emes: false,
    has_quarts: false,
    has_demis: false,
    has_finale: true,
    limite_fautes: 5,
  })

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadTournois(searchTerm)
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  const loadTournois = async (search = '') => {
    try {
      const response = await getTournois(search)
      const data = Array.isArray(response.data) ? response.data : (response.data.results || [])
      setTournois(data)
    } catch (error) {
      console.error('Erreur lors du chargement des tournois:', error)
      setTournois([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createTournoi(formData)
      setShowModal(false)
      setFormData({ nom: '', date_debut: '', date_fin: '' })
      setTimeout(() => {
        loadTournois()
      }, 100)
    } catch (error) {
      console.error('Erreur lors de la création:', error)
      alert(`Erreur lors de la création`)
    }
  }

  const handleDelete = async (slug) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce tournoi ?')) {
      try {
        await deleteTournoi(slug)
        loadTournois(searchTerm)
      } catch (error) {
        console.error('Erreur lors de la suppression:', error)
      }
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
              onClick={() => setShowModal(true)}
              className="btn-basketball flex items-center gap-3 w-full md:w-auto justify-center whitespace-nowrap"
            >
              <span className="text-xl">+</span> Créer un Tournoi
            </button>
          )}
        </div>
      </div>

      {tournois.length === 0 ? (
        <div className="glass-card p-20 text-center">
          <div className="text-8xl mb-6 opacity-20">⛹️</div>
          <h2 className="text-3xl font-bold mb-4">Aucun Tournoi Trouvé</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">Préparez votre sifflet et organisez votre première compétition dès aujourd'hui.</p>
          {user && (
            <button
              onClick={() => setShowModal(true)}
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
              {/* Decorative Background Icon */}
              <div className="absolute -right-4 -top-4 text-9xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none rotate-12">
                🏀
              </div>
              
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <div className="bg-primary-orange/10 text-primary-orange px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-primary-orange/20 w-fit">
                      {tournoi.organisateur_nom || 'Public'}
                    </div>
                  </div>
                  {user && tournoi.organisateur_nom === user.username && (
                    <button
                      onClick={() => handleDelete(tournoi.slug)}
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
                  <span>📅</span>
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
              {/* Rules Selection */}
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <label className="block text-[10px] font-black text-primary-orange mb-4 uppercase tracking-[0.2em]">Règles du Jeu</label>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500">Limite de Fautes p/ Joueur</span>
                  <div className="flex items-center gap-4">
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, limite_fautes: Math.max(1, formData.limite_fautes - 1)})}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-orange transition-colors font-black"
                    >-</button>
                    <span className="text-xl font-black text-white w-6 text-center">{formData.limite_fautes}</span>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, limite_fautes: formData.limite_fautes + 1})}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary-orange transition-colors font-black"
                    >+</button>
                  </div>
                </div>
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
      </div>
    </div>
  )
}

export default ListeTournois
