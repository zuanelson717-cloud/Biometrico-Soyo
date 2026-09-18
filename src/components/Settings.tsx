import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import bgImage from '../../src/assets/images/empresário-verificando-o-tempo-olhando-relógio-de-pulso-parado-no-aeroporto-panorama-viagem-negócios-negro-com-mala-verificar-185816105.webp';
import nelsonImage from '../../src/assets/nelson_zua.jpg';
import { useLanguage } from '../context/LanguageContext';

interface Employee {
  id: string;
  name: string;
}

export default function Settings() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { language, setLanguage, t } = useLanguage();
  const [selectedEmployeeToDelete, setSelectedEmployeeToDelete] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      const querySnapshot = await getDocs(collection(db, 'employees'));
      const employeesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Employee[];
      setEmployees(employeesList);
    };
    fetchEmployees();
  }, []);

  const handleDelete = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'employees', id));
        setEmployees(employees.filter(e => e.id !== id));
        setSelectedEmployeeToDelete('');
        setSuccessMessage('Funcionário apagado com sucesso!');
        setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
        console.error('Erro ao apagar funcionário:', error);
        alert('Erro ao apagar funcionário. Verifique as permissões.');
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-sm"></div>
      </div>

      <div className="relative z-10 p-8 space-y-8">
        <h1 className="text-2xl font-bold">{t('settings')}</h1>

        <section>
          <h2 className="text-lg font-semibold">{t('language')}</h2>
          <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as any)}
              className="border rounded px-3 py-2 mt-2"
          >
              <option value="PT">Português</option>
              <option value="EN">English</option>
              <option value="FR">Français</option>
          </select>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('aboutApk')}</h2>
          <p className="text-gray-600 mt-2">{t('version')}</p>
          <p className="text-gray-600 mt-2">{t('creator')}</p>
          <img src={nelsonImage} alt="Nelson Zua" className="w-32 h-32 rounded-full object-cover mt-4" />
        </section>

        <section>
          <h2 className="text-lg font-semibold">{t('deleteEmployees')}</h2>
          {successMessage && (
              <div className="bg-green-100 text-green-800 p-2 rounded mt-2 mb-2">
                  {successMessage}
              </div>
          )}
          <div className="flex gap-4 mt-2">
              <select 
                  className="border rounded px-3 py-2 flex-grow"
                  onChange={(e) => setSelectedEmployeeToDelete(e.target.value)}
                  value={selectedEmployeeToDelete}
              >
                  <option value="">{t('selectEmployee')}</option>
                  {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
              </select>
              <button 
                  onClick={() => {
                      if (selectedEmployeeToDelete) handleDelete(selectedEmployeeToDelete);
                  }}
                  disabled={!selectedEmployeeToDelete}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
              >
                  {t('delete')}
              </button>
          </div>
        </section>
      </div>
    </div>
  );
}
