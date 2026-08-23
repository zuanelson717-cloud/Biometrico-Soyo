/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Reports from './components/Reports';
import Cadastro from './components/Cadastro';
import Settings from './components/Settings';

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'employees': return <Employees />;
      case 'reports': return <Reports />;
      case 'cadastro': return <Cadastro />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}
