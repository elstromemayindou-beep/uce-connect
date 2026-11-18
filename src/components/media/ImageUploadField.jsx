import React, { useRef, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { appClient } from '@/api/appClient';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

/**
 * @param {{
 *   id: string;
 *   label: string;
 *   value?: string;
 *   onChange: (value: string) => void;
 *   onUploadingChange?: (uploading: boolean) => void;
 *   required?: boolean;
 *   previewClassName?: string;
 * }} props
 */
export default function ImageUploadField({
  id,
  label,
  value = '',
  onChange,
  onUploadingChange,
  required = false,
  previewClassName = 'h-28 w-full object-cover',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const selectImage = async (file) => {
    if (!file) return;
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('Choisissez un fichier image.');
      toast.error('Choisissez un fichier image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('La taille de l’image ne peut pas dépasser 8 Mo.');
      toast.error('La taille de l’image ne peut pas dépasser 8 Mo.');
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const { file_url: imageUrl } = await appClient.integrations.Core.UploadFile({ file });
      onChange(imageUrl);
      toast.success('Image téléversée.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de téléverser cette image.';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium leading-none">{label}{required && <span className="text-destructive"> *</span>}</span>
      {value && (
        <div className="relative overflow-hidden rounded-xl border border-border/60">
          <img src={value} alt={`Aperçu : ${label}`} className={previewClassName} />
          <button
            type="button"
            aria-label={`Retirer ${label.toLocaleLowerCase()}`}
            onClick={() => onChange('')}
            disabled={uploading}
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={value ? `Image ajoutée pour ${label}. Choisir une autre image` : `Choisir ${label}`}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
          value
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400'
            : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
        }`}
      >
        {uploading
          ? <LoaderCircle className="h-4 w-4 animate-spin" />
          : value ? <Check className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
        {uploading ? 'Téléversement…' : value ? 'Image ajoutée · choisir une autre' : 'Choisir une image'}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          void selectImage(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {uploadError ? (
        <p role="alert" className="text-xs text-destructive">{uploadError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {value ? 'Image prête à être publiée. Vous pouvez la remplacer à tout moment.' : 'Sélectionnez une image depuis votre appareil (8 Mo maximum).'}
        </p>
      )}
    </div>
  );
}
