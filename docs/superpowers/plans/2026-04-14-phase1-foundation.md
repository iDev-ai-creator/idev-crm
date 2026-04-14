# iDev CRM — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete project, configure Docker Compose, implement JWT authentication backend, and create the React app shell with sidebar navigation — resulting in a working login screen and navigable (empty) CRM interface.

**Architecture:** Django 5 REST API (port 8000) + React 19 SPA (port 5173 in dev). Docker Compose runs postgres:16, redis:7, and backend. Frontend runs locally via `npm run dev` in development. JWT tokens stored in localStorage, auto-refreshed via axios interceptor. idev-ui consumed as local path dependency `file:../../idev-ui`.

**Tech Stack:** Django 5, djangorestframework, djangorestframework-simplejwt, django-cors-headers, pytest-django, React 19, Vite, TypeScript, Tailwind CSS 4, @idev/ui (local), react-router-dom v7, axios, i18next, zustand

**Reference codebase (patterns only, do not fork):** `/Users/kuznetsov/Projects/ITQ/crm`

---

## File Map

```
idev-crm/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── pytest.ini
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   └── prod.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── apps/
│   │   └── users/
│   │       ├── __init__.py
│   │       ├── models.py        ← User, Role, Employee, SalesPlan
│   │       ├── serializers.py   ← UserSerializer, MeSerializer
│   │       ├── views.py         ← MeView, UserListView
│   │       ├── urls.py
│   │       ├── admin.py
│   │       ├── permissions.py   ← role-based permission helpers
│   │       └── tests/
│   │           ├── __init__.py
│   │           └── test_auth.py
│   └── fixtures/
│       └── initial_data.json    ← 3 roles + 1 admin user
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts        ← axios instance + JWT refresh interceptor
│       │   └── auth.ts          ← login, logout, me
│       ├── stores/
│       │   └── authStore.ts     ← zustand: user, token, login, logout
│       ├── i18n/
│       │   ├── index.ts
│       │   └── locales/
│       │       ├── ru.json
│       │       └── en.json
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   └── DashboardPage.tsx  ← placeholder
│       └── components/
│           └── layout/
│               ├── AppLayout.tsx  ← sidebar + header + <Outlet>
│               ├── Sidebar.tsx    ← nav links
│               └── Header.tsx     ← top bar, user menu, lang toggle
├── docker-compose.yml
└── .env.example                   ← project root env template
```

---

### Task 1: Django project scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Create: `backend/manage.py`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings/__init__.py`
- Create: `backend/config/settings/base.py`
- Create: `backend/config/settings/dev.py`
- Create: `backend/config/settings/prod.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/config/asgi.py`
- Create: `backend/pytest.ini`
- Create: `backend/.env.example`

- [ ] **Step 1: Create requirements files**

`backend/requirements.txt`:
```
Django==5.1.4
djangorestframework==3.15.2
djangorestframework-simplejwt==5.3.1
django-cors-headers==4.4.0
django-filter==24.3
psycopg2-binary==2.9.10
redis==5.2.1
django-redis==5.4.0
python-dotenv==1.0.1
sentry-sdk==2.19.2
Pillow==11.0.0
```

`backend/requirements-dev.txt`:
```
-r requirements.txt
pytest==8.3.4
pytest-django==4.9.0
pytest-cov==6.0.0
factory-boy==3.3.1
```

- [ ] **Step 2: Create manage.py**

`backend/manage.py`:
```python
#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django.") from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Create base settings**

`backend/config/settings/base.py`:
```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ['SECRET_KEY']
DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    # Local
    'apps.users',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'idev_crm'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    }
}

AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

`backend/config/settings/dev.py`:
```python
from .base import *

DEBUG = True
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True

INSTALLED_APPS += ['django.contrib.staticfiles']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
```

`backend/config/settings/prod.py`:
```python
from .base import *

CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

import sentry_sdk
sentry_sdk.init(dsn=os.environ.get('SENTRY_DSN', ''), traces_sample_rate=0.1)
```

- [ ] **Step 4: Create URL config and WSGI/ASGI**

