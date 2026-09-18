import React from 'react';
import { LayoutDashboard, Users, FileText, Settings, UserPlus } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export default function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employees', label: 'Funcionários', icon: Users },
    { id: 'reports', label: 'Relatório Diário', icon: FileText },
    { id: 'monthly-reports', label: 'Relatórios Mensais', icon: FileText },
    { id: 'cadastro', label: 'Cadastro', icon: UserPlus },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen p-6 flex flex-col gap-8 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">B</div>
        <h1 className="text-lg font-semibold text-white tracking-tight">BioGuard <span className="text-blue-500">Pro</span></h1>
      </div>
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
              activeView === item.id 
                ? 'bg-blue-600/10 text-blue-400 font-medium' 
                : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
