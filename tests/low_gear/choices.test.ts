import { describe, expect, it } from 'vitest';
import {
  canIncrementChoiceInGroup,
  filterDeliveryZones,
  findDeliveryZoneById,
  getGroupSelectedCount,
  validateChoiceGroup,
  validateMenuItemChoices,
  type ChoiceGroup,
  type DeliveryZone,
  type MenuItem,
} from '../../src/domain';

const includedSidesGroup: ChoiceGroup = {
  group_id: 'included_sides',
  name: 'Acompanhamentos Inclusos',
  min_choices: 3,
  max_choices: 3,
  items: [
    { choice_item_id: 'side_arroz', name: 'Arroz Branco', price_cents: 0, enabled: true },
    { choice_item_id: 'side_fritas', name: 'Batata Frita', price_cents: 0, enabled: true },
    { choice_item_id: 'side_farofa', name: 'Farofa da Casa', price_cents: 0, enabled: true },
    { choice_item_id: 'side_pure', name: 'Purê de Batata', price_cents: 0, enabled: false },
  ],
};

const sampleMenuItem: Pick<MenuItem, 'choice_groups'> = {
  choice_groups: [includedSidesGroup],
};

describe('low_gear: choice_groups 3 included sides validation & delivery_zones search', () => {
  it('allows repeated selections of the same side summing to 3 (e.g., 2x Arroz + 1x Batata Frita = 3)', () => {
    const selections = [
      { group_id: 'included_sides', choice_item_id: 'side_arroz', quantity: 2 },
      { group_id: 'included_sides', choice_item_id: 'side_fritas', quantity: 1 },
    ];

    expect(getGroupSelectedCount('included_sides', selections)).toBe(3);

    const validation = validateMenuItemChoices(sampleMenuItem, selections);
    expect(validation.isValid).toBe(true);
    expect(validation.groups[0].remainingToMinimum).toBe(0);
    expect(validation.groups[0].remainingCapacity).toBe(0);
    expect(canIncrementChoiceInGroup(includedSidesGroup, 'side_arroz', selections)).toBe(false);
  });

  it(' allows 3x of the exact same side (3x Arroz = 3)', () => {
    const selections = [{ group_id: 'included_sides', choice_item_id: 'side_arroz', quantity: 3 }];
    const result = validateChoiceGroup(includedSidesGroup, selections);
    expect(result.isValid).toBe(true);
    expect(result.selectedCount).toBe(3);
  });

  it('flags incomplete selections (< 3) and prevents enabling the add-to-cart CTA', () => {
    const selections = [{ group_id: 'included_sides', choice_item_id: 'side_arroz', quantity: 2 }];
    const result = validateChoiceGroup(includedSidesGroup, selections);

    expect(result.isValid).toBe(false);
    expect(result.remainingToMinimum).toBe(1);
    expect(result.errorMessage).toContain('Escolha mais 1 opção');
    expect(canIncrementChoiceInGroup(includedSidesGroup, 'side_fritas', selections)).toBe(true);
  });

  it('rejects selections exceeding max_choices (> 3) or disabled options', () => {
    const tooMany = [
      { group_id: 'included_sides', choice_item_id: 'side_arroz', quantity: 2 },
      { group_id: 'included_sides', choice_item_id: 'side_fritas', quantity: 2 },
    ];
    expect(validateChoiceGroup(includedSidesGroup, tooMany).isValid).toBe(false);

    const disabledChoice = [
      { group_id: 'included_sides', choice_item_id: 'side_pure', quantity: 3 },
    ];
    expect(validateChoiceGroup(includedSidesGroup, disabledChoice).isValid).toBe(false);
    expect(canIncrementChoiceInGroup(includedSidesGroup, 'side_pure', [])).toBe(false);
  });

  it('filters neighborhood delivery zones accent-insensitively across the 500/800/900 tiers', () => {
    const zones: DeliveryZone[] = [
      { zone_id: 'zone_jardins', name: 'Jardins', distance_km: 1.2, fee_cents: 500 },
      { zone_id: 'zone_consolacao', name: 'Consolação', distance_km: 2.8, fee_cents: 800 },
      { zone_id: 'zone_pinheiros', name: 'Pinheiros', distance_km: 4.9, fee_cents: 900 },
    ];

    const matched = filterDeliveryZones(zones, 'consolacao');
    expect(matched).toHaveLength(1);
    expect(matched[0].zone_id).toBe('zone_consolacao');
    expect(findDeliveryZoneById(zones, 'zone_pinheiros')?.fee_cents).toBe(900);
  });
});
