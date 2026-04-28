// =====================================================
// Driver View
// =====================================================
if (!requireAuth('driver')) throw new Error('auth');

const driverId = sessionStorage.getItem('driverId');
const driver   = DB.getDriverById(driverId);

if (!driver) {
  toast('درايفر غير موجود', 'error');
  setTimeout(() => logout(), 2000);
}

// State
let deliveries   = [];
let customers    = [];
let driverMap    = null;
let mapMarkers   = [];
let routeLine    = null;
let activeCardId = null;
let pendingNotesDel = null;
let pendingNotesAction = null;

// =====================================================
// Init
// =====================================================
function init() {
  const area = driver.areaId ? DB.getAreas().find(a => a.id === driver.areaId) : null;

  document.getElementById('driverName').textContent = driver.name;
  document.getElementById('driverArea').textContent = area ? area.name : 'بدون منطقة محددة';
  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('ar-SA', { weekday:'long', month:'long', day:'numeric' });

  // Init deliveries for today (creates entries if missing)
  DB.initTodayDeliveries(driverId);
  reload();
}

function reload() {
  deliveries = DB.getTodayDeliveries(driverId);
  customers  = DB.getCustomersByDriver(driverId);

  // Attach customer data to deliveries
  deliveries.forEach(d => {
    d._customer = DB.getCustomerById(d.customerId);
  });

  // Optimized order using only customers with location
  const withLoc    = customers.filter(c => c.location?.lat);
  const withoutLoc = customers.filter(c => !c.location?.lat);
  const optimized  = optimizeRoute([...withLoc]);
  const orderedCustomers = [...optimized, ...withoutLoc];

  // Reorder deliveries by optimized customer order
  deliveries.sort((a, b) => {
    const ai = orderedCustomers.findIndex(c => c.id === a.customerId);
    const bi = orderedCustomers.findIndex(c => c.id === b.customerId);
    return ai - bi;
  });

  updateProgress();
  renderList();
  renderMap();
  renderSummary();
}

// =====================================================
// Progress
// =====================================================
function updateProgress() {
  const total     = deliveries.length;
  const delivered = deliveries.filter(d => d.status === 'delivered').length;
  const pct       = total > 0 ? Math.round((delivered / total) * 100) : 0;

  document.getElementById('headerProgress').textContent = `${delivered} / ${total}`;
  document.getElementById('headerProgressBar').style.width = pct + '%';
}