`backend/config/urls.py`:
```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/users/', include('apps.users.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

`backend/config/wsgi.py`:
```python
import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')
application = get_wsgi_application()
```

`backend/config/asgi.py`:
```python
import os
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')
application = get_asgi_application()
```

- [ ] **Step 5: Create pytest.ini**

`backend/pytest.ini`:
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.dev
python_files = tests/test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short
```

- [ ] **Step 6: Create .env.example**

`backend/.env.example`:
```
SECRET_KEY=change-me-in-production
DB_NAME=idev_crm
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432
REDIS_URL=redis://redis:6379/0
SENTRY_DSN=
ALLOWED_HOSTS=localhost,127.0.0.1
```

- [ ] **Step 7: Create virtual env and install deps**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
```

Expected: packages install without errors.

- [ ] **Step 8: Create apps directory structure**

```bash
mkdir -p apps/users/tests
touch apps/__init__.py apps/users/__init__.py apps/users/tests/__init__.py
touch config/__init__.py config/settings/__init__.py
```

- [ ] **Step 9: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm
git add backend/
git commit -m "feat: scaffold Django backend with settings, urls, and deps"
```

---

### Task 2: Users app — models

**Files:**
- Create: `backend/apps/users/models.py`
- Create: `backend/apps/users/admin.py`

- [ ] **Step 1: Write the failing test**

`backend/apps/users/tests/test_auth.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && source venv/bin/activate
pytest apps/users/tests/test_auth.py -v
```

Expected: FAIL — `apps.users.models` not found or `AUTH_USER_MODEL` error.

- [ ] **Step 3: Write the User model**

`backend/apps/users/models.py`:
```python
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.Model):
    class Preset(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        SALES_MANAGER = 'sales_manager', 'Sales Manager'
        RECRUITER = 'recruiter', 'Recruiter'
        VIEWER = 'viewer', 'Viewer'

    name = models.CharField(max_length=50, unique=True)
    preset = models.CharField(max_length=30, choices=Preset.choices, default=Preset.VIEWER)
    can_manage_users = models.BooleanField(default=False)
    can_manage_deals = models.BooleanField(default=True)
    can_manage_clients = models.BooleanField(default=True)
    can_view_reports = models.BooleanField(default=False)
    can_manage_settings = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Language(models.TextChoices):
        RU = 'ru', 'Russian'
        EN = 'en', 'English'

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.RU)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.email

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee')
    position = models.CharField(max_length=150, blank=True)
    department = models.CharField(max_length=150, blank=True)
    manager = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates'
    )

    def __str__(self):
        return f'{self.user} — {self.position}'

    class Meta:
        verbose_name = 'Employee'
        verbose_name_plural = 'Employees'


class SalesPlan(models.Model):
    class Scope(models.TextChoices):
        PERSONAL = 'personal', 'Personal'
        DEPARTMENT = 'department', 'Department'
        COMPANY = 'company', 'Company'

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='sales_plans')
    period_start = models.DateField()
    period_end = models.DateField()
    target_amount_usd = models.DecimalField(max_digits=12, decimal_places=2)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.PERSONAL)

    def __str__(self):
        return f'{self.employee} plan {self.period_start}–{self.period_end}'

    class Meta:
        verbose_name = 'Sales Plan'
        verbose_name_plural = 'Sales Plans'
```

`backend/apps/users/admin.py`:
```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Employee, SalesPlan


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff', 'language')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('first_name', 'last_name', 'avatar', 'language', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (None, {'fields': ('email', 'password1', 'password2', 'first_name', 'last_name', 'role')}),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'preset', 'can_manage_users', 'can_manage_deals', 'can_view_reports')


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('user', 'position', 'department', 'manager')
    raw_id_fields = ('user', 'manager')


@admin.register(SalesPlan)
class SalesPlanAdmin(admin.ModelAdmin):
    list_display = ('employee', 'scope', 'period_start', 'period_end', 'target_amount_usd')
```

- [ ] **Step 4: Run migrations and tests**

```bash
cd backend && source venv/bin/activate
python manage.py makemigrations users
python manage.py migrate
pytest apps/users/tests/test_auth.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm
git add backend/apps/users/ backend/config/
git commit -m "feat: add User, Role, Employee, SalesPlan models"
```

---

### Task 3: Users API (serializers, views, urls)

