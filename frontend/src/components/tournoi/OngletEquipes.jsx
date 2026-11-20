import React, { useState } from "react";
import { Link } from "react-router-dom";
import { delierJoueur, lienInvitation, messageErreur, updateTournoi } from "../../api";
import { ImageSecours } from "../ImageSecours";
import { InscriptionsEquipes } from "./InscriptionsEquipes";
import { LogoEquipe } from "./LogoEquipe";
import { aDesMatchsRestants, equipeAJoue } from "./phases";

// Lien d'invitation d'une équipe, à envoyer au capitaine (WhatsApp…) : chaque joueur s'y inscrit avec son compte
function LienInvitation({ equipe }) {
  const [code, setCode] = useState(null);
  const [message, setMessage] = useState("");

  const obtenir = async (regenerer = false) => {
    if (regenerer && !window.confirm("Créer un nouveau lien ? L'ancien ne marchera plus.")) return;
    try {
      const { data } = await lienInvitation(equipe.id, regenerer);
      setCode(data.code);
      setMessage(regenerer ? "Nouveau lien créé." : "");
    } catch (error) {
      setMessage(messageErreur(error, "Impossible d'obtenir le lien."));
    }
  };

  const url = code ? `${window.location.origin}/invitation/${code}` : "";
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié : envoie-le au capitaine.");
    } catch {
      setMessage("Copie impossible : sélectionne le lien à la main.");
    }
  };

  if (!code) {
    return (
      <button
        onClick={() => obtenir()}
        className="w-full mb-4 py-2 rounded-xl bg-primary-orange/10 text-primary-orange text-xs font-black uppercase tracking-widest hover:bg-primary-orange hover:text-white transition-all"
      >
        🔗 Lien d'invitation des joueurs
      </button>
    );
  }
  return (
    <div className="mb-4 p-3 rounded-xl bg-white/5 border border-primary-orange/30 space-y-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        className="w-full bg-black/30 rounded-lg px-2 py-1 text-[11px] text-gray-300 font-mono"
        aria-label="Lien d'invitation"
      />
      <div className="flex gap-2">
        <button onClick={copier} className="flex-1 py-1.5 rounded-lg bg-primary-orange text-white text-[10px] font-black uppercase">
          Copier
        </button>
        <button
          onClick={() => obtenir(true)}
          className="flex-1 py-1.5 rounded-lg bg-white/10 text-gray-300 text-[10px] font-black uppercase hover:bg-white/20"
        >
          Nouveau lien
        </button>
      </div>
      {message && <p className="text-[11px] text-gray-400">{message}</p>}
    </div>
  );
}

