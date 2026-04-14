# iDev CRM — Phase 2: Core CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core CRM functionality — Clients (companies), Contacts (people at companies), and Deals (Kanban pipeline) — with full REST API and React frontend pages.

**Architecture:** Two new Django apps (`clients`, `deals`) following the same patterns as `apps/users`. React pages consume the API via axios client. Kanban drag-drop via @dnd-kit. Client card has tabbed layout.

**Tech Stack:** Same as Phase 1. New: @dnd-kit/core + @dnd-kit/sortable for Kanban, React tabs pattern, idev-ui DataTable + Badge for lists.

**Working directory:** `/Users/kuznetsov/Projects/iDev/idev-crm/.worktrees/phase2-core-crm`

**Phase 1 reference:** All Phase 1 code is on `main`. Virtualenv at `backend/venv`. idev-ui installed at `frontend/node_modules/idev-ui`.

---

## File Map

```
backend/
├── apps/
│   ├── clients/
│   │   ├── __init__.py
│   │   ├── models.py         ← Client, Contact
│   │   ├── serializers.py    ← ClientSerializer, ContactSerializer
│   │   ├── views.py          ← ClientListView, ClientDetailView, ContactViews
│   │   ├── urls.py
│   │   ├── admin.py
│   │   ├── migrations/
│   │   └── tests/
│   │       └── test_clients.py
│   └── deals/
│       ├── __init__.py
│       ├── models.py         ← Deal, DealNote, DealAttachment
│       ├── serializers.py
│       ├── views.py          ← DealListView, DealDetailView, DealNoteViews, ReorderView
│       ├── urls.py
│       ├── admin.py
│       ├── migrations/
│       └── tests/
│           └── test_deals.py

frontend/src/
├── api/
│   ├── clients.ts            ← CRUD + contacts
│   └── deals.ts              ← CRUD + reorder + notes
├── pages/
│   ├── ClientsPage.tsx       ← filterable table
│   ├── ClientDetailPage.tsx  ← tabs: Info/Contacts/Deals/Tasks/Notes
│   ├── DealsPage.tsx         ← Kanban board
│   └── DealDetailPage.tsx    ← notes with history, attachments
└── components/
    ├── clients/
    │   ├── ClientForm.tsx
    │   └── ClientStatusBadge.tsx
    └── deals/
        ├── KanbanBoard.tsx
        ├── KanbanColumn.tsx
        ├── KanbanCard.tsx
        └── DealForm.tsx
```

---

### Task 1: Clients app — models + migrations

**Files:**
- Create: `backend/apps/clients/__init__.py`
- Create: `backend/apps/clients/models.py`
- Create: `backend/apps/clients/admin.py`
- Create: `backend/apps/clients/tests/__init__.py`
- Create: `backend/apps/clients/tests/test_clients.py`
- Modify: `backend/config/settings/base.py` (add 'apps.clients' to INSTALLED_APPS)

- [ ] **Step 1: Create app directory structure**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm/.worktrees/phase2-core-crm/backend
mkdir -p apps/clients/tests apps/clients/migrations
touch apps/clients/__init__.py apps/clients/migrations/__init__.py apps/clients/tests/__init__.py
```

- [ ] **Step 2: Write failing tests first**

`backend/apps/clients/tests/test_clients.py`:
```python
import pytest
from django.contrib.auth import get_user_model
from apps.clients.models import Client, Contact
from apps.users.models import Role

User = get_user_model()

@pytest.fixture
def manager(db):
    role = Role.objects.create(name='SM', preset=Role.Preset.SALES_MANAGER,
                                can_manage_clients=True, can_manage_deals=True)
    return User.objects.create_user(email='mgr@idev.team', password='pass',
                                     first_name='John', last_name='Manager', role=role)

@pytest.mark.django_db
def test_client_creation(manager):
    client = Client.objects.create(
        name='Acme Corp',
        industry='fintech',
        status=Client.Status.ACTIVE,
        assigned_to=manager,
        created_by=manager,
    )
    assert str(client) == 'Acme Corp'
    assert client.status == Client.Status.ACTIVE
    assert client.industry == 'fintech'

@pytest.mark.django_db
def test_client_status_choices():
    statuses = [s[0] for s in Client.Status.choices]
    assert 'lead' in statuses
    assert 'prospect' in statuses
    assert 'active' in statuses
    assert 'paused' in statuses
    assert 'churned' in statuses

@pytest.mark.django_db
def test_contact_creation(manager):
    client = Client.objects.create(name='Beta Ltd', assigned_to=manager, created_by=manager)
    contact = Contact.objects.create(
        client=client,
        first_name='Alice',
        last_name='Smith',
        email='alice@beta.com',
        position='CTO',
        is_primary=True,
    )
    assert str(contact) == 'Alice Smith'
    assert contact.client == client
    assert contact.is_primary is True

@pytest.mark.django_db
def test_contact_full_name():
    client = Client.objects.create(name='Gamma')
    contact = Contact.objects.create(client=client, first_name='Bob', last_name='Jones')
    assert contact.full_name == 'Bob Jones'
```

- [ ] **Step 3: Run tests — verify they FAIL**

```bash
source venv/bin/activate
pytest apps/clients/tests/test_clients.py -v
```

Expected: FAIL — `apps.clients.models` not found.

- [ ] **Step 4: Create models**

`backend/apps/clients/models.py`:
```python
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
```

- [ ] **Step 5: Create admin**

`backend/apps/clients/admin.py`:
```python
from django.contrib import admin
from .models import Client, Contact


