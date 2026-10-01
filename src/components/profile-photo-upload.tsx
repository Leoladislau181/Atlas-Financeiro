import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { supabase } from '@/lib/supabase';
import getCroppedImg from '@/lib/cropImage';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { User, Camera, Upload, X } from 'lucide-react';
import { User as UserType } from '@/types';

interface ProfilePhotoUploadProps {
  user: UserType;
  onUpdate: () => void;
}

export function ProfilePhotoUpload({ user, onUpdate }: ProfilePhotoUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setIsModalOpen(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error('Falha ao processar imagem.');

      const fileName = `${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        // If bucket doesn't exist, we might need to inform the user or handle it
        if (uploadError.message.toLowerCase().includes('bucket not found')) {
          throw new Error('O bucket "avatars" não foi encontrado no Supabase Storage. Por favor, crie-o no console do Supabase e defina como público.');
        }
        throw uploadError;
      }

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update User Metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { foto_url: publicUrl }
      });

      if (updateError) throw updateError;

      // Update the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ foto_url: publicUrl })
        .eq('id', user.id);
      if (profileError) throw profileError;

      setIsModalOpen(false);
      setImageSrc(null);
      onUpdate();
      setSuccessMsg('Foto de perfil atualizada!');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      setErrorMsg(error.message || 'Erro ao fazer upload da foto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {(errorMsg || successMsg) && (
        <div className={`w-full p-3 rounded-lg text-sm text-center ${
          errorMsg ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
        }`}>
          {errorMsg || successMsg}
        </div>
      )}
      <div className="relative group">
        <div className="h-24 w-24 rounded-full border-4 border-white dark:border-gray-800 shadow-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {user.foto_url ? (
            <img 
              src={user.foto_url} 
              alt={user.nome} 
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-[#F59E0B] text-white text-3xl font-bold">
              {user.nome ? user.nome.charAt(0).toUpperCase() : <User className="h-10 w-10" />}
            </div>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 p-2 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:text-[#F59E0B] transition-all transform hover:scale-110"
          title="Alterar foto"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept="image/*"
        className="hidden"
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!loading) {
            setIsModalOpen(false);
            setImageSrc(null);
          }
        }}
        title="Ajustar Foto de Perfil"
      >
        <div className="space-y-6">
          <div className="relative h-64 w-full bg-gray-900 rounded-xl overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zoom</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                setImageSrc(null);
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={loading}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-white min-w-[120px]"
            >
              {loading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
