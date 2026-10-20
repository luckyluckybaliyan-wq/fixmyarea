const CATS = { road:'Road / pothole', light:'Streetlight', garbage:'Garbage', water:'Water supply', drain:'Drain / sewage', safety:'Public safety', other:'Other' };
const STAT = { open:'Open', in_progress:'In progress', resolved:'Resolved' };
const COLOR = { open:'#c8402f', in_progress:'#d99a00', resolved:'#2f8f5b' };
const $ = (id) => document.getElementById(id);
let map, issues = [], markers = {}, picked = null, pickMarker = null, reporting = false;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api = async (url, opts) => { const r = await fetch(url, opts); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed'); return d; };
const post = (url, body, method = 'POST') => api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

window.initMap = function () {
  const c = window.APP_CONFIG;
  if (window.google && google.maps) {
    map = new google.maps.Map($('map'), { center: { lat: c.lat, lng: c.lng }, zoom: 13, mapTypeControl: false, streetViewControl: false });
    map.addListener('click', (e) => { if (reporting) setPick(e.latLng.lat(), e.latLng.lng()); });
    const ac = new google.maps.places.Autocomplete($('place'), { fields: ['geometry', 'name'] });
    ac.addListener('place_changed', () => { const p = ac.getPlace(); if (p.geometry) { map.panTo(p.geometry.location); map.setZoom(15); } });
  } else $('nokey').hidden = false;
  init();
};

function init() {
  $('fCategory').innerHTML += Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('rCategory').innerHTML = Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  ['fCategory', 'fStatus'].forEach((id) => $(id).addEventListener('change', refresh));
  $('fText').addEventListener('input', refresh);
  $('locate').onclick = locate;
  $('reportBtn').onclick = () => { reporting = true; picked = null; $('pickHint').textContent = 'Click the map to place the pin, or use your location.'; $('reportDlg').show(); };
  $('cancelReport').onclick = closeReport;
  $('closeDetail').onclick = () => $('detailDlg').close();
  $('reportForm').addEventListener('submit', submitReport);
  refresh();
}

async function refresh() {
  const p = new URLSearchParams({ category: $('fCategory').value, status: $('fStatus').value, q: $('fText').value });
  [...p.keys()].forEach((k) => !p.get(k) && p.delete(k));
  issues = await api('/api/issues?' + p);
  renderList(); renderMarkers(); renderStats();
}

function renderList() {
  $('list').innerHTML = issues.length ? issues.map((i) => `<li class="${i.status}" data-id="${i.id}" tabindex="0">
    <strong>${esc(i.title)}</strong><br><small>${CATS[i.category]} - ${STAT[i.status]} - ${i.upvotes} upvotes</small></li>`).join('')
    : '<li>No issues match. Try clearing the filters.</li>';
  document.querySelectorAll('#list li[data-id]').forEach((li) => {
    const open = () => openDetail(li.dataset.id);
    li.onclick = open; li.onkeydown = (e) => e.key === 'Enter' && open();
  });
}

function renderMarkers() {
  if (!map) return;
  Object.values(markers).forEach((m) => m.setMap(null)); markers = {};
  issues.forEach((i) => {
    const m = new google.maps.Marker({ map, position: { lat: i.lat, lng: i.lng }, title: i.title,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: COLOR[i.status], fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
    m.addListener('click', () => openDetail(i.id)); markers[i.id] = m;
  });
}

async function renderStats() {
  const s = await api('/api/stats'), b = s.byStatus;
  $('stats').innerHTML = `<div><b>${s.total}</b>Reported</div><div><b>${b.in_progress || 0}</b>In progress</div><div><b>${b.resolved || 0}</b>Resolved</div>`;
}

async function openDetail(id) {
  const i = await api('/api/issues/' + id);
  if (map) { map.panTo({ lat: i.lat, lng: i.lng }); map.setZoom(16); }
  $('detail').innerHTML = `<h2>${esc(i.title)}</h2>
    <span class="badge ${i.status}">${STAT[i.status]}</span> <small>${CATS[i.category]}</small>
    <p>${esc(i.description) || 'No details added.'}</p>
    <button class="btn" id="up">Upvote (${i.upvotes})</button>
    <h3>Comments</h3>${i.comments.map((c) => `<div class="cmt"><b>${esc(c.name)}</b><br>${esc(c.text)}</div>`).join('') || '<p class="hint">No comments yet.</p>'}
    <form id="cf"><label>Add a comment<input name="text" maxlength="300" required></label><button class="btn ghost">Post comment</button></form>`;
  $('up').onclick = async () => { await post(`/api/issues/${id}/upvote`, {}); await refresh(); openDetail(id); };
  $('cf').onsubmit = async (e) => { e.preventDefault(); await post(`/api/issues/${id}/comments`, { text: new FormData(e.target).get('text') }); openDetail(id); };
  $('detailDlg').showModal();
}

function setPick(lat, lng) {
  picked = { lat, lng };
  $('pickHint').textContent = `Pin placed at ${lat.toFixed(5)}, ${lng.toFixed(5)}.`;
  if (map) { pickMarker?.setMap(null); pickMarker = new google.maps.Marker({ map, position: { lat, lng } }); }
}

function locate() {
  if (!navigator.geolocation) return alert('Location is not supported in this browser.');
  navigator.geolocation.getCurrentPosition((p) => {
    const { latitude: lat, longitude: lng } = p.coords;
    if (map) { map.panTo({ lat, lng }); map.setZoom(16); }
    if (reporting) setPick(lat, lng);
  }, () => alert('Could not get your location. Allow location access or click the map instead.'));
}

async function submitReport(e) {
  e.preventDefault();
  if (!picked) return alert('Place the pin on the map first.');
  const f = Object.fromEntries(new FormData($('reportForm')));
  try { await post('/api/issues', { ...f, ...picked }); closeReport(); $('reportForm').reset(); refresh(); }
  catch (err) { alert(err.message); }
}

function closeReport() { reporting = false; pickMarker?.setMap(null); $('reportDlg').close(); }
