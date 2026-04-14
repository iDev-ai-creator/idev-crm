import pytest
from django.contrib.auth import get_user_model
from apps.backlog.models import BacklogItem
from apps.users.models import Role
from rest_framework.test import APIClient

User = get_user_model()

@pytest.fixture
def user(db):
    r = Role.objects.create(name='BLR', preset=Role.Preset.SALES_MANAGER)
    return User.objects.create_user(email='bl@idev.team', password='pass', first_name='Back', last_name='Log', role=r)

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_create_idea(api_client, user):
    api_client.force_authenticate(user=user)
    r = api_client.post('/api/backlog/', {'title': 'Add dark mode', 'description': 'Users want it', 'status': 'idea'}, format='json')
    assert r.status_code == 201
    assert r.data['title'] == 'Add dark mode'
    assert r.data['author']['full_name'] == 'Back Log'

@pytest.mark.django_db
def test_list_by_status(api_client, user):
    BacklogItem.objects.create(title='A', status='idea', author=user)
    BacklogItem.objects.create(title='B', status='done', author=user)
    api_client.force_authenticate(user=user)
    r = api_client.get('/api/backlog/?status=idea')
    assert r.data['count'] == 1

@pytest.mark.django_db
def test_vote(api_client, user):
    item = BacklogItem.objects.create(title='Vote me', author=user)
    api_client.force_authenticate(user=user)
    r = api_client.post(f'/api/backlog/{item.pk}/vote/')
    assert r.status_code == 200
    assert r.data['votes'] == 1
