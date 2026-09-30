import { ref, watch, type Ref } from 'vue';
import type { TreeOrientation } from './useTreeLayout';

export function getOrientationStorageKey(familyId: string): string {
  return `cgp_tree_orientation_${familyId}`;
}

export function loadFamilyOrientation(familyId: string | null | undefined): TreeOrientation {
  if (!familyId || typeof window === 'undefined' || !window.localStorage) {
    return 'vertical';
  }
  try {
    const saved = window.localStorage.getItem(getOrientationStorageKey(familyId));
    if (saved === 'horizontal' || saved === 'vertical') {
      return saved;
    }
  } catch {
    // ignore localStorage errors (e.g. security policy / quota)
  }
  return 'vertical';
}

export function saveFamilyOrientation(familyId: string | null | undefined, orientation: TreeOrientation): void {
  if (!familyId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(getOrientationStorageKey(familyId), orientation);
  } catch {
    // ignore
  }
}

export function useTreeOrientation(familyIdRef: Ref<string | null | undefined>) {
  const orientation = ref<TreeOrientation>(loadFamilyOrientation(familyIdRef.value));

  // When family changes, load saved orientation for that family
  watch(
    () => familyIdRef.value,
    (newFamilyId) => {
      orientation.value = loadFamilyOrientation(newFamilyId);
    },
    { flush: 'sync' }
  );

  function setOrientation(next: TreeOrientation): void {
    orientation.value = next;
    saveFamilyOrientation(familyIdRef.value, next);
  }

  function toggleOrientation(): void {
    setOrientation(orientation.value === 'vertical' ? 'horizontal' : 'vertical');
  }

  return {
    orientation,
    setOrientation,
    toggleOrientation,
  };
}