class ContactInline(admin.TabularInline):
    model = Contact
    extra = 0
    fields = ('first_name', 'last_name', 'email', 'position', 'is_primary')


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'industry', 'status', 'company_size', 'assigned_to', 'created_at')
    list_filter = ('status', 'industry', 'company_size', 'budget_range')
    search_fields = ('name', 'industry', 'website')
    raw_id_fields = ('assigned_to', 'created_by')
    inlines = [ContactInline]


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'position', 'client', 'is_primary')
    search_fields = ('first_name', 'last_name', 'email')
    raw_id_fields = ('client',)
```

- [ ] **Step 6: Add to INSTALLED_APPS**

In `backend/config/settings/base.py`, add `'apps.clients'` after `'apps.users'` in INSTALLED_APPS.

- [ ] **Step 7: Create migration and run tests**

```bash
source venv/bin/activate
python manage.py makemigrations clients --settings=config.settings.dev
pytest apps/clients/tests/test_clients.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/clients/ config/settings/base.py
git commit -m "feat: add Client and Contact models with tests"
```

---

### Task 2: Clients REST API

**Files:**
- Create: `backend/apps/clients/serializers.py`
- Create: `backend/apps/clients/views.py`
- Create: `backend/apps/clients/urls.py`
- Modify: `backend/config/urls.py` (add clients urls)
- Modify: `backend/apps/clients/tests/test_clients.py` (add API tests)

- [ ] **Step 1: Add API tests**

Append to `backend/apps/clients/tests/test_clients.py`:
```python
from rest_framework.test import APIClient

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_client_list(api_client, manager):
    Client.objects.create(name='Alpha', assigned_to=manager, created_by=manager)
    Client.objects.create(name='Beta', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.get('/api/clients/')
    assert response.status_code == 200
    assert response.data['count'] == 2

@pytest.mark.django_db
def test_client_create(api_client, manager):
    api_client.force_authenticate(user=manager)
    response = api_client.post('/api/clients/', {
        'name': 'New Corp',
        'industry': 'ecommerce',
        'status': 'lead',
    }, format='json')
    assert response.status_code == 201
    assert response.data['name'] == 'New Corp'
    assert response.data['created_by']['email'] == 'mgr@idev.team'

@pytest.mark.django_db
def test_client_detail(api_client, manager):
    client = Client.objects.create(name='Detail Corp', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.get(f'/api/clients/{client.pk}/')
    assert response.status_code == 200
    assert response.data['name'] == 'Detail Corp'
    assert 'contacts' in response.data

@pytest.mark.django_db
def test_client_filter_by_status(api_client, manager):
    Client.objects.create(name='Active', status='active', assigned_to=manager, created_by=manager)
    Client.objects.create(name='Lead', status='lead', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.get('/api/clients/?status=active')
    assert response.status_code == 200
    assert response.data['count'] == 1
    assert response.data['results'][0]['name'] == 'Active'

@pytest.mark.django_db
def test_contact_create(api_client, manager):
    client = Client.objects.create(name='Corp', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.post(f'/api/clients/{client.pk}/contacts/', {
        'first_name': 'Jane',
        'last_name': 'Doe',
        'email': 'jane@corp.com',
        'position': 'CEO',
        'is_primary': True,
    }, format='json')
    assert response.status_code == 201
    assert response.data['full_name'] == 'Jane Doe'
```

- [ ] **Step 2: Run — verify FAIL**

```bash
pytest apps/clients/tests/test_clients.py -v -k "list or create or detail or filter or contact_create"
```

Expected: FAIL — URL not found.

- [ ] **Step 3: Create serializers**

`backend/apps/clients/serializers.py`:
```python
from rest_framework import serializers
from .models import Client, Contact
from apps.users.serializers import UserSerializer


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'client', 'first_name', 'last_name', 'full_name', 'email',
                  'phone', 'position', 'linkedin', 'is_primary', 'language_pref',
                  'notes', 'created_at']
        read_only_fields = ['id', 'full_name', 'created_at', 'client']


class ClientSerializer(serializers.ModelSerializer):
    contacts = ContactSerializer(many=True, read_only=True)
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=__import__('apps.users.models', fromlist=['User']).User.objects.all(),
        write_only=True, required=False, allow_null=True
    )
    created_by = UserSerializer(read_only=True)
    contacts_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ['id', 'name', 'industry', 'website', 'country', 'company_size',
                  'status', 'tech_stack', 'budget_range', 'description',
                  'assigned_to', 'assigned_to_id', 'created_by',
                  'contacts', 'contacts_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_contacts_count(self, obj):
        return obj.contacts.count()

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ClientListSerializer(serializers.ModelSerializer):
    """Compact serializer for list view — no contacts."""
    assigned_to = UserSerializer(read_only=True)
    contacts_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ['id', 'name', 'industry', 'status', 'company_size', 'budget_range',
                  'assigned_to', 'contacts_count', 'created_at']

    def get_contacts_count(self, obj):
        return obj.contacts.count()
```

- [ ] **Step 4: Create views**

`backend/apps/clients/views.py`:
```python
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
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
```

- [ ] **Step 5: Create URLs**

`backend/apps/clients/urls.py`:
```python
from django.urls import path
from .views import ClientListView, ClientDetailView, ContactListView, ContactDetailView

urlpatterns = [
    path('', ClientListView.as_view(), name='client-list'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client-detail'),
    path('<int:client_pk>/contacts/', ContactListView.as_view(), name='contact-list'),
    path('<int:client_pk>/contacts/<int:pk>/', ContactDetailView.as_view(), name='contact-detail'),
]
```

Add to `backend/config/urls.py` after users:
```python
path('api/clients/', include('apps.clients.urls')),
```

- [ ] **Step 6: Run all tests**

```bash
pytest apps/clients/tests/ -v
```

Expected: 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/clients/ config/urls.py
git commit -m "feat: add Clients REST API with contacts endpoints"
```

---

### Task 3: Deals app — models + API

**Files:**
- Create: `backend/apps/deals/` (full app)
- Modify: `backend/config/settings/base.py` and `urls.py`

- [ ] **Step 1: Create app structure**

```bash
mkdir -p apps/deals/tests apps/deals/migrations
touch apps/deals/__init__.py apps/deals/migrations/__init__.py apps/deals/tests/__init__.py
```

- [ ] **Step 2: Write failing tests**

`backend/apps/deals/tests/test_deals.py`:
```python
import pytest
from django.contrib.auth import get_user_model
from apps.clients.models import Client
from apps.deals.models import Deal, DealNote
from apps.users.models import Role

User = get_user_model()

@pytest.fixture
def manager(db):
    role = Role.objects.create(name='SM2', preset=Role.Preset.SALES_MANAGER,
                                can_manage_deals=True, can_manage_clients=True)
    return User.objects.create_user(email='dm@idev.team', password='pass',
                                     first_name='Deal', last_name='Manager', role=role)

@pytest.fixture
def client_obj(manager):
    return Client.objects.create(name='Deal Client', assigned_to=manager, created_by=manager)

@pytest.mark.django_db
def test_deal_creation(manager, client_obj):
    deal = Deal.objects.create(
        title='Python Dev x3',
        client=client_obj,
        assigned_to=manager,
        created_by=manager,
        status=Deal.Status.NEW_LEAD,
        value_usd=15000,
        team_size_needed=3,
    )
    assert str(deal) == 'Python Dev x3'
    assert deal.status == Deal.Status.NEW_LEAD

@pytest.mark.django_db
def test_deal_status_choices():
    statuses = [s[0] for s in Deal.Status.choices]
    for expected in ['new_lead', 'discovery', 'proposal', 'negotiation', 'signed', 'active', 'closed', 'lost']:
        assert expected in statuses

@pytest.mark.django_db
def test_deal_note_creation(manager, client_obj):
    deal = Deal.objects.create(title='Test Deal', client=client_obj,
                                assigned_to=manager, created_by=manager)
    note = DealNote.objects.create(deal=deal, author=manager, text='First contact done')
    assert note.text == 'First contact done'
    assert note.is_deleted is False
    assert str(note).startswith('Note on Test Deal')

@pytest.mark.django_db
def test_deal_note_soft_delete(manager, client_obj):
    deal = Deal.objects.create(title='Test', client=client_obj,
                                assigned_to=manager, created_by=manager)
    note = DealNote.objects.create(deal=deal, author=manager, text='To delete')
    note.is_deleted = True
    note.save()
    assert DealNote.objects.filter(is_deleted=False).count() == 0

# API tests
from rest_framework.test import APIClient

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_deal_list(api_client, manager, client_obj):
    Deal.objects.create(title='Deal A', client=client_obj, assigned_to=manager, created_by=manager)
    Deal.objects.create(title='Deal B', client=client_obj, assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.get('/api/deals/')
    assert response.status_code == 200
    assert response.data['count'] == 2

@pytest.mark.django_db
def test_deal_create(api_client, manager, client_obj):
    api_client.force_authenticate(user=manager)
    response = api_client.post('/api/deals/', {
        'title': 'New Deal',
        'client': client_obj.pk,
        'status': 'new_lead',
        'value_usd': '5000.00',
        'team_size_needed': 2,
    }, format='json')
    assert response.status_code == 201
    assert response.data['title'] == 'New Deal'

@pytest.mark.django_db
def test_deal_reorder(api_client, manager, client_obj):
    d1 = Deal.objects.create(title='D1', client=client_obj, assigned_to=manager,
                              created_by=manager, status='new_lead', order=0)
    d2 = Deal.objects.create(title='D2', client=client_obj, assigned_to=manager,
                              created_by=manager, status='new_lead', order=1)
    api_client.force_authenticate(user=manager)
    response = api_client.post('/api/deals/reorder/', [
        {'id': d2.pk, 'order': 0},
        {'id': d1.pk, 'order': 1},
    ], format='json')
    assert response.status_code == 200
    d1.refresh_from_db()
    d2.refresh_from_db()
    assert d1.order == 1
    assert d2.order == 0

@pytest.mark.django_db
def test_deal_note_add(api_client, manager, client_obj):
    deal = Deal.objects.create(title='NoteDeal', client=client_obj,
                                assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.post(f'/api/deals/{deal.pk}/notes/', {'text': 'Called client'}, format='json')
    assert response.status_code == 201
    assert response.data['text'] == 'Called client'

@pytest.mark.django_db
def test_deal_filter_by_status(api_client, manager, client_obj):
    Deal.objects.create(title='Active', client=client_obj, assigned_to=manager,
                         created_by=manager, status='active')
    Deal.objects.create(title='Lead', client=client_obj, assigned_to=manager,
                         created_by=manager, status='new_lead')
    api_client.force_authenticate(user=manager)
    response = api_client.get('/api/deals/?status=active')
    assert response.data['count'] == 1
```

- [ ] **Step 3: Run — verify FAIL**

```bash
pytest apps/deals/tests/ -v
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Create Deal models**

`backend/apps/deals/models.py`:
```python
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
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_deals'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_deals'
    )
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
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='deal_notes'
    )
    text = models.TextField()
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Note on {self.deal}'

    class Meta:
        verbose_name = 'Deal Note'
        verbose_name_plural = 'Deal Notes'
        ordering = ['-created_at']
```

`backend/apps/deals/admin.py`:
```python
from django.contrib import admin
from .models import Deal, DealNote


class DealNoteInline(admin.TabularInline):
    model = DealNote
    extra = 0
    fields = ('author', 'text', 'is_deleted', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'status', 'value_usd', 'assigned_to', 'created_at')
    list_filter = ('status',)
    search_fields = ('title', 'client__name')
    raw_id_fields = ('client', 'assigned_to', 'created_by')
    inlines = [DealNoteInline]
```

- [ ] **Step 5: Create serializers**

`backend/apps/deals/serializers.py`:
```python
from rest_framework import serializers
from .models import Deal, DealNote
from apps.users.serializers import UserSerializer
from apps.clients.serializers import ClientListSerializer


class DealNoteSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = DealNote
        fields = ['id', 'deal', 'author', 'text', 'is_deleted', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'deal', 'created_at', 'updated_at']


class DealSerializer(serializers.ModelSerializer):
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to',
        queryset=__import__('apps.users.models', fromlist=['User']).User.objects.all(),
        write_only=True, required=False, allow_null=True
    )
    client_id = serializers.PrimaryKeyRelatedField(
        source='client',
        queryset=__import__('apps.clients.models', fromlist=['Client']).Client.objects.all(),
        write_only=True
    )
    client = ClientListSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    notes_count = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = ['id', 'title', 'client', 'client_id', 'assigned_to', 'assigned_to_id',
                  'created_by', 'status', 'value_usd', 'probability', 'team_size_needed',
                  'tech_requirements', 'start_date', 'end_date', 'expected_close_date',
                  'description', 'order', 'notes_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_notes_count(self, obj):
        return obj.notes.filter(is_deleted=False).count()

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ReorderSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    order = serializers.IntegerField(min_value=0)
```

- [ ] **Step 6: Create views**

`backend/apps/deals/views.py`:
```python
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Deal, DealNote
from .serializers import DealSerializer, DealNoteSerializer, ReorderSerializer


class DealListView(generics.ListCreateAPIView):
    serializer_class = DealSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'client', 'assigned_to']
    search_fields = ['title', 'client__name']
    ordering_fields = ['created_at', 'value_usd', 'order']
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
        serializer = ReorderSerializer(data=request.data, many=True)
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
            return Response({'error': 'Cannot edit another user\'s note'},
                            status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)
```

`backend/apps/deals/urls.py`:
```python
from django.urls import path
from .views import (DealListView, DealDetailView, DealReorderView,
                    DealNoteListView, DealNoteDetailView)

urlpatterns = [
    path('', DealListView.as_view(), name='deal-list'),
    path('reorder/', DealReorderView.as_view(), name='deal-reorder'),
    path('<int:pk>/', DealDetailView.as_view(), name='deal-detail'),
    path('<int:deal_pk>/notes/', DealNoteListView.as_view(), name='deal-note-list'),
    path('<int:deal_pk>/notes/<int:pk>/', DealNoteDetailView.as_view(), name='deal-note-detail'),
]
```

- [ ] **Step 7: Register app and URLs**

In `backend/config/settings/base.py` INSTALLED_APPS add `'apps.deals'` after `'apps.clients'`.

In `backend/config/urls.py` add:
```python
path('api/deals/', include('apps.deals.urls')),
```

- [ ] **Step 8: Migrate and run all tests**

```bash
source venv/bin/activate
python manage.py makemigrations deals --settings=config.settings.dev
pytest apps/ -v --tb=short 2>&1 | tail -20
```

Expected: All tests pass (20 users + 9 clients + 10 deals = 39+).

- [ ] **Step 9: Commit**

```bash
git add apps/deals/ config/settings/base.py config/urls.py
git commit -m "feat: add Deals app with Kanban statuses, notes, reorder API"
```

---

### Task 4: Frontend — API clients

**Files:**
- Create: `frontend/src/api/clients.ts`
- Create: `frontend/src/api/deals.ts`
- Modify: `frontend/src/App.tsx` (add placeholder routes)

- [ ] **Step 1: Create clients API**

`frontend/src/api/clients.ts`:
```typescript
import api from './client'

export interface Contact {
  id: number
  client: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  position: string
  linkedin: string
  is_primary: boolean
  language_pref: 'ru' | 'en'
  notes: string
  created_at: string
}

export interface Client {
  id: number
  name: string
  industry: string
  website: string
  country: string
  company_size: string
  status: 'lead' | 'prospect' | 'active' | 'paused' | 'churned'
  tech_stack: string[]
  budget_range: string
  description: string
  assigned_to: { id: number; full_name: string; email: string } | null
  created_by: { id: number; full_name: string; email: string } | null
  contacts: Contact[]
  contacts_count: number
  created_at: string
  updated_at: string
}

export interface ClientListItem {
  id: number
  name: string
  industry: string
  status: Client['status']
  company_size: string
  budget_range: string
  assigned_to: { id: number; full_name: string } | null
  contacts_count: number
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const clientsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<ClientListItem>> => {
    const { data } = await api.get('/clients/', { params })
    return data
  },

  get: async (id: number): Promise<Client> => {
    const { data } = await api.get(`/clients/${id}/`)
    return data
  },

  create: async (payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.post('/clients/', payload)
    return data
  },

  update: async (id: number, payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.patch(`/clients/${id}/`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/clients/${id}/`)
  },

  contacts: {
    list: async (clientId: number): Promise<Contact[]> => {
      const { data } = await api.get(`/clients/${clientId}/contacts/`)
      return data.results ?? data
    },
    create: async (clientId: number, payload: Partial<Contact>): Promise<Contact> => {
      const { data } = await api.post(`/clients/${clientId}/contacts/`, payload)
      return data
    },
    update: async (clientId: number, contactId: number, payload: Partial<Contact>): Promise<Contact> => {
      const { data } = await api.patch(`/clients/${clientId}/contacts/${contactId}/`, payload)
      return data
    },
    delete: async (clientId: number, contactId: number): Promise<void> => {
      await api.delete(`/clients/${clientId}/contacts/${contactId}/`)
    },
  },
}
```

`frontend/src/api/deals.ts`:
```typescript
import api from './client'
import type { PaginatedResponse } from './clients'

export interface DealNote {
  id: number
  deal: number
  author: { id: number; full_name: string; email: string } | null
  text: string
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export interface Deal {
  id: number
  title: string
  client: { id: number; name: string; status: string } | null
  client_id?: number
  assigned_to: { id: number; full_name: string } | null
  assigned_to_id?: number
  created_by: { id: number; full_name: string } | null
  status: 'new_lead' | 'discovery' | 'proposal' | 'negotiation' | 'signed' | 'active' | 'closed' | 'lost'
  value_usd: string
  probability: number
  team_size_needed: number
  tech_requirements: string[]
  start_date: string | null
  end_date: string | null
  expected_close_date: string | null
  description: string
  order: number
  notes_count: number
  created_at: string
  updated_at: string
}

export const DEAL_STATUSES: Deal['status'][] = [
  'new_lead', 'discovery', 'proposal', 'negotiation',
  'signed', 'active', 'closed', 'lost',
]

export const DEAL_STATUS_LABELS: Record<Deal['status'], string> = {
  new_lead: 'New Lead',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  signed: 'Signed',
  active: 'Active',
  closed: 'Closed',
  lost: 'Lost',
}

export const dealsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Deal>> => {
    const { data } = await api.get('/deals/', { params })
    return data
  },

  get: async (id: number): Promise<Deal> => {
    const { data } = await api.get(`/deals/${id}/`)
    return data
  },

  create: async (payload: Partial<Deal> & { client: number }): Promise<Deal> => {
    const { data } = await api.post('/deals/', payload)
    return data
  },

  update: async (id: number, payload: Partial<Deal>): Promise<Deal> => {
    const { data } = await api.patch(`/deals/${id}/`, payload)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/deals/${id}/`)
  },

  reorder: async (items: { id: number; order: number }[]): Promise<void> => {
    await api.post('/deals/reorder/', items)
  },

  notes: {
    list: async (dealId: number): Promise<DealNote[]> => {
      const { data } = await api.get(`/deals/${dealId}/notes/`)
      return data.results ?? data
    },
    create: async (dealId: number, text: string): Promise<DealNote> => {
      const { data } = await api.post(`/deals/${dealId}/notes/`, { text })
      return data
    },
    update: async (dealId: number, noteId: number, text: string): Promise<DealNote> => {
      const { data } = await api.patch(`/deals/${dealId}/notes/${noteId}/`, { text })
      return data
    },
    delete: async (dealId: number, noteId: number): Promise<void> => {
      await api.delete(`/deals/${dealId}/notes/${noteId}/`)
    },
  },
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|warning|✓"
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm/.worktrees/phase2-core-crm
git add frontend/src/api/
git commit -m "feat: add clients and deals API TypeScript clients"
```

---

### Task 5: Frontend — Clients list page

**Files:**
- Create: `frontend/src/pages/ClientsPage.tsx`
- Create: `frontend/src/components/clients/ClientStatusBadge.tsx`
- Modify: `frontend/src/App.tsx` (add /clients route)

- [ ] **Step 1: Create ClientStatusBadge**

`frontend/src/components/clients/ClientStatusBadge.tsx`:
```typescript
import { Badge } from 'idev-ui'

const STATUS_COLORS = {
  lead: 'blue',
  prospect: 'yellow',
  active: 'green',
  paused: 'gray',
  churned: 'red',
} as const

const STATUS_LABELS = {
  lead: 'Lead',
  prospect: 'Prospect',
  active: 'Active',
  paused: 'Paused',
  churned: 'Churned',
} as const

type Status = keyof typeof STATUS_COLORS

export default function ClientStatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? 'gray'
  const label = STATUS_LABELS[status as Status] ?? status
  return <Badge color={color}>{label}</Badge>
}
```

**Note:** Check what colors idev-ui Badge accepts. If it doesn't accept 'gray', use 'default' or 'neutral'. Check `/Users/kuznetsov/Projects/iDev/idev-ui/components/Badge.tsx` for actual color prop values.

- [ ] **Step 2: Create ClientsPage**

`frontend/src/pages/ClientsPage.tsx`:
```typescript
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DataTable, Input, Button } from 'idev-ui'
import { clientsApi, type ClientListItem } from '../api/clients'
import ClientStatusBadge from '../components/clients/ClientStatusBadge'

