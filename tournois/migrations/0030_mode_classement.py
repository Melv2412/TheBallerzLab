from django.db import migrations


def ajouter_mode(apps, schema_editor):
    """Les règlements existants gardent le classement aux points (FIBA) : rien ne change pour eux."""
    for nom in ('Tournoi', 'Match'):
        Modele = apps.get_model('tournois', nom)
        for objet in Modele.objects.all().only('id', 'reglement'):
            if isinstance(objet.reglement, dict) and 'mode_classement' not in objet.reglement:
                objet.reglement = {**objet.reglement, 'mode_classement': 'points'}
                objet.save(update_fields=['reglement'])


def retirer_mode(apps, schema_editor):
    for nom in ('Tournoi', 'Match'):
        Modele = apps.get_model('tournois', nom)
        for objet in Modele.objects.all().only('id', 'reglement'):
            if isinstance(objet.reglement, dict) and 'mode_classement' in objet.reglement:
                objet.reglement = {k: v for k, v in objet.reglement.items() if k != 'mode_classement'}
                objet.save(update_fields=['reglement'])


class Migration(migrations.Migration):

    dependencies = [
        ('tournois', '0029_carte_tournoi'),
    ]

    operations = [
        migrations.RunPython(ajouter_mode, retirer_mode),
    ]
