from django.db import migrations, models

import tournois.models

FIBA = {
    'nb_periodes': 4,
    'duree_periode_secondes': 600,
    'duree_prolongation_secondes': 300,
    'shot_clock_actif': True,
    'shot_clock_secondes': 24,
    'shot_clock_court_secondes': 14,
    'fautes_exclusion': 5,
    'fautes_bonus': 5,
    'fautes_equipe_reset': 'periode',
    'temps_morts_premiere_mi_temps': 2,
    'temps_morts_seconde_mi_temps': 3,
    'temps_morts_prolongation': 1,
    'points_victoire': 2,
    'points_defaite': 1,
}


def reprendre_reglages(apps, schema_editor):
    """Le règlement reprend la limite de fautes du tournoi et la durée des périodes de chaque match."""
    Tournoi = apps.get_model('tournois', 'Tournoi')
    Match = apps.get_model('tournois', 'Match')
    for tournoi in Tournoi.objects.all():
        tournoi.reglement = {**FIBA, 'fautes_exclusion': min(max(tournoi.limite_fautes, 0), 20)}
        tournoi.save(update_fields=['reglement'])
    for match in Match.objects.select_related('tournoi'):
        duree = int(match.duree_periode_secondes)
        match.reglement = {
            **match.tournoi.reglement,
            'duree_periode_secondes': duree if 60 <= duree <= 3600 else FIBA['duree_periode_secondes'],
        }
        match.save(update_fields=['reglement'])


class Migration(migrations.Migration):

    dependencies = [
        ('tournois', '0011_chrono_horodatage'),
    ]

    operations = [
        migrations.AddField(
            model_name='tournoi',
            name='reglement',
            field=models.JSONField(default=tournois.models.reglement_par_defaut),
        ),
        migrations.AddField(
            model_name='match',
            name='reglement',
            field=models.JSONField(default=tournois.models.reglement_par_defaut),
        ),
        migrations.AddField(
            model_name='match',
            name='fautes_equipe_domicile',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='match',
            name='fautes_equipe_exterieur',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='match',
            name='fautes_equipe_segment',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='match',
            name='temps_morts_segment',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='match',
            name='temps_morts_utilises_domicile',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='match',
            name='temps_morts_utilises_exterieur',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(reprendre_reglages, migrations.RunPython.noop),
        migrations.RemoveField(model_name='match', name='duree_periode_secondes'),
        migrations.RemoveField(model_name='match', name='timeouts_domicile'),
        migrations.RemoveField(model_name='match', name='timeouts_exterieur'),
        migrations.RemoveField(model_name='tournoi', name='limite_fautes'),
    ]
