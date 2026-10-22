from django.db import migrations


def add_demo_member(apps, schema_editor):
    Member = apps.get_model("library", "Member")
    Member.objects.get_or_create(
        member_id="MEM-1001",
        defaults={
            "name": "Demo Member",
            "email": "demo.member@example.com",
            "phone": "9000000001",
        },
    )


def remove_demo_member(apps, schema_editor):
    Member = apps.get_model("library", "Member")
    Member.objects.filter(member_id="MEM-1001").delete()


class Migration(migrations.Migration):
    dependencies = [("library", "0002_seed_catalog")]

    operations = [migrations.RunPython(add_demo_member, remove_demo_member)]
