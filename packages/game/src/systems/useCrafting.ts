import { useCallback, useRef, useState } from 'react';
import type { Recipe } from '../types';
import type { InventoryState } from './useInventory';

export interface CraftingConfig {
  recipes: Recipe[];
}

export interface CraftingState {
  /** All known recipes */
  recipes: Recipe[];
  /** Check if a recipe can be crafted (has ingredients) */
  canCraft: (recipeId: string) => boolean;
  /** Craft a recipe (consumes ingredients, adds result) */
  craft: (recipeId: string) => boolean;
  /** Discovered recipe IDs */
  discovered: string[];
  /** Discover a recipe */
  discover: (recipeId: string) => void;
  /** Check if a recipe is discovered */
  isDiscovered: (recipeId: string) => boolean;
}

export function useCrafting(inventory: InventoryState, config: CraftingConfig): CraftingState {
  const { recipes } = config;
  const [, forceRender] = useState(0);
  const discoveredRef = useRef<Set<string>>(new Set(recipes.map(r => r.id)));

  const recipeMap = useCallback(() => {
    const map = new Map<string, Recipe>();
    for (const r of recipes) map.set(r.id, r);
    return map;
  }, [recipes])();

  const canCraft = useCallback((recipeId: string): boolean => {
    const recipe = recipeMap.get(recipeId);
    if (!recipe) return false;
    for (const ingredient of recipe.ingredients) {
      if (!inventory.has(ingredient.id, ingredient.quantity)) return false;
    }
    return true;
  }, [recipeMap, inventory]);

  const craft = useCallback((recipeId: string): boolean => {
    if (!canCraft(recipeId)) return false;
    const recipe = recipeMap.get(recipeId)!;

    // Remove ingredients
    for (const ingredient of recipe.ingredients) {
      inventory.remove(ingredient.id, ingredient.quantity);
    }

    // Add result
    inventory.add({
      id: recipe.result.id,
      name: recipe.result.id,
      quantity: recipe.result.quantity,
    });

    forceRender(n => n + 1);
    return true;
  }, [canCraft, recipeMap, inventory]);

  const discover = useCallback((recipeId: string) => {
    discoveredRef.current.add(recipeId);
    forceRender(n => n + 1);
  }, []);

  const isDiscovered = useCallback((recipeId: string) => {
    return discoveredRef.current.has(recipeId);
  }, []);

  return {
    recipes,
    canCraft,
    craft,
    discovered: Array.from(discoveredRef.current),
    discover,
    isDiscovered,
  };
}
