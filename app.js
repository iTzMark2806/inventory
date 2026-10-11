(() => {
  "use strict";

  const USER = { name: "Mark Bernard Bongkingki", role: "Administrator" };
  const INITIALS = USER.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const AVATAR_KEY = "inventory_avatar_v1";
  const AVATAR_PX = 160;              // saved size (square)
  const AVATAR_MAX_BYTES = 8 * 1024 * 1024; // refuse files bigger than 8 MB

  function getAvatar() {
    try { return localStorage.getItem(AVATAR_KEY) || ""; } catch (e) { return ""; }
  }

  function setAvatar(dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
      else localStorage.removeItem(AVATAR_KEY);
      return true;
    } catch (e) { return false; }
  }

  // Shows the photo in an element, or the initials when there is no photo
  function paintAvatar(el) {
    if (!el) return;
    const url = getAvatar();
    el.style.backgroundImage = url ? 'url("' + url + '")' : "";
    el.textContent = url ? "" : INITIALS;
  }

  // Crops the picture to a centered square, shrinks it and returns a JPEG data URL
  function resizeToAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That file isn't a valid image."));
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = AVATAR_PX;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* =====================================================================
     Helpers
     ===================================================================== */
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const localISO = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString();
  const dAgo = (n) => localISO(new Date(Date.now() - n * 864e5)).slice(0, 10);
  const tAgo = (n, hh = "09:00") => dAgo(n) + "T" + hh;
  const nowLocal = () => localISO(new Date()).slice(0, 16);
  const labelOf = (k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  /* =====================================================================
     Table definitions (from the ER diagram)
     t: pk | text | textarea | number | money | date | datetime | select | ref
     ===================================================================== */
  const ITEM = (k = "item_id") => ({ k, t: "ref", ref: "item_master", show: "item_name", req: 1, l: "Item" });
  const WH = (k = "warehouse_id", l = "Warehouse") => ({ k, t: "ref", ref: "warehouse", show: "warehouse_name", req: 1, l });
  const PK = (k) => ({ k, t: "pk" });

  const T = {
    item_master: {
      title: "Item Master", singular: "Item", pk: "item_id",
      fields: [
        PK("item_id"),
        { k: "item_code", t: "text", req: 1 },
        { k: "item_name", t: "text", req: 1 },
        { k: "unit", t: "text", req: 1 },
        { k: "description", t: "textarea", full: 1 },
        { k: "item_type", t: "select", opts: ["Raw Material", "Finished Good"], req: 1 },
      ],
    },

    raw_material: {
      title: "Raw Materials", singular: "Raw Material", pk: "raw_material_id",
      fields: [
        PK("raw_material_id"),
        ITEM(),
        { k: "material_id", t: "number", l: "Material ID" },
        { k: "material_type", t: "text", req: 1 },
        { k: "specification", t: "textarea", full: 1 },
      ],
    },

    finished_goods: {
      title: "Finished Goods", singular: "Finished Good", pk: "finished_goods_id",
      fields: [
        PK("finished_goods_id"),
        ITEM(),
        { k: "furniture_id", t: "number", l: "Furniture ID" },
        { k: "product_name", t: "text", req: 1 },
        { k: "quantity", t: "number", req: 1, def: 0 },
        { k: "unit_price", t: "money", req: 1, def: 0 },
      ],
    },

    stock_in_out: {
      title: "Stock In/Out", singular: "Transaction", pk: "transaction_id",
      fields: [
        PK("transaction_id"),
        ITEM(),
        WH(),
        { k: "gr_id", t: "number", l: "GR No." },
        { k: "po_number", t: "number", l: "PO Number" },
        { k: "issuance_id", t: "number", l: "Issuance ID" },
        { k: "order_id", t: "number", l: "Order ID" },
        { k: "transaction_type", t: "select", opts: ["Stock In", "Stock Out"], req: 1 },
        { k: "quantity", t: "number", req: 1, min: 1 },
        { k: "transaction_date", t: "datetime", req: 1, def: "now" },
        { k: "remarks", t: "textarea", full: 1 },
      ],
    },

    stock_transfer: {
      title: "Stock Transfer", singular: "Transfer", pk: "transfer_id",
      fields: [
        PK("transfer_id"),
        ITEM(),
        WH("from_warehouse_id", "From Warehouse"),
        WH("to_warehouse_id", "To Warehouse"),
        { k: "quantity", t: "number", req: 1, min: 1 },
        { k: "transfer_date", t: "datetime", req: 1, def: "now" },
        { k: "status", t: "select", opts: ["Pending", "In Transit", "Completed", "Cancelled"], req: 1, def: "Pending" },
      ],
      validate: (r) => (r.from_warehouse_id === r.to_warehouse_id ? "From and To warehouse must be different." : ""),
    },

    stock_adjustment: {
      title: "Stock Adjustment", singular: "Adjustment", pk: "adjustment_id",
      fields: [
        PK("adjustment_id"),
        ITEM(),
        WH(),
        { k: "adjustment_quantity", t: "number", req: 1, hint: "Use a negative number to reduce stock" },
        { k: "reason", t: "textarea", full: 1, req: 1 },
        { k: "adjustment_date", t: "datetime", req: 1, def: "now" },
      ],
    },

    stock_card: {
      title: "Stock Card", singular: "Stock Card", pk: "stock_card_id",
      fields: [
        PK("stock_card_id"),
        ITEM(),
        WH(),
        { k: "beginning_balance", t: "number", req: 1, def: 0 },
        { k: "stock_in", t: "number", req: 1, def: 0 },
        { k: "stock_out", t: "number", req: 1, def: 0 },
        { k: "ending_balance", t: "number", auto: (r) => Number(r.beginning_balance) + Number(r.stock_in) - Number(r.stock_out) },
        { k: "updated_at", t: "datetime", auto: () => nowLocal() },
      ],
    },

    stock_movement: {
      title: "Stock Movement", singular: "Movement", pk: "movement_id",
      fields: [
        PK("movement_id"),
        ITEM(),
        WH(),
        { k: "movement_type", t: "select", opts: ["Stock In", "Stock Out", "Transfer", "Adjustment"], req: 1 },
        { k: "quantity", t: "number", req: 1 },
        { k: "movement_date", t: "datetime", req: 1, def: "now" },
      ],
    },

    reorder_level: {
      title: "Re-Order Level", singular: "Re-Order Level", pk: "reorder_level_id",
      fields: [
        PK("reorder_level_id"),
        ITEM(),
        { k: "reorder_quantity", t: "number", req: 1, min: 0 },
        { k: "reorder_threshold", t: "number", req: 1, min: 0 },
        { k: "updated_at", t: "datetime", auto: () => nowLocal() },
      ],
      toolbar: [{ id: "check", icon: "rule", label: "Check Levels" }],
    },

    inventory_report: {
      title: "Inventory Report", singular: "Report", addLabel: "Generate Report", pk: "report_id",
      fields: [
        PK("report_id"),
        { k: "report_type", t: "select", opts: ["Stock Summary", "Stock Movement", "Low Stock", "Inventory Valuation"], req: 1 },
        { k: "start_date", t: "date", req: 1, def: "today" },
        { k: "end_date", t: "date", req: 1, def: "today" },
        { k: "generated_date", t: "datetime", auto: (r, isNew, old) => (isNew ? nowLocal() : old.generated_date) },
        { k: "description", t: "textarea", full: 1 },
      ],
      validate: (r) => (r.end_date < r.start_date ? "End date cannot be before the start date." : ""),
    },

    low_stock_alert: {
      title: "Low Stock Alert", singular: "Alert", pk: "alert_id",
      fields: [
        PK("alert_id"),
        ITEM(),
        WH(),
        { k: "current_quantity", t: "number", req: 1 },
        { k: "alert_date", t: "datetime", req: 1, def: "now" },
        { k: "status", t: "select", opts: ["Open", "Resolved"], req: 1, def: "Open" },
      ],
      rowActions: [{ id: "resolve", icon: "check_circle", title: "Resolve alert", show: (r) => r.status === "Open" }],
    },

    warehouse: {
      title: "Warehouse", singular: "Warehouse", pk: "warehouse_id",
      fields: [
        PK("warehouse_id"),
        { k: "warehouse_name", t: "text", req: 1 },
        { k: "location", t: "text", req: 1 },
        { k: "capacity", t: "number", min: 0 },
        { k: "status", t: "select", opts: ["Active", "Inactive"], req: 1, def: "Active" },
      ],
    },

    // Not in the diagram: simple table so the Employees page has content
    employee: {
      title: "Employees", singular: "Employee", pk: "employee_id",
      fields: [
        PK("employee_id"),
        { k: "full_name", t: "text", req: 1 },
        { k: "role", t: "text", req: 1 },
        { k: "email", t: "text", req: 1 },
        { k: "status", t: "select", opts: ["Active", "Inactive"], req: 1, def: "Active" },
      ],
    },
  };

  /* =====================================================================
     Navigation
     ===================================================================== */
  const NAV = [
    { group: "Main Features", items: [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "item_master", label: "Item Master", icon: "inventory_2", table: "item_master" },
      { id: "raw_material", label: "Raw Materials", icon: "layers", table: "raw_material" },
      { id: "finished_goods", label: "Finished Goods", icon: "chair", table: "finished_goods" },
      { id: "warehouse", label: "Warehouse", icon: "warehouse", table: "warehouse" },
    ] },
    { group: "Operations", items: [
      { id: "stock_in_out", label: "Stock In/Out", icon: "swap_vert", table: "stock_in_out" },
      { id: "stock_transfer", label: "Stock Transfer", icon: "sync_alt", table: "stock_transfer" },
      { id: "stock_adjustment", label: "Stock Adjustment", icon: "tune", table: "stock_adjustment" },
      { id: "stock_card", label: "Stock Card", icon: "view_in_ar", table: "stock_card" },
      { id: "stock_movement", label: "Stock Movement", icon: "history", table: "stock_movement" },
    ] },
    { group: "Analytics", items: [
      { id: "reorder_level", label: "Re-Order Level", icon: "notifications_active", table: "reorder_level" },
      { id: "inventory_report", label: "Inventory Report", icon: "assessment", table: "inventory_report" },
      { id: "low_stock_alert", label: "Low Stock Alert", icon: "warning_amber", table: "low_stock_alert" },
    ] },
    { group: "Administrative", items: [
      { id: "employees", label: "Employees", icon: "groups", table: "employee" },
      { id: "settings", label: "Settings", icon: "settings" },
    ] },
  ];

  const ROUTES = {};
  NAV.forEach((g) => g.items.forEach((i) => (ROUTES[i.id] = i)));

  const STORE = "inventory_db_v2";
  try { localStorage.removeItem("inventory_db_v1"); } catch (e) { /* ignore */ }

  // Every table starts empty: no sample records and no history
  function seed() {
    const empty = {};
    Object.keys(T).forEach((k) => { empty[k] = []; });
    return empty;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const parsed = JSON.parse(raw);
        const base = seed();
        Object.keys(base).forEach((k) => { if (!Array.isArray(parsed[k])) parsed[k] = base[k]; });
        return parsed;
      }
    } catch (e) { /* storage unavailable: fall back to sample data */ }
    return seed();
  }

  let DB = load();

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(DB)); } catch (e) { /* ignore */ }
  }

  const nextId = (table) => DB[table].reduce((m, r) => Math.max(m, Number(r[T[table].pk]) || 0), 0) + 1;
  const findRow = (table, id) => DB[table].find((r) => String(r[T[table].pk]) === String(id));
  const nameOf = (table, id, key) => { const r = findRow(table, id); return r ? r[key] : "—"; };

  /* =====================================================================
     Cell rendering
     ===================================================================== */
  const BADGE = {
    open: "bad", pending: "warn", "in transit": "warn", cancelled: "bad", inactive: "bad",
    resolved: "ok", completed: "ok", active: "ok", "stock in": "ok", "stock out": "warn",
  };

  function cellHTML(f, v) {
    if (v === null || v === undefined || v === "") return '<span class="muted">—</span>';
    switch (f.t) {
      case "ref": {
        const r = findRow(f.ref, v);
        return esc(v) + (r ? ' <span class="muted">· ' + esc(r[f.show]) + "</span>" : "");
      }
      case "datetime": return esc(String(v).replace("T", " "));
      case "money": return "₱" + Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case "select": {
        const cls = BADGE[String(v).toLowerCase()];
        return cls || f.k === "status" ? '<span class="badge ' + (cls || "") + '">' + esc(v) + "</span>" : esc(v);
      }
      default: return esc(v);
    }
  }

  /* =====================================================================
     Views
     ===================================================================== */
  const main = $("#main");
  const state = { q: "" };

  function renderNav(activeId) {
    $("#sidebar").innerHTML =
      NAV.map((g) =>
        '<div class="nav-group-title">' + esc(g.group) + "</div>" +
        g.items.map((i) =>
          '<a class="nav-item' + (i.id === activeId ? " active" : "") + '" href="#' + i.id + '">' +
          '<span class="material-icons">' + i.icon + "</span><span>" + esc(i.label) + "</span></a>"
        ).join("")
      ).join("") +
      '<a class="logout" href="login.html"><span class="material-icons">logout</span>Log Out</a>';
  }

  function updateBell() {
    const n = DB.low_stock_alert.filter((a) => a.status === "Open").length;
    const el = $("#bellCount");
    el.textContent = n;
    el.hidden = n === 0;
  }

  function renderTablePage(route) {
    const cfg = T[route.table];
    const all = DB[route.table];
    const q = state.q.trim().toLowerCase();
    const rows = !q ? all : all.filter((r) =>
      cfg.fields.some((f) => {
        const v = r[f.k];
        if (v === null || v === undefined) return false;
        let text = String(v);
        if (f.t === "ref") text += " " + nameOf(f.ref, v, f.show);
        return text.toLowerCase().includes(q);
      })
    );

    const head = cfg.fields.map((f) => "<th>" + esc(f.l || labelOf(f.k)) + "</th>").join("") + '<th class="actions"></th>';

    const body = rows.length
      ? rows.map((r) => {
          const id = r[cfg.pk];
          const cells = cfg.fields.map((f) => {
            const html = cellHTML(f, r[f.k]);
            const raw = f.t === "ref" ? r[f.k] + " · " + nameOf(f.ref, r[f.k], f.show) : r[f.k];
            return '<td class="' + (f.t === "pk" ? "pk" : "") + '" title="' + esc(raw ?? "") + '">' + html + "</td>";
          }).join("");
          const extra = (cfg.rowActions || [])
            .filter((a) => !a.show || a.show(r))
            .map((a) => '<button class="icon-btn" data-act="' + a.id + '" data-id="' + id + '" title="' + esc(a.title) + '"><span class="material-icons">' + a.icon + "</span></button>")
            .join("");
          return "<tr>" + cells + '<td class="actions">' + extra +
            '<button class="icon-btn" data-act="edit" data-id="' + id + '" title="Edit"><span class="material-icons">edit</span></button>' +
            '<button class="icon-btn danger" data-act="delete" data-id="' + id + '" title="Delete"><span class="material-icons">delete</span></button></td></tr>';
        }).join("")
      : '<tr><td class="empty" colspan="' + (cfg.fields.length + 1) + '">' + (q ? "No records match your search." : "No records yet.") + "</td></tr>";

    const custom = (cfg.toolbar || [])
      .map((b) => '<button class="btn ghost" data-act="' + b.id + '"><span class="material-icons">' + b.icon + "</span>" + esc(b.label) + "</button>")
      .join("");

    main.innerHTML =
      '<div class="page-head"><div><h1>' + esc(cfg.title) + "</h1>" +
      '<div class="sub">' + rows.length + " of " + all.length + " records</div></div>" +
      '<div class="toolbar">' + custom +
      '<button class="btn ghost" data-act="export"><span class="material-icons">download</span>Export CSV</button>' +
      '<button class="btn" data-act="add"><span class="material-icons">add</span>' + esc(cfg.addLabel || "Add " + cfg.singular) + "</button></div></div>" +
      '<div class="card"><div class="table-wrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
  }

  function miniTable(cols, rows, emptyText) {
    if (!rows.length) return '<div class="empty">' + esc(emptyText) + "</div>";
    return '<div class="table-wrap"><table><thead><tr>' + cols.map((c) => "<th>" + esc(c[0]) + "</th>").join("") + "</tr></thead><tbody>" +
      rows.map((r) => "<tr>" + cols.map((c) => "<td>" + c[1](r) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  }

  function renderDashboard() {
    const open = DB.low_stock_alert.filter((a) => a.status === "Open");
    const pending = DB.stock_transfer.filter((t) => t.status === "Pending" || t.status === "In Transit").length;
    const units = DB.finished_goods.reduce((s, r) => s + Number(r.quantity || 0), 0);

    const stats = [
      ["Total Items", DB.item_master.length, "inventory_2", "item_master"],
      ["Raw Materials", DB.raw_material.length, "layers", "raw_material"],
      ["Finished Goods (units)", units, "chair", "finished_goods"],
      ["Warehouses", DB.warehouse.length, "warehouse", "warehouse"],
      ["Open Low Stock Alerts", open.length, "warning_amber", "low_stock_alert"],
      ["Transfers In Progress", pending, "sync_alt", "stock_transfer"],
    ];

    const recent = DB.stock_movement.slice().sort((a, b) => String(b.movement_date).localeCompare(String(a.movement_date))).slice(0, 5);

    main.innerHTML =
      '<div class="page-head"><div><h1>Dashboard</h1><div class="sub">Welcome back, ' + esc(USER.name) + "</div></div></div>" +
      '<div class="stats">' + stats.map((s) =>
        '<a class="stat" href="#' + s[3] + '"><span class="material-icons">' + s[2] + '</span><div><div class="num">' + s[1] + '</div><div class="lbl">' + esc(s[0]) + "</div></div></a>"
      ).join("") + "</div>" +
      '<div class="two-col">' +
        '<div class="card"><h2>Recent Stock Movements</h2>' + miniTable([
          ["Item", (r) => esc(nameOf("item_master", r.item_id, "item_name"))],
          ["Warehouse", (r) => esc(nameOf("warehouse", r.warehouse_id, "warehouse_name"))],
          ["Type", (r) => cellHTML({ t: "select" }, r.movement_type)],
          ["Qty", (r) => esc(r.quantity)],
          ["Date", (r) => esc(String(r.movement_date).replace("T", " "))],
        ], recent, "No movements yet.") + "</div>" +
        '<div class="card"><h2>Open Low Stock Alerts</h2>' + miniTable([
          ["Item", (r) => esc(nameOf("item_master", r.item_id, "item_name"))],
          ["Warehouse", (r) => esc(nameOf("warehouse", r.warehouse_id, "warehouse_name"))],
          ["Current Qty", (r) => esc(r.current_quantity)],
        ], open, "No open alerts. Stock levels look fine.") + "</div>" +
      "</div>";
  }

  function renderSettings() {
    main.innerHTML =
      '<div class="page-head"><div><h1>Settings</h1><div class="sub">Account and data options</div></div></div>' +
      '<div class="card" style="padding:18px;max-width:520px">' +
        '<h2 style="padding:0 0 10px">Account</h2>' +
        '<div class="profile-row">' +
          '<div class="avatar-preview" id="avatarPreview" aria-label="Profile photo" role="img"></div>' +
          "<div>" +
            '<p><strong>' + esc(USER.name) + '</strong></p><p class="muted" style="margin-bottom:10px">' + esc(USER.role) + "</p>" +
            '<input type="file" id="avatarInput" accept="image/png,image/jpeg,image/webp,image/gif" hidden />' +
            '<div class="toolbar">' +
              '<button class="btn" data-act="avatar-pick"><span class="material-icons">upload</span>Upload photo</button>' +
              (getAvatar() ? '<button class="btn ghost" data-act="avatar-remove"><span class="material-icons">delete</span>Remove</button>' : "") +
            "</div>" +
            '<p class="muted" style="font-size:.72rem;margin-top:8px">PNG & JPG format are supported</p>' +
          "</div>" +
        "</div>" +
        '<h2 style="padding:0 0 6px;margin-top:22px">Data</h2>' +
        '<p class="muted" style="font-size:.82rem;margin-bottom:12px">Erasing data removes every record and history, and all pages start empty again.</p>' +
        '<button class="btn ghost" data-act="reset"><span class="material-icons">delete_forever</span>Erase all data</button>' +
      "</div>";
    paintAvatar($("#avatarPreview"));
  }

  function render() {
    const id = (location.hash || "#dashboard").slice(1);
    const route = ROUTES[id] || ROUTES.dashboard;
    renderNav(route.id);
    updateBell();
    // the search bar only makes sense on pages that have a table
    $(".search").classList.toggle("is-hidden", route.id === "dashboard" || route.id === "settings");
    if (route.id === "dashboard") renderDashboard();
    else if (route.id === "settings") renderSettings();
    else renderTablePage(route);
    $("#app").classList.remove("nav-open");
  }

  /* =====================================================================
     Add / edit form
     ===================================================================== */
  const dlg = $("#formDialog");

  function fieldInput(f, value) {
    const id = "f_" + f.k;
    const req = f.req ? " required" : "";
    const v = value === null || value === undefined ? "" : value;
    switch (f.t) {
      case "textarea": return '<textarea id="' + id + '" name="' + f.k + '"' + req + ">" + esc(v) + "</textarea>";
      case "select":
        return '<select id="' + id + '" name="' + f.k + '"' + req + ">" +
          (f.req ? "" : '<option value=""></option>') +
          f.opts.map((o) => '<option value="' + esc(o) + '"' + (String(v) === o ? " selected" : "") + ">" + esc(o) + "</option>").join("") + "</select>";
      case "ref":
        return '<select id="' + id + '" name="' + f.k + '"' + req + '><option value="">' +
          (DB[f.ref].length ? "Select…" : "Add " + (/^[aeiou]/i.test(T[f.ref].singular) ? "an " : "a ") + T[f.ref].singular.toLowerCase() + " first") + "</option>" +
          DB[f.ref].map((r) => {
            const rid = r[T[f.ref].pk];
            return '<option value="' + rid + '"' + (String(v) === String(rid) ? " selected" : "") + ">" + esc(rid + " · " + r[f.show]) + "</option>";
          }).join("") + "</select>";
      case "number":
      case "money":
        return '<input id="' + id + '" name="' + f.k + '" type="number" step="' + (f.t === "money" ? "0.01" : "1") + '"' +
          (f.min !== undefined ? ' min="' + f.min + '"' : "") + ' value="' + esc(v) + '"' + req + " />";
      case "date": return '<input id="' + id + '" name="' + f.k + '" type="date" value="' + esc(v) + '"' + req + " />";
      case "datetime": return '<input id="' + id + '" name="' + f.k + '" type="datetime-local" value="' + esc(v) + '"' + req + " />";
      default: return '<input id="' + id + '" name="' + f.k + '" type="text" value="' + esc(v) + '"' + req + " />";
    }
  }

  function defaultFor(f) {
    if (f.def === "today") return dAgo(0);
    if (f.def === "now") return nowLocal();
    return f.def;
  }

  function openForm(table, id) {
    const cfg = T[table];
    const old = id == null ? null : findRow(table, id);
    const fields = cfg.fields.filter((f) => f.t !== "pk" && !f.auto);

    dlg.innerHTML =
      '<form id="recForm"><h3>' + (old ? "Edit " : "") + esc(old ? cfg.singular : cfg.addLabel || "Add " + cfg.singular) + "</h3>" +
      '<div class="form-grid">' + fields.map((f) =>
        '<div class="' + (f.full ? "full" : "") + '"><label for="f_' + f.k + '">' + esc(f.l || labelOf(f.k)) + (f.req ? " *" : "") + "</label>" +
        fieldInput(f, old ? old[f.k] : defaultFor(f)) +
        (f.hint ? '<div class="muted" style="font-size:.7rem;margin-top:3px">' + esc(f.hint) + "</div>" : "") + "</div>"
      ).join("") + "</div>" +
      '<p class="muted" id="formError" style="color:var(--danger);font-size:.8rem;margin-top:10px"></p>' +
      '<div class="dlg-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn">Save</button></div></form>';

    const form = $("#recForm", dlg);
    $("[data-close]", dlg).addEventListener("click", () => dlg.close());

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const rec = old ? { ...old } : {};
      fields.forEach((f) => {
        const raw = form.elements[f.k].value;
        if (f.t === "number" || f.t === "money" || f.t === "ref") rec[f.k] = raw === "" ? null : Number(raw);
        else rec[f.k] = raw.trim();
      });
      const msg = cfg.validate ? cfg.validate(rec) : "";
      if (msg) { $("#formError", dlg).textContent = msg; return; }

      cfg.fields.filter((f) => f.auto).forEach((f) => { rec[f.k] = f.auto(rec, !old, old); });

      if (old) Object.assign(old, rec);
      else { rec[cfg.pk] = nextId(table); DB[table].push(rec); }

      save();
      dlg.close();
      render();
      toast(old ? cfg.singular + " updated." : cfg.singular + " added.");
    });

    dlg.showModal();
  }

  /* =====================================================================
     Actions
     ===================================================================== */
  function usageCount(table, id) {
    let n = 0;
    Object.keys(T).forEach((t) => T[t].fields.forEach((f) => {
      if (f.t === "ref" && f.ref === table) n += DB[t].filter((r) => String(r[f.k]) === String(id)).length;
    }));
    return n;
  }

  function deleteRow(table, id) {
    const cfg = T[table];
    const used = usageCount(table, id);
    if (used > 0) {
      alert("This record is used by " + used + " other record(s) and can't be deleted.");
      return;
    }
    if (!confirm("Delete this " + cfg.singular.toLowerCase() + "? This can't be undone.")) return;
    DB[table] = DB[table].filter((r) => String(r[cfg.pk]) !== String(id));
    save();
    render();
    toast(cfg.singular + " deleted.");
  }

  function exportCSV(table) {
    const cfg = T[table];
    const cell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = [cfg.fields.map((f) => cell(f.k)).join(",")]
      .concat(DB[table].map((r) => cfg.fields.map((f) => cell(r[f.k])).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = table + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Creates a Low Stock Alert for every item whose total stock is at or below its re-order threshold
  function checkReorderLevels() {
    let created = 0;
    DB.reorder_level.forEach((r) => {
      const cards = DB.stock_card.filter((c) => c.item_id === r.item_id);
      if (!cards.length) return;
      const total = cards.reduce((s, c) => s + Number(c.ending_balance || 0), 0);
      const hasOpen = DB.low_stock_alert.some((a) => a.item_id === r.item_id && a.status === "Open");
      if (total <= Number(r.reorder_threshold) && !hasOpen) {
        DB.low_stock_alert.push({
          alert_id: nextId("low_stock_alert"), item_id: r.item_id, warehouse_id: cards[0].warehouse_id,
          current_quantity: total, alert_date: nowLocal(), status: "Open",
        });
        created++;
      }
    });
    save();
    render();
    toast(created ? created + " new low stock alert(s) created." : "All items are above their re-order thresholds.");
  }

  let toastTimer;
  function toast(msg) {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2400);
  }

  main.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    if (btn.dataset.act === "avatar-pick") {
      const input = $("#avatarInput");
      if (input) input.click();
      return;
    }
    if (btn.dataset.act === "avatar-remove") {
      setAvatar("");
      paintAvatar($("#avatar"));
      renderSettings();
      toast("Photo removed.");
      return;
    }
    if (btn.dataset.act === "reset") {
      if (confirm("Erase ALL records and history? This can't be undone.")) {
        DB = seed();
        save();
        render();
        toast("All data erased.");
      }
      return;
    }
    const route = ROUTES[(location.hash || "#dashboard").slice(1)];
    if (!route || !route.table) return;
    const table = route.table;
    const id = btn.dataset.id;

    switch (btn.dataset.act) {
      case "add": openForm(table); break;
      case "edit": openForm(table, id); break;
      case "delete": deleteRow(table, id); break;
      case "export": exportCSV(table); break;
      case "check": checkReorderLevels(); break;
      case "resolve": {
        const row = findRow(table, id);
        if (row) { row.status = "Resolved"; save(); render(); toast("Alert resolved."); }
        break;
      }
    }
  });

  /* =====================================================================
     Wire up
     ===================================================================== */
  $("#userName").textContent = USER.name;
  $("#userRole").textContent = USER.role;
  paintAvatar($("#avatar"));

  // Picking a photo in Settings
  main.addEventListener("change", async (e) => {
    if (e.target.id !== "avatarInput") return;
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("Please choose an image file."); return; }
    if (file.size > AVATAR_MAX_BYTES) { toast("That image is too big. Choose one under 8 MB."); return; }
    try {
      const url = await resizeToAvatar(file);
      if (!setAvatar(url)) { toast("Couldn't save the photo in this browser."); return; }
      paintAvatar($("#avatar"));
      renderSettings();
      toast("Profile photo updated.");
    } catch (err) {
      toast(err.message || "Couldn't use that image.");
    }
  });

  $("#globalSearch").addEventListener("input", (e) => {
    state.q = e.target.value;
    const route = ROUTES[(location.hash || "#dashboard").slice(1)];
    if (route && route.table) renderTablePage(route);
  });

  $("#bell").addEventListener("click", () => { location.hash = "#low_stock_alert"; });
  $("#menuBtn").addEventListener("click", () => $("#app").classList.toggle("nav-open"));

  window.addEventListener("hashchange", () => {
    state.q = "";
    $("#globalSearch").value = "";
    render();
  });

  render();
})();
