const DEFAULT_MENU_ITEMS = [
  { id: "idli", name: "Idli", price: 30, description: "Soft steamed idlis, price per plate." },
  { id: "vada", name: "Vada", price: 25, description: "Crisp medu vada, price per piece." },
  { id: "dosa", name: "Dosa", price: 60, description: "Classic dosa with chutney and sambar." },
  { id: "rice", name: "Rice", price: 70, description: "Steamed rice serving for meal orders." },
  { id: "biryani", name: "Biryani", price: 150, description: "Fragrant biryani tray portion." },
  { id: "curry", name: "Curry", price: 120, description: "Rich curry side dish serving." }
];

const STORAGE_KEY = "cateringOrders";
const ADMIN_SESSION_KEY = "cateringAdminSession";
const MENU_STORAGE_KEY = "cateringMenuItems";
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyEHqWu54QaauVrMoBznbki2VCFj8OQVE4supFTnULuq3jJsUv4B2_RYQp_3W4h6ItZXw/exec";
const ORDER_STATUS_OPTIONS = ["Pending", "Confirmed", "Preparing", "Delivered", "Cancelled"];

const state = {
  menuItems: [],
  quantities: {}
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function loadMenuItems() {
  try {
    const savedItems = JSON.parse(localStorage.getItem(MENU_STORAGE_KEY));
    if (Array.isArray(savedItems) && savedItems.length > 0) {
      return savedItems;
    }
  } catch {
    // Fall back to defaults below.
  }

  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(DEFAULT_MENU_ITEMS));
  return [...DEFAULT_MENU_ITEMS];
}

function saveMenuItems(items) {
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
}

function resetMenuItemForm() {
  const menuItemForm = document.getElementById("menu-item-form");
  const submitButton = document.getElementById("menu-item-submit");
  const cancelButton = document.getElementById("menu-item-cancel");
  if (!menuItemForm || !submitButton || !cancelButton) return;

  menuItemForm.reset();
  const idField = document.getElementById("menu-item-id");
  if (idField) idField.value = "";
  submitButton.textContent = "Add Menu Item";
  cancelButton.classList.add("hidden");
}

function startMenuItemEdit(itemId) {
  const item = state.menuItems.find((menuItem) => menuItem.id === itemId);
  const submitButton = document.getElementById("menu-item-submit");
  const cancelButton = document.getElementById("menu-item-cancel");
  if (!item || !submitButton || !cancelButton) return;

  const idField = document.getElementById("menu-item-id");
  const nameField = document.getElementById("menu-item-name");
  const priceField = document.getElementById("menu-item-price");
  const descriptionField = document.getElementById("menu-item-description");
  if (!idField || !nameField || !priceField || !descriptionField) return;

  idField.value = item.id;
  nameField.value = item.name;
  priceField.value = String(item.price);
  descriptionField.value = item.description;
  submitButton.textContent = "Save Changes";
  cancelButton.classList.remove("hidden");
  nameField.focus();
}

function setAdminTab(tabName) {
  const panels = {
    summary: document.getElementById("admin-tab-summary"),
    menu: document.getElementById("admin-tab-menu")
  };

  Object.entries(panels).forEach(([name, panel]) => {
    if (!panel) return;
    panel.classList.toggle("hidden", name !== tabName);
  });

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === tabName);
  });
}

function syncQuantitiesWithMenu() {
  const nextQuantities = {};
  state.menuItems.forEach((item) => {
    nextQuantities[item.id] = state.quantities[item.id] || 0;
  });
  state.quantities = nextQuantities;
}

function formatCurrency(value) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}

function getSelectedItems() {
  return state.menuItems
    .map((item) => ({
      ...item,
      quantity: state.quantities[item.id]
    }))
    .filter((item) => item.quantity > 0);
}

