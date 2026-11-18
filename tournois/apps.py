from django.apps import AppConfig


class TournoisConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tournois'

    def ready(self):
        from . import athletes, images  # noqa: F401  (branchent le nettoyage des fiches et des images)
