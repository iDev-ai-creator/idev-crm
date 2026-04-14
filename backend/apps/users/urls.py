from django.urls import path
from .views import MeView, UserListView, UserDetailView, RoleListView

urlpatterns = [
    path('me/', MeView.as_view(), name='user-me'),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('roles/', RoleListView.as_view(), name='role-list'),
]
