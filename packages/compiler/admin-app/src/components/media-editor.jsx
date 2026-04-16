import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  RangeControl,
  TextControl,
  TextareaControl,
  ToggleControl,
  Tooltip,
} from '@wordpress/components';
import {
  Information,
  Crop,
  Contrast,
  MagicWand,
  AiGenerate,
  Erase,
  Maximize,
  Reset,
  ZoomIn,
  ZoomOut,
  RotateClockwise,
  RotateCounterclockwise,
  Copy,
  View,
  Upload,
} from '@carbon/icons-react';
import { useRegisterAssistantSurface } from './workspace-context.jsx';
import { useRegisterAssistantContext } from './assistant-provider.jsx';

/* ── Aspect ratio presets ── */
const ASPECT_PRESETS = [
  { id: 'free', label: 'Original', ratio: null },
  { id: '1-1', label: '1:1', ratio: 1 },
  { id: '3-2', label: '3:2', ratio: 3 / 2 },
  { id: '2-3', label: '2:3', ratio: 2 / 3 },
  { id: '4-3', label: '4:3', ratio: 4 / 3 },
  { id: '3-4', label: '3:4', ratio: 3 / 4 },
  { id: '16-9', label: '16:9', ratio: 16 / 9 },
  { id: '9-16', label: '9:16', ratio: 9 / 16 },
  { id: '4-5', label: '4:5', ratio: 4 / 5 },
  { id: '5-4', label: '5:4', ratio: 5 / 4 },
];

const TABS = [
  { id: 'details', label: 'Details', icon: Information },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'adjust', label: 'Adjust', icon: Contrast },
];

const DEFAULT_ADJUST = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  warmth: 0,
  sharpness: 0,
};

const DEFAULT_TRANSFORM = {
  rotate: 0,
  flipX: false,
  flipY: false,
  crop: { x: 0, y: 0, w: 1, h: 1 }, // normalized
  aspect: 'free',
};

const DEFAULT_ENHANCE = {
  scale: 2,
  strength: 58,
  resemblance: 38,
  clarity: 78,
  sharpness: 70,
  matchColor: true,
};

const DEFAULT_GENERATE = {
  prompt: '',
  guidance: 7,
  strength: 65,
};

function cssFilterFor(adjust) {
  if (!adjust) return 'none';
  const { brightness, contrast, saturation, exposure, warmth, sharpness } = adjust;
  // Compose via CSS filters. Exposure and warmth use sepia/hue as proxies.
  const exposureAdj = 100 + (exposure ?? 0);
  const warmthHue = (warmth ?? 0) * -0.3; // +warmth => warmer (toward red)
  return [
    `brightness(${(brightness ?? 100) * (exposureAdj / 100) / 100})`,
    `contrast(${(contrast ?? 100) / 100})`,
    `saturate(${(saturation ?? 100) / 100})`,
    warmth ? `hue-rotate(${warmthHue}deg)` : '',
    warmth ? `sepia(${Math.min(Math.abs(warmth), 30) / 100})` : '',
    sharpness ? `contrast(${1 + sharpness / 400})` : '',
  ].filter(Boolean).join(' ');
}

