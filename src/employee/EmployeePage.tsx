import React, { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { apiGet, apiPost } from '../shared/api'

type Employee = {
  id: number
  nirc: string
  full_name: string
  position?: string
  email: string
  created_at?: string
}

export default function EmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({ nirc: '', full_name: '', position: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<{ results?: Employee[] } | null>('/api/employees')
      const rows = (res && (res as any).results) || [] // safe fallback
      setEmployees(Array.isArray(rows) ? rows : [])
    } catch (err: any) {
      console.error('Failed to fetch employees', err)
      setError('Failed to load employees')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    try {
      await apiPost('/api/employees', form)
    } catch (err: any) {
      console.error('Failed to add employee', err)
      setError('Failed to add employee')
    } finally {
      setForm({ nirc: '', full_name: '', position: '', email: '' })
      void refresh()
    }
  }

  function exportPdf() {
    const doc = new jsPDF()
    ;(doc as any).autoTable({
      head: [['NIRC', 'Full Name', 'Position', 'Email', 'Created']],
      body: employees.map(emp => [emp.nirc, emp.full_name, emp.position || '', emp.email, emp.created_at || '']),
    })
    doc.save('employees.pdf')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        <header className="flex items-center space-x-4 mb-6">
          {/* move apple-logo.png to public/img/apple-logo.png or import it instead */}
          <img src="/img/apple-logo.png" alt="logo" className="w-12 h-12 rounded-lg" />
          <div>
            <h1 className="text-2xl font-semibold">Employee Directory</h1>
            <p className="text-sm text-gray-500">Add employees and export a PDF list</p>
          </div>
          <div className="ml-auto">
            <button onClick={exportPdf} className="bg-black text-white px-4 py-2 rounded-md text-sm">Export to PDF</button>
          </div>
        </header>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <input required value={form.nirc} onChange={e => setForm({...form, nirc: e.target.value})}
            placeholder="National ID (NIRC)" className="p-3 border rounded-md" />
          <input required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
            placeholder="Full name" className="p-3 border rounded-md" />
          <input value={form.position} onChange={e => setForm({...form, position: e.target.value})}
            placeholder="Position" className="p-3 border rounded-md" />
          <input required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
            placeholder="Email" className="p-3 border rounded-md" />
          <div className="col-span-full flex justify-end">
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-md">Add Employee</button>
          </div>
        </form>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        <section>
          <h2 className="text-lg font-medium mb-3">Employees {loading ? '(loading...)' : `(${employees.length})`}</h2>
          <div className="space-y-2">
            {employees.map(emp => (
              <div key={emp.id} className="p-3 rounded-md border flex items-center justify-between">
                <div>
                  <div className="font-medium">{emp.full_name} <span className="text-sm text-gray-500">({emp.nirc})</span></div>
                  <div className="text-sm text-gray-500">{emp.position} • {emp.email}</div>
                </div>
                <div className="text-sm text-gray-400">{emp.created_at ? new Date(emp.created_at).toLocaleString() : ''}</div>
              </div>
            ))}
            {!loading && employees.length === 0 && (
              <div className="p-3 text-gray-500">No employees yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
