"""
Génère la voix off de la vidéo avec Piper (synthèse vocale neuronale gratuite, 100 % locale).

    pip install piper-tts
    python -m piper.download_voices --download-dir voices fr_FR-tom-medium
    python scripts/generer_voix.py --voices voices

Pour chaque scène : public/voice/<id>.wav, et src/voix.json avec la durée de
chaque scène (les animations et sous-titres se calent dessus).
Modifier le texte ici, relancer le script : la vidéo s'adapte toute seule.
Autres voix françaises : fr_FR-siwis-medium, fr_FR-upmc-medium.
"""
import argparse
import json
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

VOIX = 'fr_FR-tom-medium'
# < 1 accélère le débit, > 1 le ralentit
VITESSE = 0.92

SCENES = [
    ('intro', "Bienvenue dans The Lab."),
    ('probleme', "Organiser un tournoi de basket, c'est jongler entre les feuilles de match, les scores et les statistiques."),
    ('tournoi', "Avec The Lab, crée ton tournoi en quelques clics : équipes, joueurs, poules et phases finales."),
    ('live', "Pendant le match, tu pilotes la table de marque en direct : chrono, shot clock, fautes et temps morts."),
    ('stats', "Chaque panier, chaque rebond, chaque passe est enregistré. Le classement et le MVP se calculent tout seuls."),
    ('public', "Et le public suit tout en temps réel, depuis son téléphone."),
    ('outro', "The Lab. Ton terrain, tes règles."),
]

RACINE = Path(__file__).resolve().parent.parent
DOSSIER_AUDIO = RACINE / 'public' / 'voice'
FICHIER_JSON = RACINE / 'src' / 'voix.json'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--voices', default=str(RACINE / 'voices'), help='Dossier des modèles Piper (.onnx)')
    parser.add_argument('--voix', default=VOIX)
    args = parser.parse_args()

    voix = PiperVoice.load(Path(args.voices) / f'{args.voix}.onnx')
    config = SynthesisConfig(length_scale=VITESSE)
    DOSSIER_AUDIO.mkdir(parents=True, exist_ok=True)

    scenes = []
    for identifiant, texte in SCENES:
        chemin = DOSSIER_AUDIO / f'{identifiant}.wav'
        with wave.open(str(chemin), 'wb') as fichier:
            voix.synthesize_wav(texte, fichier, syn_config=config)
        with wave.open(str(chemin), 'rb') as fichier:
            duree = fichier.getnframes() / fichier.getframerate()
        print(f'{identifiant:<10} {duree:5.2f} s')
        scenes.append({'id': identifiant, 'texte': texte, 'audio': f'voice/{identifiant}.wav', 'duree': round(duree, 3)})

    FICHIER_JSON.write_text(json.dumps({'voix': args.voix, 'scenes': scenes}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Total : {sum(s['duree'] for s in scenes):.1f} s -> {FICHIER_JSON.relative_to(RACINE)}")


if __name__ == '__main__':
    main()
