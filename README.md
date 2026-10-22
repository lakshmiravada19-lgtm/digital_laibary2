# Digital Library & E-Book Circulation Portal

A Django 5.2 full-stack library portal using Django ORM and SQLite. It provides a searchable Bootstrap catalog, staff-controlled issue and return workflows, overdue fine calculation, member borrowing history, Django admin, and a Render Blueprint.

> The Django application lives at the repository root. The pre-existing `frontend/`, `backend/`, and `database/` directories are an unused React/Node/MySQL starter; they are not part of this Django deployment.

## Requirements

- Python 3.11 or newer (Django 5.2 supports Python 3.11)
- pip

Django 6 requires Python 3.12+, while the assignment specifies Python 3.11 for Render. This project therefore pins Django to the compatible 5.2 series.

## Run locally

From the repository root:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open <http://127.0.0.1:8000/> for the catalog and <http://127.0.0.1:8000/admin/> to manage authors, books, members, and staff accounts.

## Main workflows

- **Catalog:** Search instantly by title, author, genre, or ISBN. Add books and authors in Django admin.
- **Issue/return:** Sign in as a staff user and open **Circulation**. An issue decreases available inventory and is due in 14 days. Return processing increases inventory and calculates the final fine at ₹5 per overdue day.
- **Member dashboard:** Create a Django user, then attach it to a member in Django admin. Sign in with that account and open **My library** to see its borrowing history and overdue status.
- **Access control:** Circulation operations require a staff login; member history requires a login. All state-changing forms include CSRF protection.

## Demo data

`python manage.py migrate` loads sample authors, books, and a demo member (`MEM-1001`). Create a Django user and link it to that member in the admin site to test member-specific history.

## Render deployment

The root `render.yaml` installs requirements, collects static assets, applies migrations, provisions a superuser with a generated password, and starts Gunicorn. It generates `SECRET_KEY` and admin password values and sets `RENDER=True`, which disables debug mode and enables secure proxy/cookie settings. The deployment admin username is `libraryadmin`; retrieve its generated password from the Render environment settings. SQLite remains the default database as required.

1. Push the repository to GitHub.
2. In Render, select **New → Blueprint** and choose the repository.
3. Wait for the build and open the generated `onrender.com` URL.
4. Sign in to `/admin/` with the `libraryadmin` username and generated environment password. Link the demo member to a member account or create additional records there.

Render's free web service has an ephemeral filesystem, so SQLite data can be lost on restart or redeploy. This limitation is acceptable for this assignment's demo deployment.

## Useful commands

```powershell
python manage.py check
python manage.py test
python manage.py collectstatic --no-input
```
