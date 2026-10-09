export interface Pack {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rotationWeight: number;
  cardIds: readonly string[];
  chaseCardIds: readonly [string, string, string];
}

// Explicit lists are intentional: edit a pack without changing card rules.
export const PACKS: readonly Pack[] = [
  {
    id: 'master', name: 'Collector Pack', description: 'The complete collection of all cards.', icon: 'fa-diamond', color: '#edc56f', rotationWeight: 0,
    chaseCardIds: ['pawn_future_outlander', 'pawn_everlasting_dragonlord', 'pawn_patron_of_judgement'],
    cardIds: [
      'pawn_01', 'pawn_02', 'pawn_03', 'pawn_04', 'pawn_05', 'pawn_06', 'pawn_07', 'pawn_08',
      'pawn_09', 'pawn_10', 'pawn_11', 'pawn_12', 'pawn_13', 'pawn_14', 'pawn_15', 'pawn_16',
      'pawn_blazing_pyrotechnic', 'pawn_cockroach_knight', 'pawn_engine_interloper', 'pawn_everlasting_dragonlord',
      'pawn_force_fire_sparkling_commander', 'pawn_future_outlander', 'pawn_gilded_glass_paladin',
      'pawn_gluttonous_tyrano', 'pawn_goddess_of_fortune', 'pawn_infantry_soldier', 'pawn_patron_of_judgement',
      'pawn_soldier_of_the_high_ground', 'pawn_steadfast_hummingbird', 'pawn_the_humble_bubble_paladin', 'pawn_treacherous_ivy',
      'action_01', 'action_02', 'action_03', 'action_04', 'action_05', 'action_06', 'action_07',
      'action_call_to_arms', 'action_flaming_phenix_rebirth', 'action_law_of_the_normal', 'action_shrouded_kingdom', 'action_scripture_of_faith', 'action_withering_sword',
      'condition_01', 'condition_02', 'condition_03', 'condition_04', 'condition_05', 'condition_06',
      'condition_07', 'condition_08', 'condition_09', 'condition_last_resort',
    ]
  },
  {
    id: 'fire', name: 'Flames of War', description: 'Burn through the opposition with an army to command.', icon: 'fa-fire', color: '#ff8652', rotationWeight: 3,
    chaseCardIds: ['pawn_gilded_glass_paladin', 'pawn_force_fire_sparkling_commander', 'pawn_engine_interloper'],
    cardIds: ['pawn_infantry_soldier', 'pawn_soldier_of_the_high_ground', 'pawn_03', 'pawn_force_fire_sparkling_commander',
      'pawn_blazing_pyrotechnic', 'pawn_engine_interloper', 'pawn_gilded_glass_paladin', 'pawn_02',
      'action_call_to_arms', 'action_flaming_phenix_rebirth', 'action_withering_sword', 'condition_01', 'condition_06', 'condition_last_resort']
  },
  {
    id: 'grave', name: 'Graveyard Overgrowth', description: 'Spores of flesh and bone, rise again!', icon: 'fa-seedling', color: '#88dca2', rotationWeight: 1,
    chaseCardIds: ['pawn_14', 'pawn_09', 'pawn_treacherous_ivy'],
    cardIds: ['pawn_12', 'pawn_14', 'pawn_treacherous_ivy', 'pawn_09', 'pawn_13', 'pawn_10',
      'action_03', 'action_05', 'action_02', 'action_withering_sword', 'condition_03', 'condition_04', 'condition_08']
  },
];

// Planned to only stay for a short time to test card openings
export const DEBUG_PACK: Pack = {
  id: 'debug', name: 'Debug pulls', description: 'One fixed card of each rarity.',
  icon: 'fa-diamond', color: '#30F0DD', rotationWeight: 0,
  chaseCardIds: ['pawn_14', 'pawn_future_outlander', 'pawn_everlasting_dragonlord'],
  cardIds: ['pawn_infantry_soldier', 'pawn_02', 'pawn_08', 'pawn_14', 'pawn_05',
    'pawn_future_outlander', 'pawn_everlasting_dragonlord'],
};
