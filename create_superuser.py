import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "library_portal.settings")

import django

django.setup()

from django.contrib.auth import get_user_model

username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")

if not all((username, email, password)):
    sys.exit(
        "Set DJANGO_SUPERUSER_USERNAME, DJANGO_SUPERUSER_EMAIL, and "
        "DJANGO_SUPERUSER_PASSWORD to create the deployment admin."
    )

User = get_user_model()
if User.objects.filter(username=username).exists():
    print(f"Superuser {username!r} already exists; leaving its password unchanged.")
else:
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f"Created deployment superuser {username!r}.")
