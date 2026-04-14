from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ChatChannel, ChatMessage
from .serializers import ChatChannelSerializer, ChatMessageSerializer


class ChatChannelListView(generics.ListCreateAPIView):
    serializer_class = ChatChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatChannel.objects.filter(members=self.request.user).prefetch_related('members', 'messages')

    def perform_create(self, serializer):
        channel = serializer.save()
        channel.members.add(self.request.user)


class ChatChannelDetailView(generics.RetrieveAPIView):
    serializer_class = ChatChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatChannel.objects.filter(members=self.request.user)


class ChatMessageListView(generics.ListAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        channel_id = self.kwargs['channel_id']
        # verify membership
        if not ChatChannel.objects.filter(pk=channel_id, members=self.request.user).exists():
            return ChatMessage.objects.none()
        return ChatMessage.objects.filter(channel_id=channel_id).select_related('author', 'reply_to__author').prefetch_related('reactions__user').order_by('created_at')


class DirectChannelView(APIView):
    """Get or create a direct channel with another user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.users.models import User
        user_id = request.data.get('user_id')
        try:
            other_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        channel, created = ChatChannel.get_or_create_direct(request.user, other_user)
        return Response(ChatChannelSerializer(channel).data, status=201 if created else 200)
