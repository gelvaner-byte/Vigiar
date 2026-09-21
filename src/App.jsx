import { useEffect, useState } from 'react'
import { LayoutDashboard, Receipt, Package, HandCoins, Boxes, LogOut, AlertTriangle, Download } from 'lucide-react'
import Logo from './components/Logo'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import DespesasFixas from './components/DespesasFixas'
import CustosMercadorias from './components/CustosMercadorias'
import DebitosReceber from './components/DebitosReceber'
import Estoque from './components/Estoque'
import { supabase, isSupabaseConfigured } from './lib/supabaseClient'
import { useSupabaseList, TABLES } from './utils/useSupabaseList'

const TABS = [
  { id: 'dashboard', label: 'Painel Principal', Icon: LayoutDashboard },
  { id: 'despesas', label: 'Despesas Fixas', Icon: Receipt },
  { id: 'mercadorias', label: 'Custos de Mercadorias', Icon: Package },
  { id: 'receber', label: 'Débitos a Receber', Icon: HandCoins },
  { id: 'estoque', label: 'Estoque', Icon: Boxes },
]

function NotConfigured() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4 text-slate-100">
      <div className="max-w-md space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <AlertTriangle className="mx-auto text-amber-400" size={32} />
        <h1 className="text-lg font-semibold">Configuração pendente</h1>
        <p className="text-sm text-slate-300">
          O Vigiar ainda não está conectado ao banco de dados. Copie o arquivo{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-orange-300">.env.example</code> para{' '}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-orange-300">.env</code> e preencha com os
          dados do seu projeto Supabase. Veja o README para o passo a passo completo.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const despesasFixas = useSupabaseList(TABLES.despesasFixas)
  const custosMercadorias = useSupabaseList(TABLES.custosMercadorias)
  const debitosReceber = useSupabaseList(TABLES.debitosReceber)
  const estoque = useSupabaseList(TABLES.estoque)

  function handleExportBackup() {
    const backup = {
      exportadoEm: new Date().toISOString(),
      despesasFixas: despesasFixas.items,
      custosMercadorias: custosMercadorias.items,
      debitosReceber: debitosReceber.items,
      estoque: estoque.items,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vigiar-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!isSupabaseConfigured) return <NotConfigured />
  if (authLoading) return null
  if (!session) return <Login />

  return (
    <div className="min-h-screen bg-surface-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11 shrink-0" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-100">
                VIG<span className="text-orange-500">IAR</span>
              </h1>
              <p className="text-xs text-slate-500">Gestão Financeira — Segurança Eletrônica</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              title="Baixar backup dos dados (.json)"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Backup</span>
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              title="Sair"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <tab.Icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <Dashboard
          despesasFixas={despesasFixas.items}
          custosMercadorias={custosMercadorias.items}
          debitosReceber={debitosReceber.items}
        />

        {activeTab === 'dashboard' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            Use as abas acima para cadastrar despesas fixas, custos de mercadorias com fornecedores,
            débitos a receber de clientes e o valor do seu estoque. Os cards acima refletem
            automaticamente os dados cadastrados, e ficam sincronizados em qualquer dispositivo.
          </div>
        )}
        {activeTab === 'despesas' && (
          <DespesasFixas
            items={despesasFixas.items}
            addItem={despesasFixas.addItem}
            removeItem={despesasFixas.removeItem}
            toggleStatus={despesasFixas.toggleStatus}
          />
        )}
        {activeTab === 'mercadorias' && (
          <CustosMercadorias
            items={custosMercadorias.items}
            addItem={custosMercadorias.addItem}
            removeItem={custosMercadorias.removeItem}
            toggleStatus={custosMercadorias.toggleStatus}
          />
        )}
        {activeTab === 'receber' && (
          <DebitosReceber
            items={debitosReceber.items}
            addItem={debitosReceber.addItem}
            removeItem={debitosReceber.removeItem}
            toggleStatus={debitosReceber.toggleStatus}
          />
        )}
        {activeTab === 'estoque' && (
          <Estoque items={estoque.items} addItem={estoque.addItem} removeItem={estoque.removeItem} />
        )}
      </main>
    </div>
  )
}
