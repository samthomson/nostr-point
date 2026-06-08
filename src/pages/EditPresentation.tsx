import { useState, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useNavigate, useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical, 
  Clock,
  Image as ImageIcon,
  Eye,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePresentation } from '@/hooks/usePresentations';
import { usePublishPresentation } from '@/hooks/usePublishPresentation';
import { useUploadFile } from '@/hooks/useUploadFile';
import { 
  type Slide, 
  type SlideLayout,
  createEmptySlide,
  createEmptyPresentationContent,
  formatDuration,
  calculateTotalDuration,
} from '@/lib/types';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'untitled';
}

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
  
  // Form state
  const [title, setTitle] = useState(existingPresentation.data?.title ?? '');
  const [identifier, setIdentifier] = useState(existingPresentation.data?.id ?? '');
  const [summary, setSummary] = useState(existingPresentation.data?.summary ?? '');
  const [coverImage, setCoverImage] = useState(existingPresentation.data?.image ?? '');
  const [topics, setTopics] = useState(existingPresentation.data?.topics.join(', ') ?? '');
  const [slides, setSlides] = useState<Slide[]>(
    existingPresentation.data?.slides ?? createEmptyPresentationContent().slides
  );
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  
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
  const { mutate: uploadFile, isPending: isUploading } = useUploadFile();
  
  useSeoMeta({
    title: isEditing ? `Edit: ${title || 'Presentation'}` : 'New Presentation',
  });
  
  const selectedSlide = slides[selectedSlideIndex];
  const totalDuration = calculateTotalDuration(slides);
  
  const updateSlide = useCallback((index: number, updates: Partial<Slide>) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }, []);
  
  const addSlide = useCallback(() => {
    const newSlide = createEmptySlide();
    setSlides(prev => [...prev, newSlide]);
    setSelectedSlideIndex(slides.length);
  }, [slides.length]);
  
  const deleteSlide = useCallback((index: number) => {
    if (slides.length <= 1) {
      toast({ title: 'Cannot delete', description: 'Presentation must have at least one slide.' });
      return;
    }
    setSlides(prev => prev.filter((_, i) => i !== index));
    if (selectedSlideIndex >= index && selectedSlideIndex > 0) {
      setSelectedSlideIndex(prev => prev - 1);
    }
  }, [slides.length, selectedSlideIndex, toast]);
  
  const moveSlide = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= slides.length) return;
    
    setSlides(prev => {
      const newSlides = [...prev];
      [newSlides[fromIndex], newSlides[toIndex]] = [newSlides[toIndex], newSlides[fromIndex]];
      return newSlides;
    });
    setSelectedSlideIndex(toIndex);
  }, [slides.length]);
  
  const handleImageUpload = useCallback(async (
    file: File, 
    target: 'cover' | 'slide'
  ) => {
    uploadFile(file, {
      onSuccess: (tags) => {
        const urlTag = tags.find(t => t[0] === 'url');
        if (urlTag) {
          if (target === 'cover') {
            setCoverImage(urlTag[1]);
          } else {
            updateSlide(selectedSlideIndex, { image: urlTag[1] });
          }
          toast({ title: 'Image uploaded!' });
        }
      },
      onError: (error) => {
        toast({ 
          title: 'Upload failed', 
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  }, [uploadFile, selectedSlideIndex, updateSlide, toast]);
  
  const handleSave = useCallback(() => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    
    const finalIdentifier = identifier.trim() || generateSlug(title);
    
    publish({
      identifier: finalIdentifier,
      title: title.trim(),
      slides,
      image: coverImage || undefined,
      summary: summary.trim() || undefined,
      topics: topics.split(',').map(t => t.trim()).filter(Boolean),
    }, {
      onSuccess: (event) => {
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
  }, [title, identifier, slides, coverImage, summary, topics, publish, navigate, toast]);
  
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">
                {isEditing ? 'Edit Presentation' : 'New Presentation'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {slides.length} slides • {formatDuration(totalDuration)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/preview`)}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={isPublishing}>
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
      
      <div className="flex h-[calc(100vh-57px)]">
        {/* Slide List Sidebar */}
        <aside className="w-64 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4">
            <Button onClick={addSlide} className="w-full" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Slide
            </Button>
          </div>
          
          <div className="space-y-2 px-4 pb-4">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`
                  group relative p-3 rounded-lg border cursor-pointer transition-colors
                  ${selectedSlideIndex === index 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-card hover:bg-muted/50 border-transparent'
                  }
                `}
                onClick={() => setSelectedSlideIndex(index)}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {slide.title || `Slide ${index + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(slide.duration)}
                    </p>
                  </div>
                </div>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                  {index > 0 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(index, 'up');
                      }}
                    >
                      ↑
                    </Button>
                  )}
                  {index < slides.length - 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(index, 'down');
                      }}
                    >
                      ↓
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSlide(index);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </aside>
        
        {/* Main Editor Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Presentation Metadata (collapsed in header section) */}
            <Card>
              <CardHeader>
                <CardTitle>Presentation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={generateSlug(title) || 'my-presentation'}
                    />
                  </div>
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="topics">Topics (comma-separated)</Label>
                    <Input
                      id="topics"
                      value={topics}
                      onChange={(e) => setTopics(e.target.value)}
                      placeholder="nostr, bitcoin, technology"
                    />
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
                        disabled={isUploading}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleImageUpload(file, 'cover');
                          };
                          input.click();
                        }}
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ImageIcon className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Separator />
            
            {/* Selected Slide Editor */}
            {selectedSlide && (
              <Card>
                <CardHeader>
                  <CardTitle>Slide {selectedSlideIndex + 1}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slide-title">Slide Title</Label>
                      <Input
                        id="slide-title"
                        value={selectedSlide.title ?? ''}
                        onChange={(e) => updateSlide(selectedSlideIndex, { title: e.target.value })}
                        placeholder="Slide title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slide-duration">Duration (seconds)</Label>
                      <Input
                        id="slide-duration"
                        type="number"
                        min={5}
                        max={600}
                        value={selectedSlide.duration}
                        onChange={(e) => updateSlide(selectedSlideIndex, { 
                          duration: Math.max(5, parseInt(e.target.value) || 60) 
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(selectedSlide.duration)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="slide-content">Content (Markdown)</Label>
                    <Textarea
                      id="slide-content"
                      value={selectedSlide.content ?? ''}
                      onChange={(e) => updateSlide(selectedSlideIndex, { content: e.target.value })}
                      placeholder="# Heading&#10;&#10;- Bullet point&#10;- Another point"
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Image</Label>
                      <div className="flex gap-2">
                        <Input
                          value={selectedSlide.image ?? ''}
                          onChange={(e) => updateSlide(selectedSlideIndex, { image: e.target.value })}
                          placeholder="https://..."
                          className="flex-1"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          disabled={isUploading}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleImageUpload(file, 'slide');
                            };
                            input.click();
                          }}
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {selectedSlide.image && (
                        <div className="mt-2 rounded-lg overflow-hidden border aspect-video">
                          <img 
                            src={selectedSlide.image} 
                            alt="Slide preview" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="slide-layout">Layout</Label>
                        <Select
                          value={selectedSlide.layout ?? 'default'}
                          onValueChange={(value: SlideLayout) => 
                            updateSlide(selectedSlideIndex, { layout: value })
                          }
                        >
                          <SelectTrigger id="slide-layout">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="title">Title Slide</SelectItem>
                            <SelectItem value="image-left">Image Left</SelectItem>
                            <SelectItem value="image-right">Image Right</SelectItem>
                            <SelectItem value="image-full">Full Image</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="slide-background">Background</Label>
                        <Input
                          id="slide-background"
                          value={selectedSlide.background ?? ''}
                          onChange={(e) => updateSlide(selectedSlideIndex, { background: e.target.value })}
                          placeholder="#000000 or https://..."
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="slide-notes">Speaker Notes</Label>
                    <Textarea
                      id="slide-notes"
                      value={selectedSlide.notes ?? ''}
                      onChange={(e) => updateSlide(selectedSlideIndex, { notes: e.target.value })}
                      placeholder="Notes for yourself during the presentation..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
