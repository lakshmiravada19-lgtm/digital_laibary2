from django.db import migrations


def add_sample_catalog(apps, schema_editor):
    Author = apps.get_model("library", "Author")
    Book = apps.get_model("library", "Book")

    authors = {
        "Mira Sen": "Writer of reflective stories about memory and place.",
        "Arun Mehta": "Author of practical essays and historical fiction.",
        "Leela Iyer": "Novelist exploring family, travel, and belonging.",
    }
    author_objects = {
        name: Author.objects.create(name=name, biography=biography)
        for name, biography in authors.items()
    }
    books = [
        ("The Paper Garden", "Mira Sen", "Fiction", "9781000000001", 4),
        ("Maps of Monsoon", "Arun Mehta", "Travel", "9781000000002", 3),
        ("A Quiet Atlas", "Leela Iyer", "Literary Fiction", "9781000000003", 2),
        ("Small Histories", "Arun Mehta", "History", "9781000000004", 3),
        ("The Last Reading Room", "Mira Sen", "Mystery", "9781000000005", 1),
    ]
    for title, author, genre, isbn, copies in books:
        Book.objects.create(
            title=title,
            author=author_objects[author],
            genre=genre,
            isbn=isbn,
            total_copies=copies,
            available_copies=copies,
        )


def remove_sample_catalog(apps, schema_editor):
    Book = apps.get_model("library", "Book")
    Author = apps.get_model("library", "Author")
    Book.objects.filter(isbn__in=[f"978100000000{i}" for i in range(1, 6)]).delete()
    Author.objects.filter(name__in=["Mira Sen", "Arun Mehta", "Leela Iyer"]).delete()


class Migration(migrations.Migration):
    dependencies = [("library", "0001_initial")]

    operations = [migrations.RunPython(add_sample_catalog, remove_sample_catalog)]
