from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from . import athletes, forfaits, organisateurs, protections
from . import reglement as regles
from .journal import TYPES_ANNULABLES
from .models import POSTES, ActionMatch, Athlete, Equipe, Joueur, Match, StatistiqueJoueur, Tournoi
from .phases_finales import (
    ACTIVATION,
    LIBELLES,
    PHASES,
    VICTOIRES_REQUISES,
    avancer_phases_finales,
    phase_suivante_commencee,
    series_de_la_phase,
)
from .services import mvp_du_match


def url_image(requete, image):
    """Adresse complète d'une image (comme les champs image des serializers), ou None."""
    if not image:
        return None
    return requete.build_absolute_uri(image.url) if requete is not None else image.url


def valider_taille_image(image):
    """Refuse les images trop lourdes (stockage limité en prod)."""
    if image and image.size > settings.TAILLE_MAX_IMAGE_MO * 1024 * 1024:
        raise serializers.ValidationError(
            f"L'image ne doit pas dépasser {settings.TAILLE_MAX_IMAGE_MO} Mo."
        )
    return image


class UserSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle User. L'email est obligatoire et unique (la casse ne compte pas)."""
    email = serializers.EmailField(required=True, allow_blank=False)
    # Mode choisi à l'inscription : « orga » = demande de validation organisateur
    type = serializers.ChoiceField(choices=['orga', 'joueur'], default='joueur', write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'type']
        extra_kwargs = {'password': {'write_only': True}}

    def validate_email(self, email):
        email = athletes.normaliser_email(email)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        if validated_data.get('type') == 'orga':
            organisateurs.demander_validation(user)
        return user


class TournoiSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Tournoi."""
    equipes_count = serializers.SerializerMethodField()
    matchs_count = serializers.SerializerMethodField()
    reglement = serializers.JSONField(required=False)
    reglement_type = serializers.SerializerMethodField()

    organisateur_nom = serializers.CharField(source='organisateur.username', read_only=True)
    # Lien d'inscription des équipes : secret, montré à l'organisateur seulement
    code_inscription = serializers.SerializerMethodField()
    # Carte du tournoi dans la liste : couleur de la palette (vide = couleur par défaut) ou photo
    carte_couleur = serializers.ChoiceField(
        choices=[''] + Tournoi.COULEURS_CARTE, required=False,
        error_messages={'invalid_choice': "Choisis une couleur de la palette."},
    )
    carte_image = serializers.ImageField(required=False, allow_null=True, validators=[valider_taille_image])
    # Tournoi clôturé : vainqueur de la finale, pour son logo sur la carte
    champion = serializers.SerializerMethodField()

    class Meta:
        model = Tournoi
        fields = [
            'id', 'nom', 'slug', 'organisateur', 'organisateur_nom', 'date_debut', 'date_fin',
            'equipes_count', 'matchs_count',
            'has_8emes', 'has_quarts', 'has_demis', 'has_finale', 'reglement', 'reglement_type',
            'inscriptions_ouvertes', 'code_inscription', 'prive', 'cloture_le',
            'carte_couleur', 'carte_image', 'champion',
            'victoires_requises_8eme', 'victoires_requises_quart', 'victoires_requises_demi', 'victoires_requises_finale',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'organisateur']

    def get_code_inscription(self, obj):
        requete = self.context.get('request')
        user = getattr(requete, 'user', None)
        if user is not None and user.is_authenticated and obj.organisateur_id == user.id:
            return obj.code_inscription
        return None

    def get_reglement_type(self, obj):
        return regles.nom_preset(obj.reglement)

    def get_champion(self, obj):
        if obj.cloture_le is None or not obj.has_finale:
            return None
        series = series_de_la_phase(obj, 'finale')
        vainqueur = series[-1]['vainqueur'] if series else None
        equipe = obj.equipes.filter(pk=vainqueur).first() if vainqueur else None
        if equipe is None:
            return None
        return {'id': equipe.id, 'nom': equipe.nom, 'logo': url_image(self.context.get('request'), equipe.logo)}

    def validate_reglement(self, valeur):
        # Modification partielle possible : les réglages absents gardent leur valeur actuelle
        return regles.valider_reglement(valeur, base=getattr(self.instance, 'reglement', None))

    def validate_nom(self, nom):
        """Un organisateur ne peut pas avoir deux tournois du même nom (la casse ne compte pas)."""
        if self.instance is not None:
            organisateur = self.instance.organisateur
        else:
            requete = self.context.get('request')
            organisateur = getattr(requete, 'user', None)
        if organisateur is not None and organisateur.is_authenticated:
            doublons = Tournoi.objects.filter(organisateur=organisateur, nom__iexact=nom)
            if self.instance is not None:
                doublons = doublons.exclude(pk=self.instance.pk)
            if doublons.filter(supprime_le__isnull=False).exists():
                raise serializers.ValidationError(
                    "Un tournoi de ta corbeille porte ce nom : restaure-le ou supprime-le définitivement."
                )
            if doublons.exists():
                raise serializers.ValidationError("Tu as déjà un tournoi avec ce nom.")
        return nom

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
        if self.instance is None or any(champ in attrs for champ in ACTIVATION.values()):
            self.valider_phases_finales(attrs)
        if self.instance is not None:
            self.verifier_format_verrouille(attrs)
            self.verifier_points_verrouilles(attrs)
        return attrs

    def verifier_format_verrouille(self, attrs):
        """Une phase commencée garde son format : il ne change qu'après réinitialisation des playoffs."""
        tournoi = self.instance
        structure_modifiee = any(
            champ in attrs and attrs[champ] != getattr(tournoi, champ) for champ in ACTIVATION.values()
        )
        series_modifiees = [
            phase for phase, champ in VICTOIRES_REQUISES.items()
            if champ in attrs and attrs[champ] != getattr(tournoi, champ)
        ]
        if not structure_modifiee and not series_modifiees:
            return
        commencees = protections.phases_commencees(tournoi)
        if structure_modifiee and commencees:
            raise serializers.ValidationError({'detail': (
                "Les phases finales ont commencé : réinitialise les playoffs pour changer les phases actives."
            )})
        for phase in series_modifiees:
            if phase in commencees:
                raise serializers.ValidationError({VICTOIRES_REQUISES[phase]: (
                    f"Les {LIBELLES[phase].lower()} ont commencé : "
                    "réinitialise les playoffs pour changer le nombre de victoires."
                )})

    def verifier_points_verrouilles(self, attrs):
        """
        Le mode de classement et le barème se choisissent librement pendant la poule. Ils se figent dès que le
        tableau des phases finales existe : il a été construit à partir de ce classement.
        """
        reglement = attrs.get('reglement')
        if reglement is None:
            return
        actuel = {'mode_classement': 'points', **self.instance.reglement}
        if all(reglement[cle] == actuel.get(cle) for cle in ('points_victoire', 'points_defaite', 'mode_classement')):
            return
        if self.instance.matchs.exclude(phase='poule').exists():
            raise serializers.ValidationError({'reglement': (
                "Le tableau des phases finales est créé : le mode de classement et les points de victoire et de "
                "défaite ne peuvent plus changer. Réinitialise les playoffs pour les modifier."
            )})

    def valider_phases_finales(self, attrs):
        """Les phases actives doivent se suivre et mener à la finale (sinon le tableau ne s'apparie pas)."""
        def active(phase):
            champ = ACTIVATION[phase]
            if champ in attrs:
                return attrs[champ]
            if self.instance is not None:
                return getattr(self.instance, champ)
            return Tournoi._meta.get_field(champ).default

        actives = [phase for phase in PHASES if active(phase)]
        if not actives:
            return
        if actives[-1] != 'finale':
            raise serializers.ValidationError("Les phases finales doivent se terminer par la finale.")
        attendues = PHASES[PHASES.index(actives[0]):]
        if actives != attendues:
            manquantes = ', '.join(LIBELLES[p].lower() for p in attendues if p not in actives)
            raise serializers.ValidationError(
                f"Les phases finales doivent se suivre sans trou : activez aussi les {manquantes}."
            )

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
        if change_de_tournoi and self.instance is not None and protections.equipe_a_joue(self.instance):
            raise serializers.ValidationError("Cette équipe a déjà joué : elle ne peut plus changer de tournoi.")
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
            return obj.joueurs.filter(retire=False).count()
        return 0


