from rest_framework import serializers
from .models import Client, Contact
from apps.users.models import User


class ContactSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'client', 'first_name', 'last_name', 'full_name', 'email',
                  'phone', 'position', 'linkedin', 'is_primary', 'language_pref',
                  'notes', 'created_at']
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

    class Meta:
        model = Client
        fields = ['id', 'name', 'industry', 'website', 'country', 'company_size',
                  'status', 'tech_stack', 'budget_range', 'description',
                  'assigned_to', 'assigned_to_id', 'created_by',
                  'contacts', 'contacts_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_contacts_count(self, obj):
        return obj.contacts.count()

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ClientListSerializer(serializers.ModelSerializer):
    assigned_to = ClientUserSerializer(read_only=True)
    contacts_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = ['id', 'name', 'industry', 'status', 'company_size', 'budget_range',
                  'assigned_to', 'contacts_count', 'created_at']

    def get_contacts_count(self, obj):
        return obj.contacts.count()
