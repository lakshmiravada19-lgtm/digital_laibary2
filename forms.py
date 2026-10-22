from django import forms

from .models import Book, Member


class IssueBookForm(forms.Form):
    member = forms.ModelChoiceField(queryset=Member.objects.none())
    book = forms.ModelChoiceField(queryset=Book.objects.none())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["member"].queryset = Member.objects.order_by("name")
        self.fields["book"].queryset = Book.objects.select_related("author")
        self.fields["member"].widget.attrs["class"] = "form-select"
        self.fields["book"].widget.attrs["class"] = "form-select"

    def clean(self):
        cleaned_data = super().clean()
        book = cleaned_data.get("book")
        if book and book.available_copies < 1:
            self.add_error("book", "This title has no available copies.")
        return cleaned_data
