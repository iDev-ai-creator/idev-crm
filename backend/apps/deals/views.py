from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Deal, DealNote
from .serializers import DealSerializer, DealNoteSerializer, ReorderItemSerializer


class DealListView(generics.ListCreateAPIView):
    serializer_class = DealSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'client', 'assigned_to']
    search_fields = ['title', 'client__name']
    ordering = ['status', 'order']

    def get_queryset(self):
        return Deal.objects.select_related('client', 'assigned_to', 'created_by')


class DealDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Deal.objects.select_related('client', 'assigned_to', 'created_by')
    serializer_class = DealSerializer
    permission_classes = [IsAuthenticated]


class DealReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReorderItemSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        for item in serializer.validated_data:
            Deal.objects.filter(pk=item['id']).update(order=item['order'])
        return Response({'status': 'ok'})


class DealNoteListView(generics.ListCreateAPIView):
    serializer_class = DealNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealNote.objects.filter(
            deal_id=self.kwargs['deal_pk'], is_deleted=False
        ).select_related('author')

    def perform_create(self, serializer):
        deal = generics.get_object_or_404(Deal, pk=self.kwargs['deal_pk'])
        serializer.save(deal=deal, author=self.request.user)


class DealNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DealNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealNote.objects.filter(deal_id=self.kwargs['deal_pk'])

    def destroy(self, request, *args, **kwargs):
        note = self.get_object()
        note.is_deleted = True
        note.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        note = self.get_object()
        if note.author != request.user:
            return Response({'error': "Cannot edit another user's note"}, status=403)
        return super().update(request, *args, **kwargs)
