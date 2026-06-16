import { useState, useRef, useCallback } from 'react';
import { Upload, Link as LinkIcon, Loader2, Image as ImageIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { resizeImageForUpload } from '@/lib/imageResize';

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the resulting Blossom image URL */
  onPick: (url: string) => void;
}

const CORS_PROXY = 'https://proxy.shakespeare.diy/?url=';

export function ImagePickerDialog({ open, onOpenChange, onPick }: ImagePickerDialogProps) {
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const extractUrl = (tags: string[][]): string | undefined =>
    tags.find((t) => t[0] === 'url')?.[1];

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const resized = await resizeImageForUpload(file);
      const tags = await uploadFile(resized);
      const url = extractUrl(tags);
      if (url) {
        onPick(url);
        onOpenChange(false);
        toast({ title: 'Image uploaded!' });
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [uploadFile, onPick, onOpenChange, toast]);

  const handleImportUrl = useCallback(async () => {
    const trimmed = importUrl.trim();
    if (!trimmed) return;

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('URL must be http or https');
      }
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid image URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      // Try direct fetch first, fall back to CORS proxy
      let response: Response;
      try {
        response = await fetch(trimmed);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch {
        response = await fetch(`${CORS_PROXY}${encodeURIComponent(trimmed)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('The URL does not point to an image.');
      }

      // Derive a filename
      const ext = blob.type.split('/')[1] || 'jpg';
      const name = parsed.pathname.split('/').pop() || `image.${ext}`;
      const file = new File([blob], name, { type: blob.type });

      const resized = await resizeImageForUpload(file);
      const tags = await uploadFile(resized);
      const url = extractUrl(tags);
      if (url) {
        onPick(url);
        onOpenChange(false);
        setImportUrl('');
        toast({ title: 'Image imported!', description: 'Re-hosted on your Blossom server.' });
      } else {
        throw new Error('No URL returned from upload');
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Could not import image.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }, [importUrl, uploadFile, onPick, onOpenChange, toast]);

  const busy = isUploading || isImporting;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Image</DialogTitle>
          <DialogDescription>
            Upload from your device or import from a URL. Either way, the image is
            stored on your Blossom server.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="w-4 h-4 mr-2" />
              From URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg py-10 px-6 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isUploading ? 'Uploading...' : 'Click to choose an image'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF, WebP
                </p>
              </div>
            </button>
          </TabsContent>

          <TabsContent value="url" className="pt-2 space-y-3">
            <Input
              placeholder="https://example.com/image.jpg"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleImportUrl();
              }}
              disabled={busy}
            />
            <Button
              className="w-full"
              onClick={handleImportUrl}
              disabled={busy || !importUrl.trim()}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Import & host on Blossom
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              The image is downloaded and re-uploaded to your Blossom server so it
              stays available even if the original link goes down.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
