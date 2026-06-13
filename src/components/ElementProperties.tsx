import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Heading,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FONT_LABELS, type SlideElement, type ThemeFont } from '@/lib/types';

interface ElementPropertiesProps {
  element: SlideElement;
  onChange: (updates: Partial<SlideElement>) => void;
  onDelete: () => void;
  onLayerChange: (direction: 'up' | 'down') => void;
  onPickImage: () => void;
}

export function ElementProperties({
  element,
  onChange,
  onDelete,
  onLayerChange,
  onPickImage,
}: ElementPropertiesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold capitalize">{element.type}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Bring forward"
            onClick={() => onLayerChange('up')}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Send backward"
            onClick={() => onLayerChange('down')}
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            title="Delete element"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Position & Size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">X</Label>
          <Input
            type="number"
            className="h-8"
            value={Math.round(element.x)}
            onChange={(e) => onChange({ x: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Y</Label>
          <Input
            type="number"
            className="h-8"
            value={Math.round(element.y)}
            onChange={(e) => onChange({ y: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Width</Label>
          <Input
            type="number"
            className="h-8"
            value={Math.round(element.width)}
            onChange={(e) => onChange({ width: Math.max(24, parseInt(e.target.value) || 24) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Height</Label>
          <Input
            type="number"
            className="h-8"
            value={Math.round(element.height)}
            onChange={(e) => onChange({ height: Math.max(24, parseInt(e.target.value) || 24) })}
          />
        </div>
      </div>

      {/* Rotation & Opacity */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Rotation: {element.rotation ?? 0}°</Label>
          <Slider
            min={-180}
            max={180}
            step={1}
            value={[element.rotation ?? 0]}
            onValueChange={([v]) => onChange({ rotation: v })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Opacity: {Math.round((element.opacity ?? 1) * 100)}%</Label>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[(element.opacity ?? 1) * 100]}
            onValueChange={([v]) => onChange({ opacity: v / 100 })}
          />
        </div>
      </div>

      <Separator />

      {/* Text properties */}
      {element.type === 'text' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Content (Markdown)</Label>
            <Textarea
              value={element.content ?? ''}
              onChange={(e) => onChange({ content: e.target.value })}
              rows={5}
              className="font-mono text-sm"
              placeholder="# Heading&#10;- Bullet point&#10;**bold** *italic*"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Font size</Label>
              <Input
                type="number"
                className="h-8"
                min={8}
                max={200}
                value={element.fontSize ?? 32}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 32 })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Font</Label>
              <Select
                value={element.fontFamily ?? '__theme'}
                onValueChange={(v) =>
                  onChange({ fontFamily: v === '__theme' ? undefined : (v as ThemeFont) })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__theme">Theme default</SelectItem>
                  {(Object.keys(FONT_LABELS) as ThemeFont[]).map((f) => (
                    <SelectItem key={f} value={f}>{FONT_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Color override</Label>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                value={element.color ?? '#ffffff'}
                onChange={(e) => onChange({ color: e.target.value })}
              />
              <Input
                className="h-8 flex-1 font-mono text-xs"
                value={element.color ?? ''}
                onChange={(e) => onChange({ color: e.target.value || undefined })}
                placeholder="Theme default"
              />
            </div>
          </div>

          <div className="flex gap-1">
            <Button
              variant={element.align === 'left' || !element.align ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onChange({ align: 'left' })}
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              variant={element.align === 'center' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onChange({ align: 'center' })}
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              variant={element.align === 'right' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onChange({ align: 'right' })}
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <Button
              variant={element.bold ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => onChange({ bold: !element.bold })}
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant={element.heading ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              title="Use heading color from theme"
              onClick={() => onChange({ heading: !element.heading })}
            >
              <Heading className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Image properties */}
      {element.type === 'image' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Image</Label>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8"
              onClick={onPickImage}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Replace image
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fit</Label>
            <Select
              value={element.fit ?? 'contain'}
              onValueChange={(fit: 'contain' | 'cover' | 'fill') => onChange({ fit })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="fill">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Shape properties */}
      {element.type === 'shape' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Shape</Label>
            <Select
              value={element.shape ?? 'rect'}
              onValueChange={(shape: 'rect' | 'ellipse' | 'line') => onChange({ shape })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rect">Rectangle</SelectItem>
                <SelectItem value="ellipse">Ellipse</SelectItem>
                <SelectItem value="line">Line</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fill color</Label>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-9 rounded border cursor-pointer bg-transparent"
                value={element.fill ?? '#3b82f6'}
                onChange={(e) => onChange({ fill: e.target.value })}
              />
              <Input
                className="h-8 flex-1 font-mono text-xs"
                value={element.fill ?? '#3b82f6'}
                onChange={(e) => onChange({ fill: e.target.value })}
              />
            </div>
          </div>

          {element.shape === 'rect' && (
            <div className="space-y-1">
              <Label className="text-xs">Corner radius: {element.radius ?? 0}</Label>
              <Slider
                min={0}
                max={100}
                step={2}
                value={[element.radius ?? 0]}
                onValueChange={([v]) => onChange({ radius: v })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
