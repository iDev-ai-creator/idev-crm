from .base import *

DEBUG = True
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
ALLOWED_HOSTS = ['*']

CORS_ALLOW_ALL_ORIGINS = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
