from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Client, Contact
from .serializers import ClientSerializer, ClientListSerializer, ContactSerializer


class ClientListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'industry', 'company_size', 'budget_range', 'assigned_to']
    search_fields = ['name', 'industry', 'website']
    ordering_fields = ['name', 'created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        return Client.objects.select_related('assigned_to', 'created_by').prefetch_related('contacts')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ClientSerializer
        return ClientListSerializer


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.select_related('assigned_to', 'created_by').prefetch_related('contacts')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]


class ContactListView(generics.ListCreateAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(client_id=self.kwargs['client_pk'])

    def perform_create(self, serializer):
        client = generics.get_object_or_404(Client, pk=self.kwargs['client_pk'])
        serializer.save(client=client)


class ContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(client_id=self.kwargs['client_pk'])
