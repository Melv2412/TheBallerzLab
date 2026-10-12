"""
Django settings for basket_tournament project.
"""

import sys
from pathlib import Path

import dj_database_url
from decouple import config, Csv

# Toute la configuration de prod passe par des variables d'environnement (voir .env.example).
# Sans variable définie, on obtient la configuration de développement local.

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('DJANGO_SECRET_KEY', default='django-insecure-dev-key-change-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DJANGO_DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Nécessaire pour l'admin Django en HTTPS (ex. https://thelab-api.vercel.app)
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

# Derrière le proxy HTTPS de l'hébergeur
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    # Prod : HTTPS obligatoire et cookies jamais envoyés en clair
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=3600, cast=int)


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'tournois',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'basket_tournament.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'basket_tournament.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

DATABASE_URL = config('DATABASE_URL', default='')

if DATABASE_URL:
    # Prod : PostgreSQL (Supabase). Avec le pooler en mode transaction (port 6543),
    # les connexions ne doivent pas être gardées ouvertes ni utiliser de curseurs serveur.
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=config('DB_CONN_MAX_AGE', default=0, cast=int),
            ssl_require=config('DB_SSL_REQUIRE', default=True, cast=bool),
        )
    }
    DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
else:
    # Local : SQLite
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Hachage des mots de passe : Argon2 (plus sûr et bien plus rapide que PBKDF2).
# PBKDF2 reste listé pour vérifier les anciens mots de passe, convertis en Argon2 à la connexion.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]

if 'test' in sys.argv:
    # Tests : hachage rapide (non sécurisé, uniquement pour la base de test jetable)
    PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'fr-fr'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

STORAGES = {
    # Local : logos et photos dans /media
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

STORAGE_BUCKET = config('STORAGE_BUCKET', default='')

if STORAGE_BUCKET:
    # Prod : Supabase Storage via son API compatible S3 (bucket public)
    STORAGES['default'] = {
        'BACKEND': 'storages.backends.s3.S3Storage',
        'OPTIONS': {
            'bucket_name': STORAGE_BUCKET,
            'endpoint_url': config('STORAGE_S3_ENDPOINT'),        # https://<projet>.supabase.co/storage/v1/s3
            'region_name': config('STORAGE_S3_REGION'),           # ex. eu-west-3
            'access_key': config('STORAGE_S3_ACCESS_KEY_ID'),
            'secret_key': config('STORAGE_S3_SECRET_ACCESS_KEY'),
            'addressing_style': 'path',
            # URLs publiques directes (sans signature) : <projet>.supabase.co/storage/v1/object/public/<bucket>
            'custom_domain': config('STORAGE_PUBLIC_DOMAIN'),
            'querystring_auth': False,
            'file_overwrite': False,
        },
    }

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Taille maximale des images envoyées (logos, photos)
TAILLE_MAX_IMAGE_MO = config('TAILLE_MAX_IMAGE_MO', default=2, cast=int)

# Limites par organisateur (le staff n'est pas limité) — voir tournois/organisateurs.py
LIMITE_TOURNOIS_ACTIFS = config('LIMITE_TOURNOIS_ACTIFS', default=3, cast=int)
LIMITE_EQUIPES_PAR_TOURNOI = config('LIMITE_EQUIPES_PAR_TOURNOI', default=32, cast=int)
LIMITE_JOUEURS_PAR_EQUIPE = config('LIMITE_JOUEURS_PAR_EQUIPE', default=25, cast=int)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    # Limite les tentatives de connexion et les inscriptions (par adresse IP)
    'DEFAULT_THROTTLE_RATES': {
        'connexion': config('THROTTLE_CONNEXION', default='10/min'),
        'inscription': config('THROTTLE_INSCRIPTION', default='20/hour'),
    },
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=Csv(),
)

CORS_ALLOW_CREDENTIALS = True


