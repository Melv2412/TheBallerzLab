from django.apps import AppConfig


class TournoisConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tournois'

    def ready(self):
        from . import athletes  # noqa: F401  (branche le nettoyage des fiches orphelines)
