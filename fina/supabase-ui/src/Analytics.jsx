import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function monthKey(dateStr){
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function formatMonthLabel(key){
  // key expected in YYYY-MM
  if (!key || typeof key !== 'string') return key
  const [y, m] = key.split('-')
  const monthIndex = Number(m) - 1
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return key
  const date = new Date(Number(y), monthIndex, 1)
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

export default function Analytics(){
  const [totals, setTotals] = useState({ income:0, expenditure:0 })
  // byMonth will map monthKey -> { income: number, expenditure: number }
  const [byMonth, setByMonth] = useState({})
  const [byType, setByType] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll(){
    setLoading(true)
    try{
      const { data, error } = await supabase.from('financial_data').select('date,type,amount')
      if (error) throw error
      let inc=0, exp=0
      const monthMap = {}
      const typeMap = {}
      for (const r of (data||[])){
        const n = Number(r.amount)||0
        if (r.type === 'Income') inc += n; else exp += n
        const mk = monthKey(r.date)
        if (mk){
          if (!monthMap[mk]) monthMap[mk] = { income: 0, expenditure: 0 }
          if (r.type === 'Income') monthMap[mk].income += n
          else monthMap[mk].expenditure += n
        }
        typeMap[r.type] = (typeMap[r.type]||0) + n
      }
      setTotals({ income: inc, expenditure: exp })
      // sort months and normalize order
      const ordered = Object.keys(monthMap).sort().reduce((acc,k)=> (acc[k]=monthMap[k], acc), {})
      setByMonth(ordered)
      setByType(typeMap)
    }catch(err){ console.error('analytics fetch', err) }
    setLoading(false)
  }

  return (
    <div style={{marginTop:12}}>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
        <h2 style={{margin:0}}>Analytics</h2>
      </div>

      {loading && <div className="empty">Loading analytics...</div>}

      {!loading && (
        <>
          <div className="dashboard">
            <div className="card income"><div className="card-title">Total Income</div><div className="card-value">{totals.income.toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
            <div className="card expenditure"><div className="card-title">Total Expenditure</div><div className="card-value">{totals.expenditure.toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
            <div className="card balance"><div className="card-title">Net</div><div className="card-value">{(totals.income - totals.expenditure).toLocaleString(undefined,{minimumFractionDigits:2})}</div></div>
          </div>

          <div style={{marginTop:16}}>
            <h3>By Month</h3>
            {Object.keys(byMonth).length===0 ? (
              <div className="empty">No data</div>
            ) : (
              <div style={{overflowX:'auto',marginTop:8}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left',padding:8}}>Month</th>
                      <th style={{textAlign:'right',padding:8}}>Income</th>
                      <th style={{textAlign:'right',padding:8}}>Expenditure</th>
                      <th style={{textAlign:'right',padding:8}}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byMonth).map(([m,vals]) => (
                      <tr key={m}>
                        <td style={{padding:8}}>{formatMonthLabel(m)}</td>
                        <td style={{padding:8,textAlign:'right'}}>{(vals.income||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        <td style={{padding:8,textAlign:'right'}}>{(vals.expenditure||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        <td style={{padding:8,textAlign:'right'}}>{(((vals.income||0)-(vals.expenditure||0))).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{borderTop:'1px solid rgba(2,6,23,0.06)'}}>
                      <td style={{padding:8,fontWeight:700}}>Totals</td>
                      <td style={{padding:8,textAlign:'right',fontWeight:700}}>{totals.income.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                      <td style={{padding:8,textAlign:'right',fontWeight:700}}>{totals.expenditure.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                      <td style={{padding:8,textAlign:'right',fontWeight:700}}>{((totals.income - totals.expenditure)).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* end analytics */}
        </>
      )}
    </div>
  )
}
