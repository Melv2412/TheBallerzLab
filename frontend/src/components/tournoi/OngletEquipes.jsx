import React, { useState } from "react";
import { Link } from "react-router-dom";
import { delierJoueur, lienInvitation, messageErreur, updateTournoi } from "../../api";
import { libellePostes } from "../../postes";
import { ImageSecours } from "../ImageSecours";
import { IconeAjoutJoueur, IconeJoueur } from "../Icones";
import { InscriptionsEquipes } from "./InscriptionsEquipes";
import { LogoEquipe } from "./LogoEquipe";
import { aDesMatchsRestants, equipeAJoue } from "./phases";
import { useRetours } from "../retours/contexte";

// Lien d'invitation d'une équipe, à envoyer au capitaine (WhatsApp…) : chaque joueur s'y inscrit avec son compte
function LienInvitation({ equipe }) {
  const [code, setCode] = useState(null);
  const [message, setMessage] = useState("");
  const retours = useRetours();

  const obtenir = async (regenerer = false) => {
    if (
      regenerer &&
      !(await retours.confirmer({ titre: "Nouveau lien ?", message: "L'ancien lien ne marchera plus.", libelleOk: "Créer" }))
    )
      return;
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

// Colonne de gauche : toutes les équipes, celle affichée en surbrillance (défile à l'horizontale sur téléphone)
function ListeEquipes({ equipes, joueursParEquipe, active, onChoisir, onNouvelleEquipe }) {
  return (
    <div className="glass-card p-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
      {equipes.map((equipe) => {
        const nb = (joueursParEquipe[equipe.id] || []).filter((j) => !j.retire).length;
        const estActive = equipe.id === active;
        return (
          <button
            key={equipe.id}
            onClick={() => onChoisir(equipe.id)}
            aria-pressed={estActive}
            className={`shrink-0 lg:w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${estActive ? "border-primary-orange bg-primary-orange/10" : "border-transparent bg-white/5 hover:bg-white/10"}`}
          >
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden">
              <LogoEquipe equipe={equipe} icone="text-lg" />
            </div>
            <div className="min-w-0">
              <span className={`block font-black italic uppercase text-sm truncate max-w-[160px] lg:max-w-none ${estActive ? "text-primary-orange" : "text-white"}`}>
                {equipe.nom}
              </span>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {nb} joueur{nb > 1 ? "s" : ""}
              </span>
            </div>
          </button>
        );
      })}
      {onNouvelleEquipe && (
        <button
          onClick={onNouvelleEquipe}
          className="shrink-0 lg:w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-white/10 hover:border-primary-orange/40 hover:bg-primary-orange/5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all"
        >
          ➕ Nouvelle équipe
        </button>
      )}
    </div>
  );
}

// Colonne de droite : la fiche de l'équipe choisie et son effectif en tableau
function FicheEquipe({
  equipe,
  inscrits,
  matchs,
  isOwner,
  peutDelier,
  onDelier,
  onEditerEquipe,
  onSupprimerEquipe,
  onNouveauJoueur,
  onEditerJoueur,
  onSupprimerJoueur,
  onRetirerJoueur,
  onReintegrerJoueur,
  onForfaitGeneral,
}) {
  const joueurs = inscrits.filter((j) => !j.retire);
  const retires = inscrits.filter((j) => j.retire);
  const lies = joueurs.filter((j) => j.compte_lie).length;
  const colonneCompte = isOwner || peutDelier;

  return (
    <div className="glass-card overflow-hidden border-b-4 border-b-primary-orange/50 min-w-0">
      <div className="p-5 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-4 items-center min-w-0">
          <div className="w-16 h-16 shrink-0 rounded-2xl bg-white p-2 flex items-center justify-center shadow-xl shadow-black/40 overflow-hidden ring-4 ring-white/5">
            <LogoEquipe equipe={equipe} icone="text-2xl" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl sm:text-3xl font-black italic uppercase tracking-tighter leading-none break-words">
              {equipe.nom}
            </h3>
            <p className="text-[10px] font-bold text-gray-400 mt-2 tracking-widest uppercase italic">
              {joueurs.length} joueur{joueurs.length > 1 ? "s" : ""} · {lies} compte{lies > 1 ? "s" : ""} lié{lies > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onNouveauJoueur(equipe.id)}
              className="bg-primary-orange/10 p-2 rounded-lg text-primary-orange hover:bg-primary-orange hover:text-white transition-all"
              aria-label="Ajouter un joueur"
              title="Ajouter un joueur"
            >
              <IconeAjoutJoueur className="text-lg" />
            </button>
            <button
              onClick={() => onEditerEquipe(equipe)}
              className="bg-blue-500/10 p-2 rounded-lg text-blue-500 hover:bg-blue-500 hover:text-white transition-all"
              aria-label="Modifier l'équipe"
            >
              ✎
            </button>
            {!equipeAJoue(matchs, equipe.id) && (
              <button
                onClick={() => onSupprimerEquipe(equipe.id)}
                className="bg-red-500/10 p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition-all"
                aria-label="Supprimer l'équipe"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="px-5 sm:px-6 pt-5 grid sm:grid-cols-2 gap-x-3">
          <LienInvitation equipe={equipe} />
          {aDesMatchsRestants(matchs, equipe.id) && (
            <button
              onClick={() => onForfaitGeneral(equipe)}
              className="w-full mb-4 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-400 transition-all self-start"
            >
              Forfait général
            </button>
          )}
        </div>
      )}

      <div className="p-5 sm:p-6 pt-2 sm:pt-2 overflow-x-auto">
        {joueurs.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-left border-b border-white/5">
                <th className="py-3 pr-3 w-12">N°</th>
                <th className="py-3 pr-3">Joueur</th>
                {colonneCompte && <th className="py-3 pr-3">Compte</th>}
                {colonneCompte && <th className="py-3 text-right sr-only sm:not-sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {joueurs.map((joueur) => (
                <tr key={joueur.id} className="border-b border-white/5 last:border-0 hover:bg-white/3">
                  <td className="py-3 pr-3 text-primary-orange font-black italic">#{joueur.numero_maillot}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center">
                        <ImageSecours
                          src={joueur.photo_affichee}
                          alt="photo"
                          secours={<span className="text-base text-gray-500"><IconeJoueur /></span>}
                        />
                      </div>
                      <Link
                        to={`/athlete/${joueur.athlete}`}
                        className="font-bold tracking-tight text-white hover:text-primary-orange transition-colors truncate"
                      >
                        {joueur.prenom} {joueur.nom}
                      </Link>
                      {libellePostes(joueur.postes) && (
                        <span className="text-[10px] text-gray-500 truncate">{libellePostes(joueur.postes)}</span>
                      )}
                    </div>
                  </td>
                  {colonneCompte && (
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {joueur.compte_lie ? (
                        <span className="text-green-400 text-[10px] font-black uppercase tracking-widest">✓ Lié</span>
                      ) : (
                        <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest">Non lié</span>
                      )}
                    </td>
                  )}
                  {colonneCompte && (
                    <td className="py-3">
                      <div className="flex justify-end items-center gap-3 whitespace-nowrap">
                        {peutDelier && joueur.compte_lie && (
                          <button
                            onClick={() => onDelier(joueur)}
                            className="text-gray-400 hover:text-white transition-all text-[10px] font-black uppercase"
                          >
                            Délier
                          </button>
                        )}
                        {isOwner && (
                          <>
                            <button
                              onClick={() => onEditerJoueur(joueur, equipe.id)}
                              className="text-blue-400 hover:text-blue-500 transition-all"
                              aria-label={`Modifier ${joueur.prenom} ${joueur.nom}`}
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
                                aria-label={`Supprimer ${joueur.prenom} ${joueur.nom}`}
                              >
                                ✕
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-gray-600 italic font-bold text-center py-6">Roster vide. Recrutement nécessaire.</p>
        )}

        {retires.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Retirés de l'effectif</p>
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
                      <button onClick={() => onEditerJoueur(joueur, equipe.id)} className="text-blue-400 hover:text-blue-500 transition-all">
                        ✎
                      </button>
                      {!joueur.a_des_stats && (
                        <button onClick={() => onSupprimerJoueur(joueur.id)} className="text-red-400 hover:text-red-500 transition-all">
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
  const [choisie, setChoisie] = useState(null);
  const retours = useRetours();
  // Équipe affichée à droite : celle choisie, sinon la première (aussi si elle vient d'être supprimée)
  const equipe = equipes.find((e) => e.id === choisie) || equipes[0];

  const basculerInscriptions = async () => {
    try {
      await updateTournoi(tournoi.slug, { inscriptions_ouvertes: !tournoi.inscriptions_ouvertes });
      onRecharger();
    } catch (error) {
      retours.erreur(messageErreur(error));
    }
  };

  const delier = async (joueur) => {
    const question = `Délier le compte de ${joueur.prenom} ${joueur.nom} ? Le joueur reste dans l'équipe, mais ce compte n'y sera plus relié.`;
    if (!(await retours.confirmer({ message: question, libelleOk: "Délier", danger: true }))) return;
    try {
      await delierJoueur(joueur.id);
      onRecharger();
    } catch (error) {
      retours.erreur(messageErreur(error));
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
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 mb-12 items-start">
        <ListeEquipes
          equipes={equipes}
          joueursParEquipe={joueursParEquipe}
          active={equipe?.id}
          onChoisir={setChoisie}
          onNouvelleEquipe={isOwner ? onNouvelleEquipe : null}
        />
        {equipe ? (
          <FicheEquipe
            key={equipe.id}
            equipe={equipe}
            inscrits={joueursParEquipe[equipe.id] || []}
            matchs={matchs}
            isOwner={isOwner}
            peutDelier={peutDelier}
            onDelier={delier}
            onEditerEquipe={onEditerEquipe}
            onSupprimerEquipe={onSupprimerEquipe}
            onNouveauJoueur={onNouveauJoueur}
            onEditerJoueur={onEditerJoueur}
            onSupprimerJoueur={onSupprimerJoueur}
            onRetirerJoueur={onRetirerJoueur}
            onReintegrerJoueur={onReintegrerJoueur}
            onForfaitGeneral={onForfaitGeneral}
          />
        ) : (
          <div className="glass-card p-10 text-center text-sm text-gray-500 italic font-bold">
            Aucune équipe pour l'instant.
          </div>
        )}
      </div>
    </div>
  );
}
