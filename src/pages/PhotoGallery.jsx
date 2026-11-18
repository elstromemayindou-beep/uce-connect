import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import galleryBackground from '@/assets/gallery-background.jpg';
import {
  Camera, Check, Download, Grid2X2, Grid3X3, Heart, Images, LoaderCircle,
  MessageSquareText, Pencil, Plus, Search, Tag, Trash2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { appClient } from '@/api/appClient';
import ImageUploadField from '@/components/media/ImageUploadField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const suggestedCategories = [
  { name: 'Culte', color: '#2563eb' },
  { name: 'Mariage', color: '#db2777' },
  { name: 'Séminaire', color: '#7c3aed' },
  { name: 'Campagne', color: '#ea580c' },
  { name: 'Jeunesse', color: '#059669' },
];
const emptyEdit = { title: '', album: '', caption: '', image_url: '', service_date: '', category_id: '' };

function displayDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : format(date, 'd MMMM yyyy', { locale: fr });
}

function titleFromFile(file) {
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return title.slice(0, 160) || 'Moment du culte';
}

function canManageGallery(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const assignments = Array.isArray(user?.role_assignments) ? user.role_assignments : [];
  return roles.some((role) => ['SUPER_ADMIN', 'ADMIN_GENERAL', 'PASTEUR_PRINCIPAL', 'SECRETAIRE_GENERAL'].includes(role))
    || assignments.some((assignment) => assignment.department?.code === 'COM'
      && ['RESP_DEPARTEMENT', 'SECRETAIRE_DEPARTEMENT', 'RESP_COMMISSION', 'SECRETAIRE_COMMISSION'].includes(assignment.code));
}

