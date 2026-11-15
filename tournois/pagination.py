from rest_framework.pagination import PageNumberPagination


class Pagination(PageNumberPagination):
    """
    50 éléments par page par défaut. Le frontend peut demander jusqu'à 500 éléments
    (?page_size=500) pour charger d'un coup les équipes, joueurs ou matchs d'un tournoi.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500
