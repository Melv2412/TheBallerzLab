import React, { useState } from "react";
import { createEquipe, updateEquipe, createJoueur, updateJoueur, createMatch, messageErreur, rechercherAthlete } from "../../api";
import { compresserImage } from "../../images";
import { ZoneImage } from "./ZoneImage";

function Modal({ titre, centre = false, largeur = "max-w-md", children }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div
        className={`bg-[#1a1a1b] border-2 border-primary-orange/30 rounded-3xl p-6 sm:p-10 w-full ${largeur} max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in relative ring-8 ring-primary-orange/5`}
      >
        <h2
          className={`text-2xl sm:text-4xl font-black mb-6 sm:mb-8 italic tracking-tighter uppercase text-white ${centre ? "text-center" : ""}`}
        >
          {titre}
        </h2>
        {children}
      </div>
    </div>
  );
}

function Boutons({ valider, fermer, onFermer }) {
  return (
    <div className="flex gap-4 pt-4">
      <button type="submit" className="btn-basketball flex-1 py-5">
        {valider}
      </button>
      <button
        type="button"
        onClick={onFermer}
        className="flex-1 bg-white/5 text-gray-400 py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest"
      >
        {fermer}
      </button>
    </div>
  );
}

const champ = "w-full px-5 py-4 glass-input rounded-2xl focus:outline-none";
const etiquette = "block text-xs font-black text-primary-orange mb-2 uppercase tracking-widest";
const petiteEtiquette = "block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest";

// Création (equipe = null) ou modification d'une équipe
export function ModalEquipe({ tournoi, equipe, onFermer, onEnregistre }) {
  const [nom, setNom] = useState(equipe?.nom || "");
  const [logo, setLogo] = useState(null);

  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("nom", nom);
      if (logo instanceof File) formData.append("logo", await compresserImage(logo));

      if (equipe) {
        await updateEquipe(equipe.id, formData);
      } else {
        formData.append("tournoi", tournoi.id);
        await createEquipe(formData);
      }
      onEnregistre();
    } catch (error) {
      console.error("Erreur:", error);
      alert(messageErreur(error, "Erreur lors de l'enregistrement de l'équipe"));
    }
  };

  return (
    <Modal titre={equipe ? "Éditer l'Équipe" : "Inscrire une Équipe"}>
      <form onSubmit={enregistrer} className="space-y-6">
        <div>
          <label className={etiquette}>Nom de l'Équipe</label>
          <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
        </div>
        <div>
          <label className={etiquette}>Logo (Badge)</label>
          <ZoneImage fichier={logo} onChange={setLogo} icone="🖼️" />
        </div>
        <Boutons valider={equipe ? "Mettre à jour" : "Inscrire l'Équipe"} fermer="Fermer" onFermer={onFermer} />
      </form>
    </Modal>
  );
}

