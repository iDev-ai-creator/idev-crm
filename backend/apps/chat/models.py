from django.db import models
from django.conf import settings


class ChatChannel(models.Model):
    class ChannelType(models.TextChoices):
        DIRECT = 'direct', 'Direct'
        GROUP = 'group', 'Group'

    name = models.CharField(max_length=255, blank=True)
    channel_type = models.CharField(max_length=10, choices=ChannelType.choices, default=ChannelType.DIRECT)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='chat_channels')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or f'Direct #{self.pk}'

    @classmethod
    def get_or_create_direct(cls, user1, user2):
        """Get or create a direct channel between two users."""
        channels = cls.objects.filter(
            channel_type=cls.ChannelType.DIRECT, members=user1
        ).filter(members=user2)
        if channels.exists():
            return channels.first(), False
        channel = cls.objects.create(channel_type=cls.ChannelType.DIRECT)
        channel.members.add(user1, user2)
        return channel, True

    class Meta:
        verbose_name = 'Chat Channel'
        verbose_name_plural = 'Chat Channels'
        ordering = ['-created_at']


class ChatMessage(models.Model):
    channel = models.ForeignKey(ChatChannel, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='chat_messages'
    )
    text = models.TextField()
    reply_to = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies'
    )
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Message #{self.pk} in {self.channel}'

    class Meta:
        verbose_name = 'Chat Message'
        verbose_name_plural = 'Chat Messages'
        ordering = ['created_at']


class ChatReaction(models.Model):
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=10)

    class Meta:
        unique_together = ('message', 'user', 'emoji')
        verbose_name = 'Chat Reaction'