/* ── Crop overlay component ── */
function CropOverlay({ containerSize, crop, setCrop, aspectRatio }) {
  const draggingRef = useRef(null);

  const commit = useCallback((next) => {
    // Clamp into [0,1]
    let { x, y, w, h } = next;
    w = Math.max(0.02, Math.min(1, w));
    h = Math.max(0.02, Math.min(1, h));
    x = Math.max(0, Math.min(1 - w, x));
    y = Math.max(0, Math.min(1 - h, y));
    setCrop({ x, y, w, h });
  }, [setCrop]);

  const onPointerDown = useCallback((e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    draggingRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  }, [crop]);

  const onPointerMove = useCallback((e) => {
    const d = draggingRef.current;
    if (!d || !containerSize.w) return;
    const dx = (e.clientX - d.startX) / containerSize.w;
    const dy = (e.clientY - d.startY) / containerSize.h;
    const s = d.startCrop;
    const { mode } = d;
    let next = { ...s };
    if (mode === 'move') {
      next.x = s.x + dx;
      next.y = s.y + dy;
    } else {
      if (mode.includes('l')) { next.x = s.x + dx; next.w = s.w - dx; }
      if (mode.includes('r')) { next.w = s.w + dx; }
      if (mode.includes('t')) { next.y = s.y + dy; next.h = s.h - dy; }
      if (mode.includes('b')) { next.h = s.h + dy; }
      // Aspect lock: adjust the perpendicular axis
      if (aspectRatio) {
        // container is rectangular so ratios are in pixel-space; approximate using container aspect
        const pxRatio = (next.w * containerSize.w) / (next.h * containerSize.h);
        if (pxRatio !== aspectRatio) {
          // Recompute height from width based on locked ratio (in image pixels; we only have container ratio here)
          const newHpx = (next.w * containerSize.w) / aspectRatio;
          const newH = newHpx / containerSize.h;
          if (mode.includes('t')) next.y = s.y + s.h - newH;
          next.h = newH;
        }
      }
    }
    commit(next);
  }, [aspectRatio, commit, containerSize.h, containerSize.w]);

  const onPointerUp = useCallback((e) => {
    draggingRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const style = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.w * 100}%`,
    height: `${crop.h * 100}%`,
  };

  const handles = ['tl', 'tr', 'bl', 'br', 't', 'r', 'b', 'l'];
  return (
    <div className="media-ed-crop-layer" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <div className="media-ed-crop-mask" style={{
        background: 'rgba(0,0,0,0.45)',
        clipPath: `polygon(0 0, 0 100%, ${crop.x * 100}% 100%, ${crop.x * 100}% ${crop.y * 100}%, ${(crop.x + crop.w) * 100}% ${crop.y * 100}%, ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%, ${crop.x * 100}% ${(crop.y + crop.h) * 100}%, ${crop.x * 100}% 100%, 100% 100%, 100% 0)`,
      }} />
      <div className="media-ed-crop-box" style={style}
           onPointerDown={(e) => onPointerDown(e, 'move')}>
        <div className="media-ed-crop-thirds" />
        {handles.map((h) => (
          <div
            key={h}
            className={`media-ed-crop-handle media-ed-crop-handle--${h}`}
            onPointerDown={(e) => onPointerDown(e, h)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Canvas/preview ──
   The image is wrapped in a box sized to its natural aspect ratio so the
   crop overlay's normalized [0,1] coordinates map 1:1 to image pixels. */
function AnnotationCanvas({ strokes, onChange, containerSize }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerSize.w || !containerSize.h) return;
    canvas.width = containerSize.w;
    canvas.height = containerSize.h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(75, 99, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (!stroke?.length) continue;
      ctx.beginPath();
      for (let i = 0; i < stroke.length; i++) {
        const p = stroke[i];
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (drawing?.length) {
      ctx.beginPath();
      for (let i = 0; i < drawing.length; i++) {
        const p = drawing[i];
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [strokes, drawing, containerSize.w, containerSize.h]);

  function normalized(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  return (
    <canvas
      ref={canvasRef}
      className="media-ed-annotate"
      onMouseDown={(e) => { setDrawing([normalized(e)]); }}
      onMouseMove={(e) => {
        if (!drawing) return;
        setDrawing((d) => [...d, normalized(e)]);
      }}
      onMouseUp={() => {
        if (drawing?.length > 1) onChange([...strokes, drawing]);
        setDrawing(null);
      }}
      onMouseLeave={() => {
        if (drawing?.length > 1) onChange([...strokes, drawing]);
        setDrawing(null);
      }}
    />
  );
}

function ImageStage({
  src, transform, adjust, activeTab, onUpdateCrop, zoom, natural,
  annotations = [], onChangeAnnotations,
}) {
  const boxRef = useRef(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!boxRef.current) return;
    const el = boxRef.current;
    const update = () => setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { rotate, flipX, flipY, crop } = transform;
  const cropCss = activeTab !== 'crop' ? {
    clipPath: `inset(${crop.y * 100}% ${(1 - crop.x - crop.w) * 100}% ${(1 - crop.y - crop.h) * 100}% ${crop.x * 100}%)`,
  } : {};

  const imgStyle = {
    transform: `rotate(${rotate}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
    filter: cssFilterFor(adjust),
    ...cropCss,
  };

  const aspectPreset = ASPECT_PRESETS.find((p) => p.id === transform.aspect);
  const aspectRatio = aspectPreset?.ratio ?? null;
  const naturalAspect = natural.w && natural.h ? natural.w / natural.h : 1;

  const boxOuterStyle = {
    transform: `scale(${zoom})`,
  };
  void naturalAspect; // currently derived client-side via natural img size

  return (
    <div className="media-ed-stage">
      <div className="media-ed-image-box" style={boxOuterStyle} ref={boxRef}>
        <img
          src={src}
          alt=""
          draggable={false}
          className="media-ed-img"
          style={imgStyle}
        />
        {activeTab === 'crop' ? (
          <CropOverlay
            containerSize={boxSize}
            crop={crop}
            setCrop={onUpdateCrop}
            aspectRatio={aspectRatio}
          />
        ) : null}
        {activeTab === 'generate' ? (
          <AnnotationCanvas
            strokes={annotations}
            onChange={onChangeAnnotations}
            containerSize={boxSize}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ── Slider helper ── */
function SliderRow({ label, value, min, max, step = 1, onChange, onReset, formatValue }) {
  const isDefault = value === 0 || value === 100;
  return (
    <div className="media-ed-slider">
      <div className="media-ed-slider__head">
        <span className="media-ed-slider__label">{label}</span>
        <button
          type="button"
          className="media-ed-slider__value"
          onClick={onReset}
          title={isDefault ? '' : 'Reset'}
        >
          {formatValue ? formatValue(value) : value}
        </button>
      </div>
      <RangeControl
        value={value}
        onChange={(v) => onChange(v ?? 0)}
        min={min}
        max={max}
        step={step}
        withInputField={false}
        __nextHasNoMarginBottom
      />
    </div>
  );
}

/* ── Generate controls panel (guidance + strength sliders) ── */
function GenerateControls({ guidance, strength, annotations, onChangeGuidance, onChangeStrength, onClearAnnotations }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const hasAnnotations = annotations.length > 0;
  const isNonDefault = guidance !== 7 || strength !== 65;

  // Close on outside click without using a backdrop that competes with the
  // workspace overlay stacking context.
  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside, true);
    return () => document.removeEventListener('mousedown', handleOutside, true);
  }, [open]);

  return (
    <div ref={containerRef} className="media-ed-gen-controls">
      <button
        type="button"
        className={`media-ed-gen-controls__trigger${isNonDefault ? ' is-modified' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Parameters{isNonDefault ? ' ·' : ''}
        {isNonDefault ? <span className="media-ed-gen-controls__badge">{guidance} · {strength}%</span> : null}
      </button>
      {hasAnnotations ? (
        <span className="media-ed-gen-controls__annotations">
          {annotations.length} annotation{annotations.length === 1 ? '' : 's'}
          <button type="button" onClick={onClearAnnotations}>Clear</button>
        </span>
      ) : null}
      {open && (
        <div className="media-ed-gen-controls__panel">
          <SliderRow
            label="Guidance"
            value={guidance}
            min={1}
            max={20}
            onChange={onChangeGuidance}
            onReset={() => onChangeGuidance(7)}
          />
          <SliderRow
            label="Strength"
            value={strength}
            min={0}
            max={100}
            onChange={onChangeStrength}
            onReset={() => onChangeStrength(65)}
            formatValue={(v) => `${v}%`}
          />
        </div>
      )}
    </div>
  );
}

/* ── Details panel ── */
function DetailsPanel({ draft, setDraft, item, copyUrl, copySuccess }) {
  const dims = item.media_details?.width && item.media_details?.height
    ? `${item.media_details.width} × ${item.media_details.height}`
    : null;
  return (
    <div className="media-ed-panel-body">
      <h3 className="media-ed-panel-title">Details</h3>
      <div className="media-ed-fields">
        <TextControl
          label="Title"
          value={draft.title}
          onChange={(v) => setDraft((c) => ({ ...c, title: v }))}
          __next40pxDefaultSize
          __nextHasNoMarginBottom
        />
        <TextControl
          label="Alt text"
          value={draft.altText}
          onChange={(v) => setDraft((c) => ({ ...c, altText: v }))}
          help="Describes the image for screen readers."
          __next40pxDefaultSize
          __nextHasNoMarginBottom
        />
        <TextareaControl
          label="Caption"
          value={draft.caption}
          onChange={(v) => setDraft((c) => ({ ...c, caption: v }))}
          rows={2}
          __nextHasNoMarginBottom
        />
        <TextareaControl
          label="Description"
          value={draft.description}
          onChange={(v) => setDraft((c) => ({ ...c, description: v }))}
          rows={3}
          __nextHasNoMarginBottom
        />
      </div>

      <h3 className="media-ed-panel-title media-ed-panel-title--spaced">File</h3>
      <dl className="media-ed-info">
        <div><dt>Name</dt><dd>{item.source_url?.split('/').pop()}</dd></div>
        <div><dt>Type</dt><dd>{item.mime_type}</dd></div>
        {dims ? <div><dt>Size</dt><dd>{dims}</dd></div> : null}
        <div><dt>Uploaded</dt><dd>{new Date(item.date).toLocaleDateString()}</dd></div>
      </dl>
      <div className="media-ed-url-row">
        <TextControl
          hideLabelFromVision
          label="URL"
          value={draft.sourceUrl}
          readOnly
          onChange={() => {}}
          __next40pxDefaultSize
          __nextHasNoMarginBottom
        />
        <Button variant="secondary" onClick={copyUrl} icon={<Copy size={12} />} __next40pxDefaultSize className="media-ed-copy-btn">
          {copySuccess ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

/* ── Crop panel ── */
function CropPanel({ transform, setTransform }) {
  const setAspect = (id) => {
    const preset = ASPECT_PRESETS.find((p) => p.id === id);
    setTransform((t) => {
      if (!preset?.ratio) return { ...t, aspect: id };
      // Reshape crop to new ratio, centered
      const containerRatio = preset.ratio;
      let w = Math.min(1, t.crop.h * containerRatio);
      let h = w / containerRatio;
      if (h > 1) { h = 1; w = h * containerRatio; }
      const x = (1 - w) / 2;
      const y = (1 - h) / 2;
      return { ...t, aspect: id, crop: { x, y, w, h } };
    });
  };
  const rotateBy = (delta) => setTransform((t) => ({ ...t, rotate: (t.rotate + delta + 360) % 360 }));
  const toggle = (key) => setTransform((t) => ({ ...t, [key]: !t[key] }));
  const reset = () => setTransform(() => ({ ...DEFAULT_TRANSFORM }));

  return (
    <div className="media-ed-panel-body">
      <h3 className="media-ed-panel-title">Crop</h3>
      <div className="media-ed-ratio-grid">
        {ASPECT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`media-ed-ratio${transform.aspect === p.id ? ' is-active' : ''}`}
            onClick={() => setAspect(p.id)}
          >
            <span className={`media-ed-ratio__glyph media-ed-ratio__glyph--${p.id}`} />
            <span className="media-ed-ratio__label">{p.label}</span>
          </button>
        ))}
      </div>

      <h3 className="media-ed-panel-title media-ed-panel-title--spaced">Rotate &amp; flip</h3>
      <div className="media-ed-action-row">
        <Button
          variant="secondary"
          onClick={() => rotateBy(-90)}
          icon={<RotateCounterclockwise size={16} />}
          __next40pxDefaultSize
        >
          -90°
        </Button>
        <Button
          variant="secondary"
          onClick={() => rotateBy(90)}
          icon={<RotateClockwise size={16} />}
          __next40pxDefaultSize
        >
          90°
        </Button>
        <Button
          variant={transform.flipX ? 'primary' : 'secondary'}
          onClick={() => toggle('flipX')}
          __next40pxDefaultSize
        >
          <span className="media-ed-flip-glyph">⇋</span> Flip X
        </Button>
        <Button
          variant={transform.flipY ? 'primary' : 'secondary'}
          onClick={() => toggle('flipY')}
          __next40pxDefaultSize
        >
          <span className="media-ed-flip-glyph media-ed-flip-glyph--v">⇋</span> Flip Y
        </Button>
      </div>

      <div className="media-ed-reset">
        <button type="button" onClick={reset}>Reset crop</button>
      </div>
    </div>
  );
}

/* ── Adjust panel ── */
function AdjustPanel({ adjust, setAdjust }) {
  const set = (key, value) => setAdjust((a) => ({ ...a, [key]: value }));
  const reset = () => setAdjust(() => ({ ...DEFAULT_ADJUST }));
  return (
    <div className="media-ed-panel-body">
      <h3 className="media-ed-panel-title">Adjust</h3>
      <SliderRow label="Brightness" value={adjust.brightness} min={50} max={150}
                 onChange={(v) => set('brightness', v)} onReset={() => set('brightness', 100)} />
      <SliderRow label="Contrast" value={adjust.contrast} min={50} max={150}
                 onChange={(v) => set('contrast', v)} onReset={() => set('contrast', 100)} />
      <SliderRow label="Saturation" value={adjust.saturation} min={0} max={200}
                 onChange={(v) => set('saturation', v)} onReset={() => set('saturation', 100)} />
      <SliderRow label="Exposure" value={adjust.exposure} min={-50} max={50}
                 onChange={(v) => set('exposure', v)} onReset={() => set('exposure', 0)} />
      <SliderRow label="Warmth" value={adjust.warmth} min={-50} max={50}
                 onChange={(v) => set('warmth', v)} onReset={() => set('warmth', 0)} />
      <SliderRow label="Sharpness" value={adjust.sharpness} min={0} max={100}
                 onChange={(v) => set('sharpness', v)} onReset={() => set('sharpness', 0)} />
      <div className="media-ed-reset">
        <button type="button" onClick={reset}>Reset adjustments</button>
      </div>
    </div>
  );
}

/* ── Enhance (AI) panel ── */
function EnhancePanel({ enhance, setEnhance, onApply, isProcessing }) {
  const set = (key, value) => setEnhance((e) => ({ ...e, [key]: value }));
  const scales = [1, 2, 4, 8];
  return (
    <div className="media-ed-panel-body">
      <h3 className="media-ed-panel-title">AI Enhance</h3>
      <p className="media-ed-panel-hint">Upscale, denoise, and restore detail using a generative model.</p>

      <div className="media-ed-scale-row">
        {scales.map((s) => (
          <button
            key={s}
            type="button"
            className={`media-ed-scale${enhance.scale === s ? ' is-active' : ''}`}
            onClick={() => set('scale', s)}
          >
            {s}x
          </button>
        ))}
      </div>

      <SliderRow label="AI Strength" value={enhance.strength} min={0} max={100}
                 onChange={(v) => set('strength', v)} onReset={() => set('strength', 58)}
                 formatValue={(v) => `${v}%`} />
      <SliderRow label="Resemblance" value={enhance.resemblance} min={0} max={100}
                 onChange={(v) => set('resemblance', v)} onReset={() => set('resemblance', 38)}
                 formatValue={(v) => `${v}%`} />
      <SliderRow label="Clarity" value={enhance.clarity} min={0} max={100}
                 onChange={(v) => set('clarity', v)} onReset={() => set('clarity', 78)}
                 formatValue={(v) => `${v}%`} />
      <SliderRow label="Sharpness" value={enhance.sharpness} min={0} max={100}
                 onChange={(v) => set('sharpness', v)} onReset={() => set('sharpness', 70)}
                 formatValue={(v) => `${v}%`} />
      <div className="media-ed-toggle-row">
        <ToggleControl
          label="Match color"
          checked={enhance.matchColor}
          onChange={(v) => set('matchColor', v)}
          __nextHasNoMarginBottom
        />
      </div>
      <Button
        variant="primary"
        className="media-ed-apply-btn"
        onClick={onApply}
        isBusy={isProcessing}
        icon={<MagicWand size={12} />}
        __next40pxDefaultSize
      >
        Enhance
      </Button>
    </div>
  );
}

/* ── Generate (AI) panel ── */
function GeneratePanel({ generate, setGenerate, onApply, isProcessing, annotations, clearAnnotations }) {
  const set = (key, value) => setGenerate((g) => ({ ...g, [key]: value }));
  const hasAnnotations = (annotations?.length ?? 0) > 0;
  return (
    <div className="media-ed-panel-body">
      <h3 className="media-ed-panel-title">AI Generate</h3>
      <p className="media-ed-panel-hint">
        Describe a change, or draw on the image to mark an area. Annotations are included in the variant request.
      </p>
      <TextareaControl
        label="Prompt"
        value={generate.prompt}
        onChange={(v) => set('prompt', v)}
        placeholder="A village with very bright sun behind it…"
        rows={4}
        __nextHasNoMarginBottom
      />
      <div className="media-ed-annotate-status">
        <span>
          {hasAnnotations
            ? `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} on image`
            : 'Drag on the image to annotate (optional).'}
        </span>
        {hasAnnotations ? (
          <Button variant="tertiary" onClick={clearAnnotations} __next40pxDefaultSize>
            Clear
          </Button>
        ) : null}
      </div>
      <SliderRow label="Guidance" value={generate.guidance} min={1} max={20}
                 onChange={(v) => set('guidance', v)} onReset={() => set('guidance', 7)} />
      <SliderRow label="Strength" value={generate.strength} min={0} max={100}
                 onChange={(v) => set('strength', v)} onReset={() => set('strength', 65)}
                 formatValue={(v) => `${v}%`} />
      <Button
        variant="primary"
        className="media-ed-apply-btn"
        onClick={onApply}
        isBusy={isProcessing}
        disabled={!generate.prompt.trim() && !hasAnnotations}
        icon={<AiGenerate size={12} />}
        __next40pxDefaultSize
      >
        Generate variant
      </Button>
    </div>
  );
}

/* ── Apply transform + adjust to a canvas, return blob ── */
async function renderEditedImage({ src, transform, adjust }) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const { rotate, flipX, flipY, crop } = transform;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const cx = crop.x * srcW;
  const cy = crop.y * srcH;
  const cw = crop.w * srcW;
  const ch = crop.h * srcH;

  const rotated = rotate % 180 !== 0;
  const outW = Math.round(rotated ? ch : cw);
  const outH = Math.round(rotated ? cw : ch);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.filter = cssFilterFor(adjust);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img, cx, cy, cw, ch, -cw / 2, -ch / 2, cw, ch);
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/* ── Main image editor ── */
export function ImageEditor({
  item,
  draft,
  setDraft,
  copyUrl,
  copySuccess,
  onExport,
  pushNotice,
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [transform, setTransform] = useState(DEFAULT_TRANSFORM);
  const [adjust, setAdjust] = useState(DEFAULT_ADJUST);
  const [enhance, setEnhance] = useState(DEFAULT_ENHANCE);
  const [generate, setGenerate] = useState(DEFAULT_GENERATE);
  const [annotations, setAnnotations] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [natural, setNatural] = useState({
    w: item.media_details?.width || 0,
    h: item.media_details?.height || 0,
  });

  useEffect(() => {
    if (natural.w && natural.h) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = item.source_url;
  }, [item.source_url, natural.h, natural.w]);

  const updateCrop = useCallback((crop) => {
    setTransform((t) => ({ ...t, crop }));
  }, []);

  const dims = item.media_details?.width && item.media_details?.height
    ? `${Math.round(item.media_details.width * transform.crop.w)} × ${Math.round(item.media_details.height * transform.crop.h)}`
    : null;

  const hasEdits = useMemo(() => {
    const t = transform;
    const a = adjust;
    return t.rotate !== 0 || t.flipX || t.flipY
      || t.crop.x !== 0 || t.crop.y !== 0 || t.crop.w !== 1 || t.crop.h !== 1
      || a.brightness !== 100 || a.contrast !== 100 || a.saturation !== 100
      || a.exposure !== 0 || a.warmth !== 0 || a.sharpness !== 0;
  }, [adjust, transform]);

  const resetAll = () => {
    setTransform({ ...DEFAULT_TRANSFORM });
    setAdjust({ ...DEFAULT_ADJUST });
  };

  const handleExport = async () => {
    if (!hasEdits) {
      pushNotice?.({ status: 'info', message: 'No edits to export.' });
      return;
    }
    setIsProcessing(true);
    try {
      const blob = await renderEditedImage({ src: item.source_url, transform, adjust });
      await onExport(blob);
      resetAll();
    } catch (err) {
      pushNotice?.({ status: 'error', message: `Export failed: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiPlaceholder = useCallback((kind, extras = {}) => {
    const annotationCount = extras.annotations?.length ?? 0;
    pushNotice?.({
      status: 'info',
      message: annotationCount > 0
        ? `${kind} will run with ${annotationCount} annotation${annotationCount === 1 ? '' : 's'} once the AI worker is connected.`
        : `${kind} will run on the server once the AI worker is connected.`,
    });
  }, [pushNotice]);

  const guidance = generate.guidance;
  const strength = generate.strength;
  const onChangeGuidance = useCallback((v) => setGenerate((g) => ({ ...g, guidance: v })), []);
  const onChangeStrength = useCallback((v) => setGenerate((g) => ({ ...g, strength: v })), []);
  const onClearAnnotations = useCallback(() => setAnnotations([]), []);

  // Memoized so the assistant surface's reference stays stable across
  // renders of the media editor. An unstable controls ref re-registers the
  // surface on every render, which in turn re-fires seedSuggestions and
  // causes runaway state updates (and a visible freeze when toggling the
  // parameters popover).
  const assistantControls = useMemo(() => (
    <GenerateControls
      guidance={guidance}
      strength={strength}
      annotations={annotations}
      onChangeGuidance={onChangeGuidance}
      onChangeStrength={onChangeStrength}
      onClearAnnotations={onClearAnnotations}
    />
  ), [guidance, strength, annotations, onChangeGuidance, onChangeStrength, onClearAnnotations]);

  const assistantSurface = useMemo(() => ({
    placeholder: 'Generate or edit this image',
    scope: { kind: 'image-editor', generate, enhance, annotations },
    presets: [
      {
        id: 'enhance',
        label: 'Enhance',
        icon: MagicWand,
        run: () => handleAiPlaceholder('Enhance'),
      },
      {
        id: 'remove-bg',
        label: 'Remove background',
        icon: Erase,
        run: ({ submit }) => submit('Remove the background, keep the subject crisp'),
      },
      {
        id: 'upscale',
        label: 'Upscale 2×',
        icon: Maximize,
        run: () => handleAiPlaceholder('Upscale'),
      },
    ],
    suggestions: [],
    controls: assistantControls,
    onSubmit: async ({ prompt }) => {
      setGenerate((g) => ({ ...g, prompt: prompt || g.prompt }));
      handleAiPlaceholder('Generate', { annotations });
    },
    seedSuggestions: async () => {
      // Non-deterministic page-content-seeded suggestions will hook in here
      // once the AI worker is connected. Static for now.
      return [
        { id: 'seed-mood', label: 'Warm golden hour mood' },
        { id: 'seed-clean', label: 'Clean product shot on white' },
      ];
    },
  }), [annotations, assistantControls, enhance, generate, handleAiPlaceholder]);

  useRegisterAssistantSurface(assistantSurface);

  const mediaAssistantContext = useMemo(() => ({
    view: 'media-editor',
    entity: {
      kind: 'media',
      id: item?.id,
      label: item?.title?.rendered || item?.source_url?.split('/').pop() || `Media ${item?.id || ''}`,
      notes: [
        item?.mime_type ? `MIME: ${item.mime_type}` : null,
        item?.source_url ? `URL: ${item.source_url}` : null,
        'Media items are stored in the WordPress uploads directory (generated/) — they are not source-tracked. Edits go through the WordPress REST API, not a source file.',
      ].filter(Boolean).join('\n'),
    },
  }), [item?.id, item?.mime_type, item?.source_url, item?.title]);
  useRegisterAssistantContext(mediaAssistantContext);

  return (
    <div className="media-ed">
      {/* Top toolbar */}
      <div className="media-ed-topbar">
        <div className="media-ed-topbar__group">
          {TABS.map((t) => (
            <Tooltip key={t.id} text={t.label}>
              <button
                type="button"
                className={`media-ed-tab${activeTab === t.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(t.id)}
                aria-pressed={activeTab === t.id}
              >
                <t.icon size={18} />
              </button>
            </Tooltip>
          ))}
        </div>

        <div className="media-ed-topbar__center">
          {dims ? <span className="media-ed-dims">{dims}</span> : null}
          {hasEdits ? <span className="media-ed-edited-dot">Edited</span> : null}
        </div>

        <div className="media-ed-topbar__group">
          <Tooltip text="Reset">
            <button
              type="button"
              className="media-ed-icon-btn"
              onClick={resetAll}
              disabled={!hasEdits}
            >
              <Reset size={16} />
            </button>
          </Tooltip>
          <Tooltip text="View original">
            <button
              type="button"
              className="media-ed-icon-btn"
              onClick={() => window.open(item.source_url, '_blank', 'noopener,noreferrer')}
            >
              <View size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main body */}
      <div className="media-ed-body">
        <div className="media-ed-canvas-wrap">
          <ImageStage
            src={item.source_url}
            transform={transform}
            adjust={adjust}
            activeTab={activeTab}
            onUpdateCrop={updateCrop}
            zoom={zoom}
            natural={natural}
            annotations={annotations}
            onChangeAnnotations={setAnnotations}
          />
          <div className="media-ed-zoombar">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} title="Zoom out">
              <ZoomOut size={14} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.1))} title="Zoom in">
              <ZoomIn size={14} />
            </button>
            <button type="button" className="media-ed-zoombar__fit" onClick={() => setZoom(1)}>Fit</button>
          </div>
        </div>

        <aside className="media-ed-side">
          {activeTab === 'details' ? (
            <DetailsPanel
              draft={draft}
              setDraft={setDraft}
              item={item}
              copyUrl={copyUrl}
              copySuccess={copySuccess}
            />
          ) : null}
          {activeTab === 'crop' ? (
            <CropPanel transform={transform} setTransform={setTransform} />
          ) : null}
          {activeTab === 'adjust' ? (
            <AdjustPanel adjust={adjust} setAdjust={setAdjust} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