// Création (joueur = null) ou modification d'un joueur de l'équipe `equipeId`
export function ModalJoueur({ equipeId, joueur, onFermer, onEnregistre }) {
  const [form, setForm] = useState({
    prenom: joueur?.prenom || "",
    nom: joueur?.nom || "",
    numero_maillot: joueur?.numero_maillot ?? "",
  });
  const [photo, setPhoto] = useState(null);
  // Email facultatif : retrouve la fiche de l'athlète s'il a déjà joué ailleurs
  const [email, setEmail] = useState("");
  const [recherche, setRecherche] = useState(null);

  const chercher = async () => {
    if (!email.trim()) return;
    try {
      const { data } = await rechercherAthlete(email.trim());
      setRecherche({ trouvee: true, ...data });
      setForm((f) => ({ ...f, prenom: data.prenom, nom: data.nom }));
    } catch (error) {
      setRecherche(
        error.response?.status === 404
          ? { trouvee: false, message: "Aucune fiche avec cet email : une nouvelle fiche sera créée." }
          : { trouvee: false, message: messageErreur(error, "Recherche impossible.") },
      );
    }
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    const numero = parseInt(form.numero_maillot);
    if (isNaN(numero) || numero < 0) {
      alert("Le numéro de maillot ne peut pas être négatif");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("prenom", form.prenom.trim().toUpperCase());
      formData.append("nom", form.nom.trim().toUpperCase());
      formData.append("numero_maillot", numero);
      if (email.trim()) formData.append("email", email.trim());
      if (photo instanceof File) formData.append("photo", await compresserImage(photo));

      if (joueur) {
        await updateJoueur(joueur.id, formData);
      } else {
        formData.append("equipe", equipeId);
        await createJoueur(formData);
      }
      onEnregistre();
    } catch (error) {
      console.error("Erreur:", error);
      alert(messageErreur(error, "Erreur lors de l'enregistrement du joueur"));
    }
  };

  return (
    <Modal titre={joueur ? "Éditer Joueur" : "Nouveau Joueur"} centre>
      <form onSubmit={enregistrer} className="space-y-6">
        <div>
          <label className={petiteEtiquette}>Email du joueur (facultatif)</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setRecherche(null);
              }}
              className={champ}
              placeholder={joueur ? "Pour le relier à sa fiche" : "Retrouve sa fiche s'il a déjà joué"}
            />
            <button type="button" onClick={chercher} className="btn-basketball text-xs whitespace-nowrap">
              Chercher
            </button>
          </div>
          {recherche && (
            <p className={`mt-2 text-xs font-bold ${recherche.trouvee ? "text-green-400" : "text-gray-400"}`}>
              {recherche.trouvee
                ? `Fiche trouvée : ${recherche.prenom} ${recherche.nom} (${recherche.nb_tournois} tournoi${recherche.nb_tournois > 1 ? "s" : ""}). Le joueur y sera rattaché.`
                : recherche.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={petiteEtiquette}>Prénom</label>
            <input
              type="text"
              required
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              className={champ}
            />
          </div>
          <div>
            <label className={petiteEtiquette}>Nom</label>
            <input
              type="text"
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className={champ}
            />
          </div>
        </div>
        <div>
          <label className={petiteEtiquette}>Numéro Maillot</label>
          <input
            type="number"
            min="0"
            required
            value={form.numero_maillot}
            onChange={(e) => setForm({ ...form, numero_maillot: e.target.value })}
            className={champ}
            placeholder="Ex: 23, 30..."
          />
        </div>
        <div>
          <label className={etiquette}>Photo du Joueur</label>
          <ZoneImage fichier={photo} onChange={setPhoto} icone="📸" />
        </div>
        <Boutons valider={joueur ? "Sauvegarder" : "Ajouter le Joueur"} fermer="Annuler" onFermer={onFermer} />
      </form>
    </Modal>
  );
}

export function ModalMatch({ tournoi, equipes, phaseInitiale = "poule", onFermer, onEnregistre }) {
  const [form, setForm] = useState({
    equipe_domicile: "",
    equipe_exterieur: "",
    date_match: "",
    statut: "a_venir",
    phase: phaseInitiale,
  });

  const enregistrer = async (e) => {
    e.preventDefault();
    if (!form.equipe_domicile || !form.equipe_exterieur) {
      alert("Veuillez sélectionner les deux équipes");
      return;
    }
    try {
      const donnees = { ...form, tournoi: parseInt(tournoi.id) };
      if (!donnees.date_match) delete donnees.date_match;
      await createMatch(donnees);
      onEnregistre();
    } catch (error) {
      console.error("Erreur détaillée lors de la création du match:", error.response?.data);
      alert(messageErreur(error, "Erreur lors de la création du match"));
    }
  };

  const selectEquipe = (cle, label) => (
    <div>
      <label className="block text-[10px] font-black text-primary-orange mb-2 uppercase tracking-widest text-center">
        {label}
      </label>
      <select
        required
        value={form[cle]}
        onChange={(e) => setForm({ ...form, [cle]: e.target.value })}
        className="w-full px-4 py-4 glass-input rounded-xl focus:outline-none text-center appearance-none"
      >
        <option value="">Sélectionner</option>
        {equipes.map((eq) => (
          <option key={eq.id} value={eq.id}>
            {eq.nom}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal titre="Organiser Match" largeur="max-w-lg">
      <form onSubmit={enregistrer} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 items-center">
          {selectEquipe("equipe_domicile", "Domicile")}
          {selectEquipe("equipe_exterieur", "Extérieur")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
          <div>
            <label className={etiquette}>Phase du Match</label>
            <select
              required
              value={form.phase}
              onChange={(e) => setForm({ ...form, phase: e.target.value })}
              className="w-full px-4 py-4 glass-input rounded-xl focus:outline-none appearance-none"
            >
              <option value="poule">Poule / Saison</option>
              {tournoi.has_8emes && <option value="8eme">8ème de finale</option>}
              {tournoi.has_quarts && <option value="quart">Quart de finale</option>}
              {tournoi.has_demis && <option value="demi">Demi-finale</option>}
              {tournoi.has_finale && <option value="finale">Finale</option>}
            </select>
          </div>
          <div>
            <label className={etiquette}>Coup d'envoi</label>
            <input
              type="datetime-local"
              value={form.date_match}
              onChange={(e) => setForm({ ...form, date_match: e.target.value })}
              className={champ}
            />
          </div>
        </div>
        <Boutons valider="Programmer la Rencontre" fermer="Annuler" onFermer={onFermer} />
      </form>
    </Modal>
  );
}
