import { useState, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useNavigate, useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Clock,
  Type,
  Image as ImageIcon,
  Square,
  Loader2,
  Settings2,
  Copy,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SlideCanvas } from '@/components/SlideCanvas';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ElementProperties } from '@/components/ElementProperties';
import { ImagePickerDialog } from '@/components/ImagePickerDialog';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePresentation } from '@/hooks/usePresentations';
import { usePublishPresentation } from '@/hooks/usePublishPresentation';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import {
  PRESENTATION_KIND,
  type Slide,
  type SlideElement,
  createEmptySlide,
  createTextElement,
  createImageElement,
  createShapeElement,
  createEmptyPresentationContent,
  formatDuration,
  calculateTotalDuration,
  getSlideLabel,
} from '@/lib/types';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'untitled';
}

/** What the image picker dialog is targeting when it resolves */
type ImageTarget =
  | { kind: 'new' }
  | { kind: 'replace'; elementId: string }
  | { kind: 'cover' };

export default function EditPresentation() {
  const { nip19: nip19Param } = useParams<{ nip19: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCurrentUser();

  // Parse naddr if editing existing
  const existingData = nip19Param ? (() => {
    try {
      const decoded = nip19.decode(nip19Param);
      if (decoded.type === 'naddr') {
        return decoded.data;
      }
    } catch {
      // Invalid nip19
    }
    return null;
  })() : null;

  const existingPresentation = usePresentation(
    existingData?.pubkey,
    existingData?.identifier
  );

  const isEditing = Boolean(existingData);
  const originalIdentifier = existingData?.identifier ?? '';

  // Form state
  const [title, setTitle] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [topics, setTopics] = useState('');
  const [slides, setSlides] = useState<Slide[]>(
    createEmptyPresentationContent().slides
  );
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [pendingSlugChange, setPendingSlugChange] = useState<string | null>(null);

  // Update state when existing data loads
  const isInitialized = useState(false);
  if (existingPresentation.data && !isInitialized[0]) {
    setTitle(existingPresentation.data.title);
    setIdentifier(existingPresentation.data.id);
    setSummary(existingPresentation.data.summary ?? '');
    setCoverImage(existingPresentation.data.image ?? '');
    setTopics(existingPresentation.data.topics.join(', '));
    setSlides(existingPresentation.data.slides);
    isInitialized[1](true);
  }

  const { mutate: publish, isPending: isPublishing } = usePublishPresentation();
  const { mutate: publishRaw } = useNostrPublish();

  useSeoMeta({
    title: isEditing ? `Edit: ${title || 'Presentation'}` : 'New Presentation',
  });

  const currentSlide = slides[selectedSlideIndex];
  const totalDuration = calculateTotalDuration(slides);
  const selectedElement = currentSlide?.elements?.find(el => el.id === selectedElementId) ?? null;
  const editingTextElement = currentSlide?.elements?.find(el => el.id === editingTextId) ?? null;

  // ----- Slide operations -----

  const updateSlide = useCallback((index: number, updates: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }, []);

  const updateElements = useCallback((elements: SlideElement[]) => {
    setSlides(prev => prev.map((s, i) =>
      i === selectedSlideIndex ? { ...s, elements } : s
    ));
  }, [selectedSlideIndex]);

  const addSlide = useCallback(() => {
    setSlides(prev => [...prev, createEmptySlide()]);
    setSelectedSlideIndex(slides.length);
    setSelectedElementId(null);
  }, [slides.length]);

  const duplicateSlide = useCallback((index: number) => {
    setSlides(prev => {
      const copy: Slide = JSON.parse(JSON.stringify(prev[index]));
      // Regenerate element ids
      copy.elements = copy.elements?.map(el => ({
        ...el,
        id: Math.random().toString(36).slice(2, 10),
      }));
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setSelectedSlideIndex(index + 1);
  }, []);

  const deleteSlide = useCallback((index: number) => {
    if (slides.length <= 1) {
      toast({ title: 'Cannot delete', description: 'Presentation must have at least one slide.' });
      return;
    }
    setSlides(prev => prev.filter((_, i) => i !== index));
    if (selectedSlideIndex >= index && selectedSlideIndex > 0) {
      setSelectedSlideIndex(prev => prev - 1);
    }
    setSelectedElementId(null);
  }, [slides.length, selectedSlideIndex, toast]);

  const reorderSlide = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= slides.length) return;

    setSlides(prev => {
      const newSlides = [...prev];
      const [moved] = newSlides.splice(fromIndex, 1);
      newSlides.splice(toIndex, 0, moved);
      return newSlides;
    });
    setSelectedSlideIndex(toIndex);
    setSelectedElementId(null);
  }, [slides.length]);

  // ----- Element operations -----

  const addElement = useCallback((element: SlideElement) => {
    setSlides(prev => prev.map((s, i) =>
      i === selectedSlideIndex
        ? { ...s, elements: [...(s.elements ?? []), element] }
        : s
    ));
    setSelectedElementId(element.id);
  }, [selectedSlideIndex]);

  const updateSelectedElement = useCallback((updates: Partial<SlideElement>) => {
    if (!selectedElementId) return;
    setSlides(prev => prev.map((s, i) =>
      i === selectedSlideIndex
        ? {
            ...s,
            elements: s.elements?.map(el =>
              el.id === selectedElementId ? { ...el, ...updates } : el
            ),
          }
        : s
    ));
  }, [selectedSlideIndex, selectedElementId]);

  const deleteSelectedElement = useCallback(() => {
    if (!selectedElementId) return;
    setSlides(prev => prev.map((s, i) =>
      i === selectedSlideIndex
        ? { ...s, elements: s.elements?.filter(el => el.id !== selectedElementId) }
        : s
    ));
    setSelectedElementId(null);
  }, [selectedSlideIndex, selectedElementId]);

  const changeElementLayer = useCallback((direction: 'up' | 'down') => {
    if (!selectedElementId) return;
    setSlides(prev => prev.map((s, i) => {
      if (i !== selectedSlideIndex) return s;
      return {
        ...s,
        elements: s.elements?.map(el => {
          if (el.id !== selectedElementId) return el;
          const z = el.zIndex ?? 0;
          return { ...el, zIndex: direction === 'up' ? z + 1 : z - 1 };
        }),
      };
    }));
  }, [selectedSlideIndex, selectedElementId]);

  // Resolve image picker selection based on the current target
  const handleImagePicked = useCallback((url: string) => {
    const target = imageTarget;
    if (!target) return;
    if (target.kind === 'new') {
      addElement(createImageElement(url));
    } else if (target.kind === 'replace') {
      updateSelectedElement({ src: url });
    } else if (target.kind === 'cover') {
      setCoverImage(url);
    }
    setImageTarget(null);
  }, [imageTarget, addElement, updateSelectedElement]);

  // ----- Save -----

  const doPublish = useCallback((finalIdentifier: string, deleteOldSlug: string | null) => {
    publish({
      identifier: finalIdentifier,
      title: title.trim(),
      slides,
      image: coverImage || undefined,
      summary: summary.trim() || undefined,
      topics: topics.split(',').map(t => t.trim()).filter(Boolean),
    }, {
      onSuccess: ({ event }) => {
        // If the slug changed during an edit, delete the old addressable event (NIP-09)
        if (deleteOldSlug) {
          const oldAddr = `${PRESENTATION_KIND}:${event.pubkey}:${deleteOldSlug}`;
          publishRaw({
            kind: 5,
            content: 'Slug changed',
            tags: [['a', oldAddr]],
          });
        }
        toast({ title: 'Presentation saved!' });
        const naddr = nip19.naddrEncode({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier: finalIdentifier,
        });
        navigate(`/${naddr}`);
      },
      onError: (error) => {
        toast({
          title: 'Save failed',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  }, [title, slides, coverImage, summary, topics, publish, publishRaw, navigate, toast]);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      setShowDetails(true);
      return;
    }

    const finalIdentifier = identifier.trim() || generateSlug(title);

    // Slug changed during an edit — confirm before forking/deleting
    if (isEditing && finalIdentifier !== originalIdentifier) {
      setPendingSlugChange(finalIdentifier);
      return;
    }

    doPublish(finalIdentifier, null);
  }, [title, identifier, isEditing, originalIdentifier, doPublish, toast]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-8 px-12 text-center">
            <p className="text-muted-foreground">Please log in to create presentations.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card flex-shrink-0 z-10">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-sm">
                {title || (isEditing ? 'Edit Presentation' : 'New Presentation')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {slides.length} slides • {formatDuration(totalDuration)}
              </p>
            </div>
          </div>

          {/* Insert toolbar */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addElement(createTextElement())}
            >
              <Type className="w-4 h-4 mr-1" />
              Text
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImageTarget({ kind: 'new' })}
            >
              <ImageIcon className="w-4 h-4 mr-1" />
              Image
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addElement(createShapeElement('rect'))}
            >
              <Square className="w-4 h-4 mr-1" />
              Shape
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDetails(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Details
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Slide List Sidebar */}
        <aside className="w-52 border-r bg-muted/30 overflow-y-auto flex-shrink-0">
          <div className="space-y-2 px-3 py-3">
            {slides.map((slide, index) => (
              <div
                key={index}
                draggable
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dropIndex !== index) setDropIndex(index);
                }}
                onDragEnd={() => {
                  if (dragIndex !== null && dropIndex !== null) {
                    reorderSlide(dragIndex, dropIndex);
                  }
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={`
                  group relative rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all overflow-hidden
                  ${selectedSlideIndex === index
                    ? 'border-primary'
                    : 'border-transparent hover:border-muted-foreground/30'
                  }
                  ${dragIndex === index ? 'opacity-40' : ''}
                  ${dropIndex === index && dragIndex !== index ? 'ring-2 ring-primary ring-offset-2 ring-offset-muted' : ''}
                `}
                onClick={() => {
                  setSelectedSlideIndex(index);
                  setSelectedElementId(null);
                }}
              >
                {/* Mini slide preview */}
                <div className="aspect-video bg-slate-900 pointer-events-none">
                  <SlideRenderer slide={slide} />
                </div>

                <div className="px-2 py-1 bg-card flex items-center justify-between">
                  <span className="text-xs truncate flex-1">
                    {index + 1}. {getSlideLabel(slide, index)}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {formatDuration(slide.duration)}
                  </span>
                </div>

                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5 bg-black/60 rounded p-0.5">
                  <button
                    className="h-5 w-5 text-white hover:bg-white/20 rounded flex items-center justify-center"
                    title="Duplicate"
                    onClick={(e) => { e.stopPropagation(); duplicateSlide(index); }}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    className="h-5 w-5 text-red-400 hover:bg-white/20 rounded flex items-center justify-center"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); deleteSlide(index); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add Slide directly after the last slide */}
            <Button onClick={addSlide} className="w-full" variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Slide
            </Button>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 min-w-0 flex flex-col bg-muted/50 p-6">
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="w-full h-full max-w-5xl rounded-lg overflow-hidden shadow-xl ring-1 ring-border">
              {currentSlide && (
                <SlideCanvas
                  slide={currentSlide}
                  selectedId={selectedElementId}
                  onSelect={setSelectedElementId}
                  onChange={updateElements}
                  onEditText={setEditingTextId}
                />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Click to select • Drag to move • Double-click text to edit • Use the toolbar to add elements
          </p>
        </main>

        {/* Properties Panel */}
        <aside className="w-72 border-l bg-card overflow-y-auto flex-shrink-0 p-4">
          {selectedElement ? (
            <ElementProperties
              element={selectedElement}
              onChange={updateSelectedElement}
              onDelete={deleteSelectedElement}
              onLayerChange={changeElementLayer}
              onPickImage={() => setImageTarget({ kind: 'replace', elementId: selectedElement.id })}
            />
          ) : (
            <div className="space-y-4">
              <span className="text-sm font-semibold">Slide {selectedSlideIndex + 1}</span>
              <Separator />

              <div className="space-y-1">
                <Label className="text-xs">Duration (seconds)</Label>
                <Input
                  type="number"
                  className="h-8"
                  min={5}
                  max={600}
                  value={currentSlide?.duration ?? 60}
                  onChange={(e) => updateSlide(selectedSlideIndex, {
                    duration: Math.max(5, parseInt(e.target.value) || 60),
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {formatDuration(currentSlide?.duration ?? 60)}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Background (color or image URL)</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                    value={currentSlide?.background?.startsWith('#') ? currentSlide.background : '#0f172a'}
                    onChange={(e) => updateSlide(selectedSlideIndex, { background: e.target.value })}
                  />
                  <Input
                    className="h-8 flex-1 text-xs"
                    value={currentSlide?.background ?? ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, {
                      background: e.target.value || undefined,
                    })}
                    placeholder="#0f172a or https://..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Speaker Notes</Label>
                <Textarea
                  value={currentSlide?.notes ?? ''}
                  onChange={(e) => updateSlide(selectedSlideIndex, { notes: e.target.value })}
                  placeholder="Notes for yourself during the presentation..."
                  rows={5}
                  className="text-sm"
                />
              </div>

              <Separator />
              <p className="text-xs text-muted-foreground">
                Select an element on the canvas to edit its properties.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Presentation Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Presentation Details</DialogTitle>
            <DialogDescription>
              Metadata for sharing and discovery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Amazing Presentation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="identifier">URL Slug</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.replace(/\s+/g, '-').toLowerCase())}
                placeholder={generateSlug(title) || 'my-presentation'}
              />
              {isEditing && identifier !== originalIdentifier ? (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Changing the slug creates a <strong>new</strong> presentation at a new link.
                  The old one ({originalIdentifier}) stays unless you delete it.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The ID used in this presentation&rsquo;s link. Auto-filled from the title,
                  but you can set it to whatever you like &mdash; renaming the title later won&rsquo;t change it.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A brief description of your presentation..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topics">Tags (comma-separated)</Label>
              <Input
                id="topics"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="nostr, bitcoin, technology"
              />
              <p className="text-xs text-muted-foreground">
                Hashtags for discovery (stored as <code>t</code> tags on the event).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="flex gap-2">
                <Input
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setImageTarget({ kind: 'cover' })}
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={() => setShowDetails(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Text Editing Dialog */}
      <Dialog open={Boolean(editingTextId)} onOpenChange={(open) => !open && setEditingTextId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Text</DialogTitle>
            <DialogDescription>
              Supports markdown: # headings, - bullets, **bold**, *italic*
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={editingTextElement?.content ?? ''}
            onChange={(e) => {
              if (!editingTextId) return;
              setSlides(prev => prev.map((s, i) =>
                i === selectedSlideIndex
                  ? {
                      ...s,
                      elements: s.elements?.map(el =>
                        el.id === editingTextId ? { ...el, content: e.target.value } : el
                      ),
                    }
                  : s
              ));
            }}
            rows={8}
            className="font-mono text-sm"
            autoFocus
          />

          <Button onClick={() => setEditingTextId(null)}>Done</Button>
        </DialogContent>
      </Dialog>

      {/* Image Picker Dialog */}
      <ImagePickerDialog
        open={Boolean(imageTarget)}
        onOpenChange={(open) => !open && setImageTarget(null)}
        onPick={handleImagePicked}
      />

      {/* Slug Change Confirmation */}
      <AlertDialog open={Boolean(pendingSlugChange)} onOpenChange={(open) => !open && setPendingSlugChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change the presentation link?</AlertDialogTitle>
            <AlertDialogDescription>
              You changed the slug from <strong>{originalIdentifier}</strong> to{' '}
              <strong>{pendingSlugChange}</strong>. This creates a new presentation at a new
              link. Choose what to do with the old one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSlugChange) doPublish(pendingSlugChange, null);
                setPendingSlugChange(null);
              }}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Keep both
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (pendingSlugChange) doPublish(pendingSlugChange, originalIdentifier);
                setPendingSlugChange(null);
              }}
            >
              Replace (delete old)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
