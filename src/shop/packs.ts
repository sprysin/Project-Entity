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
    chaseCardIds: ['P_Future_Outlander', 'P_Everlasting_Dragonlord', 'P_Patron_Of_Judgement'],
    cardIds: [
      'P_Solstice_Sentinel', 'P_High_King', 'P_Force_Fire_Sparker', 'P_Void_Caster', 'P_High_Voltage_Charged_Dragon', 'P_Dual_Mode_Beast', 'P_Big_Bear_Beast_King', 'P_Quickstrike_Serpent',
      'P_Lingering_Lamb', 'P_Glitter_Guard_Beatle', 'P_Glass_Witch', 'P_Curse_Giving_Ghost', 'P_Glitter_Grub', 'P_Zombie_Necromancer', 'P_Turnados_The_Wind_Construct', 'P_Split_Golem',
      'P_Blazing_Pyrotechnic', 'P_Cockroach_Knight', 'P_Engine_Interloper', 'P_Everlasting_Dragonlord',
      'P_Force_Fire_Sparkling_Commander', 'P_Future_Outlander', 'P_Gilded_Glass_Paladin',
      'P_Gluttonous_Tyrano', 'P_Goddess_Of_Fortune', 'P_Infantry_Soldier', 'P_Patron_Of_Judgement',
      'P_Soldier_Of_The_High_Ground', 'P_Steadfast_Hummingbird', 'P_The_Humble_Bubble_Paladin', 'P_Treacherous_Ivy',
      'P_Justice_Jet_Fighter', 'P_Justice_Jet_Zero_Day', 'P_Justice_Jet_Bomber',
      'P_High_Stream_Absolute_Router', 'P_Arc_Angel_Cosine', 'P_Arc_Angel_Sine', 'P_Hopper_The_Rambunctious_Roo', 'P_Thunder_Cracken',
      'A_Void_Blast', 'A_Quick_Recovery', 'A_Mark_Of_The_Forest_Hunter', 'A_Mechanical_Maintenance', 'A_Sacrificial_Lamb', 'A_Tribute_Tribunal', 'A_Thunder_Strike',
      'A_Call_To_Arms', 'A_Flaming_Phenix_Rebirth', 'A_On_Common_Ground', 'A_Shrouded_Kingdom', 'A_Scripture_Of_Faith', 'A_Withering_Sword',
      'A_Windy_Peaks', 'A_Justice_Jet_Sound_Barrier',
      'A_Hunters_Spoils', 'A_Hunters_Mark', 'A_Thick_Fat',
      'C_Reinforcement', 'C_Void_Call', 'C_Dark_Draw', 'C_Call_From_The_Depths', 'C_Escape_Plan', 'C_Orcustrated_Frontline_Unit',
      'C_Conflicted_Mind_Madness', 'C_Unified_Soul_Link', 'C_Containment_Zone', 'C_Last_Resort', 'C_Damage_Deduction',
      'C_Signal_Routing', 'A_Rain_Dance',
      'A_Taste_Test',
      'A_Home_Cooked_Meal',
      'A_Glass_Cannon',
      'A_For_The_Greater_Good',
      'A_Monstrous_Oven',
      'A_Demonic_Recipe',
      'P_Dragonion',
      'P_Eggolem',
      'P_Tomaterror',
      'P_Chickengraver',
      'P_Potatormentor',
      'P_Gluttonous_Amalgamation',
      'C_Culinary_Curse',
      'C_What_Grows_In_The_Graveyard',
      'C_Cast_To_Oblivion',
      'C_Shared_Healing',
      'C_Free_Sample',
    ]
  },
  {
    id: 'fire', name: 'Flames of War', description: 'Burn through the opposition with an army to command.', icon: 'fa-fire', color: '#ff8652', rotationWeight: 3,
    chaseCardIds: ['P_Gilded_Glass_Paladin', 'P_Force_Fire_Sparkling_Commander', 'P_Engine_Interloper'],
    cardIds: ['P_Infantry_Soldier', 'P_Soldier_Of_The_High_Ground', 'P_Force_Fire_Sparker', 'P_Force_Fire_Sparkling_Commander',
      'P_Blazing_Pyrotechnic', 'P_Engine_Interloper', 'P_Gilded_Glass_Paladin', 'P_High_King',
      'A_Call_To_Arms', 'A_Flaming_Phenix_Rebirth', 'A_Withering_Sword', 'C_Reinforcement', 'C_Orcustrated_Frontline_Unit', 'C_Last_Resort']
  },
  {
    id: 'grave', name: 'Graveyard Overgrowth', description: 'Spores of flesh and bone, rise again!', icon: 'fa-seedling', color: '#88dca2', rotationWeight: 1,
    chaseCardIds: ['P_Zombie_Necromancer', 'C_What_Grows_In_The_Graveyard', 'P_Treacherous_Ivy'],
    cardIds: ['P_Curse_Giving_Ghost', 'P_Zombie_Necromancer', 'C_What_Grows_In_The_Graveyard', 'P_Treacherous_Ivy', 'P_Lingering_Lamb', 'P_Glitter_Grub', 'P_Glitter_Guard_Beatle',
      'A_Sacrificial_Lamb', 'A_Quick_Recovery', 'A_Withering_Sword', 'C_Dark_Draw', 'C_Call_From_The_Depths', 'C_Unified_Soul_Link']
  },
  {
    id: 'hunt', name: 'Hunting Season', description: 'Forge a path through the forest with beasts and birds of prey.', icon: 'fa-paw', color: '#f59f49c2', rotationWeight: 2,
    chaseCardIds: ['P_Big_Bear_Beast_King', 'A_Hunters_Mark', 'A_Mark_Of_The_Forest_Hunter'],
    cardIds: ['P_Big_Bear_Beast_King', 'A_Hunters_Mark', 'A_Thick_Fat', 'A_Hunters_Spoils', 'P_Steadfast_Hummingbird', 'C_Escape_Plan',
      'P_Quickstrike_Serpent', 'A_Mark_Of_The_Forest_Hunter', 'A_Tribute_Tribunal', 'A_For_The_Greater_Good']
  },
  {
    id: 'demonic-delights', name: 'Demonic Delights', description: 'From the garden to the grave: feed the Oven and serve a monstrous feast.',
    icon: 'fa-utensils', color: '#d67a44', rotationWeight: 2,
    chaseCardIds: ['A_Monstrous_Oven', 'P_Gluttonous_Amalgamation', 'P_Dragonion'],
    cardIds: [
      'A_Taste_Test',
      'A_Home_Cooked_Meal',
      'A_Monstrous_Oven',
      'A_Demonic_Recipe',
      'P_Dragonion',
      'P_Eggolem',
      'P_Tomaterror',
      'P_Chickengraver',
      'P_Potatormentor',
      'P_Gluttonous_Amalgamation',
      'C_Culinary_Curse',
      'C_What_Grows_In_The_Graveyard',
      'C_Shared_Healing',
      'C_Free_Sample',
      'P_Gluttonous_Tyrano'
    ]
  },
];

// Planned to only stay for a short time to test card openings
export const DEBUG_PACK: Pack = {
  id: 'debug', name: 'Debug pulls', description: 'One fixed card of each rarity.',
  icon: 'fa-diamond', color: '#30F0DD', rotationWeight: 0,
  chaseCardIds: ['P_Zombie_Necromancer', 'P_Future_Outlander', 'P_Everlasting_Dragonlord'],
  cardIds: ['P_Infantry_Soldier', 'P_High_King', 'P_Quickstrike_Serpent', 'P_Zombie_Necromancer', 'P_High_Voltage_Charged_Dragon',
    'P_Future_Outlander', 'P_Everlasting_Dragonlord'],
};
