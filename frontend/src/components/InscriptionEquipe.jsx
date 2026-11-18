import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { demanderEquipe, getInscription, messageErreur } from "../api";
import { useAuth } from "../AuthContext";
import { erreurNomEquipe, etapeCapitaine, nettoyerNomEquipe } from "./invitation/inscription";

const CHAMP =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-orange transition-all font-bold";

// Lien d'invitation de l'équipe acceptée, à faire suivre aux joueurs
function LienEquipe({ code }) {
  const [message, setMessage] = useState("");
  const url = `${window.location.origin}/invitation/${code}`;
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié : envoie-le à tes joueurs.");
    } catch {
      setMessage("Copie impossible : sélectionne le lien à la main.");
    }
  };
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm text-gray-300">
        Envoie ce lien à tes joueurs (WhatsApp…) : chacun rejoint l'équipe avec son compte et son numéro.
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        aria-label="Lien d'invitation de l'équipe"
        className="w-full bg-black/30 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono"
      />
      <div className="grid grid-cols-2 gap-3">
        <button onClick={copier} className="btn-basketball py-3 text-xs">
          Copier le lien
        </button>
        <Link
          to={`/invitation/${code}`}
          className="bg-white/5 border border-white/10 hover:bg-white/10 py-3 rounded-xl font-black uppercase text-xs text-center"
        >
          Je joue aussi
        </Link>
      </div>
      {message && <p className="text-xs text-gray-400">{message}</p>}
    </div>
  );
}

// Page du lien d'inscription d'un tournoi : le capitaine propose son équipe, l'organisateur valide
export default function InscriptionEquipe() {
  const { code } = useParams();
  const { user } = useAuth();
  const [page, setPage] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(
    () =>
      getInscription(code)
        .then(({ data }) => setPage(data))
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
          Ce lien n'existe pas ou a été remplacé par l'organisateur. Demande-lui le nouveau lien d'inscription.
        </p>
      </div>
    );
  }
  if (!page) return <div className="text-center py-10 animate-pulse">Chargement...</div>;

  const { tournoi, ma_demande: demande } = page;
  const etape = etapeCapitaine({ connecte: Boolean(user), demande, ouvertes: page.inscriptions_ouvertes });
  const suite = encodeURIComponent(`/inscription/${code}`);

  const envoyer = async (e) => {
    e.preventDefault();
    const probleme = erreurNomEquipe(nom);
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await demanderEquipe(code, nettoyerNomEquipe(nom));
      setNom("");
      await charger();
    } catch (error) {
      setErreur(messageErreur(error, "Impossible d'envoyer la demande."));
    } finally {
      setEnvoi(false);
    }
  };

  const formulaire = (libelle) => (
    <form onSubmit={envoyer} className="space-y-3">
      <input
        className={CHAMP}
        placeholder="Nom de l'équipe"
        maxLength={200}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
      />
      <button type="submit" disabled={envoi} className="w-full btn-basketball py-3 text-sm">
        {envoi ? "Envoi..." : libelle}
      </button>
    </form>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="glass-card p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Inscription d'équipe</p>
        <h1 className="text-3xl font-black uppercase italic tracking-tighter break-words">{tournoi.nom}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date(tournoi.date_debut).toLocaleDateString("fr-FR", { dateStyle: "long" })}
          {tournoi.organisateur_nom && <> · organisé par {tournoi.organisateur_nom}</>}
          {" · "}
          {page.nb_equipes}/{page.limite_equipes} équipes
        </p>
        {tournoi.visible && (
          <Link to={`/tournoi/${tournoi.slug}`} className="inline-block mt-2 text-sm text-primary-orange font-bold hover:underline">
            Voir le tournoi →
          </Link>
        )}
      </header>

      {erreur && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm font-bold">{erreur}</div>
      )}

      <section className="glass-card p-6 space-y-4">
        {etape === "connexion" && (
          <div className="text-center space-y-4">
            <p className="text-gray-300">
              Tu es capitaine ? Connecte-toi ou crée ton compte pour inscrire ton équipe. L'organisateur validera ta demande.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link to={`/login?suite=${suite}`} className="bg-white/5 border border-white/10 hover:bg-white/10 py-3 rounded-xl font-black uppercase text-xs">
                Se connecter
              </Link>
              <Link to={`/register?suite=${suite}`} className="btn-basketball py-3 text-xs">
                Créer mon compte
              </Link>
            </div>
          </div>
        )}

        {etape === "formulaire" && (
          <>
            <h2 className="font-black uppercase">Inscrire mon équipe</h2>
            <p className="text-sm text-gray-400">
              Tu deviens le capitaine : une fois l'équipe acceptée par l'organisateur, tu recevras le lien à envoyer à tes joueurs.
            </p>
            {formulaire("Envoyer la demande")}
          </>
        )}

        {etape === "en_attente" && (
          <>
            <p className="text-lg font-black text-center">
              ⏳ <span className="text-primary-orange">{demande.nom}</span> attend la validation de l'organisateur
            </p>
            <p className="text-sm text-gray-400 text-center">Reviens sur cette page plus tard pour récupérer le lien de ton équipe.</p>
            {page.inscriptions_ouvertes && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-white">Corriger le nom de l'équipe</summary>
                <div className="mt-3">{formulaire("Modifier le nom")}</div>
              </details>
            )}
          </>
        )}

        {etape === "acceptee" && (
          <>
            <p className="text-lg font-black text-green-400 text-center">✅ {demande.nom} est inscrite !</p>
            <LienEquipe code={demande.code_invitation} />
          </>
        )}

        {etape === "refusee" && (
          <>
            <p className="font-black text-center">
              La demande pour <span className="text-primary-orange">{demande.nom}</span> n'a pas été retenue.
            </p>
            <p className="text-sm text-gray-400 text-center">Contacte l'organisateur, ou envoie une nouvelle demande.</p>
            {formulaire("Envoyer une nouvelle demande")}
          </>
        )}

        {etape === "fermee" && (
          <p className="text-sm text-gray-400 text-center">
            Les inscriptions de ce tournoi sont fermées. Contacte l'organisateur.
          </p>
        )}
      </section>
    </div>
  );
}
