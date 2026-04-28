// =====================================================
// Driver View
// =====================================================
if (!requireAuth('driver')) throw new Error('auth');

const driverId = sessionStorage.getItem('driverId');
const driver   = DB.getDriverById(driverId);

if (!driver) {
  toast('Driver not found — contact admin', 'error');
  setTimeout(logout, 2500);
}

// State
let deliveries   = [];
let customers    = [];
let driverMap    = null;
let mapMarkers   = [];
let routeLine    = null;
let activeCardId = null;

// =====================================================
// Init
// =====================================================
function init() {
  const area = driver.areaId ? DB.getAreas().find(a => a.id === driver.areaId) : null;

  document.getElementById('driverName').textContent = driver.name;
  document.getElementById('driverArea').textContent = area ? area.name : 'No area assigned';
  document.getElementById('headerDate').textContent =
    new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

  DB.initTodayDeliveries(driverId);
  reload();
}

function reload() {
  deliveries = DB.getTodayDeliveries(driverId);
  customers  = DB.getCustomersByDriver(driverId);

  // Attach customer to each delivery
  deliveries.forEach(d => { d._customer = DB.getCustomerById(d.customerId); });

  // Optimized order
  const withLoc    = customers.filter(c => c.location?.lat);
  const withoutLoc = customers.filter(c => !c.location?.lat);
  const ordered    = [...optimizeRoute([...withLoc]), ...withoutLoc];

  deliveries.sort((a, b) => {
    const ai = ordered.findIndex(c => c.id === a.customerId);
    const bi = ordered.findIndex(c => c.id === b.customerId);
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
        <p>No deliveries for today</p>
        <p class="text-sm">Contact admin to add customers</p>
      </div>`;
    return;
  }

  container.innerHTML = deliveries.map((d, i) => {
    const c       = d._customer;
    if (!c) return '';
    const isDone  = d.status === 'delivered';
    const isFail  = d.status === 'failed';
    const rem     = c.remainingDays ?? c.subscriptionDays ?? 0;
    const isActive = d.id === activeCardId;

    return `
      <div class="delivery-card ${isDone ? 'delivered' : isFail ? 'failed' : ''} ${isActive ? 'active-card' : ''}" id="card-${d.id}">
        <div class="delivery-card-top">
          <div class="delivery-num ${isDone ? 'done' : isFail ? 'fail' : ''}">
            ${isDone ? '✓' : isFail ? '✕' : i + 1}
          </div>
          <div class="delivery-info">
            <div class="name">${c.name}</div>
            ${c.address ? `<div class="addr"><i class="fas fa-map-marker-alt" style="color:var(--danger);font-size:.65rem"></i> ${c.address}</div>` : ''}
            ${c.phone ? `<a href="tel:${c.phone}" class="phone"><i class="fas fa-phone"></i> ${c.phone}</a>` : ''}
            ${d.notes ? `<div class="text-xs text-muted" style="margin-top:.2rem"><i class="fas fa-sticky-note"></i> ${d.notes}</div>` : ''}
            <div style="margin-top:.3rem">${subscriptionBadge(rem)}</div>
          </div>
          ${c.location?.lat ? `
            <button class="btn btn-ghost btn-sm btn-icon" onclick="focusOnMap('${d.id}')" title="Show on map">
              <i class="fas fa-map-marker-alt"></i>
            </button>` : ''}
        </div>

        <div class="delivery-card-actions">
          ${!isDone && !isFail ? `
            <button class="btn btn-primary btn-sm" onclick="markDelivered('${d.id}')">
              <i class="fas fa-check"></i> Delivered
            </button>
            <button class="btn btn-danger btn-sm" onclick="openNotesModal('${d.id}', 'failed')">
              <i class="fas fa-times"></i> Problem
            </button>
            ${c.location?.lat ? `
              <button class="btn btn-info btn-sm" onclick="navigate('${d.id}')">
                <i class="fas fa-directions"></i> Navigate
              </button>` : ''}
          ` : `
            <span class="text-sm text-muted" style="padding:.3rem 0">
              ${isDone ? '✅ Delivered' : '❌ Failed'}
              ${d.deliveredAt ? ' · ' + new Date(d.deliveredAt).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }) : ''}
            </span>
            <button class="btn btn-ghost btn-sm" onclick="resetDelivery('${d.id}')">
              <i class="fas fa-undo"></i> Undo
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
    const first  = deliveries.find(d => d._customer?.location?.lat);
    const center = first ? [first._customer.location.lat, first._customer.location.lng] : [24.7136, 46.6753];
    driverMap = L.map('driverMap').setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(driverMap);
  }

  mapMarkers.forEach(m => m.remove());
  mapMarkers = [];
  if (routeLine) { routeLine.remove(); routeLine = null; }

  const allPoints = [];

  deliveries.forEach((d, i) => {
    const c = d._customer;
    if (!c?.location?.lat) return;
    const { lat, lng } = c.location;
    allPoints.push([lat, lng]);

    const isDone = d.status === 'delivered';
    const isFail = d.status === 'failed';
    const color  = isDone ? '#22c55e' : isFail ? '#ef4444' : '#3b82f6';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:${color};color:#fff;
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:12px;font-family:Inter,sans-serif;
        border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)
      "><span style="transform:rotate(45deg)">${isDone ? '✓' : isFail ? '✕' : i+1}</span></div>`,
      iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34],
    });

    const marker = L.marker([lat, lng], { icon }).addTo(driverMap);
    const rem    = c.remainingDays ?? c.subscriptionDays ?? 0;

    marker.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:160px">
        <strong>${c.name}</strong><br>
        ${c.address ? `<small style="color:#64748b">${c.address}</small><br>` : ''}
        ${c.phone   ? `<a href="tel:${c.phone}" style="color:#3b82f6">${c.phone}</a><br>` : ''}
        <small style="color:#64748b">Sub: ${rem} days left</small><br>
        ${c.location?.lat ? `<a href="#" onclick="navigate('${d.id}');return false;" style="color:#22c55e;font-weight:600">
          <i class="fas fa-directions"></i> Navigate
        </a>` : ''}
      </div>
    `);

    marker.on('click', () => {
      activeCardId = d.id;
      switchTab('list');
      setTimeout(() => scrollToCard(d.id), 120);
    });

    marker._deliveryId = d.id;
    mapMarkers.push(marker);
  });

  // Dashed route line for pending deliveries
  const pending = deliveries
    .filter(d => d.status === 'pending' && d._customer?.location?.lat)
    .map(d => [d._customer.location.lat, d._customer.location.lng]);

  if (pending.length > 1) {
    routeLine = L.polyline(pending, {
      color: '#3b82f6', weight: 3, opacity: .55, dashArray: '8, 6',
    }).addTo(driverMap);
  }

  if (allPoints.length) {
    driverMap.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
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
  if (!c?.location?.lat) { toast('No location set for this customer', 'warning'); return; }
  const { lat, lng } = c.location;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
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
  const del = deliveries.find(x => x.id === deliveryId);
  if (!del) return;

  // Decrement subscription days once per delivery (only first time)
  if (!del.daysDecremented) {
    DB.decrementCustomerDays(del.customerId);
  }

  DB.updateDelivery(deliveryId, {
    status: 'delivered',
    deliveredAt: DB.nowISO(),
    notes,
    daysDecremented: true,
  });

  // Check if customer ran out
  const updatedCustomer = DB.getCustomerById(del.customerId);
  const rem = updatedCustomer?.remainingDays ?? 1;
  if (rem <= 0) {
    toast(`${updatedCustomer?.name} — subscription expired! Notify admin.`, 'warning');
  } else if (rem <= 3) {
    toast(`Delivered ✓ — ${updatedCustomer?.name} has ${rem} days left`, 'warning');
  } else {
    toast('Marked as delivered ✓', 'success');
  }

  reload();
}

function markFailed(deliveryId, notes = '') {
  DB.updateDelivery(deliveryId, {
    status: 'failed', deliveredAt: DB.nowISO(), notes,
  });
  toast('Marked as failed', 'warning');
  reload();
}

function resetDelivery(deliveryId) {
  DB.updateDelivery(deliveryId, { status: 'pending', deliveredAt: null, notes: '' });
  // Note: we do NOT increment subscription days back when undoing
  toast('Reset to pending');
  reload();
}

// =====================================================
// Notes Modal
// =====================================================
function openNotesModal(deliveryId, action) {
  document.getElementById('notesInput').value = '';
  document.getElementById('notesModalTitle').textContent = action === 'failed' ? 'Report Problem' : 'Add Note';
  document.getElementById('notesModal').classList.remove('hidden');

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

  // Show/hide buttons based on action
  document.getElementById('notesSaveBtn').style.display = action === 'failed' ? 'none' : '';
}

function closeNotesModal() { document.getElementById('notesModal').classList.add('hidden'); }

// =====================================================
// Summary
// =====================================================
function renderSummary() {
  const total     = deliveries.length;
  const delivered = deliveries.filter(d => d.status === 'delivered').length;
  const failed    = deliveries.filter(d => d.status === 'failed').length;
  const pending   = deliveries.filter(d => d.status === 'pending').length;

  document.getElementById('summaryGrid').innerHTML = `
    <div class="summary-box green"><div class="num">${delivered}</div><div class="lbl">Delivered</div></div>
    <div class="summary-box red"><div class="num">${failed}</div><div class="lbl">Failed</div></div>
    <div class="summary-box gray"><div class="num">${pending}</div><div class="lbl">Pending</div></div>`;

  let detail = '';

  // Failed deliveries
  const failedDels = deliveries.filter(d => d.status === 'failed');
  if (failedDels.length) {
    detail += `
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-header" style="background:var(--danger-light)">
          <h3 style="color:#b91c1c"><i class="fas fa-exclamation-triangle"></i> Failed Deliveries</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.45rem">
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

  // No location customers
  const noLoc = deliveries.filter(d => !d._customer?.location?.lat && d.status === 'pending');
  if (noLoc.length) {
    detail += `
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-header" style="background:var(--warning-light)">
          <h3 style="color:#92400e"><i class="fas fa-map-marker-alt"></i> No Location Set</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.4rem">
          ${noLoc.map(d => {
            const c = d._customer;
            return `
              <div class="flex items-center gap-2" style="padding:.4rem;background:var(--bg);border-radius:var(--radius-xs)">
                <i class="fas fa-exclamation" style="color:var(--warning)"></i>
                <div style="flex:1">
                  <strong>${c?.name || '—'}</strong>
                  <div class="text-xs text-muted">Contact customer for location</div>
                </div>
                ${c?.phone ? `<a href="tel:${c.phone}" class="btn btn-info btn-sm"><i class="fas fa-phone"></i></a>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Expiring subscriptions in today's list
  const expiring = deliveries.filter(d => {
    const rem = d._customer?.remainingDays ?? d._customer?.subscriptionDays ?? 99;
    return rem <= 3 && d.status !== 'failed';
  });
  if (expiring.length) {
    detail += `
      <div class="card">
        <div class="card-header" style="background:var(--danger-light)">
          <h3 style="color:#b91c1c"><i class="fas fa-calendar-times"></i> Subscriptions Expiring Soon</h3>
        </div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:.4rem">
          ${expiring.map(d => {
            const c   = d._customer;
            const rem = c?.remainingDays ?? c?.subscriptionDays ?? 0;
            return `
              <div class="flex items-center gap-2" style="padding:.4rem;background:var(--bg);border-radius:var(--radius-xs)">
                <i class="fas fa-clock" style="color:var(--danger)"></i>
                <div style="flex:1">
                  <strong>${c?.name || '—'}</strong>
                  <div class="text-xs text-muted">${rem <= 0 ? 'Expired' : `${rem} day${rem !== 1 ? 's' : ''} remaining`}</div>
                </div>
                ${c?.phone ? `<a href="tel:${c.phone}" class="btn btn-ghost btn-sm"><i class="fas fa-phone"></i></a>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  if (!detail && pending === 0 && total > 0) {
    detail = `<div style="text-align:center;padding:2rem;color:var(--primary-dark)">
      <div style="font-size:2.5rem">🎉</div>
      <strong style="font-size:1.1rem">All deliveries completed!</strong>
    </div>`;
  }

  document.getElementById('summaryDetails').innerHTML = detail;
}

// =====================================================
// Tab Switching
// =====================================================
function switchTab(tab) {
  ['map', 'list', 'summary'].forEach(t => {
    document.getElementById('panel-' + t).classList.toggle('active', t === tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'map' && driverMap) setTimeout(() => driverMap.invalidateSize(), 60);
  if (tab === 'list' && activeCardId) setTimeout(() => scrollToCard(activeCardId), 120);
}

// Close notes modal on overlay click
document.getElementById('notesModal').addEventListener('click', e => {
  if (e.target === document.getElementById('notesModal')) closeNotesModal();
});

// =====================================================
// Start
// =====================================================
init();
