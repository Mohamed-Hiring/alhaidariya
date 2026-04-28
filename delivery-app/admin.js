// =====================================================
// Admin — Auth & State
// =====================================================
if (!requireAuth('admin')) throw new Error('auth');

let currentPage = 'dashboard';
let locationMap = null;
let locationMarker = null;
let selectedLocation = null;
let pendingConfirmFn = null;

// Date display
const now = new Date();
const dateStr = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
document.getElementById('topbarDate').textContent = dateStr;
document.getElementById('dashDate').textContent   = dateStr;
document.getElementById('todayFullDate').textContent = dateStr;

// =====================================================
// Navigation
// =====================================================
const pageTitles = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  drivers:   'Drivers',
  areas:     'Areas',
  today:     "Today's Deliveries",
  expiring:  'Expiring Subscriptions',
};

function showPage(page) {
  document.getElementById('page-' + currentPage).classList.add('hidden');
  document.getElementById('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + page).classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;
  currentPage = page;
  closeSidebar();

  const renders = {
    dashboard: renderDashboard,
    customers: renderCustomers,
    drivers:   renderDrivers,
    areas:     renderAreas,
    today:     renderToday,
    expiring:  renderExpiring,
  };
  renders[page]?.();
}

function openSidebar()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('show'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('show'); }

// =====================================================
// Dashboard
// =====================================================
function renderDashboard() {
  const customers  = DB.getCustomers();
  const drivers    = DB.getDrivers();
  const areas      = DB.getAreas();
  const todayDels  = DB.getAllTodayDeliveries();
  const active     = customers.filter(c => c.active !== false);
  const delivered  = todayDels.filter(d => d.status === 'delivered').length;
  const expiring   = customers.filter(c => c.active !== false && (c.remainingDays ?? c.subscriptionDays ?? 0) <= 3 && (c.remainingDays ?? c.subscriptionDays ?? 0) > 0).length;
  const expired    = customers.filter(c => (c.remainingDays ?? c.subscriptionDays ?? 99) <= 0).length;

  document.getElementById('stat-customers').textContent = active.length;
  document.getElementById('stat-drivers').textContent   = drivers.length;
  document.getElementById('stat-delivered').textContent = delivered;
  document.getElementById('stat-expiring').textContent  = expiring + expired;

  // Nav counts
  const custCount = active.length;
  const drvCount  = drivers.length;
  const expCount  = expiring + expired;

  setNavCount('nav-customers-count', custCount);
  setNavCount('nav-drivers-count', drvCount);
  setNavCount('nav-expiring-count', expCount);

  // Per-driver overview
  const container = document.getElementById('todayOverview');
  if (!drivers.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No drivers added yet</p></div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:.75rem">';
  drivers.forEach(driver => {
    const driverCs  = customers.filter(c => c.driverId === driver.id && c.active !== false);
    const driverDs  = todayDels.filter(d => d.driverId === driver.id);
    const done      = driverDs.filter(d => d.status === 'delivered').length;
    const fail      = driverDs.filter(d => d.status === 'failed').length;
    const total     = driverCs.length;
    const pct       = total > 0 ? Math.round((done / total) * 100) : 0;
    const area      = areas.find(a => a.id === driver.areaId);

    html += `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:.9rem">
        <div class="flex items-center justify-between gap-2" style="margin-bottom:.6rem">
          <div class="flex items-center gap-2">
            <div class="avatar">${driver.name[0]}</div>
            <div>
              <div style="font-weight:700">${driver.name}</div>
              <div class="text-sm text-muted">${area ? area.name : 'No area'}</div>
            </div>
          </div>
          <div class="flex gap-1 flex-wrap">
            <span class="badge badge-success"><i class="fas fa-check"></i> ${done}</span>
            ${fail ? `<span class="badge badge-danger"><i class="fas fa-times"></i> ${fail}</span>` : ''}
            <span class="badge badge-gray">${total} total</span>
          </div>
        </div>
        <div style="background:var(--border);border-radius:99px;height:7px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:99px;transition:width .3s ease"></div>
        </div>
        <div class="text-xs text-muted" style="margin-top:.3rem">${pct}% complete</div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function setNavCount(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) { el.textContent = count; el.style.display = ''; }
  else el.style.display = 'none';
}

// =====================================================
// Customers
// =====================================================
function renderCustomers() {
  populateCustomerFilters();
  const search  = (document.getElementById('customerSearch').value || '').toLowerCase();
  const dFilter = document.getElementById('customerFilterDriver').value;
  const aFilter = document.getElementById('customerFilterArea').value;
  const sFilter = document.getElementById('customerFilterStatus').value;

  let customers = DB.getCustomers();
  if (search)  customers = customers.filter(c => c.name.toLowerCase().includes(search) || (c.phone||'').includes(search));
  if (dFilter) customers = customers.filter(c => c.driverId === dFilter);
  if (aFilter) customers = customers.filter(c => c.areaId === aFilter);
  if (sFilter === 'active')   customers = customers.filter(c => c.active !== false && (c.remainingDays ?? 1) > 0);
  if (sFilter === 'inactive') customers = customers.filter(c => c.active === false || (c.remainingDays ?? 1) <= 0);
  if (sFilter === 'expiring') customers = customers.filter(c => {
    const r = c.remainingDays ?? c.subscriptionDays ?? 0;
    return r > 0 && r <= 7;
  });

  const drivers = DB.getDrivers();
  const areas   = DB.getAreas();
  const body  = document.getElementById('customersBody');
  const empty = document.getElementById('customersEmpty');

  if (!customers.length) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  body.innerHTML = customers.map(c => {
    const driver  = drivers.find(d => d.id === c.driverId);
    const area    = areas.find(a => a.id === c.areaId);
    const hasLoc  = c.location?.lat && c.location?.lng;
    const rem     = c.remainingDays ?? c.subscriptionDays ?? 0;
    const total   = c.subscriptionDays || 1;
    const pct     = Math.min(100, Math.round((rem / total) * 100));
    const barClass = rem <= 3 ? 'low' : rem <= 7 ? 'medium' : 'high';

    return `<tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar" style="width:30px;height:30px;font-size:.8rem">${c.name[0]}</div>
          <div>
            <div style="font-weight:600">${c.name}</div>
            ${c.address ? `<div class="text-xs text-muted">${c.address}</div>` : ''}
          </div>
        </div>
      </td>
      <td><a href="tel:${c.phone}" style="color:var(--info)">${c.phone || '—'}</a></td>
      <td>${area ? area.name : '<span class="text-muted">—</span>'}</td>
      <td>${driver ? driver.name : '<span class="text-muted">—</span>'}</td>
      <td style="min-width:140px">
        <div style="font-size:.8rem;font-weight:600;margin-bottom:.25rem">
          ${rem} / ${c.subscriptionDays || '?'} days
        </div>
        <div class="sub-bar-wrap">
          <div class="sub-bar-fill ${barClass}" style="width:${pct}%"></div>
        </div>
        <div style="margin-top:.3rem">${subscriptionBadge(rem, total)}</div>
      </td>
      <td>
        ${hasLoc
          ? `<span class="badge badge-success"><i class="fas fa-map-marker-alt"></i> Pinned</span>`
          : `<span class="badge badge-warning"><i class="fas fa-exclamation"></i> Not set</span>`}
      </td>
      <td>
        ${c.active !== false && rem > 0
          ? `<span class="badge badge-success">Active</span>`
          : `<span class="badge badge-gray">Inactive</span>`}
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm" onclick="openCustomerModal('${c.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-warning btn-sm" onclick="openRenewModal('${c.id}')" title="Renew subscription">
            <i class="fas fa-sync"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('customer','${c.id}','${c.name}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateCustomerFilters() {
  const dSel = document.getElementById('customerFilterDriver');
  const aSel = document.getElementById('customerFilterArea');
  const dVal = dSel.value, aVal = aSel.value;

  dSel.innerHTML = '<option value="">All Drivers</option>' +
    DB.getDrivers().map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  aSel.innerHTML = '<option value="">All Areas</option>' +
    DB.getAreas().map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  dSel.value = dVal;
  aSel.value = aVal;
}

// ---- Customer Modal ----
function openCustomerModal(id) {
  clearCustomerForm();
  populateAreaDriverDropdowns();
  document.getElementById('customerModal').classList.remove('hidden');

  if (id) {
    const c = DB.getCustomerById(id);
    if (!c) return;
    document.getElementById('customerModalTitle').textContent = 'Edit Customer';
    document.getElementById('customerId').value      = c.id;
    document.getElementById('customerName').value    = c.name || '';
    document.getElementById('customerPhone').value   = c.phone || '';
    document.getElementById('customerAddress').value = c.address || '';
    document.getElementById('customerArea').value    = c.areaId || '';
    document.getElementById('customerDriver').value  = c.driverId || '';
    document.getElementById('customerNotes').value   = c.notes || '';
    document.getElementById('customerActive').checked = c.active !== false;
    document.getElementById('customerSubDays').value = c.subscriptionDays ?? 30;
    document.getElementById('customerRemDays').value = c.remainingDays ?? c.subscriptionDays ?? 30;

    if (c.location?.lat) {
      selectedLocation = c.location;
      updateCoordsDisplay(c.location.lat, c.location.lng);
    }
  }

  setTimeout(initLocationMap, 100);
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.add('hidden');
  if (locationMap) { locationMap.remove(); locationMap = null; locationMarker = null; }
  selectedLocation = null;
}

function clearCustomerForm() {
  ['customerId','customerName','customerPhone','customerAddress','customerNotes','locationSearch'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('customerArea').value    = '';
  document.getElementById('customerDriver').value  = '';
  document.getElementById('customerActive').checked = true;
  document.getElementById('customerSubDays').value = 30;
  document.getElementById('customerRemDays').value = 30;
  document.getElementById('customerModalTitle').textContent = 'Add New Customer';
  document.getElementById('coordsText').textContent = 'No location set — click on the map to pin';
  selectedLocation = null;
}

function populateAreaDriverDropdowns() {
  document.getElementById('customerArea').innerHTML =
    '<option value="">-- Select area --</option>' +
    DB.getAreas().map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  filterDriversByArea();
}

function onAreaChange() { filterDriversByArea(); }

function filterDriversByArea() {
  const areaId  = document.getElementById('customerArea').value;
  const drivers = areaId ? DB.getDrivers().filter(d => d.areaId === areaId) : DB.getDrivers();
  document.getElementById('customerDriver').innerHTML =
    '<option value="">-- Select driver --</option>' +
    drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

function saveCustomer() {
  const name  = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  if (!name)  { toast('Please enter customer name', 'error'); return; }
  if (!phone) { toast('Please enter phone number', 'error'); return; }

  const subDays = parseInt(document.getElementById('customerSubDays').value) || 30;
  const remDays = parseInt(document.getElementById('customerRemDays').value) ?? subDays;

  const data = {
    name, phone,
    address:  document.getElementById('customerAddress').value.trim(),
    areaId:   document.getElementById('customerArea').value,
    driverId: document.getElementById('customerDriver').value,
    notes:    document.getElementById('customerNotes').value.trim(),
    active:   document.getElementById('customerActive').checked,
    subscriptionDays: subDays,
    remainingDays:    remDays,
    location: selectedLocation || null,
  };

  const id = document.getElementById('customerId').value;
  if (id) { DB.updateCustomer(id, data); toast('Customer updated'); }
  else    { DB.addCustomer(data); toast('Customer added'); }

  closeCustomerModal();
  renderCustomers();
  renderDashboard();
}

// ---- Renew Subscription Modal ----
function openRenewModal(customerId) {
  const c = DB.getCustomerById(customerId);
  if (!c) return;
  document.getElementById('renewCustomerId').value = customerId;
  document.getElementById('renewCustomerName').textContent = c.name;
  document.getElementById('renewDays').value = c.subscriptionDays || 30;
  document.getElementById('renewModal').classList.remove('hidden');
}

function closeRenewModal() { document.getElementById('renewModal').classList.add('hidden'); }

function saveRenew() {
  const id   = document.getElementById('renewCustomerId').value;
  const days = parseInt(document.getElementById('renewDays').value);
  if (!days || days < 1) { toast('Enter valid number of days', 'error'); return; }
  DB.renewSubscription(id, days);
  toast(`Subscription renewed — ${days} days`, 'success');
  closeRenewModal();
  renderCustomers();
  renderDashboard();
  renderExpiring();
}

// ---- Location Map ----
function initLocationMap() {
  if (locationMap) locationMap.remove();
  const lat = selectedLocation?.lat || 24.7136;
  const lng = selectedLocation?.lng || 46.6753;

  locationMap = L.map('locationMap').setView([lat, lng], selectedLocation ? 15 : 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19,
  }).addTo(locationMap);

  if (selectedLocation) {
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', e => {
      const p = e.target.getLatLng();
      selectedLocation = { lat: p.lat, lng: p.lng };
      updateCoordsDisplay(p.lat, p.lng);
    });
  }

  locationMap.on('click', e => {
    const { lat, lng } = e.latlng;
    selectedLocation = { lat, lng };
    updateCoordsDisplay(lat, lng);
    if (locationMarker) locationMarker.remove();
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', ev => {
      const p = ev.target.getLatLng();
      selectedLocation = { lat: p.lat, lng: p.lng };
      updateCoordsDisplay(p.lat, p.lng);
    });
  });
}

function updateCoordsDisplay(lat, lng) {
  document.getElementById('coordsText').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function searchLocation() {
  const q = document.getElementById('locationSearch').value.trim();
  if (!q) return;
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
    const data = await res.json();
    if (data.length) {
      const { lat, lon } = data[0];
      locationMap.setView([lat, lon], 16);
      if (locationMarker) locationMarker.remove();
      selectedLocation = { lat: parseFloat(lat), lng: parseFloat(lon) };
      locationMarker = L.marker([lat, lon], { draggable: true }).addTo(locationMap);
      locationMarker.on('dragend', e => {
        const p = e.target.getLatLng();
        selectedLocation = { lat: p.lat, lng: p.lng };
        updateCoordsDisplay(p.lat, p.lng);
      });
      updateCoordsDisplay(parseFloat(lat), parseFloat(lon));
    } else {
      toast('Location not found', 'warning');
    }
  } catch { toast('Search failed', 'error'); }
}

// =====================================================
// Drivers
// =====================================================
function renderDrivers() {
  const drivers   = DB.getDrivers();
  const customers = DB.getCustomers();
  const areas     = DB.getAreas();
  const body  = document.getElementById('driversBody');
  const empty = document.getElementById('driversEmpty');

  if (!drivers.length) { body.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  body.innerHTML = drivers.map(d => {
    const area  = areas.find(a => a.id === d.areaId);
    const count = customers.filter(c => c.driverId === d.id && c.active !== false).length;
    return `<tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar" style="width:30px;height:30px;font-size:.8rem">${d.name[0]}</div>
          <span style="font-weight:600">${d.name}</span>
        </div>
      </td>
      <td><a href="tel:${d.phone}" style="color:var(--info)">${d.phone || '—'}</a></td>
      <td>${area ? area.name : '<span class="text-muted">—</span>'}</td>
      <td><span class="badge badge-success">${count} customers</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm" onclick="openDriverModal('${d.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('driver','${d.id}','${d.name}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openDriverModal(id) {
  document.getElementById('driverId').value    = '';
  document.getElementById('driverName').value  = '';
  document.getElementById('driverPhone').value = '';
  document.getElementById('driverArea').innerHTML =
    '<option value="">-- Select area --</option>' +
    DB.getAreas().map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  document.getElementById('driverModalTitle').textContent = 'Add Driver';
  document.getElementById('driverModal').classList.remove('hidden');

  if (id) {
    const d = DB.getDrivers().find(x => x.id === id);
    if (!d) return;
    document.getElementById('driverModalTitle').textContent = 'Edit Driver';
    document.getElementById('driverId').value    = d.id;
    document.getElementById('driverName').value  = d.name || '';
    document.getElementById('driverPhone').value = d.phone || '';
    document.getElementById('driverArea').value  = d.areaId || '';
  }
}

function closeDriverModal() { document.getElementById('driverModal').classList.add('hidden'); }

function saveDriver() {
  const name  = document.getElementById('driverName').value.trim();
  const phone = document.getElementById('driverPhone').value.trim();
  if (!name)  { toast('Please enter driver name', 'error'); return; }
  if (!phone) { toast('Please enter phone number', 'error'); return; }

  const data = { name, phone, areaId: document.getElementById('driverArea').value };
  const id   = document.getElementById('driverId').value;
  if (id) { DB.updateDriver(id, data); toast('Driver updated'); }
  else    { DB.addDriver(data); toast('Driver added'); }

  closeDriverModal();
  renderDrivers();
  renderDashboard();
}

// =====================================================
// Areas
// =====================================================
function renderAreas() {
  const areas     = DB.getAreas();
  const drivers   = DB.getDrivers();
  const customers = DB.getCustomers();
  const body  = document.getElementById('areasBody');
  const empty = document.getElementById('areasEmpty');

  if (!areas.length) { body.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  body.innerHTML = areas.map(a => {
    const dCount = drivers.filter(d => d.areaId === a.id).length;
    const cCount = customers.filter(c => c.areaId === a.id).length;
    return `<tr>
      <td style="font-weight:600">${a.name}</td>
      <td><span class="badge badge-info">${dCount} drivers</span></td>
      <td><span class="badge badge-success">${cCount} customers</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm" onclick="openAreaModal('${a.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('area','${a.id}','${a.name}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAreaModal(id) {
  document.getElementById('areaId').value   = '';
  document.getElementById('areaName').value = '';
  document.getElementById('areaModalTitle').textContent = 'Add Area';
  document.getElementById('areaModal').classList.remove('hidden');

  if (id) {
    const a = DB.getAreas().find(x => x.id === id);
    if (!a) return;
    document.getElementById('areaModalTitle').textContent = 'Edit Area';
    document.getElementById('areaId').value   = a.id;
    document.getElementById('areaName').value = a.name || '';
  }
}

function closeAreaModal() { document.getElementById('areaModal').classList.add('hidden'); }

function saveArea() {
  const name = document.getElementById('areaName').value.trim();
  if (!name) { toast('Please enter area name', 'error'); return; }
  const id = document.getElementById('areaId').value;
  if (id) { DB.updateArea(id, { name }); toast('Area updated'); }
  else    { DB.addArea({ name }); toast('Area added'); }
  closeAreaModal();
  renderAreas();
  renderDashboard();
}

// =====================================================
// Today's Deliveries
// =====================================================
function renderToday() {
  const drivers   = DB.getDrivers();
  const todayDels = DB.getAllTodayDeliveries();
  const customers = DB.getCustomers();
  const container = document.getElementById('todayContent');

  if (!drivers.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No drivers added</p></div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:1.5rem">';
  drivers.forEach(driver => {
    const activeCs   = DB.getCustomersByDriver(driver.id);
    if (!activeCs.length) return;
    const driverDels = todayDels.filter(d => d.driverId === driver.id);
    const done = driverDels.filter(d => d.status === 'delivered').length;
    const fail = driverDels.filter(d => d.status === 'failed').length;
    const pend = activeCs.length - done - fail;
    const area = DB.getAreas().find(a => a.id === driver.areaId);

    html += `
      <div>
        <div class="flex items-center gap-2" style="margin-bottom:.6rem">
          <div class="avatar">${driver.name[0]}</div>
          <div>
            <strong>${driver.name}</strong>
            ${area ? `<span class="text-sm text-muted"> — ${area.name}</span>` : ''}
          </div>
          <div class="flex gap-1 ml-auto flex-wrap">
            <span class="badge badge-success">${done} done</span>
            ${fail ? `<span class="badge badge-danger">${fail} failed</span>` : ''}
            <span class="badge badge-warning">${pend} pending</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.3rem">
          ${activeCs.map((c, i) => {
            const del    = driverDels.find(d => d.customerId === c.id);
            const status = del?.status || 'pending';
            const rem    = c.remainingDays ?? c.subscriptionDays ?? 0;
            const badge  = { delivered: '<span class="badge badge-success">✓ Delivered</span>', failed: '<span class="badge badge-danger">✕ Failed</span>', pending: '<span class="badge badge-warning">⏳ Pending</span>' }[status] || '';
            return `
              <div class="flex items-center gap-2" style="padding:.5rem .75rem;background:var(--bg);border-radius:var(--radius-sm)">
                <span class="text-muted text-sm" style="width:20px">${i+1}</span>
                <div style="flex:1">
                  <span style="font-weight:600">${c.name}</span>
                  ${c.address ? `<span class="text-sm text-muted"> — ${c.address}</span>` : ''}
                  ${del?.notes ? `<div class="text-xs text-muted">Note: ${del.notes}</div>` : ''}
                </div>
                ${subscriptionBadge(rem)}
                ${badge}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// =====================================================
// Expiring Subscriptions
// =====================================================
function renderExpiring() {
  const customers = DB.getCustomers().filter(c => {
    const rem = c.remainingDays ?? c.subscriptionDays ?? 99;
    return rem <= 7;
  }).sort((a, b) => (a.remainingDays ?? 0) - (b.remainingDays ?? 0));

  const drivers = DB.getDrivers();
  const body  = document.getElementById('expiringBody');
  const empty = document.getElementById('expiringEmpty');

  if (!customers.length) { body.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  body.innerHTML = customers.map(c => {
    const driver = drivers.find(d => d.id === c.driverId);
    const rem    = c.remainingDays ?? c.subscriptionDays ?? 0;
    return `<tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar" style="width:28px;height:28px;font-size:.75rem">${c.name[0]}</div>
          <span style="font-weight:600">${c.name}</span>
        </div>
      </td>
      <td><a href="tel:${c.phone}" style="color:var(--info)">${c.phone || '—'}</a></td>
      <td>${driver ? driver.name : '—'}</td>
      <td>${subscriptionBadge(rem)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="openRenewModal('${c.id}')">
          <i class="fas fa-sync"></i> Renew
        </button>
      </td>
    </tr>`;
  }).join('');
}

// =====================================================
// Confirm Delete
// =====================================================
function confirmDelete(type, id, name) {
  const labels = { customer: 'customer', driver: 'driver', area: 'area' };
  document.getElementById('confirmMsg').textContent =
    `Are you sure you want to delete ${labels[type]} "${name}"? This cannot be undone.`;
  pendingConfirmFn = () => {
    if (type === 'customer') { DB.deleteCustomer(id); renderCustomers(); }
    if (type === 'driver')   { DB.deleteDriver(id);   renderDrivers(); }
    if (type === 'area')     { DB.deleteArea(id);      renderAreas(); }
    renderDashboard();
    toast('Deleted successfully');
  };
  document.getElementById('confirmModal').classList.remove('hidden');
}

function confirmAction() { if (pendingConfirmFn) pendingConfirmFn(); closeConfirm(); }
function closeConfirm()  { document.getElementById('confirmModal').classList.add('hidden'); pendingConfirmFn = null; }

// Close on overlay click / Escape
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o) {
      closeCustomerModal(); closeDriverModal(); closeAreaModal(); closeConfirm(); closeRenewModal();
    }
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCustomerModal(); closeDriverModal(); closeAreaModal(); closeConfirm(); closeRenewModal();
  }
});

// =====================================================
// Init
// =====================================================
renderDashboard();
