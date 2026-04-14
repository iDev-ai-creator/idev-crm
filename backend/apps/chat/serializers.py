from rest_framework import serializers
from .models import ChatChannel, ChatMessage, ChatReaction
from apps.users.models import User


class ChatUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'avatar']


class ChatReactionSerializer(serializers.ModelSerializer):
    user = ChatUserSerializer(read_only=True)
    class Meta:
        model = ChatReaction
        fields = ['id', 'emoji', 'user']


class ChatMessageSerializer(serializers.ModelSerializer):
    author = ChatUserSerializer(read_only=True)
    reactions = ChatReactionSerializer(many=True, read_only=True)
    reply_to_preview = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'channel', 'author', 'text', 'reply_to', 'reply_to_preview',
                  'is_edited', 'reactions', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'is_edited', 'created_at', 'updated_at']

    def get_reply_to_preview(self, obj):
        if obj.reply_to:
            return {'id': obj.reply_to.id, 'text': obj.reply_to.text[:100],
                    'author': obj.reply_to.author.full_name if obj.reply_to.author else ''}
        return None


class ChatChannelSerializer(serializers.ModelSerializer):
    members = ChatUserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, source='members', queryset=User.objects.all(), write_only=True
    )
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatChannel
        fields = ['id', 'name', 'channel_type', 'members', 'member_ids',
                  'last_message', 'unread_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {'text': msg.text[:80], 'author': msg.author.full_name if msg.author else '',
                    'created_at': msg.created_at}
        return None

    def get_unread_count(self, obj):
        return 0  # simplified — full read receipts in future
