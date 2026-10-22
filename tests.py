from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import Author, Book, CirculationRecord, Member


class CirculationWorkflowTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user(
            username="librarian", password="test-password", is_staff=True
        )
        self.author = Author.objects.create(name="Test Author")
        self.book = Book.objects.create(
            title="Test Book",
            author=self.author,
            isbn="9781234567890",
            genre="Fiction",
            total_copies=1,
            available_copies=1,
        )
        self.member = Member.objects.create(
            name="Test Member",
            member_id="MEM-1",
            email="member@example.com",
        )
        self.client.force_login(self.staff)

    def test_issue_reduces_inventory_and_sets_fourteen_day_due_date(self):
        response = self.client.post(
            reverse("circulation"),
            {"book": self.book.pk, "member": self.member.pk},
        )

        record = CirculationRecord.objects.get()
        self.book.refresh_from_db()
        self.assertRedirects(response, reverse("circulation"))
        self.assertEqual(self.book.available_copies, 0)
        self.assertEqual(record.due_date, timezone.localdate() + timedelta(days=14))
        self.assertFalse(record.returned)

    def test_cannot_issue_book_when_no_copies_are_available(self):
        self.book.available_copies = 0
        self.book.save(update_fields=["available_copies"])

        response = self.client.post(
            reverse("circulation"),
            {"book": self.book.pk, "member": self.member.pk},
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(CirculationRecord.objects.exists())
        self.assertContains(response, "This title has no available copies.")
        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 0)

    def test_return_restores_inventory_and_calculates_overdue_fine(self):
        today = timezone.localdate()
        record = CirculationRecord.objects.create(
            book=self.book,
            member=self.member,
            issue_date=today - timedelta(days=20),
            due_date=today - timedelta(days=6),
        )
        self.book.available_copies = 0
        self.book.save(update_fields=["available_copies"])

        response = self.client.post(reverse("return_book", args=[record.pk]))

        record.refresh_from_db()
        self.book.refresh_from_db()
        self.assertRedirects(response, reverse("circulation"))
        self.assertTrue(record.returned)
        self.assertEqual(record.return_date, today)
        self.assertEqual(record.fine_amount, Decimal("30.00"))
        self.assertEqual(self.book.available_copies, 1)

    def test_returned_record_cannot_be_processed_twice(self):
        today = timezone.localdate()
        record = CirculationRecord.objects.create(
            book=self.book,
            member=self.member,
            issue_date=today - timedelta(days=15),
            due_date=today - timedelta(days=1),
            return_date=today,
            returned=True,
        )
        self.book.available_copies = 0
        self.book.save(update_fields=["available_copies"])

        self.client.post(reverse("return_book", args=[record.pk]))

        self.book.refresh_from_db()
        self.assertEqual(self.book.available_copies, 0)

    def test_return_on_or_before_due_date_has_no_fine(self):
        today = timezone.localdate()
        record = CirculationRecord.objects.create(
            book=self.book,
            member=self.member,
            issue_date=today - timedelta(days=14),
            due_date=today,
        )
        self.book.available_copies = 0
        self.book.save(update_fields=["available_copies"])

        self.client.post(reverse("return_book", args=[record.pk]))

        record.refresh_from_db()
        self.assertEqual(record.fine_amount, Decimal("0.00"))

    def test_catalog_searches_by_author_genre_and_isbn(self):
        for query in ("Test Author", "Fiction", "9781234567890"):
            with self.subTest(query=query):
                response = self.client.get(reverse("catalog"), {"q": query})
                self.assertContains(response, "Test Book")


class AccessControlTests(TestCase):
    def test_non_staff_cannot_open_circulation(self):
        user = get_user_model().objects.create_user(
            username="member", password="test-password"
        )
        self.client.force_login(user)
        response = self.client.get(reverse("circulation"))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_member_dashboard_requires_authentication(self):
        response = self.client.get(reverse("member_dashboard"))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_member_dashboard_only_shows_the_signed_in_members_history(self):
        user = get_user_model().objects.create_user(
            username="member", password="test-password"
        )
        author = Author.objects.create(name="History Author")
        book = Book.objects.create(
            title="Private Member Book",
            author=author,
            isbn="9781234567800",
            genre="Fiction",
            total_copies=1,
            available_copies=0,
        )
        member = Member.objects.create(
            name="Signed-in Member",
            member_id="MEM-2",
            email="member2@example.com",
            user=user,
        )
        CirculationRecord.objects.create(book=book, member=member)
        self.client.force_login(user)

        response = self.client.get(reverse("member_dashboard"))

        self.assertContains(response, "Private Member Book")
        self.assertNotContains(response, "Test Book")
