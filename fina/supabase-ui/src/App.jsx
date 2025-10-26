import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from './supabaseClient'
import * as XLSX from 'xlsx'
import Analytics from './Analytics'

const TYPE_OPTIONS = ['Expenditure', 'Income']

function MultiSelect({ options = [], value = [], onChange, placeholder = 'Select...', maxHeight = 180 }){
  const [open, setOpen] = useState(false)
  const [qSearch, setQSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(qSearch.toLowerCase()))

  function toggleOption(opt){
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }

  return (
    <div className="multi-select" ref={ref}>
      <div className="ms-control" onClick={() => setOpen(s => !s)} role="button" tabIndex={0}>
        <div className="ms-tags">
          {value && value.length > 0 ? value.map(v => <span key={v} className="ms-tag">{v}</span>) : <span className="ms-placeholder">{placeholder}</span>}
        </div>
        <div className="ms-caret">▾</div>
      </div>
      {open && (
        <div className="ms-dropdown" >
          <div style={{padding:8}}>
            <input className="ms-search" placeholder="Search names..." value={qSearch} onChange={e => setQSearch(e.target.value)} />
          </div>
          <div className="ms-options" style={{maxHeight, overflow:'auto'}}>
            {filtered.length === 0 && <div className="ms-empty">No names</div>}
            {filtered.map(opt => (
              <label key={opt} className="ms-option">
                <input type="checkbox" checked={value.includes(opt)} onChange={() => toggleOption(opt)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function blankForm() {
  return { name: '', date: '', type: TYPE_OPTIONS[0], amount: '' }
}

export default function App() {
  // simple client-side auth: roles = 'admin' | 'guest' | null
  const [role, setRole] = useState(() => {
    try { return localStorage.getItem('role') || null } catch(e){ return null }
  })
  const [loginError, setLoginError] = useState('')

  function logout(){ try{ localStorage.removeItem('role') }catch(e){}; setRole(null) }

  async function doLoginAsAdmin(password){
    // hard-coded password per request (in-memory)
    if (String(password).trim() === '8763951777'){
      try{ localStorage.setItem('role','admin') }catch(e){}
      setRole('admin'); setLoginError(''); return true
    }
    setLoginError('Invalid password'); return false
  }

  function doLoginAsGuest(){ try{ localStorage.setItem('role','guest') }catch(e){}; setRole('guest') }

  
  // server-side state
  const [rows, setRows] = useState([]) // current page rows
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpenditure, setTotalExpenditure] = useState(0)
  // default to dark theme; keep persisted user choice if present
  const [theme, setTheme] = useState(() => {
    try { const stored = localStorage.getItem('theme'); return stored ? stored : 'dark' } catch(e){ return 'dark' }
  })
  // Analytics as the default home page (hardcoded)
  const [view, setView] = useState('analytics')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  // default sort: newest date first
  const [sortBy, setSortBy] = useState('date')
  const [sortAsc, setSortAsc] = useState(false)

  const [form, setForm] = useState(blankForm())
  const [editingRowId, setEditingRowId] = useState(null)
  const [inlineEdits, setInlineEdits] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editModalRow, setEditModalRow] = useState(null)
  const [editForm, setEditForm] = useState(blankForm())

  // filters
  const [filterType, setFilterType] = useState('All')
  const [q, setQ] = useState('')
  const [nameFilter, setNameFilter] = useState(null) // applied filters (array) or null for no filter
  const [nameSelection, setNameSelection] = useState([]) // UI selection before pressing Go
  const [names, setNames] = useState([])
  const nameInputRef = useRef(null)
  // date range / presets for dashboard
  const [rangePreset, setRangePreset] = useState('Last 6 months')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { fetchRows() }, [page, pageSize, sortBy, sortAsc, filterType, q, dateFrom, dateTo, nameFilter])

  useEffect(() => { fetchNames() }, [])

  useEffect(() => { fetchTotals() }, [filterType, q, dateFrom, dateTo, nameFilter])

  

  async function fetchTotals() {
    try {
      // apply same server-side filters for totals (except pagination)
      let base = supabase.from('financial_data').select('type,amount', { head: false })
      if (filterType !== 'All') base = base.eq('type', filterType)
      if (q && q.trim()) {
        const s = q.trim()
        const maybeId = Number(s)
        if (!Number.isNaN(maybeId)) {
          base = base.filter('id', 'eq', maybeId)
        } else {
          base = base.or(`name.ilike.%${s}%,type.ilike.%${s}%`)
        }
      }
      if (nameFilter && Array.isArray(nameFilter) && nameFilter.length > 0) base = base.in('name', nameFilter)
  if (dateFrom) base = base.gte('date', dateFrom)
  if (dateTo) base = base.lte('date', dateTo)

      const { data, error } = await base
      if (error) throw error
      let inc = 0, exp = 0
      for (const r of (data || [])) {
        const n = Number(r.amount) || 0
        if (r.type === 'Income') inc += n
        else exp += n
      }
      setTotalIncome(inc)
      setTotalExpenditure(exp)
    } catch (err) {
      console.error('fetchTotals', err)
    }
  }

  // (Charts removed) trend-related code intentionally omitted

  async function fetchRows() {
    setLoading(true)
    try {
      let query = supabase.from('financial_data').select('*', { count: 'exact' })
  // server-side filter by type
  if (filterType !== 'All') query = query.eq('type', filterType)
      // basic search: try id exact or name/type ilike
      if (q && q.trim()) {
        const s = q.trim()
        const maybeId = Number(s)
        if (!Number.isNaN(maybeId)) {
          query = query.filter('id', 'eq', maybeId)
        } else {
          // ilike name or type
          query = query.or(`name.ilike.%${s}%,type.ilike.%${s}%`)
        }
      }
  // date filters
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  if (nameFilter && Array.isArray(nameFilter) && nameFilter.length > 0) query = query.in('name', nameFilter)

      query = query.order(sortBy, { ascending: sortAsc })

      const from = page * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      setRows(data || [])
      setTotal(count ?? 0)
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to fetch rows')
    }
    setLoading(false)
  }

  async function fetchNames() {
    try {
      const { data, error } = await supabase.from('financial_data').select('name').order('name', { ascending: true })
      if (error) throw error
      const uniq = Array.from(new Set((data || []).map(d => d.name).filter(Boolean)))
      setNames(uniq)
    } catch (err) { console.error('fetchNames', err) }
  }

  useEffect(() => {
    try { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) } catch(e){}
  }, [theme])

  // view persistence removed: Analytics is the default home page

  async function createRow(e) {
    if (role !== 'admin') { alert('Only admin can create rows'); return false }
    if (e && e.preventDefault) e.preventDefault()
    const payload = { name: form.name, date: form.date, type: form.type, amount: parseFloat(form.amount) }
    const { error } = await supabase.from('financial_data').insert(payload)
    if (error) { alert(error.message); return false }
    setForm(blankForm())
    // jump to first page where new row may appear
    setPage(0)
    await fetchRows()
    await fetchTotals()
    return true
  }

  function startInlineEdit(row) {
    // Open the edit modal for the row
    setEditModalRow(row)
    setEditForm({ name: row.name || '', date: row.date || '', type: row.type || TYPE_OPTIONS[0], amount: String(row.amount || '') })
  }

  function cancelInlineEdit() {
    // Close modal fallback
    setEditModalRow(null)
    setEditForm(blankForm())
  }

  async function saveInlineEdit(id) {
    // kept for compatibility but not used; prefer saveEditModal
    if (role !== 'admin') { alert('Only admin can edit rows'); return }
    const edits = inlineEdits[id]
    if (!edits) return
    const updates = { name: edits.name, date: edits.date, type: edits.type, amount: parseFloat(edits.amount) }
    const { error } = await supabase.from('financial_data').update(updates).eq('id', id)
    if (error) { alert(error.message); return }
    setEditingRowId(null)
    setInlineEdits({})
    fetchRows()
    fetchTotals()
  }

  async function saveEditModal() {
    if (role !== 'admin') { alert('Only admin can edit rows'); return }
    if (!editModalRow) return
    const updates = { name: editForm.name, date: editForm.date, type: editForm.type, amount: parseFloat(editForm.amount) }
    const { error } = await supabase.from('financial_data').update(updates).eq('id', editModalRow.id)
    if (error) { alert(error.message); return }
    setEditModalRow(null)
    setEditForm(blankForm())
    await fetchRows()
    await fetchTotals()
  }

  async function deleteRow(id) {
    if (role !== 'admin') { alert('Only admin can delete rows'); return }
    if (!confirm('Delete this row?')) return
    const { error } = await supabase.from('financial_data').delete().eq('id', id)
    if (error) { alert(error.message); return }
    // if deleting last item on page, go back a page
    const remaining = rows.length - 1
    if (remaining <= 0 && page > 0) setPage(page - 1)
    fetchRows()
    fetchTotals()
  }

  function toggleSort(column) {
    if (sortBy === column) setSortAsc(!sortAsc)
    else { setSortBy(column); setSortAsc(true) }
    setPage(0)
  }

  // CSV handlers removed per user request

  // CSV import: expect headers name,date,type,amount (id optional)
  function handleImportFile(file) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target.result
      const parsed = parseCSV(text)
      if (!parsed || parsed.length === 0) { alert('No rows found in CSV'); return }
      // map headers
      const normalized = parsed.map(row => {
        return {
          name: row.name || row.Name || '',
          date: row.date || row.Date || '',
          type: row.type || row.Type || TYPE_OPTIONS[0],
          amount: row.amount || row.Amount || '0'
        }
      }).filter(r => r.name && r.date && r.amount)
      if (normalized.length === 0) { alert('No valid rows to import'); return }
      // bulk insert
      const { error } = await supabase.from('financial_data').insert(normalized)
      if (error) { alert(error.message); return }
      alert(`Imported ${normalized.length} rows`)
      setPage(0)
      fetchRows()
    }
    reader.readAsText(file)
  }

  // Excel export using SheetJS
  async function exportXLSX() {
    try {
      // Fetch all rows from Supabase (ignore pagination)
      let q = supabase.from('financial_data').select('*')
      // optionally respect current filters (date/type/search) — user asked for all data, so we ignore filters
      const { data, error } = await q
      if (error) { alert(error.message); return }
      const exportRows = data || []
      if (exportRows.length === 0) { alert('No rows to export'); return }
      const worksheetData = exportRows.map(r => ({ id: r.id, name: r.name, date: r.date, type: r.type, amount: r.amount }))
      const ws = XLSX.utils.json_to_sheet(worksheetData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'financial_data')
      XLSX.writeFile(wb, `financial_data_all.xlsx`)
    } catch (err) {
      console.error('exportXLSX', err)
      alert(err.message || 'Export failed')
    }
  }

  // Excel import: read first sheet and map columns
  function handleImportXLSX(file) {
    if (role !== 'admin') { alert('Only admin can import rows'); return }
    const reader = new FileReader()
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result)
      const wb = XLSX.read(data, { type: 'array' })
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
      if (!parsed || parsed.length === 0) { alert('No rows found in Excel file'); return }
      const normalized = parsed.map(row => ({ name: row.name || row.Name || '', date: row.date || row.Date || '', type: row.type || row.Type || TYPE_OPTIONS[0], amount: row.amount || row.Amount || 0 })).filter(r => r.name && r.date && r.amount !== '')
      if (normalized.length === 0) { alert('No valid rows to import'); return }
      const { error } = await supabase.from('financial_data').insert(normalized)
      if (error) { alert(error.message); return }
      alert(`Imported ${normalized.length} rows from Excel`)
      setPage(0)
      fetchRows()
    }
    reader.readAsArrayBuffer(file)
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length === 0) return []
    const headers = lines[0].split(',').map(h => h.trim())
    const out = []
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i])
      const obj = {}
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = cols[j] !== undefined ? cols[j] : ''
      }
      out.push(obj)
    }
    return out
  }

  // minimal CSV line splitter that handles quoted fields
  function splitCSVLine(line) {
    const res = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
        continue
      }
      if (ch === ',' && !inQuotes) { res.push(cur); cur = ''; continue }
      cur += ch
    }
    res.push(cur)
    return res.map(s => s.trim())
  }

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (filterType !== 'All' && r.type !== filterType) return false
      if (q.trim()) {
        const s = q.toLowerCase()
        return (String(r.id).includes(s) || (r.name || '').toLowerCase().includes(s) || (r.type || '').toLowerCase().includes(s))
      }
      return true
    })
  }, [rows, filterType, q])

  function formatAmount(v){
    const n = Number(v)
    if (Number.isNaN(n)) return ''
    return n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})
  }

  function formatDateWithOrdinal(dateStr){
    if (!dateStr) return ''
    // try to parse ISO date or timestamp
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return String(dateStr)
    const day = d.getDate()
    const year = d.getFullYear()
    const month = d.toLocaleString('en-US', { month: 'short' })
    const getSuffix = (n) => {
      const v = n % 100
      if (v >= 11 && v <= 13) return 'th'
      switch (n % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }
    return `${day}${getSuffix(day)} ${month} ${year}`
  }

  function renderMiniChart(arr, color='#0b6bff'){
    return null
  }

  const displayedRows = (typeof filteredRows !== 'undefined') ? filteredRows : rows
  const pageTotal = displayedRows.reduce((s,r) => s + (Number(r.amount) || 0), 0)

  function focusCreate(){
    try{ nameInputRef.current?.focus(); window.scrollTo({top:0,behavior:'smooth'}) }catch(e){}
  }

  // If no role, render the login screen (placed after hooks to keep hooks order stable)
  if (!role) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h2>Sign in</h2>
          <div className="login-actions">
            <div style={{marginBottom:8}} className="admin-block">
              <label style={{display:'block',fontWeight:700}}>Admin</label>
              <input placeholder="Enter admin password" type="password" id="admin-pass" className="login-input" />
              <div className="admin-actions" style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn save admin-primary" onClick={async () => { const pass = document.getElementById('admin-pass').value; await doLoginAsAdmin(pass) }}>
                  <span style={{fontSize:16}}>🔒</span>
                  <span>Login</span>
                </button>
                <button className="btn cancel" onClick={() => { document.getElementById('admin-pass').value=''; setLoginError('') }}>Clear</button>
              </div>
            </div>
            <div style={{marginTop:8}}>
              <label style={{display:'block',fontWeight:700}}>Guest</label>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn" onClick={doLoginAsGuest}>Continue as Guest</button>
              </div>
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <div className="login-note small-muted" style={{marginTop:10}}>Admin has edit access. Guest is read-only.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header-row">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <h1>Financial Data</h1>
          <div style={{display:'flex',gap:8}}>
            <button className="btn" onClick={() => setView('analytics')} aria-pressed={view==='analytics'}>Analytics</button>
            <button className="btn" onClick={() => setView('table')} aria-pressed={view==='table'}>Table</button>
          </div>
        </div>
        <div className="controls">
          <div className="small-muted">Manage your records — create, edit, import/export</div>
          <button className="btn" title="Toggle theme" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div className="small-muted">Role: {role}</div>
            <button className="btn cancel" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      {/* (removed earlier duplicate filters) */}

      {view === 'analytics' && (
        <Analytics onBack={() => setView('table')} />
      )}

      {view === 'table' && (
        <>
          {/* Dashboard summary (charts removed) */}
          <div className="dashboard">
            <div className="card income">
              <div className="card-title">Total Income</div>
              <div className="card-value">{formatAmount(totalIncome)}</div>
            </div>
            <div className="card expenditure">
              <div className="card-title">Total Expenditure</div>
              <div className="card-value">{formatAmount(totalExpenditure)}</div>
            </div>
            <div className="card balance">
              <div className="card-title">Net</div>
              <div className="card-value">{formatAmount(totalIncome - totalExpenditure)}</div>
            </div>
          </div>

          {/* (Create moved to table header) */}

          {/* Filters directly above the table */}
          <div className="filters" style={{marginBottom:10, display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
            <input placeholder="Search id, name or type..." value={q} onChange={e => { setQ(e.target.value); setPage(0) }} />
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }}>
              <option>All</option>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{minWidth:180}}>
              <MultiSelect options={names} value={nameSelection} onChange={(newVal) => { setNameSelection(newVal); setNameFilter(newVal && newVal.length ? newVal : null); setPage(0) }} placeholder="Select names..." />
            </div>
            <label className="small-muted">From <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} /></label>
            <label className="small-muted">To <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} /></label>
            <button className="btn" onClick={() => { setQ(''); setFilterType('All'); setNameSelection([]); setNameFilter(null); setDateFrom(''); setDateTo(''); setPage(0) }}>Clear</button>
          </div>

          <div className="table">
            <div className="row header">
              <div style={{cursor:'pointer'}} onClick={() => toggleSort('name')}>Name {sortBy==='name' ? (sortAsc ? '▲' : '▼') : ''}</div>
              <div style={{cursor:'pointer'}} onClick={() => toggleSort('date')}>Date {sortBy==='date' ? (sortAsc ? '▲' : '▼') : ''}</div>
              <div style={{cursor:'pointer'}} onClick={() => toggleSort('type')}>Type {sortBy==='type' ? (sortAsc ? '▲' : '▼') : ''}</div>
              <div style={{cursor:'pointer'}} onClick={() => toggleSort('amount')}>Amount {sortBy==='amount' ? (sortAsc ? '▲' : '▼') : ''}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}>
                {role === 'admin' ? (
                  <button className="btn save" onClick={() => setShowCreateModal(true)}>Create</button>
                ) : (
                  <button className="btn" disabled title="Guest has read-only access">Create</button>
                )}
              </div>
            </div>

            {loading && <div className="empty">Loading...</div>}
            {!loading && displayedRows.length === 0 && <div className="empty">No rows found.</div>}

            {displayedRows.map(r => {
              return (
                <div className="row" key={r.id}>

                  <div className="cell">
                    <span>{r.name}</span>
                  </div>

                  <div className="cell">
                    <span className="small-muted">{formatDateWithOrdinal(r.date)}</span>
                  </div>

                  <div className="cell">
                    <span className={`badge ${r.type === 'Income' ? 'income' : 'expenditure'}`}>{r.type}</span>
                  </div>

                  <div className="cell amount-cell">
                    <span className="amount">{formatAmount(r.amount)}</span>
                  </div>

                  <div className="actions mobile-actions">
                    {role === 'admin' ? (
                      <>
                        <button className="btn edit" onClick={() => startInlineEdit(r)} aria-label={`Edit row ${r.id}`} title="Edit">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor"/><path d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
                        </button>
                        <button className="btn delete" onClick={() => deleteRow(r.id)} aria-label={`Delete row ${r.id}`} title="Delete">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12z" fill="currentColor"/><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* guest: no edit, show disabled delete */}
                        <button className="btn" disabled title="Guest has read-only access">Edit</button>
                        <button className="btn" disabled title="Guest has read-only access">Delete</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="pagination-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:12}}>
            <div className="small-muted">Showing {rows.length} of {total} total — page total: {formatAmount(pageTotal)}</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button className="btn" onClick={() => setPage(0)} disabled={page===0}>First</button>
              <button className="btn" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>Prev</button>
              <div className="small-muted">Page {page+1} / {Math.max(1, Math.ceil((total || 0) / pageSize))}</div>
              <button className="btn" onClick={() => setPage(p => p+1)} disabled={(page+1)*pageSize >= (total||0)}>Next</button>
              <button className="btn" onClick={() => setPage(Math.max(0, Math.ceil((total||0)/pageSize)-1))} disabled={(page+1)*pageSize >= (total||0)}>Last</button>
            </div>
          </div>
          {/* Bottom action bar: export/import */}
          <div className="bottom-bar">
            <div style={{display:'flex',gap:8}}>
              <button className="btn" onClick={exportXLSX} title="Export all data to Excel">Export XLSX (all)</button>
              {role === 'admin' ? (
                <label className="btn" style={{display:'inline-flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                  Import XLSX
                  <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e => { if (e.target.files && e.target.files[0]) handleImportXLSX(e.target.files[0]) }} />
                </label>
              ) : (
                <button className="btn" disabled title="Guest has read-only access">Import XLSX</button>
              )}
            </div>
          </div>

          {/* Floating action button for mobile to focus the create input (admin only) */}
          {role === 'admin' && view === 'table' && <button className="fab" onClick={() => setShowCreateModal(true)} title="Create new">＋</button>}

          {/* Create Modal */}
          {showCreateModal && (
            <div className="modal-backdrop" onMouseDown={() => setShowCreateModal(false)}>
              <div className="modal" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <h3>Create financial record</h3>
                <form onSubmit={async (e) => { e.preventDefault(); const ok = await createRow(e); if (ok) setShowCreateModal(false) }} className="form modal-form">
                  <input autoFocus className="grow" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Amount" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                    <button type="button" className="btn cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                    <button type="submit" className="btn save">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Edit Modal */}
          {editModalRow && (
            <div className="modal-backdrop" onMouseDown={() => { setEditModalRow(null); setEditForm(blankForm()) }}>
              <div className="modal" onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <h3>Edit financial record</h3>
                <form onSubmit={async (e) => { e.preventDefault(); await saveEditModal() }} className="form modal-form">
                  <input autoFocus className="grow" placeholder="Name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                  <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} required />
                  <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder="Amount" type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} required />
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                    <button type="button" className="btn cancel" onClick={() => { setEditModalRow(null); setEditForm(blankForm()) }}>Cancel</button>
                    <button type="submit" className="btn save">Save</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
