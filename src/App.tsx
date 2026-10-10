/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
  const [user, setUser] = useState<{ email: string | null } | null>({ email: 'zuanelson717@gmail.com' });
  const [loading, setLoading] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingView, setPendingView] = useState<string | null>(null);

  const ADMIN_USER = 'admin';
  const ADMIN_PASS = 'Rom@,2027#';

  const handleViewChange = (view: string) => {
    if (['reports', 'monthly-reports', 'settings', 'cadastro'].includes(view)) {
      setPendingView(view);
      setShowPasswordPrompt(true);
    } else {
      setActiveView(view);
    }
  };

  const handlePasswordConfirm = (user: string, pass: string) => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      setActiveView(pendingView!);
      setShowPasswordPrompt(false);
      setPendingView(null);
    } else {
      alert('Senha incorreta!');
    }
  };

  useEffect(() => {
    // Replaced onAuthStateChanged with a mock user
  }, []);

  useEffect(() => {
    if (!user) return;
    const checkAndSendReport = async () => {
        const lastSent = localStorage.getItem('lastReportSent');
        const today = new Date().toISOString().split('T')[0];
        if (lastSent === today) return;

        // Fetch all employees and email settings
        try {
            const [employeesSnapshot, emailDoc] = await Promise.all([
                getDocs(collection(db, 'employees')),
                getDoc(doc(db, 'config', 'emailSettings'))
            ]);
            
            const employees: any[] = [];
            employeesSnapshot.forEach((doc) => employees.push({id: doc.id, ...doc.data()}));
            
            const emails = emailDoc.exists() ? emailDoc.data().emails : [user.email];

            // Send to backend
            try {
                await fetch('/api/enviar-relatorio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employees, emails }),
                });
                localStorage.setItem('lastReportSent', today);
            } catch (e) {
                console.error('Erro ao enviar relatório', e);
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, 'employees ou config');
        }
    };

    const scheduleNextReport = () => {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        const msUntilMidnight = nextMidnight.getTime() - now.getTime();

        return setTimeout(async () => {
            await checkAndSendReport();
            scheduleNextReport(); // Agendar para o próximo dia
        }, msUntilMidnight);
    };

    // Execução inicial e agendamento
    checkAndSendReport();
    const timeout = scheduleNextReport();
    return () => clearTimeout(timeout);
  }, [user]);

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'employees': return <Employees />;
      case 'reports': return <Reports userEmail={user.email} />;
      case 'monthly-reports': return <MonthlyReports />;
      case 'cadastro': return <Cadastro />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {showPasswordPrompt && (
        <AdminPasswordPrompt 
          onConfirm={handlePasswordConfirm} 
          onCancel={() => setShowPasswordPrompt(false)} 
        />
      )}
      <Sidebar activeView={activeView} setActiveView={handleViewChange} />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  );
}
