from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import ChatChannel, ChatMessage, ChatMention
from .serializers import (
    ChatChannelSerializer, ChatMessageSerializer, ChatMentionSerializer,
    extract_mentions,
)


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


class ChatMessageListView(generics.ListCreateAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        channel_id = self.kwargs['channel_id']
        # verify membership
        if not ChatChannel.objects.filter(pk=channel_id, members=self.request.user).exists():
            return ChatMessage.objects.none()
        return ChatMessage.objects.filter(channel_id=channel_id).select_related('author', 'reply_to__author').prefetch_related('reactions__user').order_by('created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        channel_id = self.kwargs['channel_id']
        if not ChatChannel.objects.filter(pk=channel_id, members=request.user).exists():
            return Response({'error': 'Not a channel member'}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get('text') or '').strip()
        file = request.FILES.get('attachment')
        reply_to_id = request.data.get('reply_to') or None

        if not text and not file:
            return Response({'error': 'Message must have text or attachment'}, status=status.HTTP_400_BAD_REQUEST)

        reply_to = None
        if reply_to_id:
            try:
                reply_to = ChatMessage.objects.get(pk=reply_to_id, channel_id=channel_id)
            except ChatMessage.DoesNotExist:
                reply_to = None

        msg = ChatMessage.objects.create(
            channel_id=channel_id,
            author=request.user,
            text=text,
            reply_to=reply_to,
            attachment=file if file else None,
            attachment_name=file.name if file else '',
            attachment_size=file.size if file else 0,
            attachment_mime=getattr(file, 'content_type', '') if file else '',
        )

        # Create mention rows for anyone @-tagged
        channel_obj = ChatChannel.objects.prefetch_related('members').get(pk=channel_id)
        mentioned = extract_mentions(text, channel_members=channel_obj.members.all())
        for u in mentioned:
            ChatMention.objects.get_or_create(message=msg, mentioned_user=u)

        data = ChatMessageSerializer(msg, context={'request': request}).data

        # Broadcast via Channels layer so connected websockets receive the new message
        layer = get_channel_layer()
        if layer is not None:
            async_to_sync(layer.group_send)(
                f'chat_{channel_id}',
                {'type': 'chat_message', 'message': data},
            )

        return Response(data, status=status.HTTP_201_CREATED)


class MyMentionsView(generics.ListAPIView):
    """GET /api/chat/mentions/ — mentions of the current user (latest first)."""
    serializer_class = ChatMentionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        unread = self.request.query_params.get('unread')
        qs = ChatMention.objects.filter(mentioned_user=self.request.user).select_related('message', 'message__author')
        if unread in ('1', 'true'):
            qs = qs.filter(read=False)
        return qs[:50]


class MentionMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids') or []
        updated = ChatMention.objects.filter(
            mentioned_user=request.user, id__in=ids, read=False,
        ).update(read=True)
        return Response({'updated': updated})


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