export function OngletEquipes({
  tournoi,
  onRecharger,
  equipes,
  matchs,
  joueursParEquipe,
  isOwner,
  peutDelier,
  onNouvelleEquipe,
  onEditerEquipe,
  onSupprimerEquipe,
  onNouveauJoueur,
  onEditerJoueur,
  onSupprimerJoueur,
  onRetirerJoueur,
  onReintegrerJoueur,
  onForfaitGeneral,
}) {
  const [equipesOuvertes, setEquipesOuvertes] = useState({});
  const basculer = (equipeId) => setEquipesOuvertes((prev) => ({ ...prev, [equipeId]: !prev[equipeId] }));

  const basculerInscriptions = async () => {
    try {
      await updateTournoi(tournoi.slug, { inscriptions_ouvertes: !tournoi.inscriptions_ouvertes });
      onRecharger();
    } catch (error) {
      window.alert(messageErreur(error));
    }
  };

  const delier = async (joueur) => {
    const question = `Délier le compte de ${joueur.prenom} ${joueur.nom} ? Le joueur reste dans l'équipe, mais ce compte n'y sera plus relié.`;
    if (!window.confirm(question)) return;
    try {
      await delierJoueur(joueur.id);
      onRecharger();
    } catch (error) {
      window.alert(messageErreur(error));
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl sm:text-4xl font-black italic mb-6 card-title-accent uppercase">Rosters & Équipes</h2>
      {isOwner && tournoi && (
        <div className="glass-card p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-300">
            <span className="font-black text-white">Inscriptions par lien {tournoi.inscriptions_ouvertes ? "ouvertes" : "fermées"}.</span>{" "}
            {tournoi.inscriptions_ouvertes
              ? "Les capitaines peuvent proposer leur équipe, et les joueurs qui ont le lien de leur équipe peuvent s'y ajouter."
              : "Les joueurs déjà ajoutés peuvent encore relier leur compte ; personne ne peut ajouter d'équipe ni s'ajouter."}
          </p>
          <button
            onClick={basculerInscriptions}
            className="shrink-0 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black uppercase tracking-widest"
          >
            {tournoi.inscriptions_ouvertes ? "Fermer les inscriptions" : "Rouvrir les inscriptions"}
          </button>
        </div>
      )}
      {isOwner && tournoi && <InscriptionsEquipes tournoi={tournoi} onRecharger={onRecharger} />}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {equipes.map((equipe) => {
          const inscrits = joueursParEquipe[equipe.id] || [];
          const joueurs = inscrits.filter((j) => !j.retire);
          const retires = inscrits.filter((j) => j.retire);
          return (
            <div key={equipe.id} className="glass-card group overflow-hidden border-b-4 border-b-primary-orange/50">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl shadow-black/40 overflow-hidden ring-4 ring-white/5">
                      <LogoEquipe equipe={equipe} icone="text-2xl" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter leading-none break-words">
                        {equipe.nom}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-2 tracking-widest uppercase italic">
                        Effectif: {joueurs.length} joueurs
                      </p>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => onNouveauJoueur(equipe.id)}
                        className="bg-primary-orange/10 p-2 rounded-lg text-primary-orange hover:bg-primary-orange hover:text-white transition-all"
                      >
                        👤+
                      </button>
                      <button
                        onClick={() => onEditerEquipe(equipe)}
                        className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
                      >
                        ✎
                      </button>
                      {!equipeAJoue(matchs, equipe.id) && (
                        <button
                          onClick={() => onSupprimerEquipe(equipe.id)}
                          className="bg-red-500/10 p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isOwner && <LienInvitation equipe={equipe} />}
                {isOwner && aDesMatchsRestants(matchs, equipe.id) && (
                  <button
                    onClick={() => onForfaitGeneral(equipe)}
                    className="w-full mb-4 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-all"
                  >
                    Forfait général
                  </button>
                )}

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {joueurs.length > 0 ? (
                    joueurs.map((joueur) => (
                      <div
                        key={joueur.id}
                        className="flex justify-between items-center p-3 rounded-xl bg-white/3 border border-white/5 group/player"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center">
                            <ImageSecours
                              src={joueur.photo_affichee}
                              alt="photo"
                              secours={<span className="text-lg font-black text-gray-700">👤</span>}
                            />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-primary-orange font-black italic text-xs">#{joueur.numero_maillot}</span>
                              <Link
                                to={`/athlete/${joueur.athlete}`}
                                className="font-bold text-sm tracking-tight text-white hover:text-primary-orange transition-colors"
                              >
                                {joueur.prenom} {joueur.nom}
                              </Link>
                              {joueur.compte_lie && (
                                <span className="text-green-400 text-xs font-black" title="Compte relié">
                                  ✓
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {(isOwner || (peutDelier && joueur.compte_lie)) && (
                          <div className="flex gap-3 md:gap-2 md:opacity-0 md:group-hover/player:opacity-100 transition-all shrink-0">
                            {peutDelier && joueur.compte_lie && (
                              <button
                                onClick={() => delier(joueur)}
                                className="text-gray-400 hover:text-white transition-all text-xs"
                                title="Délier le compte"
                              >
                                ⛓
                              </button>
                            )}
                            {isOwner && (
                              <>
                                <button
                                  onClick={() => onEditerJoueur(joueur, equipe.id)}
                                  className="text-blue-400 hover:text-blue-500 transition-all"
                                >
                                  ✎
                                </button>
                                {joueur.a_des_stats ? (
                                  <button
                                    onClick={() => onRetirerJoueur(joueur.id)}
                                    className="text-red-400 hover:text-red-500 transition-all text-[10px] font-black uppercase"
                                  >
                                    Retirer
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onSupprimerJoueur(joueur.id)}
                                    className="text-red-400 hover:text-red-500 transition-all"
                                  >
                                    ✕
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-600 italic font-bold text-center py-4">
                      Roster vide. Recrutement nécessaire.
                    </p>
                  )}
                </div>

                {retires.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                      Retirés de l'effectif
                    </p>
                    <div className="space-y-1">
                      {retires.map((joueur) => (
                        <div key={joueur.id} className="flex justify-between items-center gap-3 px-3 py-1 text-xs text-gray-500">
                          <Link to={`/athlete/${joueur.athlete}`} className="min-w-0 truncate hover:text-white transition-colors">
                            #{joueur.numero_maillot} {joueur.prenom} {joueur.nom}
                          </Link>
                          {isOwner && (
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                onClick={() => onReintegrerJoueur(joueur.id)}
                                className="text-primary-orange hover:text-white transition-all text-[10px] font-black uppercase"
                              >
                                Remettre
                              </button>
                              <button
                                onClick={() => onEditerJoueur(joueur, equipe.id)}
                                className="text-blue-400 hover:text-blue-500 transition-all"
                              >
                                ✎
                              </button>
                              {!joueur.a_des_stats && (
                                <button
                                  onClick={() => onSupprimerJoueur(joueur.id)}
                                  className="text-red-400 hover:text-red-500 transition-all"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => basculer(equipe.id)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors"
              >
                Détails Effectif {equipesOuvertes[equipe.id] ? "▲" : "▼"}
              </button>
            </div>
          );
        })}
        {isOwner && (
          <button
            onClick={onNouvelleEquipe}
            className="border-4 border-dashed border-white/5 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 hover:border-primary-orange/30 hover:bg-primary-orange/5 transition-all group min-h-[300px]"
          >
            <span className="text-4xl text-gray-700 group-hover:text-primary-orange transition-colors">➕</span>
            <span className="font-black italic text-gray-600 uppercase tracking-widest group-hover:text-white transition-colors">
              Nouvelle Équipe
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
