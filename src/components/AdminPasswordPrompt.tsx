import React, { useState } from 'react';

interface Props {
  onConfirm: (user: string, pass: string) => void;
  onCancel: () => void;
}

export default function AdminPasswordPrompt({ onConfirm, onCancel }: Props) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
        <h2 className="text-xl font-bold mb-4 text-center">Senha do Administrador</h2>
        <input 
          type="text" 
          placeholder="Usuário Admin" 
          value={user} 
          onChange={(e) => setUser(e.target.value)} 
          className="w-full p-2 border rounded" 
        />
        <input 
          type="password" 
          placeholder="Senha Admin" 
          value={pass} 
          onChange={(e) => setPass(e.target.value)} 
          className="w-full p-2 border rounded" 
        />
        <div className="flex gap-4">
          <button 
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            onClick={() => onConfirm(user, pass)}
          >
            Confirmar
          </button>
          <button 
            className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
