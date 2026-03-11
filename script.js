const MENU_ITEMS = [
  { id: "idli", name: "Idli", price: 30, description: "Soft steamed idlis, price per plate." },
  { id: "vada", name: "Vada", price: 25, description: "Crisp medu vada, price per piece." },
  { id: "dosa", name: "Dosa", price: 60, description: "Classic dosa with chutney and sambar." },
  { id: "rice", name: "Rice", price: 70, description: "Steamed rice serving for meal orders." },
  { id: "biryani", name: "Biryani", price: 150, description: "Fragrant biryani tray portion." },
  { id: "curry", name: "Curry", price: 120, description: "Rich curry side dish serving." }
];

const STORAGE_KEY = "cateringOrders";
const ADMIN_SESSION_KEY = "cateringAdminSession";
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyEHqWu54QaauVrMoBznbki2VCFj8OQVE4supFTnULuq3jJsUv4B2_RYQp_3W4h6ItZXw/exec";

const state = {
  quantities: Object.fromEntries(MENU_ITEMS.map((item) => [item.id, 0]))
};

function formatCurrency(value) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}

function getSelectedItems() {
  return MENU_ITEMS
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
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveOrder(order) {
  const orders = loadOrders();
  orders.unshift(order);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function setStatus(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `form-status ${type || ""}`.trim();
}

function renderMenu() {
  const menuGrid = document.getElementById("menu-grid");
  if (!menuGrid) return;

  menuGrid.innerHTML = MENU_ITEMS.map((item) => `
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

  MENU_ITEMS.forEach((item) => {
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
  payloadInput.value = JSON.stringify(order);
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
  MENU_ITEMS.forEach((item) => {
    state.quantities[item.id] = 0;
  });
  updateOrderSummary();
}

function setupOrderPage() {
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
  if (!loginForm || !logoutButton) return;

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
