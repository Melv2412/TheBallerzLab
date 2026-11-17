from django.db import migrations, models

ORGANISATEURS = 'Organisateurs'
DEMANDES = 'Demandes organisateur'


def creer_groupe_demandes(apps, schema_editor):
    """
    Les comptes existants n'avaient pas de type : ceux qui ne sont ni validés, ni staff,
    ni reliés à une fiche athlète, ni capitaines étaient des inscriptions organisateur en attente.
    """
    Group = apps.get_model('auth', 'Group')
    User = apps.get_model('auth', 'User')
    demandes, _ = Group.objects.get_or_create(name=DEMANDES)
    en_attente = User.objects.filter(
        is_staff=False, athlete__isnull=True, demandes_equipes__isnull=True,
    ).exclude(groups__name=ORGANISATEURS).distinct()
    demandes.user_set.add(*en_attente)


def supprimer_groupe_demandes(apps, schema_editor):
    apps.get_model('auth', 'Group').objects.filter(name=DEMANDES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tournois', '0021_temps_reel'),
    ]

    operations = [
        migrations.AddField(
            model_name='athlete',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='athletes/photos/'),
        ),
        migrations.RunPython(creer_groupe_demandes, supprimer_groupe_demandes),
    ]
