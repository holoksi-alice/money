const storageKey = "dinner-split-entries";

const form = document.getElementById("entryForm");
const dateInput = document.getElementById("date");
const totalInput = document.getElementById("total");
const mePaidInput = document.getElementById("mePaid");
const herPaidInput = document.getElementById("herPaid");
const noteInput = document.getElementById("note");
const list = document.getElementById("list");
const emptyState = document.getElementById("emptyState");
const summary = document.getElementById("summary");
const netBalance = document.getElementById("netBalance");
const netNote = document.getElementById("netNote");
const clearAllButton = document.getElementById("clearAll");
const formHint = document.getElementById("formHint");
const template = document.getElementById("itemTemplate");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

let entries = loadEntries();

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function parseAmount(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatBalance(amount) {
  if (amount > 0.009) {
    return `She owes you ${money.format(amount)}`;
  }
  if (amount < -0.009) {
    return `You owe her ${money.format(Math.abs(amount))}`;
  }
  return "Settled";
}

function renderSummary() {
  const total = entries.reduce((sum, entry) => sum + entry.total, 0);
  const mePaid = entries.reduce((sum, entry) => sum + entry.mePaid, 0);
  const herPaid = entries.reduce((sum, entry) => sum + entry.herPaid, 0);
  const myShare = total / 2;
  const myNet = mePaid - myShare;

  summary.textContent = `Total ${money.format(total)} · You paid ${money.format(mePaid)} · She paid ${money.format(herPaid)}`;
  netBalance.textContent = money.format(Math.abs(myNet));
  netNote.textContent = formatBalance(myNet);
}

function render() {
  list.innerHTML = "";

  if (entries.length === 0) {
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
  }

  entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const item = template.content.cloneNode(true);
      item.querySelector(".item-title").textContent = entry.note || "Dinner";
      item.querySelector(".item-total").textContent = money.format(entry.total);

      const meta = `Date ${entry.date} · You ${money.format(entry.mePaid)} · She ${money.format(entry.herPaid)}`;
      item.querySelector(".item-meta").textContent = meta;

      item.querySelector(".item-balance").textContent = formatBalance(entry.balance);

      const deleteButton = item.querySelector("button");
      deleteButton.addEventListener("click", () => {
        entries = entries.filter((e) => e.id !== entry.id);
        saveEntries();
        render();
      });

      list.appendChild(item);
    });

  renderSummary();
}

function resetForm() {
  dateInput.value = todayISO();
  totalInput.value = "";
  mePaidInput.value = "";
  herPaidInput.value = "";
  noteInput.value = "";
  formHint.textContent = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const total = parseAmount(totalInput.value);
  const mePaid = parseAmount(mePaidInput.value);
  const herPaid = parseAmount(herPaidInput.value);

  if (total <= 0) {
    formHint.textContent = "Total bill must be greater than 0.";
    return;
  }

  const paidSum = mePaid + herPaid;
  if (Math.abs(paidSum - total) > 0.01) {
    formHint.textContent = `Your paid amounts add up to ${money.format(paidSum)}. It should match the total.`;
    return;
  }

  const balance = mePaid - total / 2;
  const entry = {
    id: generateId(),
    date: dateInput.value || todayISO(),
    total,
    mePaid,
    herPaid,
    note: noteInput.value.trim(),
    balance,
  };

  entries.push(entry);
  saveEntries();
  render();
  resetForm();
});

clearAllButton.addEventListener("click", () => {
  if (!entries.length) return;
  const ok = confirm("Clear all dinners? This cannot be undone.");
  if (!ok) return;
  entries = [];
  saveEntries();
  render();
});

resetForm();
render();
