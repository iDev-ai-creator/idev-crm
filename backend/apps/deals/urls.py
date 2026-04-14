from django.urls import path
from .views import DealListView, DealDetailView, DealReorderView, DealNoteListView, DealNoteDetailView

urlpatterns = [
    path('', DealListView.as_view(), name='deal-list'),
    path('reorder/', DealReorderView.as_view(), name='deal-reorder'),
    path('<int:pk>/', DealDetailView.as_view(), name='deal-detail'),
    path('<int:deal_pk>/notes/', DealNoteListView.as_view(), name='deal-note-list'),
    path('<int:deal_pk>/notes/<int:pk>/', DealNoteDetailView.as_view(), name='deal-note-detail'),
]