class JoueurSerializer(serializers.ModelSerializer):
    """
    Serializer pour le modèle Joueur. `email` (facultatif, jamais renvoyé) rattache le joueur
    à la fiche athlète qui a cet email, ou la crée.
    """
    equipe_nom = serializers.CharField(source='equipe.nom', read_only=True)
    tournoi_nom = serializers.CharField(source='equipe.tournoi.nom', read_only=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True, allow_null=True)
    # Le joueur a rejoint l'équipe avec son compte (lien d'invitation) : sa fiche lui appartient
    compte_lie = serializers.SerializerMethodField()
    a_des_stats = serializers.SerializerMethodField()
    photo_affichee = serializers.SerializerMethodField()
    postes = serializers.JSONField(source='athlete.postes', read_only=True)  # choisis par le joueur sur son profil

    class Meta:
        model = Joueur
        fields = [
            'id', 'athlete', 'prenom', 'nom', 'numero_maillot', 'equipe', 'equipe_nom', 'photo', 'photo_affichee',
            'tournoi_nom',
            'email', 'compte_lie', 'retire', 'a_des_stats', 'postes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['athlete', 'retire']
        extra_kwargs = {'photo': {'validators': [valider_taille_image]}}
        validators = []  # numéro unique dans l'effectif : vérifié dans validate(), avec un message clair

    def get_photo_affichee(self, obj):
        """Photo de l'inscription, sinon celle de la fiche athlète."""
        image = obj.photo or obj.athlete.photo
        if not image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(image.url) if request else image.url

    def validate_equipe(self, equipe):
        change_d_equipe = self.instance is None or self.instance.equipe_id != equipe.pk
        if change_d_equipe and self.instance is not None and protections.joueur_a_des_stats(self.instance):
            raise serializers.ValidationError(
                "Ce joueur a des stats dans son équipe : retire-le de l'effectif, puis ajoute-le à la nouvelle équipe."
            )
        if change_d_equipe and equipe.joueurs.filter(retire=False).count() >= settings.LIMITE_JOUEURS_PAR_EQUIPE:
            raise serializers.ValidationError(
                f"Une équipe ne peut pas dépasser {settings.LIMITE_JOUEURS_PAR_EQUIPE} joueurs."
            )
        return equipe

    def get_compte_lie(self, obj):
        return obj.athlete.utilisateur_id is not None

    def get_a_des_stats(self, obj):
        return protections.joueur_a_des_stats(obj)

    def validate(self, attrs):
        email = athletes.normaliser_email(attrs.pop('email', None))
        if email and self.instance is not None and self.instance.athlete.utilisateur_id is not None:
            raise serializers.ValidationError({'email': (
                "Ce joueur a relié son compte : sa fiche ne se change plus par email (délie-le d'abord si c'est une erreur)."
            )})
        joueur = self.instance or Joueur(prenom=attrs.get('prenom', ''), nom=attrs.get('nom', ''))
        fiche = athletes.fiche_pour_email(joueur, email) if email else (self.instance.athlete if self.instance else None)
        equipe = attrs.get('equipe') or self.instance.equipe
        self._fiche = fiche
        if self.instance is not None and self.instance.retire:
            return attrs  # hors effectif : ces règles s'appliqueront s'il y revient
        try:
            athletes.verifier_un_par_tournoi(fiche, equipe.tournoi_id, sauf_joueur=self.instance, equipe_id=equipe.pk)
        except athletes.ConflitAthlete as erreur:
            raise serializers.ValidationError({'email' if email else 'equipe': str(erreur)}) from erreur
        numero = attrs.get('numero_maillot', getattr(self.instance, 'numero_maillot', None))
        memes_numeros = Joueur.objects.filter(equipe=equipe, numero_maillot=numero, retire=False)
        if self.instance is not None:
            memes_numeros = memes_numeros.exclude(pk=self.instance.pk)
        if memes_numeros.exists():
            raise serializers.ValidationError({'numero_maillot': f"Le numéro {numero} est déjà pris dans cette équipe."})
        return attrs

    def _enregistrer_fiche(self, validated_data):
        fiche = self._fiche
        if fiche is None:  # création sans email : nouvelle fiche
            fiche = Athlete(prenom=validated_data['prenom'], nom=validated_data['nom'])
        try:
            with transaction.atomic():
                fiche.save()
        except IntegrityError as erreur:  # même email enregistré au même instant par quelqu'un d'autre
            raise serializers.ValidationError({'email': "Cet email vient d'être utilisé, réessaie."}) from erreur
        validated_data['athlete'] = fiche

    @transaction.atomic
    def create(self, validated_data):
        self._enregistrer_fiche(validated_data)
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        ancienne = instance.athlete_id
        ancienne_equipe = instance.equipe_id
        self._enregistrer_fiche(validated_data)
        joueur = super().update(instance, validated_data)
        if joueur.equipe_id != ancienne_equipe:
            joueur.statistiques.all().delete()  # uniquement des lignes à 0 : validate_equipe refuse les autres cas
        fiche = joueur.athlete
        if ancienne != fiche.pk:
            athletes.supprimer_si_orpheline(ancienne)
        elif fiche.utilisateur_id is None and fiche.joueurs.count() == 1 and (fiche.prenom, fiche.nom) != (joueur.prenom, joueur.nom):
            # Fiche propre à ce joueur (et sans compte) : elle suit les corrections de nom
            fiche.prenom, fiche.nom = joueur.prenom, joueur.nom
            fiche.save(update_fields=['prenom', 'nom', 'updated_at'])
        return joueur


class PhotoAthleteSerializer(serializers.ModelSerializer):
    """Photo de profil, envoyée par le joueur relié à la fiche."""
    photo = serializers.ImageField(required=True, validators=[valider_taille_image])

    class Meta:
        model = Athlete
        fields = ['photo']


class PostesAthleteSerializer(serializers.Serializer):
    """Postes choisis par le joueur relié : un ou plusieurs parmi les 5, ou aucun."""
    postes = serializers.ListField(
        child=serializers.ChoiceField(choices=POSTES), allow_empty=True, max_length=len(POSTES),
    )

    def validate_postes(self, postes):
        ordre = [code for code, _ in POSTES]
        return sorted(set(postes), key=ordre.index)  # sans doublon, dans l'ordre du terrain


class NumeroJoueurSerializer(serializers.Serializer):
    """Nouveau numéro du joueur relié dans l'une de ses équipes."""
    joueur = serializers.IntegerField()
    numero_maillot = serializers.IntegerField(min_value=0, max_value=99)


class StatistiqueJoueurSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle StatistiqueJoueur."""
    joueur_nom = serializers.SerializerMethodField()
    joueur_numero = serializers.IntegerField(source='joueur.numero_maillot', read_only=True)
    athlete = serializers.IntegerField(source='joueur.athlete_id', read_only=True)
    joueur_postes = serializers.JSONField(source='joueur.athlete.postes', read_only=True)
    joueur_photo = serializers.SerializerMethodField()
    equipe_nom = serializers.CharField(source='joueur.equipe.nom', read_only=True)

    class Meta:
        model = StatistiqueJoueur
        fields = [
            'id', 'joueur', 'athlete', 'match', 'joueur_nom', 'joueur_numero', 'joueur_postes', 'joueur_photo', 'equipe_nom',
            'points', 'passes', 'rebonds', 'contres', 'fautes',
            'created_at', 'updated_at'
        ]

    def get_joueur_photo(self, obj):
        """Photo de l'inscription, sinon celle que le joueur a mise sur sa fiche athlète."""
        image = obj.joueur.photo or obj.joueur.athlete.photo
        if not image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(image.url) if request else image.url

    def get_joueur_nom(self, obj):
        return f"{obj.joueur.prenom} {obj.joueur.nom}"

    def validate(self, attrs):
        joueur = attrs.get('joueur', getattr(self.instance, 'joueur', None))
        match = attrs.get('match', getattr(self.instance, 'match', None))
        if joueur and match and joueur.equipe_id not in (match.equipe_domicile_id, match.equipe_exterieur_id):
            raise serializers.ValidationError("Ce joueur n'appartient à aucune des deux équipes du match.")
        return attrs


class ActionMatchSerializer(serializers.ModelSerializer):
    """Une ligne de l'historique du match."""

    class Meta:
        model = ActionMatch
        fields = [
            'id', 'type', 'cote', 'joueur_libelle', 'champ', 'valeur', 'periode', 'temps_restant_secondes',
            'annulee', 'created_at',
        ]


class MatchSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Match."""
    equipe_domicile_nom = serializers.CharField(source='equipe_domicile.nom', read_only=True)
    equipe_exterieur_nom = serializers.CharField(source='equipe_exterieur.nom', read_only=True)
    tournoi_nom = serializers.CharField(source='tournoi.nom', read_only=True)
    tournoi_slug = serializers.CharField(source='tournoi.slug', read_only=True)
    organisateur_nom = serializers.CharField(source='tournoi.organisateur.username', read_only=True)
    # Permet au frontend de reconnaître l'organisateur par son id (et non son nom)
    organisateur_id = serializers.IntegerField(source='tournoi.organisateur_id', read_only=True)
    tournoi_cloture_le = serializers.DateTimeField(source='tournoi.cloture_le', read_only=True)
    # Le QR code du direct prévient que le lien d'un tournoi privé ne s'ouvre pas pour le public
    tournoi_prive = serializers.BooleanField(source='tournoi.prive', read_only=True)
    statistiques = StatistiqueJoueurSerializer(many=True, read_only=True, source='statistiques_joueurs')
    reglement = serializers.JSONField(required=False)

    mvp = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id', 'tournoi', 'tournoi_nom', 'tournoi_slug', 'tournoi_cloture_le', 'tournoi_prive',
            'organisateur_nom', 'organisateur_id',
            'phase', 'equipe_domicile', 'equipe_domicile_nom',
            'equipe_exterieur', 'equipe_exterieur_nom', 'statut', 'forfait', 'score_domicile',
            'score_exterieur', 'date_match', 'statistiques', 'mvp', 'reglement',
            'temps_restant_secondes', 'periode_actuelle', 'chrono_en_cours',
            'shot_clock_secondes', 'possession_fleche', 'score_periodes',
            'created_at', 'updated_at'
        ]
        # Le score découle des statistiques des joueurs (voir Match.calculer_scores_depuis_stats),
        # ou du forfait, qui a sa propre action (voir MatchViewSet.forfait)
        read_only_fields = ['forfait', 'score_domicile', 'score_exterieur', 'score_periodes']

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

        # Historique : dernière action annulable, et repère pour recharger le déroulé quand il change
        recentes = list(instance.actions.order_by('-id')[:30])
        data['actions_version'] = f"{recentes[0].id}-{sum(a.annulee for a in recentes)}" if recentes else None
        derniere = next((a for a in recentes if not a.annulee and a.type in TYPES_ANNULABLES), None)
        data['derniere_action'] = ActionMatchSerializer(derniere).data if derniere else None
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

        # N'enregistre que les champs modifiés ici : le score, les fautes d'équipe et les temps morts
        # sont tenus par les actions du match et ne doivent jamais être réécrits avec une valeur périmée.
        for champ, valeur in validated_data.items():
            setattr(instance, champ, valeur)
        champs = set(validated_data) | set(self.CHAMPS_CHRONO) | {'chrono_demarre_a', 'updated_at'}
        if nouveau_reglement is not None:
            champs.add('reglement')
        instance.save(update_fields=sorted(champs))
        match = instance

        if vient_de_finir and match.phase != 'poule':
            # Match suivant de la série, ou tour suivant si toutes les séries de la phase sont décidées
            avancer_phases_finales(match.tournoi)
        return match

    def get_mvp(self, obj):
        """MVP du match (meilleure évaluation), à partir des stats déjà chargées ; aucun sur un forfait."""
        if obj.forfait:
            return None
        return mvp_du_match(obj.statistiques_joueurs.all())

    def validate(self, attrs):
        match = self.instance
        if match and match.statut == 'termine' and set(attrs) - self.CHAMPS_MATCH_TERMINE:
            raise serializers.ValidationError(
                "Match terminé : repassez-le « en cours » pour le modifier."
            )
        rouvert = match and match.statut == 'termine' and attrs.get('statut') in ('a_venir', 'en_cours')
        if rouvert and match.forfait:
            raise serializers.ValidationError({'statut': "Ce match est un forfait : annulez le forfait pour le rouvrir."})
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

        if attrs.get('statut') == 'termine' and not getattr(match, 'forfait', ''):
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
            'equipe_exterieur', 'equipe_exterieur_nom', 'statut', 'forfait', 'score_domicile',
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



class LigneFeuilleSerializer(serializers.Serializer):
    """Totaux d'un joueur sur la feuille de match saisie après coup."""
    joueur = serializers.IntegerField()
    points = serializers.IntegerField(min_value=0, max_value=200, default=0)
    passes = serializers.IntegerField(min_value=0, max_value=200, default=0)
    rebonds = serializers.IntegerField(min_value=0, max_value=200, default=0)
    contres = serializers.IntegerField(min_value=0, max_value=200, default=0)
    fautes = serializers.IntegerField(min_value=0, max_value=20, default=0)


class ForfaitSerializer(serializers.Serializer):
    """Équipe forfait et score retenu (ignoré pour un double forfait, toujours 0-0)."""
    equipe = serializers.ChoiceField(choices=[
        Match.FORFAIT_DOMICILE, Match.FORFAIT_EXTERIEUR, Match.FORFAIT_DOUBLE,
    ])
    score_vainqueur = serializers.IntegerField(min_value=1, max_value=200, default=forfaits.SCORE_VAINQUEUR)
    score_perdant = serializers.IntegerField(min_value=0, max_value=200, default=forfaits.SCORE_PERDANT)

    def validate(self, attrs):
        if attrs['equipe'] != Match.FORFAIT_DOUBLE and attrs['score_vainqueur'] <= attrs['score_perdant']:
            raise serializers.ValidationError(
                {'score_vainqueur': "Le vainqueur doit avoir plus de points que l'équipe forfait."}
            )
        return attrs


class PresencesSerializer(serializers.Serializer):
    """Joueurs sans stat que l'organisateur confirme avoir vus sur le terrain."""
    presents = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=True, max_length=200)


class SaisieFeuilleSerializer(serializers.Serializer):
    """Feuille de match saisie après coup : totaux des joueurs, score par période (facultatif), fin du match."""
    stats = LigneFeuilleSerializer(many=True, allow_empty=False)
    score_periodes = serializers.DictField(
        child=serializers.ListField(
            child=serializers.IntegerField(min_value=0, max_value=300), min_length=1, max_length=20,
        ),
        required=False, allow_null=True,
    )
    terminer = serializers.BooleanField(default=False)

    def validate_stats(self, lignes):
        joueurs = [ligne['joueur'] for ligne in lignes]
        if len(joueurs) != len(set(joueurs)):
            raise serializers.ValidationError("Un joueur apparaît deux fois sur la feuille.")
        return lignes

    def validate_score_periodes(self, periodes):
        if periodes is None:
            return None
        if set(periodes) != {'domicile', 'exterieur'}:
            raise serializers.ValidationError("Indiquez le score par période des deux équipes (domicile et exterieur).")
        if len(periodes['domicile']) != len(periodes['exterieur']):
            raise serializers.ValidationError("Les deux équipes doivent avoir le même nombre de périodes.")
        return periodes
