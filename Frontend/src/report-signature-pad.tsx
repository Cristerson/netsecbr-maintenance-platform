import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Stroke = Point[];

type Props = {
  onChange: (png: Blob | null) => void;
  disabled?: boolean;
};

/** Captura local. Persistência, vínculo ao termo e auditoria cabem ao fluxo autorizado. */
export function ReportSignaturePad({ onChange, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activePointerRef = useRef<number | null>(null);
  const revisionRef = useRef(0);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, rect.width, rect.height);
      context.strokeStyle = '#102b55';
      context.fillStyle = '#102b55';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      for (const stroke of strokesRef.current) {
        if (!stroke.length) continue;
        context.beginPath();
        context.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
        if (stroke.length === 1) {
          context.arc(stroke[0].x * rect.width, stroke[0].y * rect.height, 1, 0, Math.PI * 2);
          context.fill();
          continue;
        }
        for (const point of stroke.slice(1)) {
          context.lineTo(point.x * rect.width, point.y * rect.height);
        }
        context.stroke();
      }
    };

    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    redraw();
    return () => observer.disconnect();
  }, []);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function redraw() {
    // ResizeObserver redesenha em mudanças de layout; esta atribuição força
    // o mesmo caminho após cada traço sem guardar PNGs intermediários.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) return;
    const scale = canvas.width / rect.width;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
    context.strokeStyle = '#102b55';
    context.fillStyle = '#102b55';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const stroke of strokesRef.current) {
      if (!stroke.length) continue;
      context.beginPath();
      context.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
      if (stroke.length === 1) {
        context.arc(stroke[0].x * rect.width, stroke[0].y * rect.height, 1, 0, Math.PI * 2);
        context.fill();
      } else {
        for (const point of stroke.slice(1)) {
          context.lineTo(point.x * rect.width, point.y * rect.height);
        }
        context.stroke();
      }
    }
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setHasInk(true);
    redraw();
    const revision = ++revisionRef.current;
    event.currentTarget.toBlob((blob) => {
      if (revision === revisionRef.current && blob) onChange(blob);
    }, 'image/png');
  }

  function clear() {
    if (disabled) return;
    activePointerRef.current = null;
    strokesRef.current = [];
    revisionRef.current += 1;
    setHasInk(false);
    redraw();
    onChange(null);
  }

  return (
    <div className="field">
      <span>Assinatura do representante</span>
      <canvas
        ref={canvasRef}
        aria-label="Área de assinatura. Use o dedo, a caneta ou o mouse."
        role="img"
        style={{ width: '100%', height: 190, touchAction: 'none', background: '#fff', border: '1px solid #d8e3f0', borderRadius: 7 }}
        onPointerDown={(event) => {
          if (disabled || activePointerRef.current !== null) return;
          activePointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          strokesRef.current.push([pointFromEvent(event)]);
          redraw();
        }}
        onPointerMove={(event) => {
          if (disabled || activePointerRef.current !== event.pointerId) return;
          strokesRef.current.at(-1)?.push(pointFromEvent(event));
          redraw();
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <small>Assine na área acima. A captura ainda não conclui o atendimento.</small>
        <button type="button" disabled={disabled || !hasInk} onClick={clear}>Limpar</button>
      </div>
    </div>
  );
}
