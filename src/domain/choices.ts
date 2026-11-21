/**
 * Pure domain validation rules for `choice_groups` (e.g., 3 included sides with repeatable quantities).
 * Guardrail: Customers may select repeated units of the same side (e.g., 2x Arroz + 1x Batata Frita = 3).
 * Sum of selected quantities in each group must satisfy `min_choices <= sum <= max_choices`.
 */

import type { ChoiceGroup, MenuItem, SelectedChoiceInput } from './types';

export interface ChoiceGroupValidationResult {
  groupId: string;
  groupName: string;
  minChoices: number;
  maxChoices: number;
  selectedCount: number;
  remainingToMinimum: number;
  remainingCapacity: number;
  isValid: boolean;
  errorMessage: string | null;
}

export interface MenuItemChoicesValidationResult {
  isValid: boolean;
  groups: ChoiceGroupValidationResult[];
}

/**
 * Calculates the total quantity selected within a specific choice group.
 */
export function getGroupSelectedCount(
  groupId: string,
  selections: ReadonlyArray<Pick<SelectedChoiceInput, 'group_id' | 'quantity'>>,
): number {
  let sum = 0;
  for (const selection of selections) {
    if (selection.group_id === groupId && selection.quantity > 0) {
      sum += selection.quantity;
    }
  }
  return sum;
}

/**
 * Returns whether the customer can add one more unit to a choice group without exceeding `max_choices`.
 */
export function canIncrementChoiceInGroup(
  group: ChoiceGroup,
  choiceItemId: string,
  selections: ReadonlyArray<Pick<SelectedChoiceInput, 'group_id' | 'choice_item_id' | 'quantity'>>,
): boolean {
  const targetOption = group.items.find((item) => item.choice_item_id === choiceItemId);
  if (!targetOption || !targetOption.enabled) {
    return false;
  }
  const currentTotal = getGroupSelectedCount(group.group_id, selections);
  return currentTotal < group.max_choices;
}

/**
 * Validates all selections for a single `ChoiceGroup` against `min_choices <= sum <= max_choices`
 * and checks that every selected option exists and is enabled.
 */
export function validateChoiceGroup(
  group: ChoiceGroup,
  selections: ReadonlyArray<SelectedChoiceInput>,
): ChoiceGroupValidationResult {
  const groupSelections = selections.filter((s) => s.group_id === group.group_id && s.quantity > 0);
  const enabledOptionIds = new Set(
    group.items.filter((item) => item.enabled).map((item) => item.choice_item_id),
  );

  for (const selection of groupSelections) {
    if (!Number.isInteger(selection.quantity) || selection.quantity < 0) {
      return {
        groupId: group.group_id,
        groupName: group.name,
        minChoices: group.min_choices,
        maxChoices: group.max_choices,
        selectedCount: 0,
        remainingToMinimum: group.min_choices,
        remainingCapacity: group.max_choices,
        isValid: false,
        errorMessage: `Quantidade inválida para o grupo "${group.name}".`,
      };
    }

    if (!enabledOptionIds.has(selection.choice_item_id)) {
      return {
        groupId: group.group_id,
        groupName: group.name,
        minChoices: group.min_choices,
        maxChoices: group.max_choices,
        selectedCount: 0,
        remainingToMinimum: group.min_choices,
        remainingCapacity: group.max_choices,
        isValid: false,
        errorMessage: `Opção indisponível selecionada em "${group.name}".`,
      };
    }
  }

  const selectedCount = getGroupSelectedCount(group.group_id, groupSelections);
  const remainingToMinimum = Math.max(0, group.min_choices - selectedCount);
  const remainingCapacity = Math.max(0, group.max_choices - selectedCount);

  if (selectedCount < group.min_choices) {
    const missing = group.min_choices - selectedCount;
    return {
      groupId: group.group_id,
      groupName: group.name,
      minChoices: group.min_choices,
      maxChoices: group.max_choices,
      selectedCount,
      remainingToMinimum,
      remainingCapacity,
      isValid: false,
      errorMessage:
        missing === 1
          ? `Escolha mais 1 opção em "${group.name}".`
          : `Escolha mais ${String(missing)} opções em "${group.name}".`,
    };
  }

  if (selectedCount > group.max_choices) {
    return {
      groupId: group.group_id,
      groupName: group.name,
      minChoices: group.min_choices,
      maxChoices: group.max_choices,
      selectedCount,
      remainingToMinimum,
      remainingCapacity: 0,
      isValid: false,
      errorMessage: `Você selecionou ${String(selectedCount)} opções em "${group.name}" (máximo permitido: ${String(group.max_choices)}).`,
    };
  }

  return {
    groupId: group.group_id,
    groupName: group.name,
    minChoices: group.min_choices,
    maxChoices: group.max_choices,
    selectedCount,
    remainingToMinimum: 0,
    remainingCapacity,
    isValid: true,
    errorMessage: null,
  };
}

/**
 * Validates all `choice_groups` of a `MenuItem`.
 * Used to determine whether the "Adicionar à sacola" CTA can be enabled.
 */
export function validateMenuItemChoices(
  menuItem: Pick<MenuItem, 'choice_groups'>,
  selections: ReadonlyArray<SelectedChoiceInput>,
): MenuItemChoicesValidationResult {
  const groups = menuItem.choice_groups.map((group) => validateChoiceGroup(group, selections));
  const isValid = groups.every((g) => g.isValid);

  return {
    isValid,
    groups,
  };
}
