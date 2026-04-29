// =====================================================
// Data Layer — localStorage CRUD
// =====================================================

const DB = {
  _get: (key, def) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  _set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),

  uuid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  today: () => new Date().toISOString().split('T')[0],
  nowISO: () => new Date().toISOString(),

  // ---- Areas ----
  getAreas:   () => DB._get('areas', []),
  saveAreas:  (v) => DB._set('areas', v),
  addArea(data)    { const a = { id: DB.uuid(), ...data }; DB.saveAreas([...DB.getAreas(), a]); return a; },
  updateArea(id, data) { DB.saveAreas(DB.getAreas().map(a => a.id === id ? { ...a, ...data } : a)); },
  deleteArea(id)   { DB.saveAreas(DB.getAreas().filter(a => a.id !== id)); },

  // ---- Drivers ----
  getDrivers:   () => DB._get('drivers', []),
  saveDrivers:  (v) => DB._set('drivers', v),
  addDriver(data)    { const d = { id: DB.uuid(), ...data }; DB.saveDrivers([...DB.getDrivers(), d]); return d; },
  updateDriver(id, data) { DB.saveDrivers(DB.getDrivers().map(d => d.id === id ? { ...d, ...data } : d)); },
  deleteDriver(id)   { DB.saveDrivers(DB.getDrivers().filter(d => d.id !== id)); },
  getDriverById: (id) => DB.getDrivers().find(d => d.id === id),

  // ---- Customers ----
  getCustomers:   () => DB._get('customers', []),
  saveCustomers:  (v) => DB._set('customers', v),
  addCustomer(data) {
    const c = { id: DB.uuid(), active: true, subscriptionDays: 30, remainingDays: 30, ...data };
    DB.saveCustomers([...DB.getCustomers(), c]);
    return c;
  },
  updateCustomer(id, data) { DB.saveCustomers(DB.getCustomers().map(c => c.id === id ? { ...c, ...data } : c)); },
  deleteCustomer(id)   { DB.saveCustomers(DB.getCustomers().filter(c => c.id !== id)); },
  getCustomerById: (id) => DB.getCustomers().find(c => c.id === id),
  getCustomersByDriver: (driverId) =>
    DB.getCustomers().filter(c => c.driverId === driverId && c.active !== false),

  decrementCustomerDays(customerId) {
    const c = DB.getCustomerById(customerId);
    if (!c) return;
    const newDays = Math.max(0, (c.remainingDays ?? c.subscriptionDays ?? 0) - 1);
    DB.updateCustomer(customerId, {
      remainingDays: newDays,
      active: newDays > 0 ? (c.active !== false) : false,
    });
  },

  renewSubscription(customerId, days) {
    DB.updateCustomer(customerId, { subscriptionDays: days, remainingDays: days, active: true });
  },

  // ---- Deliveries ----
  getDeliveries:   () => DB._get('deliveries', []),
  saveDeliveries:  (v) => DB._set('deliveries', v),

  getTodayDeliveries: (driverId) =>
    DB.getDeliveries().filter(d => d.date === DB.today() && d.driverId === driverId),

  getAllTodayDeliveries: () =>
    DB.getDeliveries().filter(d => d.date === DB.today()),

  initTodayDeliveries(driverId) {
    const today = DB.today();
    const existing = DB.getDeliveries().filter(d => d.date === today && d.driverId === driverId);
    const existingIds = new Set(existing.map(d => d.customerId));
    const customers = DB.getCustomersByDriver(driverId);
    const all = DB.getDeliveries();

    customers.forEach(c => {
      if (!existingIds.has(c.id)) {
        all.push({
          id: DB.uuid(), driverId, customerId: c.id, date: today,
          status: 'pending', notes: '', deliveredAt: null, daysDecremented: false,
        });
      }
    });

    DB.saveDeliveries(all);
    return DB.getTodayDeliveries(driverId);
  },

  updateDelivery(id, data) {
    DB.saveDeliveries(DB.getDeliveries().map(d => d.id === id ? { ...d, ...data } : d));
  },

  // ---- Auth ----
  getAdminPassword: () => localStorage.getItem('adminPassword') || 'Admin@2024',
  setAdminPassword: (p) => localStorage.setItem('adminPassword', p),
};

// =====================================================
// Route Optimization — nearest-neighbor TSP
// =====================================================
function optimizeRoute(customers) {
  const hasLoc = customers.filter(c => c.location?.lat && c.location?.lng);
  const noLoc  = customers.filter(c => !c.location?.lat || !c.location?.lng);
  if (!hasLoc.length) return customers;

  const dist = (a, b) => {
    const dLat = a.lat - b.lat, dLng = a.lng - b.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  const remaining = [...hasLoc];
  const result = [];
  let cur = hasLoc[0].location;

  while (remaining.length) {
    let best = remaining[0], bestD = dist(cur, best.location);
    for (const c of remaining) {
      const d = dist(cur, c.location);
      if (d < bestD) { best = c; bestD = d; }
    }
    result.push(best);
    cur = best.location;
    remaining.splice(remaining.indexOf(best), 1);
  }

  return [...result, ...noLoc];
}

// =====================================================
// Seed Initial Data (runs once on first load)
// =====================================================
function seedInitialData() {
  if (localStorage.getItem('appInitialized')) return;

  localStorage.setItem('adminPassword', 'Admin@2024');

  const drivers = [
    { id: 'drv001', name: 'Driver 1', phone: '0501000001', areaId: '', notes: '' },
    { id: 'drv002', name: 'Driver 2', phone: '0501000002', areaId: '', notes: '' },
    { id: 'drv003', name: 'Driver 3', phone: '0501000003', areaId: '', notes: '' },
    { id: 'drv004', name: 'Driver 4', phone: '0501000004', areaId: '', notes: '' },
    { id: 'drv005', name: 'Driver 5', phone: '0501000005', areaId: '', notes: '' },
  ];
  DB.saveDrivers(drivers);

  localStorage.setItem('appInitialized', '1');
}

seedInitialData();

// =====================================================
// Shared Helpers
// =====================================================
function requireAuth(role) {
  const r = sessionStorage.getItem('role');
  if (r !== role) { window.location.href = 'index.html'; return false; }
  return true;
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.classList.remove('show'), 3200);
}

function subscriptionBadge(remaining, total) {
  if (remaining === undefined || remaining === null) return '';
  if (remaining <= 0)  return `<span class="badge badge-gray">Expired</span>`;
  if (remaining <= 3)  return `<span class="badge badge-danger">${remaining} days left</span>`;
  if (remaining <= 7)  return `<span class="badge badge-warning">${remaining} days left</span>`;
  return `<span class="badge badge-success">${remaining} days left</span>`;
}