export default function ClientsPage() {
  const { t } = useTranslation()
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q) params.search = q
      const data = await clientsApi.list(params)
      setClients(data.results)
      setCount(data.count)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  const columns = [
    {
      key: 'name',
      header: 'Company',
      render: (row: ClientListItem) => (
        <Link to={`/clients/${row.id}`} className="text-[var(--accent)] hover:underline font-medium">
          {row.name}
        </Link>
      ),
    },
    { key: 'industry', header: 'Industry', render: (row: ClientListItem) => row.industry || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (row: ClientListItem) => <ClientStatusBadge status={row.status} />,
    },
    {
      key: 'assigned_to',
      header: 'Manager',
      render: (row: ClientListItem) => row.assigned_to?.full_name || '—',
    },
    { key: 'contacts_count', header: 'Contacts', render: (row: ClientListItem) => row.contacts_count },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {t('nav.clients')} <span className="text-[var(--text-secondary)] text-lg font-normal">({count})</span>
        </h1>
        <Button variant="primary" as={Link} to="/clients/new">
          + {t('common.add')}
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input
          variant="search"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">{t('common.search')}</Button>
      </form>

      <DataTable
        data={clients}
        columns={columns}
        loading={loading}
        emptyMessage={t('common.noData')}
      />
    </div>
  )
}
```

**Note:** Check DataTable props in idev-ui. Adapt `columns` prop shape to match actual idev-ui DataTable API. Also check if Button supports `as` prop — if not, use a wrapper `<Link><Button>...</Button></Link>`.

- [ ] **Step 3: Add route to App.tsx**

In `frontend/src/App.tsx`, inside the `<Route element={<AppLayout />}>`:
```typescript
<Route path="/clients" element={<ClientsPage />} />
<Route path="/clients/:id" element={<div className="p-4 text-[var(--text-secondary)]">Client detail — Phase 2 Task 6</div>} />
```

Import `ClientsPage` at the top.

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
cd frontend && npm run build 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm/.worktrees/phase2-core-crm
git add frontend/src/pages/ClientsPage.tsx frontend/src/components/ frontend/src/App.tsx
git commit -m "feat: add Clients list page with search, filter, status badges"
```

