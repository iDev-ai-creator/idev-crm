from django.db import models
from django.conf import settings
from apps.clients.models import Client


class Deal(models.Model):
    class Status(models.TextChoices):
        NEW_LEAD = 'new_lead', 'New Lead'
        DISCOVERY = 'discovery', 'Discovery'
        PROPOSAL = 'proposal', 'Proposal'
        NEGOTIATION = 'negotiation', 'Negotiation'
        SIGNED = 'signed', 'Signed'
        ACTIVE = 'active', 'Active'
        CLOSED = 'closed', 'Closed'
        LOST = 'lost', 'Lost'

    title = models.CharField(max_length=255)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='deals')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='assigned_deals')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='created_deals')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW_LEAD)
    value_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    probability = models.PositiveSmallIntegerField(default=50)
    team_size_needed = models.PositiveSmallIntegerField(default=1)
    tech_requirements = models.JSONField(default=list, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    expected_close_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = 'Deal'
        verbose_name_plural = 'Deals'
        ordering = ['status', 'order', '-created_at']


class DealNote(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                null=True, related_name='deal_notes')
    text = models.TextField()
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Note on {self.deal}'

    class Meta:
        ordering = ['-created_at']
