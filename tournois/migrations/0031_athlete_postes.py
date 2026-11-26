from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tournois', '0030_mode_classement'),
    ]

    operations = [
        migrations.AddField(
            model_name='athlete',
            name='postes',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
