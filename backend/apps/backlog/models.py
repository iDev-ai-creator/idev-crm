from django.db import models
from django.conf import settings


class BacklogItem(models.Model):
    class Status(models.TextChoices):
        IDEA = 'idea', 'Idea'
        IN_PROGRESS = 'in_progress', 'In Progress'
        TESTING = 'testing', 'Testing'
        DONE = 'done', 'Done'

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.IDEA)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='backlog_items')
    votes = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['status', 'order', '-votes']


class BacklogComment(models.Model):
    item = models.ForeignKey(BacklogItem, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='backlog_comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment on {self.item}'

    class Meta:
        ordering = ['created_at']
