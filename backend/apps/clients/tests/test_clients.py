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

@pytest.mark.django_db
def test_client_status_choices():
    statuses = [s[0] for s in Client.Status.choices]
    assert 'lead' in statuses
    assert 'active' in statuses
    assert 'churned' in statuses

@pytest.mark.django_db
def test_contact_creation(manager):
    client = Client.objects.create(name='Beta Ltd', assigned_to=manager, created_by=manager)
    contact = Contact.objects.create(
        client=client, first_name='Alice', last_name='Smith',
        email='alice@beta.com', position='CTO', is_primary=True,
    )
    assert str(contact) == 'Alice Smith'
    assert contact.is_primary is True

@pytest.mark.django_db
def test_contact_full_name():
    client = Client.objects.create(name='Gamma')
    contact = Contact.objects.create(client=client, first_name='Bob', last_name='Jones')
    assert contact.full_name == 'Bob Jones'


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
        'name': 'New Corp', 'industry': 'ecommerce', 'status': 'lead',
    }, format='json')
    assert response.status_code == 201
    assert response.data['name'] == 'New Corp'

@pytest.mark.django_db
def test_client_detail(api_client, manager):
    client = Client.objects.create(name='Detail Corp', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.get(f'/api/clients/{client.pk}/')
    assert response.status_code == 200
    assert 'contacts' in response.data

@pytest.mark.django_db
def test_client_filter_by_status(api_client, manager):
    Client.objects.create(name='Active', status='active', assigned_to=manager, created_by=manager)
    Client.objects.create(name='Lead', status='lead', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.get('/api/clients/?status=active')
    assert response.data['count'] == 1

@pytest.mark.django_db
def test_contact_create(api_client, manager):
    client = Client.objects.create(name='Corp', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    response = api_client.post(f'/api/clients/{client.pk}/contacts/', {
        'first_name': 'Jane', 'last_name': 'Doe', 'email': 'jane@corp.com',
        'position': 'CEO', 'is_primary': True,
    }, format='json')
    assert response.status_code == 201
    assert response.data['full_name'] == 'Jane Doe'
