import pytest
from django.contrib.auth import get_user_model
from apps.tasks.models import Task
from apps.users.models import Role
from rest_framework.test import APIClient

User = get_user_model()

@pytest.fixture
def manager(db):
    role = Role.objects.create(name='SMT', preset=Role.Preset.SALES_MANAGER, can_manage_deals=True, can_manage_clients=True)
    return User.objects.create_user(email='tm@idev.team', password='pass', first_name='Task', last_name='Mgr', role=role)

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_task_creation(manager):
    task = Task.objects.create(title='Call client', assigned_to=manager, created_by=manager, priority=Task.Priority.HIGH)
    assert str(task) == 'Call client'
    assert task.priority == Task.Priority.HIGH
    assert task.status == Task.Status.TODO

@pytest.mark.django_db
def test_task_list(api_client, manager):
    Task.objects.create(title='T1', assigned_to=manager, created_by=manager)
    Task.objects.create(title='T2', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    r = api_client.get('/api/tasks/')
    assert r.status_code == 200
    assert r.data['count'] == 2

@pytest.mark.django_db
def test_task_create(api_client, manager):
    api_client.force_authenticate(user=manager)
    r = api_client.post('/api/tasks/', {'title': 'New task', 'priority': 'high', 'status': 'todo'}, format='json')
    assert r.status_code == 201
    assert r.data['title'] == 'New task'
    assert r.data['created_by']['email'] == 'tm@idev.team'

@pytest.mark.django_db
def test_task_update_status(api_client, manager):
    task = Task.objects.create(title='T', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    r = api_client.patch(f'/api/tasks/{task.pk}/', {'status': 'done'}, format='json')
    assert r.status_code == 200
    assert r.data['status'] == 'done'

@pytest.mark.django_db
def test_task_filter_by_status(api_client, manager):
    Task.objects.create(title='Done', status='done', assigned_to=manager, created_by=manager)
    Task.objects.create(title='Todo', status='todo', assigned_to=manager, created_by=manager)
    api_client.force_authenticate(user=manager)
    r = api_client.get('/api/tasks/?status=done')
    assert r.data['count'] == 1

@pytest.mark.django_db
def test_task_overdue_flag(api_client, manager):
    from django.utils import timezone
    from datetime import timedelta
    past = timezone.now() - timedelta(days=1)
    task = Task.objects.create(title='Overdue', assigned_to=manager, created_by=manager, deadline=past)
    api_client.force_authenticate(user=manager)
    r = api_client.get(f'/api/tasks/{task.pk}/')
    assert r.data['is_overdue'] is True
