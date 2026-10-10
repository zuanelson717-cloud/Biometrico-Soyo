import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import logoImage from '../assets/nelson_zua.jpg';
import bgImage from '../assets/images/empresário-verificando-o-tempo-olhando-relógio-de-pulso-parado-no-aeroporto-panorama-viagem-negócios-negro-com-mala-verificar-185816105.webp';
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

      <div className="relative z-10 h-full gap-4 md:max-w-4xl md:mx-auto">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Logo Teleservice" className="h-12 w-auto" />
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-slate-900">{t('welcome')}</h1>
            <p className="text-slate-600 text-lg font-medium">{t('description')}</p>
          </div>
        </div>
        
        <h2 className="text-lg font-bold text-slate-800">{t('controlPanel')}</h2>
        
        <div className="overflow-hidden w-full bg-slate-900/40 text-cyan-300 py-2 rounded-lg my-2 border border-slate-700/50">
          <motion.div
            className="whitespace-nowrap font-black text-lg tracking-widest uppercase"
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            Seja pontual, chegar cedo é um ato de disciplina no trabalho.
          </motion.div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        
        <div className="w-full mt-8">
            <DigitalNeonClock />
        </div>
      </div>
    </div>
  );
}
