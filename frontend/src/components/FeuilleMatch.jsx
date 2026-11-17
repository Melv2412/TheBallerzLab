import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getActions, getMatch } from "../api";
import { NOMS_PRESETS } from "./reglement/presets";
import {
  enTetePeriode,
  evaluationStat,
  fautesEtTempsMorts,
  scoreParPeriode,
  totauxEquipe,
} from "./feuille/feuille";

const STATUTS = { a_venir: "À venir", en_cours: "En cours", termine: "Terminé" };
const PHASES = { poule: "Poule", "8eme": "8e de finale", quart: "Quart de finale", demi: "Demi-finale", finale: "Finale" };

const cellule = "border border-gray-300 px-2 py-1";

function TableauEquipe({ nom, stats, limiteFautes }) {
  const totaux = totauxEquipe(stats);
  const triees = [...stats].sort((a, b) => a.joueur_numero - b.joueur_numero);
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-lg font-black uppercase mb-2">{nom}</h2>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            {["N°", "Joueur", "PTS", "PD", "REB", "CTR", "FTE", "ÉVAL"].map((titre) => (
              <th key={titre} className={`${cellule} ${titre === "Joueur" ? "text-left" : "text-center"}`}>
                {titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {triees.map((s) => (
            <tr key={s.id}>
              <td className={`${cellule} text-center font-bold`}>{s.joueur_numero}</td>
              <td className={cellule}>
                {s.joueur_nom}
                {limiteFautes > 0 && s.fautes >= limiteFautes && <span className="ml-2 text-xs font-bold">(exclu)</span>}
              </td>
              {[s.points, s.passes, s.rebonds, s.contres, s.fautes, evaluationStat(s)].map((valeur, i) => (
                <td key={i} className={`${cellule} text-center`}>
                  {valeur}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-gray-100 font-black">
            <td className={cellule} colSpan={2}>
              Total
            </td>
            {[totaux.points, totaux.passes, totaux.rebonds, totaux.contres, totaux.fautes, evaluationStat(totaux)].map(
              (valeur, i) => (
                <td key={i} className={`${cellule} text-center`}>
                  {valeur}
                </td>
              ),
            )}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// Feuille de match imprimable : « Imprimer / PDF » puis « Enregistrer au format PDF » dans le navigateur
function FeuilleMatch() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [actions, setActions] = useState([]);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    Promise.all([getMatch(id), getActions(id)])
      .then(([m, a]) => {
        setMatch(m.data);
        setActions(a.data);
      })
      .catch(() => setErreur(true));
  }, [id]);

  if (erreur) return <div className="text-center py-10">Feuille de match introuvable.</div>;
  if (!match) return <div className="text-center py-10 animate-pulse">Préparation de la feuille de match...</div>;

  const reglement = match.reglement;
  const nbPeriodes = reglement.nb_periodes;
  const stats = match.statistiques || [];
  const statsDom = stats.filter((s) => s.equipe_nom === match.equipe_domicile_nom);
  const statsExt = stats.filter((s) => s.equipe_nom === match.equipe_exterieur_nom);
  // Score par période saisi après coup, sinon reconstitué depuis l'historique du direct
  const score = match.score_periodes
    ? { ...match.score_periodes, periodes: match.score_periodes.domicile.map((_, i) => i + 1) }
    : scoreParPeriode(actions, nbPeriodes, match.periode_actuelle);
  const suivi = {
    domicile: fautesEtTempsMorts(actions, "domicile", score.periodes),
    exterieur: fautesEtTempsMorts(actions, "exterieur", score.periodes),
  };
  const sommeHistorique = score.domicile.reduce((a, b) => a + b, 0) + score.exterieur.reduce((a, b) => a + b, 0);
  const historiqueComplet = sommeHistorique === match.score_domicile + match.score_exterieur;
  const lignes = [
    { cote: "domicile", nom: match.equipe_domicile_nom, points: score.domicile, total: match.score_domicile },
    { cote: "exterieur", nom: match.equipe_exterieur_nom, points: score.exterieur, total: match.score_exterieur },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 print:hidden">
        <Link to={`/match/${id}`} className="text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest">
          ← Retour au match
        </Link>
        <button onClick={() => window.print()} className="btn-basketball text-xs">
          📄 Imprimer / PDF
        </button>
      </div>

      <article className="bg-white text-black rounded-xl p-6 sm:p-10 print:p-0 print:rounded-none shadow-2xl print:shadow-none">
        <header className="flex flex-wrap justify-between items-start gap-4 border-b-2 border-black pb-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Feuille de match · THE LAB</p>
            <h1 className="text-2xl font-black uppercase">{match.tournoi_nom}</h1>
            <p className="text-sm text-gray-600">
              {PHASES[match.phase] || match.phase}
              {match.date_match && ` · ${new Date(match.date_match).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}`}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>
              Statut : <strong>{STATUTS[match.statut]}</strong>
            </p>
            <p>
              Règlement : <strong>{NOMS_PRESETS[match.reglement_type] || "Personnalisé"}</strong>
            </p>
          </div>
        </header>

        <section className="flex items-center justify-center gap-6 sm:gap-12 mb-6 text-center">
          <div className="flex-1">
            <p className="font-black uppercase">{match.equipe_domicile_nom}</p>
            <p className="text-5xl font-black">{match.score_domicile}</p>
          </div>
          <p className="text-xl font-black text-gray-400">–</p>
          <div className="flex-1">
            <p className="font-black uppercase">{match.equipe_exterieur_nom}</p>
            <p className="text-5xl font-black">{match.score_exterieur}</p>
          </div>
        </section>

        <section className="mb-6 break-inside-avoid overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className={`${cellule} text-left`}>Équipe</th>
                {score.periodes.map((p) => (
                  <th key={p} className={`${cellule} text-center`}>
                    {enTetePeriode(p, nbPeriodes)}
                  </th>
                ))}
                <th className={`${cellule} text-center`}>Total</th>
                <th className={`${cellule} text-center`}>Fautes d'équipe</th>
                <th className={`${cellule} text-center`}>Temps morts</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <tr key={ligne.cote}>
                  <td className={`${cellule} font-bold`}>{ligne.nom}</td>
                  {ligne.points.map((points, i) => (
                    <td key={i} className={`${cellule} text-center`}>
                      {points}
                    </td>
                  ))}
                  <td className={`${cellule} text-center font-black`}>{ligne.total}</td>
                  <td className={`${cellule} text-center`}>{suivi[ligne.cote].fautes.join(" · ")}</td>
                  <td className={`${cellule} text-center`}>{suivi[ligne.cote].tempsMorts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!historiqueComplet && (
            <p className="text-xs text-gray-500 mt-2 italic">
              * Score par période incomplet : une partie des points a été saisie sans historique (avant sa mise en place).
            </p>
          )}
        </section>

        <TableauEquipe nom={match.equipe_domicile_nom} stats={statsDom} limiteFautes={reglement.fautes_exclusion} />
        <TableauEquipe nom={match.equipe_exterieur_nom} stats={statsExt} limiteFautes={reglement.fautes_exclusion} />

        {match.mvp && (
          <p className="mb-8 text-sm">
            <strong>MVP :</strong> #{match.mvp.numero} {match.mvp.nom} ({match.mvp.equipe}) — évaluation {match.mvp.evaluation}
          </p>
        )}

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs pt-4 break-inside-avoid">
          {["Arbitre", "Marqueur", `Capitaine ${match.equipe_domicile_nom}`, `Capitaine ${match.equipe_exterieur_nom}`].map((role) => (
            <div key={role}>
              <div className="h-12 border-b border-black" />
              <p className="mt-1 text-gray-600">{role}</p>
            </div>
          ))}
        </section>
        <p className="text-[10px] text-gray-400 mt-6">Édité le {new Date().toLocaleString("fr-FR")}</p>
      </article>
    </div>
  );
}

export default FeuilleMatch;
