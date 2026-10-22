from datetime import timedelta
from decimal import Decimal

from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import F, Q
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from .forms import IssueBookForm
from .models import FINE_PER_DAY, Book, CirculationRecord, Member


def catalog(request: HttpRequest) -> HttpResponse:
    query = request.GET.get("q", "").strip()
    books = Book.objects.select_related("author")
    if query:
        books = books.filter(
            Q(title__icontains=query)
            | Q(author__name__icontains=query)
            | Q(genre__icontains=query)
            | Q(isbn__icontains=query)
        )
    return render(request, "library/catalog.html", {"books": books, "query": query})


@staff_member_required(login_url="login")
def circulation(request: HttpRequest) -> HttpResponse:
    form = IssueBookForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        book_id = form.cleaned_data["book"].pk
        member = form.cleaned_data["member"]
        today = timezone.localdate()
        due_date = today + timedelta(days=14)

        with transaction.atomic():
            book = get_object_or_404(Book.objects.select_related("author"), pk=book_id)
            inventory_updated = Book.objects.filter(
                pk=book_id, available_copies__gt=0
            ).update(available_copies=F("available_copies") - 1)
            if not inventory_updated:
                form.add_error("book", "This title has no available copies.")
            else:
                CirculationRecord.objects.create(
                    book=book,
                    member=member,
                    issue_date=today,
                    due_date=due_date,
                )
                messages.success(
                    request,
                    f"Issued “{book.title}” to {member.name}; due {due_date:%b %d, %Y}.",
                )
                return redirect("circulation")

    active_records = (
        CirculationRecord.objects.filter(returned=False)
        .select_related("book", "member")
        .order_by("due_date")
    )
    return render(
        request,
        "library/circulation.html",
        {
            "form": form,
            "active_records": active_records,
            "fine_per_day": FINE_PER_DAY,
        },
    )


@staff_member_required(login_url="login")
@transaction.atomic
def return_book(request: HttpRequest, record_id: int) -> HttpResponse:
    if request.method != "POST":
        return redirect("circulation")

    record = get_object_or_404(
        CirculationRecord.objects.select_for_update().select_related("book"),
        pk=record_id,
    )
    if record.returned:
        messages.info(request, "This book has already been returned.")
        return redirect("circulation")

    today = timezone.localdate()
    overdue_days = max((today - record.due_date).days, 0)
    fine = (FINE_PER_DAY * overdue_days).quantize(Decimal("0.01"))
    updated = CirculationRecord.objects.filter(
        pk=record_id, returned=False
    ).update(returned=True, return_date=today, fine_amount=fine)
    if not updated:
        messages.info(request, "This book has already been returned.")
        return redirect("circulation")
    Book.objects.filter(pk=record.book_id).update(
        available_copies=F("available_copies") + 1
    )

    if fine:
        messages.success(
            request,
            f"Returned “{record.book.title}”. Fine: ₹{fine} for {overdue_days} overdue day(s).",
        )
    else:
        messages.success(request, f"Returned “{record.book.title}” with no overdue fine.")
    return redirect("circulation")


@login_required
def member_dashboard(request: HttpRequest) -> HttpResponse:
    member = Member.objects.filter(user=request.user).first()
    records = (
        CirculationRecord.objects.filter(member=member).select_related("book", "book__author")
        if member
        else CirculationRecord.objects.none()
    )
    return render(
        request,
        "library/member_dashboard.html",
        {
            "member": member,
            "records": records,
            "today": timezone.localdate(),
        },
    )
