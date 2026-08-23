import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showTimeOptionsModal, setShowTimeOptionsModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [employeeToToggle, setEmployeeToToggle] = useState<Employee | null>(null);
  const [loginBiometricId, setLoginBiometricId] = useState('');
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
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (context) {
      context.drawImage(videoRef.current, 0, 0, 640, 480);
      canvasRef.current.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `profile_${Date.now()}.jpeg`, { type: 'image/jpeg' });
        setTempPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setTempPhotoPreview(base64data);
          sessionStorage.setItem('tempPhotoPreview_' + selectedEmployee.id, base64data);
          setPhotoUpdateTrigger(prev => prev + 1);
        };
        reader.readAsDataURL(blob);
        stopCamera();
        setShowCameraModal(false);
      }, 'image/jpeg', 0.7);
    }
  };

  const savePhoto = async () => {
    console.log("Employees.tsx: savePhoto chamado!");
    if (!tempPhotoFile || !selectedEmployee) {
        console.log("Employees.tsx: savePhoto abortado - tempPhotoFile ou selectedEmployee ausente", {tempPhotoFile: !!tempPhotoFile, selectedEmployee: !!selectedEmployee});
        return;
    }

    try {
      console.log("Employees.tsx: Iniciando upload do arquivo:", tempPhotoFile.name);
      const storageRef = ref(storage, `employees/${selectedEmployee.id}.jpeg`);
      
      console.log("Employees.tsx: Chamando uploadBytes...");
      await uploadBytes(storageRef, tempPhotoFile);
      console.log("Employees.tsx: uploadBytes sucesso.");
      
      const photoUrl = await getDownloadURL(storageRef);
      console.log("Employees.tsx: URL obtida:", photoUrl);
      
      await updateDoc(doc(db, 'employees', selectedEmployee.id), { photoUrl });
      console.log("Employees.tsx: Firestore atualizado.");
      
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, photoUrl } : e));
      setSelectedEmployee(prev => prev ? { ...prev, photoUrl } : null);
      setTempPhotoFile(null);
      setTempPhotoPreview(null);
      sessionStorage.removeItem('tempPhotoPreview_' + selectedEmployee.id);
      setPhotoUpdateTrigger(prev => prev + 1);
      
      alert("Foto atualizada com sucesso!");
    } catch (e: any) {
      console.error("Erro detalhado no upload:", e);
      alert(`Erro ao atualizar foto: ${e.message || 'Erro desconhecido'}.`);
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
    
    if (loginBiometricId === selectedEmployee.biometricId && loginPassword === selectedEmployee.password) {
      setShowLoginModal(false);
      setShowTimeOptionsModal(true);
      setLoginBiometricId('');
      setLoginPassword('');
    } else {
      alert('Biometric ID ou Senha incorretos.');
    }
  };

  const registerTime = async (type: 'checkIn' | 'checkOut') => {
    if (!selectedEmployee) return;
    try {
      const now = new Date();
      await addDoc(collection(db, 'attendance'), {
        employeeId: selectedEmployee.id,
        name: selectedEmployee.name,
        type: type,
        timestamp: serverTimestamp()
      });
      
      if (type === 'checkIn') {
          await updateDoc(doc(db, 'employees', selectedEmployee.id), { isActive: true });
          setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? {...e, isActive: true} : e));
          if (selectedEmployee) {
              setSelectedEmployee({...selectedEmployee, isActive: true});
          }
      } else if (type === 'checkOut') {
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
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Funcionários Cadastrados</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
        {employees.map((employee) => (
          <div 
            key={employee.id}
            className={`relative flex flex-col items-center gap-3 p-4 border rounded-xl cursor-pointer transition-transform hover:scale-105 ${employee.isActive === false ? 'opacity-50' : ''}`}
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
        ))}
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
            <h2 className="text-xl font-bold mb-4 text-center">Login</h2>
            <input 
              type="text" 
              placeholder="Biometric ID" 
              value={loginBiometricId} 
              onChange={(e) => setLoginBiometricId(e.target.value)} 
              className="w-full p-2 border rounded" 
            />
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
