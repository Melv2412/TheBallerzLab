import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tournois', '0017_une_fiche_par_joueur'),
    ]

    operations = [
        migrations.AlterField(
            model_name='joueur',
            name='athlete',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, related_name='joueurs', to='tournois.athlete',
            ),
        ),
    ]
