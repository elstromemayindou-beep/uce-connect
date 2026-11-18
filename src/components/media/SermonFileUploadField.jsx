import React, { useRef, useState } from 'react';
import { Check, FileAudio, FileText, LoaderCircle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { appClient } from '@/api/appClient';

const fileTypes = {
  audio: {
    accept: '.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac,audio/*',
    kind: 'audio',
    label: 'un fichier audio',
    maxSize: '48 Mo',
    icon: FileAudio,
  },
  pdf: {
    accept: '.pdf,application/pdf',
    kind: 'pdf',
    label: 'un fichier PDF',
    maxSize: '20 Mo',
    icon: FileText,
  },
  docx: {
    accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'docx',
    label: 'un document DOCX',
    maxSize: '20 Mo',
    icon: FileText,
  },
};

/**
 * @param {{
 *   id: string;
 *   label: string;
 *   value?: string;
 *   kind: 'audio' | 'pdf' | 'docx';
 *   onChange: (value: string) => void;
 *   onUploadingChange?: (uploading: boolean) => void;
 * }} props
 */
export default function SermonFileUploadField({ id, label, value = '', kind, onChange, onUploadingChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const type = fileTypes[kind];
  const Icon = type.icon;

  const selectFile = async (file) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const { file_url: fileUrl } = await appClient.integrations.Core.UploadSermonFile({ file, kind });
      onChange(fileUrl);
      toast.success('Fichier téléversé.');
    } catch (error) {
      const message = error instanceof Error ? error.message : `Impossible de téléverser ${type.label}.`;
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium leading-none">{label}</span>
      {value && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-primary underline">
            {kind === 'audio' ? 'Écouter le fichier actuel' : `Ouvrir le fichier ${kind.toUpperCase()}`}
          </a>
          <button
            type="button"
            aria-label={`Retirer ${label.toLocaleLowerCase()}`}
            onClick={() => onChange('')}
            disabled={uploading}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
          value
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400'
            : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
        }`}
      >
        {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : value ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        {uploading ? 'Téléversement…' : value ? 'Fichier ajouté · choisir un autre' : `Choisir ${type.label}`}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={type.accept}
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          void selectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {uploadError ? (
        <p role="alert" className="text-xs text-destructive">{uploadError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {value ? 'Fichier prêt à être publié. Vous pouvez le remplacer à tout moment.' : `Sélectionnez un fichier depuis votre appareil (${type.maxSize} maximum).`}
        </p>
      )}
    </div>
  );
}
