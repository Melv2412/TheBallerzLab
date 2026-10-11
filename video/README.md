# Vidéo de présentation THE LAB

Motion design de ~40 s en 1920×1080, réalisé avec [Remotion](https://www.remotion.dev) (vidéo en React), voix off française générée avec [Piper](https://github.com/OHF-Voice/piper1-gpl) (gratuit, 100 % local).

## Lancer

```bash
cd video
npm install
npm run studio   # aperçu interactif dans le navigateur
npm run render   # exporte out/the-lab-presentation.mp4
```

## Modifier le texte ou la voix

Le texte de chaque scène est dans [scripts/generer_voix.py](scripts/generer_voix.py). Après modification :

```bash
pip install piper-tts
python -m piper.download_voices --download-dir voices fr_FR-tom-medium
npm run voix
```

Le script régénère les fichiers audio de `public/voice/` et `src/voix.json`. La durée de chaque scène s'adapte automatiquement à la voix. Autres voix françaises : `fr_FR-siwis-medium` (féminine), `fr_FR-upmc-medium`.

## Structure

| Fichier | Rôle |
|---|---|
| `src/Root.jsx` | Composition (format, fps, durée) |
| `src/Presentation.jsx` | Enchaînement des scènes, voix off, sous-titres |
| `src/scenes.jsx` | Les 7 scènes : intro, problème, tournoi, live, stats, public, outro |
| `src/composants.jsx` | Fond, logo, titres, cartes, ballon |
| `src/theme.js` | Couleurs et polices de l'application |

Les sous-titres se désactivent avec la prop `sousTitres: false` (dans le Studio ou `--props='{"sousTitres":false}'`).

Licence Remotion : gratuite pour les particuliers et les structures de 3 personnes maximum.
