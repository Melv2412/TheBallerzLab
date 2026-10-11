from django.db import models
from django.db.models import Sum
from django.core.validators import MinValueValidator
from django.contrib.auth.models import User
from django.utils.text import slugify


class Tournoi(models.Model):
    """Modèle représentant un tournoi de basket."""
    nom = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=250, unique=True, blank=True)
    organisateur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tournois_crees', null=True, blank=True)
    date_debut = models.DateField()
    date_fin = models.DateField()
    
    # Configuration des phases du tournoi
    has_8emes = models.BooleanField(default=False)
    has_quarts = models.BooleanField(default=False)
    has_demis = models.BooleanField(default=False)
    has_finale = models.BooleanField(default=True)
    limite_fautes = models.IntegerField(default=5, validators=[MinValueValidator(1)])
    
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


class Equipe(models.Model):
    """Modèle représentant une équipe dans un tournoi."""
    nom = models.CharField(max_length=200)
    logo = models.ImageField(upload_to='equipes/logos/', null=True, blank=True)
    tournoi = models.ForeignKey(Tournoi, on_delete=models.CASCADE, related_name='equipes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Équipe"
        verbose_name_plural = "Équipes"
        ordering = ['nom']
        unique_together = [['nom', 'tournoi']]

    def __str__(self):
        return f"{self.nom} ({self.tournoi.nom})"


class Joueur(models.Model):
    """Modèle représentant un joueur dans une équipe."""
    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    numero_maillot = models.IntegerField(validators=[MinValueValidator(0)])
    equipe = models.ForeignKey(Equipe, on_delete=models.CASCADE, related_name='joueurs')
    photo = models.ImageField(upload_to='joueurs/photos/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Joueur"
        verbose_name_plural = "Joueurs"
        ordering = ['equipe', 'numero_maillot']
        unique_together = [['equipe', 'numero_maillot']]

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
    
    # Gestion du chronomètre et des périodes
    temps_restant_secondes = models.IntegerField(default=600, validators=[MinValueValidator(0)])  # 10 minutes par défaut
    periode_actuelle = models.IntegerField(default=1, validators=[MinValueValidator(1)])  # Quart-temps actuel
    duree_periode_secondes = models.IntegerField(default=600, validators=[MinValueValidator(1)])  # 10 min par période
    chrono_en_cours = models.BooleanField(default=False)  # Le chrono tourne-t-il ?
    
    # Shot Clock (24 secondes)
    shot_clock_secondes = models.IntegerField(default=24, validators=[MinValueValidator(0)])
    
    # Flèche de possession (domicile, exterieur ou neutre)
    POSSESSION_CHOICES = [
        ('domicile', 'Domicile'),
        ('exterieur', 'Extérieur'),
        ('neutre', 'Neutre'),
    ]
    possession_fleche = models.CharField(max_length=20, choices=POSSESSION_CHOICES, default='neutre')

    # Gestion des timeouts
    timeouts_domicile = models.IntegerField(default=5, validators=[MinValueValidator(0)])
    timeouts_exterieur = models.IntegerField(default=5, validators=[MinValueValidator(0)])
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Match"
        verbose_name_plural = "Matchs"
        ordering = ['-date_match', '-created_at']

    def __str__(self):
        return f"{self.equipe_domicile.nom} vs {self.equipe_exterieur.nom} ({self.tournoi.nom})"

    def calculer_scores_depuis_stats(self):
        """Calcule les scores des équipes à partir des statistiques des joueurs."""
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
        self.save(update_fields=['score_domicile', 'score_exterieur'])
    
    def calculer_fautes_equipe(self, equipe):
        """Calcule le total des fautes d'une équipe à partir des fautes individuelles."""
        return StatistiqueJoueur.objects.filter(
            joueur__equipe=equipe,
            match=self
        ).aggregate(total=Sum('fautes'))['total'] or 0
    
    def get_fautes_domicile(self):
        """Retourne le nombre total de fautes de l'équipe domicile."""
        return self.calculer_fautes_equipe(self.equipe_domicile)
    
    def get_fautes_exterieur(self):
        """Retourne le nombre total de fautes de l'équipe extérieur."""
        return self.calculer_fautes_equipe(self.equipe_exterieur)


class StatistiqueJoueur(models.Model):
    """Modèle représentant les statistiques d'un joueur pour un match donné."""
    joueur = models.ForeignKey(Joueur, on_delete=models.CASCADE, related_name='statistiques')
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='statistiques_joueurs')
    points = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    passes = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    rebonds = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    contres = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    fautes = models.IntegerField(default=0, validators=[MinValueValidator(0)])
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

