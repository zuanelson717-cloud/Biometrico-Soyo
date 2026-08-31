/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Reports from './components/Reports';
import MonthlyReports from './components/MonthlyReports';
import Cadastro from './components/Cadastro';
import Settings from './components/Settings';
import AdminPasswordPrompt from './components/AdminPasswordPrompt';

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingView, setPendingView] = useState<string | null>(null);

  const restrictedViews = ['reports', 'monthly-reports', 'cadastro', 'settings'];

  const handleSetActiveView = (view: string) => {
    if (restrictedViews.includes(view) && !isAuthenticated) {
        setPendingView(view);
        setShowAdminPrompt(true);
    } else {
        setActiveView(view);
        if (restrictedViews.includes(view)) {
            setIsAuthenticated(true);
        }
    }
  };

  const handleAdminConfirm = (user: string, pass: string) => {
      if (user === 'admin' && pass === 'R@ma,2027#') {
          setIsAuthenticated(true);
          setShowAdminPrompt(false);
          if (pendingView) setActiveView(pendingView);
      } else {
          alert('SENHA ERRADA');
      }
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'employees': return <Employees />;
      case 'reports': return <Reports />;
      case 'monthly-reports': return <MonthlyReports />;
      case 'cadastro': return <Cadastro />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Sidebar activeView={activeView} setActiveView={handleSetActiveView} />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
      {showAdminPrompt && (
          <AdminPasswordPrompt 
            onConfirm={handleAdminConfirm} 
            onCancel={() => setShowAdminPrompt(false)} 
          />
      )}
    </div>
  );
}
