from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.conf import settings


def valider_taille_image(image):
    """Refuse les images trop lourdes (stockage limité en prod)."""
    if image and image.size > settings.TAILLE_MAX_IMAGE_MO * 1024 * 1024:
        raise serializers.ValidationError(
            f"L'image ne doit pas dépasser {settings.TAILLE_MAX_IMAGE_MO} Mo."
        )
    return image
from .models import Tournoi, Equipe, Joueur, Match, StatistiqueJoueur


class UserSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle User."""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user


class TournoiSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Tournoi."""
    equipes_count = serializers.SerializerMethodField()
    matchs_count = serializers.SerializerMethodField()

    organisateur_nom = serializers.CharField(source='organisateur.username', read_only=True)

    class Meta:
        model = Tournoi
        fields = [
            'id', 'nom', 'slug', 'organisateur', 'organisateur_nom', 'date_debut', 'date_fin', 
            'equipes_count', 'matchs_count', 
            'has_8emes', 'has_quarts', 'has_demis', 'has_finale', 'limite_fautes',
            'victoires_requises_8eme', 'victoires_requises_quart', 'victoires_requises_demi', 'victoires_requises_finale',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'organisateur']

    def get_equipes_count(self, obj):
        """Retourne le nombre d'équipes du tournoi."""
        if hasattr(obj, 'nb_equipes'):  # calculé par la requête (voir TournoiViewSet)
            return obj.nb_equipes
        if hasattr(obj, 'equipes'):
            return obj.equipes.count() if hasattr(obj.equipes, 'count') else len(obj.equipes.all())
        return 0

    def get_matchs_count(self, obj):
        """Retourne le nombre de matchs du tournoi."""
        if hasattr(obj, 'nb_matchs'):
            return obj.nb_matchs
        if hasattr(obj, 'matchs'):
            return obj.matchs.count() if hasattr(obj.matchs, 'count') else len(obj.matchs.all())
        return 0


class EquipeSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Equipe."""
    tournoi_nom = serializers.CharField(source='tournoi.nom', read_only=True)
    joueurs_count = serializers.SerializerMethodField()
    logo = serializers.ImageField(required=False, allow_null=True, validators=[valider_taille_image])

    class Meta:
        model = Equipe
        fields = ['id', 'nom', 'logo', 'tournoi', 'tournoi_nom', 'joueurs_count', 'created_at', 'updated_at']

    def get_joueurs_count(self, obj):
        """Retourne le nombre de joueurs de l'équipe."""
        if hasattr(obj, 'nb_joueurs'):  # calculé par la requête (voir EquipeViewSet)
            return obj.nb_joueurs
        if hasattr(obj, 'joueurs'):
            return obj.joueurs.count() if hasattr(obj.joueurs, 'count') else len(obj.joueurs.all())
        return 0


class JoueurSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Joueur."""
    equipe_nom = serializers.CharField(source='equipe.nom', read_only=True)
    tournoi_nom = serializers.CharField(source='equipe.tournoi.nom', read_only=True)

    class Meta:
        model = Joueur
        fields = ['id', 'prenom', 'nom', 'numero_maillot', 'equipe', 'equipe_nom', 'photo', 'tournoi_nom', 'created_at', 'updated_at']
        extra_kwargs = {'photo': {'validators': [valider_taille_image]}}


class StatistiqueJoueurSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle StatistiqueJoueur."""
    joueur_nom = serializers.SerializerMethodField()
    joueur_numero = serializers.IntegerField(source='joueur.numero_maillot', read_only=True)
    joueur_photo = serializers.ImageField(source='joueur.photo', read_only=True)
    equipe_nom = serializers.CharField(source='joueur.equipe.nom', read_only=True)

    class Meta:
        model = StatistiqueJoueur
        fields = [
            'id', 'joueur', 'match', 'joueur_nom', 'joueur_numero', 'joueur_photo', 'equipe_nom',
            'points', 'passes', 'rebonds', 'contres', 'fautes',
            'created_at', 'updated_at'
        ]

    def get_joueur_nom(self, obj):
        return f"{obj.joueur.prenom} {obj.joueur.nom}"

    def validate(self, attrs):
        joueur = attrs.get('joueur', getattr(self.instance, 'joueur', None))
        match = attrs.get('match', getattr(self.instance, 'match', None))
        if joueur and match and joueur.equipe_id not in (match.equipe_domicile_id, match.equipe_exterieur_id):
            raise serializers.ValidationError("Ce joueur n'appartient à aucune des deux équipes du match.")
        return attrs


class MatchSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Match."""
    equipe_domicile_nom = serializers.CharField(source='equipe_domicile.nom', read_only=True)
    equipe_exterieur_nom = serializers.CharField(source='equipe_exterieur.nom', read_only=True)
    tournoi_nom = serializers.CharField(source='tournoi.nom', read_only=True)
    tournoi_slug = serializers.CharField(source='tournoi.slug', read_only=True)
    organisateur_nom = serializers.CharField(source='tournoi.organisateur.username', read_only=True)
    statistiques = StatistiqueJoueurSerializer(many=True, read_only=True, source='statistiques_joueurs')

    mvp = serializers.SerializerMethodField()
    fautes_domicile = serializers.SerializerMethodField()
    fautes_exterieur = serializers.SerializerMethodField()
    tournoi_limite_fautes = serializers.IntegerField(source='tournoi.limite_fautes', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'tournoi', 'tournoi_nom', 'tournoi_slug', 'organisateur_nom', 'tournoi_limite_fautes', 'phase', 'equipe_domicile', 'equipe_domicile_nom',
            'equipe_exterieur', 'equipe_exterieur_nom', 'statut', 'score_domicile',
            'score_exterieur', 'date_match', 'statistiques', 'mvp', 
            'temps_restant_secondes', 'periode_actuelle', 'duree_periode_secondes', 'chrono_en_cours',
            'shot_clock_secondes', 'possession_fleche',
            'timeouts_domicile', 'timeouts_exterieur', 'fautes_domicile', 'fautes_exterieur',
            'created_at', 'updated_at'
        ]

    def get_mvp(self, obj):
        """Calcule le MVP du match (meilleure évaluation)."""
        stats = obj.statistiques_joueurs.all()
        if not stats:
            return None
        
        best_player = None
        max_eval = -999

        for stat in stats:
            # Formule d'évaluation simplifiée
            evaluation = stat.points + stat.passes + stat.rebonds + stat.contres - stat.fautes
            if evaluation > max_eval:
                max_eval = evaluation
                best_player = {
                    'nom': f"{stat.joueur.prenom} {stat.joueur.nom}",
                    'numero': stat.joueur.numero_maillot,
                    'equipe': stat.joueur.equipe.nom,
                    'evaluation': evaluation,
                    'stats': {
                        'pts': stat.points,
                        'ast': stat.passes,
                        'reb': stat.rebonds,
                        'blk': stat.contres,
                        'fouls': stat.fautes
                    }
                }
        
        return best_player if max_eval > 0 else None
    
    def validate(self, attrs):
        tournoi = attrs.get('tournoi', getattr(self.instance, 'tournoi', None))
        domicile = attrs.get('equipe_domicile', getattr(self.instance, 'equipe_domicile', None))
        exterieur = attrs.get('equipe_exterieur', getattr(self.instance, 'equipe_exterieur', None))
        if domicile and exterieur and domicile.pk == exterieur.pk:
            raise serializers.ValidationError("Une équipe ne peut pas jouer contre elle-même.")
        for equipe in (domicile, exterieur):
            if equipe and tournoi and equipe.tournoi_id != tournoi.pk:
                raise serializers.ValidationError(f"L'équipe {equipe.nom} ne fait pas partie de ce tournoi.")
        return attrs

    def _fautes(self, obj, equipe_id):
        # Les stats sont déjà chargées (prefetch) : pas de requête supplémentaire
        return sum(s.fautes for s in obj.statistiques_joueurs.all() if s.joueur.equipe_id == equipe_id)

    def get_fautes_domicile(self, obj):
        """Retourne le total des fautes de l'équipe domicile."""
        return self._fautes(obj, obj.equipe_domicile_id)

    def get_fautes_exterieur(self, obj):
        """Retourne le total des fautes de l'équipe extérieur."""
        return self._fautes(obj, obj.equipe_exterieur_id)


class MatchListSerializer(serializers.ModelSerializer):
    """Serializer simplifié pour la liste des matchs."""
    equipe_domicile_nom = serializers.CharField(source='equipe_domicile.nom', read_only=True)
    equipe_exterieur_nom = serializers.CharField(source='equipe_exterieur.nom', read_only=True)
    tournoi_nom = serializers.CharField(source='tournoi.nom', read_only=True)
    tournoi_slug = serializers.CharField(source='tournoi.slug', read_only=True)
    organisateur_nom = serializers.CharField(source='tournoi.organisateur.username', read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'tournoi', 'tournoi_nom', 'tournoi_slug', 'organisateur_nom', 'phase', 'equipe_domicile', 'equipe_domicile_nom',
            'equipe_exterieur', 'equipe_exterieur_nom', 'statut', 'score_domicile',
            'score_exterieur', 'date_match', 'created_at', 'updated_at'
        ]


class UpdateStatistiqueSerializer(serializers.Serializer):
    """Serializer pour mettre à jour une statistique spécifique."""
    CHAMPS = ['points', 'passes', 'rebonds', 'contres', 'fautes']

    champ = serializers.ChoiceField(
        choices=CHAMPS,
        error_messages={'invalid_choice': 'Champ invalide. Utilisez: points, passes, rebonds, contres, fautes'},
    )
    action = serializers.ChoiceField(choices=['increment', 'decrement'])
    # Toujours positif : le sens est donné par `action`
    valeur = serializers.IntegerField(default=1, min_value=1, max_value=200)

