import React, { useRef, useState } from 'react';
import { Footprints } from 'lucide-react';
import { MobileInputState } from '../types';

interface MobileJoystickProps {
  mobileInputRef: React.MutableRefObject<MobileInputState>;
}

const PAD_RADIUS = 40;
const KNOB_MAX_OFFSET = 24;

/**
 * Compact bottom-left touch & pointer joystick + Run toggle for Walking Mode.
 * Sized cleanly for narrow mobile viewports above the minimal bottom dock.
 */
export const MobileJoystick: React.FC<MobileJoystickProps> = ({ mobileInputRef }) => {
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprintActive, setSprintActive] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateVector = (clientX: number, clientY: number) => {
    const dx = clientX - centerRef.current.x;
    const dy = clientY - centerRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(KNOB_MAX_OFFSET, dist);
    const scale = dist > 0.001 ? clamped / dist : 0;
    const kx = dx * scale;
    const ky = dy * scale;

    setKnobOffset({ x: kx, y: ky });
    mobileInputRef.current.moveX = kx / KNOB_MAX_OFFSET;
    mobileInputRef.current.moveY = -ky / KNOB_MAX_OFFSET;
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    mobileInputRef.current.moveX = 0;
    mobileInputRef.current.moveY = 0;
  };

  return (
    <div className="fixed bottom-[94px] left-2.5 sm:left-4 z-20 flex items-end gap-2 select-none">
      <div
        role="application"
        aria-label="Walking movement joystick"
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          const rect = e.currentTarget.getBoundingClientRect();
          centerRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          pointerIdRef.current = e.pointerId;
          updateVector(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          updateVector(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          resetStick();
        }}
        onPointerCancel={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          resetStick();
        }}
        style={{
          width: PAD_RADIUS * 2,
          height: PAD_RADIUS * 2,
          touchAction: 'none',
        }}
        className="relative rounded-full bg-[#10151c]/82 border border-white/25 shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
        <div
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
          className="absolute w-9 h-9 rounded-full bg-amber-400 border-2 border-white shadow-lg pointer-events-none"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          const next = !sprintActive;
          setSprintActive(next);
          mobileInputRef.current.sprint = next;
        }}
        aria-pressed={sprintActive}
        className={`h-8 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer transition-colors ${
          sprintActive
            ? 'bg-amber-400 text-slate-950 border-amber-200'
            : 'bg-[#10151c]/86 text-slate-100 border-white/20 hover:bg-[#1a222d]'
        }`}
      >
        <Footprints className="w-3.5 h-3.5" />
        <span>{sprintActive ? 'Run' : 'Walk'}</span>
      </button>
    </div>
  );
};
