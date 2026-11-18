from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.db.models.functions import Lower
from django.utils import timezone
from django.utils.text import slugify

from . import reglement as regles


def reglement_par_defaut():
    return dict(regles.FIBA)


class Tournoi(models.Model):
    """Modèle représentant un tournoi de basket."""
    nom = models.CharField(max_length=200)  # unique par organisateur (voir Meta) ; le slug reste unique
    slug = models.SlugField(max_length=250, unique=True, blank=True)
    # Compte supprimé : le tournoi reste, sans organisateur (il passe alors au staff)
    organisateur = models.ForeignKey(User, on_delete=models.SET_NULL, related_name='tournois_crees', null=True, blank=True)
    # Date de mise à la corbeille : le tournoi est alors masqué partout (voir corbeille.py)
    supprime_le = models.DateTimeField(null=True, blank=True, db_index=True, editable=False)
    date_debut = models.DateField()
    date_fin = models.DateField()

    # Configuration des phases du tournoi
    has_8emes = models.BooleanField(default=False)
    has_quarts = models.BooleanField(default=False)
    has_demis = models.BooleanField(default=False)
    has_finale = models.BooleanField(default=True)
    # Les joueurs peuvent rejoindre leur équipe par le lien d'invitation (fermable par l'organisateur)
    inscriptions_ouvertes = models.BooleanField(default=True)
    # Lien /inscription/<code> : les capitaines proposent leur équipe (aucun lien tant que le code est vide)
    code_inscription = models.CharField(max_length=32, unique=True, null=True, blank=True)
    # Règlement (voir tournois/reglement.py) : copié sur chaque match à sa création
    reglement = models.JSONField(default=reglement_par_defaut)

    # Séries éliminatoires (nombre de victoires requises pour remporter la série)
    victoires_requises_8eme = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    victoires_requises_quart = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    victoires_requises_demi = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    victoires_requises_finale = models.IntegerField(default=1, validators=[MinValueValidator(1)])

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tournoi"
        verbose_name_plural = "Tournois"
        ordering = ['-date_debut']
        constraints = [
            models.UniqueConstraint(
                Lower('nom'), 'organisateur', name='tournoi_nom_unique_par_organisateur',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self.generer_slug_unique()
        super().save(*args, **kwargs)

    def generer_slug_unique(self):
        """Génère un slug unique et jamais purement numérique (sinon confondu avec un ID)."""
        base = slugify(self.nom)[:240] or 'tournoi'
        if base.isdigit():
            base = f'tournoi-{base}'
        slug, i = base, 2
        while Tournoi.objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f'{base}-{i}'
            i += 1
        return slug

    def __str__(self):
        return self.nom


class FichierASupprimer(models.Model):
    """Image à effacer du stockage, notée dans la même transaction que la suppression (voir images.py)."""
    nom = models.CharField(max_length=255, unique=True)
    pas_avant = models.DateTimeField(default=timezone.now)
    tentatives = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Fichier à supprimer"
        verbose_name_plural = "Fichiers à supprimer"

    def __str__(self):
        return self.nom


class Equipe(models.Model):
    """Modèle représentant une équipe dans un tournoi."""
    nom = models.CharField(max_length=200)
    logo = models.ImageField(upload_to='equipes/logos/', null=True, blank=True)
    tournoi = models.ForeignKey(Tournoi, on_delete=models.CASCADE, related_name='equipes')
    # Lien d'invitation /invitation/<code> envoyé au capitaine (régénérer le code tue l'ancien lien)
    code_invitation = models.CharField(max_length=32, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Équipe"
        verbose_name_plural = "Équipes"
        ordering = ['nom']
        unique_together = [['nom', 'tournoi']]

    def __str__(self):
        return f"{self.nom} ({self.tournoi.nom})"


class DemandeEquipe(models.Model):
    """Équipe proposée par un capitaine avec le lien d'inscription du tournoi, en attente de l'organisateur."""
    EN_ATTENTE, ACCEPTEE, REFUSEE = 'en_attente', 'acceptee', 'refusee'
    STATUTS = [(EN_ATTENTE, 'En attente'), (ACCEPTEE, 'Acceptée'), (REFUSEE, 'Refusée')]

    tournoi = models.ForeignKey(Tournoi, on_delete=models.CASCADE, related_name='demandes_equipes')
    capitaine = models.ForeignKey(User, on_delete=models.CASCADE, related_name='demandes_equipes')
    nom = models.CharField(max_length=200)
    statut = models.CharField(max_length=12, choices=STATUTS, default=EN_ATTENTE)
    # Équipe créée à l'acceptation (vide si l'organisateur la supprime ensuite)
    equipe = models.OneToOneField(
        Equipe, on_delete=models.SET_NULL, null=True, blank=True, related_name='demande',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Demande d'équipe"
        verbose_name_plural = "Demandes d'équipes"
        ordering = ['created_at']
        # Une demande par capitaine et par tournoi (modifiée si elle est refusée puis renvoyée)
        unique_together = [['tournoi', 'capitaine']]

    def __str__(self):
        return f"{self.nom} ({self.tournoi.nom}, {self.get_statut_display()})"


class Athlete(models.Model):
    """
    La personne réelle, au-dessus de ses inscriptions (Joueur) dans les équipes de différents tournois.
    L'email est facultatif : un organisateur qui le connaît retrouve la fiche par recherche exacte.
    """
    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True)  # toujours en minuscules
    # Compte du joueur, relié quand il rejoint son équipe par le lien d'invitation
    utilisateur = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='athlete',
    )
    # Photo de profil, choisie par le joueur relié (compressée par le navigateur avant l'envoi)
    photo = models.ImageField(upload_to='athletes/photos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Athlète"
        verbose_name_plural = "Athlètes"
        ordering = ['nom', 'prenom']
        constraints = [
            # Les fiches sans email (NULL) ne sont pas concernées
            models.UniqueConstraint(Lower('email'), name='athlete_email_unique'),
        ]

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower() if self.email else None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.prenom} {self.nom}" + (f" <{self.email}>" if self.email else "")


class Joueur(models.Model):
    """Inscription d'un athlète dans une équipe (un athlète au maximum par tournoi)."""
    athlete = models.ForeignKey(Athlete, on_delete=models.PROTECT, related_name='joueurs')
    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    numero_maillot = models.IntegerField(validators=[MinValueValidator(0)])
    equipe = models.ForeignKey(Equipe, on_delete=models.CASCADE, related_name='joueurs')
    photo = models.ImageField(upload_to='joueurs/photos/', null=True, blank=True)
    # Retiré de l'effectif : absent des prochains matchs, ses stats restent dans ceux déjà joués
    retire = models.BooleanField(default=False, db_default=False)  # l'ancien code peut encore inscrire pendant la mise en ligne
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Joueur"
        verbose_name_plural = "Joueurs"
        ordering = ['equipe', 'numero_maillot']
        constraints = [
            # Le numéro d'un joueur retiré peut être repris
            models.UniqueConstraint(
                fields=['equipe', 'numero_maillot'], condition=models.Q(retire=False),
                name='joueur_numero_unique_dans_effectif',
            ),
        ]

    def save(self, *args, **kwargs):
        # Un joueur créé sans fiche (admin, tests, anciens appels) en reçoit une nouvelle
        if self.athlete_id is None:
            self.athlete = Athlete.objects.create(prenom=self.prenom, nom=self.nom)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.prenom} {self.nom} (#{self.numero_maillot}) - {self.equipe.nom}"


class Match(models.Model):
    """Modèle représentant un match dans un tournoi."""
    STATUT_CHOICES = [
        ('a_venir', 'À venir'),
        ('en_cours', 'En cours'),
        ('termine', 'Terminé'),
    ]

    PHASE_CHOICES = [
        ('poule', 'Poule / Saison'),
        ('8eme', '8ème de finale'),
        ('quart', 'Quart de finale'),
        ('demi', 'Demi-finale'),
        ('finale', 'Finale'),
    ]

    tournoi = models.ForeignKey(Tournoi, on_delete=models.CASCADE, related_name='matchs')
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES, default='poule')
    equipe_domicile = models.ForeignKey(
        Equipe,
        on_delete=models.CASCADE,
        related_name='matchs_domicile'
    )
    equipe_exterieur = models.ForeignKey(
        Equipe,
        on_delete=models.CASCADE,
        related_name='matchs_exterieur'
    )
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='a_venir')
    score_domicile = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    score_exterieur = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    date_match = models.DateTimeField(null=True, blank=True)

    # Équipe forfait : le match est alors « terminé » et son score est posé à la main (voir tournois/forfaits.py)
    FORFAIT_AUCUN = ''
    FORFAIT_DOMICILE = 'domicile'
    FORFAIT_EXTERIEUR = 'exterieur'
    FORFAIT_DOUBLE = 'double'
    FORFAIT_CHOICES = [
        (FORFAIT_AUCUN, 'Aucun'),
        (FORFAIT_DOMICILE, 'Domicile'),
        (FORFAIT_EXTERIEUR, 'Extérieur'),
        (FORFAIT_DOUBLE, 'Double forfait'),
    ]
    # db_default : l'ancien code peut encore créer des matchs pendant la mise en ligne
    forfait = models.CharField(max_length=10, choices=FORFAIT_CHOICES, blank=True, default='', db_default='')

    # Gestion du chronomètre et des périodes.
    # Quand le chrono tourne, temps_restant_secondes et shot_clock_secondes sont les valeurs
    # à l'instant chrono_demarre_a : le temps réel se calcule (voir etat_chrono), sans écriture chaque seconde.
    temps_restant_secondes = models.FloatField(default=600, validators=[MinValueValidator(0)])  # 10 minutes par défaut
    periode_actuelle = models.IntegerField(default=1, validators=[MinValueValidator(1)])  # Au-delà de nb_periodes : prolongations
    chrono_en_cours = models.BooleanField(default=False)  # Le chrono tourne-t-il ?
    chrono_demarre_a = models.DateTimeField(null=True, blank=True)

    # Shot Clock (0 = désactivé)
    shot_clock_secondes = models.FloatField(default=24, validators=[MinValueValidator(0)])

    # Flèche de possession (domicile, exterieur ou neutre)
    POSSESSION_CHOICES = [
        ('domicile', 'Domicile'),
        ('exterieur', 'Extérieur'),
        ('neutre', 'Neutre'),
    ]
    possession_fleche = models.CharField(max_length=20, choices=POSSESSION_CHOICES, default='neutre')

    # Copie du règlement du tournoi (voir tournois/reglement.py)
    reglement = models.JSONField(default=reglement_par_defaut)

    # Fautes d'équipe de la portion de match en cours (période, mi-temps ou match selon le règlement) :
    # elles ne comptent que si fautes_equipe_segment est la portion actuelle.
    fautes_equipe_domicile = models.PositiveIntegerField(default=0)
    fautes_equipe_exterieur = models.PositiveIntegerField(default=0)
    fautes_equipe_segment = models.PositiveIntegerField(default=1)

    # Temps morts utilisés dans la portion en cours (mi-temps ou prolongation), même principe
    temps_morts_utilises_domicile = models.PositiveIntegerField(default=0)
    temps_morts_utilises_exterieur = models.PositiveIntegerField(default=0)
    temps_morts_segment = models.PositiveIntegerField(default=1)
    # Score par période saisi après coup ({'domicile': [..], 'exterieur': [..]}) ; vide si le match a été suivi
    # en direct (la feuille le calcule alors depuis l'historique) ou si les stats ont changé depuis la saisie
    score_periodes = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Match"
        verbose_name_plural = "Matchs"
        ordering = ['-date_match', '-created_at']

    def __str__(self):
        return f"{self.equipe_domicile.nom} vs {self.equipe_exterieur.nom} ({self.tournoi.nom})"

    def etat_chrono(self, maintenant=None):
        """
        État réel du chrono à `maintenant`, sans rien enregistrer.
        Le chrono s'arrête quand le shot clock tombe à 0 (violation). En fin de période, on passe à la
        suivante (prolongation si le temps réglementaire est fini à égalité), chrono arrêté ; si le temps
        réglementaire ou une prolongation se termine avec un vainqueur, le chrono reste à 0.
        """
        etat = {
            'temps_restant_secondes': self.temps_restant_secondes,
            'shot_clock_secondes': self.shot_clock_secondes,
            'periode_actuelle': self.periode_actuelle,
            'chrono_en_cours': self.chrono_en_cours,
        }
        if not self.chrono_en_cours or self.chrono_demarre_a is None:
            return etat

        maintenant = maintenant or timezone.now()
        ecoule = max(0.0, (maintenant - self.chrono_demarre_a).total_seconds())
        temps, shot = self.temps_restant_secondes, self.shot_clock_secondes
        shot_actif = shot > 0

        if shot_actif and shot < temps and ecoule >= shot:
            # Violation du shot clock avant la fin de la période
            etat.update(temps_restant_secondes=temps - shot, shot_clock_secondes=0, chrono_en_cours=False)
        elif ecoule >= temps:
            fin_du_match = (
                self.periode_actuelle >= self.reglement['nb_periodes']
                and self.score_domicile != self.score_exterieur
            )
            if fin_du_match:
                etat.update(temps_restant_secondes=0, shot_clock_secondes=0, chrono_en_cours=False)
            else:
                suivante = self.periode_actuelle + 1
                etat.update(
                    periode_actuelle=suivante,
                    temps_restant_secondes=regles.duree_periode(self.reglement, suivante),
                    shot_clock_secondes=regles.shot_clock_initial(self.reglement),
                    chrono_en_cours=False,
                )
        else:
            etat['temps_restant_secondes'] = temps - ecoule
            if shot_actif:
                etat['shot_clock_secondes'] = shot - ecoule
        return etat

    def figer_chrono(self, maintenant):
        """Enregistre en mémoire le temps écoulé depuis chrono_demarre_a (avant une modification)."""
        for champ, valeur in self.etat_chrono(maintenant).items():
            setattr(self, champ, valeur)
        self.chrono_demarre_a = maintenant if self.chrono_en_cours else None

    @property
    def a_commence(self):
        """Le match a-t-il démarré (statut, chrono déjà lancé ou période entamée) ?"""
        return (
            self.statut != 'a_venir'
            or self.chrono_en_cours
            or self.periode_actuelle > 1
            or self.temps_restant_secondes < regles.duree_periode(self.reglement, 1)
        )

    def fautes_equipe(self, cote, periode=None):
        """Fautes d'équipe de la portion de match en cours ('domicile' ou 'exterieur')."""
        periode = periode or self.etat_chrono()['periode_actuelle']
        if regles.segment_fautes(self.reglement, periode) != self.fautes_equipe_segment:
            return 0
        return getattr(self, f'fautes_equipe_{cote}')

    def temps_morts_restants(self, cote, periode=None):
        periode = periode or self.etat_chrono()['periode_actuelle']
        segment = regles.segment_temps_morts(self.reglement, periode)
        utilises = getattr(self, f'temps_morts_utilises_{cote}') if segment == self.temps_morts_segment else 0
        return max(0, regles.dotation_temps_morts(self.reglement, segment) - utilises)

    def appliquer_reglement(self):
        """Remet le chrono au départ selon le règlement (match pas encore commencé)."""
        self.periode_actuelle = 1
        self.temps_restant_secondes = regles.duree_periode(self.reglement, 1)
        self.shot_clock_secondes = regles.shot_clock_initial(self.reglement)
        self.chrono_en_cours = False
        self.chrono_demarre_a = None

    def calculer_scores_depuis_stats(self):
        """Calcule les scores des équipes à partir des statistiques des joueurs (sauf forfait : score posé à la main)."""
        if self.forfait:
            return
        stats_domicile = StatistiqueJoueur.objects.filter(
            joueur__equipe=self.equipe_domicile,
            match=self
        ).aggregate(total=Sum('points'))['total'] or 0

        stats_exterieur = StatistiqueJoueur.objects.filter(
            joueur__equipe=self.equipe_exterieur,
            match=self
        ).aggregate(total=Sum('points'))['total'] or 0

        self.score_domicile = stats_domicile
        self.score_exterieur = stats_exterieur
        champs = ['score_domicile', 'score_exterieur']
        if self.score_periodes and (
            sum(self.score_periodes['domicile']) != stats_domicile
            or sum(self.score_periodes['exterieur']) != stats_exterieur
        ):
            self.score_periodes = None  # le score par période saisi ne correspond plus
            champs.append('score_periodes')
        self.save(update_fields=champs)


