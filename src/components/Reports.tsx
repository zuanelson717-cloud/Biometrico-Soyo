import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, deleteDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { generatePDFContent } from '../lib/pdfGenerator';
import { Employee, Attendance } from '../types';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';

interface AttendancePair {
  checkInId?: string;
  checkOutId?: string;
  checkIn?: Date;
  checkOut?: Date;
  checkInStr?: string;
  checkOutStr?: string;
  extraTimeMs?: number;
}

const SHIFT_START_HOUR = 8;
const MAX_LUNCH_DURATION_MS = 1.5 * 60 * 60 * 1000; // 1h 30m
const FULL_SHIFT_MS = 8 * 60 * 60 * 1000; // 8 horas

export default function Reports({ userEmail }: { userEmail: string | null }) {
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'present' | 'absent' | 'refeicao' | 'schedule'>('present');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState({
      frequency: 'daily', // 'daily' | 'weekly' | 'monthly'
      reportType: 'refeicao', // 'refeicao' | 'diario'
      recipientEmail: userEmail || '',
      employeeIds: [] as string[]
  });
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [justifications, setJustifications] = useState<any[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [reportTime, setReportTime] = useState('00:00');
  const [autoReportEnabled, setAutoReportEnabled] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        const empList = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
        setEmployees(empList);

        const attSnap = await getDocs(collection(db, 'attendance'));
        const attList = attSnap.docs.map(d => ({ ...d.data(), id: d.id } as Attendance));
        setAttendance(attList);

        const justSnap = await getDocs(collection(db, 'justifications'));
        setJustifications(justSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const schedSnap = await getDocs(collection(db, 'reportSchedules'));
        setSchedules(schedSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        
        const autoReportDoc = await getDoc(doc(db, 'config', 'autoReportSettings'));
        if (autoReportDoc.exists()) {
            setAutoReportEnabled(autoReportDoc.data().enabled);
            setReportTime(autoReportDoc.data().reportTime || '00:00');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); // Removido [user]

  if (loading) return <div className="p-8">Carregando relatórios...</div>;

  // ... (rest of the component logic)
  const saveSchedule = async () => {
      try {
          await addDoc(collection(db, 'reportSchedules'), {
              ...scheduleSettings,
              createdAt: new Date()
          });
          alert('Agendamento salvo com sucesso!');
          setScheduleModalOpen(false);
      } catch (e) {
          console.error(e);
          alert('Erro ao salvar agendamento.');
      }
  };

  const sendReportNow = async () => {
    try {
        const emailDoc = await getDoc(doc(db, 'config', 'emailSettings'));
        const emails = emailDoc.exists() && emailDoc.data().emails?.length > 0 
            ? emailDoc.data().emails 
            : [userEmail].filter(Boolean) as string[];
        
        console.log('Sending report with:', { employees: filtered.length, emails });
        
        const accessToken = user ? await user.getIdToken() : null;
        
        const response = await fetch('/api/enviar-relatorio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                employees: filtered, 
                emails,
                accessToken
            }),
        });
        
        if (response.ok) {
            alert('Relatório enviado com sucesso!');
        } else {
            alert('Erro ao enviar relatório.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao enviar relatório.');
    }
  };

  const deleteSelectedLunchPairs = async () => {
      if (selectedForDeletion.length === 0) return;
      if (!confirm(`Deseja apagar ${selectedForDeletion.length} registros de refeição selecionados?`)) return;
      try {
          console.log('Iniciando deleção dos IDs:', selectedForDeletion);
          // O set garante que IDs duplicados sejam deletados apenas uma vez
          const uniqueIds = Array.from(new Set(selectedForDeletion));
          for (const id of uniqueIds) {
              if (id) {
                console.log('Tentando apagar documento:', id);
                await deleteDoc(doc(db, 'attendance', id as string));
                console.log('Documento apagado:', id);
              }
          }
          alert('Registros apagados com sucesso!');
          window.location.reload();
      } catch (e) {
          console.error('Erro ao apagar registros:', e);
          alert('Erro ao apagar registros: ' + e);
      }
  };

  const toggleSelectForDeletion = (p: AttendancePair) => {
      const ids = [p.checkInId, p.checkOutId].filter(Boolean) as string[];
      // Verifica se todos os IDs presentes no par já estão selecionados
      const allSelected = ids.every(id => selectedForDeletion.includes(id));
      
      setSelectedForDeletion(prev => 
          allSelected 
            ? prev.filter(id => !ids.includes(id)) 
            : [...new Set([...prev, ...ids])]
      );
  };

  const formatDuration = (ms: number) => {
      const hrs = Math.floor(ms / (1000 * 60 * 60));
      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hrs}h ${mins}m`;
  };

  const getStatusForDate = (employeeId: string, date: string) => {
    const records = attendance
      .filter(a => a.employeeId === employeeId && a.timestamp?.toDate().toISOString().split('T')[0] === date)
      .sort((a, b) => a.timestamp?.toMillis() - b.timestamp?.toMillis());

    const pairs: AttendancePair[] = [];
    let currentPair: AttendancePair = {};

    const lunchPairs: AttendancePair[] = [];
    let currentLunchPair: AttendancePair = {};

    records.forEach(r => {
      const time = r.timestamp?.toDate().toLocaleTimeString();
      const date = r.timestamp?.toDate();
      if (r.type === 'checkIn') {
        if (currentPair.checkIn) {
            pairs.push(currentPair);
            currentPair = {};
        }
        currentPair.checkIn = date;
        currentPair.checkInStr = time;
      } else if (r.type === 'checkOut') {
        currentPair.checkOut = date;
        currentPair.checkOutStr = time;
        pairs.push(currentPair);
        currentPair = {};
      } else if (r.type === 'lunchIn') {
        if (currentLunchPair.checkIn) {
            lunchPairs.push(currentLunchPair);
            currentLunchPair = {};
        }
        currentLunchPair.checkIn = date;
        currentLunchPair.checkInStr = time;
        currentLunchPair.checkInId = r.id; // Added ID
      } else if (r.type === 'lunchOut') {
        currentLunchPair.checkOut = date;
        currentLunchPair.checkOutStr = time;
        currentLunchPair.checkOutId = r.id; // Added ID
        
        if (currentLunchPair.checkIn && currentLunchPair.checkOut) {
            const durationMs = currentLunchPair.checkOut.getTime() - currentLunchPair.checkIn.getTime();
            const maxLunchDurationMs = 1.5 * 60 * 60 * 1000;
            if (durationMs > maxLunchDurationMs) {
                currentLunchPair.extraTimeMs = durationMs - maxLunchDurationMs;
            }
        }
        
        lunchPairs.push(currentLunchPair);
        currentLunchPair = {};
      }
    });
    if (currentPair.checkIn) pairs.push(currentPair);
    if (currentLunchPair.checkIn) lunchPairs.push(currentLunchPair);
    
    let totalDurationMs = 0;
    pairs.forEach(p => {
        if (p.checkIn && p.checkOut) {
            totalDurationMs += (p.checkOut.getTime() - p.checkIn.getTime());
        }
    });
    
    let totalLunchDurationMs = 0;
    lunchPairs.forEach(p => {
        if (p.checkIn && p.checkOut) {
            totalLunchDurationMs += (p.checkOut.getTime() - p.checkIn.getTime());
        }
    });
    
    totalDurationMs = Math.max(0, totalDurationMs - totalLunchDurationMs);
    
    const lastEvent = records[records.length - 1];
    const isActive = lastEvent?.type === 'checkIn' || lastEvent?.type === 'lunchOut';

    const isToday = new Date().toISOString().split('T')[0] === date;
    const isAfter11AM = new Date().getHours() >= 11;
    
    // Check if justified
    const isJustified = justifications.some(j => j.employeeId === employeeId && j.date === date);
    
    const isAbsent = isToday && isAfter11AM && pairs.length === 0 && !isJustified;

    // --- Atrasos (Cálculos) ---
    // 1. Atraso na Entrada
    let arrivalDelayMs = 0;
    if (pairs.length > 0 && pairs[0].checkIn) {
        const checkInTime = new Date(pairs[0].checkIn);
        const shiftStart = new Date(checkInTime);
        shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
        if (checkInTime > shiftStart) {
            arrivalDelayMs = checkInTime.getTime() - shiftStart.getTime();
        }
    }

    // 2. Atraso na Refeição (já calculado no loop lunchPairs)
    let totalLunchOverrunMs = 0;
    lunchPairs.forEach(p => { if (p.extraTimeMs) totalLunchOverrunMs += p.extraTimeMs; });

    // 3. Atraso Diário
    const dailyDelayMs = arrivalDelayMs + totalLunchOverrunMs;

    return { pairs, lunchPairs, isActive, isAbsent, totalDurationMs, dailyDelayMs };
  };

  const processedEmployees = employees.map(emp => {
    const status = getStatusForDate(emp.id, selectedDate);
    return {
      ...emp,
      ...status,
      isActive: status.isAbsent ? false : (emp.isActive !== undefined ? emp.isActive : true)
    };
  });

  const filtered = processedEmployees.filter(e => {
    const matchesSearch = searchQuery === '' || 
                          e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (e.nip && e.nip.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTab = searchQuery !== '' ? true : 
                       (activeTab === 'present' ? e.isActive : 
                       (activeTab === 'absent' ? !e.isActive : true));
    return matchesTab && matchesSearch;
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    generatePDFContent(doc, filtered, selectedDate);
    doc.save(`relatorio_${selectedDate}.pdf`);
  };

  if (loading) return <div className="p-8">Carregando relatórios...</div>;

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl font-bold mb-4">Relatórios Diários</h1>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
            />
            <input 
                type="text" 
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-grow"
            />
        </div>
        <div className="flex flex-wrap gap-1">
            <button onClick={() => setActiveTab('present')} className={`px-3 py-1.5 text-sm rounded ${activeTab === 'present' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Presentes</button>
            <button onClick={() => setActiveTab('absent')} className={`px-3 py-1.5 text-sm rounded ${activeTab === 'absent' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Ausentes</button>
            <button onClick={() => setActiveTab('refeicao')} className={`px-3 py-1.5 text-sm rounded ${activeTab === 'refeicao' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Refeição</button>
            <button onClick={() => setActiveTab('schedule')} className={`px-3 py-1.5 text-sm rounded ${activeTab === 'schedule' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Agendamento</button>
        </div>
        
        {activeTab === 'schedule' && (
            <div className="p-4 border rounded bg-slate-50">
                <div className="mb-4">
                    <h3 className="font-bold mb-2">Relatório Diário Automático:</h3>
                    <button 
                        onClick={async () => {
                            const newEnabled = !autoReportEnabled;
                            await fetch('/api/toggle-auto-report', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ enabled: newEnabled, reportTime })
                            });
                            setAutoReportEnabled(newEnabled);
                        }}
                        className={`px-4 py-2 rounded text-white ${autoReportEnabled ? 'bg-red-600' : 'bg-green-600'}`}
                    >
                        {autoReportEnabled ? 'Desativar Agendamento Automático' : 'Ativar Agendamento Automático'}
                    </button>
                    <div className="mt-2">
                        <label className="text-sm font-bold">Horário:</label>
                        <input 
                            type="time" 
                            value={reportTime} 
                            onChange={(e) => setReportTime(e.target.value)}
                            className="ml-2 border rounded p-1 text-sm"
                        />
                    </div>
                </div>
                <button onClick={() => setScheduleModalOpen(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded mb-4">Novo Agendamento</button>
                <h3 className="font-bold mb-2">Agendamentos Atuais:</h3>
                {schedules.length === 0 && <p className="text-sm text-slate-500">Nenhum agendamento definido.</p>}
                {schedules.map(s => (
                    <div key={s.id} className="border p-2 rounded bg-white mb-2 text-sm">
                        <p><strong>Frequência:</strong> {s.frequency === 'daily' ? 'Diário' : s.frequency === 'weekly' ? 'Semanal' : 'Mensal'}</p>
                        <p><strong>Tipo:</strong> {s.reportType === 'refeicao' ? 'Refeição' : 'Diário'}</p>
                        <p><strong>Email:</strong> {s.recipientEmail}</p>
                        <p><strong>Funcionários:</strong> {s.employeeIds.length} selecionados</p>
                    </div>
                ))}
            </div>
        )}
        {scheduleModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg">
                    <h2 className="text-lg font-bold mb-4">Novo Agendamento</h2>
                    <div className="flex flex-col gap-3">
                        <select 
                            value={scheduleSettings.frequency} 
                            onChange={(e) => setScheduleSettings({...scheduleSettings, frequency: e.target.value})}
                            className="border rounded p-2"
                        >
                            <option value="daily">Diário</option>
                            <option value="weekly">Semanal</option>
                            <option value="monthly">Mensal</option>
                        </select>
                        <select 
                            value={scheduleSettings.reportType} 
                            onChange={(e) => setScheduleSettings({...scheduleSettings, reportType: e.target.value})}
                            className="border rounded p-2"
                        >
                            <option value="refeicao">Refeição</option>
                            <option value="diario">Diário</option>
                        </select>
                        <input 
                            type="email" 
                            placeholder="Email do Administrador"
                            value={scheduleSettings.recipientEmail}
                            onChange={(e) => setScheduleSettings({...scheduleSettings, recipientEmail: e.target.value})}
                            className="border rounded p-2"
                        />
                        <div className="border rounded p-2 h-40 overflow-y-auto">
                            <p className="text-sm font-semibold mb-2">Funcionários:</p>
                            {employees.map(e => (
                                <div key={e.id} className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        checked={scheduleSettings.employeeIds.includes(e.id)}
                                        onChange={(event) => {
                                            const newIds = event.target.checked 
                                                ? [...scheduleSettings.employeeIds, e.id]
                                                : scheduleSettings.employeeIds.filter(id => id !== e.id);
                                            setScheduleSettings({...scheduleSettings, employeeIds: newIds});
                                        }}
                                    />
                                    <span>{e.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={saveSchedule} className="bg-green-600 text-white px-4 py-2 rounded mt-4">Salvar</button>
                    <button onClick={() => setScheduleModalOpen(false)} className="ml-2 px-4 py-2">Cancelar</button>
                </div>
            </div>
        )}
        <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint} className="bg-slate-600 text-white px-3 py-1.5 text-sm rounded hover:bg-slate-700">Imprimir</button>
            <button onClick={handleDownloadPDF} className="bg-slate-800 text-white px-3 py-1.5 text-sm rounded hover:bg-slate-900">PDF</button>
            <button onClick={() => setScheduleModalOpen(true)} className="bg-purple-700 text-white px-3 py-1.5 text-sm rounded hover:bg-purple-800">Agendar Envio Automático</button>
            <button onClick={sendReportNow} className="bg-green-700 text-white px-3 py-1.5 text-sm rounded hover:bg-green-800">Enviar Relatório Agora</button>
            {activeTab === 'refeicao' && (
                <button 
                    onClick={() => {
                        if (isDeleteMode) deleteSelectedLunchPairs();
                        setIsDeleteMode(!isDeleteMode);
                        setSelectedForDeletion([]);
                    }}
                    className={`${isDeleteMode ? 'bg-red-700' : 'bg-red-500'} text-white px-3 py-1.5 text-sm rounded hover:bg-red-800`}
                >
                    {isDeleteMode ? 'Confirmar' : 'Apagar'}
                </button>
            )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[10px] whitespace-nowrap">
          <thead className="bg-slate-100">
            <tr className="border-b">
              {isDeleteMode && activeTab === 'refeicao' && <th className="py-2 px-1"></th>}
              <th className="py-2 px-2">Funcionário</th>
              <th className="py-2 px-2">NIP</th>
              <th className="py-2 px-2">Cargo</th>
              <th className="py-2 px-2">Registros</th>
              <th className="py-2 px-2">Carga</th>
              <th className="py-2 px-2">Atraso</th>
            </tr>
          </thead>
          <tbody>
          {filtered.map(e => (
            <tr key={e.id} className="border-b">
              {isDeleteMode && activeTab === 'refeicao' && <td className="py-2"></td>}
              <td className="py-2 px-2">{e.name}</td>
              <td className="py-2 px-2">{e.nip || '-'}</td>
              <td className="py-2 px-2">{e.role}</td>
              <td className="py-2 px-2">
                <div className="flex flex-col gap-1">
                  {activeTab === 'refeicao' ? (
                      e.lunchPairs.length > 0 ? (
                        e.lunchPairs.map((p, i) => {
                            const ids = [p.checkInId, p.checkOutId].filter(Boolean) as string[];
                            const isSelected = ids.every(id => selectedForDeletion.includes(id));
                            return (
                                <div key={i} className={`flex items-center gap-4 text-xs bg-slate-50 p-1.5 rounded border ${isSelected ? 'border-red-500' : 'border-slate-100'}`}>
                                  {isDeleteMode && (
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={() => toggleSelectForDeletion(p)}
                                    />
                                  )}
                                  <span className="font-bold text-slate-500 w-6">#{i + 1}</span>
                                  <div className="flex gap-2 items-center">
                                    <span className="text-amber-700 font-medium">Saída P/ Refeição: {p.checkInStr || '-'}</span>
                                    <span className="text-slate-400">|</span>
                                    <span className="text-green-700 font-medium">Retorno: {p.checkOutStr || '-'}</span>
                                    {p.extraTimeMs && p.extraTimeMs > 0 && (
                                        <span className="text-red-600 font-bold ml-2">
                                            +{formatDuration(p.extraTimeMs)}
                                        </span>
                                    )}
                                  </div>
                                </div>
                              )
                        })
                      ) : <span className="text-slate-400">-</span>
                  ) : e.isAbsent ? (
                    <div className="text-red-600 font-bold bg-red-50 p-1.5 rounded border border-red-200 text-xs cursor-help" title="Não marcou ponto até 11h">
                      Ausente
                    </div>
                  ) : e.pairs.length > 0 ? (
                    e.pairs.map((p, i) => (
                      <div key={i} className="flex items-center gap-4 text-xs bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="font-bold text-slate-500 w-6">#{i + 1}</span>
                        <div className="flex gap-2 items-center">
                          <span className="text-green-700 font-medium">Entrada: {p.checkInStr || '-'}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-red-700 font-medium">Saída: {p.checkOutStr || '-'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>
              </td>
              <td className="py-2 px-2 text-[10px]">
                {activeTab !== 'refeicao' && e.totalDurationMs > 0 ? (() => {
                    
                    const formatMs = (ms: number) => {
                        const hrs = Math.floor(ms / (1000 * 60 * 60));
                        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                        return `${hrs}h ${mins}m`;
                    };
                    
                    const totalStr = formatMs(e.totalDurationMs);
                    
                    if (e.totalDurationMs > FULL_SHIFT_MS) {
                        const extraTimeMs = e.totalDurationMs - FULL_SHIFT_MS;
                        return (
                            <span className="font-bold text-slate-900">
                                {totalStr} <span className="text-slate-900">+{formatMs(extraTimeMs)}</span>
                            </span>
                        );
                    } else {
                        return <span className="text-slate-900">{totalStr}</span>;
                    }
                })() : '-'}
              </td>
              <td className="py-2 px-2 text-[10px] text-red-600 font-bold">
                 {activeTab !== 'refeicao' && e.dailyDelayMs > 0 ? formatDuration(e.dailyDelayMs) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
}

