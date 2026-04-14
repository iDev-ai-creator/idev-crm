import pytest
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.mark.django_db
def test_create_user():
    user = User.objects.create_user(
        email='test@idev.team',
        password='testpass123',
        first_name='Test',
        last_name='User',
    )
    assert user.email == 'test@idev.team'
    assert user.check_password('testpass123')
    assert not user.is_staff

@pytest.mark.django_db
def test_create_superuser():
    user = User.objects.create_superuser(
        email='admin@idev.team',
        password='adminpass123',
    )
    assert user.is_staff
    assert user.is_superuser

@pytest.mark.django_db
def test_user_str():
    user = User.objects.create_user(
        email='john@idev.team',
        password='pass',
        first_name='John',
        last_name='Doe',
    )
    assert str(user) == 'John Doe'

@pytest.mark.django_db
def test_user_full_name():
    user = User.objects.create_user(
        email='jane@idev.team',
        password='pass',
        first_name='Jane',
        last_name='Smith',
    )
    assert user.full_name == 'Jane Smith'

@pytest.mark.django_db
def test_role_creation():
    from apps.users.models import Role
    role = Role.objects.create(
        name='Test Role',
        preset=Role.Preset.SALES_MANAGER,
        can_manage_deals=True,
        can_manage_clients=True,
    )
    assert str(role) == 'Test Role'
    assert role.can_manage_deals is True
    assert role.can_manage_users is False  # default

@pytest.mark.django_db
def test_employee_creation():
    from apps.users.models import Role, Employee
    role = Role.objects.create(name='Admin', preset=Role.Preset.ADMIN, can_manage_users=True)
    user = User.objects.create_user(email='emp@idev.team', password='pass', role=role)
    employee = Employee.objects.create(user=user, position='Developer', department='Engineering')
    assert str(employee) == f'{user} — Developer'
    assert employee.manager is None

@pytest.mark.django_db
def test_create_user_empty_email_raises():
    with pytest.raises(ValueError, match='Email is required'):
        User.objects.create_user(email='', password='pass')

@pytest.mark.django_db
def test_sales_plan_creation():
    from apps.users.models import Role, Employee, SalesPlan
    import datetime
    from decimal import Decimal
    role = Role.objects.create(name='SM', preset=Role.Preset.SALES_MANAGER)
    user = User.objects.create_user(email='sm@idev.team', password='pass', role=role)
    employee = Employee.objects.create(user=user, position='Sales')
    plan = SalesPlan.objects.create(
        employee=employee,
        period_start=datetime.date(2026, 1, 1),
        period_end=datetime.date(2026, 3, 31),
        target_amount_usd=Decimal('10000.00'),
        scope=SalesPlan.Scope.PERSONAL,
    )
    assert plan.target_amount_usd == Decimal('10000.00')
    assert plan.scope == SalesPlan.Scope.PERSONAL
    assert 'sm@idev.team' in str(plan)

@pytest.mark.django_db
def test_role_str_and_defaults():
    from apps.users.models import Role
    viewer = Role.objects.create(name='Viewer', preset=Role.Preset.VIEWER)
    assert str(viewer) == 'Viewer'
    # All permissions default to False for viewer preset
    assert viewer.can_manage_users is False
    assert viewer.can_manage_deals is True   # default is True per model
    assert viewer.can_manage_settings is False
