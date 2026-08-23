import React from 'react';

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Bem-vindo ao Biométrico Região-Soyo</h1>
        <p className="text-slate-500 mt-2">Gerenciamento completo de registros de entrada e saída.</p>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Painel de Controle</h2>
      </div>
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-bold uppercase mb-2 tracking-wide">Presentes Agora</div>
          <div className="text-3xl font-bold text-slate-900">142</div>
        </div>
      </div>
    </div>
  );
}
