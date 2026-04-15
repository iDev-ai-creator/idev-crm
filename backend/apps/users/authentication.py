from rest_framework.authentication import BaseAuthentication


class BypassAuthentication(BaseAuthentication):
    """
    Auto-authenticates as admin when BYPASS_AUTH=true in settings.
    All original auth code is preserved — remove this class and
    revert settings to re-enable auth.
    """
    def authenticate(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.filter(email='admin@idev.team', is_active=True).first()
            if user:
                return (user, None)
        except Exception:
            pass
        return None
