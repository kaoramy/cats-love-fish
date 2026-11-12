// Встроенный словарь товаров (русский + эстонский + бренды).
// Синтаксис ключей:
//   стем      — слово начинается с этого (молок → молоко, молока)
//   =слово    — слово целиком
//   ~часть    — часть составного слова (для эстонского: apelsinimahl → ~mahl)
//   фраза с пробелом — последовательность слов
//   ! в начале — сильный признак (перебивает остальные)

export const BUILTIN_DICT = {
  'food.veg': `картоф|картош|морков|=лук|лук репч|лук зелен|порей|чеснок|капуст|огур|томат|помидор|перец сладк|перец болг|перец ч|кабач|баклажан|свекл|редис|редьк|тыкв|брокколи|шпинат|салат айсберг|салат ромэн|салат романо|салат листов|салат латук|руккол|укроп|петрушк|кинз|базилик|зелень|сельдер|имбир|авокадо|кукуруз|фасол стручк|=гриб|=грибы|шампиньон|вешенк|опята|спарж|батат|пастернак|черемш|щавел|микрозелень|овощ|kartul|porgand|sibul|küüslauk|kapsas|=kurk|kurgid|tomat|paprika|suvikõrvits|baklažaan|=peet|peedid|redis|kõrvits|brokoli|spinat|=till|petersell|seened|šampinjon|ingver|avokaado|=mais|köögivili|~kartul|~porgand|~sibul|~kapsas|~tomat`,

  'food.fruit': `яблок|=яблоко|груш|банан|апельсин|мандарин|лимон|=лайм|грейпфрут|=киви|виноград|ананас|манго|персик|нектарин|абрикос|=слива|=сливы|вишн|черешн|клубник|малин|черник|голубик|смородин|крыжовник|ежевик|брусник|клюкв|арбуз|=дыня|=дыни|гранат|хурм|инжир|помело|фейхоа|=ягоды|ягода|фрукт|=õun|õunad|=pirn|pirnid|banaan|apelsin|mandariin|sidrun|=laim|greip|kiivi|viinamar|ananass|=mango|virsik|nektariin|aprikoos|ploom|kirss|maasik|vaarika|mustika|sõstar|arbuus|=melon|granaatõun|puuvili|marjad`,

  'food.meat': `говяд|свин|баран|телят|=фарш|фарш мяс|фарш говяж|фарш свин|колбас|сосиск|сардельк|ветчин|бекон|грудинк|окорок|карбонад|буженин|шейк|=ребра|ребрышк|=мясо|мясн|стейк|антрекот|вырезк|салями|сервелат|=пашот|балык|корейк|печень говяж|язык говяж|=лопатка|купаты|шпик|=сало|мираторг|черкизово|останкино|велком|папа может|=вязанка|sealiha|veiseliha|~hakkliha|hakkliha|=vorst|~vorst|viiner|=sink|~sink|peekon|=liha|~liha|=karbonaad|šašlõkk|=ribid|rannarootsi|печень|печен говяж`,

  'food.poultry': `куриц|курин|=кура|=куры|курочк|цыпл|бройл|индей|индюш|утк|утин|=гусь|перепел|петелинк|приосколь|=окорочка|окорочк|бедро кур|голень|крыл|грудк|=kana|~kana|broiler|kalkun|=part|kanafilee|kanakoib|~koivad|=tiivad|~tiivad`,

  'food.fish': `рыб|лосос|семг|форел|сельд|селед|скумбр|треск|минта|хек|судак|=карп|окун|тунец|тунц|горбуш|=кета|=кеты|нерк|кижуч|дорадо|сибас|=икра|креветк|кальмар|миди|краб|морепр|устриц|=шпроты|шпрот|сардин|анчоус|=килька|корюшк|камбал|палтус|пангасиус|тилапи|=кала|~kala|lõhe|forell|heeringas|räim|skumbria|tursk|tuunikala|krevet|kalmaar|rannakarp|=kilu|kilud|~kilu|kalamari|krabipulk|surimi|сурими|крабов`,

  'food.dairy': `молок|=мол|кефир|ряженк|простокваш|йогурт|йогурт|сметан|творог|творож|=сыр|=сыры|сырок|сыр плав|сырн|моцарел|пармезан|фета|брынз|рикотт|маскарпон|=масло слив|масло сливоч|сливочн|=сливки|сливки|ацидофил|айран|варенец|=снежок|бифидок|=пахта|=маргарин|спред|актимел|активи|danone|данон|эрмигурт|=чудо|простоквашино|домик в деревне|веселый молочник|савушкин|экомилк|=president|президент|hochland|хохланд|valio|валио|=tere|=alma|farmi|=piim|~piim|piima|keefir|jogurt|=jogurti|hapukoor|kohupiim|=juust|~juust|juustu|=või|vahukoor|=koor|=rjaženka|=pett|kodujuust|=hapupiim|=desert kohupiima`,

  'food.eggs': `!яйц|!=яйцо|!яйца|!=муна|!=munad|!~munad|перепелин яйц|!kanamuna`,

  'food.bread': `хлеб|батон|багет|=булк|булочк|булка|лаваш|лепешк|чиабатт|круассан|сдоб|пирож|пирог|ватрушк|=плюшк|бублик|сушк|баранк|=сухари|сухарик|хлебц|тортилья|кекс|маффин|=рулет|=бородинск|ржан|=leib|~leib|=sai|~sai|=saia|sepik|kukkel|sarvesai|=lavaš|=pirukas|~pirukas|~kook|=kringel|=kaneelirull|=baguette|tortilja|=röst`,

  'food.grocery': `сахар|=соль|соль пов|мука|=мук|=масло подсолн|масло подсолн|подсолнеч|масло олив|оливков|растител|уксус|кетчуп|майонез|горчиц|соус|приправ|специ|перец черн|перец молот|паприка молот|корица|ванил|разрыхл|дрожж|крахмал|желатин|=мед|=мёд|=варенье|джем|повидл|конфитюр|=паста томат|томатн паст|консерв|горошек|=фасоль|=горох|кукуруза конс|оливк|маслин|=огурцы мар|маринов|солен|тушенк|паштет|=чай|=чаи|=кофе|какао|цикори|хлопья|мюсли|гранол|=завтрак сух|сгущ|орех|семечк|семена|изюм|курага|чернослив|сухофрукт|бульон|=кубик|=лапша быстр|роллтон|доширак|heinz|хайнц|махеев|calve|кальве|nescafe|нескафе|jacobs|якобс|lavazza|tchibo|greenfield|гринфилд|lipton|липтон|ахмад|ahmad|=suhkur|=sool|=jahu|=õli|oliiviõli|äädikas|ketšup|majonees|sinep|=kaste|maitseaine|=pipar|kaneel|=mesi|=moos|~moos|konserv|oliivid|=kohv|~kohv|=tee|teepakid|kakao|helbed|müsli|pähkl|seemned|rosinad|=puljong|kuivatatud`,

  'food.cereal': `!=рис|!рис круг|рис длин|рис басм|рис жасм|гречк|гречн|овсян|=овес|геркулес|пшен|перлов|ячнев|манк|=манная|булгур|кускус|киноа|чечевиц|=нут|крупа|=круп|макарон|спагетти|=паста|=пасты|лапш|вермишел|рожки|перья|фузилли|пенне|=фарфалле|тальятелле|лазань|=равиоли|макфа|barilla|барилла|=шебекинск|=мистраль|=увелка|=riis|tatar|=tatra|kaerahelbed|kaera|=manna|=oder|odrakruup|tangud|=kruup|=pasta|=makaron|makaronid|spagetid|=nuudlid|=nuudel|=kuskuss|=bulgur|=kinoa|läätsed|kikerher`,

  'food.sweets': `шоколад|конфет|=конф|печенье|печенья|=торт|пирожн|вафл|=зефир|пастил|мармелад|халв|=ирис|карамел|леденц|леденец|=драже|мороже|пломбир|эскимо|=рожок|=батончик|нутелл|nutella|kinder|киндер|alpen gold|альпен|milka|милка|snickers|сникерс|twix|твикс|=mars|=марс|bounty|баунти|kitkat|kit kat|=m m|merci|мерси|raffaello|рафаэлло|ferrero|ферреро|ritter|риттер|коркунов|бабаевск|красный октябрь|рот фронт|=мишка|=аленка|=kalev|laima|šokolaad|=komm|kommid|~komm|küpsis|~küpsis|=kook|tort|vahvl|vahukomm|=marmelaad|=halvaa|=karamell|=jäätis|~jäätis|pulgajäätis|=kommi|=batoon|=dražee|=pastill`,

  'food.snacks': `чипс|сухарик|крекер|попкорн|=снек|снэк|=начос|=кириешки|кириешк|=lays|=lay s|=лейс|pringles|принглс|estrella|=читос|cheetos|=доритос|doritos|=три корочки|=фисташк|=арахис|=кешью|=миндаль|орешк|=бульбаш|=соломка|=крендел|=гренки|=гренк|=снеки|krõpsud|~krõps|krõps|=popkorn|=kreeker|~kreeker|=näks|maapähkl|=pistaatsia|=india pähkl|=mandlid|=juustupulk|=pulgad|=kartulikrõpsud`,

  'food.energy': `!энергет|!red bull|!=редбул|!ред булл|!monster|!=монстр|!adrenaline|!=адреналин|!adrenalin|!=burn|!=берн|!flash up|!флеш ап|!флэш ап|!=флеш|!drive me|!драйв ми|!=gorilla|!=горилла|!=e on|!=торнадо|!=tornado|!=battery|!=jaguar|!=ягуар|!=hell|!=блейз|!=blaze|!=nitro|!=lit energy|!=bucha|!=energy|!energiajook|!~energiajook|!=energiajoogid|!=rockstar`,

  'food.drinks': `=вода|=воды|вода мин|минерал|газиров|=сок|=соки|=нектар|морс|компот|лимонад|квас|=кола|кока кола|coca cola|=pepsi|=пепси|=fanta|=фанта|=sprite|=спрайт|schweppes|швепс|=добрый|=rich|=рич|=j7|=джей севен|фруктовый сад|=любимый|бонаква|bonaqua|святой источник|=aqua|=аква|nestea|=холодный чай|=чай холод|=айс ти|ice tea|=пиво|пив|=вино|вина|=шампан|игрист|=водка|=коньяк|=виски|=ром|=джин|=ликер|=сидр|напиток|смузи|=vesi|~vesi|mineraalvesi|=mahl|~mahl|=nektar|=limonaad|~limonaad|=kali|=kokakoola|=coca|=cola|=õlu|~õlu|=vein|~vein|=siider|=viin|=konjak|=viski|=jook|~jook|karastusjook|=smuuti|=jäätee`,

  'food.frozen': `замороз|заморож|=пельмен|пельмени|вареник|=хинкали|=манты|блинчики с|=наггетс|наггетс|=пицца замор|овощи замор|ягоды замор|смесь овощ|мексиканская смесь|=лед|=лёд|=фри|картофель фри|=пельмени|=сибирская коллекция|=мираторг замор|külmutatud|~külmutatud|sügavkülm|=pelmeenid|=pelmeen|=vareniki|=friikartul|=jää|=jääkuubikud`,

  'food.ready': `=салат|салат оливье|салат цезарь|винегрет|=шаурм|шаверм|=сэндвич|сендвич|=бутерброд|=ролл|=роллы|=суши|=пицца|=бургер|=хот дог|=котлет|котлеты по|=голубц|=плов|=суп|=борщ|солянк|окрошк|кулинари|=готов|=гарнир|=пюре карт|=запеканк|=лазанья готов|=блины|=сырники|=драники|=шашлык гот|=wrap|=ролл|=võileib|=salat|~salat|=pitsa|~pitsa|=burger|=sushi|=supp|~supp|=valmistoit|=kotlet|kotletid|=pelmeen valmis|=šašlõkk valmis|=praad|=wrap|=tortilla wrap|=hot dog|=hotdog`,

  'food.household': `!средство для|!=средство|=порошок|стираль|кондицион д|кондиционер для бель|=гель для стир|=капсулы для|для посуд|=таблетки для посудом|отбел|пятновывод|чистящ|моющ|=освежит|освежитель|губк|=салфетк влаж|=салфетки|бумажн полотен|=полотенца бум|туалетн бумаг|туал бум|=пакет|=пакеты|мешки для мус|мусор|=фольга|пищев плен|=перчатки|=тряпк|=свечи|=батарейк|=лампочк|=fairy|=фейри|persil|персил|=ariel|ариэль|=tide|=тайд|domestos|доместос|=vanish|ваниш|finish|финиш|calgon|калгон|=comet|комет|=ласка|=лоск|=losk|=миф|=frosch|=aos|=прил|=cillit|=mr proper|мистер пропер|=sorti|=sarma|=duru|=пемолюкс|=туалетный утенок|=белизна|=zewa|=папия|=familia|=kleenex|pesupulber|~pesupulber|pesugeel|~pesugeel|nõudepesu|~nõudepesu|puhastus|~puhastus|=wc|tualettpaber|~tualettpaber|majapidamispaber|~paber|prügikott|~kott|=kilekott|=käsn|=fooliu|=toidukile|=kindad|=patarei|=pirn led|=küünal|=õhuvärskendaja|=pleegitaja`,

  'food.cosmetics': `!шампун|!=бальзам для волос|бальзам-ополаск|ополаскив|!=зубн паст|зубная паст|=паста зубн|зубн щетк|=зубная нить|=мыло|=мыла|=гель для душа|гель д душ|=дезодорант|дезодор|антиперспир|=крем|=лосьон|=тоник|мицелляр|=маска для|=пенка|=скраб|=бритв|станок|=пена для брит|=прокладк|=тампон|=ватн|ватные|=диски ват|=палочки ват|=салфетки интим|=гигиен|=помад|=тушь|=лак для|=краска для волос|=nivea|нивея|=colgate|колгейт|=oral b|орал би|=blend a med|=gillette|жиллет|=venus|=dove|=дав|=rexona|рексона|=palmolive|палмолив|=head shoulders|хеден шолдерс|=pantene|пантин|=garnier|гарньер|=loreal|лореаль|=schauma|шаума|=чистая линия|=черный жемчуг|=always|олвейс|=naturella|натурелла|=kotex|котекс|=o b|=lacalut|=splat|сплат|=r o c s|=рокс|=old spice|=axe|=šampoon|~šampoon|=palsam|=seep|~seep|vedelseep|=dušigeel|~dušigeel|=hambapasta|~hambapasta|=hambahari|~hambahari|=deodorant|=kreem|näokreem|kätekreem|=raseerija|=žilett|=hügieen|=hügieenisidemed|~sidemed|=tampoonid|=vatipadjad|=vatitikud|=näopesu`,

  'food.kids': `!детск|!=для детей|!подгуз|!=памперс|!pampers|!huggies|!хаггис|!=merries|!меррис|!=libero|!либеро|!=трусики дет|!пюре дет|!=детское|!фрутоняня|!фруто няня|!=агуша|!=тема|!=бабушкино лукошко|!=hipp|!хипп|!=nutrilon|!нутрилон|!=nan|!=semper|!=gerber|!=heinz дет|!=смесь молоч|!=соска|!=пустышк|!=бутылочк|!=игрушк|!=ушастый нянь|!=bubchen|!=johnson s baby|!=mustela|!mähkmed|!~mähkmed|!=beebi|!~beebi|!=laste|!lastele|!=lapse|!=imiku|!~imiku|!=püree beebi|!=mänguasi|!~mänguasi|!=lutt`,

  'pets': `!=корм для|!корм д кош|!корм д соб|!=кошачий|!=для кошек|!=для собак|!=наполнитель|!=whiskas|!вискас|!=felix|!феликс|!=kitekat|!китекат|!=purina|!пурина|!=pedigree|!педигри|!=sheba|!шеба|!=royal canin|!=gourmet|!=friskies|!=chappi|!=kassitoit|!~kassitoit|!=koeratoit|!~koeratoit|!=kassiliiv|!=lemmiklooma`,

  'health': `!=аптек|!=таблетк|!=капсулы|!=витамин|!=ибупрофен|!=парацетамол|!=нурофен|!=пластырь|!=бинт|!=лекарств|!=сироп от|!=капли наз|!=спрей наз|!=термометр|!=маска мед|!=vitamiin|!=tabletid|!=plaaster|!=ravim`,

  'other': `!доставк|!накладн|!курьер|!услуг|!=сдэк|!=cdek|!=postitus|!=kohaletoimetus|!=tarne`,

  'cafe': `!=капучино|!=латте|!=американо|!=эспрессо|!=раф|!=флэт уайт|!=cappuccino|!=latte|!=americano|!=espresso`,
};

