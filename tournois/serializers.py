from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from . import reglement as regles
from .models import Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from .phases_finales import avancer_phases_finales, phase_suivante_commencee
from .services import mvp_du_match


def valider_taille_image(image):
    """Refuse les images trop lourdes (stockage limité en prod)."""
    if image and image.size > settings.TAILLE_MAX_IMAGE_MO * 1024 * 1024:
        raise serializers.ValidationError(
            f"L'image ne doit pas dépasser {settings.TAILLE_MAX_IMAGE_MO} Mo."
        )
    return image


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
    reglement = serializers.JSONField(required=False)
    reglement_type = serializers.SerializerMethodField()

    organisateur_nom = serializers.CharField(source='organisateur.username', read_only=True)

    class Meta:
        model = Tournoi
        fields = [
            'id', 'nom', 'slug', 'organisateur', 'organisateur_nom', 'date_debut', 'date_fin',
            'equipes_count', 'matchs_count',
            'has_8emes', 'has_quarts', 'has_demis', 'has_finale', 'reglement', 'reglement_type',
            'victoires_requises_8eme', 'victoires_requises_quart', 'victoires_requises_demi', 'victoires_requises_finale',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'organisateur']

    def get_reglement_type(self, obj):
        return regles.nom_preset(obj.reglement)

    def validate_reglement(self, valeur):
        # Modification partielle possible : les réglages absents gardent leur valeur actuelle
        return regles.valider_reglement(valeur, base=getattr(self.instance, 'reglement', None))

    def validate(self, attrs):
        debut = attrs.get('date_debut', getattr(self.instance, 'date_debut', None))
        fin = attrs.get('date_fin', getattr(self.instance, 'date_fin', None))
        if debut and fin and fin < debut:
            raise serializers.ValidationError({'date_fin': "La date de fin doit être après la date de début."})
        if self.instance and ('date_debut' in attrs or 'date_fin' in attrs):
            hors_dates = [
                m for m in self.instance.matchs.exclude(date_match=None)
                if not debut <= timezone.localtime(m.date_match).date() <= fin
            ]
            if hors_dates:
                raise serializers.ValidationError({'date_fin': (
                    f"{len(hors_dates)} match(s) sont programmés en dehors de ces dates : déplacez-les d'abord."
                )})
        return attrs

    def update(self, instance, validated_data):
        nouveau_reglement = validated_data.get('reglement')
        tournoi = super().update(instance, validated_data)
        if nouveau_reglement is not None:
            # Les matchs pas encore commencés suivent le nouveau règlement ; les autres gardent le leur
            for match in tournoi.matchs.filter(statut='a_venir'):
                if not match.a_commence:
                    match.reglement = dict(nouveau_reglement)
                    match.appliquer_reglement()
                    match.save()
        return tournoi

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

    def validate_tournoi(self, tournoi):
        # Seulement à la création ou au changement de tournoi
        change_de_tournoi = self.instance is None or self.instance.tournoi_id != tournoi.pk
        if change_de_tournoi and tournoi.equipes.count() >= settings.LIMITE_EQUIPES_PAR_TOURNOI:
            raise serializers.ValidationError(
                f"Un tournoi ne peut pas dépasser {settings.LIMITE_EQUIPES_PAR_TOURNOI} équipes."
            )
        return tournoi

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

    def validate_equipe(self, equipe):
        change_d_equipe = self.instance is None or self.instance.equipe_id != equipe.pk
        if change_d_equipe and equipe.joueurs.count() >= settings.LIMITE_JOUEURS_PAR_EQUIPE:
            raise serializers.ValidationError(
                f"Une équipe ne peut pas dépasser {settings.LIMITE_JOUEURS_PAR_EQUIPE} joueurs."
            )
        return equipe


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
    # Permet au frontend de reconnaître l'organisateur par son id (et non son nom)
    organisateur_id = serializers.IntegerField(source='tournoi.organisateur_id', read_only=True)
    statistiques = StatistiqueJoueurSerializer(many=True, read_only=True, source='statistiques_joueurs')
    reglement = serializers.JSONField(required=False)

    mvp = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id', 'tournoi', 'tournoi_nom', 'tournoi_slug', 'organisateur_nom', 'organisateur_id', 'phase', 'equipe_domicile', 'equipe_domicile_nom',
            'equipe_exterieur', 'equipe_exterieur_nom', 'statut', 'score_domicile',
            'score_exterieur', 'date_match', 'statistiques', 'mvp', 'reglement',
            'temps_restant_secondes', 'periode_actuelle', 'chrono_en_cours',
            'shot_clock_secondes', 'possession_fleche',
            'created_at', 'updated_at'
        ]
        # Le score découle uniquement des statistiques des joueurs (voir Match.calculer_scores_depuis_stats)
        read_only_fields = ['score_domicile', 'score_exterieur']

    CHAMPS_CHRONO = ('temps_restant_secondes', 'shot_clock_secondes', 'periode_actuelle', 'chrono_en_cours')
    # Seuls changements acceptés sur un match terminé : le rouvrir, ou le reprogrammer
    CHAMPS_MATCH_TERMINE = {'statut', 'date_match'}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Valeurs réelles à cet instant : le client décompte à partir de là
        etat = instance.etat_chrono()
        for champ in self.CHAMPS_CHRONO:
            data[champ] = round(etat[champ], 3) if isinstance(etat[champ], float) else etat[champ]

        reglement, periode = instance.reglement, etat['periode_actuelle']
        data['reglement_type'] = regles.nom_preset(reglement)
        data['a_commence'] = instance.a_commence
        data['duree_periode_secondes'] = regles.duree_periode(reglement, periode)
        for cote in ('domicile', 'exterieur'):
            fautes = instance.fautes_equipe(cote, periode)
            data[f'fautes_{cote}'] = fautes
            # En bonus : la prochaine faute d'équipe donnera des lancers francs
            data[f'bonus_{cote}'] = fautes >= reglement['fautes_bonus'] - 1
            data[f'temps_morts_{cote}'] = instance.temps_morts_restants(cote, periode)
        return data

    def create(self, validated_data):
        # Copie du règlement du tournoi, éventuellement ajusté pour ce match
        validated_data['reglement'] = dict(validated_data.get('reglement') or validated_data['tournoi'].reglement)
        match = Match(**validated_data)
        match.appliquer_reglement()
        if validated_data.get('chrono_en_cours'):
            match.chrono_en_cours = True
            match.chrono_demarre_a = timezone.now()
        match.save()
        return match

    def update(self, instance, validated_data):
        maintenant = timezone.now()
        # Fige le temps écoulé, applique la modification, puis repart de maintenant si le chrono tourne
        instance.figer_chrono(maintenant)

        nouveau_reglement = validated_data.pop('reglement', None)
        if nouveau_reglement is not None:
            avant, commence = instance.reglement, instance.a_commence
            instance.reglement = nouveau_reglement
            if not commence:
                instance.appliquer_reglement()
            elif nouveau_reglement['shot_clock_actif'] != avant['shot_clock_actif']:
                instance.shot_clock_secondes = regles.shot_clock_initial(nouveau_reglement)

        en_cours = validated_data.get('chrono_en_cours', instance.chrono_en_cours)
        validated_data['chrono_demarre_a'] = maintenant if en_cours else None
        vient_de_finir = validated_data.get('statut') == 'termine' and instance.statut != 'termine'
        match = super().update(instance, validated_data)
        if vient_de_finir and match.phase != 'poule':
            # Match suivant de la série, ou tour suivant si toutes les séries de la phase sont décidées
            avancer_phases_finales(match.tournoi)
        return match

    def get_mvp(self, obj):
        """MVP du match (meilleure évaluation), à partir des stats déjà chargées."""
        return mvp_du_match(obj.statistiques_joueurs.all())

    def validate(self, attrs):
        match = self.instance
        if match and match.statut == 'termine' and set(attrs) - self.CHAMPS_MATCH_TERMINE:
            raise serializers.ValidationError(
                "Match terminé : repassez-le « en cours » pour le modifier."
            )
        rouvert = match and match.statut == 'termine' and attrs.get('statut') in ('a_venir', 'en_cours')
        if rouvert and match.phase != 'poule' and phase_suivante_commencee(match):
            raise serializers.ValidationError({'statut': (
                "La phase suivante a déjà commencé : réinitialisez-la (onglet Phase finale) avant de rouvrir ce match."
            )})
        if match and 'tournoi' in attrs and attrs['tournoi'].pk != match.tournoi_id:
            raise serializers.ValidationError({'tournoi': "Un match ne peut pas changer de tournoi."})

        tournoi = attrs.get('tournoi', getattr(match, 'tournoi', None))
        domicile = attrs.get('equipe_domicile', getattr(match, 'equipe_domicile', None))
        exterieur = attrs.get('equipe_exterieur', getattr(match, 'equipe_exterieur', None))
        if domicile and exterieur and domicile.pk == exterieur.pk:
            raise serializers.ValidationError("Une équipe ne peut pas jouer contre elle-même.")
        for equipe in (domicile, exterieur):
            if equipe and tournoi and equipe.tournoi_id != tournoi.pk:
                raise serializers.ValidationError(f"L'équipe {equipe.nom} ne fait pas partie de ce tournoi.")
        change_d_equipes = match and (
            domicile.pk != match.equipe_domicile_id or exterieur.pk != match.equipe_exterieur_id
        )
        if change_d_equipes and match.statistiques_joueurs.exists():
            raise serializers.ValidationError(
                "Des statistiques ont déjà été saisies : les équipes de ce match ne peuvent plus changer."
            )

        date_match = attrs.get('date_match')
        if date_match and tournoi and not tournoi.date_debut <= timezone.localtime(date_match).date() <= tournoi.date_fin:
            raise serializers.ValidationError({'date_match': "Le match doit avoir lieu pendant les dates du tournoi."})

        if 'reglement' in attrs:
            self._valider_modification_reglement(attrs['reglement'])
            base = match.reglement if match else getattr(tournoi, 'reglement', None)
            try:
                attrs['reglement'] = regles.valider_reglement(attrs['reglement'], base=base)
            except serializers.ValidationError as erreur:
                raise serializers.ValidationError({'reglement': erreur.detail}) from erreur
        if match:
            self._valider_chrono(attrs)

        if attrs.get('statut') == 'termine':
            score_dom = getattr(match, 'score_domicile', 0)
            score_ext = getattr(match, 'score_exterieur', 0)
            if score_dom == score_ext:
                raise serializers.ValidationError(
                    {'statut': "Un match ne peut pas se terminer sur une égalité : jouez une prolongation."}
                )
        return attrs

    def _valider_modification_reglement(self, modifications):
        if not isinstance(modifications, dict):
            raise serializers.ValidationError({'reglement': "Le règlement doit être un objet."})
        match = self.instance
        if match and match.a_commence:
            interdits = sorted(set(modifications) - regles.REGLAGES_MODIFIABLES_EN_COURS)
            if interdits:
                raise serializers.ValidationError({'reglement': (
                    "Match commencé : seuls le shot clock, la durée des périodes et les temps morts "
                    f"peuvent encore changer ({', '.join(interdits)})."
                )})

    def _valider_chrono(self, attrs):
        reglement = attrs.get('reglement', self.instance.reglement)
        if 'shot_clock_secondes' in attrs:
            shot = attrs['shot_clock_secondes']
            if shot and not reglement['shot_clock_actif']:
                raise serializers.ValidationError({'shot_clock_secondes': "Le shot clock est désactivé pour ce match."})
            if shot > reglement['shot_clock_secondes']:
                raise serializers.ValidationError({'shot_clock_secondes': (
                    f"Le shot clock ne dépasse pas {reglement['shot_clock_secondes']} secondes."
                )})
        if 'temps_restant_secondes' in attrs:
            periode = attrs.get('periode_actuelle', self.instance.etat_chrono()['periode_actuelle'])
            maximum = regles.duree_periode(reglement, periode)
            if attrs['temps_restant_secondes'] > maximum:
                raise serializers.ValidationError({'temps_restant_secondes': (
                    f"Une période dure au plus {maximum // 60} min {maximum % 60:02d} s."
                )})


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

