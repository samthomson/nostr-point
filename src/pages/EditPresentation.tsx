import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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
  Palette,
  LayoutPanelLeft,
  FileCode,
  Settings,
  Layers,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SlideCanvas } from '@/components/SlideCanvas';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ElementProperties } from '@/components/ElementProperties';
import { ImagePickerDialog } from '@/components/ImagePickerDialog';
import { PresentationStatsBar } from '@/components/PresentationStatsBar';
import { LoginArea } from '@/components/auth/LoginArea';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePresentation } from '@/hooks/usePresentations';
import { usePublishPresentation } from '@/hooks/usePublishPresentation';
import { useUploadFile } from '@/hooks/useUploadFile';
import { resizeImageForUpload } from '@/lib/imageResize';
import { markdownToSlides, slidesToMarkdown } from '@/lib/markdownSlides';
import { computePresentationStats } from '@/lib/presentationStats';
import { cn } from '@/lib/utils';
import {
  type Slide,
  type SlideElement,
  type Theme,
  type ThemeFont,
  createEmptySlide,
  createTextElement,
  createImageElement,
  createShapeElement,
  createEmptyPresentationContent,
  generatePresentationId,
  formatDuration,
  getSlideLabel,
  DEFAULT_THEME,
  THEME_PRESETS,
  FONT_LABELS,
} from '@/lib/types';

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

  // The presentation's stable identifier (d tag). For new presentations this is
  // a random UUID generated once; for edits it's the existing one. Users never
  // see or edit this — the title is the only human-facing name.
  const [identifier] = useState(() => existingData?.identifier ?? generatePresentationId());

  // Form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [topics, setTopics] = useState('');
  const [slides, setSlides] = useState<Slide[]>(
    createEmptyPresentationContent().slides
  );
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [imageTarget, setImageTarget] = useState<ImageTarget | null>(null);
  const [mode, setMode] = useState<'visual' | 'markdown'>('visual');
  const [markdownBuffer, setMarkdownBuffer] = useState('');
  // Snapshot of the saveable content at last save (or initial load), used to
  // detect unsaved changes. null = treat any edit as dirty (new, unsaved deck).
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  // Update state when existing data loads
  const isInitialized = useState(false);
  if (existingPresentation.data && !isInitialized[0]) {
    setTitle(existingPresentation.data.title);
    setSummary(existingPresentation.data.summary ?? '');
    setCoverImage(existingPresentation.data.image ?? '');
    setTopics(existingPresentation.data.topics.join(', '));
    setSlides(existingPresentation.data.slides);
    setTheme(existingPresentation.data.theme);
    // Record the loaded state as the saved baseline
    setSavedSnapshot(JSON.stringify({
      title: existingPresentation.data.title,
      summary: existingPresentation.data.summary ?? '',
      coverImage: existingPresentation.data.image ?? '',
      topics: existingPresentation.data.topics.join(', '),
      slides: existingPresentation.data.slides,
      theme: existingPresentation.data.theme,
    }));
    isInitialized[1](true);
  }

  const { mutate: publish, isPending: isPublishing } = usePublishPresentation();
  const { mutateAsync: uploadFile } = useUploadFile();

  useSeoMeta({
    title: isEditing ? `Edit: ${title || 'Presentation'}` : 'New Presentation',
  });

  // Prevent the browser from navigating to / opening a file when an image is
  // dropped outside the canvas drop zone (the default browser behavior).
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const currentSlide = slides[selectedSlideIndex];
  const selectedElement = currentSlide?.elements?.find(el => el.id === selectedElementId) ?? null;
  const editingTextElement = currentSlide?.elements?.find(el => el.id === editingTextId) ?? null;

  // Detect unsaved changes by comparing current saveable content to the snapshot.
  // In markdown mode, the buffer hasn't been committed to slides yet, so any
  // markdown editing counts as dirty.
  const currentSnapshot = useMemo(
    () => JSON.stringify({ title, summary, coverImage, topics, slides, theme }),
    [title, summary, coverImage, topics, slides, theme]
  );
  const isDirty = mode === 'markdown' || savedSnapshot === null || currentSnapshot !== savedSnapshot;

  // Live stats — in markdown mode reflect the buffer, otherwise the slides state
  const stats = useMemo(() => {
    const effectiveSlides = mode === 'markdown' ? markdownToSlides(markdownBuffer) : slides;
    return computePresentationStats({
      slides: effectiveSlides,
      theme,
      title,
      summary,
      image: coverImage || undefined,
      topics: topics.split(',').map(t => t.trim()).filter(Boolean),
    });
  }, [mode, markdownBuffer, slides, theme, title, summary, coverImage, topics]);

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

  // Handle images dropped directly onto the canvas: upload to Blossom, then
  // place each as an image element centered on the drop point.
  const handleDropImages = useCallback(async (files: File[], x: number, y: number) => {
    for (const file of files) {
      const uploading = toast({ title: `Uploading ${file.name}…` });
      try {
        const resized = await resizeImageForUpload(file);
        const tags = await uploadFile(resized);
        const url = tags.find((t) => t[0] === 'url')?.[1];
        if (url) {
          const w = 480;
          const h = 320;
          addElement(createImageElement(url, {
            x: Math.round(x - w / 2),
            y: Math.round(y - h / 2),
            width: w,
            height: h,
          }));
        }
        uploading.dismiss();
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: error instanceof Error ? error.message : 'Could not upload image.',
          variant: 'destructive',
        });
      }
    }
  }, [uploadFile, addElement, toast]);

  // ----- Mode switching (Visual <-> Markdown) -----

  const enterMarkdownMode = useCallback(() => {
    setMarkdownBuffer(slidesToMarkdown(slides));
    setSelectedElementId(null);
    setMode('markdown');

    // Warn if the deck uses canvas features markdown can't represent, since
    // switching back to visual will re-flow to the standard auto-layout.
    const hasRichLayout = slides.some((s) =>
      (s.elements ?? []).some((el) =>
        el.type === 'shape' ||
        el.rotation ||
        (el.type === 'text' && (el.color || el.fontFamily))
      )
    );
    if (hasRichLayout) {
      toast({
        title: 'Heads up: markdown is simpler than the canvas',
        description: 'Custom positions, shapes, rotations and per-element colors aren\u2019t captured in markdown. Switching back to Visual will re-flow to the standard layout.',
      });
    }
  }, [slides, toast]);

  /** Parse the markdown buffer into slides; returns the new slides */
  const commitMarkdown = useCallback((): Slide[] => {
    const parsed = markdownToSlides(markdownBuffer);
    const next = parsed.length > 0 ? parsed : createEmptyPresentationContent().slides;
    setSlides(next);
    setSelectedSlideIndex((i) => Math.min(i, next.length - 1));
    return next;
  }, [markdownBuffer]);

  const enterVisualMode = useCallback(() => {
    commitMarkdown();
    setMode('visual');
  }, [commitMarkdown]);

  // ----- Save -----

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      setShowDetails(true);
      return;
    }

    // If editing in markdown mode, commit the buffer first
    const finalSlides = mode === 'markdown' ? commitMarkdown() : slides;

    publish({
      identifier,
      title: title.trim(),
      slides: finalSlides,
      theme,
      image: coverImage || undefined,
      summary: summary.trim() || undefined,
      topics: topics.split(',').map(t => t.trim()).filter(Boolean),
    }, {
      onSuccess: ({ event }) => {
        toast({ title: 'Presentation saved!' });
        const naddr = nip19.naddrEncode({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier,
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
  }, [title, identifier, slides, theme, mode, commitMarkdown, coverImage, summary, topics, publish, navigate, toast]);

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
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      {/* Row 1 — App header: navigation + account + save */}
      <header className="border-b bg-card flex-shrink-0 z-10">
        <div className="px-4 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Layers className="w-6 h-6 text-primary" />
              <span className="font-bold hidden sm:inline">Nostr Point</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings" aria-label="Settings">
                <Settings className="w-5 h-5" />
              </Link>
            </Button>
            <LoginArea className="max-w-40" />
          </div>
        </div>
      </header>

      {/* Row 2 — Presentation header: title + presentation actions */}
      <div className="border-b bg-card flex-shrink-0 z-10">
        <div className="px-4 h-14 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1 max-w-2xl">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled presentation"
              aria-label="Presentation title"
              className="h-9 px-2 -ml-2 font-semibold text-base border-transparent bg-transparent hover:bg-muted/50 focus-visible:bg-background focus-visible:border-input"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowTheme(true)}>
              <Palette className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Theme</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDetails(true)}>
              <Settings2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Details</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPublishing || !isDirty}
              variant={isDirty ? 'default' : 'outline'}
              className={cn(isDirty && 'shadow-sm ring-2 ring-primary/30')}
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {isPublishing ? 'Saving…' : isDirty ? 'Save' : 'Saved'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Row 3 — Tool strip: mode toggle + insert tools */}
      <div className="border-b bg-card flex-shrink-0 z-10">
        <div className="px-4 h-12 flex items-center gap-4">
          {/* Visual / Markdown toggle */}
          <div className="flex rounded-md border overflow-hidden shrink-0">
            <button
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'visual' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => mode !== 'visual' && enterVisualMode()}
            >
              <LayoutPanelLeft className="w-3.5 h-3.5" />
              Visual
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'markdown' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => mode !== 'markdown' && enterMarkdownMode()}
            >
              <FileCode className="w-3.5 h-3.5" />
              Markdown
            </button>
          </div>

          {mode === 'visual' ? (
            <>
              <div className="w-px h-6 bg-border" />
              <span className="text-xs text-muted-foreground hidden md:inline">Insert:</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => addElement(createTextElement())}>
                  <Type className="w-4 h-4 mr-1.5" />
                  Text
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setImageTarget({ kind: 'new' })}>
                  <ImageIcon className="w-4 h-4 mr-1.5" />
                  Image
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addElement(createShapeElement('rect'))}>
                  <Square className="w-4 h-4 mr-1.5" />
                  Shape
                </Button>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Slides separated by <code className="px-1 bg-muted rounded">---</code>
            </span>
          )}
        </div>
      </div>

      {mode === 'markdown' ? (
        <div className="flex flex-1 min-h-0">
          {/* Markdown editor */}
          <div className="flex-1 min-w-0 flex flex-col border-r">
            <Textarea
              value={markdownBuffer}
              onChange={(e) => setMarkdownBuffer(e.target.value)}
              className="flex-1 resize-none rounded-none border-0 font-mono text-sm p-6 focus-visible:ring-0"
              placeholder={`# My Title\n\nA subtitle or intro\n\n---\n\n## Second slide\n\n- Point one\n- Point two\n\n![](https://example.com/image.jpg)\n\nNote: speaker notes go here\n\n<!-- duration: 90 -->`}
              spellCheck={false}
            />
            <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
              Separate slides with <code className="px-1 bg-muted rounded">---</code> •{' '}
              <code className="px-1 bg-muted rounded"># Heading</code> •{' '}
              <code className="px-1 bg-muted rounded">![](url)</code> for images •{' '}
              <code className="px-1 bg-muted rounded">Note:</code> for speaker notes •{' '}
              <code className="px-1 bg-muted rounded">{'<!-- duration: 90 -->'}</code>
            </div>
          </div>

          {/* Live preview */}
          <div className="w-[380px] flex-shrink-0 bg-muted/50 overflow-y-auto p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Preview ({markdownToSlides(markdownBuffer).length} slides)
            </p>
            {markdownToSlides(markdownBuffer).map((slide, i) => (
              <div key={i} className="rounded-lg overflow-hidden ring-1 ring-border">
                <div className="aspect-video bg-slate-900">
                  <SlideRenderer slide={slide} theme={theme} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
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
                  <SlideRenderer slide={slide} theme={theme} />
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
        <main className="flex-1 min-w-0 flex flex-col bg-muted/50">
          <div className="flex-1 min-h-0 flex items-center justify-center p-6">
            {/* Canvas always keeps 16:9 aspect ratio, fitting the available space */}
            <div className="w-full max-w-5xl max-h-full aspect-video rounded-lg overflow-hidden shadow-xl ring-1 ring-border">
              {currentSlide && (
                <SlideCanvas
                  slide={currentSlide}
                  theme={theme}
                  selectedId={selectedElementId}
                  onSelect={setSelectedElementId}
                  onChange={updateElements}
                  onEditText={setEditingTextId}
                  onDropImages={handleDropImages}
                />
              )}
            </div>
          </div>

          {/* Bottom editing strip: element properties when selected, else slide settings */}
          <div className="border-t bg-card flex-shrink-0 px-4 py-3 min-h-[64px]">
            {selectedElement ? (
              <ElementProperties
                element={selectedElement}
                onChange={updateSelectedElement}
                onDelete={deleteSelectedElement}
                onLayerChange={changeElementLayer}
                onPickImage={() => setImageTarget({ kind: 'replace', elementId: selectedElement.id })}
                onEditText={() => setEditingTextId(selectedElement.id)}
              />
            ) : (
              <div className="flex items-end gap-4 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="h-8 w-20"
                      min={5}
                      max={600}
                      value={currentSlide?.duration ?? 60}
                      onChange={(e) => updateSlide(selectedSlideIndex, {
                        duration: Math.max(5, parseInt(e.target.value) || 60),
                      })}
                    />
                    <span className="text-xs text-muted-foreground w-12">
                      {formatDuration(currentSlide?.duration ?? 60)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Background</Label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                      value={currentSlide?.background?.startsWith('#') ? currentSlide.background : '#0f172a'}
                      onChange={(e) => updateSlide(selectedSlideIndex, { background: e.target.value })}
                    />
                    <Input
                      className="h-8 w-44 text-xs"
                      value={currentSlide?.background ?? ''}
                      onChange={(e) => updateSlide(selectedSlideIndex, {
                        background: e.target.value || undefined,
                      })}
                      placeholder="Theme default"
                    />
                  </div>
                </div>

                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Speaker Notes</Label>
                  <Input
                    className="h-8 text-xs"
                    value={currentSlide?.notes ?? ''}
                    onChange={(e) => updateSlide(selectedSlideIndex, { notes: e.target.value })}
                    placeholder="Notes for yourself during the presentation..."
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      )}

      {/* Bottom stats bar */}
      <PresentationStatsBar stats={stats} />

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

      {/* Theme Dialog */}
      <Dialog open={showTheme} onOpenChange={setShowTheme}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Presentation Theme</DialogTitle>
            <DialogDescription>
              Applies to every slide. Individual slides and text elements can still
              override these defaults.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Presets */}
            <div className="space-y-2">
              <Label className="text-xs">Presets</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setTheme(preset.theme)}
                    className="rounded-lg overflow-hidden ring-1 ring-border hover:ring-primary transition-all text-left"
                  >
                    <div
                      className="aspect-video flex items-center justify-center p-2"
                      style={{ backgroundColor: preset.theme.background }}
                    >
                      <span
                        className="text-sm font-bold truncate"
                        style={{ color: preset.theme.headingColor, fontFamily: FONT_LABELS[preset.theme.font] }}
                      >
                        Aa
                      </span>
                    </div>
                    <div className="px-2 py-1 text-xs bg-card">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom controls */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                    value={theme.background.startsWith('#') ? theme.background : '#0f172a'}
                    onChange={(e) => setTheme({ ...theme, background: e.target.value })}
                  />
                  <Input
                    className="h-8 flex-1 text-xs"
                    value={theme.background}
                    onChange={(e) => setTheme({ ...theme, background: e.target.value })}
                    placeholder="#0f172a or https://..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Font</Label>
                <Select
                  value={theme.font}
                  onValueChange={(font: ThemeFont) => setTheme({ ...theme, font })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FONT_LABELS) as ThemeFont[]).map((f) => (
                      <SelectItem key={f} value={f}>{FONT_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Body text color</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                    value={theme.textColor}
                    onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                  />
                  <Input
                    className="h-8 flex-1 text-xs font-mono"
                    value={theme.textColor}
                    onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Heading color</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                    value={theme.headingColor}
                    onChange={(e) => setTheme({ ...theme, headingColor: e.target.value })}
                  />
                  <Input
                    className="h-8 flex-1 text-xs font-mono"
                    value={theme.headingColor}
                    onChange={(e) => setTheme({ ...theme, headingColor: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={() => setShowTheme(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
