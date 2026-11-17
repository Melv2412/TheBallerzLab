from django.db import migrations


def creer_fiches(apps, schema_editor):
    """Une fiche par joueur existant (aucun regroupement automatique : les doublons se fusionnent dans l'admin)."""
    Athlete = apps.get_model('tournois', 'Athlete')
    Joueur = apps.get_model('tournois', 'Joueur')
    for joueur in Joueur.objects.filter(athlete__isnull=True).only('id', 'prenom', 'nom'):
        joueur.athlete = Athlete.objects.create(prenom=joueur.prenom, nom=joueur.nom)
        joueur.save(update_fields=['athlete'])


class Migration(migrations.Migration):
    # Migration séparée : sur Postgres, modifier la table juste après ces écritures dans la même
    # transaction échoue (« pending trigger events »)

    dependencies = [
        ('tournois', '0016_athlete'),
    ]

    operations = [
        migrations.RunPython(creer_fiches, migrations.RunPython.noop),
    ]