async function downloadPhoto(photo) {
  const response = await fetch(photo.image_url);
  if (!response.ok) throw new Error('Impossible de télécharger cette photo.');
  const blob = await response.blob();
  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  }[blob.type] || 'jpg';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `photo-${photo.id}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PhotoGallery({ adminMode = false }) {
  const queryClient = useQueryClient();
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [gridColumns, setGridColumns] = useState(() => {
    if (typeof window === 'undefined') return 3;
    const savedColumns = Number(window.localStorage.getItem('gallery-grid-columns'));
    return [2, 3, 4].includes(savedColumns) ? savedColumns : 3;
  });
  const [commentDraft, setCommentDraft] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [album, setAlbum] = useState('Culte dominical');
  const [serviceDate, setServiceDate] = useState(today);
  const [caption, setCaption] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyEdit);
  const [imageUploading, setImageUploading] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => appClient.auth.me() });
  const canManage = canManageGallery(user);
  const { data: photos = [], isLoading, isError, error } = useQuery({
    queryKey: ['gallery-photos'],
    queryFn: () => appClient.entities.GalleryPhoto.list('-service_date', 500),
  });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['gallery-categories'],
    queryFn: () => appClient.entities.GalleryCategory.list('name', 200),
  });
  const interactionCountsKey = ['gallery-interaction-counts'];
  const { data: interactionCounts = [] } = useQuery({
    queryKey: interactionCountsKey,
    queryFn: () => appClient.gallery.interactionCounts(),
  });
  const interactionCountsByPhoto = useMemo(
    () => new Map(interactionCounts.map((item) => [item.id, item])),
    [interactionCounts],
  );
  const selectedPhotoId = selectedPhoto?.id;
  const {
    data: interactions,
    isLoading: interactionsLoading,
    isError: interactionsError,
    error: interactionsQueryError,
  } = useQuery({
    queryKey: ['gallery-interactions', selectedPhotoId],
    queryFn: () => appClient.gallery.interactions(selectedPhotoId),
    enabled: Boolean(selectedPhotoId),
  });
  const interactionKey = ['gallery-interactions', selectedPhotoId];
  const likeMutation = useMutation({
    mutationFn: () => appClient.gallery.toggleLike(selectedPhotoId),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: interactionKey }),
      queryClient.invalidateQueries({ queryKey: interactionCountsKey }),
    ]),
    onError: (likeError) => toast.error(likeError.message || 'Impossible de modifier le J’aime.'),
  });
  const commentMutation = useMutation({
    mutationFn: (content) => appClient.gallery.addComment(selectedPhotoId, { content }),
    onSuccess: async () => {
      setCommentDraft('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: interactionKey }),
        queryClient.invalidateQueries({ queryKey: interactionCountsKey }),
      ]);
    },
    onError: (commentError) => toast.error(commentError.message || 'Impossible d’ajouter ce commentaire.'),
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId) => appClient.gallery.deleteComment(selectedPhotoId, commentId),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: interactionKey }),
      queryClient.invalidateQueries({ queryKey: interactionCountsKey }),
    ]),
    onError: (commentError) => toast.error(commentError.message || 'Impossible de supprimer ce commentaire.'),
  });
  const downloadMutation = useMutation({
    mutationFn: async (targetPhotos) => {
      for (let index = 0; index < targetPhotos.length; index += 1) {
        await downloadPhoto(targetPhotos[index]);
        if (index < targetPhotos.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }
      }
    },
    onSuccess: () => {
      toast.success('Téléchargement terminé.');
      setSelectedPhotoIds([]);
    },
    onError: (downloadError) => toast.error(downloadError.message || 'Le téléchargement a échoué. Vérifiez votre connexion puis réessayez.'),
  });

  useEffect(() => {
    window.localStorage.setItem('gallery-grid-columns', String(gridColumns));
  }, [gridColumns]);
  useEffect(() => () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
  }, []);

  const visiblePhotos = useMemo(() => photos.filter((photo) => {
    const matchesCategory = activeCategory === 'all' || photo.category_id === activeCategory;
    const terms = `${photo.title || ''} ${photo.caption || ''} ${photo.album || ''} ${photo.category_name || ''}`.toLocaleLowerCase();
    return matchesCategory && terms.includes(search.toLocaleLowerCase());
  }), [activeCategory, photos, search]);
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedPhotoIds.includes(photo.id)),
    [photos, selectedPhotoIds],
  );
  const togglePhotoSelection = (photoId) => {
    setSelectedPhotoIds((current) => current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : [...current, photoId]);
  };
  const handlePhotoPointerDown = (photoId) => {
    longPressTriggered.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      togglePhotoSelection(photoId);
    }, 500);
  };
  const cancelPhotoLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  const handlePhotoClick = (photo) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (selectedPhotoIds.length) {
      togglePhotoSelection(photo.id);
      return;
    }
    setCommentDraft('');
    setSelectedPhoto(photo);
  };
  const handleDownload = async (targetPhotos) => {
    if (!targetPhotos.length || downloadMutation.isPending) return;
    downloadMutation.mutate(targetPhotos);
  };

  const categoryCreateMutation = useMutation({
    mutationFn: (category) => appClient.entities.GalleryCategory.create(category),
    onSuccess: async (createdCategory) => {
      await queryClient.invalidateQueries({ queryKey: ['gallery-categories'] });
      setCategoryId(createdCategory.id);
      setCategoryName('');
      toast.success('Catégorie créée.');
    },
    onError: (createError) => toast.error(createError.message || 'Impossible de créer cette catégorie.'),
  });
  const categoryUpdateMutation = useMutation({
    mutationFn: ({ id, name }) => appClient.entities.GalleryCategory.update(id, {
      name,
      description: categories.find((category) => category.id === id)?.description || '',
      color: categories.find((category) => category.id === id)?.color || '#64748b',
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gallery-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['gallery-photos'] }),
      ]);
      setEditingCategoryId('');
      toast.success('Catégorie renommée.');
    },
    onError: (updateError) => toast.error(updateError.message || 'Impossible de modifier cette catégorie.'),
  });
  const categoryDeleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.GalleryCategory.remove(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gallery-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['gallery-photos'] }),
      ]);
      toast.success('Catégorie supprimée.');
    },
    onError: (deleteError) => toast.error(deleteError.message || 'Impossible de supprimer cette catégorie.'),
  });
  const seedCategoriesMutation = useMutation({
    mutationFn: async () => {
      const failures = [];
      let firstId = '';
      for (const category of suggestedCategories) {
        try {
          const createdCategory = await appClient.entities.GalleryCategory.create({ ...category, description: '' });
          if (!firstId) firstId = createdCategory.id;
        } catch (seedError) {
          failures.push(seedError instanceof Error ? seedError.message : `Échec de création : ${category.name}`);
        }
      }
      return { failures, firstId };
    },
    onSuccess: async ({ failures, firstId }) => {
      await queryClient.invalidateQueries({ queryKey: ['gallery-categories'] });
      if (firstId) setCategoryId(firstId);
      if (failures.length) toast.error(`Certaines catégories n’ont pas été créées : ${failures.join(' · ')}`);
      else toast.success('Les catégories proposées ont été ajoutées.');
    },
    onError: (seedError) => toast.error(seedError.message || 'Impossible de créer les catégories.'),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const failures = [];
      const publishedFiles = [];
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setUploadProgress(`Publication de ${index + 1} sur ${selectedFiles.length}…`);
        try {
          const { file_url: imageUrl } = await appClient.integrations.Core.UploadFile({ file });
          await appClient.entities.GalleryPhoto.create({
            title: titleFromFile(file),
            album: album.trim(),
            service_date: serviceDate,
            caption: caption.trim(),
            image_url: imageUrl,
            category_id: categoryId,
          });
          publishedFiles.push(file);
        } catch (uploadError) {
          failures.push({ name: file.name, message: uploadError instanceof Error ? uploadError.message : 'Échec du téléversement.' });
        }
      }
      return { failures, publishedFiles };
    },
    onSuccess: async ({ failures, publishedFiles }) => {
      await queryClient.invalidateQueries({ queryKey: ['gallery-photos'] });
      setSelectedFiles((files) => files.filter((file) => !publishedFiles.includes(file)));
      if (publishedFiles.length) toast.success(`${publishedFiles.length} photo${publishedFiles.length > 1 ? 's' : ''} publiée${publishedFiles.length > 1 ? 's' : ''}.`);
      if (failures.length) toast.error(`Échec pour : ${failures.map((item) => item.name).join(', ')}`);
      if (!failures.length) {
        setCaption('');
        setServiceDate(today());
      }
    },
    onError: (uploadError) => toast.error(uploadError.message || 'Impossible de publier ces photos.'),
    onSettled: () => setUploadProgress(''),
  });

  const updateMutation = useMutation({
    mutationFn: () => appClient.entities.GalleryPhoto.update(editingPhoto.id, editDraft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gallery-photos'] });
      setEditingPhoto(null);
      toast.success('Photo mise à jour.');
    },
    onError: (updateError) => toast.error(updateError.message || 'Impossible de modifier cette photo.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.entities.GalleryPhoto.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gallery-photos'] });
      setSelectedPhoto(null);
      toast.success('Photo supprimée de la photothèque.');
    },
    onError: (deleteError) => toast.error(deleteError.message || 'Impossible de supprimer cette photo.'),
  });

  const startEditing = (photo) => {
    setEditingPhoto(photo);
    setEditDraft({
      title: photo.title || '',
      album: photo.album || '',
      caption: photo.caption || '',
      image_url: photo.image_url || '',
      service_date: photo.service_date || '',
      category_id: photo.category_id || '',
    });
  };

  return (
    <div className="min-h-screen">
      <header className="relative isolate overflow-hidden bg-slate-950 px-5 py-16 text-white md:px-12 md:py-24">
        <img src={galleryBackground} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-slate-950/50 to-slate-950/80" />
        <div className="absolute -right-20 -top-32 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
              <Camera className="h-4 w-4" /> Les souvenirs de notre église
            </span>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">Photothèque</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
              Revivez les moments de communion, de louange et de célébration partagés pendant nos cultes.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
            <Images className="h-7 w-7 text-amber-300" />
            <div><p className="text-2xl font-black">{photos.length}</p><p className="text-xs text-white/70">souvenirs partagés</p></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8 md:py-12">
        {adminMode && canManage && (
          <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="rounded-2xl bg-amber-500/10 p-3 text-amber-600"><Tag className="h-5 w-5" /></span>
              <div>
                <h2 className="text-xl font-black">Gérer les catégories</h2>
                <p className="mt-1 text-sm text-muted-foreground">Classez les photos par type d’activité. Une catégorie utilisée doit être vidée avant suppression.</p>
              </div>
            </div>
            <form className="mb-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => {
              event.preventDefault();
              const name = categoryName.trim();
              if (!name) return;
              categoryCreateMutation.mutate({ name, description: '', color: '#7c3aed' });
            }}>
              <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={60} minLength={2} placeholder="Nouvelle catégorie, ex. Mariage" aria-label="Nom de la nouvelle catégorie" required />
              <Button type="submit" disabled={categoryCreateMutation.isPending} className="shrink-0">
                {categoryCreateMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Ajouter
              </Button>
            </form>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">Chargement des catégories…</p>
            ) : categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground">Commencez avec les catégories courantes : mariage, culte, séminaire, campagne et jeunesse.</p>
                <Button type="button" variant="outline" className="mt-3" disabled={seedCategoriesMutation.isPending} onClick={() => seedCategoriesMutation.mutate()}>
                  {seedCategoriesMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Ajouter les catégories proposées
                </Button>
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <li key={category.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-background p-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.color || '#64748b' }} />
                    {editingCategoryId === category.id ? (
                      <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => {
                        event.preventDefault();
                        categoryUpdateMutation.mutate({ id: category.id, name: editingCategoryName.trim() });
                      }}>
                        <Input autoFocus value={editingCategoryName} onChange={(event) => setEditingCategoryName(event.target.value)} maxLength={60} minLength={2} aria-label="Nouveau nom de catégorie" required />
                        <Button type="submit" size="sm" disabled={categoryUpdateMutation.isPending} aria-label="Enregistrer le nom">OK</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingCategoryId('')} aria-label="Annuler le renommage"><X className="h-4 w-4" /></Button>
                      </form>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category.name}</span>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Renommer ${category.name}`} onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingCategoryName(category.name);
                        }}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" aria-label={`Supprimer ${category.name}`} onClick={() => {
                          if (window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) categoryDeleteMutation.mutate(category.id);
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {adminMode && canManage && (
          <section className="rounded-3xl border border-primary/15 bg-card p-5 shadow-sm md:p-7">
            <div className="mb-6 flex items-start gap-3">
              <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Upload className="h-5 w-5" /></span>
              <div>
                <h2 className="text-xl font-black">Publier les photos du culte</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sélectionnez plusieurs images pour les publier ensemble dans un album daté.</p>
              </div>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              if (!selectedFiles.length) {
                toast.error('Choisissez au moins une photo à publier.');
                return;
              }
              publishMutation.mutate();
            }}>
              <div className="space-y-2">
                <Label htmlFor="gallery-album">Nom de l’album</Label>
                <Input id="gallery-album" maxLength={120} required value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Ex. Culte dominical" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-date">Date du culte</Label>
                <Input id="gallery-date" type="date" required value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gallery-category">Catégorie</Label>
                <select id="gallery-category" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Choisir une catégorie</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                {!categories.length && <p className="text-xs text-muted-foreground">Ajoutez d’abord une catégorie dans le panneau de gestion ci-dessus.</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gallery-caption">Légende commune (facultative)</Label>
                <Textarea id="gallery-caption" maxLength={1200} rows={2} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Un mot sur ce temps de célébration…" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="gallery-files">Photos à publier</Label>
                <Input
                  id="gallery-files"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={publishMutation.isPending}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    const accepted = files.filter((file) => file.type.startsWith('image/') && file.size <= 8 * 1024 * 1024);
                    if (accepted.length !== files.length) toast.error('Chaque fichier doit être une image de 8 Mo maximum.');
                    setSelectedFiles(accepted);
                    event.target.value = '';
                  }}
                  className="h-auto cursor-pointer rounded-xl py-3 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-semibold file:text-primary"
                />
                <p className="text-xs text-muted-foreground">Images uniquement · 8 Mo maximum par photo. Les titres seront repris des noms de fichiers.</p>
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                        <span className="max-w-48 truncate">{file.name}</span>
                        <button type="button" aria-label={`Retirer ${file.name}`} onClick={() => setSelectedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                <p aria-live="polite" className="text-sm text-muted-foreground">{uploadProgress || 'Les photos publiées seront visibles dans la photothèque.'}</p>
                <Button type="submit" disabled={publishMutation.isPending || !selectedFiles.length || !categoryId}>
                  {publishMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {publishMutation.isPending ? 'Publication…' : `Publier ${selectedFiles.length || ''} photo${selectedFiles.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </form>
          </section>
        )}

        {adminMode && !canManage && (
          <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Votre compte n’a pas les droits pour gérer la photothèque.
          </p>
        )}

        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Instants partagés</p>
              <h2 className="mt-1 text-2xl font-black md:text-3xl">Albums du culte</h2>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans les photos…" className="rounded-xl pl-10" />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {[{ id: 'all', name: 'Toutes les catégories' }, ...categories].map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveCategory(item.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === item.id ? 'bg-primary text-primary-foreground shadow' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-border p-1" aria-label="Nombre de colonnes">
              {[2, 3, 4].map((columns) => (
                <Button
                  type="button"
                  key={columns}
                  variant={gridColumns === columns ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={gridColumns === columns}
                  aria-label={`${columns} colonnes`}
                  onClick={() => setGridColumns(columns)}
                >
                  {columns === 2 ? <Grid2X2 className="mr-1 h-4 w-4" /> : <Grid3X3 className="mr-1 h-4 w-4" />}
                  {columns}
                </Button>
              ))}
            </div>
            {selectedPhotoIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{selectedPhotoIds.length} sélectionnée{selectedPhotoIds.length > 1 ? 's' : ''}</span>
                <Button type="button" size="sm" onClick={() => handleDownload(selectedPhotos)} disabled={downloadMutation.isPending || selectedPhotos.length === 0}>
                  {downloadMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Télécharger
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedPhotoIds([])}>Annuler</Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className={`grid ${gridColumns === 2 ? 'grid-cols-2' : gridColumns === 3 ? 'grid-cols-3' : 'grid-cols-4'} gap-2 sm:gap-3 lg:gap-4`}>
              {Array.from({ length: 9 }, (_, index) => <div key={index} className="aspect-square animate-pulse rounded-2xl bg-muted sm:aspect-[4/5]" />)}
            </div>
          ) : isError ? (
            <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message || 'Impossible de charger la photothèque.'}</p>
          ) : visiblePhotos.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <Camera className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
              <h3 className="font-bold">{photos.length ? 'Aucune photo ne correspond à la recherche.' : 'La photothèque se prépare.'}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{photos.length ? 'Essayez un autre mot ou sélectionnez un autre album.' : 'Les photos des prochains cultes apparaîtront ici.'}</p>
            </div>
          ) : (
            <div className={`grid ${gridColumns === 2 ? 'grid-cols-2' : gridColumns === 3 ? 'grid-cols-3' : 'grid-cols-4'} gap-2 sm:gap-3 md:gap-4`}>
              {visiblePhotos.map((photo) => (
                  <article
                    key={photo.id}
                    className={`group relative overflow-hidden rounded-2xl border bg-card shadow-sm ${selectedPhotoIds.includes(photo.id) ? 'border-primary ring-2 ring-primary/40' : 'border-border/50'}`}
                  >
                    <button
                      type="button"
                      className="relative block aspect-square w-full overflow-hidden text-left touch-pan-y"
                      onPointerDown={() => handlePhotoPointerDown(photo.id)}
                      onPointerUp={cancelPhotoLongPress}
                      onPointerCancel={cancelPhotoLongPress}
                      onPointerLeave={cancelPhotoLongPress}
                      onContextMenu={(event) => event.preventDefault()}
                      onClick={() => handlePhotoClick(photo)}
                      aria-label={selectedPhotoIds.includes(photo.id) ? 'Désélectionner cette photo' : 'Voir ou sélectionner cette photo'}
                    >
                      <img src={photo.image_url} alt={`Photo ${photo.category_name || ''}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      {selectedPhotoIds.includes(photo.id) && (
                        <span className="absolute inset-0 flex items-center justify-center bg-primary/25" aria-hidden="true">
                          <span className="rounded-full bg-primary p-2 text-primary-foreground"><Check className="h-6 w-6" /></span>
                        </span>
                      )}
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant={selectedPhotoIds.includes(photo.id) ? 'default' : 'secondary'}
                      className="absolute left-2 top-2 h-8 w-8 rounded-full shadow"
                      aria-label={selectedPhotoIds.includes(photo.id) ? 'Désélectionner cette photo' : 'Sélectionner cette photo'}
                      aria-pressed={selectedPhotoIds.includes(photo.id)}
                      onClick={() => togglePhotoSelection(photo.id)}
                    >
                      {selectedPhotoIds.includes(photo.id) ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 rounded-full border-2 border-current" />}
                    </Button>
                    <div className="min-h-12 p-2 sm:min-h-14 sm:p-3">
                      <p className="line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">{photo.category_name} · {displayDate(photo.service_date)}</p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground sm:text-xs" aria-label="Interactions sur cette photo">
                        <span className="inline-flex items-center gap-1" aria-label={`${interactionCountsByPhoto.get(photo.id)?.like_count ?? 0} J’aime`}>
                          <Heart className="h-3 w-3" aria-hidden="true" />
                          {interactionCountsByPhoto.get(photo.id)?.like_count ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1" aria-label={`${interactionCountsByPhoto.get(photo.id)?.comment_count ?? 0} commentaires`}>
                          <MessageSquareText className="h-3 w-3" aria-hidden="true" />
                          {interactionCountsByPhoto.get(photo.id)?.comment_count ?? 0}
                        </span>
                      </div>
                    </div>
                  {adminMode && canManage && (
                      <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <Button type="button" size="icon" variant="secondary" aria-label={`Modifier ${photo.title}`} className="h-9 w-9 rounded-xl shadow" onClick={() => startEditing(photo)}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="destructive" aria-label={`Supprimer ${photo.title}`} className="h-9 w-9 rounded-xl shadow" onClick={() => {
                          if (window.confirm(`Supprimer « ${photo.title} » de la photothèque ?`)) deleteMutation.mutate(photo.id);
                        }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                  </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-3xl p-3 sm:p-4">
          {selectedPhoto && (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.8fr)] md:items-start">
              <div className="space-y-2">
                <DialogHeader className="pr-8 text-left">
                  <DialogTitle className="text-lg font-black">Détails de la photo</DialogTitle>
                  <DialogDescription>{selectedPhoto.category_name} · {displayDate(selectedPhoto.service_date)} · {selectedPhoto.album}</DialogDescription>
                </DialogHeader>
                <img src={selectedPhoto.image_url} alt={`Photo ${selectedPhoto.category_name || ''}`} className="max-h-[48vh] w-full rounded-2xl bg-muted object-contain md:max-h-[78vh]" />
                {selectedPhoto.caption && <p className="px-1 text-sm leading-relaxed text-muted-foreground">{selectedPhoto.caption}</p>}
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={interactions?.liked_by_me ? 'default' : 'outline'}
                    onClick={() => {
                      if (!user) {
                        toast.error('Connectez-vous pour aimer cette photo.');
                        return;
                      }
                      likeMutation.mutate();
                    }}
                    disabled={likeMutation.isPending || interactionsLoading}
                    aria-pressed={Boolean(interactions?.liked_by_me)}
                  >
                    {likeMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Heart className={`mr-2 h-4 w-4 ${interactions?.liked_by_me ? 'fill-current' : ''}`} />}
                    {interactions?.like_count || 0} J’aime
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleDownload([selectedPhoto])} disabled={downloadMutation.isPending}>
                    {downloadMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Télécharger
                  </Button>
                </div>
                <section aria-labelledby="gallery-comments-heading" className="space-y-3">
                  <h3 id="gallery-comments-heading" className="flex items-center gap-2 font-bold">
                    <MessageSquareText className="h-4 w-4" />
                    Commentaires <span className="text-sm font-normal text-muted-foreground">({interactions?.comments?.length || 0})</span>
                  </h3>
                  {interactionsLoading ? (
                    <p className="text-sm text-muted-foreground">Chargement des commentaires…</p>
                  ) : interactionsError ? (
                    <p role="alert" className="text-sm text-destructive">{interactionsQueryError.message || 'Impossible de charger les commentaires.'}</p>
                  ) : interactions?.comments?.length ? (
                    <ul className="max-h-44 space-y-2 overflow-y-auto">
                      {interactions.comments.map((comment) => (
                        <li key={comment.id} className="flex items-start justify-between gap-2 rounded-xl bg-muted/50 p-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{comment.author_name}</p>
                            <p className="whitespace-pre-wrap break-words text-sm">{comment.content}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{format(new Date(comment.created_at), 'd MMM yyyy · HH:mm', { locale: fr })}</p>
                          </div>
                          {(comment.profile_id === user?.id || canManage) && (
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Supprimer ce commentaire" disabled={deleteCommentMutation.isPending} onClick={() => deleteCommentMutation.mutate(comment.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun commentaire pour le moment.</p>
                  )}
                  {user ? (
                    <form className="flex items-end gap-2" onSubmit={(event) => {
                      event.preventDefault();
                      const content = commentDraft.trim();
                      if (content) commentMutation.mutate(content);
                    }}>
                      <Textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={2000} rows={1} className="min-h-10 min-w-0 flex-1 resize-y rounded-xl px-3 py-2 text-sm" placeholder="Écrire un commentaire…" aria-label="Votre commentaire" required />
                      <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label="Envoyer le commentaire" disabled={commentMutation.isPending || !commentDraft.trim()}>
                        {commentMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">Connectez-vous pour ajouter un commentaire.</p>
                  )}
                </section>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingPhoto)} onOpenChange={(open) => !open && setEditingPhoto(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Modifier la photo</DialogTitle>
            <DialogDescription>Modifiez son titre, son album, sa date ou son image.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}>
            <div className="space-y-2"><Label htmlFor="edit-gallery-title">Titre</Label><Input id="edit-gallery-title" required maxLength={160} value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="edit-gallery-album">Album</Label><Input id="edit-gallery-album" required maxLength={120} value={editDraft.album} onChange={(event) => setEditDraft({ ...editDraft, album: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="edit-gallery-date">Date du culte</Label><Input id="edit-gallery-date" type="date" required value={editDraft.service_date} onChange={(event) => setEditDraft({ ...editDraft, service_date: event.target.value })} /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-gallery-category">Catégorie</Label>
              <select id="edit-gallery-category" required value={editDraft.category_id} onChange={(event) => setEditDraft({ ...editDraft, category_id: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Choisir une catégorie</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="edit-gallery-caption">Légende</Label><Textarea id="edit-gallery-caption" maxLength={1200} rows={3} value={editDraft.caption} onChange={(event) => setEditDraft({ ...editDraft, caption: event.target.value })} /></div>
            <ImageUploadField id="edit-gallery-image" label="Photo" value={editDraft.image_url} onChange={(image_url) => setEditDraft({ ...editDraft, image_url })} onUploadingChange={setImageUploading} required />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingPhoto(null)}>Annuler</Button>
              <Button type="submit" disabled={updateMutation.isPending || imageUploading}>{updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
