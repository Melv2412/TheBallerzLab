import django.db.models.deletion
import django.db.models.functions.text
from django.db import migrations, models


class Migration(migrations.Migration):
    """Fiche Athlète ; le lien depuis Joueur est d'abord facultatif (rempli par 0017)."""

    dependencies = [
        ('tournois', '0015_score_par_periode_saisi'),
    ]

    operations = [
        migrations.CreateModel(
            name='Athlete',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('prenom', models.CharField(max_length=100)),
                ('nom', models.CharField(max_length=100)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Athlète',
                'verbose_name_plural': 'Athlètes',
                'ordering': ['nom', 'prenom'],
                'constraints': [
                    models.UniqueConstraint(django.db.models.functions.text.Lower('email'), name='athlete_email_unique'),
                ],
            },
        ),
        migrations.AddField(
            model_name='joueur',
            name='athlete',
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.PROTECT, related_name='joueurs', to='tournois.athlete',
            ),
        ),
    ]
