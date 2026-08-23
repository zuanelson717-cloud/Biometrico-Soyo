import React, { useState, useRef, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

export default function Cadastro() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [biometricId, setBiometricId] = useState('');
  const [nip, setNip] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    console.log('handleSubmit: Iniciando processo de cadastro');
    try {
      let photoUrl = '';

      // 1. Criar o registro do funcionário no Firestore
      await addDoc(collection(db, 'employees'), {
        name,
        email,
        biometricId,
        nip,
        phoneNumber,
        role,
        password,
        photoUrl,
        createdAt: new Date()
      });

      setSuccessMessage('Cadastro efetuado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Reset form
      setName('');
      setEmail('');
      setBiometricId('');
      setNip('');
      setPhoneNumber('');
      setRole('');
      setPassword('');
      
    } catch (error) {
      console.error('handleSubmit: ERRO CRÍTICO NO CADASTRO:', error);
      alert('Erro ao cadastrar funcionário. Verifique o console para detalhes técnicos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Cadastro de Funcionário</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-lg">
        <input type="text" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="text" placeholder="Biometric ID" value={biometricId} onChange={(e) => setBiometricId(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="text" placeholder="NIP" value={nip} onChange={(e) => setNip(e.target.value)} className="w-full p-2 border rounded" required />
        <input type="tel" placeholder="Número Telefônico" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full p-2 border rounded" />
        <input type="text" placeholder="Cargo" value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 border rounded" />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded" required />
        
        {successMessage && (
          <p className="text-green-600 text-center font-bold animate-pulse">{successMessage}</p>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`w-full text-white px-4 py-2 rounded ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>
    </div>
  );
}