function getOrderTotal() {
  return getSelectedItems().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function loadOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return Array.isArray(orders)
      ? orders.map((order) => ({
        ...order,
        status: order.status || "Pending"
      }))
      : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function saveOrder(order) {
  const orders = loadOrders();
  orders.unshift({
    ...order,
    status: order.status || "Pending"
  });
  saveOrders(orders);
}

function setStatus(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `form-status ${type || ""}`.trim();
}

function renderMenu() {
  const menuGrid = document.getElementById("menu-grid");
  if (!menuGrid) return;

  if (state.menuItems.length === 0) {
    menuGrid.innerHTML = `<p class="empty-state">No menu items are available right now.</p>`;
    return;
  }

  menuGrid.innerHTML = state.menuItems.map((item) => `
    <article class="menu-card">
      <div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
      </div>
      <span class="price-tag">${formatCurrency(item.price)}</span>
      <div class="qty-control">
        <button class="qty-button" type="button" data-action="decrease" data-item-id="${item.id}" aria-label="Decrease ${item.name} quantity">-</button>
        <span class="qty-value" id="qty-${item.id}">0</span>
        <button class="qty-button" type="button" data-action="increase" data-item-id="${item.id}" aria-label="Increase ${item.name} quantity">+</button>
      </div>
    </article>
  `).join("");

  menuGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const itemId = button.dataset.itemId;
    const direction = button.dataset.action;
    const nextValue = direction === "increase"
      ? state.quantities[itemId] + 1
      : Math.max(0, state.quantities[itemId] - 1);

    state.quantities[itemId] = nextValue;
    updateOrderSummary();
  });
}

function updateOrderSummary() {
  const selectedItems = getSelectedItems();
  const total = getOrderTotal();
  const preview = document.getElementById("order-items-preview");
  const totalElement = document.getElementById("order-total");
  const countElement = document.getElementById("selected-count");

  state.menuItems.forEach((item) => {
    const qtyElement = document.getElementById(`qty-${item.id}`);
    if (qtyElement) qtyElement.textContent = state.quantities[item.id];
  });

  if (countElement) {
    const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    countElement.textContent = String(itemCount);
  }

  if (totalElement) totalElement.textContent = formatCurrency(total);

  if (!preview) return;

  if (selectedItems.length === 0) {
    preview.innerHTML = `<p class="empty-state">No items selected yet.</p>`;
    return;
  }

  preview.innerHTML = selectedItems.map((item) => `
    <div class="order-item-line">
      <span>${item.name} x ${item.quantity}</span>
      <strong>${formatCurrency(item.quantity * item.price)}</strong>
    </div>
  `).join("");
}

async function sendOrderToGoogleSheets(order) {
  return sendPayloadToGoogleSheets(order);
}

async function sendMenuToGoogleSheets(menuItems) {
  return sendPayloadToGoogleSheets({
    type: "menu_catalog",
    updatedAt: new Date().toISOString(),
    items: menuItems
  });
}

async function sendPayloadToGoogleSheets(payload) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    return { skipped: true };
  }

  let webhookUrl;
  try {
    webhookUrl = new URL(GOOGLE_SHEETS_WEBHOOK_URL);
  } catch {
    throw new Error("Invalid Google Sheets webhook URL");
  }

  const isAppsScriptWebhook = webhookUrl.hostname === "script.google.com"
    || webhookUrl.hostname === "script.googleusercontent.com";

  if (!isAppsScriptWebhook) {
    throw new Error("Google Sheets webhook URL must be a deployed Apps Script web app URL");
  }

  const iframeName = `sheets-submit-${Date.now()}`;
  const iframe = document.createElement("iframe");
  iframe.name = iframeName;
  iframe.hidden = true;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = webhookUrl.toString();
  form.target = iframeName;
  form.hidden = true;

  const payloadInput = document.createElement("input");
  payloadInput.type = "hidden";
  payloadInput.name = "payload";
  payloadInput.value = JSON.stringify(payload);
  form.appendChild(payloadInput);

  document.body.appendChild(iframe);
  document.body.appendChild(form);
  form.submit();

  window.setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 1500);

  return { skipped: false };
}

function resetOrderForm(form) {
  form.reset();
  state.menuItems.forEach((item) => {
    state.quantities[item.id] = 0;
  });
  updateOrderSummary();
}

