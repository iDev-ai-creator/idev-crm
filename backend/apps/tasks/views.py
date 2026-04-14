from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Task
from .serializers import TaskSerializer


class TaskListView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'linked_client', 'linked_deal']
    search_fields = ['title', 'description']
    ordering_fields = ['deadline', 'priority', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return Task.objects.select_related('assigned_to', 'created_by', 'linked_client', 'linked_deal')


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Task.objects.select_related('assigned_to', 'created_by', 'linked_client', 'linked_deal')
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
