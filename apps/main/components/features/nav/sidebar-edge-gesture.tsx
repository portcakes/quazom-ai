"use client";

import { useEffect } from "react";
import { useSidebar } from "@quazom-ai/ui/components/ui/sidebar";

/**
 * Mobile touch gesture controller for the off-canvas sidebar.
 *
 * Mounted once inside <SidebarProvider>; renders nothing.
 *
 * Behaviour:
 *  - When the sidebar is CLOSED: a touch that begins anywhere in the
 *    LEFT HALF of the viewport and travels right ≥ 60px (within 400ms,
 *    with ≤ 40px of vertical drift so we don't swallow legitimate
 *    scrolls) opens it. We intentionally avoid the absolute-left edge
 *    because iOS / Android browsers reserve that zone for their native
 *    "swipe back" navigation gesture — starting our drag from there
 *    would just navigate the user out of the app.
 *  - When the sidebar is OPEN: a touch anywhere that travels left ≥ 80px
 *    (same vertical/time budget) closes it. Radix's Sheet already handles
 *    overlay-tap dismissal; the swipe gesture is what was missing.
 *
 * The listener is reattached whenever `openMobile` flips so the open
 * branch and the close branch never have to share state. Desktop bails
 * out entirely.
 */
// Don't start the gesture inside the browser's own "edge swipe to go
// back" reserve. Empirically the back gesture fires within ~20px of
// the left edge on iOS Safari and Chrome, so we leave a generous
// buffer before our hotspot starts.
const EDGE_DEAD_ZONE_PX = 32;
// Touches anywhere in the left HALF of the viewport (after the dead
// zone) arm the open gesture. We compute the half-width at touchstart
// so device rotation can't desync the threshold.
const OPEN_HOTSPOT_RATIO = 0.5;
const OPEN_TRIGGER_PX = 60;
const CLOSE_TRIGGER_PX = 80;
const MAX_VERTICAL_PX = 40;
const MAX_DURATION_MS = 400;

export function SidebarEdgeGesture() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === "undefined") return;

    const abort = new AbortController();
    const { signal } = abort;

    // Per-touch tracking. Reset on every `touchstart` so a previous
    // gesture can't leak state into the next one.
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let triggered = false;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      triggered = false;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      if (openMobile) {
        // Open branch: any touch inside the viewport is fair game for a
        // left-swipe close — Radix's overlay catches the open sheet, so
        // we don't need to bound the start location.
        tracking = true;
      } else {
        // Closed branch: arm the gesture for any touch starting inside
        // the left half of the viewport, *after* the OS back-swipe dead
        // zone. This keeps the hotspot generous (about half the screen)
        // without colliding with mobile browsers' edge-swipe gesture.
        const hotspotMax = window.innerWidth * OPEN_HOTSPOT_RATIO;
        tracking =
          touch.clientX >= EDGE_DEAD_ZONE_PX && touch.clientX <= hotspotMax;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || triggered) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = performance.now() - startTime;
      if (Math.abs(dy) > MAX_VERTICAL_PX) {
        tracking = false;
        return;
      }
      if (dt > MAX_DURATION_MS) {
        tracking = false;
        return;
      }
      if (!openMobile && dx >= OPEN_TRIGGER_PX) {
        triggered = true;
        tracking = false;
        setOpenMobile(true);
        return;
      }
      if (openMobile && dx <= -CLOSE_TRIGGER_PX) {
        triggered = true;
        tracking = false;
        setOpenMobile(false);
      }
    };

    const onTouchEnd = () => {
      tracking = false;
    };

    const listenerOpts: AddEventListenerOptions = { passive: true, signal };
    window.addEventListener("touchstart", onTouchStart, listenerOpts);
    window.addEventListener("touchmove", onTouchMove, listenerOpts);
    window.addEventListener("touchend", onTouchEnd, listenerOpts);
    window.addEventListener("touchcancel", onTouchEnd, listenerOpts);

    return () => {
      abort.abort();
    };
  }, [isMobile, openMobile, setOpenMobile]);

  return null;
}
