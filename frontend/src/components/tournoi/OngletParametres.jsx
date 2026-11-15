import React, { useState, useEffect } from "react";
import { updateTournoi, resetPlayoffs } from "../../api";

const PHASES = [
  { cle: "has_8emes", label: "8èmes", phase: "8eme", victoires: "victoires_requises_8eme", labelVictoires: "8èmes" },
  { cle: "has_quarts", label: "Quarts", phase: "quart", victoires: "victoires_requises_quart", labelVictoires: "Quarts" },
  { cle: "has_demis", label: "Demis", phase: "demi", victoires: "victoires_requises_demi", labelVictoires: "Demis" },
  { cle: "has_finale", label: "Finale", phase: "finale", victoires: "victoires_requises_finale", labelVictoires: "Finale" },
];

const formulaireDepuis = (tournoi) => ({
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

export function OngletParametres({ tournoi, matchs, recharger }) {
  const [form, setForm] = useState(() => formulaireDepuis(tournoi));
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    setForm(formulaireDepuis(tournoi));
  }, [tournoi]);

  // Les playoffs déjà joués deviennent incohérents si leur format change : on propose de les réinitialiser
  const reinitialiserSiBesoin = async () => {
    const structureModifiee = PHASES.some((p) => form[p.cle] !== tournoi[p.cle]);
    if (structureModifiee) {
      if (
        !window.confirm(
          "Modifier la structure des phases finales réinitialisera TOUS les matchs éliminatoires. Voulez-vous continuer ?",
        )
      ) {
        return false;
      }
      try {
        await resetPlayoffs(tournoi.slug);
      } catch (err) {
        console.error("Erreur lors de la réinitialisation des playoffs:", err);
        alert("Erreur lors de la réinitialisation des playoffs");
        return false;
      }
      return true;
    }

    // Première phase dont le nombre de victoires change alors que des matchs y ont été joués
    const phaseAReinitialiser = PHASES.find(
      (p) =>
        form[p.victoires] !== tournoi[p.victoires] &&
        matchs.some((m) => m.phase === p.phase && m.statut !== "a_venir"),
    )?.phase;
    if (!phaseAReinitialiser) return true;

    if (
      !window.confirm(
        `Modifier le nombre de victoires requises pour la phase de ${phaseAReinitialiser} alors que des matchs ont déjà été joués entraînera la réinitialisation de cette phase et des phases suivantes. Voulez-vous continuer ?`,
      )
    ) {
      return false;
    }
    try {
      await resetPlayoffs(tournoi.slug, phaseAReinitialiser);
    } catch (err) {
      console.error("Erreur lors de la réinitialisation en cascade:", err);
      alert("Erreur lors de la réinitialisation en cascade");
      return false;
    }
    return true;
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    if (!(await reinitialiserSiBesoin())) return;

    setEnregistrement(true);
    try {
      await updateTournoi(tournoi.slug, form);
      alert("Paramètres enregistrés avec succès !");
      recharger();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du tournoi:", err);
      alert("Erreur lors de l'enregistrement des paramètres");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto glass-card p-5 sm:p-10 border border-white/5 relative">
      <h2 className="text-2xl sm:text-4xl font-black italic mb-8 card-title-accent uppercase">⚙️ Paramètres du Tournoi</h2>
      <form onSubmit={enregistrer} className="space-y-8">
        <div className="border-b border-white/5 pb-6">
          <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">Configuration Générale</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                Limite de Fautes par Joueur
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.limite_fautes}
                onChange={(e) => setForm({ ...form, limite_fautes: parseInt(e.target.value) || 5 })}
                className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-white/5 pb-6">
          <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">Phases Finales Actives</h3>
          <p className="text-xs text-gray-500 mb-6 italic">
            * Note : Modifier la structure des phases finales réinitialisera la progression des playoffs.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PHASES.map((phase) => (
              <label
                key={phase.cle}
                className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 p-5 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-primary-orange/50 transition-all select-none"
              >
                <input
                  type="checkbox"
                  checked={form[phase.cle]}
                  onChange={(e) => setForm({ ...form, [phase.cle]: e.target.checked })}
                  className="accent-primary-orange w-5 h-5"
                />
                <span className="text-xs font-black uppercase tracking-wider text-white">{phase.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">
            Format des Séries (Nombre de Victoires)
          </h3>
          <p className="text-xs text-gray-500 mb-6 italic">
            * Définissez le nombre de victoires requises pour remporter une série à chaque étape (ex: 1 pour match unique, 2
            pour un Best-of-3, 3 pour un Best-of-5).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PHASES.filter((p) => form[p.cle]).map((phase) => (
              <div key={phase.victoires}>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                  Victoires requises en {phase.labelVictoires}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form[phase.victoires]}
                  onChange={(e) => setForm({ ...form, [phase.victoires]: parseInt(e.target.value) || 1 })}
                  className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 flex gap-4">
          <button type="submit" disabled={enregistrement} className="btn-basketball flex-1 py-5 text-sm disabled:opacity-50">
            Sauvegarder les Paramètres
          </button>
        </div>
      </form>
    </div>
  );
}
