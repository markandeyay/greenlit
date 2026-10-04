// Server-safe (no React imports): the root layout inlines this in <head>.
import { STORAGE_KEYS } from '@/config/game';

/**
 * Inline script for <head> that applies stored settings before first paint, so colorblind
 * players never see a flash of the default palette. Mirrors applySettingsToDocument.
 */
export const SETTINGS_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.settings,
)})||"null");var d=document.documentElement;if(s&&s.colorblind===true)d.setAttribute("data-colorblind","true");if(s&&(s.reducedMotion==="on"||s.reducedMotion==="off"))d.setAttribute("data-reduced-motion",s.reducedMotion)}catch(e){}`;