---

### Task 6: Frontend — Client detail page

**Files:**
- Create: `frontend/src/pages/ClientDetailPage.tsx`
- Create: `frontend/src/components/clients/ClientForm.tsx`

- [ ] **Step 1: Create ClientDetailPage with tabs**

`frontend/src/pages/ClientDetailPage.tsx`:
```typescript
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Badge } from 'idev-ui'
import { clientsApi, type Client, type Contact } from '../api/clients'
import ClientStatusBadge from '../components/clients/ClientStatusBadge'

type Tab = 'info' | 'contacts' | 'deals'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('info')

  useEffect(() => {
    if (!id) return
    clientsApi.get(Number(id)).then(setClient).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-[var(--text-secondary)] text-sm p-4">{t('common.loading')}</div>
  if (!client) return <div className="text-[var(--danger)] p-4">Client not found</div>

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'info', label: 'Info' },
    { key: 'contacts', label: 'Contacts', count: client.contacts_count },
    { key: 'deals', label: 'Deals' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate('/clients')}
              className="text-[var(--text-secondary)] hover:text-[var(--text)] text-sm"
            >
              ← {t('nav.clients')}
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">{client.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <ClientStatusBadge status={client.status} />
            {client.industry && (
              <span className="text-sm text-[var(--text-secondary)]">{client.industry}</span>
            )}
            {client.assigned_to && (
              <span className="text-sm text-[var(--text-secondary)]">
                Manager: {client.assigned_to.full_name}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline">{t('common.edit')}</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === tab.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs bg-[var(--bg-hover)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'info' && <InfoTab client={client} />}
      {activeTab === 'contacts' && <ContactsTab client={client} />}
      {activeTab === 'deals' && <DealsTab clientId={client.id} />}
    </div>
  )
}

function InfoTab({ client }: { client: Client }) {
  const fields = [
    { label: 'Website', value: client.website ? <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{client.website}</a> : '—' },
    { label: 'Country', value: client.country || '—' },
    { label: 'Company size', value: client.company_size || '—' },
    { label: 'Budget range', value: client.budget_range || '—' },
    { label: 'Tech stack', value: client.tech_stack?.length ? client.tech_stack.join(', ') : '—' },
    { label: 'Description', value: client.description || '—' },
    { label: 'Created', value: new Date(client.created_at).toLocaleDateString() },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
      {fields.map(({ label, value }) => (
        <div key={label} className="bg-[var(--bg-card)] rounded-[var(--radius-md)] p-4">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">{label}</div>
          <div className="text-sm text-[var(--text)]">{value}</div>
        </div>
      ))}
    </div>
  )
}

function ContactsTab({ client }: { client: Client }) {
  if (!client.contacts.length) {
    return <div className="text-[var(--text-secondary)] text-sm">No contacts yet.</div>
  }
  return (
    <div className="space-y-3 max-w-2xl">
      {client.contacts.map((c: Contact) => (
        <div key={c.id} className="bg-[var(--bg-card)] rounded-[var(--radius-md)] p-4 flex items-start justify-between">
          <div>
            <div className="font-medium text-[var(--text)]">
              {c.full_name}
              {c.is_primary && <span className="ml-2 text-xs text-[var(--accent)]">Primary</span>}
            </div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">{c.position}</div>
            <div className="text-sm text-[var(--text-secondary)]">{c.email}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DealsTab({ clientId }: { clientId: number }) {
  return (
    <div className="text-[var(--text-secondary)] text-sm">
      Deals for client #{clientId} — full view in Deals board.
      <br />
      <Link to={`/deals?client=${clientId}`} className="text-[var(--accent)] hover:underline mt-2 block">
        View in Deals →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx**

Replace the `/clients/:id` placeholder route with:
```typescript
<Route path="/clients/:id" element={<ClientDetailPage />} />
```

Import `ClientDetailPage`.

- [ ] **Step 3: Build verification**

```bash
cd frontend && npm run build 2>&1 | tail -8
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ClientDetailPage.tsx frontend/src/App.tsx
git commit -m "feat: add Client detail page with tabs (Info, Contacts, Deals)"
```

---

### Task 7: Frontend — Deals Kanban page

**Files:**
- Create: `frontend/src/components/deals/KanbanBoard.tsx`
- Create: `frontend/src/components/deals/KanbanColumn.tsx`
- Create: `frontend/src/components/deals/KanbanCard.tsx`
- Create: `frontend/src/pages/DealsPage.tsx`
- Create: `frontend/src/pages/DealDetailPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create KanbanCard**

