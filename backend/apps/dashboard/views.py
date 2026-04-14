from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.tasks.models import Task


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Clients
        total_clients = Client.objects.count()
        active_clients = Client.objects.filter(status='active').count()
        new_clients_30d = Client.objects.filter(created_at__gte=thirty_days_ago).count()

        # Deals
        total_deals = Deal.objects.count()
        active_deals = Deal.objects.filter(status__in=['signed', 'active']).count()
        deals_value = sum(
            d.value_usd for d in Deal.objects.filter(status__in=['signed', 'active'])
        ) or 0

        # Pipeline funnel
        funnel = []
        for status, label in [
            ('new_lead', 'New Lead'), ('discovery', 'Discovery'),
            ('proposal', 'Proposal'), ('negotiation', 'Negotiation'),
            ('signed', 'Signed'), ('active', 'Active'),
        ]:
            funnel.append({'status': status, 'label': label, 'count': Deal.objects.filter(status=status).count()})

        # Tasks
        my_tasks_today = Task.objects.filter(
            assigned_to=request.user, status__in=['todo', 'in_progress']
        ).count()
        overdue_tasks = Task.objects.filter(
            deadline__lt=now, status__in=['todo', 'in_progress']
        ).count()

        return Response({
            'clients': {
                'total': total_clients,
                'active': active_clients,
                'new_30d': new_clients_30d,
            },
            'deals': {
                'total': total_deals,
                'active': active_deals,
                'pipeline_value_usd': float(deals_value),
            },
            'funnel': funnel,
            'tasks': {
                'my_open': my_tasks_today,
                'overdue': overdue_tasks,
            },
        })
