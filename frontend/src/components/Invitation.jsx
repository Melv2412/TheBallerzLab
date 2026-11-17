import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getImageUrl, getInvitation, messageErreur, rejoindreEquipe } from "../api";
import { useAuth } from "../AuthContext";
import { erreurInscription, suggestions } from "./invitation/invitation";

const CHAMP =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-orange transition-all font-bold";

function LigneJoueur({ joueur, action }) {
  return (
    <li className="flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-3">
      <span className="font-bold truncate">
        <span className="text-primary-orange mr-2">#{joueur.numero_maillot}</span>
        {joueur.prenom} {joueur.nom}
        {joueur.compte_lie && (
          <span className="ml-2 text-[10px] font-black uppercase text-green-400" title="Compte relié">
            ✓ compte relié
          </span>
        )}
      </span>
      {action}
    </li>
  );
}

// Page du lien envoyé par le capitaine : chaque joueur rejoint son équipe avec son compte
export default function Invitation() {
  const { code } = useParams();
  const { user, rafraichirProfil } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [form, setForm] = useState({ numero: "", prenom: "", nom: "" });
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(
    () =>
      getInvitation(code)
        .then(({ data }) => setInvitation(data))
        .catch(() => setIntrouvable(true)),
    [code],
  );

  useEffect(() => {
    charger();
  }, [charger, user?.username]);

  if (introuvable) {
    return (
      <div className="glass-card max-w-lg mx-auto p-8 text-center">
        <p className="text-4xl mb-3">🔗</p>
        <h1 className="text-2xl font-black uppercase">Lien invalide</h1>
        <p className="text-gray-400 mt-2">
          Ce lien n'existe pas ou a été remplacé par l'organisateur. Demande le nouveau lien à ton capitaine.
        </p>
      </div>
    );
  }
  if (!invitation) return <div className="text-center py-10 animate-pulse">Chargement de l'invitation...</div>;

  const { equipe, tournoi, joueurs, moi } = invitation;
  const fiche = moi?.fiche;
  const inscription = moi?.inscription;
  const libres = joueurs.filter((j) => !j.compte_lie);
  const proposes = suggestions(joueurs, fiche);
  const suite = encodeURIComponent(`/invitation/${code}`);
  const logo = getImageUrl(equipe.logo);

  const envoyer = async (donnees) => {
    setErreur("");
    setEnvoi(true);
    try {
      await rejoindreEquipe(code, donnees);
      await rafraichirProfil();
      await charger();
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de rejoindre l'équipe."));
    } finally {
      setEnvoi(false);
    }
  };

  const cEstMoi = (joueur) => {
    if (window.confirm(`Confirmer : tu es #${joueur.numero_maillot} ${joueur.prenom} ${joueur.nom} ?`)) {
      envoyer({ joueur: joueur.id });
    }
  };

  const sInscrire = (e) => {
    e.preventDefault();
    const probleme = erreurInscription(form, Boolean(fiche), joueurs);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    envoyer({ numero_maillot: Number(form.numero), prenom: form.prenom, nom: form.nom });
  };

  const boutonCEstMoi = (joueur) => (
    <button
      onClick={() => cEstMoi(joueur)}
      disabled={envoi}
      className="shrink-0 text-xs font-black uppercase bg-primary-orange/20 text-primary-orange px-3 py-2 rounded-lg hover:bg-primary-orange hover:text-white transition-all"
    >
      C'est moi
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="glass-card p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
          {logo ? <img src={logo} alt={equipe.nom} className="w-full h-full object-cover" /> : <span className="text-3xl">🛡️</span>}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Invitation à rejoindre</p>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter truncate">{equipe.nom}</h1>
          <Link to={`/tournoi/${tournoi.slug}`} className="text-sm text-primary-orange font-bold hover:underline">
            {tournoi.nom}
          </Link>
          <span className="text-sm text-gray-400">
            {" "}
            · {new Date(tournoi.date_debut).toLocaleDateString("fr-FR", { dateStyle: "long" })}
          </span>
        </div>
      </header>

      {erreur && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm font-bold">{erreur}</div>
      )}

      {!user && (
        <section className="glass-card p-6 text-center space-y-4">
          <p className="text-gray-300">
            Connecte-toi ou crée ton compte (avec ton email) pour rejoindre l'équipe. Tes stats de tous tes tournois
            seront regroupées sur ton profil.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link to={`/login?suite=${suite}`} className="bg-white/5 border border-white/10 hover:bg-white/10 py-3 rounded-xl font-black uppercase text-xs">
              Se connecter
            </Link>
            <Link to={`/register?suite=${suite}`} className="btn-basketball py-3 text-xs">
              Créer mon compte
            </Link>
          </div>
        </section>
      )}

      {user && inscription && (
        <section className="glass-card p-6 text-center space-y-3">
          {inscription.equipe === equipe.id ? (
            <p className="text-lg font-black text-green-400">✅ Tu fais partie de l'équipe (#{inscription.numero_maillot})</p>
          ) : (
            <p className="text-gray-300">
              Tu joues déjà dans ce tournoi avec l'équipe <span className="font-black text-white">{inscription.equipe_nom}</span>.
              Si c'est une erreur, contacte l'organisateur.
            </p>
          )}
          {fiche && (
            <Link to={`/athlete/${fiche.id}`} className="inline-block text-primary-orange font-bold hover:underline">
              Voir mon profil →
            </Link>
          )}
        </section>
      )}

      {user && !inscription && (
        <>
          {proposes.map((joueur) => (
            <section key={joueur.id} className="glass-card p-6 border-primary-orange/40 space-y-3">
              <p className="font-black uppercase">C'est toi ?</p>
              <ul>
                <LigneJoueur joueur={joueur} action={boutonCEstMoi(joueur)} />
              </ul>
            </section>
          ))}

          {libres.length > 0 && (
            <section className="glass-card p-6 space-y-3">
              <h2 className="font-black uppercase">Déjà dans la liste ?</h2>
              <p className="text-xs text-gray-400">L'organisateur t'a peut-être déjà ajouté : choisis ton nom.</p>
              <ul className="space-y-2">
                {libres.map((joueur) => (
                  <LigneJoueur key={joueur.id} joueur={joueur} action={boutonCEstMoi(joueur)} />
                ))}
              </ul>
            </section>
          )}

          <section className="glass-card p-6 space-y-3">
            <h2 className="font-black uppercase">{libres.length > 0 ? "Pas dans la liste ?" : "Rejoindre l'équipe"}</h2>
            {invitation.inscriptions_ouvertes ? (
              <form onSubmit={sInscrire} className="space-y-3">
                {fiche ? (
                  <p className="text-sm text-gray-300">
                    Tu seras inscrit en tant que <span className="font-black text-white">{fiche.prenom} {fiche.nom}</span>.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <input className={CHAMP} placeholder="Prénom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
                    <input className={CHAMP} placeholder="Nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                  </div>
                )}
                <input
                  className={CHAMP}
                  type="number"
                  min="0"
                  max="99"
                  inputMode="numeric"
                  placeholder="Numéro de maillot"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                />
                <button type="submit" disabled={envoi} className="w-full btn-basketball py-3 text-sm">
                  {envoi ? "Inscription..." : "Rejoindre l'équipe"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-gray-400">
                Les inscriptions de ce tournoi sont fermées. Demande à l'organisateur de t'ajouter.
              </p>
            )}
          </section>
        </>
      )}

      <section className="glass-card p-6 space-y-3">
        <h2 className="font-black uppercase">
          Effectif <span className="text-gray-500">({joueurs.length})</span>
        </h2>
        {joueurs.length === 0 ? (
          <p className="text-sm text-gray-400">Personne pour le moment : sois le premier !</p>
        ) : (
          <ul className="space-y-2">
            {joueurs.map((joueur) => (
              <LigneJoueur key={joueur.id} joueur={joueur} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
