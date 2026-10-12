import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getMatch, updateMatch, initialiserStatsMatch, updateStatistique, getImageUrl } from '../api'
import { useAuth } from '../AuthContext'
import { usePolling } from '../usePolling'

function DetailMatch() {
  const { user } = useAuth()
  const { id } = useParams()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsInitialisees, setStatsInitialisees] = useState(false)

  const isOwner = user && match && match.organisateur_nom === user.username;

  // Toutes les 3 s pendant le match, toutes les 30 s sinon (terminé ou à venir)
  usePolling(() => loadMatch(), () => (match?.statut === 'en_cours' ? 3000 : 30000), [id])

  const loadMatch = async () => {
    try {
      const response = await getMatch(id)
      setMatch(response.data)
      setStatsInitialisees(response.data.statistiques && response.data.statistiques.length > 0)
    } catch (error) {
      console.error('Erreur lors du chargement du match:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInitialiserStats = async () => {
    try {
      await initialiserStatsMatch(id)
      loadMatch()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'initialisation des stats')
    }
  }

  const handleUpdateStat = async (statId, champ, action, valeur = 1) => {
    try {
      await updateStatistique(id, statId, champ, action, valeur)
      loadMatch()
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
    }
  }

  const handleChangeStatut = async (nouveauStatut) => {
    try {
      await updateMatch(id, { statut: nouveauStatut })
      loadMatch()
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <div className="text-6xl mb-4">⏱️</div>
          <div className="text-xl athletic-font text-primary-orange">Synchronisation du chrono...</div>
        </div>
      )
  }

  if (!match) {
    return <div className="text-center py-8 athletic-font text-2xl">Match non trouvé</div>
  }

  const statsDomicile = match.statistiques?.filter(
    stat => stat.equipe_nom === match.equipe_domicile_nom
  ) || []
  const statsExterieur = match.statistiques?.filter(
    stat => stat.equipe_nom === match.equipe_exterieur_nom
  ) || []

  return (
    <div className="animate-fade-in max-w-7xl mx-auto px-4 relative">
      {/* Image de fond Jordan avec transparence */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-5 pointer-events-none z-0"
        style={{ 
          backgroundImage: 'url(/images/backgrounds/jordan-focus.jpg)',
          filter: 'grayscale(50%) brightness(0.6)'
        }}
      />
      
      <div className="relative z-10">
      <div className="mb-8">
        <Link to={`/tournoi/${match.tournoi_slug}`} className="text-gray-400 hover:text-white transition-colors mb-4 inline-block font-bold text-xs uppercase tracking-widest">
          ← Retour au championnat
        </Link>

        {match && !isOwner && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <span className="text-2xl">👁️</span>
              <div>
                <p className="text-blue-400 font-black uppercase text-[10px] tracking-widest">Mode Consultant Actif</p>
                <p className="text-gray-400 text-xs">Lecture seule • Tournoi de <span className="text-white font-bold">{match.organisateur_nom || 'l\'organisateur'}</span>.</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="glass-card overflow-hidden">
          <div className="p-5 sm:p-8 flex flex-col md:flex-row justify-between items-center bg-white/5 border-b border-white/5">
            <div className="text-center md:text-left min-w-0">
              <h1 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter text-white break-words">
                {match.equipe_domicile_nom} <span className="text-primary-orange mx-2">VS</span> {match.equipe_exterieur_nom}
              </h1>
              <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1">{match.tournoi_nom}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-6 md:mt-0">
               <div className={`px-4 py-2 rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 ${match.statut === 'en_cours' ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}>
                {match.statut === 'en_cours' ? '🔴 LIVE' : match.statut === 'termine' ? '✅ TERMINE' : '⏳ A VENIR'}
               </div>
               {/* <Link
                 to={`/match/${id}/live`}
                 className="px-6 py-2 bg-primary-orange hover:bg-orange-600 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
               >
                 🏀 Mode Live
               </Link> */}
                {isOwner && (
                  <select
                    value={match.statut}
                    onChange={(e) => handleChangeStatut(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest focus:outline-none"
                  >
                    <option value="a_venir" className="bg-black">Set À venir</option>
                    <option value="en_cours" className="bg-black">Set En cours</option>
                    <option value="termine" className="bg-black">Set Terminé</option>
                  </select>
                )}
            </div>
          </div>

          {/* Score Board */}
          <div className="p-6 sm:p-10 flex justify-center items-center gap-4 sm:gap-24 relative overflow-hidden">
             <div className="text-center min-w-0 flex-1 sm:flex-none">
                <div className="text-6xl sm:text-8xl lg:text-9xl font-black italic tracking-tighter text-white mb-2">{match.score_domicile}</div>
                <div className="text-xs font-black uppercase tracking-widest text-primary-orange italic break-words">{match.equipe_domicile_nom}</div>
             </div>
             
             <div className="flex flex-col items-center">
                <div className="text-lg sm:text-3xl font-black text-white/20 italic">FINAL</div>
                <div className="w-1 h-12 sm:h-20 bg-white/5 my-4"></div>
             </div>

             <div className="text-center min-w-0 flex-1 sm:flex-none">
                <div className="text-6xl sm:text-8xl lg:text-9xl font-black italic tracking-tighter text-white mb-2">{match.score_exterieur}</div>
                <div className="text-xs font-black uppercase tracking-widest text-primary-orange italic break-words">{match.equipe_exterieur_nom}</div>
             </div>

             {/* Background Decoration */}
             <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
                <div className="text-[120px] sm:text-[250px] font-black italic uppercase tracking-tighter">BASKET</div>
             </div>
          </div>

          {/* MVP Spotlight */}
          {match.mvp && (
            <div className="mx-4 sm:mx-8 mb-6 sm:mb-8 pebbled-bg rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center gap-6 shadow-2xl shadow-primary-orange/20 border-b-4 border-b-black/40">
               <div className="text-5xl">👑</div>
               <div className="flex-1 text-center md:text-left">
                  <h3 className="text-black font-black italic text-sm uppercase tracking-widest opacity-60">MVP du Match Selection</h3>
                  <div className="flex flex-col md:flex-row md:items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black text-black uppercase italic tracking-tighter break-words">{match.mvp.nom}</span>
                    <span className="text-xs font-black text-black/60 uppercase tracking-widest">#{match.mvp.numero} — {match.mvp.equipe}</span>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-3 sm:gap-4 bg-black/10 p-3 sm:p-4 rounded-2xl flex-shrink-0">
                  <div className="text-center"><span className="block text-[8px] font-black text-black/40 uppercase">EVAL</span><span className="text-xl font-black text-black">{match.mvp.evaluation}</span></div>
                  <div className="text-center"><span className="block text-[8px] font-black text-black/40 uppercase">PTS</span><span className="text-xl font-black text-black">{match.mvp.stats.pts}</span></div>
                  <div className="text-center"><span className="block text-[8px] font-black text-black/40 uppercase">AST</span><span className="text-xl font-black text-black">{match.mvp.stats.ast}</span></div>
                  <div className="text-center"><span className="block text-[8px] font-black text-black/40 uppercase">REB</span><span className="text-xl font-black text-black">{match.mvp.stats.reb}</span></div>
               </div>
            </div>
          )}

          {!statsInitialisees && isOwner && (
            <div className="p-8 sm:p-20 text-center border-t border-white/5">
              <button
                onClick={handleInitialiserStats}
                className="btn-basketball text-lg px-12 py-5"
              >
                Activer les Feuilles de Stats 📋
              </button>
              <p className="text-xs font-bold text-gray-500 mt-4 uppercase tracking-widest">Générez les entrées statistiques pour tous les joueurs</p>
            </div>
          )}
          {!statsInitialisees && !isOwner && (
            <div className="p-8 sm:p-20 text-center border-t border-white/5 italic opacity-40">
              Les statistiques détaillées ne sont pas encore disponibles pour ce match.
            </div>
          )}
        </div>
      </div>

      {statsInitialisees && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Home Stats */}
          <div className="space-y-6">
            <h2 className="text-3xl font-black italic uppercase italic card-title-accent text-white">{match.equipe_domicile_nom}</h2>
            <div className="space-y-4">
              {statsDomicile.map((stat) => (
                <StatCard
                  key={stat.id}
                  stat={stat}
                  onUpdate={handleUpdateStat}
                  matchStatut={match.statut}
                  isOwner={isOwner}
                />
              ))}
            </div>
          </div>

          {/* Away Stats */}
          <div className="space-y-6">
            <h2 className="text-3xl font-black italic uppercase italic card-title-accent text-white">{match.equipe_exterieur_nom}</h2>
            <div className="space-y-4">
              {statsExterieur.map((stat) => (
                <StatCard
                  key={stat.id}
                  stat={stat}
                  onUpdate={handleUpdateStat}
                  matchStatut={match.statut}
                  isOwner={isOwner}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function StatCard({ stat, onUpdate, matchStatut, isOwner }) {
  const canEdit = isOwner && matchStatut === 'en_cours'

  const StatBox = ({ label, value, field, color = "orange" }) => (
    <div className={`p-4 rounded-2xl bg-white/3 border border-white/5 flex flex-col items-center justify-center relative group`}>
       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</span>
       <span className="text-3xl font-black italic tracking-tighter text-white">{value}</span>
       {canEdit && (
         <div className="flex flex-col gap-1 absolute -right-2 inset-y-0 translate-x-full opacity-0 group-hover:opacity-100 transition-all z-10">
            <button onClick={() => onUpdate(stat.id, field, 'increment', 1)} className="bg-primary-orange text-white w-8 h-8 rounded-lg font-black text-sm shadow-lg">+</button>
            <button onClick={() => onUpdate(stat.id, field, 'decrement', 1)} className="bg-red-500 text-white w-8 h-8 rounded-lg font-black text-sm shadow-lg">-</button>
         </div>
       )}
    </div>
  )

  return (
    <div className="glass-card hover:border-primary-orange/40 transition-all p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-orange text-white flex items-center justify-center rounded-xl font-black text-xl italic shadow-lg shadow-primary-orange/20 overflow-hidden">
            {getImageUrl(stat.joueur_photo) ? (
              <img src={getImageUrl(stat.joueur_photo)} className="w-full h-full object-cover" alt="photo" />
            ) : (
              <span>#{stat.joueur_numero}</span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter">{stat.joueur_nom}</h3>
            <div className="flex gap-4 mt-1">
               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Position: G/F</span>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
             <button onClick={() => onUpdate(stat.id, 'points', 'increment', 1)} className="bg-white/5 hover:bg-primary-orange hover:text-white transition-all w-10 h-10 rounded-xl font-black text-xs border border-white/10">+1</button>
             <button onClick={() => onUpdate(stat.id, 'points', 'increment', 2)} className="bg-white/5 hover:bg-primary-orange hover:text-white transition-all w-10 h-10 rounded-xl font-black text-xs border border-white/10">+2</button>
             <button onClick={() => onUpdate(stat.id, 'points', 'increment', 3)} className="bg-white/5 hover:bg-primary-orange hover:text-white transition-all w-10 h-10 rounded-xl font-black text-xs border border-white/10">+3</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatBox label="PTS" value={stat.points} field="points" />
        <StatBox label="AST" value={stat.passes} field="passes" />
        <StatBox label="REB" value={stat.rebonds} field="rebonds" />
        <StatBox label="BLK" value={stat.contres} field="contres" />
      </div>

      <div className="mt-4 flex items-center gap-4">
         <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${(stat.fautes / 5) * 100}%`, transition: 'width 0.3s ease' }}></div>
         </div>
         <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Fautes: {stat.fautes}/5</span>
         {canEdit && <button onClick={() => onUpdate(stat.id, 'fautes', 'increment', 1)} className="px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Add Foul</button>}
      </div>
    </div>
  )
}

export default DetailMatch
