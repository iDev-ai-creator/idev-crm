from rest_framework import serializers
from .models import Deal, DealNote
from apps.users.models import User
from apps.clients.models import Client


class DealUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name']


class DealClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'status']


class DealNoteSerializer(serializers.ModelSerializer):
    author = DealUserSerializer(read_only=True)

    class Meta:
        model = DealNote
        fields = ['id', 'deal', 'author', 'text', 'is_deleted', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'deal', 'created_at', 'updated_at']


class DealSerializer(serializers.ModelSerializer):
    assigned_to = DealUserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True
    )
    client = DealClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source='client', queryset=Client.objects.all(), write_only=True
    )
    created_by = DealUserSerializer(read_only=True)
    notes_count = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = ['id', 'title', 'client', 'client_id', 'assigned_to', 'assigned_to_id',
                  'created_by', 'status', 'value_usd', 'probability', 'team_size_needed',
                  'tech_requirements', 'start_date', 'end_date', 'expected_close_date',
                  'description', 'order', 'notes_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_notes_count(self, obj):
        return obj.notes.filter(is_deleted=False).count()

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class ReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    order = serializers.IntegerField(min_value=0)
