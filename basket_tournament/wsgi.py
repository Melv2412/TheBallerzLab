"""
WSGI config for basket_tournament project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'basket_tournament.settings')

application = get_wsgi_application()