**Files:**
- Create: `backend/apps/users/serializers.py`
- Create: `backend/apps/users/views.py`
- Create: `backend/apps/users/urls.py`
- Create: `backend/apps/users/permissions.py`
- Modify: `backend/apps/users/tests/test_auth.py`

- [ ] **Step 1: Write failing API tests**

Add to `backend/apps/users/tests/test_auth.py`:
```python
from django.urls import reverse
from rest_framework.test import APIClient
from apps.users.models import Role

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def admin_role(db):
    return Role.objects.create(
        name='Admin',
        preset=Role.Preset.ADMIN,
        can_manage_users=True,
        can_manage_deals=True,
        can_manage_clients=True,
        can_view_reports=True,
        can_manage_settings=True,
    )

@pytest.fixture
def admin_user(db, admin_role):
    return User.objects.create_user(
        email='admin@idev.team',
        password='adminpass',
        first_name='Admin',
        last_name='User',
        role=admin_role,
    )

@pytest.mark.django_db
def test_login_success(api_client, admin_user):
    response = api_client.post('/api/token/', {
        'email': 'admin@idev.team',
        'password': 'adminpass',
    }, format='json')
    assert response.status_code == 200
    assert 'access' in response.data
    assert 'refresh' in response.data

@pytest.mark.django_db
def test_login_wrong_password(api_client, admin_user):
    response = api_client.post('/api/token/', {
        'email': 'admin@idev.team',
        'password': 'wrong',
    }, format='json')
    assert response.status_code == 401

@pytest.mark.django_db
def test_me_endpoint(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/users/me/')
    assert response.status_code == 200
    assert response.data['email'] == 'admin@idev.team'
    assert 'role' in response.data
    assert 'permissions' in response.data
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest apps/users/tests/test_auth.py::test_login_success -v
```

Expected: FAIL — URL not found.

- [ ] **Step 3: Create serializers**

`backend/apps/users/serializers.py`:
```python
from rest_framework import serializers
from .models import User, Role, Employee


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'preset', 'can_manage_users', 'can_manage_deals',
                  'can_manage_clients', 'can_view_reports', 'can_manage_settings']


class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True, required=False
    )
    full_name = serializers.CharField(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name',
                  'avatar', 'language', 'role', 'role_id', 'permissions',
                  'is_active', 'created_at']
        read_only_fields = ['id', 'created_at', 'full_name', 'permissions']

    def get_permissions(self, obj):
        if not obj.role:
            return {}
        return {
            'can_manage_users': obj.role.can_manage_users,
            'can_manage_deals': obj.role.can_manage_deals,
            'can_manage_clients': obj.role.can_manage_clients,
            'can_view_reports': obj.role.can_view_reports,
            'can_manage_settings': obj.role.can_manage_settings,
        }


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', required=False
    )

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name', 'language', 'role_id']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
```

- [ ] **Step 4: Create permissions helper**

`backend/apps/users/permissions.py`:
```python
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role
                    and request.user.role.can_manage_users)


class CanManageDeals(BasePermission):
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated
        return bool(request.user and request.user.is_authenticated
                    and request.user.role
                    and request.user.role.can_manage_deals)
```

- [ ] **Step 5: Create views**

`backend/apps/users/views.py`:
```python
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import User, Role
from .serializers import UserSerializer, CreateUserSerializer, RoleSerializer
from .permissions import IsAdmin


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.select_related('role').filter(is_active=True).order_by('first_name')
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateUserSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.select_related('role')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoleListView(generics.ListAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
```

- [ ] **Step 6: Create URLs**

`backend/apps/users/urls.py`:
```python
from django.urls import path
from .views import MeView, UserListView, UserDetailView, RoleListView

urlpatterns = [
    path('me/', MeView.as_view(), name='user-me'),
    path('', UserListView.as_view(), name='user-list'),
    path('<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('roles/', RoleListView.as_view(), name='role-list'),
]
```

- [ ] **Step 7: Run all tests**

```bash
pytest apps/users/tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/apps/users/
git commit -m "feat: add users REST API — me, list, detail, roles"
```

---

### Task 4: Docker Compose

**Files:**
- Create: `docker-compose.yml` (project root)
- Create: `backend/Dockerfile`
- Create: `.env.example` (project root)

- [ ] **Step 1: Create backend Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput --settings=config.settings.prod 2>/dev/null || true

