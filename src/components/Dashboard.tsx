import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import logoImage from '../../assets/images.png';
import bgImage from '../../src/assets/images/empresário-verificando-o-tempo-olhando-relógio-de-pulso-parado-no-aeroporto-panorama-viagem-negócios-negro-com-mala-verificar-185816105.webp';
import DigitalNeonClock from './DigitalNeonClock';
import { useLanguage } from '../context/LanguageContext';

export default function Dashboard() {
  const { t } = useLanguage();
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
    <div className="relative min-h-screen p-4">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-contain bg-center bg-no-repeat opacity-100"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
      </div>

      <div className="relative z-10 flex flex-col h-full gap-4">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Logo Teleservice" className="h-12 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('welcome')}</h1>
            <p className="text-slate-500 text-sm">{t('description')}</p>
          </div>
        </div>
        
        <h2 className="text-lg font-bold text-slate-800">{t('controlPanel')}</h2>
        
        <div className="grid grid-cols-2 gap-4">
            {/* Card Presentes */}
            <div className="group bg-white/90 p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="text-emerald-600 text-xs font-bold uppercase mb-1 tracking-wider">{t('presentNow')}</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-extrabold text-slate-900">
                  {loading ? '...' : presentCount}
                </div>
                <div className="text-emerald-600 font-medium text-xs">{t('employeesLabel')}</div>
              </div>
            </div>
    
            {/* Card Ausentes */}
            <div className="group bg-white/90 p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="text-rose-600 text-xs font-bold uppercase mb-1 tracking-wider">{t('absent')}</div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-extrabold text-slate-900">
                  {loading ? '...' : absentCount}
                </div>
                <div className="text-rose-600 font-medium text-xs">{t('employeesLabel')}</div>
              </div>
            </div>
        </div>
        
        <div className="w-full">
            <DigitalNeonClock />
        </div>
      </div>
    </div>
  );
}
