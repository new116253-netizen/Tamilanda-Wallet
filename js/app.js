
/**
 * TAMILANDA WALLET 👑 — MASTER APPLICATION LOGIC
 * Single Source of Truth for State, Accounting, and Navigation.
 * Zero DOM CSS Injection • Strict LocalStorage Architecture.
 */

(function (window, document) {
  "use strict";

  const STORAGE_KEY = "tamilanda_wallet_data";

  const DEFAULT_WALLET_DATA = {
    accounts: [],
    transactions: [],
    buyers: [],
    buyerPayments: [],
    receivables: [],
    receivablePayments: [],
    myIds: [],
    moneyToGive: [],
    givePayments: [],
    myEmis: [],
    emiPayments: [],
    recurringBills: [],
    recurringPayments: [],
    trash: [],
    categories: {
      income: ["FF Account Sale", "Business", "Salary", "Other Income"],
      expense: ["Food", "Petrol", "Shopping", "Business", "Bills", "Vehicle", "EMI", "Other Expense"]
    },
    settings: {
      currency: "INR",
      currencySymbol: "₹",
      appName: "Tamilanda Wallet"
    },
    profile: {
      name: "",
      phone: "",
      email: ""
    },
    security: {
      pinEnabled: false,
      pinConfigured: false,
      pinHash: ""
    }
  };

  /* =========================================================
     TRANSACTION TYPES
     ========================================================= */
  const INCOME_TYPES = ["income", "buyer_payment", "buyer_initial_payment", "receivable_payment"];
  const EXPENSE_TYPES = ["expense", "emi_payment", "recurring_payment", "money_to_give_payment"];
  const TRANSFER_TYPES = ["transfer"];

  const isIncomeTransaction = (t) => !!t && INCOME_TYPES.includes(String(t.type || "").toLowerCase());
  const isExpenseTransaction = (t) => !!t && EXPENSE_TYPES.includes(String(t.type || "").toLowerCase());
  const isTransferTransaction = (t) => !!t && TRANSFER_TYPES.includes(String(t.type || "").toLowerCase());

  /* =========================================================
     UTILITIES
     ========================================================= */
  const deepClone = (v) => JSON.parse(JSON.stringify(v));

  const generateId = (prefix = "id") =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const todayString = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const toAmount = (val) => {
    if (typeof val === "number") return Number.isFinite(val) ? val : 0;
    if (!val) return 0;
    const clean = String(val).replace(/[₹,\s]/g, "").replace(/[^0-9.-]/g, "");
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  };

  const formatMoney = (val) => {
    const amt = toAmount(val);
    const sym = walletData?.settings?.currencySymbol || "₹";
    return `${sym}${amt.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const escapeHtml = (val) =>
    String(val ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  /* =========================================================
     DATA STORE & MIGRATION
     ========================================================= */
  function normalizeWalletData(raw) {
    const base = deepClone(DEFAULT_WALLET_DATA);
    const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

    const res = {
      ...base,
      ...src,
      categories: { ...base.categories, ...(src.categories || {}) },
      settings: { ...base.settings, ...(src.settings || {}) },
      profile: { ...base.profile, ...(src.profile || {}) },
      security: { ...base.security, ...(src.security || {}) }
    };

    const arrayKeys = [
      "accounts", "transactions", "buyers", "buyerPayments", "receivables", "receivablePayments", "myIds",
      "moneyToGive", "givePayments", "myEmis", "emiPayments",
      "recurringBills", "recurringPayments", "trash"
    ];

    arrayKeys.forEach((key) => {
      if (!Array.isArray(res[key])) {
        // Fallbacks for older field aliases
        if (key === "myIds" && Array.isArray(src.ids)) res.myIds = src.ids;
        else if (key === "myEmis" && Array.isArray(src.emi)) res.myEmis = src.emi;
        else if (key === "moneyToGive" && Array.isArray(src.moneyBorrowed)) res.moneyToGive = src.moneyBorrowed;
        else res[key] = [];
      }
    });

    return res;
  }

  function loadWalletData() {
    try {
      let saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        const fresh = deepClone(DEFAULT_WALLET_DATA);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        return fresh;
      }

      return normalizeWalletData(JSON.parse(saved));
    } catch (e) {
      console.error("Wallet load error, falling back to defaults:", e);
      return deepClone(DEFAULT_WALLET_DATA);
    }
  }

  let walletData = loadWalletData();

  function saveWalletData() {
    try {
      walletData = normalizeWalletData(walletData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(walletData));
      return true;
    } catch (e) {
      console.error("Wallet save error:", e);
      return false;
    }
  }

  /* =========================================================
     ACCOUNT HELPERS
     ========================================================= */
  const getAccountById = (id) =>
    (walletData.accounts || []).find((a) => String(a.id) === String(id));

  const getAccountBalance = (acc) =>
    toAmount(acc?.balance ?? acc?.currentBalance ?? 0);

  function setAccountBalance(acc, bal) {
    if (!acc) return;
    const n = toAmount(bal);
    acc.balance = n;
    if (Object.prototype.hasOwnProperty.call(acc, "currentBalance")) {
      acc.currentBalance = n;
    }
  }

  function calculateTotalBalance() {
    return (walletData.accounts || []).reduce(
      (sum, a) => sum + getAccountBalance(a),
      0
    );
  }

  /* =========================================================
     ACCOUNTING & CASH FLOW
     ========================================================= */
  function calculateTodayIncome() {
    const today = todayString();
    return (walletData.transactions || [])
      .filter((t) => t.date === today && isIncomeTransaction(t))
      .reduce((sum, t) => sum + toAmount(t.amount), 0);
  }

  function calculateTodayExpense() {
    const today = todayString();
    return (walletData.transactions || [])
      .filter((t) => t.date === today && isExpenseTransaction(t))
      .reduce((sum, t) => sum + toAmount(t.amount), 0);
  }

  const calculateTodayProfit = () => calculateTodayIncome() - calculateTodayExpense();

  /* =========================================================
     CANONICAL REMAINING FORMULAS
     ========================================================= */
  function resolveEntity(col, entOrId) {
    if (!entOrId) return null;
    if (typeof entOrId === "object") return entOrId;
    return (walletData[col] || []).find((x) => String(x.id) === String(entOrId)) || null;
  }

  function sumBuyerPayments(buyerId) {
    return (walletData.buyerPayments || [])
      .filter((p) =>
        String(p.buyerId) === String(buyerId) &&
        String(p.type || "").toLowerCase() !== "buyer_initial_payment"
      )
      .reduce((sum, p) => sum + toAmount(p.amount), 0);
  }

  function sumGivePayments(giveId) {
    return (walletData.givePayments || [])
      .filter((p) => String(p.giveId) === String(giveId))
      .reduce((sum, p) => sum + toAmount(p.amount), 0);
  }

  function sumEmiPayments(emiId) {
    return (walletData.emiPayments || [])
      .filter((p) => String(p.emiId) === String(emiId))
      .reduce((sum, p) => sum + toAmount(p.amount), 0);
  }

  function sumReceivablePayments(receivableId) {
    return (walletData.receivablePayments || [])
      .filter((p) => String(p.receivableId) === String(receivableId))
      .reduce((sum, p) => sum + toAmount(p.amount), 0);
  }

  function getBuyerRemaining(buyerOrId) {
    const buyer = resolveEntity("buyers", buyerOrId);
    if (!buyer) return 0;

    const total = toAmount(buyer.totalAmount || 0);
    const initial = toAmount(buyer.initialPayment || 0);
    return Math.max(0, total - initial - sumBuyerPayments(buyer.id));
  }

  function calculateBuyerPending() {
    return (walletData.buyers || [])
      .reduce((sum, buyer) => sum + getBuyerRemaining(buyer), 0);
  }

  // Kept for existing EMI Buyers / More page compatibility.
  function calculateMoneyToReceive() {
    return calculateBuyerPending();
  }

  function getGiveRemaining(recordOrId) {
    const record = resolveEntity("moneyToGive", recordOrId);
    if (!record) return 0;

    const total = toAmount(record.totalAmount || 0);
    const alreadyPaid = toAmount(record.alreadyPaid || 0);
    return Math.max(0, total - alreadyPaid - sumGivePayments(record.id));
  }

  function calculateMoneyToGive() {
    return (walletData.moneyToGive || [])
      .reduce((sum, record) => sum + getGiveRemaining(record), 0);
  }

  function getEmiRemaining(emiOrId) {
    const emi = resolveEntity("myEmis", emiOrId);
    if (!emi) return 0;

    const total = toAmount(emi.totalAmount || 0);
    const alreadyPaid = toAmount(emi.alreadyPaid || 0);
    return Math.max(0, total - alreadyPaid - sumEmiPayments(emi.id));
  }

  function calculateEmiToPay() {
    return (walletData.myEmis || [])
      .reduce((sum, emi) => sum + getEmiRemaining(emi), 0);
  }

  function getReceivableRemaining(receivableOrId) {
    const record = resolveEntity("receivables", receivableOrId);
    if (!record) return 0;

    const total = toAmount(record.totalAmount || 0);
    const alreadyReceived = toAmount(record.alreadyReceived || 0);
    return Math.max(0, total - alreadyReceived - sumReceivablePayments(record.id));
  }

  function calculateReceivableTotal() {
    return (walletData.receivables || [])
      .reduce((sum, record) => sum + getReceivableRemaining(record), 0);
  }

  const calculateTotalAssets = () =>
    calculateTotalBalance() + calculateBuyerPending() + calculateReceivableTotal();

  const calculateTotalLiabilities = () =>
    calculateMoneyToGive() + calculateEmiToPay();

  const calculateNetWorth = () =>
    calculateTotalAssets() - calculateTotalLiabilities();

  /* =========================================================
     PERIOD ANALYTICS — SINGLE SOURCE OF TRUTH
     ========================================================= */
  function getAnalytics(period = "today") {
    const transactions = Array.isArray(walletData.transactions)
      ? walletData.transactions
      : [];

    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    let labels;
    let slots;

    if (period === "week") {
      const mondayOffset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - mondayOffset);
      labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      slots = 7;
    } else if (period === "month") {
      start.setDate(1);
      labels = ["W1", "W2", "W3", "W4", "W5", "Now"];
      slots = 6;
    } else {
      labels = ["12AM", "4AM", "8AM", "12PM", "4PM", "8PM", "Now"];
      slots = 7;
    }

    const values = Array(slots).fill(0);
    let received = 0;
    let spent = 0;

    transactions.forEach((tx) => {
      const d = new Date(
        String(tx.date || tx.createdAt || "").includes("T")
          ? tx.date || tx.createdAt
          : `${tx.date || ""}T00:00:00`
      );
      if (Number.isNaN(d.getTime()) || d < start || d > end) return;

      const amount = toAmount(tx.amount);

      if (isIncomeTransaction(tx)) {
        received += amount;
      }

      if (isExpenseTransaction(tx)) {
        spent += amount;

        let index = 0;
        if (period === "today") {
          index = Math.min(6, Math.floor(d.getHours() / 4));
        } else if (period === "week") {
          index = (d.getDay() + 6) % 7;
        } else {
          index = Math.min(5, Math.floor((d.getDate() - 1) / 7));
        }

        values[index] += amount;
      }
    });

    return {
      period,
      labels,
      values,
      received,
      spent,
      max: Math.max(1, ...values)
    };
  }

  /* =========================================================
     TRANSACTION MUTATIONS (Strictly Singular Balance Update)
     ========================================================= */
  function addTransaction(tx) {
    if (!tx) return false;
    const amt = toAmount(tx.amount);
    if (amt <= 0) return false;

    const acc = getAccountById(tx.accountId);

    if (isIncomeTransaction(tx) && acc) {
      setAccountBalance(acc, getAccountBalance(acc) + amt);
    } else if (isExpenseTransaction(tx) && acc) {
      if (amt > getAccountBalance(acc)) return false;
      setAccountBalance(acc, getAccountBalance(acc) - amt);
    }

    const newTx = {
      ...tx,
      id: tx.id || generateId("txn"),
      type: tx.type || "expense",
      amount: amt,
      accountId: tx.accountId || null,
      category: tx.category || "Other",
      description: tx.description || tx.note || "Transaction",
      note: tx.note || "",
      date: tx.date || todayString(),
      createdAt: tx.createdAt || new Date().toISOString()
    };

    walletData.transactions.unshift(newTx);
    saveWalletData();
    updateDashboard();
    return newTx;
  }

  function transferBetweenAccounts(fromId, toId, amt, note = "", date = todayString()) {
    const fromAcc = getAccountById(fromId);
    const toAcc = getAccountById(toId);
    const val = toAmount(amt);

    if (!fromAcc || !toAcc || String(fromAcc.id) === String(toAcc.id) || val <= 0) return false;
    if (val > getAccountBalance(fromAcc)) return false;

    setAccountBalance(fromAcc, getAccountBalance(fromAcc) - val);
    setAccountBalance(toAcc, getAccountBalance(toAcc) + val);

    const transferId = generateId("trf");
    const desc = note || `Transfer: ${fromAcc.name} → ${toAcc.name}`;
    const stamp = new Date().toISOString();

    walletData.transactions.unshift({
      id: generateId("txn"),
      type: "transfer",
      amount: val,
      accountId: fromAcc.id,
      fromAccountId: fromAcc.id,
      toAccountId: toAcc.id,
      transferDirection: "out",
      transferId,
      description: desc,
      note,
      date: date || todayString(),
      createdAt: stamp
    });

    walletData.transactions.unshift({
      id: generateId("txn"),
      type: "transfer",
      amount: val,
      accountId: toAcc.id,
      fromAccountId: fromAcc.id,
      toAccountId: toAcc.id,
      transferDirection: "in",
      transferId,
      description: desc,
      note,
      date: date || todayString(),
      createdAt: stamp
    });

    saveWalletData();
    updateDashboard();
    return true;
  }

  function addAccount(acc) {
    if (!acc || !acc.name) return false;
    const newAcc = {
      id: acc.id || generateId("account"),
      name: String(acc.name).trim(),
      type: acc.type || "Bank",
      balance: toAmount(acc.balance),
      note: acc.note || "",
      createdAt: acc.createdAt || new Date().toISOString()
    };
    walletData.accounts.push(newAcc);
    saveWalletData();
    updateDashboard();
    return newAcc;
  }

  function addBuyer(buyer) {
    if (!buyer || !buyer.name) return false;
    const newBuyer = {
      id: buyer.id || generateId("buyer"),
      name: String(buyer.name).trim(),
      phone: buyer.phone || "",
      ffId: buyer.ffId || "",
      totalAmount: toAmount(buyer.totalAmount),
      initialPayment: toAmount(buyer.initialPayment),
      emiDuration: buyer.emiDuration || "6",
      customDuration: Number(buyer.customDuration) || 0,
      dueDate: buyer.dueDate || "",
      notes: buyer.notes || "",
      createdAt: buyer.createdAt || new Date().toISOString()
    };
    walletData.buyers.push(newBuyer);
    saveWalletData();
    updateDashboard();
    return newBuyer;
  }

  function addReceivable(record) {
    if (!record || !String(record.name || "").trim()) return false;

    const total = toAmount(record.totalAmount);
    if (total <= 0) return false;

    const newRecord = {
      id: record.id || generateId("receivable"),
      name: String(record.name).trim(),
      phone: record.phone || "",
      totalAmount: total,
      alreadyReceived: toAmount(record.alreadyReceived),
      dueDate: record.dueDate || "",
      category: record.category || "General Receivable",
      notes: record.notes || record.note || "",
      createdAt: record.createdAt || new Date().toISOString()
    };

    walletData.receivables.push(newRecord);
    saveWalletData();
    updateDashboard();
    return newRecord;
  }

  function addReceivablePayment(receivableId, amt, accId, date = todayString(), note = "") {
    const record = resolveEntity("receivables", receivableId);
    const account = getAccountById(accId);
    const value = toAmount(amt);

    if (!record || !account || value <= 0) return false;
    if (value > getReceivableRemaining(record)) return false;

    setAccountBalance(account, getAccountBalance(account) + value);

    const paymentId = generateId("rp");
    const transactionId = generateId("txn");

    walletData.receivablePayments.unshift({
      id: paymentId,
      receivableId: record.id,
      amount: value,
      accountId: account.id,
      date: date || todayString(),
      note: note || "",
      transactionId,
      createdAt: new Date().toISOString()
    });

    walletData.transactions.unshift({
      id: transactionId,
      type: "receivable_payment",
      amount: value,
      accountId: account.id,
      receivableId: record.id,
      paymentId,
      category: "Receivable Payment",
      description: `Payment received from ${record.name}`,
      note: note || "",
      date: date || todayString(),
      createdAt: new Date().toISOString()
    });

    saveWalletData();
    updateDashboard();
    return true;
  }

  function addMyEmi(emi) {
    if (!emi || !String(emi.name || "").trim()) return false;

    const total = toAmount(emi.totalAmount);
    const monthly = toAmount(emi.monthlyPayment ?? emi.monthlyEmi);
    const months = Math.max(1, Number(emi.totalMonths ?? emi.tenureMonths ?? 12) || 12);
    const initialPayment = toAmount(emi.initialPayment);

    if (total <= 0 || monthly <= 0 || initialPayment > total) return false;

    const newEmi = {
      id: emi.id || generateId("emi"),
      name: String(emi.name).trim(),
      totalAmount: total,
      monthlyPayment: monthly,
      totalMonths: months,
      initialPayment,
      alreadyPaid: initialPayment,
      dueDate: emi.dueDate || emi.emiDate || "",
      notes: emi.notes || emi.note || "",
      createdAt: emi.createdAt || new Date().toISOString()
    };

    walletData.myEmis.push(newEmi);
    saveWalletData();
    updateDashboard();
    return newEmi;
  }

  function addEmiPayment(emiId, amt, accId, date = todayString(), note = "") {
    const emi = resolveEntity("myEmis", emiId);
    const account = getAccountById(accId);
    const value = toAmount(amt);

    if (!emi || !account || value <= 0) return false;
    if (value > getEmiRemaining(emi)) return false;
    if (value > getAccountBalance(account)) return false;

    setAccountBalance(account, getAccountBalance(account) - value);

    const paymentId = generateId("ep");
    const transactionId = generateId("txn");

    walletData.emiPayments.unshift({
      id: paymentId,
      emiId: emi.id,
      amount: value,
      accountId: account.id,
      date: date || todayString(),
      note: note || "",
      transactionId,
      createdAt: new Date().toISOString()
    });

    walletData.transactions.unshift({
      id: transactionId,
      type: "emi_payment",
      amount: value,
      accountId: account.id,
      emiId: emi.id,
      paymentId,
      category: "EMI",
      description: `EMI payment — ${emi.name}`,
      note: note || "",
      date: date || todayString(),
      createdAt: new Date().toISOString()
    });

    saveWalletData();
    updateDashboard();
    return true;
  }

  function addBuyerPayment(buyerId, amt, accId, date = todayString(), note = "") {
    const buyer = resolveEntity("buyers", buyerId);
    const acc = getAccountById(accId);
    const val = toAmount(amt);

    if (!buyer || !acc || val <= 0) return false;
    if (val > getBuyerRemaining(buyer)) return false;

    setAccountBalance(acc, getAccountBalance(acc) + val);

    const paymentId = generateId("bp");
    const txnId = generateId("txn");

    walletData.buyerPayments.unshift({
      id: paymentId,
      buyerId: buyer.id,
      amount: val,
      accountId: acc.id,
      date,
      note,
      transactionId: txnId,
      createdAt: new Date().toISOString()
    });

    walletData.transactions.unshift({
      id: txnId,
      type: "buyer_payment",
      amount: val,
      accountId: acc.id,
      buyerId: buyer.id,
      paymentId,
      category: "FF Account Sale",
      description: `Payment from ${buyer.name}`,
      note,
      date,
      createdAt: new Date().toISOString()
    });

    saveWalletData();
    updateDashboard();
    return true;
  }

  /* =========================================================
     TRASH & RESTORATION
     ========================================================= */
  function moveToTrash(col, item) {
    if (!item) return false;
    walletData.trash.unshift({
      id: generateId("trash"),
      originalCollection: col,
      data: deepClone(item),
      deletedAt: new Date().toISOString()
    });
    saveWalletData();
    return true;
  }

  function deleteRecord(col, id) {
    if (!Array.isArray(walletData[col])) return false;
    const idx = walletData[col].findIndex((x) => String(x.id) === String(id));
    if (idx === -1) return false;

    const item = walletData[col][idx];
    moveToTrash(col, item);
    walletData[col].splice(idx, 1);

    saveWalletData();
    updateDashboard();
    return true;
  }

  function restoreFromTrash(trashId) {
    const idx = walletData.trash.findIndex((t) => String(t.id) === String(trashId));
    if (idx === -1) return false;

    const item = walletData.trash[idx];
    const col = item.originalCollection;
    if (!Array.isArray(walletData[col])) return false;

    // If restoring a transaction, re-apply the ledger movement
    if (col === "transactions") {
      const tx = item.data;
      const acc = getAccountById(tx.accountId);
      const val = toAmount(tx.amount);

      if (acc) {
        if (isIncomeTransaction(tx)) {
          setAccountBalance(acc, getAccountBalance(acc) + val);
        } else if (isExpenseTransaction(tx)) {
          if (val > getAccountBalance(acc)) return false; // Prevent negative balance
          setAccountBalance(acc, getAccountBalance(acc) - val);
        }
      }
    }

    walletData[col].push(deepClone(item.data));
    walletData.trash.splice(idx, 1);

    saveWalletData();
    updateDashboard();
    return true;
  }


  /* =========================================================
     CENTRAL QUICK-ADD RECORD CREATORS
     ========================================================= */
  function addMoneyToGive(record) {
    if (!record || !String(record.name || "").trim()) return false;
    const total = toAmount(record.totalAmount ?? record.amount);
    const alreadyPaid = toAmount(record.alreadyPaid);
    if (total <= 0 || alreadyPaid < 0 || alreadyPaid > total) return false;

    const item = {
      id: record.id || generateId("give"),
      name: String(record.name).trim(),
      phone: record.phone || "",
      totalAmount: total,
      alreadyPaid,
      reason: record.reason || "",
      dueDate: record.dueDate || "",
      notes: record.notes || record.note || "",
      createdAt: record.createdAt || new Date().toISOString()
    };

    walletData.moneyToGive.push(item);
    saveWalletData();
    updateDashboard();
    return item;
  }

  function addMyId(record) {
    if (!record || !String(record.name || record.idName || "").trim()) return false;

    const name = String(record.name || record.idName).trim();
    const item = {
      id: record.id || generateId("id"),
      name,
      idName: name,
      buyPrice: toAmount(record.buyPrice ?? record.buyRate),
      sellPrice: toAmount(record.sellPrice ?? record.sellRate),
      boughtFrom: record.boughtFrom || "",
      status: record.status || "available",
      notes: record.notes || record.note || "",
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    walletData.myIds.push(item);
    saveWalletData();
    updateDashboard();
    return item;
  }

  /* =========================================================
     NAVIGATION ENGINE
     ========================================================= */
  const PAGE_MAP = {
    home: "index.html",
    myIds: "my-ids.html",
    buyers: "buyers.html",
    receivables: "receivable.html",
    accounts: "accounts.html",
    more: "more.html",
    transactions: "transactions.html",
    giveMoney: "give-money.html",
    emi: "emi.html",
    reports: "reports.html",
    netWorth: "net-worth.html",
    backup: "backup.html",
    export: "export.html",
    trash: "trash.html",
    privacy: "privacy.html",
    about: "about.html",
    profile: "profile.html",
    settings: "settings.html",
    security: "security.html",
    transfer: "transfer.html",
    quickAdd: "quick-add.html"
  };

  function getCurrentPageKey() {
    const file = (window.location.pathname || "").split("/").pop() || "index.html";
    for (const [key, path] of Object.entries(PAGE_MAP)) {
      if (path === file) return key;
    }
    return "home";
  }

  function getPageUrl(page) {
    const file = PAGE_MAP[page];
    if (!file) return null;
    const isPagesDir = /(?:^|\/)pages(?:\/|$)/i.test(window.location.pathname || "");
    const target = isPagesDir
      ? (page === "home" ? `../${file}` : file)
      : (page === "home" ? `./${file}` : `./pages/${file}`);
    return new URL(target, window.location.href).href;
  }

  function goToPage(page) {
    const url = getPageUrl(page);
    if (!url) return false;
    if (url === window.location.href) return true;
    window.location.assign(url);
    return true;
  }

  function goBack(fallback = "home") {
    if (window.history.length > 1) {
      window.history.back();
      return true;
    }
    return goToPage(fallback);
  }

  /* =========================================================
     DASHBOARD UI DISPATCHER
     ========================================================= */
  function updateDashboard() {
    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElem("totalBalance", formatMoney(calculateTotalBalance()));
    setElem("todayIncome", formatMoney(calculateTodayIncome()));
    setElem("todayExpense", formatMoney(calculateTodayExpense()));
    setElem("todayProfit", formatMoney(calculateTodayProfit()));
    setElem("moneyToReceive", formatMoney(calculateMoneyToReceive()));
    setElem("receivableTotal", formatMoney(calculateReceivableTotal()));
    setElem("moneyToGive", formatMoney(calculateMoneyToGive()));
    setElem("emiToPay", formatMoney(calculateEmiToPay()));

    // Active bottom navigation indicator sync
    const current = getCurrentPageKey();
    document.querySelectorAll(".bottom-nav [data-page]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-page") === current);
    });
  }

  // Unified global event listener for all navigation clicks
  document.addEventListener("click", (e) => {
    const item = e.target.closest(".bottom-nav [data-page]");
    if (item) {
      const p = item.getAttribute("data-page");
      if (p) {
        e.preventDefault();
        goToPage(p);
      }
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      walletData = loadWalletData();
      updateDashboard();
    }
  });

  document.addEventListener("DOMContentLoaded", updateDashboard);

  /* =========================================================
     GLOBAL API EXPORTS
     ========================================================= */
  window.TamilandaWallet = {
    getData: () => walletData,
    save: saveWalletData,
    toAmount,
    formatMoney,
    todayString,
    generateId,
    escapeHtml,
    formatDisplayDate,
    isIncomeTransaction,
    isExpenseTransaction,
    isTransferTransaction,
    calculateTotalBalance,
    calculateTodayIncome,
    calculateTodayExpense,
    calculateTodayProfit,
    calculateMoneyToReceive,
    calculateBuyerPending,
    calculateReceivableTotal,
    getReceivableRemaining,
    calculateMoneyToGive,
    calculateEmiToPay,
    calculateTotalAssets,
    calculateTotalLiabilities,
    calculateNetWorth,
    getBuyerRemaining,
    getGiveRemaining,
    getEmiRemaining,
    getAnalytics,
    addTransaction,
    addAccount,
    addBuyer,
    addBuyerPayment,
    addReceivable,
    addReceivablePayment,
    addMoneyToGive,
    addMyId,
    addMyEmi,
    addEmiPayment,
    transferBetweenAccounts,
    moveToTrash,
    deleteRecord,
    restoreFromTrash,
    updateDashboard,
    goToPage,
    goBack,
    getCurrentPageKey
  };

  window.goToPage = goToPage;
  window.goBack = goBack;
})(window, document);