CMD ["python", "-m", "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
```

- [ ] **Step 2: Create docker-compose.yml**

`docker-compose.yml` (project root):
```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-idev_crm}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DB_HOST: db
      REDIS_URL: redis://redis:6379/0
      DJANGO_SETTINGS_MODULE: config.settings.prod
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - media_data:/app/media

volumes:
  postgres_data:
  media_data:
```

- [ ] **Step 3: Create root .env.example**

`.env.example` (project root):
```
SECRET_KEY=change-me-in-production-use-50-char-random-string
DB_NAME=idev_crm
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=db
DB_PORT=5432
REDIS_URL=redis://redis:6379/0
SENTRY_DSN=
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

- [ ] **Step 4: Copy .env and start Docker**

```bash
cp .env.example .env
docker-compose up -d db redis
```

Expected: postgres and redis containers start.

- [ ] **Step 5: Run migrations against Docker postgres**

```bash
cd backend && source venv/bin/activate
DB_HOST=localhost python manage.py migrate --settings=config.settings.dev
```

Expected: All migrations applied.

- [ ] **Step 6: Load initial fixtures**

First create `backend/fixtures/initial_data.json`:
```json
[
  {
    "model": "users.role",
    "pk": 1,
    "fields": {
      "name": "Admin",
      "preset": "admin",
      "can_manage_users": true,
      "can_manage_deals": true,
      "can_manage_clients": true,
      "can_view_reports": true,
      "can_manage_settings": true
    }
  },
  {
    "model": "users.role",
    "pk": 2,
    "fields": {
      "name": "Sales Manager",
      "preset": "sales_manager",
      "can_manage_users": false,
      "can_manage_deals": true,
      "can_manage_clients": true,
      "can_view_reports": true,
      "can_manage_settings": false
    }
  },
  {
    "model": "users.role",
    "pk": 3,
    "fields": {
      "name": "Recruiter",
      "preset": "recruiter",
      "can_manage_users": false,
      "can_manage_deals": false,
      "can_manage_clients": true,
      "can_view_reports": false,
      "can_manage_settings": false
    }
  },
  {
    "model": "users.role",
    "pk": 4,
    "fields": {
      "name": "Viewer",
      "preset": "viewer",
      "can_manage_users": false,
      "can_manage_deals": false,
      "can_manage_clients": false,
      "can_view_reports": false,
      "can_manage_settings": false
    }
  }
]
```

Then load fixtures and create superuser:
```bash
DB_HOST=localhost python manage.py loaddata fixtures/initial_data.json --settings=config.settings.dev
DB_HOST=localhost python manage.py createsuperuser --settings=config.settings.dev
# Enter: email=admin@idev.team, password=admin123
```

- [ ] **Step 7: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm
git add docker-compose.yml backend/Dockerfile backend/fixtures/ .env.example
git commit -m "feat: add Docker Compose, fixtures, and initial roles"
```

---

### Task 5: React frontend scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Initialize React project**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm
npm create vite@latest frontend -- --template react-ts
cd frontend
```

- [ ] **Step 2: Install dependencies**

```bash
npm install axios react-router-dom@7 i18next react-i18next zustand
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install recharts
npm install "file:../../idev-ui"
npm install -D tailwindcss@4 @tailwindcss/vite
```

Expected: all installed without errors.

- [ ] **Step 3: Configure Vite**

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 4: Configure Tailwind**

`frontend/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'
import idevPreset from '@idev/ui/tailwind.preset'

export default {
  presets: [idevPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config
```

- [ ] **Step 5: Update main CSS to import idev-ui tokens**

`frontend/src/index.css`:
```css
@import "@idev/ui/tokens/tokens.css";
@import "tailwindcss";
```

- [ ] **Step 6: Update index.html**

`frontend/index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>iDev CRM</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Verify app starts**

```bash
npm run dev
```

Expected: Vite server starts at http://localhost:5173, no console errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm
git add frontend/
git commit -m "feat: scaffold React frontend with Vite, Tailwind, idev-ui"
```

---

### Task 6: i18n setup (RU + EN)

**Files:**
- Create: `frontend/src/i18n/index.ts`
- Create: `frontend/src/i18n/locales/ru.json`
- Create: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create translation files**

