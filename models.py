from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

FINE_PER_DAY = Decimal("5.00")


def default_due_date():
    return timezone.localdate() + timedelta(days=14)


class Author(models.Model):
    name = models.CharField(max_length=150)
    biography = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.ForeignKey(Author, on_delete=models.PROTECT, related_name="books")
    isbn = models.CharField(max_length=20, unique=True)
    genre = models.CharField(max_length=100)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    cover_url = models.URLField(blank=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.CheckConstraint(
                condition=Q(available_copies__lte=F("total_copies")),
                name="book_available_copies_not_over_total",
            ),
        ]

    def __str__(self):
        return self.title


class Member(models.Model):
    name = models.CharField(max_length=150)
    member_id = models.CharField(max_length=30, unique=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True)
    joined_date = models.DateField(default=timezone.localdate)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="library_member",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.member_id})"


class CirculationRecord(models.Model):
    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="circulation_records")
    member = models.ForeignKey(
        Member, on_delete=models.PROTECT, related_name="circulation_records"
    )
    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(default=default_due_date)
    return_date = models.DateField(null=True, blank=True)
    fine_amount = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    returned = models.BooleanField(default=False)

    class Meta:
        ordering = ["-issue_date", "-pk"]
        constraints = [
            models.CheckConstraint(
                condition=Q(due_date__gte=F("issue_date")),
                name="circulation_due_on_or_after_issue",
            ),
            models.CheckConstraint(
                condition=(
                    Q(returned=False, return_date__isnull=True)
                    | Q(returned=True, return_date__isnull=False)
                ),
                name="circulation_return_state_consistent",
            ),
        ]
        indexes = [
            models.Index(fields=["member", "returned"]),
            models.Index(fields=["book", "returned"]),
        ]

    def __str__(self):
        return f"{self.book} → {self.member}"
