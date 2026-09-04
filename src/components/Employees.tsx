import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

interface Employee {
  id: string;
  name: string;
  email: string;
  biometricId: string;
  nip: string;
  phoneNumber: string;
  role: string;
  photoUrl: string;
  password?: string;
  isActive?: boolean;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPasswordCheckModal, setShowPasswordCheckModal] = useState(false);
  const [passwordCheckInput, setPasswordCheckInput] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showTimeOptionsModal, setShowTimeOptionsModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [employeeToToggle, setEmployeeToToggle] = useState<Employee | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [tempPhotoFile, setTempPhotoFile] = useState<File | null>(null);
  const [tempPhotoPreview, setTempPhotoPreview] = useState<string | null>(null);
  const [photoUpdateTrigger, setPhotoUpdateTrigger] = useState(0);

  useEffect(() => {
    if (selectedEmployee) {
      setTempPhotoPreview(sessionStorage.getItem('tempPhotoPreview_' + selectedEmployee.id));
    } else {
      setTempPhotoPreview(null);
    }
  }, [selectedEmployee]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (showCameraModal) {
      startCamera();
    }
  }, [showCameraModal]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Erro ao acessar a câmera:", err);
      alert("Não foi possível acessar a câmera.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const takePhoto = async () => {
    console.log("Employees.tsx: takePhoto chamado!");
    if (!videoRef.current || !canvasRef.current) {
        console.error("Employees.tsx: takePhoto abortado - video ou canvas ausente");
        return;
    }

    const context = canvasRef.current.getContext('2d');
    if (context) {
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      canvasRef.current.toBlob((blob) => {
        if (!blob) {
            console.error("Employees.tsx: takePhoto - blob vazio");
            return;
        }
        const file = new File([blob], `profile_${Date.now()}.jpeg`, { type: 'image/jpeg' });
        console.log("Employees.tsx: takePhoto - arquivo criado:", file.name, file.size);
        setTempPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setTempPhotoPreview(base64data);
          sessionStorage.setItem('tempPhotoPreview_' + selectedEmployee?.id, base64data);
          setPhotoUpdateTrigger(prev => prev + 1);
          console.log("Employees.tsx: takePhoto - preview e trigger atualizados");
        };
        reader.readAsDataURL(blob);
        stopCamera();
        setShowCameraModal(false);
      }, 'image/jpeg', 0.7);
    }
  };

  const savePhoto = async () => {
    console.log("Employees.tsx: savePhoto chamado!");
    
    let fileToUpload = tempPhotoFile;
    
    // Fallback: tentar reconstruir o arquivo a partir do sessionStorage se tempPhotoFile estiver vazio
    if (!fileToUpload && selectedEmployee) {
        const storedPreview = sessionStorage.getItem('tempPhotoPreview_' + selectedEmployee.id);
        if (storedPreview) {
            console.log("Employees.tsx: Reconstruindo arquivo a partir do sessionStorage");
            const response = await fetch(storedPreview);
            const blob = await response.blob();
            fileToUpload = new File([blob], `profile_${Date.now()}.jpeg`, { type: 'image/jpeg' });
        }
    }

    if (!fileToUpload || !selectedEmployee) {
        console.error("Employees.tsx: savePhoto abortado - fileToUpload ou selectedEmployee ausente", {fileToUpload: !!fileToUpload, selectedEmployee: !!selectedEmployee});
        alert("Erro: Foto não encontrada. Por favor, tire a foto novamente.");
        return;
    }

    try {
      console.log("Employees.tsx: Iniciando upload do arquivo para Dropbox:", fileToUpload.name, "para funcionário:", selectedEmployee.id);
      
      const formData = new FormData();
      formData.append('photo', fileToUpload);
      formData.append('employeeId', selectedEmployee.id);

      const response = await fetch('https://biometrico-soyo-vmbh.onrender.com/api/upload-photo', {
          method: 'POST',
          body: formData
      });

      if (!response.ok) {
          throw new Error('Falha ao fazer upload da foto para o Dropbox.');
      }

      const { url } = await response.json();
      console.log("Employees.tsx: URL obtida do Dropbox:", url);
      
      // Armazena a URL no Firestore como referência
      await updateDoc(doc(db, 'employees', selectedEmployee.id), { photoUrl: url });
      console.log("Employees.tsx: Firestore atualizado com referência do Dropbox.");
      
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, photoUrl: url } : e));
      setSelectedEmployee(prev => prev ? { ...prev, photoUrl: url } : null);
      setTempPhotoFile(null);
      setTempPhotoPreview(null);
      sessionStorage.removeItem('tempPhotoPreview_' + selectedEmployee.id);
      setPhotoUpdateTrigger(prev => prev + 1);
      
      alert("Foto salva permanentemente com sucesso no Dropbox!");
    } catch (e: any) {
      console.error("Erro detalhado no upload ou salvamento:", e);
      alert(`Erro ao salvar foto: ${e.message || 'Erro desconhecido'}.`);
    }
  };

  const closeModals = () => {
    setShowTimeOptionsModal(false);
    setSelectedEmployee(null);
    setSuccessMessage(null);
  };

  const handleAdminLogin = async () => {
    if (adminUser === 'admin' && adminPass === 'R@ma,2027#') {
        if (employeeToToggle) {
            const newStatus = !employeeToToggle.isActive;
            try {
                await updateDoc(doc(db, 'employees', employeeToToggle.id), {
                    isActive: newStatus
                });
                setEmployees(employees.map(e => e.id === employeeToToggle.id ? {...e, isActive: newStatus} : e));
                if (selectedEmployee && selectedEmployee.id === employeeToToggle.id) {
                    setSelectedEmployee({...selectedEmployee, isActive: newStatus});
                }
                setAdminUser('');
                setAdminPass('');
                setShowAdminModal(false);
                setEmployeeToToggle(null);
            } catch (e) {
                console.error("Erro ao atualizar status:", e);
                alert("Erro ao atualizar status no banco de dados.");
            }
        }
    } else {
        alert('SENHA ERRADA');
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    setEmployeeToToggle(employee);
    setShowAdminModal(true);
  };

  const handleLogin = () => {
    if (!selectedEmployee) return;
    
    if (loginPassword === selectedEmployee.password) {
      setShowLoginModal(false);
      setShowTimeOptionsModal(true);
      setLoginPassword('');
    } else {
      alert('Senha incorreta.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    try {
      await updateDoc(doc(db, 'employees', editingEmployee.id), {
        name: editingEmployee.name,
        role: editingEmployee.role,
        email: editingEmployee.email,
        phoneNumber: editingEmployee.phoneNumber,
        biometricId: editingEmployee.biometricId,
        nip: editingEmployee.nip,
        password: editingEmployee.password
      });
      setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? editingEmployee : e));
      setSelectedEmployee(editingEmployee);
      setShowEditModal(false);
      setEditingEmployee(null);
      alert('Dados atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar funcionário:', error);
      alert('Erro ao atualizar funcionário.');
    }
  };

  const registerTime = async (type: 'checkIn' | 'checkOut' | 'lunchIn' | 'lunchOut') => {
    console.log('registerTime called with type:', type, 'selectedEmployee:', selectedEmployee);
    if (!selectedEmployee) {
        console.log('registerTime aborted: no selectedEmployee');
        return;
    }

    // Verificar se o funcionário está "Ausente" por não ter marcado até às 11h
    const now = new Date();
    const isAfter11AM = now.getHours() >= 11;
    
    console.log('Checking restriction:', { isAfter11AM, isActive: selectedEmployee.isActive });

    if (isAfter11AM && !selectedEmployee.isActive && type !== 'lunchIn' && type !== 'lunchOut') {
        console.log('registerTime: late check-in detected');
        alert("Você está atrasado, consulte o RH");
    }

    try {
      console.log('registerTime proceeding to addDoc');
      await addDoc(collection(db, 'attendance'), {
        employeeId: selectedEmployee.id,
        name: selectedEmployee.name,
        type: type,
        timestamp: serverTimestamp()
      });
      
      if (type === 'checkIn' || type === 'lunchOut') {
          await updateDoc(doc(db, 'employees', selectedEmployee.id), { isActive: true });
          setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? {...e, isActive: true} : e));
          if (selectedEmployee) {
              setSelectedEmployee({...selectedEmployee, isActive: true});
          }
      } else if (type === 'checkOut' || type === 'lunchIn') {
          await updateDoc(doc(db, 'employees', selectedEmployee.id), { isActive: false });
          setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? {...e, isActive: false} : e));
          if (selectedEmployee) {
              setSelectedEmployee({...selectedEmployee, isActive: false});
          }
      }
      
      console.log('Hora registrada com sucesso');
      setSuccessMessage(`Sua marcação foi bem-sucedida!\nHorário: ${now.toLocaleTimeString()}`);
    } catch (error) {
      console.error('Erro ao registrar:', error);
      alert('Erro ao registrar hora.');
    }
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'employees'));
        const employeesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isActive: doc.data().isActive !== undefined ? doc.data().isActive : false
        })) as Employee[];
        console.log('Employees.tsx: Funcionários carregados:', employeesList);
        setEmployees(employeesList);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Funcionários Cadastrados</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {!loading && employees.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="col-span-full flex justify-center py-16"
            >
              <motion.div
                animate={{
                  scale: [1, 1.03, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                whileHover={{ scale: 1.05 }}
                className="w-64 h-64 rounded-full bg-blue-50 flex items-center justify-center border-4 border-blue-100 shadow-lg"
              >
                <p className="text-blue-600 font-black text-center px-6 text-xl tracking-wide">
                  Nenhum cadastro efetuado
                </p>
              </motion.div>
            </motion.div>
          ) : (
            employees.map((employee) => (
              <div 
                key={employee.id}
                className={`relative flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition-transform hover:scale-105 bg-white/95 ${employee.isActive === false ? 'opacity-50' : ''}`}
                onClick={() => setSelectedEmployee(employee)}
              >
                <div className="absolute top-0 right-0 p-2 z-10">
                  <button
                    className={`text-xs px-2 py-1 rounded-md ${employee.isActive ? 'bg-green-600' : 'bg-red-600'} text-white shadow-sm hover:scale-105 transition-transform`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEmployeeStatus(employee);
                    }}
                  >
                    {employee.isActive ? 'Presente' : 'Ausente'}
                  </button>
                </div>
                <div className={`w-24 h-24 rounded-full overflow-hidden border-4 ${employee.isActive ? 'border-green-100' : 'border-red-100'} shadow-md`}>
                  <img 
                    key={(() => {
                      const stored = sessionStorage.getItem('tempPhotoPreview_' + employee.id);
                      return (stored ? stored : (employee.photoUrl || 'default')) + photoUpdateTrigger;
                    })()}
                    src={(() => {
                      const stored = sessionStorage.getItem('tempPhotoPreview_' + employee.id);
                      if (stored) {
                        return stored;
                      }
                      return (employee.photoUrl && employee.photoUrl.trim() !== '' ? employee.photoUrl : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(employee.name) + '&background=random');
                    })()}
                    alt={employee.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150';
                    }}
                  />
                </div>
                <span className="font-semibold text-slate-800 text-center text-sm">{employee.name}</span>
              </div>
            ))
          )}
        </div>

        {selectedEmployee && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-40">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
              <h2 className="text-xl font-bold mb-6 text-center">Perfil do Funcionário</h2>
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-100 shadow-md relative group cursor-pointer"
                  onClick={() => setShowCameraModal(true)}
                >
                  <img 
                    key={selectedEmployee.photoUrl || 'default'}
                    src={tempPhotoPreview || (selectedEmployee.name === "Nelson Zua" ? "/assets/camera_20260704_121101.png" : (selectedEmployee.photoUrl && selectedEmployee.photoUrl.trim() !== '' ? selectedEmployee.photoUrl : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedEmployee.name) + '&background=random'))} 
                    alt={selectedEmployee.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedEmployee.name) + '&background=random';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs p-2 text-center">
                    Tirar Foto
                  </div>
                </div>
                {tempPhotoPreview && (
                  <button 
                    onClick={savePhoto}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors w-full"
                  >
                    Salvar Foto
                  </button>
                )}
                <h3 className="text-lg font-bold text-slate-900">{selectedEmployee.name}</h3>
                <div className="text-sm text-slate-600 text-left w-full space-y-1">
                  <p><strong>Cargo:</strong> {selectedEmployee.role}</p>
                  <p><strong>Status:</strong> <span className={selectedEmployee.isActive ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{selectedEmployee.isActive ? 'Presente' : 'Ausente'}</span></p>
                </div>
              </div>
              <button 
                className="mt-8 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => setShowLoginModal(true)}
              >
                Marcar Hora
              </button>
              <button 
                className="mt-2 w-full bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600 transition-colors"
                onClick={() => {
                  setEditingEmployee(selectedEmployee);
                  setShowPasswordCheckModal(true);
                }}
              >
                Editar Funcionário
              </button>
              <button 
                className="mt-4 w-full bg-slate-900 text-white py-2 rounded-lg"
                onClick={() => {
                  setSelectedEmployee(null);
                  setShowLoginModal(false);
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}



        {showPasswordCheckModal && editingEmployee && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Senha do Funcionário</h2>
              <input 
                type="password" 
                placeholder="Senha" 
                value={passwordCheckInput} 
                onChange={(e) => setPasswordCheckInput(e.target.value)} 
                className="w-full p-2 border rounded" 
              />
              <div className="flex gap-4">
                <button 
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  onClick={() => {
                    if (passwordCheckInput === editingEmployee.password) {
                      setShowPasswordCheckModal(false);
                      setShowEditModal(true);
                      setPasswordCheckInput('');
                    } else {
                      alert('SENHA ERRADA');
                    }
                  }}
                >
                  Confirmar
                </button>
                <button 
                  className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300"
                  onClick={() => {
                    setShowPasswordCheckModal(false);
                    setEditingEmployee(null);
                    setPasswordCheckInput('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && editingEmployee && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Editar Funcionário</h2>
              <input type="text" value={editingEmployee.name} onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})} className="w-full p-2 border rounded" placeholder="Nome" />
              <input type="text" value={editingEmployee.role} onChange={e => setEditingEmployee({...editingEmployee, role: e.target.value})} className="w-full p-2 border rounded" placeholder="Cargo" />
              <input type="email" value={editingEmployee.email} onChange={e => setEditingEmployee({...editingEmployee, email: e.target.value})} className="w-full p-2 border rounded" placeholder="Email" />
              <input type="text" value={editingEmployee.phoneNumber} onChange={e => setEditingEmployee({...editingEmployee, phoneNumber: e.target.value})} className="w-full p-2 border rounded" placeholder="Telefone" />
              <input type="text" value={editingEmployee.biometricId || ''} onChange={e => setEditingEmployee({...editingEmployee, biometricId: e.target.value})} className="w-full p-2 border rounded" placeholder="ID Biométrico" />
              <input type="text" value={editingEmployee.nip || ''} onChange={e => setEditingEmployee({...editingEmployee, nip: e.target.value})} className="w-full p-2 border rounded" placeholder="NIP" />
              <input type="text" value={editingEmployee.password || ''} onChange={e => setEditingEmployee({...editingEmployee, password: e.target.value})} className="w-full p-2 border rounded" placeholder="Senha" />
              <div className="flex gap-4 pt-4">
                <button className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700" onClick={handleSaveEdit}>Salvar</button>
                <button className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300" onClick={() => setShowEditModal(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {showCameraModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Tirar Foto</h2>
              <video ref={videoRef} className="w-full h-auto rounded-lg bg-slate-200" autoPlay playsInline />
              <canvas ref={canvasRef} width="640" height="480" className="hidden" />
              <div className="flex gap-4 justify-center">
                <button
                  className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700"
                  onClick={takePhoto}
                >
                  Tirar Foto
                </button>
                <button
                  className="bg-slate-200 text-slate-800 px-8 py-2 rounded-lg hover:bg-slate-300"
                  onClick={() => {
                    stopCamera();
                    setShowCameraModal(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showAdminEditModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Senha do Administrador</h2>
              <input 
                type="text" 
                placeholder="Usuário Admin" 
                value={adminUser} 
                onChange={(e) => setAdminUser(e.target.value)} 
                className="w-full p-2 border rounded" 
              />
              <input 
                type="password" 
                placeholder="Senha Admin" 
                value={adminPass} 
                onChange={(e) => setAdminPass(e.target.value)} 
                className="w-full p-2 border rounded" 
              />
              <div className="flex gap-4">
                <button 
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  onClick={() => {
                    if (adminUser === 'admin' && adminPass === 'R@ma,2027#') {
                      setShowAdminEditModal(false);
                      setShowEditModal(true);
                      setAdminUser('');
                      setAdminPass('');
                    } else {
                      alert('SENHA ERRADA');
                    }
                  }}
                >
                  Confirmar
                </button>
                <button 
                  className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300"
                  onClick={() => {
                    setShowAdminEditModal(false);
                    setEditingEmployee(null);
                    setAdminUser('');
                    setAdminPass('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showAdminModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Login de Administrador</h2>
              <input 
                type="text" 
                placeholder="Usuário Admin" 
                value={adminUser} 
                onChange={(e) => setAdminUser(e.target.value)} 
                className="w-full p-2 border rounded" 
              />
              <input 
                type="password" 
                placeholder="Senha Admin" 
                value={adminPass} 
                onChange={(e) => setAdminPass(e.target.value)} 
                className="w-full p-2 border rounded" 
              />
              <div className="flex gap-4">
                <button 
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  onClick={handleAdminLogin}
                >
                  Confirmar
                </button>
                <button 
                  className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300"
                  onClick={() => {
                    setShowAdminModal(false);
                    setEmployeeToToggle(null);
                    setAdminUser('');
                    setAdminPass('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showLoginModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold mb-4 text-center">Senha do Funcionário</h2>
              <input 
                type="password" 
                placeholder="Senha" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                className="w-full p-2 border rounded" 
              />
              <div className="flex gap-4">
                <button 
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                  onClick={handleLogin}
                >
                  Confirmar
                </button>
                <button 
                  className="flex-1 bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300"
                  onClick={() => setShowLoginModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        {showTimeOptionsModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
              {successMessage ? (
                <div className="text-center space-y-4">
                  <p className="text-green-600 font-bold text-lg whitespace-pre-line">{successMessage}</p>
                  <button 
                    className="w-full bg-slate-900 text-white py-2 rounded-lg"
                    onClick={closeModals}
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold mb-4 text-center">Registrar Ponto</h2>
                  <button 
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
                    onClick={() => registerTime('checkIn')}
                  >
                    Hora de Entrada
                  </button>
                  <button 
                    className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600"
                    onClick={() => registerTime('lunchIn')}
                  >
                    Hora da Refeição
                  </button>
                  <button 
                    className="w-full bg-sky-500 text-white py-3 rounded-lg hover:bg-sky-600"
                    onClick={() => registerTime('lunchOut')}
                  >
                    Retorno da Refeição
                  </button>
                  <button 
                    className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700"
                    onClick={() => registerTime('checkOut')}
                  >
                    Hora de Saída
                  </button>
                  <button 
                    className="w-full bg-slate-200 text-slate-800 py-2 rounded-lg hover:bg-slate-300"
                    onClick={() => setShowTimeOptionsModal(false)}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
  );
}
