from .base import *

CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

import sentry_sdk
sentry_sdk.init(dsn=os.environ.get('SENTRY_DSN', ''), traces_sample_rate=0.1)
