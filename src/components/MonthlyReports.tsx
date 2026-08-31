import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee, Attendance } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MonthlyReports() {
  const [activeTab, setActiveTab] = useState<'absences' | 'delays'>('absences');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [justifications, setJustifications] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeForAnnul, setSelectedEmployeeForAnnul] = useState<Employee | null>(null);
  const [selectedDaysForAnnul, setSelectedDaysForAnnul] = useState<string[]>([]);
  const [selectedResetEmp, setSelectedResetEmp] = useState<string>('all');
  const [isResetting, setIsResetting] = useState(false);

  const TARGET_START_TIME_HOUR = 8;
  const WORK_DAY_MS = 8 * 60 * 60 * 1000;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [employeesSnapshot, attendanceSnapshot, justificationsSnapshot] = await Promise.all([
            getDocs(collection(db, 'employees')),
            getDocs(collection(db, 'attendance')),
            getDocs(collection(db, 'justifications'))
        ]);
        
        setEmployees(employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        setAttendance(attendanceSnapshot.docs.map(doc => ({ ...doc.data() } as Attendance)));
        setJustifications(justificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const refreshJustifications = async () => {
    const justificationsSnapshot = await getDocs(collection(db, 'justifications'));
    setJustifications(justificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAnnulRecord = async (employeeId: string, date: string) => {
    const reason = activeTab === 'absences' ? 'Annulled' : 'AnnulledDelay';
    await addDoc(collection(db, 'justifications'), { employeeId, date, reason });
    await refreshJustifications();
    setSelectedEmployeeForAnnul(null);
  };

  const handleResetDelays = async () => {
    if (!confirm(`Deseja resetar os atrasos de ${selectedResetEmp === 'all' ? 'todos os funcionários' : 'o funcionário selecionado'}?`)) return;

    setIsResetting(true);
    const batch = writeBatch(db);
    const currentYear = new Date().getFullYear();
    const today = new Date();
    let operationsCount = 0;

    const employeesToReset = selectedResetEmp === 'all' 
        ? employees 
        : employees.filter(e => e.id === selectedResetEmp);

    for (const emp of employeesToReset) {
      const empAttendance = attendance.filter(a => a.employeeId === emp.id);
      
      let date = new Date(`${currentYear}-01-01`);
      while (date <= today) {
        const dateStr = date.toISOString().split('T')[0];
        
        const dailyRecords = empAttendance.filter(a => a.timestamp?.toDate().toISOString().startsWith(dateStr));
        const checkIns = dailyRecords.filter(r => r.type === 'checkIn').sort((a,b) => a.timestamp.seconds - b.timestamp.seconds);
        
        const earliestCheckIn = checkIns.length > 0 ? checkIns[0].timestamp.toDate() : null;
        let markedPresence = false;
        if (earliestCheckIn && earliestCheckIn.getHours() < 11) markedPresence = true;

        const isJustified = justifications.some(j => j.employeeId === emp.id && j.date === dateStr);
        
        // Reset Delay Only
        if (markedPresence && !isJustified && earliestCheckIn) {
            const targetTime = new Date(earliestCheckIn);
            targetTime.setHours(TARGET_START_TIME_HOUR, 0, 0, 0);
            if (earliestCheckIn > targetTime) {
                const docRef = doc(collection(db, 'justifications'));
                batch.set(docRef, { employeeId: emp.id, date: dateStr, reason: 'ResetDelay' });
                operationsCount++;
            }
        }
        
        date.setDate(date.getDate() + 1);
        if (operationsCount >= 450) break;
      }
      if (operationsCount >= 450) break;
    }
    
    if (operationsCount > 0) {
        await batch.commit();
        await refreshJustifications();
        alert(`Processo de reset de atrasos finalizado. ${operationsCount} atrasos foram resetados.`);
    } else {
        alert("Nenhum atraso encontrado para resetar.");
    }

    setIsResetting(false);
  };

  const handleReset = async () => {
    if (!confirm(`Deseja resetar ${selectedResetEmp === 'all' ? 'todos os funcionários' : 'o funcionário selecionado'}?`)) return;
    
    setIsResetting(true);
    const batch = writeBatch(db);
    const currentYear = new Date().getFullYear();
    const today = new Date();
    
    let operationsCount = 0;

    const employeesToReset = selectedResetEmp === 'all' 
        ? employees 
        : employees.filter(e => e.id === selectedResetEmp);

    for (const emp of employeesToReset) {
      const empAttendance = attendance.filter(a => a.employeeId === emp.id);
      
      let date = new Date(`${currentYear}-01-01`);
      while (date <= today) {
        const dateStr = date.toISOString().split('T')[0];

        const dailyRecords = empAttendance.filter(a => a.timestamp?.toDate().toISOString().startsWith(dateStr));
        const checkIns = dailyRecords.filter(r => r.type === 'checkIn').sort((a,b) => a.timestamp.seconds - b.timestamp.seconds);
        
        const earliestCheckIn = checkIns.length > 0 ? checkIns[0].timestamp.toDate() : null;
        
        let markedPresence = false;
        if (earliestCheckIn && earliestCheckIn.getHours() < 11) markedPresence = true;

        const isJustified = justifications.some(j => j.employeeId === emp.id && j.date === dateStr);
        
        // Reset Absence
        if (!markedPresence && !isJustified && date < today) {
            const docRef = doc(collection(db, 'justifications'));
            batch.set(docRef, { employeeId: emp.id, date: dateStr, reason: 'ResetAll' });
            operationsCount++;
        } 
        // Reset Delay
        else if (markedPresence && !isJustified && earliestCheckIn) {
            const targetTime = new Date(earliestCheckIn);
            targetTime.setHours(TARGET_START_TIME_HOUR, 0, 0, 0);
            if (earliestCheckIn > targetTime) {
                const docRef = doc(collection(db, 'justifications'));
                batch.set(docRef, { employeeId: emp.id, date: dateStr, reason: 'ResetDelay' });
                operationsCount++;
            }
        }
        
        // Advance date
        date.setDate(date.getDate() + 1);
        
        if (operationsCount >= 450) break;
      }
      if (operationsCount >= 450) break;
    }
    
    if (operationsCount > 0) {
        await batch.commit();
        await refreshJustifications();
    }

    setIsResetting(false);
    alert("Processo de reset finalizado.");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Relatório Mensal - ${selectedMonth}`, 14, 15);
    
    const tableColumn = ["Funcionário", "NIP", "Carga Horária", "Faltas"];
    const tableRows: any[] = [];

    processedData.forEach(e => {
      const rowData = [
        e.name,
        e.nip || '-',
        formatMs(e.totalDurationMs),
        e.absences.toString()
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
    });
    
    doc.save(`relatorio_${selectedMonth}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBulkAnnul = async () => {
    for (const date of selectedDaysForAnnul) {
        await addDoc(collection(db, 'justifications'), { employeeId: selectedEmployeeForAnnul!.id, date, reason: 'Annulled' });
    }
    await refreshJustifications();
    setSelectedEmployeeForAnnul(null);
    setSelectedDaysForAnnul([]);
  };


  const processedData = employees.map(emp => {
    const empAttendance = attendance.filter(a => a.employeeId === emp.id && a.timestamp?.toDate().toISOString().startsWith(selectedMonth));
    
    // Group by day to count absences and calculate worked time
    const daysInMonth = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate();
    let totalDurationMs = 0;
    let absences = 0;
    let totalDelayMs = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
            if (dateStr < todayStr) {
                const dailyRecords = empAttendance.filter(a => a.timestamp?.toDate().toISOString().startsWith(dateStr));
                
                const checkIns = dailyRecords.filter(r => r.type === 'checkIn').sort((a,b) => a.timestamp.seconds - b.timestamp.seconds);
                const checkOuts = dailyRecords.filter(r => r.type === 'checkOut').sort((a,b) => a.timestamp.seconds - b.timestamp.seconds);
                
                let markedPresence = false;
                const earliestCheckIn = checkIns.length > 0 ? checkIns[0].timestamp.toDate() : null;
                const isJustified = justifications.some(j => j.employeeId === emp.id && j.date === dateStr);
                
                if (earliestCheckIn) {
                    const inHour = earliestCheckIn.getHours();
                    if (inHour < 11) {
                        markedPresence = true;
                    }
                    
                    // Calculate delay only if not justified
                    if (!isJustified) {
                        const targetTime = new Date(earliestCheckIn);
                        targetTime.setHours(TARGET_START_TIME_HOUR, 0, 0, 0);
                        if (earliestCheckIn > targetTime) {
                            totalDelayMs += (earliestCheckIn.getTime() - targetTime.getTime());
                        }
                    }
                }
                
                // Logic for lunch break duration (1h30m = 90min)
                const LUNCH_DURATION_MS = 90 * 60 * 1000;
                for (let i = 0; i < Math.min(checkIns.length, checkOuts.length); i++) {
                    // Logic to identify lunch (assuming checkOut is lunch out, checkIn is lunch in)
                    // This is a simplified logic, checking if checkOut is around noon
                    const checkOutTime = checkOuts[i].timestamp.toDate();
                    const checkInTime = checkIns[i].timestamp.toDate();
                    
                    if (checkOutTime.getHours() >= 11 && checkOutTime.getHours() <= 14) {
                        const lunchDuration = checkInTime.getTime() - checkOutTime.getTime();
                        if (lunchDuration > LUNCH_DURATION_MS) {
                             const extraDelay = lunchDuration - LUNCH_DURATION_MS;
                             totalDelayMs += extraDelay;
                             totalDurationMs -= extraDelay; // Subtrair do tempo total
                        }
                    }
                }

                if (!markedPresence) {
                    // Check if justified
                    const isJustified = justifications.some(j => j.employeeId === emp.id && j.date === dateStr);
                    if (!isJustified) absences++;
                } else {
                    // Calculate duration for the day
                    for (let i = 0; i < Math.min(checkIns.length, checkOuts.length); i++) {
                        totalDurationMs += (checkOuts[i].timestamp.seconds - checkIns[i].timestamp.seconds) * 1000;
                    }
                }
            } else if (dateStr === todayStr) {
            // Calculate duration for today even if it's not over yet
            const dailyRecords = empAttendance.filter(a => a.timestamp?.toDate().toISOString().startsWith(dateStr));
            const checkIns = dailyRecords.filter(r => r.type === 'checkIn').sort((a,b) => a.timestamp.seconds - b.timestamp.seconds);
            const checkOuts = dailyRecords.filter(r => r.type === 'checkOut').sort((a,b) => a.timestamp.seconds - b.timestamp.seconds);
            
            for (let i = 0; i < Math.min(checkIns.length, checkOuts.length); i++) {
                totalDurationMs += (checkOuts[i].timestamp.seconds - checkIns[i].timestamp.seconds) * 1000;
            }
        }
    }

    const absencesFromDelays = Math.floor(totalDelayMs / WORK_DAY_MS);
    return { ...emp, totalDurationMs, absences, totalDelayMs, absencesFromDelays };
  }).filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 (e.nip && e.nip.toLowerCase().includes(searchQuery.toLowerCase())));

  const formatMs = (ms: number) => {
    const hrs = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  };

  if (loading) return <div className="p-8">Carregando relatórios mensais...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Relatórios Mensais</h1>
      <div className="flex mb-6 border-b">
         <button onClick={() => setActiveTab('absences')} className={`p-4 ${activeTab === 'absences' ? 'border-b-2 border-blue-600 font-bold' : ''}`}>Faltas por Ausência</button>
         <button onClick={() => setActiveTab('delays')} className={`p-4 ${activeTab === 'delays' ? 'border-b-2 border-blue-600 font-bold' : ''}`}>Faltas por Atraso</button>
      </div>
      <div className="mb-6 flex gap-4">
        <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded px-3 py-2"
        />
        <input 
            type="text" 
            placeholder="Buscar por nome ou NIP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded px-3 py-2 flex-grow"
        />
        <button onClick={handleExportPDF} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Exportar PDF</button>
        <button onClick={handlePrint} className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700">Imprimir</button>
        <button onClick={handleReset} disabled={isResetting} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400">
            {isResetting ? 'Resetando...' : 'Resetar Ausências'}
        </button>
      </div>
      {activeTab === 'absences' ? (
        <table id="report-table" className="w-full text-left border-collapse bg-white shadow rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
            <tr>
                <th className="p-4">Funcionário</th>
                <th className="p-4">NIP</th>
                <th className="p-4">Carga Horária Total</th>
                <th className="p-4">Faltas</th>
            </tr>
            </thead>
            <tbody>
            {processedData.map(e => (
                <tr key={e.id} className="border-t">
                <td className="p-4">{e.name}</td>
                <td className="p-4">{e.nip || '-'}</td>
                <td className="p-4">{formatMs(e.totalDurationMs)}</td>
                <td className="p-4">
                    {e.absences === 0 ? (
                        <span className="text-green-600 font-bold">Nenhuma</span>
                    ) : (
                        <div className="flex items-center gap-2">
                        <span className="text-red-600 font-bold">{e.absences}</span>
                        <button 
                            onClick={() => setSelectedEmployeeForAnnul(e)}
                            className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                        >
                            Anular
                        </button>
                        </div>
                    )}
                </td>
                </tr>
            ))}
            </tbody>
        </table>
      ) : (
        <>
            <div className="mb-4 flex gap-4">
                <select value={selectedResetEmp} onChange={(e) => setSelectedResetEmp(e.target.value)} className="border rounded px-3 py-2">
                    <option value="all">Todos os Funcionários</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button onClick={handleResetDelays} disabled={isResetting} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400">
                    {isResetting ? 'Resetando...' : 'Resetar Atrasos'}
                </button>
            </div>
            <table id="report-table-delays" className="w-full text-left border-collapse bg-white shadow rounded-lg overflow-hidden">
                <thead className="bg-slate-100">
                <tr>
                    <th className="p-4">Funcionário</th>
                    <th className="p-4">NIP</th>
                    <th className="p-4">Atraso Acumulado</th>
                    <th className="p-4">Faltas por Atraso</th>
                </tr>
                </thead>
                <tbody>
                {processedData.map(e => (
                    <tr key={e.id} className="border-t">
                    <td className="p-4">{e.name}</td>
                    <td className="p-4">{e.nip || '-'}</td>
                    <td className="p-4">{formatMs(e.totalDelayMs)}</td>
                    <td className="p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-red-600 font-bold">{e.absencesFromDelays}</span>
                            <button 
                                onClick={() => setSelectedEmployeeForAnnul(e)}
                                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                            >
                                Anular Atrasos
                            </button>
                        </div>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>
      )}
      {selectedEmployeeForAnnul && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h2 className="text-lg font-bold mb-4">Anular {activeTab === 'absences' ? 'faltas' : 'atrasos'} de {selectedEmployeeForAnnul.name}</h2>
            <div className="max-h-60 overflow-y-auto">
              {(() => {
                const availableDays = Array.from({ length: new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate() }, (_, i) => i + 1).filter(day => {
                    const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                    const dailyRecords = attendance.filter(a => a.employeeId === selectedEmployeeForAnnul.id && a.timestamp?.toDate().toISOString().startsWith(dateStr));
                    const checkIns = dailyRecords.filter(r => r.type === 'checkIn');
                    
                    const earliestCheckIn = checkIns.length > 0 ? checkIns[0].timestamp.toDate() : null;
                    
                    let isTarget = false;
                    
                    if (activeTab === 'absences') {
                        let markedPresence = false;
                        if (earliestCheckIn && earliestCheckIn.getHours() < 11) markedPresence = true;
                        
                        if (!markedPresence && dateStr < new Date().toISOString().split('T')[0]) {
                            isTarget = true;
                        }
                    } else {
                        // Logic for delays
                        if (earliestCheckIn) {
                            const targetTime = new Date(earliestCheckIn);
                            targetTime.setHours(TARGET_START_TIME_HOUR, 0, 0, 0);
                            if (earliestCheckIn > targetTime) {
                                isTarget = true;
                            }
                        }
                    }

                    if (isTarget) {
                        const isJustified = justifications.some(j => j.employeeId === selectedEmployeeForAnnul.id && j.date === dateStr);
                        return !isJustified;
                    }
                    return false;
                });
                return (
                    <>
                        <div className="py-2 border-b flex items-center gap-2">
                            <input type="checkbox" onChange={(e) => {
                                if (e.target.checked) setSelectedDaysForAnnul(availableDays.map(d => `${selectedMonth}-${d.toString().padStart(2, '0')}`));
                                else setSelectedDaysForAnnul([]);
                            }} checked={selectedDaysForAnnul.length === availableDays.length && availableDays.length > 0} />
                            <span>Selecionar Todos</span>
                        </div>
                        {availableDays.map(day => {
                            const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                            return (
                                <div key={day} className="flex justify-between items-center py-2 border-b">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" checked={selectedDaysForAnnul.includes(dateStr)} onChange={(e) => {
                                            if (e.target.checked) setSelectedDaysForAnnul([...selectedDaysForAnnul, dateStr]);
                                            else setSelectedDaysForAnnul(selectedDaysForAnnul.filter(d => d !== dateStr));
                                        }} />
                                        <span>{dateStr}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleAnnulRecord(selectedEmployeeForAnnul.id, dateStr)}
                                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                    >
                                        Anular
                                    </button>
                                </div>
                            )
                        })}
                    </>
                )
              })()}
            </div>
            <div className="mt-4 flex gap-2">
                <button onClick={() => { setSelectedEmployeeForAnnul(null); setSelectedDaysForAnnul([]); }} className="flex-1 bg-gray-200 py-2 rounded">Fechar</button>
                {selectedDaysForAnnul.length > 0 && (
                    <button onClick={handleBulkAnnul} className="flex-1 bg-red-600 text-white py-2 rounded">Anular Selecionados ({selectedDaysForAnnul.length})</button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
