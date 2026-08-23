import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

interface Employee {
  id: string;
  name: string;
  role: string;
  isActive?: boolean;
}

interface Attendance {
  employeeId: string;
  type: 'checkIn' | 'checkOut';
  timestamp: any;
}

interface AttendancePair {
  checkIn?: string;
  checkOut?: string;
}

export default function Reports() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const dateString = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        const empList = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
        setEmployees(empList);

        const attSnap = await getDocs(collection(db, 'attendance'));
        const attList = attSnap.docs.map(d => d.data() as Attendance);
        setAttendance(attList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getTodayStatus = (employeeId: string) => {
    const today = new Date().toDateString();
    const records = attendance
      .filter(a => a.employeeId === employeeId && a.timestamp?.toDate().toDateString() === today)
      .sort((a, b) => a.timestamp?.toMillis() - b.timestamp?.toMillis());

    const pairs: AttendancePair[] = [];
    let currentPair: AttendancePair = {};

    records.forEach(r => {
      const time = r.timestamp?.toDate().toLocaleTimeString();
      if (r.type === 'checkIn') {
        if (currentPair.checkIn) {
            pairs.push(currentPair);
            currentPair = {};
        }
        currentPair.checkIn = time;
      } else if (r.type === 'checkOut') {
        currentPair.checkOut = time;
        pairs.push(currentPair);
        currentPair = {};
      }
    });
    if (currentPair.checkIn) pairs.push(currentPair);
    
    const lastEvent = records[records.length - 1];
    const isActive = lastEvent?.type === 'checkIn';

    return { pairs, isActive };
  };

  const processedEmployees = employees.map(emp => ({
    ...emp,
    ...getTodayStatus(emp.id),
    isActive: emp.isActive !== undefined ? emp.isActive : true
  }));

  const filtered = processedEmployees.filter(e => activeTab === 'active' ? e.isActive : !e.isActive);

  if (loading) return <div className="p-8">Carregando relatórios...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Relatórios Diários</h1>
      <p className="text-gray-600 mb-6 capitalize">Relatório de {dateString}</p>
      
      <div className="flex space-x-4 mb-6">
        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Ativos</button>
        <button onClick={() => setActiveTab('inactive')} className={`px-4 py-2 rounded ${activeTab === 'inactive' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Inativos/Folga</button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="py-2">Funcionário</th>
            <th className="py-2">Cargo</th>
            <th className="py-2">Registros (Entrada / Saída)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id} className="border-b">
              <td className="py-2">{e.name}</td>
              <td className="py-2">{e.role}</td>
              <td className="py-2">
                {e.pairs.map((p, i) => (
                  <div key={i} className="text-sm">
                    Entrada {i + 1}: {p.checkIn || '-'} / Saída {i + 1}: {p.checkOut || '-'}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
