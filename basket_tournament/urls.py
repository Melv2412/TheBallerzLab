from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


class ConnexionView(TokenObtainPairView):
    """Connexion JWT, limitée en nombre de tentatives (anti force brute)."""
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'connexion'


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('tournois.urls')),
    path('api/token/', ConnexionView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


