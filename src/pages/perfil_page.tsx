import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { Shield, ChevronLeft, X, Moon, Sun, ShieldCheck } from 'lucide-react';
import { ProfilePhotoUpload } from '@/components/profile-photo-upload';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

interface PerfilPageProps {
  user: User;
  refetch: () => void;
  onBackToConfig: () => void;
  onBackToHome: () => void;
}

export function PerfilPage({ user, refetch, onBackToConfig, onBackToHome }: PerfilPageProps) {
  const [profileNome, setProfileNome] = useState(user.nome || '');
  const [profileTelefone, setProfileTelefone] = useState(user.telefone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setProfileNome(user.nome || '');
    setProfileTelefone(user.telefone || '');
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          nome: profileNome,
          telefone: profileTelefone
        }
      });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: profileNome,
          telefone: profileTelefone
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setSuccessMsg('Perfil atualizado com sucesso!');
      refetch();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar perfil.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!currentPassword) {
      setErrorMsg('Por favor, informe sua senha atual.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('A nova senha e a confirmação não coincidem.');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Senha atual incorreta.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setSuccessMsg('Senha atualizada com sucesso!');
      setNewPassword('');
      setCurrentPassword('');
      setConfirmPassword('');
      setIsPasswordFormOpen(false);
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao atualizar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBackToConfig}
            className="h-10 w-10 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </Button>
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
              Meu Perfil
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gerencie suas informações pessoais</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBackToHome}
          className="h-10 w-10 p-0 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {(errorMsg || successMsg) && (
        <div className={`p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
          errorMsg 
            ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800/50' 
            : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/50'
        }`}>
          <p className="text-sm font-bold text-center">{errorMsg || successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm bg-white dark:bg-gray-900 rounded-3xl overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center mb-8">
              <ProfilePhotoUpload user={user} onUpdate={refetch} />
              <div className="mt-4 text-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{user.nome || 'Usuário Atlas'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">Nome Completo</label>
                  <Input 
                    type="text" 
                    value={profileNome} 
                    onChange={(e) => setProfileNome(e.target.value)} 
                    placeholder="Seu nome"
                    className="h-12 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border-transparent focus:border-amber-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">WhatsApp / Telefone</label>
                  <Input 
                    type="tel" 
                    inputMode="tel"
                    value={profileTelefone} 
                    onChange={(e) => setProfileTelefone(e.target.value)} 
                    placeholder="(00) 00000-0000"
                    className="h-12 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border-transparent focus:border-amber-500 transition-all font-medium"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 ml-1">E-mail de Acesso</label>
                <Input 
                  type="email" 
                  value={user.email} 
                  disabled 
                  className="h-12 rounded-2xl bg-gray-100 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500 border-none cursor-not-allowed opacity-80" 
                />
                <p className="text-[10px] text-gray-400 ml-2 italic">O e-mail de login não pode ser alterado por segurança.</p>
              </div>

              <Button type="submit" disabled={profileLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 rounded-2xl shadow-lg shadow-blue-500/20 font-black transition-all active:scale-[0.98]">
                {profileLoading ? 'SALVANDO ALTERAÇÕES...' : 'SALVAR DADOS DO PERFIL'}
              </Button>
            </form>

            {/* Appearance Section */}
            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 ml-1">Preferências de Visual</h4>
              <div 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex items-center justify-between p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white dark:bg-gray-700 rounded-xl shadow-sm text-amber-500">
                    {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Tema do Aplicativo</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-tighter">Atualmente: {theme === 'dark' ? 'MODO ESCURO' : 'MODO CLARO'}</p>
                  </div>
                </div>
                <div className="h-6 w-11 bg-gray-200 dark:bg-gray-700 rounded-full relative p-1 transition-colors group-hover:bg-amber-400/20">
                   <div className={cn(
                     "h-4 w-4 rounded-full bg-white dark:bg-amber-500 shadow-sm transition-all duration-300",
                     theme === "dark" ? "translate-x-5" : "translate-x-0"
                   )} />
                </div>
              </div>
            </div>

            {/* Password Section */}
            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={() => setIsPasswordFormOpen(!isPasswordFormOpen)}
                className="flex items-center justify-between w-full p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Segurança da Conta</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Alterar minha senha de acesso</p>
                  </div>
                </div>
                <div className={cn("transition-transform duration-300", isPasswordFormOpen ? "rotate-90" : "rotate-0")}>
                  <ChevronLeft className="h-5 w-5 -rotate-180 text-gray-400" />
                </div>
              </button>

              {isPasswordFormOpen && (
                <form onSubmit={handlePasswordChange} className="space-y-4 mt-6 animate-in fade-in slide-in-from-top-4 duration-300 px-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Senha Atual</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Nova Senha</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 dígitos"
                        className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Repetir Nova Senha</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirme a senha"
                        className="h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={passwordLoading} className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 h-12 rounded-xl font-bold mt-2">
                    {passwordLoading ? 'ATUALIZANDO...' : 'CONFIRMAR NOVA SENHA'}
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