// Известные сети: как их распознавать и как показывать. hint — категория по умолчанию для чека.
export const STORES = [
  { re: /сдэк|cdek/i, name: 'СДЭК', hint: 'other' },
  { re: /пят[её]р|агроторг|pyaterochka/i, name: 'Пятёрочка' },
  { re: /магнит|тандер/i, name: 'Магнит' },
  { re: /перекр[её]ст/i, name: 'Перекрёсток' },
  { re: /\bлента\b/i, name: 'Лента' },
  { re: /вкусвилл|вкус\s*вилл|vkusvill/i, name: 'ВкусВилл' },
  { re: /ашан|auchan/i, name: 'Ашан' },
  { re: /дикси/i, name: 'Дикси' },
  { re: /\bспар\b|\bspar\b/i, name: 'SPAR' },
  { re: /fix\s*price|фикс\s*прайс|бэст\s*прайс/i, name: 'Fix Price' },
  { re: /светофор/i, name: 'Светофор' },
  { re: /азбука\s*вкуса/i, name: 'Азбука вкуса' },
  { re: /глобус/i, name: 'Глобус' },
  { re: /metro\b|метро\s*кэш/i, name: 'METRO' },
  { re: /окей|о['’]кей|o['’]key/i, name: 'О\'КЕЙ' },
  { re: /верный/i, name: 'Верный' },
  { re: /чижик/i, name: 'Чижик' },
  { re: /самокат/i, name: 'Самокат' },
  { re: /магнолия/i, name: 'Магнолия' },
  { re: /монетк/i, name: 'Монетка' },
  { re: /красное\s*&?\s*белое|красное\s*и\s*белое/i, name: 'Красное&Белое' },
  { re: /бристол/i, name: 'Бристоль' },
  { re: /у\s*палыча/i, name: 'У Палыча' },
  { re: /\bрив\s*гош|рив\s*гош/i, name: 'Рив Гош', hint: 'beauty' },
  { re: /золотое\s*яблоко/i, name: 'Золотое Яблоко', hint: 'beauty' },
  { re: /летуаль|л[’']этуаль/i, name: 'Л\'Этуаль', hint: 'beauty' },
  { re: /аптек|apteek|apotheka|benu|südameapteek|ригла|горздрав|36[.,]6/i, name: null, hint: 'health' },
  { re: /\brimi\b/i, name: 'Rimi' },
  { re: /selver/i, name: 'Selver' },
  { re: /prisma/i, name: 'Prisma' },
  { re: /maxima/i, name: 'Maxima' },
  { re: /\bcoop\b|konsum/i, name: 'Coop' },
  { re: /\blidl\b/i, name: 'Lidl' },
  { re: /grossi/i, name: 'Grossi' },
  { re: /stockmann/i, name: 'Stockmann' },
  { re: /kaubamaja/i, name: 'Kaubamaja' },
  { re: /\bmeie\s*toidukauplus/i, name: 'Meie' },
  { re: /circle\s*k/i, name: 'Circle K', hint: 'transport' },
  { re: /neste/i, name: 'Neste', hint: 'transport' },
  { re: /alexela/i, name: 'Alexela', hint: 'transport' },
  { re: /лукойл|lukoil/i, name: 'Лукойл', hint: 'transport' },
  { re: /роснефть/i, name: 'Роснефть', hint: 'transport' },
  { re: /газпромнефт/i, name: 'Газпромнефть', hint: 'transport' },
  { re: /макдон|вкусно\s*[-—–]?\s*и\s*точка|mcdonald/i, name: null, hint: 'cafe' },
  { re: /kfc|rostic|бургер\s*кинг|burger\s*king|старбакс|starbucks|шоколадниц|кофе\s*хауз|cofix|додо|dodo|теремок|якитория|тануки|hesburger|caffeine|reval\s*caf|coffee\s*people/i, name: null, hint: 'cafe' },
];
