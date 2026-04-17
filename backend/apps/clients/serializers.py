from rest_framework import serializers
from .models import Client, Contact
from apps.users.models import User
from .risk import validate_tax_id


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'client', 'first_name', 'last_name', 'full_name', 'email',
                  'phone', 'position', 'linkedin', 'is_primary', 'language_pref',
                  'notes', 'telegram', 'whatsapp', 'role', 'order', 'created_at']
        read_only_fields = ['id', 'full_name', 'created_at', 'client']


class ClientUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'first_name', 'last_name']


class ClientSerializer(serializers.ModelSerializer):
    contacts = ContactSerializer(many=True, read_only=True)
    assigned_to = ClientUserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True
    )
    created_by = ClientUserSerializer(read_only=True)
    contacts_count = serializers.SerializerMethodField()
    # Allow empty strings for all string-ish optional fields (DRF's CharField is
    # required=True + allow_blank=False by default, even when the model has blank=True)
    industry = serializers.CharField(required=False, allow_blank=True, default='')
    website = serializers.CharField(required=False, allow_blank=True, default='')
    country = serializers.CharField(required=False, allow_blank=True, default='')
    company_size = serializers.CharField(required=False, allow_blank=True, default='')
    budget_range = serializers.CharField(required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    tech_stack = serializers.JSONField(required=False, default=list)
    tax_id = serializers.CharField(required=False, allow_blank=True, default='')
    tax_id_country = serializers.CharField(required=False, allow_blank=True, default='')
    risk_notes = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = Client
        fields = ['id', 'name', 'industry', 'website', 'country', 'company_size',
                  'status', 'tech_stack', 'budget_range', 'description',
                  'tax_id', 'tax_id_country',
                  'risk_score', 'risk_level', 'risk_factors', 'risk_notes',
                  'risk_overridden', 'risk_override_at',
                  'sync_status', 'sync_error', 'last_synced_at', 'sync_data',
                  'assigned_to', 'assigned_to_id', 'created_by',
                  'contacts', 'contacts_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at',
                            'risk_score', 'risk_level', 'risk_factors',
                            'risk_overridden', 'risk_override_at',
                            'sync_status', 'sync_error', 'last_synced_at', 'sync_data']

    def get_contacts_count(self, obj):
        return obj.contacts.count()

    def validate(self, attrs):
        tax_id = attrs.get('tax_id')
        if tax_id is not None:
            country = (attrs.get('tax_id_country') or 'RU').upper()
            ok, result = validate_tax_id(tax_id, country)
            if not ok:
                raise serializers.ValidationError({'tax_id': result})
            attrs['tax_id'] = result
            attrs['tax_id_country'] = country if tax_id else ''
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        from .risk import apply_risk
        apply_risk(instance)
        # Kick off async sync (enrich website, ЕГРЮЛ by ИНН, HH suggest).
        from .sync import enqueue_sync
        enqueue_sync(instance.id)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        from .risk import apply_risk
        apply_risk(instance)  # respects override
        return instance


class ClientListSerializer(serializers.ModelSerializer):
    assigned_to = ClientUserSerializer(read_only=True)
    contacts_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ['id', 'name', 'industry', 'status', 'company_size', 'budget_range',
                  'assigned_to', 'contacts_count', 'tax_id', 'tax_id_country',
                  'risk_score', 'risk_level', 'created_at']

    def get_contacts_count(self, obj):
        return obj.contacts.count()


from .models import ClientDocument, ClientNote, RateCard


class ClientNoteSerializer(serializers.ModelSerializer):
    author = ClientUserSerializer(read_only=True)

    class Meta:
        model = ClientNote
        fields = ['id', 'client', 'kind', 'title', 'body', 'author', 'pinned', 'created_at', 'updated_at']
        read_only_fields = ['id', 'client', 'author', 'created_at', 'updated_at']


class RateCardSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    margin_usd = serializers.FloatField(read_only=True)
    margin_pct = serializers.FloatField(read_only=True)

    class Meta:
        model = RateCard
        fields = ['id', 'client', 'role', 'role_label', 'role_custom', 'unit',
                  'bill_rate_usd', 'cost_rate_usd', 'margin_usd', 'margin_pct',
                  'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'client', 'role_label', 'margin_usd', 'margin_pct',
                            'created_at', 'updated_at']


class ClientDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True, required=True)

    class Meta:
        model = ClientDocument
        fields = ['id', 'name', 'size', 'file', 'url', 'uploaded_by_name', 'created_at']
        read_only_fields = ['id', 'name', 'size', 'url', 'uploaded_by_name', 'created_at']

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.full_name or obj.uploaded_by.email if obj.uploaded_by else None

    def get_url(self, obj):
        # Relative URL served by the frontend nginx (it proxies /media/ to backend).
        # Absolute URIs break when nginx forwards Host without the external port.
        if obj.file:
            return obj.file.url
        return None