`frontend/src/i18n/locales/ru.json`:
```json
{
  "nav": {
    "dashboard": "Дашборд",
    "clients": "Клиенты",
    "deals": "Сделки",
    "tasks": "Задачи",
    "chat": "Чат",
    "reports": "Отчёты",
    "backlog": "Бэклог",
    "settings": "Настройки"
  },
  "auth": {
    "login": "Войти",
    "logout": "Выйти",
    "email": "Email",
    "password": "Пароль",
    "loginTitle": "Вход в систему",
    "loginError": "Неверный email или пароль"
  },
  "common": {
    "loading": "Загрузка...",
    "save": "Сохранить",
    "cancel": "Отмена",
    "delete": "Удалить",
    "edit": "Редактировать",
    "add": "Добавить",
    "search": "Поиск",
    "noData": "Нет данных",
    "error": "Ошибка"
  }
}
```

`frontend/src/i18n/locales/en.json`:
```json
{
  "nav": {
    "dashboard": "Dashboard",
    "clients": "Clients",
    "deals": "Deals",
    "tasks": "Tasks",
    "chat": "Chat",
    "reports": "Reports",
    "backlog": "Backlog",
    "settings": "Settings"
  },
  "auth": {
    "login": "Sign In",
    "logout": "Sign Out",
    "email": "Email",
    "password": "Password",
    "loginTitle": "Sign In",
    "loginError": "Invalid email or password"
  },
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "noData": "No data",
    "error": "Error"
  }
}
```

- [ ] **Step 2: Create i18n setup**

`frontend/src/i18n/index.ts`:
```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import en from './locales/en.json'

const savedLang = localStorage.getItem('idev_crm_lang') || 'ru'

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

export default i18n
```

- [ ] **Step 3: Wire i18n into main.tsx**

`frontend/src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n/index'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/ frontend/src/main.tsx
git commit -m "feat: add i18n with RU/EN translations"
```

---

### Task 7: Auth store and API client

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/stores/authStore.ts`

- [ ] **Step 1: Create axios client with JWT refresh**

`frontend/src/api/client.ts`:
```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Silent refresh on 401
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      })
    }
    originalRequest._retry = true
    isRefreshing = true
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (!refresh) throw new Error('No refresh token')
      const { data } = await axios.post('/api/token/refresh/', { refresh })
      localStorage.setItem('access_token', data.access)
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      processQueue(null, data.access)
      originalRequest.headers.Authorization = `Bearer ${data.access}`
      return api(originalRequest)
    } catch (err) {
      processQueue(err, null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
```

- [ ] **Step 2: Create auth API functions**

`frontend/src/api/auth.ts`:
```typescript
import api from './client'

export interface LoginCredentials {
  email: string
  password: string
}

export interface UserProfile {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  avatar: string | null
  language: 'ru' | 'en'
  role: {
    id: number
    name: string
    preset: string
  } | null
  permissions: {
    can_manage_users: boolean
    can_manage_deals: boolean
    can_manage_clients: boolean
    can_view_reports: boolean
    can_manage_settings: boolean
  }
  is_active: boolean
  created_at: string
}

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    const { data } = await api.post('/token/', credentials)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    return data
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  me: async (): Promise<UserProfile> => {
    const { data } = await api.get('/users/me/')
    return data
  },
}
```

- [ ] **Step 3: Create auth store (zustand)**

`frontend/src/stores/authStore.ts`:
```typescript
import { create } from 'zustand'
import { authApi, type UserProfile, type LoginCredentials } from '../api/auth'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (credentials) => {
    await authApi.login(credentials)
    const user = await authApi.me()
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    authApi.logout()
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  fetchMe: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isLoading: false, isAuthenticated: false })
    }
  },
}))
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/ frontend/src/stores/
git commit -m "feat: add axios client with JWT refresh and auth store"
```

---

### Task 8: Login page

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`

- [ ] **Step 1: Create LoginPage**

`frontend/src/pages/LoginPage.tsx`:
```typescript
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@idev/ui'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      navigate('/dashboard')
    } catch {
      setError(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
      <div className="w-full max-w-sm bg-[var(--bg-card)] rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="font-montserrat font-bold text-2xl text-[var(--accent)]">
            iDev CRM
          </span>
        </div>

        <h1 className="text-xl font-semibold text-[var(--text)] mb-6 text-center">
          {t('auth.loginTitle')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-sm text-[var(--danger)] text-center">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            loading={loading}
          >
            {t('auth.login')}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat: add login page with idev-ui components"
```

