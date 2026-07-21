const tabByHash = {
  home: "tab-home",
  uganda: "tab-uganda",
  national: "tab-uganda",
  politics: "tab-politics",
  business: "tab-business",
  district: "tab-district",
  districts: "tab-district",
  sports: "tab-sports",
  world: "tab-world",
  international: "tab-world",
  ecosystem: "tab-ecosystem",
};

function activateHashTab() {
  const key = window.location.hash.replace("#", "").toLowerCase();
  const input = document.getElementById(tabByHash[key] || "");
  if (input) input.checked = true;
}

window.addEventListener("hashchange", activateHashTab);
activateHashTab();

document.querySelectorAll("[data-tab-link]").forEach((link) => {
  link.addEventListener("click", () => {
    const input = document.getElementById(tabByHash[link.dataset.tabLink] || "");
    if (input) input.checked = true;
  });
});

document.querySelectorAll(".nav-strip label[for^='tab-']").forEach((label) => {
  label.addEventListener("click", () => {
    const hash = label.getAttribute("for").replace("tab-", "");
    history.replaceState(null, "", `#${hash}`);
  });
});

document.querySelectorAll("[data-open-citizen]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const toggle = document.getElementById("citizen-modal-toggle");
    if (toggle) toggle.checked = true;
  });
});

document.querySelectorAll("[data-category]").forEach((mount) => {
  mount.innerHTML = '<article class="grid-card empty-card"><h3>Loading latest stories...</h3></article>';
});
