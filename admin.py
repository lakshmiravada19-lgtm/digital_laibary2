from django.contrib import admin

from .models import Author, Book, CirculationRecord, Member


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "isbn", "genre", "available_copies", "total_copies")
    list_filter = ("genre",)
    search_fields = ("title", "author__name", "isbn")


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("name", "member_id", "email", "joined_date", "user")
    search_fields = ("name", "member_id", "email")


@admin.register(CirculationRecord)
class CirculationRecordAdmin(admin.ModelAdmin):
    list_display = (
        "book",
        "member",
        "issue_date",
        "due_date",
        "return_date",
        "returned",
        "fine_amount",
    )
    list_filter = ("returned", "issue_date", "due_date")
    search_fields = ("book__title", "member__name", "member__member_id")
    readonly_fields = (
        "book",
        "member",
        "issue_date",
        "due_date",
        "return_date",
        "returned",
        "fine_amount",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