`frontend/src/components/deals/KanbanCard.tsx`:
```typescript
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import type { Deal } from '../../api/deals'

interface Props {
  deal: Deal
}

export default function KanbanCard({ deal }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-[var(--bg-main)] rounded-[var(--radius-md)] p-3 shadow-[var(--shadow-sm)]
                 border border-[var(--border)] cursor-grab active:cursor-grabbing
                 hover:border-[var(--accent)]/40 transition-colors"
    >
      <Link
        to={`/deals/${deal.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-sm text-[var(--text)] hover:text-[var(--accent)] block mb-1"
      >
        {deal.title}
      </Link>
      {deal.client && (
        <div className="text-xs text-[var(--text-secondary)] mb-2">{deal.client.name}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          ${Number(deal.value_usd).toLocaleString()}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {deal.team_size_needed} dev{deal.team_size_needed !== 1 ? 's' : ''}
        </span>
      </div>
      {deal.assigned_to && (
        <div className="mt-2 text-xs text-[var(--text-secondary)] truncate">
          {deal.assigned_to.full_name}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create KanbanColumn**

`frontend/src/components/deals/KanbanColumn.tsx`:
```typescript
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './KanbanCard'
import type { Deal } from '../../api/deals'

interface Props {
  status: string
  label: string
  deals: Deal[]
}

export default function KanbanColumn({ status, label, deals }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex-shrink-0 w-64">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">{label}</h3>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
          {deals.length}
        </span>
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`min-h-32 space-y-2 rounded-[var(--radius-lg)] p-2 transition-colors
            ${isOver ? 'bg-[var(--accent)]/5' : 'bg-[var(--bg-hover)]/50'}`}
        >
          {deals.map((deal) => (
            <KanbanCard key={deal.id} deal={deal} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

- [ ] **Step 3: Create DealsPage with Kanban**

`frontend/src/pages/DealsPage.tsx`:
```typescript
import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { dealsApi, type Deal, DEAL_STATUSES, DEAL_STATUS_LABELS } from '../api/deals'
import KanbanColumn from '../components/deals/KanbanColumn'

export default function DealsPage() {
  const { t } = useTranslation()
  const [dealsByStatus, setDealsByStatus] = useState<Record<string, Deal[]>>({})
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await dealsApi.list({ page_size: '200' })
      const grouped: Record<string, Deal[]> = {}
      DEAL_STATUSES.forEach((s) => { grouped[s] = [] })
      data.results.forEach((deal) => {
        if (grouped[deal.status]) grouped[deal.status].push(deal)
        else grouped[deal.status] = [deal]
      })
      // Sort by order within each column
      Object.keys(grouped).forEach((s) => {
        grouped[s].sort((a, b) => a.order - b.order)
      })
      setDealsByStatus(grouped)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    const overId = over.id as string

    // Find which column the active card is in
    let fromStatus = ''
    for (const [status, deals] of Object.entries(dealsByStatus)) {
      if (deals.find((d) => d.id === activeId)) { fromStatus = status; break }
    }

    // Determine target column
    const toStatus = DEAL_STATUSES.includes(overId as Deal['status'])
      ? overId
      : (() => {
          for (const [s, deals] of Object.entries(dealsByStatus)) {
            if (deals.find((d) => d.id === Number(overId))) return s
          }
          return fromStatus
        })()

    if (!fromStatus) return

    // Optimistic update
    const newState = { ...dealsByStatus }

    if (fromStatus === toStatus) {
      // Reorder within same column
      const col = [...newState[fromStatus]]
      const oldIndex = col.findIndex((d) => d.id === activeId)
      const newIndex = col.findIndex((d) => d.id === Number(overId))
      if (oldIndex === newIndex) return
      newState[fromStatus] = arrayMove(col, oldIndex, newIndex)
    } else {
      // Move to different column
      const fromCol = newState[fromStatus].filter((d) => d.id !== activeId)
      const movingDeal = { ...newState[fromStatus].find((d) => d.id === activeId)!, status: toStatus as Deal['status'] }
      const toCol = [...newState[toStatus]]
      const insertIndex = toCol.findIndex((d) => d.id === Number(overId))
      if (insertIndex >= 0) toCol.splice(insertIndex, 0, movingDeal)
      else toCol.push(movingDeal)
      newState[fromStatus] = fromCol
      newState[toStatus] = toCol
    }

    setDealsByStatus(newState)

    // Persist changes
    try {
      const reorderPayload: { id: number; order: number }[] = []
      // Update status if moved between columns
      if (fromStatus !== toStatus) {
        await dealsApi.update(activeId, { status: toStatus as Deal['status'] })
      }
      // Reorder within target column
      newState[toStatus].forEach((d, i) => { reorderPayload.push({ id: d.id, order: i }) })
      await dealsApi.reorder(reorderPayload)
    } catch {
      load() // Rollback on error
    }
  }

  if (loading) {
    return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-6">{t('nav.deals')}</h1>
      <div className="overflow-x-auto pb-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max">
            {DEAL_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                label={DEAL_STATUS_LABELS[status]}
                deals={dealsByStatus[status] ?? []}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create DealDetailPage (simplified)**

`frontend/src/pages/DealDetailPage.tsx`:
```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from 'idev-ui'
import { dealsApi, type Deal, type DealNote, DEAL_STATUS_LABELS } from '../api/deals'

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [notes, setNotes] = useState<DealNote[]>([])
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    const dealId = Number(id)
    Promise.all([dealsApi.get(dealId), dealsApi.notes.list(dealId)])
      .then(([d, n]) => { setDeal(d); setNotes(n) })
      .finally(() => setLoading(false))
  }, [id])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim() || !deal) return
    setSubmitting(true)
    try {
      const newNote = await dealsApi.notes.create(deal.id, noteText.trim())
      setNotes([newNote, ...notes])
      setNoteText('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    if (!deal) return
    await dealsApi.notes.delete(deal.id, noteId)
    setNotes(notes.filter((n) => n.id !== noteId))
  }

  if (loading) return <div className="text-[var(--text-secondary)] text-sm p-4">{t('common.loading')}</div>
  if (!deal) return <div className="text-[var(--danger)] p-4">Deal not found</div>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/deals')} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-sm">
          ← {t('nav.deals')}
        </button>
      </div>

      <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-6 mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)] mb-2">{deal.title}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
          <span>Status: <strong className="text-[var(--text)]">{DEAL_STATUS_LABELS[deal.status]}</strong></span>
          <span>Value: <strong className="text-[var(--text)]">${Number(deal.value_usd).toLocaleString()}</strong></span>
          <span>Team: <strong className="text-[var(--text)]">{deal.team_size_needed} devs</strong></span>
          {deal.client && <span>Client: <strong className="text-[var(--text)]">{deal.client.name}</strong></span>}
          {deal.assigned_to && <span>Manager: <strong className="text-[var(--text)]">{deal.assigned_to.full_name}</strong></span>}
        </div>
        {deal.description && (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">{deal.description}</p>
        )}
      </div>

      {/* Notes */}
      <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Notes</h2>

        <form onSubmit={handleAddNote} className="mb-6">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-main)]
                       text-[var(--text)] text-sm px-3 py-2 resize-none focus:outline-none
                       focus:border-[var(--accent)] transition-colors"
          />
          <Button type="submit" variant="primary" className="mt-2" loading={submitting}>
            Add Note
          </Button>
        </form>

        <div className="space-y-3">
          {notes.length === 0 && (
            <div className="text-[var(--text-secondary)] text-sm">No notes yet.</div>
          )}
          {notes.map((note) => (
            <div key={note.id} className="border border-[var(--border)] rounded-[var(--radius-md)] p-4">
              <div className="flex items-start justify-between">
                <div className="text-xs text-[var(--text-secondary)] mb-2">
                  {note.author?.full_name} · {new Date(note.created_at).toLocaleString()}
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                >
                  Delete
                </button>
              </div>
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{note.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add all routes to App.tsx**

Add inside `<Route element={<AppLayout />}>`:
```typescript
<Route path="/deals" element={<DealsPage />} />
<Route path="/deals/:id" element={<DealDetailPage />} />
```

Add placeholder routes for remaining modules:
```typescript
<Route path="/tasks" element={<PlaceholderPage title="Tasks" />} />
<Route path="/chat" element={<PlaceholderPage title="Chat" />} />
<Route path="/reports" element={<PlaceholderPage title="Reports" />} />
<Route path="/backlog" element={<PlaceholderPage title="Backlog" />} />
<Route path="/settings" element={<PlaceholderPage title="Settings" />} />
```

Add PlaceholderPage component in App.tsx:
```typescript
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-4">{title}</h1>
      <p className="text-[var(--text-secondary)] text-sm">Coming soon.</p>
    </div>
  )
}
```

- [ ] **Step 6: Build verification**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm/.worktrees/phase2-core-crm/frontend
npm run build 2>&1 | tail -10
```

Fix any TypeScript errors. Common issues:
- DealNote type — check `author` nullable handling
- KanbanColumn `overId` string/number mismatch — ensure consistent typing
- `page_size` param in dealsApi.list — backend uses `page_size` from DRF

- [ ] **Step 7: Final commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm/.worktrees/phase2-core-crm
git add frontend/src/
git commit -m "feat: add Deals Kanban board, DnD reorder, and Deal detail with notes"
```

---

## Phase 2 Completion Checklist

- [ ] All backend tests pass: `pytest apps/ -v`
- [ ] Frontend builds: `npm run build` succeeds
- [ ] Django check passes: `python manage.py check --settings=config.settings.dev`
- [ ] Clients list page renders at /clients
- [ ] Client detail page renders at /clients/:id with tabs
- [ ] Deals Kanban renders at /deals with drag-drop
- [ ] Deal detail with notes at /deals/:id

---

## Next: Phase 3

`docs/superpowers/plans/2026-04-14-phase3-tasks-dashboard.md`:
- `apps/tasks/` — Task model + API
- `apps/dashboard/` — KPI stats, sales funnel
- Dashboard page with StatCard widgets and charts
- Tasks list page
