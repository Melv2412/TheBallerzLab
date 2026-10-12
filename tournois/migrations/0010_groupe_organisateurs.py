from django.db import migrations

GROUPE = 'Organisateurs'


def creer_groupe(apps, schema_editor):
    """Crée le groupe et y place ceux qui organisent déjà un tournoi (rien ne change pour eux)."""
    Group = apps.get_model('auth', 'Group')
    User = apps.get_model('auth', 'User')
    groupe, _ = Group.objects.get_or_create(name=GROUPE)
    groupe.user_set.add(*User.objects.filter(tournois_crees__isnull=False).distinct())


def supprimer_groupe(apps, schema_editor):
    apps.get_model('auth', 'Group').objects.filter(name=GROUPE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('tournois', '0009_tournoi_victoires_requises_8eme_and_more'),
    ]

    operations = [
        migrations.RunPython(creer_groupe, supprimer_groupe),
    ]
