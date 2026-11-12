// Builds the app shell (sidebar, top bar) for the static mockups so every page
// shares one navigation. The real app builds this from the role permission matrix.
(function () {
  var pages = [
    { id: "dashboard", label: "Dashboard", href: "#", icon: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>' },
    { id: "users", label: "Users", href: "users.html", icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.7.7 2.8 2.3 3 5.2"/>' },
    { id: "outlets", label: "Stock Points, Outlets And Counters", href: "stock-points-outlets-counters.html", icon: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3"/>' },
    { id: "roles", label: "Roles And Access", href: "roles-and-access.html", icon: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>' },
    { id: "audit", label: "Audit Log", href: "audit-log.html", icon: '<path d="M8 3h8l4 4v14H4V3h4zM8 12h8M8 16h8M8 8h4"/>' },
    { id: "profile", label: "My Profile", href: "#", icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>' }
  ];
  var body = document.body;
  var current = body.getAttribute("data-page");
  var title = body.getAttribute("data-title") || "";

  var nav = pages.map(function (p) {
    return '<a href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : "") +
      '><svg viewBox="0 0 24 24" aria-hidden="true">' + p.icon + "</svg>" + p.label + "</a>";
  }).join("");

  // Phase 2 pages add data-txdate. A small label and a calendar that save the
  // transaction date the moment a date is picked. No Set button.
  var txdate = body.hasAttribute("data-txdate")
    ? '<label class="txdate"><span class="txl">Transaction Date</span>' +
      '<input type="date" id="txDate" value="2026-11-05" aria-label="Transaction Date">' +
      '<span class="txbd" id="txBd" title="Back-dated" aria-label="Back-dated"></span></label>'
    : "";

  var shell = document.querySelector(".shell");
  shell.insertAdjacentHTML("afterbegin",
    '<div class="scrim" id="scrim"></div>' +
    '<aside class="sidebar" id="sidebar" aria-label="Main">' +
      '<a class="logo" href="#"><img src="../../../public/brand/spiritflow-logo.png" alt="Spirit Flow"></a>' +
      '<nav class="nav">' + nav + "</nav>" +
      '<div class="me"><div class="avatar" aria-hidden="true">SA</div>' +
      '<div class="who"><strong>Sample Admin</strong><span>System Admin</span></div></div>' +
    "</aside>" +
    '<header class="topbar">' +
      '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Open Menu" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
      '<span class="title">' + title + "</span>" +
      '<span class="spacer"></span>' +
      txdate +
      '<button class="icon-btn" aria-label="Sign Out"><svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/></svg></button>' +
    "</header>"
  );

  // Mockup only: the dot shows when the chosen date is not the sample "today".
  var txInput = document.getElementById("txDate");
  if (txInput) {
    var sampleToday = "2026-11-12";
    var txBd = document.getElementById("txBd");
    var sync = function () { txBd.hidden = txInput.value === sampleToday; };
    txInput.addEventListener("change", sync);
    sync();
  }

  var sidebar = document.getElementById("sidebar");
  var scrim = document.getElementById("scrim");
  var menuBtn = document.getElementById("menuBtn");
  function setOpen(open) {
    sidebar.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", function () { setOpen(!sidebar.classList.contains("open")); });
  scrim.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });

  // Row action menus and modals, shared by the pages.
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-menu]");
    document.querySelectorAll(".menu.open").forEach(function (m) {
      if (!trigger || m.id !== trigger.getAttribute("data-menu")) m.classList.remove("open");
    });
    if (trigger) {
      var menu = document.getElementById(trigger.getAttribute("data-menu"));
      if (menu) menu.classList.toggle("open");
    }
    var opener = e.target.closest("[data-open]");
    if (opener) document.getElementById(opener.getAttribute("data-open")).classList.add("open");
    var closer = e.target.closest("[data-close]");
    if (closer) closer.closest(".modal-scrim").classList.remove("open");
    if (e.target.classList && e.target.classList.contains("modal-scrim")) e.target.classList.remove("open");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") document.querySelectorAll(".modal-scrim.open").forEach(function (m) { m.classList.remove("open"); });
  });
})();
