import '../../src/cards/conditions';
import { cardRegistry } from '../../src/cards/CardRegistry';
import { CardType } from '../../src/types';

// Response-window tests need Condition timing now that Reinforcement is an Action.
cardRegistry.register({ ...cardRegistry.getCard('C_Reinforcement')!, id: 'test_attached_condition', type: CardType.CONDITION }, cardRegistry.getEffect('C_Reinforcement')!);