class StatistiqueJoueur(models.Model):
    """Modèle représentant les statistiques d'un joueur pour un match donné."""
    joueur = models.ForeignKey(Joueur, on_delete=models.CASCADE, related_name='statistiques')
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='statistiques_joueurs')
    points = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    passes = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    rebonds = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    contres = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    fautes = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    # Joueur à 0 partout que l'organisateur confirme avoir vu sur le terrain
    presence_confirmee = models.BooleanField(default=False, db_default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Statistique Joueur"
        verbose_name_plural = "Statistiques Joueurs"
        ordering = ['joueur__equipe', 'joueur__numero_maillot']
        unique_together = [['joueur', 'match']]

    def __str__(self):
        return f"{self.joueur} - {self.match} - {self.points}P {self.passes}PD {self.rebonds}R"

    def save(self, *args, **kwargs):
        """Override save pour mettre à jour automatiquement le score du match."""
        super().save(*args, **kwargs)
        # Mettre à jour le score du match
        self.match.calculer_scores_depuis_stats()

    def delete(self, *args, **kwargs):
        """Override delete pour mettre à jour le score du match après suppression."""
        match = self.match
        super().delete(*args, **kwargs)
        match.calculer_scores_depuis_stats()



class ActionMatch(models.Model):
    """
    Historique du match, action par action : déroulé du match, annulation de la dernière action,
    et base de la feuille de match. Une action annulée reste visible (marquée annulée).
    """
    TYPES = [
        ('stat', 'Statistique'),
        ('temps_mort', 'Temps mort'),
        ('periode', 'Changement de période'),
    ]
    COTES = [('domicile', 'Domicile'), ('exterieur', 'Extérieur')]

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='actions')
    type = models.CharField(max_length=20, choices=TYPES)
    cote = models.CharField(max_length=10, choices=COTES, blank=True)
    # Statistique concernée (vide pour un temps mort ou un changement de période)
    statistique = models.ForeignKey(
        StatistiqueJoueur, on_delete=models.SET_NULL, null=True, blank=True, related_name='actions',
    )
    joueur_libelle = models.CharField(max_length=220, blank=True)  # « #7 Paul MARTIN », figé au moment de l'action
    champ = models.CharField(max_length=20, blank=True)  # points, passes, rebonds, contres, fautes
    valeur = models.IntegerField(default=0)  # variation réellement appliquée (négative pour une correction)
    periode = models.PositiveIntegerField()
    temps_restant_secondes = models.FloatField()
    annulee = models.BooleanField(default=False)
    auteur = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Action de match"
        verbose_name_plural = "Actions de match"
        ordering = ['-id']

    def __str__(self):
        return f"{self.match_id} P{self.periode} {self.type} {self.champ} {self.valeur:+d} {self.joueur_libelle}"
