import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import logoImage from '../../assets/images.png';
import bgImage from '../../src/assets/images/empresário-verificando-o-tempo-olhando-relógio-de-pulso-parado-no-aeroporto-panorama-viagem-negócios-negro-com-mala-verificar-185816105.webp';
import DigitalNeonClock from './DigitalNeonClock';
import { Users, UserX } from 'lucide-react';

export default function Dashboard() {
  const [presentCount, setPresentCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'employees'));
        const employees = querySnapshot.docs.map(doc => ({
          isActive: doc.data().isActive
        }));
        
        const present = employees.filter(e => e.isActive === true).length;
        const absent = employees.filter(e => e.isActive === false || e.isActive === undefined).length;
        
        setPresentCount(present);
        setAbsentCount(absent);
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <div className="relative min-h-screen p-8">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
      </div>

      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-4">
          <img src={logoImage} alt="Logo Teleservice" className="h-20 w-auto" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bem-vindo ao Biométrico Região-Soyo</h1>
            <p className="text-slate-500 mt-2">Gerenciamento completo de registros de entrada e saída.</p>
          </div>
        </div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Painel de Controle</h2>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card Presentes */}
            <div className="group bg-white/80 p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-emerald-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users size={48} className="text-emerald-600" />
              </div>
              <div className="text-emerald-600 text-xs font-bold uppercase mb-2 tracking-wider">Presentes Agora</div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-extrabold text-slate-900">
                  {loading ? '...' : presentCount}
                </div>
                <div className="text-emerald-600 font-medium text-sm">funcionários</div>
              </div>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
              </div>
            </div>
    
            {/* Card Ausentes */}
            <div className="group bg-white/80 p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:border-rose-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <UserX size={48} className="text-rose-600" />
              </div>
              <div className="text-rose-600 text-xs font-bold uppercase mb-2 tracking-wider">Ausentes</div>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-extrabold text-slate-900">
                  {loading ? '...' : absentCount}
                </div>
                <div className="text-rose-600 font-medium text-sm">funcionários</div>
              </div>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
          
          <div className="w-full">
            <DigitalNeonClock />
          </div>
        </div>
      </div>
    </div>
  );
}
