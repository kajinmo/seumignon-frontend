/**
 * Curated culinary photography fallbacks matching the Epic E0 Photographer Brief:
 * - Main Filet Mignon dishes: 45-degree diner's angle showing sear, thickness, and sauce glaze.
 * - Individual Side Dishes: 90-degree overhead flat-lay (Zenital) in warm ceramic bowls for the 3x4 modal grid.
 */

const MAIN_DISH_FALLBACKS: Record<string, string> = {
  parmegiana:
    'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=700&q=80',
  medalhao:
    'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=700&q=80',
  madeira:
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',
  grelhado:
    'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=700&q=80',
  strogonoff:
    'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=700&q=80',
  default:
    'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=700&q=80',
};

const SIDE_DISH_FALLBACKS: Record<string, string> = {
  arroz:
    'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=500&q=80',
  fritas:
    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=500&q=80',
  batata:
    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=500&q=80',
  farofa:
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80',
  pure: 'https://images.unsplash.com/photo-1604908554025-aaa87c152c7b?auto=format&fit=crop&w=500&q=80',
  feijao:
    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80',
  legumes:
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=500&q=80',
  salada:
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80',
  default:
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
};

function isUsableRemoteImage(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return false;
  if (trimmed.includes('example.com') || trimmed.endsWith('...')) return false;
  return true;
}

/**
 * Resolves a warm 45-degree dish image URL for a main menu card.
 */
export function resolveDishImageUrl(name: string, providedUrl?: string): string {
  if (isUsableRemoteImage(providedUrl)) {
    return providedUrl!.trim();
  }
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  for (const [keyword, url] of Object.entries(MAIN_DISH_FALLBACKS)) {
    if (keyword !== 'default' && normalized.includes(keyword)) {
      return url;
    }
  }
  return MAIN_DISH_FALLBACKS.default;
}

/**
 * Resolves a 90-degree flat-lay photo URL for an individual side dish card inside the Sweetgreen-style 3x4 grid.
 */
export function resolveSideChoiceImageUrl(name: string, providedUrl?: string): string {
  if (isUsableRemoteImage(providedUrl)) {
    return providedUrl!.trim();
  }
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  for (const [keyword, url] of Object.entries(SIDE_DISH_FALLBACKS)) {
    if (keyword !== 'default' && normalized.includes(keyword)) {
      return url;
    }
  }
  return SIDE_DISH_FALLBACKS.default;
}