---

### Task 9: App shell — layout, sidebar, routing

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/Header.tsx`
- Create: `frontend/src/components/layout/AppLayout.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create Sidebar**

`frontend/src/components/layout/Sidebar.tsx`:
```typescript
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const navItems = [
  { to: '/dashboard', icon: '📊', key: 'nav.dashboard' },
  { to: '/clients',   icon: '🏢', key: 'nav.clients' },
  { to: '/deals',     icon: '🤝', key: 'nav.deals' },
  { to: '/tasks',     icon: '✅', key: 'nav.tasks' },
  { to: '/chat',      icon: '💬', key: 'nav.chat' },
  { to: '/reports',   icon: '📈', key: 'nav.reports' },
  { to: '/backlog',   icon: '💡', key: 'nav.backlog' },
  { to: '/settings',  icon: '⚙️', key: 'nav.settings' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <span className="font-montserrat font-bold text-lg text-[var(--accent)]">iDev CRM</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors
               ${isActive
                 ? 'text-[var(--accent)] bg-[var(--accent)]/10'
                 : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
               }`
            }
          >
            <span>{icon}</span>
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create Header**

`frontend/src/components/layout/Header.tsx`:
```typescript
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { ThemeToggle } from '@idev/ui'
import i18n from '../../i18n/index'

export default function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru'
    i18n.changeLanguage(next)
    localStorage.setItem('idev_crm_lang', next)
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-end px-6 gap-4 shrink-0">
      <button
        onClick={toggleLang}
        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] font-medium"
      >
        {i18n.language === 'ru' ? 'EN' : 'RU'}
      </button>
      <ThemeToggle />
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-secondary)]">{user?.full_name}</span>
        <button
          onClick={logout}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
        >
          {t('auth.logout')}
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create AppLayout**

`frontend/src/components/layout/AppLayout.tsx`:
```typescript
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-[var(--bg-main)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder Dashboard page**

`frontend/src/pages/DashboardPage.tsx`:
```typescript
import { useTranslation } from 'react-i18next'

export default function DashboardPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-6">
        {t('nav.dashboard')}
      </h1>
      <p className="text-[var(--text-secondary)]">Coming in Phase 3.</p>
    </div>
  )
}
```

- [ ] **Step 5: Create App.tsx with routing**

`frontend/src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

function AuthInit({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  useEffect(() => { fetchMe() }, [fetchMe])
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthInit>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Verify full flow works**

```bash
# Terminal 1: start backend
cd backend && source venv/bin/activate
DB_HOST=localhost python manage.py runserver --settings=config.settings.dev

# Terminal 2: start frontend
cd frontend && npm run dev
```

Open http://localhost:5173, should redirect to /login. Log in with admin@idev.team / admin123. Should see sidebar with all nav items and Dashboard placeholder.

- [ ] **Step 7: Final commit for Phase 1**

```bash
cd /Users/kuznetsov/Projects/iDev/idev-crm
git add frontend/src/
git commit -m "feat: complete Phase 1 — app shell with login, sidebar, routing"
```

---

## Phase 1 Completion Checklist

After executing all tasks, verify:
- [ ] `docker-compose up -d db redis` starts both containers
- [ ] `python manage.py runserver` starts without errors
- [ ] All pytest tests pass: `pytest apps/users/tests/ -v`
- [ ] `npm run dev` starts without errors
- [ ] http://localhost:5173 redirects to /login
- [ ] Login with admin@idev.team / admin123 succeeds
- [ ] Sidebar shows all 8 nav links
- [ ] Theme toggle (light/dark) works
- [ ] Language toggle (RU/EN) works and persists
- [ ] Logout returns to /login

---

## Next: Phase 2

Continue with `docs/superpowers/plans/2026-04-14-phase2-core-crm.md`:
- `apps/clients/` — Client, Contact models + API + frontend table + detail card
- `apps/deals/` — Deal, DealNote models + Kanban API + drag-drop frontend
