from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta, date
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the database with realistic demo data for iDev CRM'

    def handle(self, *args, **options):
        from apps.clients.models import Client
        from apps.deals.models import Deal
        from apps.tasks.models import Task

        # Idempotency check
        if Client.objects.count() > 5:
            self.stdout.write(self.style.WARNING(
                f'Database already has {Client.objects.count()} clients. Skipping seed.'
            ))
            return

        try:
            admin = User.objects.get(id=1)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR('Admin user (id=1) not found. Aborting.'))
            return

        self.stdout.write('Seeding demo data...')

        # ── CLIENTS ──────────────────────────────────────────────────────────
        clients_data = [
            # IT
            {
                'name': 'Nexora Technologies',
                'industry': 'IT',
                'website': 'https://nexora.io',
                'country': 'USA',
                'company_size': '51-200',
                'status': 'active',
                'tech_stack': ['Python', 'React', 'AWS'],
                'budget_range': 'large',
                'description': 'Mid-size SaaS platform looking for backend engineers.',
            },
            {
                'name': 'CloudPeak Systems',
                'industry': 'IT',
                'website': 'https://cloudpeak.com',
                'country': 'Germany',
                'company_size': '200+',
                'status': 'active',
                'tech_stack': ['Java', 'Kubernetes', 'GCP'],
                'budget_range': 'enterprise',
                'description': 'Enterprise cloud infrastructure company.',
            },
            {
                'name': 'ByteForge Labs',
                'industry': 'IT',
                'website': 'https://byteforge.dev',
                'country': 'Netherlands',
                'company_size': '11-50',
                'status': 'prospect',
                'tech_stack': ['Go', 'React', 'PostgreSQL'],
                'budget_range': 'medium',
                'description': 'Startup building developer tooling.',
            },
            {
                'name': 'DataStream Inc',
                'industry': 'IT',
                'website': 'https://datastream.io',
                'country': 'UK',
                'company_size': '51-200',
                'status': 'lead',
                'tech_stack': ['Spark', 'Kafka', 'Python'],
                'budget_range': 'large',
                'description': 'Real-time data analytics platform.',
            },
            # Finance
            {
                'name': 'Meridian Capital Group',
                'industry': 'Finance',
                'website': 'https://meridiancg.com',
                'country': 'USA',
                'company_size': '200+',
                'status': 'active',
                'tech_stack': ['Java', '.NET', 'Oracle'],
                'budget_range': 'enterprise',
                'description': 'Investment firm digitizing trading ops.',
            },
            {
                'name': 'FinTrust Partners',
                'industry': 'Finance',
                'website': 'https://fintrust.eu',
                'country': 'Switzerland',
                'company_size': '51-200',
                'status': 'prospect',
                'tech_stack': ['Python', 'React', 'PostgreSQL'],
                'budget_range': 'large',
                'description': 'Wealth management platform modernization.',
            },
            {
                'name': 'Krypto Exchange Ltd',
                'industry': 'Finance',
                'website': 'https://kryptoex.io',
                'country': 'Cyprus',
                'company_size': '11-50',
                'status': 'paused',
                'tech_stack': ['Rust', 'React', 'Redis'],
                'budget_range': 'medium',
                'description': 'Crypto exchange needing security engineers.',
            },
            # E-commerce
            {
                'name': 'ShopNova Global',
                'industry': 'E-commerce',
                'website': 'https://shopnova.com',
                'country': 'UAE',
                'company_size': '51-200',
                'status': 'active',
                'tech_stack': ['Node.js', 'Vue.js', 'MongoDB'],
                'budget_range': 'large',
                'description': 'Multi-region marketplace scaling engineering team.',
            },
            {
                'name': 'Cartify Solutions',
                'industry': 'E-commerce',
                'website': 'https://cartify.io',
                'country': 'Poland',
                'company_size': '11-50',
                'status': 'lead',
                'tech_stack': ['PHP', 'React', 'MySQL'],
                'budget_range': 'small',
                'description': 'E-commerce platform for Eastern Europe.',
            },
            {
                'name': 'LuxRetail Tech',
                'industry': 'E-commerce',
                'website': 'https://luxretail.tech',
                'country': 'France',
                'company_size': '200+',
                'status': 'churned',
                'tech_stack': ['Magento', 'Vue.js', 'Elasticsearch'],
                'budget_range': 'enterprise',
                'description': 'Luxury goods online platform — churned after restructuring.',
            },
            # Healthcare
            {
                'name': 'MediCore Systems',
                'industry': 'Healthcare',
                'website': 'https://medicore.health',
                'country': 'USA',
                'company_size': '51-200',
                'status': 'active',
                'tech_stack': ['Python', 'Django', 'AWS'],
                'budget_range': 'large',
                'description': 'EHR system requiring HIPAA-compliant devs.',
            },
            {
                'name': 'HealthBridge Analytics',
                'industry': 'Healthcare',
                'website': 'https://healthbridge.ai',
                'country': 'Canada',
                'company_size': '11-50',
                'status': 'prospect',
                'tech_stack': ['Python', 'TensorFlow', 'Azure'],
                'budget_range': 'medium',
                'description': 'AI diagnostics startup expanding dev team.',
            },
            # Retail
            {
                'name': 'RetailMax International',
                'industry': 'Retail',
                'website': 'https://retailmax.com',
                'country': 'UK',
                'company_size': '200+',
                'status': 'active',
                'tech_stack': ['Java', 'Angular', 'Oracle'],
                'budget_range': 'enterprise',
                'description': 'Brick-and-mortar retail chain digitizing operations.',
            },
            {
                'name': 'FreshMart Technologies',
                'industry': 'Retail',
                'website': 'https://freshmart.tech',
                'country': 'Israel',
                'company_size': '51-200',
                'status': 'lead',
                'tech_stack': ['React', 'Node.js', 'PostgreSQL'],
                'budget_range': 'medium',
                'description': 'Grocery delivery platform requiring mobile devs.',
            },
            {
                'name': 'StyleBrand Digital',
                'industry': 'Retail',
                'website': 'https://stylebrand.io',
                'country': 'Italy',
                'company_size': '11-50',
                'status': 'prospect',
                'tech_stack': ['Shopify', 'React', 'GraphQL'],
                'budget_range': 'small',
                'description': 'Fashion brand building headless commerce.',
            },
        ]

        clients = []
        for data in clients_data:
            client = Client.objects.create(
                assigned_to=admin,
                created_by=admin,
                **data,
            )
            clients.append(client)

        self.stdout.write(f'  Created {len(clients)} clients')

        # ── DEALS ────────────────────────────────────────────────────────────
        today = date.today()
        deals_data = [
            # Nexora Technologies
            {
                'title': 'Backend Team Augmentation — Nexora Q1',
                'client': clients[0],
                'status': 'active',
                'value_usd': 72000,
                'probability': 100,
                'team_size_needed': 3,
                'tech_requirements': ['Python', 'Django', 'AWS'],
                'start_date': today - timedelta(days=45),
                'end_date': today + timedelta(days=90),
                'description': '3 Python backend engineers, 6-month contract.',
            },
            {
                'title': 'DevOps Specialist — Nexora',
                'client': clients[0],
                'status': 'proposal',
                'value_usd': 28000,
                'probability': 65,
                'team_size_needed': 1,
                'tech_requirements': ['Kubernetes', 'Terraform', 'AWS'],
                'expected_close_date': today + timedelta(days=14),
                'description': 'Senior DevOps for infrastructure migration.',
            },
            # CloudPeak Systems
            {
                'title': 'Java Microservices Team — CloudPeak',
                'client': clients[1],
                'status': 'active',
                'value_usd': 144000,
                'probability': 100,
                'team_size_needed': 6,
                'tech_requirements': ['Java', 'Spring Boot', 'Kubernetes'],
                'start_date': today - timedelta(days=30),
                'end_date': today + timedelta(days=150),
                'description': 'Long-term engagement for microservices refactor.',
            },
            # ByteForge Labs
            {
                'title': 'Go Developer — ByteForge',
                'client': clients[2],
                'status': 'negotiation',
                'value_usd': 34000,
                'probability': 75,
                'team_size_needed': 2,
                'tech_requirements': ['Go', 'gRPC', 'PostgreSQL'],
                'expected_close_date': today + timedelta(days=10),
                'description': 'Two Go engineers for CLI tooling product.',
            },
            # DataStream Inc
            {
                'title': 'Data Engineering Lead — DataStream',
                'client': clients[3],
                'status': 'discovery',
                'value_usd': 55000,
                'probability': 40,
                'team_size_needed': 2,
                'tech_requirements': ['Spark', 'Kafka', 'Python'],
                'expected_close_date': today + timedelta(days=30),
                'description': 'Initial discovery call completed, need proposal.',
            },
            # Meridian Capital
            {
                'title': 'Trading Platform Engineers — Meridian',
                'client': clients[4],
                'status': 'active',
                'value_usd': 120000,
                'probability': 100,
                'team_size_needed': 4,
                'tech_requirements': ['Java', 'FIX Protocol', 'Oracle'],
                'start_date': today - timedelta(days=60),
                'end_date': today + timedelta(days=120),
                'description': 'Critical path engineers for trading desk.',
            },
            {
                'title': 'Risk Analytics Module — Meridian',
                'client': clients[4],
                'status': 'signed',
                'value_usd': 48000,
                'probability': 90,
                'team_size_needed': 2,
                'tech_requirements': ['Python', 'Pandas', 'SQL'],
                'start_date': today + timedelta(days=7),
                'description': 'Quant dev team for risk analytics module.',
            },
            # FinTrust Partners
            {
                'title': 'Full-Stack Team — FinTrust MVP',
                'client': clients[5],
                'status': 'proposal',
                'value_usd': 62000,
                'probability': 55,
                'team_size_needed': 3,
                'tech_requirements': ['React', 'Python', 'PostgreSQL'],
                'expected_close_date': today + timedelta(days=21),
                'description': 'MVP development for new wealth management portal.',
            },
            # Krypto Exchange
            {
                'title': 'Security Audit Team — Krypto',
                'client': clients[6],
                'status': 'lost',
                'value_usd': 22000,
                'probability': 0,
                'team_size_needed': 1,
                'tech_requirements': ['Rust', 'Solidity', 'Security'],
                'description': 'Lost to competitor on pricing.',
            },
            # ShopNova
            {
                'title': 'Mobile Dev Team — ShopNova iOS/Android',
                'client': clients[7],
                'status': 'active',
                'value_usd': 96000,
                'probability': 100,
                'team_size_needed': 4,
                'tech_requirements': ['React Native', 'Node.js', 'MongoDB'],
                'start_date': today - timedelta(days=20),
                'end_date': today + timedelta(days=100),
                'description': 'Mobile-first app rewrite for UAE market.',
            },
            # Cartify Solutions
            {
                'title': 'PHP Modernization — Cartify',
                'client': clients[8],
                'status': 'new_lead',
                'value_usd': 18000,
                'probability': 20,
                'team_size_needed': 1,
                'tech_requirements': ['PHP', 'Laravel', 'React'],
                'description': 'Inbound lead from LinkedIn outreach.',
            },
            # MediCore Systems
            {
                'title': 'HIPAA-Compliant DevOps — MediCore',
                'client': clients[10],
                'status': 'active',
                'value_usd': 85000,
                'probability': 100,
                'team_size_needed': 3,
                'tech_requirements': ['Python', 'Django', 'AWS', 'HIPAA'],
                'start_date': today - timedelta(days=50),
                'end_date': today + timedelta(days=130),
                'description': 'Backend + DevOps team for EHR platform.',
            },
            # HealthBridge
            {
                'title': 'ML Engineers — HealthBridge AI',
                'client': clients[11],
                'status': 'discovery',
                'value_usd': 42000,
                'probability': 35,
                'team_size_needed': 2,
                'tech_requirements': ['Python', 'TensorFlow', 'Azure ML'],
                'expected_close_date': today + timedelta(days=25),
                'description': 'AI model development team exploration.',
            },
            # RetailMax
            {
                'title': 'Enterprise Integration Team — RetailMax',
                'client': clients[12],
                'status': 'active',
                'value_usd': 150000,
                'probability': 100,
                'team_size_needed': 6,
                'tech_requirements': ['Java', 'SAP', 'Angular'],
                'start_date': today - timedelta(days=90),
                'end_date': today + timedelta(days=180),
                'description': 'Long-running SAP integration project.',
            },
            # FreshMart
            {
                'title': 'React Native Team — FreshMart',
                'client': clients[13],
                'status': 'negotiation',
                'value_usd': 38000,
                'probability': 70,
                'team_size_needed': 2,
                'tech_requirements': ['React Native', 'Node.js', 'PostgreSQL'],
                'expected_close_date': today + timedelta(days=7),
                'description': 'Mobile grocery delivery app — final negotiation.',
            },
            # StyleBrand
            {
                'title': 'Headless Commerce Dev — StyleBrand',
                'client': clients[14],
                'status': 'proposal',
                'value_usd': 14000,
                'probability': 50,
                'team_size_needed': 1,
                'tech_requirements': ['React', 'GraphQL', 'Shopify'],
                'expected_close_date': today + timedelta(days=18),
                'description': 'Single senior frontend for headless Shopify build.',
            },
            # Closed/historical
            {
                'title': 'API Integration — LuxRetail (Closed)',
                'client': clients[9],
                'status': 'closed',
                'value_usd': 65000,
                'probability': 0,
                'team_size_needed': 2,
                'tech_requirements': ['Magento', 'PHP'],
                'start_date': today - timedelta(days=180),
                'end_date': today - timedelta(days=30),
                'description': 'Completed engagement before client churned.',
            },
            {
                'title': 'QA Automation — DataStream',
                'client': clients[3],
                'status': 'new_lead',
                'value_usd': 24000,
                'probability': 25,
                'team_size_needed': 1,
                'tech_requirements': ['Selenium', 'Python', 'Pytest'],
                'description': 'Upsell opportunity from existing contact.',
            },
            {
                'title': 'Tech Lead — CloudPeak Platform Rebuild',
                'client': clients[1],
                'status': 'negotiation',
                'value_usd': 72000,
                'probability': 80,
                'team_size_needed': 1,
                'tech_requirements': ['Go', 'Kubernetes', 'Architecture'],
                'expected_close_date': today + timedelta(days=5),
                'description': 'Fractional tech lead for platform modernization.',
            },
            {
                'title': 'Data Scientist — FinTrust',
                'client': clients[5],
                'status': 'lost',
                'value_usd': 36000,
                'probability': 0,
                'team_size_needed': 1,
                'tech_requirements': ['Python', 'ML', 'Finance'],
                'description': 'Lost — client hired internally.',
            },
        ]

        deals = []
        for i, data in enumerate(deals_data):
            deal = Deal.objects.create(
                assigned_to=admin,
                created_by=admin,
                order=i,
                **data,
            )
            deals.append(deal)

        self.stdout.write(f'  Created {len(deals)} deals')

        # ── TASKS ────────────────────────────────────────────────────────────
        tasks_data = [
            {
                'title': 'Send proposal to ByteForge Labs',
                'description': 'Prepare and send outstaffing proposal with Go developer profiles.',
                'priority': 'high',
                'status': 'todo',
                'deadline': timezone.now() + timedelta(days=2),
                'linked_client': clients[2],
                'linked_deal': deals[3],
            },
            {
                'title': 'Follow up with DataStream Inc on discovery call',
                'description': 'Schedule second discovery meeting to gather technical requirements.',
                'priority': 'medium',
                'status': 'todo',
                'deadline': timezone.now() + timedelta(days=3),
                'linked_client': clients[3],
                'linked_deal': deals[4],
            },
            {
                'title': 'Prepare CVs for FreshMart negotiation',
                'description': 'Select 3 React Native developers and prepare tailored CVs.',
                'priority': 'urgent',
                'status': 'in_progress',
                'deadline': timezone.now() + timedelta(days=1),
                'linked_client': clients[13],
                'linked_deal': deals[14],
            },
            {
                'title': 'Onboarding call — Nexora DevOps engineer',
                'description': 'Coordinate onboarding with Nexora HR and new DevOps candidate.',
                'priority': 'high',
                'status': 'todo',
                'deadline': timezone.now() + timedelta(days=5),
                'linked_client': clients[0],
                'linked_deal': deals[1],
            },
            {
                'title': 'Monthly report for MediCore',
                'description': 'Compile team performance and billing summary for MediCore Systems.',
                'priority': 'medium',
                'status': 'in_progress',
                'deadline': timezone.now() + timedelta(days=7),
                'linked_client': clients[10],
                'linked_deal': deals[11],
            },
            {
                'title': 'Research competitors — HealthBridge AI deal',
                'description': 'Check market rates for ML engineers with TensorFlow + Azure.',
                'priority': 'low',
                'status': 'todo',
                'deadline': timezone.now() + timedelta(days=10),
                'linked_client': clients[11],
                'linked_deal': deals[12],
            },
            {
                'title': 'Contract renewal check — RetailMax',
                'description': 'Review contract terms and prepare renewal proposal for Q3.',
                'priority': 'high',
                'status': 'todo',
                'deadline': timezone.now() + timedelta(days=14),
                'linked_client': clients[12],
                'linked_deal': deals[13],
            },
            {
                'title': 'Conduct tech interview — Go developer for CloudPeak',
                'description': 'Technical interview with senior Go candidate for CloudPeak tech lead.',
                'priority': 'urgent',
                'status': 'in_progress',
                'deadline': timezone.now() + timedelta(days=2),
                'linked_client': clients[1],
                'linked_deal': deals[18],
            },
            {
                'title': 'Update CRM pipeline — Q2 review',
                'description': 'Audit all open deals, update statuses and probabilities.',
                'priority': 'medium',
                'status': 'done',
                'deadline': timezone.now() - timedelta(days=3),
                'linked_client': None,
                'linked_deal': None,
            },
            {
                'title': 'LinkedIn outreach — Cartify decision maker',
                'description': 'Find CTO/VP Engineering on LinkedIn and send connection request.',
                'priority': 'low',
                'status': 'todo',
                'deadline': timezone.now() + timedelta(days=6),
                'linked_client': clients[8],
                'linked_deal': deals[10],
            },
        ]

        tasks = []
        for data in tasks_data:
            task = Task.objects.create(
                assigned_to=admin,
                created_by=admin,
                **data,
            )
            tasks.append(task)

        self.stdout.write(f'  Created {len(tasks)} tasks')

        self.stdout.write(self.style.SUCCESS(
            f'\nDemo data seeded successfully:\n'
            f'  Clients : {len(clients)}\n'
            f'  Deals   : {len(deals)}\n'
            f'  Tasks   : {len(tasks)}'
        ))
