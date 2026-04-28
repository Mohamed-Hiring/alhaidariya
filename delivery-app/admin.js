// =====================================================
// Admin - Auth & Layout
// =====================================================
if (!requireAuth('admin')) throw new Error('auth');

let currentPage = 'dashboard';
let locationMap = null;
let locationMarker = null;
let selectedLocation = null;
let pendingConfirmFn = null;

// Date display
const now = new Date();
const dateStr = now.toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
document.getElementById('todayDate').textContent = dateStr;
document.getElementById('todayDateBadge').textContent = dateStr;
document.getElementById('todayFullDate').textContent = dateStr;

// =====================================================
// Navigation
// =====================================================
function showPage(page) {
  document.getElementById('page-' + currentPage).classList.add('hidden');
  document.getElementById('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + page).classList.add('active');

  const titles = {
    dashboard: 'لوحة التحكم',
    customers: 'الكستمرز',
    drivers: 'الدرايفرز',
    areas: 'المناطق',
    today: 'توصيل اليوم',
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  currentPage = page;
  closeSidebar();

  if (page === 'dashboard') renderDashboard();
  if (page === 'customers') renderCustomers();
  if (page === 'drivers') renderDrivers();
  if (page === 'areas') renderAreas();
  if (page === 'today') renderToday();
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// =====================================================
// Dashboard
// =====================================================
function renderDashboard() {
  const customers = DB.getCustomers();
  const drivers   = DB.getDrivers();
  const areas     = DB.getAreas();
  const todayDels = DB.getAllTodayDeliveries();

  const activeCustomers = customers.filter(c => c.active !== false);
  const delivered = todayDels.filter(d => d.status === 'delivered').length;

  document.getElementById('stat-customers').textContent = activeCustomers.length;
  document.getElementById('stat-drivers').textContent   = drivers.length;
  document.getElementById('stat-areas').textContent     = areas.length;
  document.getElementById('stat-delivered').textContent = delivered;
  document.getElementById('nav-customers-count').textContent = activeCustomers.length || '';
  document.getElementById('nav-drivers-count').textContent   = drivers.length || '';

  // Today overview per driver
  const container = document.getElementById('todayOverview');
  if (!drivers.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>لا يوجد درايفرز</p></div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:.75rem">';
  drivers.forEach(driver => {
    const driverCustomers = customers.filter(c => c.driverId === driver.id && c.active !== false);
    const driverDels = todayDels.filter(d => d.driverId === driver.id);
    const doneCount = driverDels.filter(d => d.status === 'delivered').length;
    const failCount = driverDels.filter(d => d.status === 'failed').length;
    const total = driverCustomers.length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const area = DB.getAreas().find(a => a.id === driver.areaId);
    html += `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem">
        <div class="flex items-center justify-between gap-2" style="margin-bottom:.6rem">
          <div class="flex items-center gap-2">
            <div class="avatar">${driver.name[0]}</div>
            <div>
              <div style="font-weight:700">${driver.name}</div>
              <div class="text-sm text-muted">${area ? area.name : 'بدون منطقة'}</div>
            </div>
          </div>
          <div class="flex gap-1">
            <span class="badge badge-success"><i class="fas fa-check"></i> ${doneCount}</span>
            ${failCount ? `<span class="badge badge-danger"><i class="fas fa-times"></i> ${failCount}</span>` : ''}
            <span class="badge badge-gray">${total} إجمالي</span>
          </div>
        </div>
        <div class="progress-bar-wrap" style="background:var(--border);height:8px">
          <div class="progress-bar-fill" style="width:${pct}%;background:var(--primary)"></div>
        </div>
        <div class="text-xs text-muted" style="margin-top:.3rem">${pct}% مكتمل</div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// =====================================================
// Customers
// =====================================================
function renderCustomers() {
  populateCustomerFilters();
  const search   = (document.getElementById('customerSearch').value || '').toLowerCase();
  const dFilter  = document.getElementById('customerFilterDriver').value;
  const aFilter  = document.getElementById('customerFilterArea').value;

  let customers = DB.getCustomers();
  if (search)  customers = customers.filter(c => c.name.toLowerCase().includes(search) || (c.phone||'').includes(search));
  if (dFilter) customers = customers.filter(c => c.driverId === dFilter);
  if (aFilter) customers = customers.filter(c => c.areaId === aFilter);

  const drivers = DB.getDrivers();
  const areas   = DB.getAreas();

  const body = document.getElementById('customersBody');
  const empty = document.getElementById('customersEmpty');

  if (!customers.length) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  body.innerHTML = customers.map(c => {
    const driver = drivers.find(d => d.id === c.driverId);
    const area   = areas.find(a => a.id === c.areaId);
    const hasLoc = c.location?.lat && c.location?.lng;
    return `<tr>
      <td>
        <div class="flex items-center gap-2">
          <div class="avatar" style="width:30px;height:30px;font-size:.8rem">${c.name[0]}</div>
          <div>
            <div style="font-weight:600">${c.name}</div>
            ${c.notes ? `<div class="text-xs text-muted">${c.notes}</div>` : ''}
          </div>
        </div>
      </td>
      <td><a href="tel:${c.phone}" style="color:var(--info)">${c.phone || '—'}</a></td>
      <td>${area ? area.name : '<span class="text-muted">—</span>'}</td>
      <td>${driver ? driver.name : '<span class="text-muted">—</span>'}</td>
      <td>
        ${hasLoc
          ? `<span class="badge badge-success"><i class="fas fa-map-marker-alt"></i> محدد</span>`
          : `<span class="badge badge-warning"><i class="fas fa-exclamation"></i> غير محدد</span>`}
      </td>
      <td>
        ${c.active !== false
          ? `<span class="badge badge-success">نشط</span>`
          : `<span class="badge badge-gray">غير نشط</span>`}
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm" onclick="editCustomer('${c.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('customer','${c.id}','${c.name}')">
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

  dSel.innerHTML = '<option value="">كل الدرايفرز</option>' +
    DB.getDrivers().map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  aSel.innerHTML = '<option value="">كل المناطق</option>' +
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
    document.getElementById('customerModalTitle').textContent = 'تعديل بيانات الكستمر';
    document.getElementById('customerId').value       = c.id;
    document.getElementById('customerName').value     = c.name || '';
    document.getElementById('customerPhone').value    = c.phone || '';
    document.getElementById('customerAddress').value  = c.address || '';
    document.getElementById('customerArea').value     = c.areaId || '';
    document.getElementById('customerDriver').value   = c.driverId || '';
    document.getElementById('customerNotes').value    = c.notes || '';
    document.getElementById('customerActive').checked = c.active !== false;

    if (c.location?.lat) {
      selectedLocation = c.location;
      updateCoordsDisplay(c.location.lat, c.location.lng);
    }
  }

  setTimeout(initLocationMap, 100);
}

function editCustomer(id) { openCustomerModal(id); }

function closeCustomerModal() {
  document.getElementById('customerModal').classList.add('hidden');
  if (locationMap) { locationMap.remove(); locationMap = null; locationMarker = null; }
  selectedLocation = null;
}

function clearCustomerForm() {
  document.getElementById('customerId').value       = '';
  document.getElementById('customerName').value     = '';
  document.getElementById('customerPhone').value    = '';
  document.getElementById('customerAddress').value  = '';
  document.getElementById('customerArea').value     = '';
  document.getElementById('customerDriver').value   = '';
  document.getElementById('customerNotes').value    = '';
  document.getElementById('customerActive').checked = true;
  document.getElementById('locationSearch').value   = '';
  document.getElementById('customerModalTitle').textContent = 'إضافة كستمر جديد';
  document.getElementById('coordsText').textContent = 'لم يتم تحديد الموقع بعد — اضغط على الخريطة';
  selectedLocation = null;
}

function populateAreaDriverDropdowns() {
  const areas   = DB.getAreas();
  const drivers = DB.getDrivers();
  const areaId  = document.getElementById('customerArea').value;

  document.getElementById('customerArea').innerHTML =
    '<option value="">-- اختر المنطقة --</option>' +
    areas.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  if (areaId) document.getElementById('customerArea').value = areaId;
  filterDriversByArea();
}

function onAreaChange() { filterDriversByArea(); }

function filterDriversByArea() {
  const areaId  = document.getElementById('customerArea').value;
  const drivers = DB.getDrivers();
  const filtered = areaId ? drivers.filter(d => d.areaId === areaId) : drivers;

  document.getElementById('customerDriver').innerHTML =
    '<option value="">-- اختر الدرايفر --</option>' +
    filtered.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

function saveCustomer() {
  const name  = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();

  if (!name)  { toast('أدخل اسم الكستمر', 'error'); return; }
  if (!phone) { toast('أدخل رقم الجوال', 'error'); return; }

  const data = {
    name,
    phone,
    address: document.getElementById('customerAddress').value.trim(),
    areaId:  document.getElementById('customerArea').value,
    driverId: document.getElementById('customerDriver').value,
    notes:   document.getElementById('customerNotes').value.trim(),
    active:  document.getElementById('customerActive').checked,
    location: selectedLocation || null,
  };

  const id = document.getElementById('customerId').value;
  if (id) {
    DB.updateCustomer(id, data);
    toast('تم تحديث بيانات الكستمر');
  } else {
    DB.addCustomer(data);
    toast('تمت إضافة الكستمر بنجاح');
  }

  closeCustomerModal();
  renderCustomers();
  renderDashboard();
}

// ---- Location Map ----
function initLocationMap() {
  if (locationMap) { locationMap.remove(); }

  const defaultLat = selectedLocation?.lat || 24.7136;
  const defaultLng = selectedLocation?.lng || 46.6753;

  locationMap = L.map('locationMap').setView([defaultLat, defaultLng], selectedLocation ? 15 : 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(locationMap);

  if (selectedLocation) {
    locationMarker = L.marker([selectedLocation.lat, selectedLocation.lng], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', e => {
      const pos = e.target.getLatLng();
      selectedLocation = { lat: pos.lat, lng: pos.lng };
      updateCoordsDisplay(pos.lat, pos.lng);
    });
  }

  locationMap.on('click', e => {
    const { lat, lng } = e.latlng;
    selectedLocation = { lat, lng };
    updateCoordsDisplay(lat, lng);

    if (locationMarker) locationMarker.remove();
    locationMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMap);
    locationMarker.on('dragend', ev => {
      const pos = ev.target.getLatLng();
      selectedLocation = { lat: pos.lat, lng: pos.lng };
      updateCoordsDisplay(pos.lat, pos.lng);
    });
  });
}

function updateCoordsDisplay(lat, lng) {
  document.getElementById('coordsText').textContent =
    `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function searchLocation() {
  const q = document.getElementById('locationSearch').value.trim();
  if (!q) return;

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=ar`);
    const data = await res.json();
    if (data.length) {
      const { lat, lon } = data[0];
      locationMap.setView([lat, lon], 16);
      if (locationMarker) locationMarker.remove();
      selectedLocation = { lat: parseFloat(lat), lng: parseFloat(lon) };
      locationMarker = L.marker([lat, lon], { draggable: true }).addTo(locationMap);
      locationMarker.on('dragend', e => {
        const pos = e.target.getLatLng();
        selectedLocation = { lat: pos.lat, lng: pos.lng };
        updateCoordsDisplay(pos.lat, pos.lng);
      });
      updateCoordsDisplay(parseFloat(lat), parseFloat(lon));
    } else {
      toast('لم يتم العثور على الموقع', 'warning');
    }
  } catch { toast('خطأ في البحث', 'error'); }
}

// =====================================================
// Drivers
// =====================================================
function renderDrivers() {
  const drivers   = DB.getDrivers();
  const customers = DB.getCustomers();
  const areas     = DB.getAreas();
  const body = document.getElementById('driversBody');
  const empty = document.getElementById('driversEmpty');

  if (!drivers.length) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  body.innerHTML = drivers.map(d => {
    const area = areas.find(a => a.id === d.areaId);
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
      <td><span class="badge badge-success">${count} كستمر</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm" onclick="editDriver('${d.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('driver','${d.id}','${d.name}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openDriverModal(id) {
  clearDriverForm();
  document.getElementById('driverModal').classList.remove('hidden');

  const areas = DB.getAreas();
  document.getElementById('driverArea').innerHTML =
    '<option value="">-- اختر المنطقة --</option>' +
    areas.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

  if (id) {
    const d = DB.getDrivers().find(x => x.id === id);
    if (!d) return;
    document.getElementById('driverModalTitle').textContent = 'تعديل بيانات الدرايفر';
    document.getElementById('driverId').value    = d.id;
    document.getElementById('driverName').value  = d.name || '';
    document.getElementById('driverPhone').value = d.phone || '';
    document.getElementById('driverArea').value  = d.areaId || '';
    document.getElementById('driverNotes').value = d.notes || '';
  }
}

function editDriver(id) { openDriverModal(id); }

function closeDriverModal() {
  document.getElementById('driverModal').classList.add('hidden');
}

function clearDriverForm() {
  document.getElementById('driverId').value    = '';
  document.getElementById('driverName').value  = '';
  document.getElementById('driverPhone').value = '';
  document.getElementById('driverArea').value  = '';
  document.getElementById('driverNotes').value = '';
  document.getElementById('driverModalTitle').textContent = 'إضافة درايفر جديد';
}

function saveDriver() {
  const name  = document.getElementById('driverName').value.trim();
  const phone = document.getElementById('driverPhone').value.trim();
  if (!name)  { toast('أدخل اسم الدرايفر', 'error'); return; }
  if (!phone) { toast('أدخل رقم الجوال', 'error'); return; }

  const data = {
    name,
    phone,
    areaId: document.getElementById('driverArea').value,
    notes:  document.getElementById('driverNotes').value.trim(),
  };

  const id = document.getElementById('driverId').value;
  if (id) {
    DB.updateDriver(id, data);
    toast('تم تحديث بيانات الدرايفر');
  } else {
    DB.addDriver(data);
    toast('تمت إضافة الدرايفر بنجاح');
  }

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

  if (!areas.length) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  body.innerHTML = areas.map(a => {
    const dCount = drivers.filter(d => d.areaId === a.id).length;
    const cCount = customers.filter(c => c.areaId === a.id).length;
    return `<tr>
      <td style="font-weight:600">${a.name}</td>
      <td><span class="badge badge-info">${dCount} درايفر</span></td>
      <td><span class="badge badge-success">${cCount} كستمر</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-outline-primary btn-sm" onclick="editArea('${a.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('area','${a.id}','${a.name}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openAreaModal(id) {
  clearAreaForm();
  document.getElementById('areaModal').classList.remove('hidden');

  if (id) {
    const a = DB.getAreas().find(x => x.id === id);
    if (!a) return;
    document.getElementById('areaModalTitle').textContent = 'تعديل المنطقة';
    document.getElementById('areaId').value    = a.id;
    document.getElementById('areaName').value  = a.name || '';
    document.getElementById('areaNotes').value = a.notes || '';
  }
}

function editArea(id) { openAreaModal(id); }

function closeAreaModal() {
  document.getElementById('areaModal').classList.add('hidden');
}

function clearAreaForm() {
  document.getElementById('areaId').value    = '';
  document.getElementById('areaName').value  = '';
  document.getElementById('areaNotes').value = '';
  document.getElementById('areaModalTitle').textContent = 'إضافة منطقة جديدة';
}

function saveArea() {
  const name = document.getElementById('areaName').value.trim();
  if (!name) { toast('أدخل اسم المنطقة', 'error'); return; }

  const data = { name, notes: document.getElementById('areaNotes').value.trim() };
  const id = document.getElementById('areaId').value;

  if (id) {
    DB.updateArea(id, data);
    toast('تم تحديث المنطقة');
  } else {
    DB.addArea(data);
    toast('تمت إضافة المنطقة');
  }

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
    container.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>لا يوجد درايفرز مضافون</p></div>';
    return;
  }

  let html = '<div style="display:flex;flex-direction:column;gap:1.5rem">';

  drivers.forEach(driver => {
    const driverDels = todayDels.filter(d => d.driverId === driver.id);
    const activeCs   = DB.getCustomersByDriver(driver.id);

    if (!activeCs.length) return;

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
          <div class="flex gap-1" style="margin-right:auto">
            <span class="badge badge-success">${done} تم</span>
            ${fail ? `<span class="badge badge-danger">${fail} فشل</span>` : ''}
            <span class="badge badge-warning">${pend} متبقي</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.35rem">
          ${activeCs.map((c, i) => {
            const del = driverDels.find(d => d.customerId === c.id);
            const status = del?.status || 'pending';
            const statusBadge = {
              delivered: '<span class="badge badge-success"><i class="fas fa-check"></i> تم التوصيل</span>',
              failed:    '<span class="badge badge-danger"><i class="fas fa-times"></i> فشل</span>',
              pending:   '<span class="badge badge-warning"><i class="fas fa-clock"></i> في الانتظار</span>',
            }[status] || '';
            return `
              <div class="flex items-center gap-2" style="padding:.5rem .75rem;background:var(--bg);border-radius:var(--radius-sm)">
                <span class="text-sm text-muted" style="width:20px;text-align:center">${i+1}</span>
                <div style="flex:1">
                  <span style="font-weight:600">${c.name}</span>
                  ${c.address ? `<span class="text-sm text-muted"> — ${c.address}</span>` : ''}
                  ${del?.notes ? `<div class="text-xs text-muted">ملاحظة: ${del.notes}</div>` : ''}
                </div>
                ${statusBadge}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

// =====================================================
// Confirm Delete
// =====================================================
function confirmDelete(type, id, name) {
  const labels = { customer: 'الكستمر', driver: 'الدرايفر', area: 'المنطقة' };
  document.getElementById('confirmMsg').textContent =
    `هل أنت متأكد أنك تريد حذف ${labels[type]} "${name}"؟ هذا الإجراء لا يمكن التراجع عنه.`;

  pendingConfirmFn = () => {
    if (type === 'customer') { DB.deleteCustomer(id); renderCustomers(); }
    if (type === 'driver')   { DB.deleteDriver(id);   renderDrivers(); }
    if (type === 'area')     { DB.deleteArea(id);      renderAreas(); }
    renderDashboard();
    toast('تم الحذف بنجاح');
  };

  document.getElementById('confirmModal').classList.remove('hidden');
}

function confirmAction() {
  if (pendingConfirmFn) pendingConfirmFn();
  closeConfirm();
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.add('hidden');
  pendingConfirmFn = null;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeCustomerModal();
      closeDriverModal();
      closeAreaModal();
      closeConfirm();
    }
  });
});

// Keyboard: Escape closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCustomerModal();
    closeDriverModal();
    closeAreaModal();
    closeConfirm();
  }
});

// =====================================================
// Init
// =====================================================
renderDashboard();
