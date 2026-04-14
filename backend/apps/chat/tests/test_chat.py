import pytest
from django.contrib.auth import get_user_model
from apps.chat.models import ChatChannel, ChatMessage
from apps.users.models import Role
from rest_framework.test import APIClient

User = get_user_model()

@pytest.fixture
def user1(db):
    r = Role.objects.create(name='U1R', preset=Role.Preset.SALES_MANAGER)
    return User.objects.create_user(email='u1@idev.team', password='pass', first_name='User', last_name='One', role=r)

@pytest.fixture
def user2(db):
    r = Role.objects.create(name='U2R', preset=Role.Preset.VIEWER)
    return User.objects.create_user(email='u2@idev.team', password='pass', first_name='User', last_name='Two', role=r)

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_create_group_channel(api_client, user1, user2):
    api_client.force_authenticate(user=user1)
    r = api_client.post('/api/chat/', {'name': 'Team', 'channel_type': 'group', 'member_ids': [user2.pk]}, format='json')
    assert r.status_code == 201
    assert r.data['channel_type'] == 'group'

@pytest.mark.django_db
def test_direct_channel(api_client, user1, user2):
    api_client.force_authenticate(user=user1)
    r = api_client.post('/api/chat/direct/', {'user_id': user2.pk}, format='json')
    assert r.status_code in (200, 201)
    # calling again returns same channel
    r2 = api_client.post('/api/chat/direct/', {'user_id': user2.pk}, format='json')
    assert r2.data['id'] == r.data['id']

@pytest.mark.django_db
def test_channel_list_only_members(api_client, user1, user2):
    ch = ChatChannel.objects.create(name='Private', channel_type='group')
    ch.members.add(user1)
    api_client.force_authenticate(user=user2)
    r = api_client.get('/api/chat/')
    results = r.data.get('results', r.data)
    assert all(c['id'] != ch.id for c in results)

@pytest.mark.django_db
def test_message_list(api_client, user1, user2):
    ch = ChatChannel.objects.create(name='Test')
    ch.members.add(user1, user2)
    ChatMessage.objects.create(channel=ch, author=user1, text='Hello')
    ChatMessage.objects.create(channel=ch, author=user2, text='World')
    api_client.force_authenticate(user=user1)
    r = api_client.get(f'/api/chat/{ch.pk}/messages/')
    assert r.status_code == 200
    results = r.data.get('results', r.data)
    assert len(results) == 2

@pytest.mark.django_db
def test_message_list_non_member_blocked(api_client, user1, user2):
    ch = ChatChannel.objects.create(name='Priv')
    ch.members.add(user1)
    api_client.force_authenticate(user=user2)
    r = api_client.get(f'/api/chat/{ch.pk}/messages/')
    assert r.status_code == 200
    results = r.data.get('results', r.data)
    assert len(results) == 0  # empty, not 403