// =====================================================
// Delivery List
// =====================================================
function renderList() {
  const container = document.getElementById('deliveryList');

  if (!deliveries.length) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:3rem">
        <i class="fas fa-box-open"></i>
        <p>لا توجد توصيلات لليوم</p>
        <p class="text-sm">تواصل مع المدير لإضافة كستمرز</p>
      </div>`;
    return;
  }

  container.innerHTML = deliveries.map((d, i) => {
    const c = d._customer;
    if (!c) return '';

    const isDone = d.status === 'delivered';
    const isFail = d.status === 'failed';
    const statusClass = isDone ? 'delivered' : isFail ? 'failed' : '';
    const numClass    = isDone ? 'done' : isFail ? 'fail' : '';
    const isActive    = d.id === activeCardId;

    return `
      <div class="delivery-card ${statusClass} ${isActive ? 'active-card' : ''}" id="card-${d.id}">
        <div class="delivery-card-top">
          <div class="delivery-num ${numClass}">${isDone ? '✓' : isFail ? '✕' : i + 1}</div>
          <div class="delivery-info">
            <div class="name">${c.name}</div>
            ${c.address ? `<div class="addr"><i class="fas fa-map-marker-alt" style="color:var(--danger);font-size:.7rem"></i> ${c.address}</div>` : ''}
            ${c.phone ? `
              <a href="tel:${c.phone}" class="phone">
                <i class="fas fa-phone"></i> ${c.phone}
              </a>` : ''}
            ${d.notes ? `<div class="text-xs text-muted" style="margin-top:.2rem"><i class="fas fa-sticky-note"></i> ${d.notes}</div>` : ''}
          </div>
          ${c.location?.lat ? `
            <button class="btn btn-ghost btn-sm" onclick="focusOnMap('${d.id}')" title="عرض على الخريطة">
              <i class="fas fa-map-marker-alt"></i>
            </button>` : ''}
        </div>

        <div class="delivery-card-actions">
          ${!isDone && !isFail ? `
            <button class="btn btn-primary btn-sm" onclick="markDelivered('${d.id}')">
              <i class="fas fa-check"></i> تم التوصيل
            </button>
            <button class="btn btn-danger btn-sm" onclick="openNotesModal('${d.id}', 'failed')">
              <i class="fas fa-times"></i> مشكلة
            </button>
            ${c.location?.lat ? `
              <button class="btn btn-info btn-sm" onclick="navigate('${d.id}')">
                <i class="fas fa-directions"></i> توجيه
              </button>` : ''}
          ` : `
            <span class="text-sm text-muted">
              ${isDone ? '✅ تم التوصيل' : '❌ فشل التوصيل'}
              ${d.deliveredAt ? ' — ' + new Date(d.deliveredAt).toLocaleTimeString('ar-SA', {hour:'2-digit',minute:'2-digit'}) : ''}
            </span>
            <button class="btn btn-ghost btn-sm" onclick="resetDelivery('${d.id}')">
              <i class="fas fa-undo"></i> تراجع
            </button>
          `}
        </div>
      </div>`;
  }).join('');
}

// =====================================================
// Map
// =====================================================
function renderMap() {
  if (!driverMap) {
    // Determine initial center
    const firstWithLoc = deliveries.find(d => d._customer?.location?.lat);
    const center = firstWithLoc
      ? [firstWithLoc._customer.location.lat, firstWithLoc._customer.location.lng]
      : [24.7136, 46.6753];

    driverMap = L.map('driverMap').setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(driverMap);
  }

  // Clear existing markers & route
  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];
  if (routeLine) { routeLine.remove(); routeLine = null; }

  const points = [];

  deliveries.forEach((d, i) => {
    const c = d._customer;
    if (!c?.location?.lat) return;

    const { lat, lng } = c.location;
    points.push([lat, lng]);

    const isDone = d.status === 'delivered';
    const isFail = d.status === 'failed';

    // Custom marker
    const color = isDone ? '#22c55e' : isFail ? '#ef4444' : '#3b82f6';
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${color};
        color:#fff;
        width:32px;height:32px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:12px;font-family:Tajawal,sans-serif;
        border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.3);
      "><span style="transform:rotate(45deg)">${isDone ? '✓' : isFail ? '✕' : i+1}</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(driverMap);
    marker.bindPopup(`
      <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:160px">
        <strong>${c.name}</strong><br>
        ${c.address ? `<small>${c.address}</small><br>` : ''}
        ${c.phone ? `<a href="tel:${c.phone}" style="color:#3b82f6">${c.phone}</a><br>` : ''}
        ${c.location?.lat ? `<a href="#" onclick="navigate('${d.id}');return false;" style="color:#22c55e;font-weight:600">
          <i class="fas fa-directions"></i> توجيه
        </a>` : ''}
      </div>
    `);

    marker.on('click', () => {
      activeCardId = d.id;
      switchTab('list');
      setTimeout(() => scrollToCard(d.id), 100);
    });

    marker._deliveryId = d.id;
    mapMarkers.push(marker);
  });

  // Draw route line for pending deliveries
  const pendingPoints = deliveries
    .filter(d => d.status === 'pending' && d._customer?.location?.lat)
    .map(d => [d._customer.location.lat, d._customer.location.lng]);

  if (pendingPoints.length > 1) {
    routeLine = L.polyline(pendingPoints, {
      color: '#3b82f6',
      weight: 3,
      opacity: .6,
      dashArray: '8, 6',
    }).addTo(driverMap);
  }

  // Fit map to all markers
  if (points.length) {
    driverMap.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }
}

function focusOnMap(deliveryId) {
  const d = deliveries.find(x => x.id === deliveryId);
  if (!d?._customer?.location?.lat) return;

  activeCardId = deliveryId;
  switchTab('map');

  const { lat, lng } = d._customer.location;
  driverMap.setView([lat, lng], 17);

  const marker = mapMarkers.find(m => m._deliveryId === deliveryId);
  if (marker) marker.openPopup();
}

function scrollToCard(id) {
  const el = document.getElementById('card-' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =====================================================
// Navigation
// =====================================================
function navigate(deliveryId) {
  const d = deliveries.find(x => x.id === deliveryId);
  const c = d?._customer;
  if (!c?.location?.lat) { toast('لا يوجد موقع لهذا الكستمر', 'warning'); return; }

  // Open navigation options
  const lat = c.location.lat, lng = c.location.lng;
  const label = encodeURIComponent(c.name);

  // Try to detect platform
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
  }
}

// =====================================================
// Delivery Actions
// =====================================================
function markDelivered(deliveryId, notes = '') {
  DB.updateDelivery(deliveryId, {
    status: 'delivered',
    deliveredAt: DB.nowISO(),
    notes,
  });
  toast('تم تسجيل التوصيل ✓', 'success');
  reload();
}

function markFailed(deliveryId, notes = '') {
  DB.updateDelivery(deliveryId, {
    status: 'failed',
    deliveredAt: DB.nowISO(),
    notes,
  });
  toast('تم تسجيل المشكلة', 'warning');
  reload();
}

function resetDelivery(deliveryId) {
  DB.updateDelivery(deliveryId, { status: 'pending', deliveredAt: null, notes: '' });
  toast('تم التراجع');
  reload();
}

// Notes Modal
function openNotesModal(deliveryId, action) {
  pendingNotesDel    = deliveryId;
  pendingNotesAction = action;
  document.getElementById('notesInput').value = '';
  document.getElementById('notesModal').classList.remove('hidden');

  // Setup buttons
  document.getElementById('notesSaveBtn').onclick = () => {
    const notes = document.getElementById('notesInput').value.trim();
    markDelivered(deliveryId, notes);
    closeNotesModal();
  };
  document.getElementById('notesFailBtn').onclick = () => {
    const notes = document.getElementById('notesInput').value.trim();
    markFailed(deliveryId, notes);
    closeNotesModal();
  };

  if (action === 'failed') {
    document.getElementById('notesSaveBtn').style.display = 'none';
    document.getElementById('notesFailBtn').style.display = '';
  } else {
    document.getElementById('notesSaveBtn').style.display = '';
    document.getElementById('notesFailBtn').style.display = '';
  }
}

function closeNotesModal() {
  document.getElementById('notesModal').classList.add('hidden');
  pendingNotesDel = null;
  pendingNotesAction = null;
}

// =====================================================
// Summary
// =====================================================
function renderSummary() {
  const total     = deliveries.length;
  const delivered = deliveries.filter(d => d.status === 'delivered').length;
  const failed    = deliveries.filter(d => d.status === 'failed').length;
  const pending   = deliveries.filter(d => d.status === 'pending').length;

  document.getElementById('summaryGrid').innerHTML = `
    <div class="summary-box green">
      <div class="num">${delivered}</div>
      <div class="lbl">تم التوصيل</div>
    </div>
    <div class="summary-box red">
      <div class="num">${failed}</div>
      <div class="lbl">فشل</div>
    </div>
    <div class="summary-box gray">
      <div class="num">${pending}</div>
      <div class="lbl">متبقي</div>
    </div>`;

  // List of failed/problem deliveries
  const failedDels = deliveries.filter(d => d.status === 'failed');
  let detailHtml = '';

  if (failedDels.length) {
    detailHtml += `
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-header" style="background:var(--danger-light)">
          <h3 style="color:#b91c1c"><i class="fas fa-exclamation-triangle"></i> توصيلات فاشلة</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.5rem">
          ${failedDels.map(d => {
            const c = d._customer;
            return `
              <div class="flex items-center gap-2" style="padding:.5rem;background:var(--bg);border-radius:var(--radius-xs)">
                <i class="fas fa-times-circle" style="color:var(--danger)"></i>
                <div style="flex:1">
                  <strong>${c?.name || '—'}</strong>
                  ${d.notes ? `<div class="text-xs text-muted">${d.notes}</div>` : ''}
                </div>
                <button class="btn btn-ghost btn-sm" onclick="resetDelivery('${d.id}');switchTab('list')">
                  <i class="fas fa-redo"></i>
                </button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Without location
  const noLoc = deliveries.filter(d => !d._customer?.location?.lat && d.status === 'pending');
  if (noLoc.length) {
    detailHtml += `
      <div class="card">
        <div class="card-header" style="background:var(--warning-light)">
          <h3 style="color:#92400e"><i class="fas fa-map-marker-alt"></i> بدون موقع محدد</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.4rem">
          ${noLoc.map(d => {
            const c = d._customer;
            return `
              <div class="flex items-center gap-2" style="padding:.4rem;background:var(--bg);border-radius:var(--radius-xs)">
                <i class="fas fa-exclamation" style="color:var(--warning)"></i>
                <div style="flex:1">
                  <strong>${c?.name || '—'}</strong>
                  <div class="text-xs text-muted">تواصل مع الكستمر لأخذ الموقع</div>
                </div>
                ${c?.phone ? `<a href="tel:${c.phone}" class="btn btn-info btn-sm">
                  <i class="fas fa-phone"></i>
                </a>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  if (!detailHtml) {
    if (pending === 0 && total > 0) {
      detailHtml = `
        <div style="text-align:center;padding:2rem;color:var(--primary-dark)">
          <div style="font-size:2.5rem">🎉</div>
          <strong style="font-size:1.1rem">أحسنت! اكتملت جميع التوصيلات</strong>
        </div>`;
    }
  }

  document.getElementById('summaryDetails').innerHTML = detailHtml;
}

// =====================================================
// Tab Switching
// =====================================================
function switchTab(tab) {
  ['map', 'list', 'summary'].forEach(t => {
    document.getElementById('panel-' + t).classList.toggle('active', t === tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });

  // Invalidate map size when switching to map tab
  if (tab === 'map' && driverMap) {
    setTimeout(() => driverMap.invalidateSize(), 50);
  }

  // Scroll to active card if switching to list
  if (tab === 'list' && activeCardId) {
    setTimeout(() => scrollToCard(activeCardId), 100);
  }
}

// Close notes modal on overlay click
document.getElementById('notesModal').addEventListener('click', e => {
  if (e.target === document.getElementById('notesModal')) closeNotesModal();
});

// =====================================================
// Start
// =====================================================
init();
