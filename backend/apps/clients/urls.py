from django.urls import path
from .views import ClientListView, ClientDetailView, ContactListView, ContactDetailView

urlpatterns = [
    path('', ClientListView.as_view(), name='client-list'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client-detail'),
    path('<int:client_pk>/contacts/', ContactListView.as_view(), name='contact-list'),
    path('<int:client_pk>/contacts/<int:pk>/', ContactDetailView.as_view(), name='contact-detail'),
]
