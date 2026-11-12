// Категории по умолчанию: два уровня. Верхний уровень — для операций и бюджетов,
// подкатегории «Продуктов» — для товаров из чеков.

export const PALETTE = [
  '#A775C9', '#D480BB', '#DEAFC2', '#8FCB9B', '#C9A3E0', '#E89BC6', '#9DB4E8', '#8CCFC0',
  '#F0B7A4', '#B89AD8', '#E7A6BE', '#B5D9A8', '#C4B0EC', '#D98FB0', '#A5C8E4', '#9ED6AE',
  '#EEC4D8', '#BFA6DC', '#E5B3D4', '#A8D8D0', '#CDB8E8', '#B8A5C9',
];

// Ключи значков (см. icons.js). У «Энергетиков» значок-банка с молнией.
const ICON_OF = {
  food: 'cart', 'food.veg': 'carrot', 'food.fruit': 'apple', 'food.meat': 'meat', 'food.poultry': 'drum',
  'food.fish': 'fish', 'food.dairy': 'milk', 'food.eggs': 'egg', 'food.bread': 'loaf', 'food.grocery': 'jar',
  'food.cereal': 'wheat', 'food.sweets': 'candy', 'food.snacks': 'chips', 'food.drinks': 'glass',
  'food.energy': 'can', 'food.frozen': 'snow', 'food.ready': 'bento', 'food.household': 'spray', 'food.cosmetics': 'drop',
  'food.kids': 'smile', 'food.other': 'box',
  cafe: 'cafe', transport: 'bus', home: 'home', comm: 'phone', health: 'pill', clothes: 'shirt', beauty: 'spark',
  fun: 'ticket', gifts: 'gift', edu: 'book', pets: 'paw', travel: 'plane', other: 'box',
  'inc.salary': 'case', 'inc.side': 'bulb', 'inc.gift': 'gift', 'inc.cashback': 'coin', 'inc.return': 'back', 'inc.other': 'box',
};

const E = (id, name, icon, color, parent = null, extra = {}) => ({ id, name, icon, color, parent, type: 'expense', ...extra });
const I = (id, name, icon, color) => ({ id, name, icon, color, parent: null, type: 'income' });

export const FOOD = 'food';
export const FOOD_OTHER = 'food.other';
export const ENERGY = 'food.energy';

export function defaultCategories() {
  const list = [
    E('food', 'Продукты', '🛒', '#E8A0AE'),
    E('food.veg', 'Овощи', '🥕', '#9DBF93', 'food'),
    E('food.fruit', 'Фрукты и ягоды', '🍓', '#F0A983', 'food'),
    E('food.meat', 'Мясо', '🥩', '#E0A5A5', 'food'),
    E('food.poultry', 'Птица', '🍗', '#F5D6A0', 'food'),
    E('food.fish', 'Рыба и морепродукты', '🐟', '#A7BFE0', 'food'),
    E('food.dairy', 'Молочные продукты', '🥛', '#B3C7D9', 'food'),
    E('food.eggs', 'Яйца', '🥚', '#F2C76B', 'food'),
    E('food.bread', 'Хлеб и выпечка', '🥖', '#D9B48F', 'food'),
    E('food.grocery', 'Бакалея', '🫙', '#C9B79C', 'food'),
    E('food.cereal', 'Крупы и макароны', '🍝', '#E8C3A0', 'food'),
    E('food.sweets', 'Сладости', '🍬', '#F3B6C2', 'food'),
    E('food.snacks', 'Снеки', '🥨', '#D7C46E', 'food'),
    E('food.energy', 'Энергетики', '😠', '#CDA4C9', 'food', { evil: true }),
    E('food.drinks', 'Напитки', '🧃', '#8FC2C4', 'food'),
    E('food.frozen', 'Замороженные продукты', '🧊', '#A9D3C0', 'food'),
    E('food.ready', 'Готовая еда', '🍱', '#F0A983', 'food'),
    E('food.household', 'Бытовая химия', '🧴', '#9FB7A8', 'food'),
    E('food.cosmetics', 'Косметика и гигиена', '🧼', '#E6B8D6', 'food'),
    E('food.kids', 'Детские товары', '🧸', '#B5A6D6', 'food'),
    E('food.other', 'Другое', '📦', '#BBA58F', 'food'),

    E('cafe', 'Кафе и рестораны', '☕', '#F2C76B'),
    E('transport', 'Транспорт', '🚌', '#A7BFE0'),
    E('home', 'Жильё и ЖКУ', '🏠', '#C9B79C'),
    E('comm', 'Связь и подписки', '📱', '#8FC2C4'),
    E('health', 'Здоровье и аптека', '💊', '#9DBF93'),
    E('clothes', 'Одежда и обувь', '👗', '#E6B8D6'),
    E('beauty', 'Красота', '💅', '#F3B6C2'),
    E('fun', 'Развлечения', '🎬', '#B5A6D6'),
    E('gifts', 'Подарки', '🎁', '#E0A5A5'),
    E('edu', 'Образование', '📚', '#D7C46E'),
    E('pets', 'Питомцы', '🐾', '#E8C3A0'),
    E('travel', 'Путешествия', '✈️', '#A9D3C0'),
    E('other', 'Другое', '📦', '#BBA58F'),

    I('inc.salary', 'Зарплата', '💼', '#9DBF93'),
    I('inc.side', 'Подработка', '💡', '#F2C76B'),
    I('inc.gift', 'Подарки', '🎁', '#E8A0AE'),
    I('inc.cashback', 'Кэшбэк и проценты', '💳', '#8FC2C4'),
    I('inc.return', 'Возвраты', '↩️', '#B5A6D6'),
    I('inc.other', 'Другое', '📦', '#BBA58F'),
  ];
  return list.map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length], icon: ICON_OF[c.id] ? 'i:' + ICON_OF[c.id] : c.icon, order: i, builtin: true }));
}

export const PAY_METHODS = [
  { id: 'card', name: 'Карта', icon: '💳' },
  { id: 'cash', name: 'Наличные', icon: '💵' },
  { id: 'transfer', name: 'Перевод', icon: '🔁' },
];

export const EMOJI_CHOICES = ['🛒', '🍎', '🥦', '🥩', '🐟', '🧀', '🍞', '🍫', '🍿', '🥤', '☕', '🍕', '🍣', '🚌', '🚕', '⛽', '🚗', '🏠', '💡', '📱', '💻', '💊', '🩺', '👗', '👟', '💅', '💇', '🎬', '🎮', '🎨', '🎁', '📚', '🎓', '🐾', '✈️', '🏖️', '🏋️', '⚽', '🧸', '👶', '🧴', '🧹', '🔧', '🌷', '🎉', '💼', '💡', '💰', '💳', '🏦', '📈', '↩️', '📦', '⭐', '❤️', '🐰'];
