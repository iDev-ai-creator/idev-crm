from django.db import models
from django.conf import settings


class Client(models.Model):
    class Status(models.TextChoices):
        LEAD = 'lead', 'Lead'
        PROSPECT = 'prospect', 'Prospect'
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        CHURNED = 'churned', 'Churned'

    class Size(models.TextChoices):
        SMALL = '1-10', '1–10'
        MEDIUM = '11-50', '11–50'
        LARGE = '51-200', '51–200'
        ENTERPRISE = '200+', '200+'

    class BudgetRange(models.TextChoices):
        SMALL = 'small', 'Up to $5K/mo'
        MEDIUM = 'medium', '$5K–$20K/mo'
        LARGE = 'large', '$20K–$100K/mo'
        ENTERPRISE = 'enterprise', '$100K+/mo'

    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    company_size = models.CharField(max_length=10, choices=Size.choices, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LEAD)
    tech_stack = models.JSONField(default=list, blank=True)
    budget_range = models.CharField(max_length=20, choices=BudgetRange.choices, blank=True)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_clients'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_clients'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'
        ordering = ['-created_at']


class Contact(models.Model):
    class Language(models.TextChoices):
        RU = 'ru', 'Russian'
        EN = 'en', 'English'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='contacts')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    position = models.CharField(max_length=150, blank=True)
    linkedin = models.URLField(blank=True)
    is_primary = models.BooleanField(default=False)
    language_pref = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def __str__(self):
        return self.full_name or self.email

    class Meta:
        verbose_name = 'Contact'
        verbose_name_plural = 'Contacts'
        ordering = ['-is_primary', 'last_name', 'first_name']
