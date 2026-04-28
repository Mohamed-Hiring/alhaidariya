// =====================================================
// Data Layer - localStorage CRUD
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
  getAreas: () => DB._get('areas', []),
  saveAreas: (v) => DB._set('areas', v),
  addArea(data) {
    const areas = DB.getAreas();
    const area = { id: DB.uuid(), ...data };
    areas.push(area);
    DB.saveAreas(areas);
    return area;
  },
  updateArea(id, data) {
    DB.saveAreas(DB.getAreas().map(a => a.id === id ? { ...a, ...data } : a));
  },
  deleteArea(id) { DB.saveAreas(DB.getAreas().filter(a => a.id !== id)); },

  // ---- Drivers ----
  getDrivers: () => DB._get('drivers', []),
  saveDrivers: (v) => DB._set('drivers', v),
  addDriver(data) {
    const drivers = DB.getDrivers();
    const driver = { id: DB.uuid(), ...data };
    drivers.push(driver);
    DB.saveDrivers(drivers);
    return driver;
  },
  updateDriver(id, data) {
    DB.saveDrivers(DB.getDrivers().map(d => d.id === id ? { ...d, ...data } : d));
  },
  deleteDriver(id) { DB.saveDrivers(DB.getDrivers().filter(d => d.id !== id)); },
  getDriverById: (id) => DB.getDrivers().find(d => d.id === id),

  // ---- Customers ----
  getCustomers: () => DB._get('customers', []),
  saveCustomers: (v) => DB._set('customers', v),
  addCustomer(data) {
    const customers = DB.getCustomers();
    const customer = { id: DB.uuid(), active: true, ...data };
    customers.push(customer);
    DB.saveCustomers(customers);
    return customer;
  },
  updateCustomer(id, data) {
    DB.saveCustomers(DB.getCustomers().map(c => c.id === id ? { ...c, ...data } : c));
  },
  deleteCustomer(id) { DB.saveCustomers(DB.getCustomers().filter(c => c.id !== id)); },
  getCustomerById: (id) => DB.getCustomers().find(c => c.id === id),
  getCustomersByDriver: (driverId) =>
    DB.getCustomers().filter(c => c.driverId === driverId && c.active !== false),

  // ---- Deliveries ----
  getDeliveries: () => DB._get('deliveries', []),
  saveDeliveries: (v) => DB._set('deliveries', v),

  getTodayDeliveries(driverId) {
    const today = DB.today();
    return DB.getDeliveries().filter(d => d.date === today && d.driverId === driverId);
  },

  getAllTodayDeliveries() {
    const today = DB.today();
    return DB.getDeliveries().filter(d => d.date === today);
  },

  initTodayDeliveries(driverId) {
    const today = DB.today();
    const existing = DB.getDeliveries().filter(d => d.date === today && d.driverId === driverId);
    const existingIds = new Set(existing.map(d => d.customerId));
    const customers = DB.getCustomersByDriver(driverId);
    const deliveries = DB.getDeliveries();

    customers.forEach(c => {
      if (!existingIds.has(c.id)) {
        deliveries.push({
          id: DB.uuid(),
          driverId,
          customerId: c.id,
          date: today,
          status: 'pending',
          notes: '',
          deliveredAt: null,
        });
      }
    });

    DB.saveDeliveries(deliveries);
    return DB.getTodayDeliveries(driverId);
  },

  updateDelivery(id, data) {
    DB.saveDeliveries(DB.getDeliveries().map(d => d.id === id ? { ...d, ...data } : d));
  },

  // ---- Auth ----
  getAdminPassword: () => localStorage.getItem('adminPassword') || 'admin123',
  setAdminPassword: (p) => localStorage.setItem('adminPassword', p),
};

// =====================================================
// Route Optimization — nearest-neighbor TSP
// =====================================================
function optimizeRoute(customers) {
  const hasloc = customers.filter(c => c.location?.lat && c.location?.lng);
  const noloc  = customers.filter(c => !c.location?.lat || !c.location?.lng);
  if (!hasloc.length) return customers;

  const dist = (a, b) => {
    const dLat = a.lat - b.lat, dLng = a.lng - b.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  const remaining = [...hasloc];
  const result = [];
  let cur = hasloc[0].location;

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

  return [...result, ...noloc];
}

// =====================================================
// Shared helpers
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

function formatPhone(phone) {
  return phone ? phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : '';
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => el.classList.remove('show'), 3000);
}

function openGoogleMaps(lat, lng, label) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  window.open(url, '_blank');
}

function openWaze(lat, lng) {
  window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
}