function setupOrderPage() {
  state.menuItems = loadMenuItems();
  syncQuantitiesWithMenu();
  renderMenu();
  updateOrderSummary();

  const form = document.getElementById("order-form");
  const status = document.getElementById("form-status");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const items = getSelectedItems();

    if (items.length === 0) {
      setStatus(status, "Select at least one menu item before submitting.", "error");
      return;
    }

    const formData = new FormData(form);
    const order = {
      id: `ORD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: String(formData.get("status") || "Pending"),
      customer: {
        name: String(formData.get("name") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        postcode: String(formData.get("postcode") || "").trim(),
        eventDate: String(formData.get("eventDate") || "").trim(),
        notes: String(formData.get("notes") || "").trim()
      },
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        lineTotal: item.quantity * item.price
      })),
      total: getOrderTotal()
    };

    saveOrder(order);

    try {
      const result = await sendOrderToGoogleSheets(order);
      if (result.skipped) {
        setStatus(status, "Order saved in this browser. Add your Google Sheets webhook URL in script.js to send it online too.", "success");
      } else {
        setStatus(status, "Order submitted. It was saved locally and forwarded to Google Sheets.", "success");
      }
      resetOrderForm(form);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Order saved locally, but sending to Google Sheets failed.";
      setStatus(status, `${message} Order is still saved in this browser.`, "error");
    }
  });
}

function isAdminLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

function renderAdminMenuItems() {
  const menuList = document.getElementById("admin-menu-list");
  if (!menuList) return;

  if (state.menuItems.length === 0) {
    menuList.innerHTML = `<p class="empty-state">No menu items saved yet.</p>`;
    return;
  }

  menuList.innerHTML = state.menuItems.map((item) => `
    <article class="menu-card admin-menu-card">
      <div class="summary-line">
        <h3>${item.name}</h3>
        <strong>${formatCurrency(item.price)}</strong>
      </div>
      <p>${item.description}</p>
      <div class="admin-card-actions">
        <button class="secondary-button" type="button" data-edit-item-id="${item.id}">
          Edit Item
        </button>
        <button class="secondary-button delete-item-button" type="button" data-delete-item-id="${item.id}">
          Delete Item
        </button>
      </div>
    </article>
  `).join("");
}

function renderAdminOrders() {
  const ordersList = document.getElementById("orders-list");
  const countElement = document.getElementById("admin-order-count");
  if (!ordersList || !countElement) return;

  const orders = loadOrders();
  countElement.textContent = String(orders.length);

  if (orders.length === 0) {
    ordersList.innerHTML = `<p class="empty-state">No orders saved in this browser yet.</p>`;
    return;
  }

  ordersList.innerHTML = orders.map((order) => `
    <article class="order-card">
      <div class="summary-line">
        <h3>${order.customer.name}</h3>
        <strong>${formatCurrency(order.total)}</strong>
      </div>
      <div class="order-status-row">
        <span class="order-status-label">Confirmation status</span>
        <select class="order-status-select" data-order-id="${order.id}" aria-label="Update order status for ${order.customer.name}">
          ${ORDER_STATUS_OPTIONS.map((status) => `
            <option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>
          `).join("")}
        </select>
      </div>
      <div class="order-meta">
        <span>Order ID: ${order.id}</span>
        <span>Phone: ${order.customer.phone}</span>
        <span>Address: ${order.customer.address}</span>
        <span>Postcode: ${order.customer.postcode || "-"}</span>
        <span>Event date: ${order.customer.eventDate || "-"}</span>
        <span>Created: ${new Date(order.createdAt).toLocaleString()}</span>
      </div>
      <p>Notes: ${order.customer.notes || "No extra notes"}</p>
      <ul>
        ${order.items.map((item) => `<li>${item.name} x ${item.quantity} = ${formatCurrency(item.lineTotal)}</li>`).join("")}
      </ul>
    </article>
  `).join("");
}

function syncAdminView() {
  const loginPanel = document.getElementById("login-panel");
  const dashboardPanel = document.getElementById("dashboard-panel");
  if (!loginPanel || !dashboardPanel) return;

  if (isAdminLoggedIn()) {
    loginPanel.classList.add("hidden");
    dashboardPanel.classList.remove("hidden");
    state.menuItems = loadMenuItems();
    syncQuantitiesWithMenu();
    renderAdminMenuItems();
    renderAdminOrders();
  } else {
    loginPanel.classList.remove("hidden");
    dashboardPanel.classList.add("hidden");
  }
}

function setupAdminPage() {
  const loginForm = document.getElementById("admin-login-form");
  const loginStatus = document.getElementById("login-status");
  const logoutButton = document.getElementById("logout-button");
  const menuItemForm = document.getElementById("menu-item-form");
  const menuItemStatus = document.getElementById("menu-item-status");
  const menuList = document.getElementById("admin-menu-list");
  const cancelEditButton = document.getElementById("menu-item-cancel");
  const tabButtons = document.querySelectorAll("[data-admin-tab]");
  const ordersList = document.getElementById("orders-list");
  if (!loginForm || !logoutButton) return;

  state.menuItems = loadMenuItems();
  syncQuantitiesWithMenu();

  syncAdminView();

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = document.getElementById("admin-username")?.value.trim();
    const password = document.getElementById("admin-password")?.value.trim();

    if (username === "admin" && password === "admin123") {
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      setStatus(loginStatus, "Login successful.", "success");
      syncAdminView();
      return;
    }

    setStatus(loginStatus, "Invalid username or password.", "error");
  });

  logoutButton.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    syncAdminView();
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAdminTab(button.dataset.adminTab);
    });
  });

  menuItemForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(menuItemForm);
    const existingId = String(formData.get("id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const price = Number(formData.get("price"));

    if (!name || !description || !Number.isFinite(price) || price <= 0) {
      setStatus(menuItemStatus, "Enter a valid name, description, and price.", "error");
      return;
    }

    if (existingId) {
      state.menuItems = state.menuItems.map((item) => (
        item.id === existingId
          ? { ...item, name, price, description }
          : item
      ));
      saveMenuItems(state.menuItems);
      renderAdminMenuItems();
      try {
        await sendMenuToGoogleSheets(state.menuItems);
        setStatus(menuItemStatus, "Menu item updated and synced to Google Sheets.", "success");
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Menu item updated locally, but Google Sheets sync failed.";
        setStatus(menuItemStatus, `${message}`, "error");
      }
      resetMenuItemForm();
      return;
    }

    const baseId = slugify(name) || `item-${Date.now()}`;
    let itemId = baseId;
    let suffix = 1;
    while (state.menuItems.some((item) => item.id === itemId)) {
      itemId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    state.menuItems.push({
      id: itemId,
      name,
      price,
      description
    });
    state.quantities[itemId] = 0;
    saveMenuItems(state.menuItems);
    renderAdminMenuItems();
    try {
      await sendMenuToGoogleSheets(state.menuItems);
      setStatus(menuItemStatus, "Menu item added and synced to Google Sheets.", "success");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Menu item added locally, but Google Sheets sync failed.";
      setStatus(menuItemStatus, `${message}`, "error");
    }
    resetMenuItemForm();
  });

  cancelEditButton?.addEventListener("click", () => {
    resetMenuItemForm();
    setStatus(menuItemStatus, "", "");
  });

  menuList?.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-item-id]");
    if (editButton) {
      setAdminTab("menu");
      startMenuItemEdit(editButton.dataset.editItemId);
      setStatus(menuItemStatus, "Editing menu item.", "success");
      return;
    }

    const deleteButton = event.target.closest("[data-delete-item-id]");
    if (!deleteButton) return;

    const itemId = deleteButton.dataset.deleteItemId;
    state.menuItems = state.menuItems.filter((item) => item.id !== itemId);
    delete state.quantities[itemId];
    saveMenuItems(state.menuItems);
    renderAdminMenuItems();
    resetMenuItemForm();
    try {
      await sendMenuToGoogleSheets(state.menuItems);
      setStatus(menuItemStatus, "Menu item deleted and synced to Google Sheets.", "success");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Menu item deleted locally, but Google Sheets sync failed.";
      setStatus(menuItemStatus, `${message}`, "error");
    }
  });

  ordersList?.addEventListener("change", (event) => {
    const statusSelect = event.target.closest("[data-order-id]");
    if (!statusSelect) return;

    const orderId = statusSelect.dataset.orderId;
    const nextStatus = statusSelect.value;
    const updatedOrders = loadOrders().map((order) => (
      order.id === orderId
        ? { ...order, status: nextStatus }
        : order
    ));

    saveOrders(updatedOrders);
    renderAdminOrders();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "order") {
    setupOrderPage();
  }
  if (page === "admin") {
    setupAdminPage();
  }
});
