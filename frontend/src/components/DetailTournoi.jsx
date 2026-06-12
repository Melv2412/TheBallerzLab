import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getTournoi,
  getEquipes,
  getMatchs,
  getJoueurs,
  createEquipe,
  createMatch,
  createJoueur,
  updateEquipe,
  updateJoueur,
  deleteEquipe,
  deleteMatch,
  deleteJoueur,
  getClassement,
  getTournamentMVP,
  updateTournoi,
  resetPlayoffs,
} from "../api";
import { useAuth } from "../AuthContext";

const API_BASE_URL = "http://localhost:8000";

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
};

function DetailTournoi() {
  const { user } = useAuth();
  const { slug } = useParams();
  const [tournoi, setTournoi] = useState(null);
  const [equipes, setEquipes] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [equipeForm, setEquipeForm] = useState({ nom: "", logo: null });
  const [matchForm, setMatchForm] = useState({
    equipe_domicile: "",
    equipe_exterieur: "",
    date_match: "",
    statut: "a_venir",
    phase: "poule",
  });
  const [activeTab, setActiveTab] = useState("classement");
  const [subTabClassement, setSubTabClassement] = useState("poule");
  const [joueursParEquipe, setJoueursParEquipe] = useState({});
  const [equipesExpanded, setEquipesExpanded] = useState({});
  const [showJoueurModal, setShowJoueurModal] = useState(null);
  const [joueurForm, setJoueurForm] = useState({
    prenom: "",
    nom: "",
    numero_maillot: "",
    photo: null,
  });
  const [classement, setClassement] = useState([]);
  const [tournamentMVP, setTournamentMVP] = useState([]);
  const [editingJoueurId, setEditingJoueurId] = useState(null);
  const [editingEquipeId, setEditingEquipeId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    has_8emes: false,
    has_quarts: false,
    has_demis: false,
    has_finale: true,
    limite_fautes: 5,
    victoires_requises_8eme: 1,
    victoires_requises_quart: 1,
    victoires_requises_demi: 1,
    victoires_requises_finale: 1,
  });

  const isOwner = user && tournoi && tournoi.organisateur_nom === user.username;

  useEffect(() => {
    if (tournoi) {
      setSettingsForm({
        has_8emes: tournoi.has_8emes,
        has_quarts: tournoi.has_quarts,
        has_demis: tournoi.has_demis,
        has_finale: tournoi.has_finale,
        limite_fautes: tournoi.limite_fautes || 5,
        victoires_requises_8eme: tournoi.victoires_requises_8eme || 1,
        victoires_requises_quart: tournoi.victoires_requises_quart || 1,
        victoires_requises_demi: tournoi.victoires_requises_demi || 1,
        victoires_requises_finale: tournoi.victoires_requises_finale || 1,
      });
    }
  }, [tournoi]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!isOwner) return;

    // Check if structure changed
    const structureChanged = 
      settingsForm.has_8emes !== tournoi.has_8emes ||
      settingsForm.has_quarts !== tournoi.has_quarts ||
      settingsForm.has_demis !== tournoi.has_demis ||
      settingsForm.has_finale !== tournoi.has_finale;

    // Check if required wins changed for any phase, and if matches were already played
    let phaseToReset = null; // We want to reset starting from the earliest phase that changed and has matches played
    
    const phases = [
      { id: '8eme', formVal: settingsForm.victoires_requises_8eme, tournoiVal: tournoi.victoires_requises_8eme },
      { id: 'quart', formVal: settingsForm.victoires_requises_quart, tournoiVal: tournoi.victoires_requises_quart },
      { id: 'demi', formVal: settingsForm.victoires_requises_demi, tournoiVal: tournoi.victoires_requises_demi },
      { id: 'finale', formVal: settingsForm.victoires_requises_finale, tournoiVal: tournoi.victoires_requises_finale }
    ];

    if (structureChanged) {
      const confirmReset = window.confirm(
        "Modifier la structure des phases finales réinitialisera TOUS les matchs éliminatoires. Voulez-vous continuer ?"
      );
      if (!confirmReset) return;
      
      try {
        await resetPlayoffs(slug);
      } catch (err) {
        console.error("Erreur lors de la réinitialisation des playoffs:", err);
        alert("Erreur lors de la réinitialisation des playoffs");
        return;
      }
    } else {
      // Structure didn't change, check if wins required changed and if matches are played
      for (const p of phases) {
        if (p.formVal !== p.tournoiVal) {
          const hasMatchPlayed = matchs.some(m => m.phase === p.id && m.statut !== 'a_venir');
          if (hasMatchPlayed) {
            phaseToReset = p.id;
            break;
          }
        }
      }

      if (phaseToReset) {
        const confirmReset = window.confirm(
          `Modifier le nombre de victoires requises pour la phase de ${phaseToReset} alors que des matchs ont déjà été joués entraînera la réinitialisation de cette phase et des phases suivantes. Voulez-vous continuer ?`
        );
        if (!confirmReset) return;

        try {
          await resetPlayoffs(slug, phaseToReset);
        } catch (err) {
          console.error("Erreur lors de la réinitialisation en cascade:", err);
          alert("Erreur lors de la réinitialisation en cascade");
          return;
        }
      }
    }

    try {
      setLoading(true);
      await updateTournoi(slug, settingsForm);
      alert("Paramètres enregistrés avec succès !");
      loadData();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du tournoi:", err);
      alert("Erreur lors de l'enregistrement des paramètres");
    } finally {
      setLoading(false);
    }
  };


  // Gestion globale du Coller (Paste) pour les images
  useEffect(() => {
    const handlePaste = (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (showEquipeModal) {
            setEquipeForm(prev => ({ ...prev, logo: blob }));
          } else if (showJoueurModal) {
            setJoueurForm(prev => ({ ...prev, photo: blob }));
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showEquipeModal, showJoueurModal]);

  useEffect(() => {
    loadData();
  }, [slug]);

  useEffect(() => {
    if (tournoi?.slug) {
      const fetchRanking = async () => {
        try {
          const classementRes = await getClassement(tournoi.slug, subTabClassement);
          setClassement(classementRes.data || []);
        } catch (err) { console.error("Erreur Classement:", err); }

        try {
          const mvpRes = await getTournamentMVP(tournoi.slug, subTabClassement);
          setTournamentMVP(mvpRes.data || []);
        } catch (err) { console.error("Erreur MVP:", err); }
      };
      fetchRanking();
    }
  }, [subTabClassement, tournoi?.slug]);

  const loadData = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      // 1. Charger le tournoi
      const tournoiRes = await getTournoi(slug);
      const tournoiData = tournoiRes.data;
      setTournoi(tournoiData);

      // 2. Charger les données liées de manière isolée pour éviter qu'une erreur bloque tout
      let eData = [];
      try {
        const equipesRes = await getEquipes(tournoiData.id);
        eData = equipesRes.data.results || equipesRes.data;
        if (!Array.isArray(eData)) eData = [];
        setEquipes(eData);
      } catch (err) { console.error("Erreur Equipes:", err); }

      try {
        const matchsRes = await getMatchs(tournoiData.id);
        const mData = matchsRes.data.results || matchsRes.data;
        setMatchs(Array.isArray(mData) ? mData : []);
      } catch (err) { console.error("Erreur Matchs:", err); }

      try {
        const classementRes = await getClassement(tournoiData.slug, subTabClassement);
        setClassement(classementRes.data || []);
      } catch (err) { console.error("Erreur Classement:", err); }

      try {
        const mvpRes = await getTournamentMVP(tournoiData.slug, subTabClassement);
        setTournamentMVP(mvpRes.data || []);
      } catch (err) { console.error("Erreur MVP:", err); }

      // 3. Charger les joueurs
      const updatedJoueurs = {};
      
      for (const eq of eData) {
        try {
          const res = await getJoueurs(eq.id);
          const jData = res.data.results || res.data;
          updatedJoueurs[eq.id] = Array.isArray(jData) ? jData : [];
        } catch (err) {
          console.error(`Erreur joueurs équipe ${eq.id}:`, err);
          updatedJoueurs[eq.id] = [];
        }
      }
      setJoueursParEquipe(updatedJoueurs);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEquipe = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("nom", equipeForm.nom);
      
      if (equipeForm.logo instanceof File) {
        formData.append("logo", equipeForm.logo);
      }

      if (editingEquipeId) {
        await updateEquipe(editingEquipeId, formData);
      } else {
        formData.append("tournoi", tournoi.id);
        await createEquipe(formData);
      }

      setShowEquipeModal(false);
      setEditingEquipeId(null);
      setEquipeForm({ nom: "", logo: null });
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de l'enregistrement de l'équipe");
    }
  };

  const handleEditEquipe = (equipe) => {
    setEquipeForm({ nom: equipe.nom, logo: null });
    setEditingEquipeId(equipe.id);
    setShowEquipeModal(true);
  };

  const handleDeleteEquipe = async (equipeId) => {
    if (window.confirm("Supprimer cette équipe ?")) {
      try {
        await deleteEquipe(equipeId);
        loadData();
      } catch (error) {
        console.error("Erreur:", error);
      }
    }
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    if (!matchForm.equipe_domicile || !matchForm.equipe_exterieur) {
      alert("Veuillez sélectionner les deux équipes");
      return;
    }
    try {
      const matchData = { ...matchForm, tournoi: parseInt(tournoi.id) };
      if (!matchData.date_match) {
        delete matchData.date_match;
      }
      await createMatch(matchData);
      setShowMatchModal(false);
      setMatchForm({
        equipe_domicile: "",
        equipe_exterieur: "",
        date_match: "",
        statut: "a_venir",
        phase: "poule",
      });
      loadData();
    } catch (error) {
      console.error("Erreur détaillée lors de la création du match:", error.response?.data);
      alert("Erreur lors de la création du match");
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (window.confirm("Supprimer ce match ?")) {
      try {
        await deleteMatch(matchId);
        loadData();
      } catch (error) {
        console.error("Erreur:", error);
      }
    }
  };

  const handleCreateJoueur = async (e, equipeId) => {
    e.preventDefault();
    try {
      const numero = parseInt(joueurForm.numero_maillot);
      if (isNaN(numero) || numero < 0) {
        alert("Le numéro de maillot ne peut pas être négatif");
        return;
      }
      const formData = new FormData();
      formData.append("prenom", joueurForm.prenom.trim().toUpperCase());
      formData.append("nom", joueurForm.nom.trim().toUpperCase());
      formData.append("numero_maillot", numero);
      
      if (joueurForm.photo instanceof File) {
        formData.append("photo", joueurForm.photo);
      }

      if (editingJoueurId) {
        await updateJoueur(editingJoueurId, formData);
      } else {
        formData.append("equipe", equipeId);
        await createJoueur(formData);
      }

      setShowJoueurModal(null);
      setEditingJoueurId(null);
      setJoueurForm({ prenom: "", nom: "", numero_maillot: "", photo: null });
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de l'enregistrement du joueur");
    }
  };

  const handleEditJoueur = (joueur, equipeId) => {
    setJoueurForm({
      prenom: joueur.prenom,
      nom: joueur.nom,
      numero_maillot: joueur.numero_maillot,
      photo: null
    });
    setEditingJoueurId(joueur.id);
    setShowJoueurModal(equipeId);
  };

  const handleDeleteJoueur = async (joueurId) => {
    if (window.confirm("Supprimer ce joueur ?")) {
      try {
        await deleteJoueur(joueurId);
        loadData();
      } catch (error) {
        console.error("Erreur:", error);
      }
    }
  };

  const handleGeneratePlayoffs = async () => {
    let startingPhase = '';
    let requiredTeams = 0;
    if (tournoi.has_8emes) {
      startingPhase = '8eme';
      requiredTeams = 16;
    } else if (tournoi.has_quarts) {
      startingPhase = 'quart';
      requiredTeams = 8;
    } else if (tournoi.has_demis) {
      startingPhase = 'demi';
      requiredTeams = 4;
    } else if (tournoi.has_finale) {
      startingPhase = 'finale';
      requiredTeams = 2;
    }

    if (!startingPhase) {
      alert("Aucune phase finale configurée pour ce tournoi.");
      return;
    }

    let classementPoule = [];
    try {
      const res = await getClassement(tournoi.slug, 'poule');
      classementPoule = res.data || [];
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la récupération du classement de poule.");
      return;
    }

    if (classementPoule.length < requiredTeams) {
      alert(`Il y a seulement ${classementPoule.length} équipes, mais la phase de ${startingPhase} nécessite au moins ${requiredTeams} équipes.`);
      return;
    }

    if (!window.confirm(`Générer automatiquement les matchs de ${startingPhase} avec les ${requiredTeams} premières équipes du classement ?`)) {
      return;
    }

    setLoading(true);
    try {
      const pairs = [];
      for (let i = 0; i < requiredTeams / 2; i++) {
        pairs.push({
          domicile: classementPoule[i],
          exterieur: classementPoule[requiredTeams - 1 - i]
        });
      }

      for (const pair of pairs) {
        await createMatch({
          tournoi: parseInt(tournoi.id),
          phase: startingPhase,
          equipe_domicile: pair.domicile.id,
          equipe_exterieur: pair.exterieur.id,
          statut: 'a_venir'
        });
      }
      
      alert(`Les matchs de ${startingPhase} ont été générés avec succès !`);
      loadData();
    } catch (error) {
      console.error("Erreur lors de la génération automatique :", error);
      alert("Erreur lors de la génération automatique des matchs.");
    } finally {
      setLoading(false);
    }
  };

  const toggleEquipe = (equipeId) => {
    setEquipesExpanded((prev) => ({
      ...prev,
      [equipeId]: !prev[equipeId],
    }));
  };

  const pouleMatchs = matchs.filter(m => m.phase === 'poule');
  const hasPouleMatchs = pouleMatchs.length > 0;
  const allPouleMatchsFinished = hasPouleMatchs && pouleMatchs.every(m => m.statut === 'termine');
  const playoffMatchs = matchs.filter(m => m.phase !== 'poule');
  const hasPlayoffMatchs = playoffMatchs.length > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="text-6xl mb-4">🏀</div>
        <div className="text-xl athletic-font text-primary-orange">Analyse des tactiques...</div>
      </div>
    );
  }

  if (!tournoi) {
    return (
      <div className="glass-card p-20 text-center">
        <h2 className="text-3xl font-black italic">Tournoi Non Trouvé</h2>
        <Link to="/" className="text-primary-orange mt-4 inline-block font-bold underline">Retour à la liste</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20 relative">
      {/* Image de fond équipe officielle avec transparence */}
      <div 
        className="fixed inset-0 bg-cover bg-center opacity-7 pointer-events-none z-0"
        style={{ 
          backgroundImage: 'url(/images/backgrounds/team-official.jpg)',
          filter: 'grayscale(30%) brightness(0.7)',
          backgroundPosition: 'center 40%'
        }}
      />
      
      {/* Overlay gradient pour meilleure lisibilité */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/75 pointer-events-none z-0" />
      
      {/* Contenu principal */}
      <div className="relative z-10">
        
        {tournoi && !isOwner && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <span className="text-2xl">👁️</span>
              <div>
                <p className="text-blue-400 font-black uppercase text-[10px] tracking-widest">Mode Consultant Actif</p>
                <p className="text-gray-400 text-xs">Vous consultez les statistiques du tournoi de <span className="text-white font-bold">{tournoi.organisateur_nom || 'l\'organisateur'}</span>.</p>
              </div>
            </div>
            <div className="text-[10px] font-black text-blue-500/50 uppercase tracking-tighter">Lecture seule</div>
          </div>
        )}

        {/* Header Section */}
      <div className="mb-10 no-print">
        <Link to="/" className="text-gray-400 hover:text-white transition-colors mb-4 inline-block font-bold text-xs uppercase tracking-widest">
          ← Retour aux championnats
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="card-title-accent">
            <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase">{tournoi.nom}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="bg-primary-orange text-white px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase">Live Report</span>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest italic">
                {new Date(tournoi.date_debut).toLocaleDateString("fr-FR")} — {new Date(tournoi.date_fin).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => window.print()}
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase text-xs tracking-widest flex items-center gap-2"
            >
              <span>🖨️</span> Rapport PDF
            </button>
            {isOwner && (
              <button
                onClick={() => {
                  setEditingEquipeId(null);
                  setEquipeForm({ nom: "", logo: null });
                  setShowEquipeModal(true);
                }}
                className="btn-basketball text-xs"
              >
                + Équipe
              </button>
            )}
            {isOwner && (
              <button
                onClick={() => setShowMatchModal(true)}
                className="btn-basketball"
              >
                + Nouveau Match
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-4 mb-8 border-b border-white/5 no-print">
        {[
          { id: "classement", label: "Classement", icon: "📊" },
          { id: "matchs", label: "Calendrier", icon: "🏀" },
          { id: "rosters", label: "Équipes", icon: "🛡️" },
          { id: "brackets", label: "Phase Finale", icon: "🏆" },
          ...(isOwner ? [{ id: "settings", label: "Paramètres", icon: "⚙️" }] : [])
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 px-2 font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center gap-2 border-b-2 ${activeTab === tab.id ? 'text-primary-orange border-primary-orange' : 'text-gray-500 border-transparent hover:text-white'}`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-Tabs Navigation for Classement */}
      {activeTab === "classement" && (
        <div className="flex gap-4 mb-6 no-print">
          <button
            onClick={() => setSubTabClassement('poule')}
            className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all ${subTabClassement === 'poule' ? 'bg-primary-orange text-white border-2 border-primary-orange' : 'bg-white/5 text-gray-400 hover:text-white border-2 border-white/10'}`}
          >
            Saison Régulière (Poules)
          </button>
          <button
            onClick={() => setSubTabClassement('elimination')}
            className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all ${subTabClassement === 'elimination' ? 'bg-primary-orange text-white border-2 border-primary-orange' : 'bg-white/5 text-gray-400 hover:text-white border-2 border-white/10'}`}
          >
            Phases Éliminatoires
          </button>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        
        {activeTab === "classement" && (
          <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-3">
                <span className="text-primary-orange">📊</span> {subTabClassement === 'poule' ? "Classement Général" : "Classement Éliminatoires"}
              </h2>
              <div className="flex gap-4 text-[10px] font-black uppercase tracking-tighter text-gray-500">
                <span title="Victoire (2pts)">V: 2pts</span>
                <span title="Défaite (1pt)">D: 1pt</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left stats-table border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 text-center w-12">#</th>
                    <th className="p-4">Équipe</th>
                    <th className="p-4 text-center">J</th>
                    <th className="p-4 text-center">G</th>
                    <th className="p-4 text-center">P</th>
                    <th className="p-4 text-center">Diff</th>
                    <th className="p-4 text-center bg-primary-orange/20 text-primary-orange">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {classement.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-10 text-center text-gray-500 italic">En attente des premiers coups de sifflet...</td>
                    </tr>
                  ) : (
                    classement.map((entry, index) => (
                      <tr key={entry.id} className="group">
                        <td className="p-4 text-center">
                          <span className={`inline-flex w-7 h-7 items-center justify-center rounded font-black italic text-xs ${index < 3 ? 'bg-primary-orange text-white' : 'bg-white/5'}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-white/5 p-1 border border-white/10 flex items-center justify-center overflow-hidden">
                              {getImageUrl(equipes.find(e => e.id === entry.id)?.logo) ? (
                                <img src={getImageUrl(equipes.find(e => e.id === entry.id).logo)} className="w-full h-full object-cover" alt="logo" />
                              ) : (
                                <span className="text-lg">🛡️</span>
                              )}
                            </div>
                            <span className="font-black italic text-lg tracking-tight uppercase group-hover:text-primary-orange transition-colors">{entry.nom}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-400">{entry.joues}</td>
                        <td className="p-4 text-center">
                          <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded text-xs font-black">{entry.gagnes}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded text-xs font-black">{entry.perdus}</span>
                        </td>
                        <td className="p-4 text-center font-mono font-bold italic text-gray-500">{entry.difference > 0 ? `+${entry.difference}` : entry.difference}</td>
                        <td className="p-4 text-center font-black text-2xl bg-white/3 italic text-primary-orange">{entry.points}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "classement" && (
          <div className="glass-card overflow-hidden h-fit">
            <div className="p-8 border-b border-white/5">
              <h2 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-3">
                <span className="text-primary-orange">👑</span> {subTabClassement === 'poule' ? "Leaders Évaluation" : "Leaders Phase Finale"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {tournamentMVP.length === 0 ? (
                <div className="text-center py-10 opacity-30 italic">Statistiques en cours d'analyse...</div>
              ) : (
                tournamentMVP.map((player, index) => (
                  <div key={player.id} className="relative group bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-primary-orange/50 transition-all overflow-hidden">
                    <div className={`absolute top-0 right-0 p-1 px-3 text-[9px] font-black uppercase italic ${index === 0 ? 'bg-primary-orange text-white' : 'bg-gray-800 text-gray-500'}`}>
                      RANK #{index + 1}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-black italic text-primary-orange/50"># {player.numero}</div>
                      <div>
                        <h3 className="font-black italic text-lg uppercase tracking-widest">{player.nom}</h3>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">{player.equipe}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex gap-4">
                        <div>
                          <span className="block text-[8px] text-gray-500 font-black uppercase">Moy. Eval</span>
                          <span className="text-xl font-black italic text-primary-orange">{player.moyenne_eval}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-gray-500 font-black uppercase">Points Total</span>
                          <span className="text-xl font-black italic">{player.total_points}</span>
                        </div>
                      </div>
                      <div className="text-[9px] font-bold text-gray-600 bg-white/5 px-2 py-1 rounded">
                        {player.nb_matchs} MATCHS
                      </div>
                    </div>
                  </div>
                ) || [])
              )}
              <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic text-center text-balance mt-4">
                * Formule: (PTS + AST + REB + BLK) - FOU
              </p>
            </div>
          </div>
        )}
      </div>

      {activeTab === "rosters" && (
        <div className="animate-fade-in">
          <h2 className="text-4xl font-black italic mb-6 card-title-accent uppercase">🛡️ Rosters & Équipes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {equipes.map((equipe) => (
              <div key={equipe.id} className="glass-card group overflow-hidden border-b-4 border-b-primary-orange/50">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl shadow-black/40 overflow-hidden ring-4 ring-white/5">
                        {getImageUrl(equipe.logo) ? (
                          <img src={getImageUrl(equipe.logo)} className="w-full h-full object-cover" alt="logo" />
                        ) : (
                          <span className="text-2xl">🛡️</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none">{equipe.nom}</h3>
                        <p className="text-[10px] font-bold text-gray-400 mt-2 tracking-widest uppercase italic">Effectif: {joueursParEquipe[equipe.id]?.length || 0} joueurs</p>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setShowJoueurModal(equipe.id)} className="bg-primary-orange/10 p-2 rounded-lg text-primary-orange hover:bg-primary-orange hover:text-white transition-all">👤+</button>
                        <button onClick={() => handleEditEquipe(equipe)} className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all">✎</button>
                        <button onClick={() => handleDeleteEquipe(equipe.id)} className="bg-red-500/10 p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all">✕</button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {joueursParEquipe[equipe.id]?.length > 0 ? (
                      joueursParEquipe[equipe.id].map(joueur => (
                        <div key={joueur.id} className="flex justify-between items-center p-3 rounded-xl bg-white/3 border border-white/5 group/player">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center">
                              {getImageUrl(joueur.photo) ? (
                                <img src={getImageUrl(joueur.photo)} className="w-full h-full object-cover" alt="photo" />
                              ) : (
                                <span className="text-lg font-black text-gray-700">👤</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-primary-orange font-black italic text-xs">#{joueur.numero_maillot}</span>
                                <span className="font-bold text-sm tracking-tight text-white">{joueur.prenom} {joueur.nom}</span>
                              </div>
                            </div>
                          </div>
                          {isOwner && (
                            <div className="flex gap-2 opacity-0 group-hover/player:opacity-100 transition-all">
                              <button onClick={() => handleEditJoueur(joueur, equipe.id)} className="text-blue-400 hover:text-blue-500 transition-all">✎</button>
                              <button onClick={() => handleDeleteJoueur(joueur.id)} className="text-red-400 hover:text-red-500 transition-all">✕</button>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-600 italic font-bold text-center py-4">Roster vide. Recrutement nécessaire.</p>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={() => toggleEquipe(equipe.id)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors">
                  Détails Effectif {equipesExpanded[equipe.id] ? '▲' : '▼'}
                </button>
              </div>
            ))}
            {isOwner && (
              <button 
                onClick={() => setShowEquipeModal(true)}
                className="border-4 border-dashed border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary-orange/30 hover:bg-primary-orange/5 transition-all group min-h-[300px]"
              >
                <span className="text-4xl text-gray-700 group-hover:text-primary-orange transition-colors">➕</span>
                <span className="font-black italic text-gray-600 uppercase tracking-widest group-hover:text-white transition-colors">Nouvelle Équipe</span>
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "matchs" && (
        <div className="animate-fade-in">
          <h2 className="text-4xl font-black italic mb-6 card-title-accent uppercase">🏀 Calendrier des Matchs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matchs.filter(m => m.phase === 'poule').map((match) => (
              <MatchCard key={match.id} match={match} equipes={equipes} onDelete={handleDeleteMatch} isOwner={isOwner} />
            ))}
            {matchs.filter(m => m.phase === 'poule').length === 0 && (
              <div className="col-span-2 glass-card p-10 text-center opacity-40">Aucun match programmé en phase de poule.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "brackets" && (
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-white/5 pb-4">
            <h2 className="text-4xl font-black italic card-title-accent uppercase flex items-center gap-4">
              🏆 Brackets de la Phase Finale
            </h2>
            {allPouleMatchsFinished && isOwner && hasPlayoffMatchs && (
              <button
                onClick={async () => {
                  if (window.confirm("Êtes-vous sûr de vouloir réinitialiser TOUTES les phases finales et revenir à la phase de poules ? Tous les matchs éliminatoires seront supprimés.")) {
                    try {
                      setLoading(true);
                      await resetPlayoffs(slug);
                      alert("Les phases finales ont été réinitialisées.");
                      loadData();
                    } catch (err) {
                      console.error("Erreur réinitialisation playoffs:", err);
                      alert("Erreur lors de la réinitialisation des playoffs.");
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs tracking-wider transition-all flex items-center gap-2 hover:scale-105"
              >
                🔄 Réinitialiser les Playoffs
              </button>
            )}
          </div>
          
          {!allPouleMatchsFinished ? (
            <div className="glass-card p-12 text-center max-w-lg mx-auto">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-2xl font-black uppercase italic text-white mb-2">Phase Finale Verrouillée</h3>
              <p className="text-gray-400 text-sm mb-6">
                Vous devez d'abord programmer et terminer tous les matchs de la phase de poules avant d'accéder aux phases éliminatoires.
              </p>
              {!hasPouleMatchs ? (
                <span className="text-[10px] font-black text-primary-orange uppercase tracking-widest bg-primary-orange/10 px-3 py-1.5 rounded-full">Aucun match de poule programmé</span>
              ) : (
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-full">
                  Matchs restants : {pouleMatchs.filter(m => m.statut !== 'termine').length}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-12 max-w-5xl mx-auto">
              {isOwner && !hasPlayoffMatchs && (
                <div className="bg-white/5 border border-primary-orange/20 rounded-3xl p-10 text-center max-w-xl mx-auto shadow-2xl">
                  <div className="text-5xl mb-4">🏆</div>
                  <h3 className="text-2xl font-black uppercase italic text-white mb-2">Prêt pour la Phase Finale</h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Tous les matchs de la phase de poule sont terminés. Vous pouvez maintenant générer automatiquement les rencontres éliminatoires basées sur le classement officiel.
                  </p>
                  <button
                    onClick={handleGeneratePlayoffs}
                    className="btn-basketball px-10 py-4 text-xs font-black uppercase tracking-widest"
                  >
                    🚀 Générer le Tableau Final
                  </button>
                </div>
              )}
 
              {/* Phase finale structure */}
              {[
                { id: '8eme', label: '8èmes de finale', active: tournoi.has_8emes },
                { id: 'quart', label: 'Quarts de finale', active: tournoi.has_quarts },
                { id: 'demi', label: 'Demi-finales', active: tournoi.has_demis },
                { id: 'finale', label: 'La Grande Finale', active: tournoi.has_finale }
              ].filter(p => p.active).map((phase, pIdx) => (
                <div key={phase.id} className="relative">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="bg-primary-orange w-12 h-1 text-white"></span>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{phase.label}</h3>
                    {isOwner && (
                      <button 
                        onClick={() => {
                          setMatchForm({ ...matchForm, phase: phase.id });
                          setShowMatchModal(true);
                        }}
                        className="ml-auto bg-white/5 hover:bg-primary-orange p-2 px-4 rounded-xl text-[10px] font-black transition-all"
                      >
                        + CRÉER MATCH {phase.id.toUpperCase()}
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {matchs.filter(m => m.phase === phase.id).map(match => (
                      <MatchCard key={match.id} match={match} equipes={equipes} onDelete={handleDeleteMatch} isOwner={isOwner} />
                    ))}
                    {matchs.filter(m => m.phase === phase.id).length === 0 && (
                      <div className="col-span-2 bg-white/3 border-2 border-dashed border-white/5 rounded-3xl p-8 text-center opacity-30 italic font-bold">
                        Matchs de {phase.label} non programmés.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && isOwner && (
        <div className="animate-fade-in max-w-3xl mx-auto glass-card p-10 border border-white/5 relative">
          <h2 className="text-4xl font-black italic mb-8 card-title-accent uppercase">
            ⚙️ Paramètres du Tournoi
          </h2>
          <form onSubmit={handleSaveSettings} className="space-y-8">
            <div className="border-b border-white/5 pb-6">
              <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">
                Configuration Générale
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                    Limite de Fautes par Joueur
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={settingsForm.limite_fautes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, limite_fautes: parseInt(e.target.value) || 5 })}
                    className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="border-b border-white/5 pb-6">
              <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">
                Phases Finales Actives
              </h3>
              <p className="text-xs text-gray-500 mb-6 italic">
                * Note : Modifier la structure des phases finales réinitialisera la progression des playoffs.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: 'has_8emes', label: '8èmes' },
                  { key: 'has_quarts', label: 'Quarts' },
                  { key: 'has_demis', label: 'Demis' },
                  { key: 'has_finale', label: 'Finale' }
                ].map(phase => (
                  <label key={phase.key} className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 p-5 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-primary-orange/50 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={settingsForm[phase.key]}
                      onChange={(e) => setSettingsForm({ ...settingsForm, [phase.key]: e.target.checked })}
                      className="accent-primary-orange w-5 h-5"
                    />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      {phase.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">
                Format des Séries (Nombre de Victoires)
              </h3>
              <p className="text-xs text-gray-500 mb-6 italic">
                * Définissez le nombre de victoires requises pour remporter une série à chaque étape (ex: 1 pour match unique, 2 pour un Best-of-3, 3 pour un Best-of-5).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settingsForm.has_8emes && (
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                      Victoires requises en 8èmes
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={settingsForm.victoires_requises_8eme}
                      onChange={(e) => setSettingsForm({ ...settingsForm, victoires_requises_8eme: parseInt(e.target.value) || 1 })}
                      className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                    />
                  </div>
                )}
                {settingsForm.has_quarts && (
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                      Victoires requises en Quarts
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={settingsForm.victoires_requises_quart}
                      onChange={(e) => setSettingsForm({ ...settingsForm, victoires_requises_quart: parseInt(e.target.value) || 1 })}
                      className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                    />
                  </div>
                )}
                {settingsForm.has_demis && (
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                      Victoires requises en Demis
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={settingsForm.victoires_requises_demi}
                      onChange={(e) => setSettingsForm({ ...settingsForm, victoires_requises_demi: parseInt(e.target.value) || 1 })}
                      className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                    />
                  </div>
                )}
                {settingsForm.has_finale && (
                  <div>
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                      Victoires requises en Finale
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={settingsForm.victoires_requises_finale}
                      onChange={(e) => setSettingsForm({ ...settingsForm, victoires_requises_finale: parseInt(e.target.value) || 1 })}
                      className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button type="submit" className="btn-basketball flex-1 py-5 text-sm">
                Sauvegarder les Paramètres
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modals - Simplified & Styled */}
      {showEquipeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-10 w-full max-w-md shadow-2xl animate-fade-in relative ring-8 ring-primary-orange/5">
             <h2 className="text-4xl font-black mb-8 italic tracking-tighter uppercase text-white">{editingEquipeId ? "Éditer l'Équipe" : "Inscrire une Équipe"}</h2>
             <form onSubmit={handleCreateEquipe} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Nom de l'Équipe</label>
                  <input type="text" required value={equipeForm.nom} onChange={(e) => setEquipeForm({...equipeForm, nom: e.target.value})} className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Logo (Badge)</label>
                  <label 
                    className={`cursor-pointer bg-white/5 hover:bg-white/10 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 transition-all group ${isDragging ? 'border-primary-orange bg-primary-orange/10' : 'border-white/10'}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setEquipeForm(prev => ({ ...prev, logo: file }));
                      }
                    }}
                  >
                     <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">🖼️</span>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                       {equipeForm.logo ? equipeForm.logo.name : "Glisser-déposer, coller ou cliquer"}
                     </span>
                     <input type="file" className="hidden" accept="image/*" onChange={(e) => setEquipeForm({...equipeForm, logo: e.target.files[0]})}/>
                  </label>
                </div>
                <div className="flex gap-4 pt-4">
                   <button type="submit" className="btn-basketball flex-1 py-5">{editingEquipeId ? "Mettre à jour" : "Inscrire l'Équipe"}</button>
                  <button type="button" onClick={() => { setShowEquipeModal(false); setEditingEquipeId(null); setEquipeForm({ nom: "", logo: null }); }} className="flex-1 bg-white/5 text-gray-400 py-5 rounded-2xl font-black uppercase tracking-widest">Fermer</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {showMatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-10 w-full max-w-lg shadow-2xl animate-fade-in ring-8 ring-primary-orange/5">
             <h2 className="text-4xl font-black mb-8 italic tracking-tighter uppercase text-white">Organiser Match</h2>
             <form onSubmit={handleCreateMatch} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                      <label className="block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest text-center">Domicile</label>
                      <select required value={matchForm.equipe_domicile} onChange={(e) => setMatchForm({...matchForm, equipe_domicile: e.target.value})} className="w-full px-4 py-4 glass-input rounded-xl focus:outline-none text-center appearance-none">
                        <option value="">Sélectionner</option>
                        {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest text-center">Extérieur</label>
                      <select required value={matchForm.equipe_exterieur} onChange={(e) => setMatchForm({...matchForm, equipe_exterieur: e.target.value})} className="w-full px-4 py-4 glass-input rounded-xl focus:outline-none text-center appearance-none">
                        <option value="">Sélectionner</option>
                        {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nom}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Phase du Match</label>
                      <select required value={matchForm.phase} onChange={(e) => setMatchForm({...matchForm, phase: e.target.value})} className="w-full px-4 py-4 glass-input rounded-xl focus:outline-none appearance-none">
                        <option value="poule">Poule / Saison</option>
                        {tournoi.has_8emes && <option value="8eme">8ème de finale</option>}
                        {tournoi.has_quarts && <option value="quart">Quart de finale</option>}
                        {tournoi.has_demis && <option value="demi">Demi-finale</option>}
                        {tournoi.has_finale && <option value="finale">Finale</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Coup d'envoi</label>
                      <input type="datetime-local" value={matchForm.date_match} onChange={(e) => setMatchForm({...matchForm, date_match: e.target.value})} className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"/>
                    </div>
                  </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="btn-basketball flex-1 py-5">Programmer la Rencontre</button>
                  <button type="button" onClick={() => setShowMatchModal(false)} className="flex-1 bg-white/5 text-gray-400 py-5 rounded-2xl font-black uppercase tracking-widest">Annuler</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {showJoueurModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-10 w-full max-w-md shadow-2xl animate-fade-in ring-8 ring-primary-orange/5">
             <h2 className="text-4xl font-black mb-8 italic tracking-tighter uppercase text-white text-center">{editingJoueurId ? "Éditer Joueur" : "Nouveau Joueur"}</h2>
             <form onSubmit={(e) => handleCreateJoueur(e, showJoueurModal)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest">Prénom</label>
                    <input type="text" required value={joueurForm.prenom} onChange={(e) => setJoueurForm({...joueurForm, prenom: e.target.value})} className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest">Nom</label>
                    <input type="text" required value={joueurForm.nom} onChange={(e) => setJoueurForm({...joueurForm, nom: e.target.value})} className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"/>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest">Numéro Maillot</label>
                  <input type="number" min="0" required value={joueurForm.numero_maillot} onChange={(e) => setJoueurForm({...joueurForm, numero_maillot: e.target.value})} className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none" placeholder="Ex: 23, 30..."/>
                </div>
                <div>
                  <label className="block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest">Photo du Joueur</label>
                  <label 
                    className={`cursor-pointer bg-white/5 hover:bg-white/10 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 transition-all group ${isDragging ? 'border-primary-orange bg-primary-orange/10' : 'border-white/10'}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setJoueurForm(prev => ({ ...prev, photo: file }));
                      }
                    }}
                  >
                     <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">📸</span>
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                       {joueurForm.photo ? joueurForm.photo.name : "Glisser-déposer, coller ou cliquer"}
                     </span>
                     <input type="file" className="hidden" accept="image/*" onChange={(e) => setJoueurForm({...joueurForm, photo: e.target.files[0]})}/>
                  </label>
                </div>
                <div className="flex gap-4 pt-4">
                   <button type="submit" className="btn-basketball flex-1 py-5">{editingJoueurId ? "Sauvegarder" : "Ajouter le Joueur"}</button>
                  <button type="button" onClick={() => { setShowJoueurModal(null); setEditingJoueurId(null); setJoueurForm({ prenom: "", nom: "", numero_maillot: "", photo: null }); }} className="flex-1 bg-white/5 text-gray-400 py-5 rounded-2xl font-black uppercase tracking-widest">Annuler</button>
                </div>
             </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function MatchCard({ match, equipes, onDelete, isOwner }) {
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path}`;
  };

  return (
    <div className="glass-card overflow-hidden group">
      <div className="flex items-stretch bg-white/3">
        <div className="flex-1 p-6 text-center border-r border-white/5">
          <div className="w-12 h-12 rounded-xl bg-white p-1 mx-auto mb-3 shadow-lg flex items-center justify-center overflow-hidden">
             {getImageUrl(equipes.find(e => e.id === match.equipe_domicile)?.logo) ? (
              <img src={getImageUrl(equipes.find(e => e.id === match.equipe_domicile).logo)} className="w-full h-full object-cover" />
            ) : <span className="text-xl">🛡️</span>}
          </div>
          <h4 className="font-black italic text-sm uppercase leading-tight mb-1 truncate">{match.equipe_domicile_nom}</h4>
        </div>

        <div className="w-24 flex flex-col items-center justify-center p-2 bg-primary-orange/5">
          {match.statut === "termine" ? (
            <div className="text-2xl font-black italic">{match.score_domicile}:{match.score_exterieur}</div>
          ) : (
             <div className="text-lg font-black italic text-gray-600">VS</div>
          )}
          <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest mt-2 ${match.statut === 'en_cours' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-gray-400'}`}>
             {match.statut === "en_cours" ? "Live" : match.statut === "termine" ? "Terminé" : "À venir"}
          </div>
        </div>

        <div className="flex-1 p-6 text-center border-l border-white/5">
          <div className="w-12 h-12 rounded-xl bg-white p-1 mx-auto mb-3 shadow-lg flex items-center justify-center overflow-hidden">
            {getImageUrl(equipes.find(e => e.id === match.equipe_exterieur)?.logo) ? (
              <img src={getImageUrl(equipes.find(e => e.id === match.equipe_exterieur).logo)} className="w-full h-full object-cover" />
            ) : <span className="text-xl">🛡️</span>}
          </div>
          <h4 className="font-black italic text-sm uppercase leading-tight mb-1 truncate">{match.equipe_exterieur_nom}</h4>
        </div>
      </div>
      <div className="p-3 bg-black/40 flex justify-between items-center px-6">
        <div className="text-[8px] font-black text-gray-500 uppercase italic">
          {match.date_match ? new Date(match.date_match).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : "À définir"}
        </div>
        <div className="flex gap-2">
          <Link to={`/match/${match.id}`} className="px-3 py-1.5 rounded-lg bg-primary-orange text-white font-black italic uppercase text-[8px] tracking-widest hover:scale-105 transition-all">Stats</Link>
          {/* {match.statut !== 'termine' && (
             <Link to={`/match/${match.id}/live`} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-black italic uppercase text-[8px] tracking-widest hover:scale-105 transition-all ring-2 ring-red-600/20">Live</Link>
          )} */}
          {isOwner && (
            <button onClick={() => onDelete(match.id)} className="text-gray-500 hover:text-red-500 transition-all font-black text-xs ml-2">✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DetailTournoi;
