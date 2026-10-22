document.addEventListener("DOMContentLoaded", () => {
  const search = document.querySelector("[data-live-search]");
  const cards = [...document.querySelectorAll(".book-card")];
  const emptyResults = document.querySelector("#noLiveResults");

  if (search && cards.length) {
    search.addEventListener("input", () => {
      const term = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const matches = card.dataset.bookSearch.includes(term);
        card.classList.toggle("d-none", !matches);
        if (matches) visible += 1;
      });
      emptyResults?.classList.toggle("d-none", visible !== 0);
    });
  }

  const duePreview = document.querySelector("[data-due-preview]");
  if (duePreview) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + 14);
    duePreview.textContent = `Due date: ${today.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })} (14 days from today).`;
  }
});
