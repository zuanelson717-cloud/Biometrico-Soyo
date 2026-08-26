import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee, Attendance } from '../types';

interface AttendancePair {
  checkInId?: string;
  checkOutId?: string;
  checkIn?: Date;
  checkOut?: Date;
  checkInStr?: string;
  checkOutStr?: string;
  extraTimeMs?: number;
}

export default function Reports() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'present' | 'absent' | 'refeicao'>('present');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [justifications, setJustifications] = useState<any[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const deleteSelectedLunchPairs = async () => {
      if (selectedForDeletion.length === 0) return;
      if (!confirm(`Deseja apagar ${selectedForDeletion.length} registros de refeição selecionados?`)) return;
      try {
          console.log('Iniciando deleção dos IDs:', selectedForDeletion);
          for (const id of selectedForDeletion) {
              console.log('Tentando apagar documento:', id);
              await deleteDoc(doc(db, 'attendance', id));
              console.log('Documento apagado:', id);
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
      // Verifica se pelo menos um dos IDs do par já está selecionado
      const isSelected = ids.some(id => selectedForDeletion.includes(id));
      
      setSelectedForDeletion(prev => 
          isSelected 
            ? prev.filter(id => !ids.includes(id)) 
            : [...prev, ...ids]
      );
  };

  const formatDuration = (ms: number) => {
      const hrs = Math.floor(ms / (1000 * 60 * 60));
      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hrs}h ${mins}m`;
  };

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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

    return { pairs, lunchPairs, isActive, isAbsent, totalDurationMs };
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
    doc.text(`Relatório Diário - ${selectedDate}`, 14, 10);
    
    const tableData = filtered.map(e => {
        const eightHoursMs = 8 * 60 * 60 * 1000;
        
        const totalStr = formatDuration(e.totalDurationMs);
        let durationStr = e.totalDurationMs > 0 ? totalStr : '-';
        if (e.totalDurationMs > eightHoursMs) {
            const extraTimeMs = e.totalDurationMs - eightHoursMs;
            durationStr = `${totalStr} +${formatDuration(extraTimeMs)}`;
        }
        
        return [
            e.name,
            e.nip || '-',
            e.role,
            e.pairs.map(p => `Entrada: ${p.checkInStr || '-'} | Saída: ${p.checkOutStr || '-'}`).join('\n'),
            durationStr
        ];
    });

    autoTable(doc, {
        head: [['Funcionário', 'NIP', 'Cargo', 'Registros', 'Carga Horária']],
        body: tableData,
    });

    doc.save(`relatorio_${selectedDate}.pdf`);
  };

  if (loading) return <div className="p-8">Carregando relatórios...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Relatórios Diários</h1>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
            <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded px-3 py-2"
            />
            <input 
                type="text" 
                placeholder="Buscar por nome ou NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded px-3 py-2"
            />
            <div className="flex space-x-2">
                <button onClick={() => setActiveTab('present')} className={`px-4 py-2 rounded ${activeTab === 'present' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Presentes</button>
                <button onClick={() => setActiveTab('absent')} className={`px-4 py-2 rounded ${activeTab === 'absent' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Ausentes</button>
                <button onClick={() => setActiveTab('refeicao')} className={`px-4 py-2 rounded ${activeTab === 'refeicao' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Refeição</button>
            </div>
        </div>
        <div className="flex space-x-2">
            <button 
                onClick={handlePrint}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
            >
                Imprimir
            </button>
            <button 
                onClick={handleDownloadPDF}
                className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900"
            >
                Gerar PDF
            </button>
            {activeTab === 'refeicao' && (
                <button 
                    onClick={() => {
                        if (isDeleteMode) deleteSelectedLunchPairs();
                        setIsDeleteMode(!isDeleteMode);
                        setSelectedForDeletion([]);
                    }}
                    className={`${isDeleteMode ? 'bg-red-700' : 'bg-red-500'} text-white px-4 py-2 rounded hover:bg-red-800`}
                >
                    {isDeleteMode ? 'Confirmar Deleção' : 'Apagar Refeições'}
                </button>
            )}
        </div>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            {isDeleteMode && activeTab === 'refeicao' && <th className="py-2"></th>}
            <th className="py-2">Funcionário</th>
            <th className="py-2">NIP</th>
            <th className="py-2">Cargo</th>
            <th className="py-2">
                {activeTab === 'refeicao' ? 'Registros (Refeição)' : 'Registros (Entrada / Saída)'}
            </th>
            <th className="py-2">Carga Horária</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id} className="border-b">
              {isDeleteMode && activeTab === 'refeicao' && <td className="py-2"></td>}
              <td className="py-2">{e.name}</td>
              <td className="py-2">{e.nip || '-'}</td>
              <td className="py-2">{e.role}</td>
              <td className="py-2">
                <div className="flex flex-col gap-1">
                  {activeTab === 'refeicao' ? (
                      e.lunchPairs.length > 0 ? (
                        e.lunchPairs.map((p, i) => {
                            const pairId = p.checkInId; // Use checkInId as identifier
                            const isSelected = selectedForDeletion.includes(pairId || '');
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
              <td className="py-2 text-xs">
                {activeTab !== 'refeicao' && e.totalDurationMs > 0 ? (() => {
                    const eightHoursMs = 8 * 60 * 60 * 1000;
                    
                    const formatMs = (ms: number) => {
                        const hrs = Math.floor(ms / (1000 * 60 * 60));
                        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                        return `${hrs}h ${mins}m`;
                    };
                    
                    const totalStr = formatMs(e.totalDurationMs);
                    
                    if (e.totalDurationMs > eightHoursMs) {
                        const extraTimeMs = e.totalDurationMs - eightHoursMs;
                        return (
                            <span className="font-bold text-slate-900">
                                {totalStr} <span className="text-green-600">+{formatMs(extraTimeMs)}</span>
                            </span>
                        );
                    } else {
                        return <span className="text-slate-900">{totalStr}</span>;
                    }
                })() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

