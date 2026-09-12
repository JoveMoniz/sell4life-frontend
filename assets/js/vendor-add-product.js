// ======================================================
// ADD PRODUCT
// ======================================================

const form              = document.getElementById('add-product-form');
const categorySelect    = document.getElementById('product-category');
const subcategorySelect = document.getElementById('product-subcategory');

// ── Cloudinary config ──────────────────────────────
const CLD_CLOUD  = 'djpkj0s7w';
const CLD_PRESET = 'lhhkniqv';

// Tracks the final Cloudinary URL per slot (null = empty)
const uploadedUrls   = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null, 10: null, 11: null, 12: null, 13: null, 14: null, 15: null, 16: null, 17: null, 18: null, 19: null, 20: null };
// Tracks slots currently mid-upload
const pendingUploads = new Set();
// Slot currently being dragged for reordering (null when not dragging)
let _dragSrcSlot = null;

// ======================================================
// SUBCATEGORY MAP  (16 categories, 300+ subcategories)
// ======================================================

const subcategoriesMap = {
  fashion: [
    "Women's Dresses","Women's Tops & T-Shirts","Women's Trousers & Skirts",
    "Women's Coats & Jackets","Women's Knitwear & Cardigans","Women's Swimwear",
    "Women's Lingerie & Nightwear","Women's Activewear","Women's Plus Size",
    "Men's T-Shirts & Tops","Men's Shirts","Men's Trousers & Chinos",
    "Men's Suits & Blazers","Men's Hoodies & Sweatshirts","Men's Activewear",
    "Men's Underwear & Socks","Men's Coats & Jackets",
    "Girls Clothing (3-13)","Boys Clothing (3-13)","Baby & Infant Clothing (0-2)",
    "School Uniform",
    "Trainers & Sneakers","Boots","Heels & Wedges","Sandals & Flip Flops",
    "Formal & Smart Shoes","Sports Shoes","Slippers",
    "Bags & Handbags","Backpacks","Hats & Caps","Scarves & Wraps",
    "Belts","Sunglasses","Jewellery","Watches","Gloves & Mittens",
  ],
  electronics: [
    "Smartphones","Mobile Phone Cases & Covers","Mobile Chargers & Cables",
    "Screen Protectors","Power Banks","Tablets & E-Readers","Tablet Accessories",
    "Laptops","Desktop Computers","Computer Monitors","PC Components (CPU, GPU, RAM)",
    "Storage (SSDs, HDDs, USB Drives)","Keyboards & Mice","Laptop Bags & Sleeves",
    "Laptop Stands & Accessories","Mobile Phone Stands & Holders",
    "Computer Accessories",
    "TVs","Projectors & Screens","Blu-ray & DVD Players","Remote Controls",
    "Headphones & Earphones","Speakers","Soundbars & Home Cinema","DAC & Amplifiers",
    "Gaming Consoles","Video Games","Gaming Controllers","Gaming Headsets",
    "Gaming Chairs & Desks","PC Gaming Accessories",
    "Digital Cameras (DSLR / Mirrorless)","Action Cameras","Camera Lenses",
    "Camera Bags & Accessories","Tripods & Stabilisers",
    "Smart Speakers & Displays","Smart Home Hubs","Smart Plugs & Switches",
    "Smart Security Cameras & Doorbells","Smart Lighting",
    "Smartwatches","Fitness Trackers","VR & AR Headsets",
    "Printers & Scanners","Ink & Toner Cartridges",
    "Routers & Networking","Range Extenders",
    "Microwaves","Coffee Machines","Kettles","Toasters","Air Fryers",
    "Cables & Adaptors","Batteries","Car Electronics",
  ],
  home: [
    "Sofas & Armchairs","Sofa Beds","Coffee Tables & Side Tables",
    "Dining Tables & Chairs","Beds & Bed Frames","Mattresses",
    "Wardrobes & Dressing Tables","Chest of Drawers","Bookcases & Shelving",
    "TV Units & Media Furniture","Office & Study Furniture","Kids Furniture",
    "Duvets & Duvets Sets","Pillows","Bed Sheets & Fitted Sheets",
    "Mattress Toppers & Protectors","Towels & Bathrobes","Weighted Blankets",
    "Pots & Pans","Kitchen Knives","Baking Trays & Tins",
    "Kitchen Utensils & Gadgets","Mixing Bowls & Measuring","Dinnerware & Plates",
    "Glasses & Mugs","Food Storage & Containers","Lunch Boxes",
    "Bathroom Accessories","Shower Curtains & Rails","Bath Mats",
    "Soap Dispensers & Toothbrush Holders","Mirrors","Towel Rails",
    "Garden Furniture & Parasols","Garden Sheds & Storage",
    "Plant Pots & Planters","Seeds, Bulbs & Compost",
    "Lawn Mowers & Garden Tools","BBQ Grills & Accessories",
    "Outdoor Heaters & Fire Pits","Hoses & Watering",
    "Ceiling Lights & Pendants","Floor & Table Lamps",
    "LED Strip Lights","Outdoor & Garden Lighting","Smart Lighting",
    "Wall Art & Prints","Clocks","Candles & Holders",
    "Cushions & Throws","Rugs","Curtains & Blinds","Vases & Ornaments",
    "Power Tools","Hand Tools","Ladders & Steps",
    "Paint, Brushes & Rollers","Wallpaper & Paste",
    "Screws, Fixings & Rawlplugs","Safety & Security (Locks, Alarms)",
    "Cleaning Products","Mops, Brushes & Cloths",
    "Laundry (Detergent, Pegs, Airers)","Storage Boxes & Baskets",
  ],
  books: [
    "Literary Fiction","Crime & Thriller","Science Fiction","Fantasy",
    "Romance","Horror & Gothic","Historical Fiction","Humour",
    "Short Stories & Poetry",
    "Biographies & Memoirs","History","Politics & Current Affairs",
    "True Crime","Science & Nature","Philosophy",
    "Psychology & Mental Health","Self-Help & Motivation",
    "Business & Entrepreneurship","Economics & Finance","Law",
    "Cookbooks & Food Writing","Travel Writing","Sport & Fitness Books",
    "Art, Architecture & Photography Books","Design & Fashion Books",
    "Parenting & Families","Religion & Spirituality",
    "Children's Picture Books (0-5)","Children's Fiction (6-9)",
    "Children's Fiction (9-12)","Young Adult (YA)",
    "Educational & Textbooks (School)","Academic & University",
    "Comics & Graphic Novels","Manga",
    "CDs & Music Albums","Vinyl Records",
    "DVDs & Blu-ray (Film)","DVDs & Blu-ray (TV Series)",
    "Magazines & Periodicals",
  ],
  toys: [
    "Baby Toys (0-12 months)","Toddler Toys (1-3 years)","Preschool Toys (3-5 years)",
    "Action Figures & Playsets","Superhero & Movie Figures",
    "Dolls & Dollhouses","Doll Accessories & Clothing",
    "LEGO Sets","Other Building & Construction",
    "Board Games","Card Games & Trading Cards","Puzzles",
    "Remote Control Cars & Trucks","Remote Control Aircraft & Drones",
    "Arts & Crafts Kits for Kids","Science & Discovery Kits",
    "Outdoor Play Equipment","Trampolines","Paddling Pools",
    "Scooters","Balance Bikes & Tricycles","Ride-On Cars",
    "Soft Toys & Stuffed Animals","Fidget & Sensory Toys",
    "Collectible Figures & Blind Boxes",
    "Role Play & Dress Up","Kitchen & Food Play",
    "Electronic & Interactive Toys","Coding & STEM Toys",
    "Sports Toys & Games","Pool & Beach Toys",
  ],
  health: [
    "Face Moisturisers & Creams","Cleansers, Toners & Micellar Water",
    "Serums & Face Oils","Face Masks & Exfoliators",
    "Sunscreen & SPF","Eye Cream & Treatments","Lip Care",
    "Foundation & Concealer","Powder, Bronzer & Blush",
    "Lipstick, Lip Gloss & Liner","Eyeshadow Palettes",
    "Eyeliner & Mascara","Eyebrow Products",
    "Makeup Setting Sprays & Primers","Makeup Brushes & Sponges",
    "Makeup Remover & Wipes",
    "Shampoo & Conditioner","Hair Treatments & Masks",
    "Hair Styling (Mousse, Gel, Wax, Spray)","Hair Oil & Serum",
    "Hair Colour & Bleach","Heated Styling Tools",
    "Hairbrushes & Combs","Hair Accessories",
    "Perfume (Women's)","Perfume (Men's)","Unisex & Niche Fragrances",
    "Body Sprays & Deodorants",
    "Shaving Razors & Blades","Shaving Foam & Gel",
    "Aftershave & Post-Shave","Electric Shavers & Trimmers",
    "Beard Care & Grooming","Men's Skincare",
    "Vitamins & Multivitamins","Protein Powder & Bars",
    "Pre-Workout & Sports Nutrition","Weight Management",
    "Omega 3, Collagen & Specialist Supplements",
    "Toothbrushes (Manual & Electric)","Toothpaste & Whitening",
    "Mouthwash & Floss","Dental Accessories",
    "Feminine Care","Sexual Health & Contraception",
    "First Aid Kits & Plasters","Pain Relief & Cold & Flu",
    "Blood Pressure Monitors & Health Monitors",
    "Mobility Aids & Supports (Knee, Back, Wrist)",
    "Aromatherapy & Essential Oils","Massage & Relaxation",
    "Bath & Shower Gels","Body Lotion & Creams","Soap & Hand Wash",
  ],
  sports: [
    "Dumbbells & Barbells","Weight Benches & Racks",
    "Resistance Bands & Tubes","Yoga Mats & Accessories",
    "Cardio Equipment (Treadmills, Bikes, Rowing)",
    "Pull-Up Bars & Suspension Trainers","Foam Rollers & Recovery",
    "Road Bikes","Mountain Bikes","Electric Bikes",
    "Cycling Helmets","Cycling Clothing","Cycling Accessories",
    "Running Shoes (Men's)","Running Shoes (Women's)",
    "Running Clothing & Tights","Running Accessories & Gadgets",
    "Swimming Costumes & Trunks","Swim Goggles & Caps",
    "Swimming Equipment & Pull Buoys",
    "Football Boots & Trainers","Footballs","Football Clothing",
    "Rugby","Cricket","Basketball","Netball",
    "Tennis Rackets & Strings","Badminton","Squash",
    "Golf Clubs","Golf Bags & Trolleys","Golf Clothing & Accessories",
    "Camping Tents","Sleeping Bags & Mats",
    "Hiking Boots & Trail Shoes","Hiking Clothing",
    "Rucksacks & Hydration Packs","Camping Cooking & Lanterns",
    "Surfing & Bodyboarding","Kayaking & Paddleboarding",
    "Water Ski & Wakeboard","Wetsuits",
    "Ski & Snowboard Equipment","Ski Clothing & Accessories",
    "Boxing Gloves & Bags","Martial Arts & MMA","Wrestling",
    "Fishing Rods","Fishing Reels & Lines","Fishing Tackle & Bait",
    "Hunting & Shooting Accessories",
    "Sports Nutrition & Recovery","Sports Protective Gear",
  ],
  automotive: [
    "Dash Cams","Sat Nav & GPS","Car Stereos & Head Units",
    "Car Speakers & Amplifiers","Parking Sensors & Cameras",
    "Car Seat Covers","Car Mats (Rubber & Carpet)",
    "Steering Wheel Covers","Phone Holders & Mounts",
    "Car Air Fresheners","Sunshades & Window Covers",
    "Car Cleaning & Valeting Kits","Car Wax & Polish",
    "Scratch Removers & Paint Protection",
    "Jump Starters & Battery Chargers","Car Inverters & Power Adapters",
    "Tyre Inflators & Gauges",
    "Engine Oil & Additives","Coolant & Antifreeze",
    "Brake Pads & Discs","Oil, Air & Fuel Filters",
    "Spark Plugs","Bulbs & LED Lighting","Wipers",
    "Tyres","Alloy Wheels","Wheel Trims & Hub Caps",
    "Car Body Trim & Accessories",
    "Car Tools & Garage Equipment","Jacks & Axle Stands",
    "Tow Ropes & Recovery Straps","Tow Bars",
    "Child Car Seats & Boosters",
    "Motorbike Helmets","Motorbike Clothing & Gloves",
    "Motorbike Parts","Motorbike Accessories",
    "Van Racking & Storage","Van Accessories",
  ],
  food: [
    "Fresh Fruit","Fresh Vegetables","Fresh Herbs",
    "Bread & Bakery","Cakes & Pastries",
    "Meat & Poultry","Fish & Seafood",
    "Dairy (Milk, Cheese, Butter, Yoghurt)","Eggs",
    "Tinned Vegetables & Beans","Tinned Fish & Meat","Tinned Soups",
    "Pasta, Noodles & Rice","Grains, Pulses & Lentils",
    "Breakfast Cereals & Granola","Porridge & Oats",
    "Sauces, Gravies & Marinades","Ketchup, Mustard & Mayo",
    "Spices, Herbs & Seasonings","Salt & Pepper",
    "Cooking Oils, Vinegar & Dressings",
    "Snacks, Crisps & Popcorn","Nuts & Dried Fruit",
    "Chocolate & Sweets","Biscuits & Cookies","Crackers",
    "Tea","Coffee & Hot Chocolate","Herbal & Fruit Infusions",
    "Soft Drinks & Juices","Energy Drinks","Water",
    "Beer & Cider","Wine","Spirits & Liqueurs","Non-Alcoholic Alternatives",
    "Organic & Natural Foods","Vegan & Plant-Based",
    "Gluten-Free","Diabetic & Low-Sugar",
    "World Foods (Asian, Caribbean, Middle Eastern, European)",
    "Baking (Flour, Sugar, Yeast, Chocolate Chips)",
    "Jam, Honey & Spreads","Pickles & Chutneys",
    "Baby Food & Formula",
  ],
  baby: [
    "Baby Bottles & Teats","Breast Pumps","Sterilisers & Warmers",
    "Bibs & Feeding Accessories","Weaning & High Chairs",
    "Baby Food & Formula","Snacks & Drinks for Toddlers",
    "Nappies (Disposable)","Reusable Nappies & Wraps",
    "Nappy Bags & Changing Mats","Baby Wipes",
    "Baby Clothing (0-6 months)","Baby Clothing (6-18 months)",
    "Baby Clothing (18m-2yr)","Toddler Clothing (2-5 years)",
    "Pram Suits & Snowsuits","Baby Footwear",
    "Pushchairs & Prams","Travel Systems","Buggy Boards",
    "Baby Car Seats (Group 0, 0+)","Toddler Car Seats (Group 1, 2, 3)",
    "Baby Monitors (Video & Audio)","Baby Alarms",
    "Cots & Cribs","Moses Baskets & Stands","Baby Bedding & Sleeping Bags",
    "Baby Baths & Changing Units",
    "Baby Skincare & Bath Products","Baby Toiletries",
    "Dummies & Teethers","Baby Carriers & Slings",
    "Baby Bouncers & Rockers","Baby Walkers & Activity Centres",
    "Baby Toys & Rattles",
    "Stair Gates & Baby Safety","Baby Monitors & Safety",
    "Kids Bedroom Furniture","Kids Bedding",
    "School Bags & Lunchboxes","Kids Stationery",
    "Children's Books (0-5)","Children's Books (5-12)",
  ],
  pets: [
    "Dog Dry Food","Dog Wet Food & Pouches","Dog Treats & Chews",
    "Dog Leads & Harnesses","Dog Collars & ID Tags",
    "Dog Beds & Crates","Dog Coats & Accessories",
    "Dog Toys","Dog Grooming (Brushes, Shampoo, Clippers)",
    "Dog Training & Behaviour","Dog Health & Dental",
    "Cat Dry Food","Cat Wet Food & Pouches","Cat Treats",
    "Cat Litter & Litter Trays","Cat Beds & Cat Trees",
    "Cat Toys","Cat Collars & Leads",
    "Cat Grooming","Cat Flaps & Doors","Cat Health",
    "Fish Tanks & Aquariums","Fish Food",
    "Aquarium Filters, Heaters & Pumps","Aquarium Decorations",
    "Bird Cages & Aviaries","Bird Food & Seed","Bird Treats & Accessories",
    "Rabbit & Guinea Pig Food","Small Animal Cages & Runs",
    "Small Animal Bedding & Accessories",
    "Reptile Vivariums & Enclosures","Reptile Heat & Lighting",
    "Reptile Food & Supplements",
    "Veterinary & Pet Health Products","Flea & Tick Treatment",
    "Pet Carriers & Travel Accessories",
  ],
  arts: [
    "Acrylic Paints & Sets","Oil Paints & Sets","Watercolour Paints",
    "Gouache & Inks","Spray Paints",
    "Paintbrushes & Palette Knives","Palette & Mixing Trays",
    "Canvas (Stretched & Boards)","Watercolour Paper","Sketchbooks",
    "Pencils, Charcoal & Pastels","Colouring Pencils & Pens",
    "Fine Liners & Technical Pens","Markers & Brush Pens",
    "Fabric & Felt","Yarn & Wool (Knitting & Crochet)",
    "Knitting Needles & Crochet Hooks",
    "Sewing Machines","Sewing Thread & Needles",
    "Fabric Scissors & Cutting Tools","Embroidery & Cross Stitch Kits",
    "Scrapbooking & Card Making","Washi Tape & Stickers",
    "Resin Art Supplies","Jewellery Making (Beads, Wire, Clasps)",
    "Clay & Air-Dry Clay","Sculpting Tools",
    "Printmaking & Lino Cutting",
    "Candle Making (Wax, Wicks, Moulds)","Soap Making",
    "Photography Equipment","Darkroom & Film Photography",
    "Acoustic Guitars","Electric Guitars & Basses",
    "Piano & Digital Keyboards","Drums & Electronic Drum Kits",
    "Ukulele","Violin & Strings","Wind & Brass Instruments",
    "Music Accessories (Strings, Picks, Stands)",
    "Sheet Music & Music Books",
    "Coin Collecting","Stamp Collecting",
    "Trading Cards & Collectibles (Pokémon, Football etc.)",
    "Model Making & Miniatures","Airfix & Scale Models",
    "3D Printing Supplies","Laser Cutting Materials",
    "Party & Event Supplies","Balloons & Decorations",
  ],
  office: [
    "Ballpoint & Rollerball Pens","Fountain Pens","Gel Pens",
    "Highlighters & Markers","Pencils & Mechanical Pencils",
    "Notebooks (Hardback)","Notebooks (Softback & Spiral)",
    "Planners & Diaries","Sticky Notes & Memo Pads",
    "Folders & Ring Binders","Document Wallets & Sleeves",
    "Filing Cabinets & Desktop Organisers",
    "Paper (A4, A3, Coloured)","Card & Envelopes",
    "Printer Labels & Stickers",
    "Ink Cartridges (Inkjet)","Toner Cartridges (Laser)",
    "Printers","Scanners","Shredders",
    "Laminators & Laminating Pouches","Binding Machines",
    "Office Chairs (Ergonomic)","Standing Desks",
    "Monitor Stands & Laptop Risers",
    "Whiteboards & Cork Boards","Notice Board Accessories",
    "Staplers, Punches & Tape Dispensers",
    "Scissors, Letter Openers & Rulers",
    "Calculators","Presentation Clickers & Pointers",
    "Desk Lamps","Cable Management",
  ],
  antiques: [
    "Antique Furniture (Victorian, Georgian, Edwardian)",
    "Mid-Century Modern Furniture",
    "Vintage Clothing & Accessories (Pre-1990)","Vintage Watches",
    "Vintage Cameras & Electronics",
    "Original Oil Paintings & Watercolours","Prints & Engravings",
    "Ceramics & Pottery (China, Porcelain, Stoneware)",
    "Glass & Crystal (Victorian, Art Deco, etc.)",
    "Silver & Silverplate","Pewter & Metalware",
    "Antique Clocks & Mantel Clocks","Pocket Watches",
    "Coins & Banknotes (UK)","Coins & Banknotes (World)",
    "Stamps (British)","Stamps (World & Thematic)",
    "First Edition & Antiquarian Books",
    "Postcards, Photographs & Ephemera",
    "Military Memorabilia & Medals","Uniforms & Badges",
    "Sports Memorabilia (Signed Shirts, Programmes)",
    "Vintage Toys & Games","Tin Toys & Dolls",
    "Vintage Jewellery","Art Nouveau & Art Deco",
    "Maps, Globes & Scientific Instruments",
    "Advertising & Breweriana","Pub & Barware",
    "Fossils, Minerals & Natural History",
  ],
  travel: [
    "Hard Shell Suitcases (Cabin)","Hard Shell Suitcases (Medium / Large)",
    "Soft Shell Suitcases","Wheeled Holdalls & Duffel Bags",
    "Backpacks (Travel & Hiking)","Day Packs & Daybags",
    "Laptop Bags & Briefcases","Handbags & Crossbody Bags",
    "Travel Pillows (Neck & Inflatable)","Eye Masks & Earplugs",
    "Luggage Locks, Straps & Tags","Packing Cubes & Compression Bags",
    "Travel Adapters & Multi-Plugs","Portable Power Banks",
    "Travel Wallets & Passport Holders","Money Belts & Pouches",
    "Toiletry Bags & Wash Bags","Mini Travel Bottles & Containers",
    "Travel Clothing (Packable Jackets, Scarves)",
    "Waterproof Bags & Dry Sacks",
    "Maps, Guidebooks & Travel Books","Travel Games & Entertainment",
  ],
  software: [
    "PC Software (Windows)","Mac Software (macOS)",
    "Antivirus & Internet Security","VPN Software",
    "Design & Creative (Adobe, Affinity etc.)","Video Editing Software",
    "Audio & Music Production Software","CAD & Engineering Software",
    "Business & Office Software","Accounting Software",
    "Educational Software & Learning Tools",
    "Gaming (PC / Digital Code)","Gaming DLC & In-Game Currency",
    "Amazon Gift Cards","iTunes & App Store Gift Cards",
    "Gaming Gift Cards (PlayStation, Xbox, Nintendo, Steam)",
    "Retail & Restaurant Gift Cards",
    "Other Digital Downloads & E-books",
  ],
  other: ["Miscellaneous"],
};

// ======================================================
// TAG SUGGESTIONS
// ======================================================

const TAG_SUGGESTIONS = {
  fashion: {
    _base: ['fashion', 'clothing', 'style', 'trendy', 'uk fashion', 'outfit', 'wardrobe'],
    "women's dresses": ['dress', 'womens dress', 'party dress', 'summer dress', 'maxi dress', 'midi dress', 'evening dress', 'floral dress', 'casual dress'],
    "women's tops & t-shirts": ['womens top', 'blouse', 'ladies top', 'tshirt', 'casual top', 'summer top', 'vest top', 'going out top'],
    "women's trousers & skirts": ['skirt', 'womens trousers', 'midi skirt', 'wide leg trousers', 'leggings', 'flared trousers'],
    "women's coats & jackets": ['womens coat', 'ladies jacket', 'winter coat', 'blazer', 'puffer jacket', 'trench coat'],
    "women's knitwear & cardigans": ['cardigan', 'jumper', 'knitwear', 'womens jumper', 'chunky knit', 'wool cardigan'],
    "women's swimwear": ['swimsuit', 'bikini', 'swimwear', 'beachwear', 'one piece swimsuit', 'holiday swimwear'],
    "women's lingerie & nightwear": ['lingerie', 'nightwear', 'pyjamas', 'bra set', 'nightdress', 'sleepwear'],
    "women's activewear": ['womens activewear', 'gym wear', 'yoga wear', 'leggings', 'sports bra', 'workout clothes'],
    "women's plus size": ['plus size', 'curve fashion', 'plus size dress', 'plus size clothing', 'size 18-26'],
    "men's t-shirts & tops": ['mens tshirt', 'mens top', 'graphic tee', 'polo shirt', 'casual tshirt', 'summer top'],
    "men's shirts": ['mens shirt', 'dress shirt', 'casual shirt', 'formal shirt', 'oxford shirt', 'linen shirt'],
    "men's trousers & chinos": ['chinos', 'mens trousers', 'slim fit trousers', 'cargo trousers', 'joggers', 'smart trousers'],
    "men's suits & blazers": ['suit', 'mens suit', 'blazer', 'formal wear', 'business suit', 'wedding suit'],
    "men's hoodies & sweatshirts": ['hoodie', 'sweatshirt', 'pullover', 'mens hoodie', 'zip hoodie', 'fleece'],
    "men's activewear": ['mens gym wear', 'activewear', 'shorts', 'compression wear', 'training top'],
    "men's underwear & socks": ['mens underwear', 'boxers', 'mens socks', 'briefs', 'trunks', 'sports socks'],
    "men's coats & jackets": ['mens coat', 'mens jacket', 'winter coat', 'bomber jacket', 'parka', 'mens outerwear'],
    'girls clothing (3-13)': ['girls clothes', 'girls dress', 'girls outfit', 'kids clothing', 'girls top'],
    'boys clothing (3-13)': ['boys clothes', 'boys outfit', 'kids clothing', 'boys top', 'boys joggers'],
    'baby & infant clothing (0-2)': ['baby clothes', 'infant clothing', 'babygrow', 'newborn outfit', 'baby romper'],
    'school uniform': ['school uniform', 'school trousers', 'school shirt', 'school jumper', 'school pinafore'],
    "trainers & sneakers": ['trainers', 'sneakers', 'sports shoes', 'casual shoes', 'white trainers', 'running shoes'],
    "boots": ['boots', 'ankle boots', 'chelsea boots', 'knee high boots', 'winter boots'],
    'heels & wedges': ['heels', 'wedges', 'high heels', 'court shoes', 'block heels', 'party shoes'],
    'sandals & flip flops': ['sandals', 'flip flops', 'summer sandals', 'beach shoes', 'slider sandals'],
    'formal & smart shoes': ['formal shoes', 'smart shoes', 'office shoes', 'brogues', 'oxford shoes'],
    'sports shoes': ['sports shoes', 'gym shoes', 'training shoes', 'cross trainers', 'athletic shoes'],
    'slippers': ['slippers', 'house slippers', 'slipper boots', 'memory foam slippers', 'mens slippers'],
    "bags & handbags": ['handbag', 'tote bag', 'shoulder bag', 'clutch bag', 'crossbody bag', 'leather bag'],
    'backpacks': ['backpack', 'rucksack', 'school bag', 'daypack', 'travel backpack'],
    "hats & caps": ['hat', 'cap', 'beanie', 'baseball cap', 'bucket hat', 'snapback'],
    'scarves & wraps': ['scarf', 'wrap', 'winter scarf', 'silk scarf', 'pashmina'],
    'belts': ['belt', 'leather belt', 'mens belt', 'womens belt', 'buckle belt'],
    "sunglasses": ['sunglasses', 'shades', 'uv400', 'fashion sunglasses', 'polarised sunglasses'],
    "jewellery": ['jewellery', 'necklace', 'earrings', 'bracelet', 'ring', 'gold jewellery', 'silver jewellery'],
    "watches": ['watch', 'wristwatch', 'mens watch', 'womens watch', 'luxury watch', 'dress watch'],
    'gloves & mittens': ['gloves', 'mittens', 'winter gloves', 'leather gloves', 'touchscreen gloves'],
  },
  electronics: {
    _base: ['electronics', 'gadget', 'tech', 'technology', 'uk electronics', 'gift for him'],
    'smartphones': ['smartphone', 'mobile phone', 'android phone', '5g phone', 'unlocked phone'],
    'mobile phone cases & covers': ['phone case', 'phone cover', 'protective case', 'iphone case', 'samsung case', 'mobile accessories'],
    'mobile chargers & cables': ['charger', 'usb cable', 'fast charger', 'usb c', 'wireless charger', 'charging cable'],
    'screen protectors': ['screen protector', 'tempered glass', 'phone screen protector', 'privacy screen', 'glass protector'],
    'power banks': ['power bank', 'portable charger', 'battery pack', 'usb power bank', 'travel charger'],
    'tablets & e-readers': ['tablet', 'ipad', 'android tablet', 'e-reader', 'kindle', 'reading tablet'],
    'tablet accessories': ['tablet case', 'tablet stand', 'tablet cover', 'tablet keyboard', 'ipad accessories'],
    'laptops': ['laptop', 'notebook', 'gaming laptop', 'business laptop', 'ultrabook', 'windows laptop'],
    'desktop computers': ['desktop pc', 'computer tower', 'gaming pc', 'office pc', 'all in one pc'],
    'computer monitors': ['monitor', 'pc monitor', 'gaming monitor', '4k monitor', 'curved monitor'],
    'pc components (cpu, gpu, ram)': ['graphics card', 'cpu', 'ram', 'gpu', 'pc parts', 'processor'],
    'storage (ssds, hdds, usb drives)': ['ssd', 'hard drive', 'usb stick', 'external hard drive', 'memory stick'],
    'keyboards & mice': ['keyboard', 'mouse', 'wireless keyboard', 'gaming mouse', 'mechanical keyboard'],
    'laptop stands & accessories': ['laptop stand', 'laptop riser', 'cooling pad', 'docking station', 'laptop hub', 'laptop holder'],
    'mobile phone stands & holders': ['phone stand', 'phone holder', 'phone mount', 'car phone holder', 'pop socket', 'phone grip'],
    'laptop bags & sleeves': ['laptop bag', 'laptop sleeve', 'laptop case', 'laptop backpack'],
    'computer accessories': ['pc accessories', 'webcam', 'usb hub', 'computer accessories', 'laptop accessories'],
    'tvs': ['tv', 'smart tv', '4k tv', 'oled tv', 'led tv', 'television', 'flat screen'],
    'projectors & screens': ['projector', 'mini projector', 'projector screen', 'home cinema projector', '4k projector'],
    'blu-ray & dvd players': ['blu-ray player', 'dvd player', 'disc player', 'portable dvd player'],
    'remote controls': ['remote control', 'universal remote', 'tv remote', 'replacement remote'],
    'headphones & earphones': ['headphones', 'earphones', 'wireless earbuds', 'bluetooth headphones', 'noise cancelling', 'over ear headphones', 'in ear'],
    'headphone & earphone cases & accessories': ['airpods case', 'earphone case', 'headphone case', 'earbuds case', 'protective case', 'silicone case', 'leather case', 'case cover'],
    'speakers': ['bluetooth speaker', 'portable speaker', 'wireless speaker', 'waterproof speaker', 'party speaker'],
    'soundbars & home cinema': ['soundbar', 'home cinema', 'tv soundbar', 'surround sound system'],
    'dac & amplifiers': ['dac', 'headphone amp', 'audio amplifier', 'hi-fi amplifier'],
    'gaming consoles': ['gaming console', 'playstation', 'xbox', 'nintendo switch', 'gaming'],
    'video games': ['video game', 'ps5 game', 'xbox game', 'nintendo switch game', 'new release game'],
    'gaming controllers': ['controller', 'ps5 controller', 'xbox controller', 'wireless controller', 'pc controller'],
    'gaming headsets': ['gaming headset', 'gaming headphones', 'ps5 headset', 'xbox headset', 'surround sound'],
    'gaming chairs & desks': ['gaming chair', 'gaming desk', 'racing chair', 'ergonomic gaming chair'],
    'pc gaming accessories': ['gaming accessories', 'mouse mat', 'rgb accessories', 'gaming setup'],
    'digital cameras (dslr / mirrorless)': ['camera', 'dslr', 'mirrorless camera', 'photography', 'digital camera', 'vlogging camera'],
    'action cameras': ['action camera', 'gopro', 'sports camera', 'waterproof camera', 'helmet camera'],
    'camera lenses': ['camera lens', 'dslr lens', 'zoom lens', 'wide angle lens', 'prime lens'],
    'camera bags & accessories': ['camera bag', 'camera case', 'camera strap', 'lens cleaning kit'],
    'tripods & stabilisers': ['tripod', 'camera tripod', 'phone tripod', 'gimbal stabiliser'],
    'smart speakers & displays': ['smart speaker', 'alexa', 'google home', 'voice assistant', 'smart home'],
    'smart home hubs': ['smart hub', 'smart home', 'home automation', 'zigbee hub'],
    'smart plugs & switches': ['smart plug', 'smart switch', 'wifi plug', 'smart socket'],
    'smart security cameras & doorbells': ['security camera', 'video doorbell', 'smart doorbell', 'cctv camera', 'ring doorbell'],
    'smart lighting': ['smart bulb', 'smart lighting', 'led smart light', 'colour changing bulb'],
    'smartwatches': ['smartwatch', 'fitness watch', 'smart band', 'activity tracker', 'apple watch alternative'],
    'fitness trackers': ['fitness tracker', 'activity tracker', 'step counter', 'fitness band'],
    'vr & ar headsets': ['vr headset', 'virtual reality', 'vr goggles', 'meta quest'],
    'printers & scanners': ['printer', 'scanner', 'all in one printer', 'wireless printer', 'home printer'],
    'ink & toner cartridges': ['ink cartridge', 'toner cartridge', 'printer ink', 'replacement ink'],
    'routers & networking': ['router', 'wifi router', 'mesh wifi', 'networking'],
    'range extenders': ['wifi extender', 'range extender', 'wifi booster', 'signal booster'],
    'microwaves': ['microwave', 'combi microwave', 'countertop microwave', 'compact microwave'],
    'coffee machines': ['coffee machine', 'espresso machine', 'pod coffee machine', 'bean to cup'],
    'kettles': ['kettle', 'electric kettle', 'rapid boil kettle', 'cordless kettle'],
    'toasters': ['toaster', '2 slice toaster', '4 slice toaster', 'retro toaster'],
    'air fryers': ['air fryer', 'digital air fryer', 'dual air fryer', 'family air fryer'],
    'cables & adaptors': ['cable', 'adaptor', 'usb cable', 'hdmi cable', 'adapter'],
    'batteries': ['batteries', 'rechargeable batteries', 'aa batteries', 'aaa batteries'],
    'car electronics': ['car electronics', 'car charger', 'car accessories', 'car audio'],
  },
  home: {
    _base: ['home', 'home decor', 'interior design', 'homeware', 'uk home', 'house'],
    'sofas & armchairs': ['sofa', 'couch', 'armchair', 'corner sofa', 'grey sofa', 'living room furniture'],
    'sofa beds': ['sofa bed', 'sleeper sofa', 'futon', 'pull out sofa', 'guest bed sofa'],
    'coffee tables & side tables': ['coffee table', 'side table', 'lamp table', 'nest of tables', 'living room table'],
    'dining tables & chairs': ['dining table', 'dining chairs', 'dining set', 'kitchen table', 'extending table'],
    'beds & bed frames': ['bed frame', 'double bed', 'king size bed', 'ottoman bed', 'wooden bed', 'upholstered bed'],
    'mattresses': ['mattress', 'memory foam mattress', 'pocket sprung', 'orthopaedic mattress', 'medium firm'],
    'wardrobes & dressing tables': ['wardrobe', 'dressing table', 'sliding door wardrobe', 'bedroom furniture'],
    'chest of drawers': ['chest of drawers', 'drawers', 'bedroom drawers', 'tallboy'],
    'bookcases & shelving': ['bookcase', 'shelving unit', 'book shelf', 'storage shelves', 'ladder shelf'],
    'tv units & media furniture': ['tv unit', 'tv stand', 'media unit', 'entertainment unit'],
    'office & study furniture': ['desk', 'office desk', 'study furniture', 'home office desk', 'computer desk'],
    'kids furniture': ['kids bed', 'childrens furniture', 'kids desk', 'bunk bed', 'toddler bed'],
    'duvets & duvets sets': ['duvet', 'bedding set', 'duvet cover', 'double duvet', 'king duvet', '10.5 tog'],
    'pillows': ['pillow', 'memory foam pillow', 'pillow pair', 'anti-allergy pillow', 'cooling pillow'],
    'bed sheets & fitted sheets': ['fitted sheet', 'bed sheets', 'flat sheet', 'egyptian cotton sheets', 'double bed sheet'],
    'mattress toppers & protectors': ['mattress topper', 'mattress protector', 'memory foam topper', 'waterproof protector'],
    'towels & bathrobes': ['towels', 'bath towel', 'bathrobe', 'towel set', 'egyptian cotton towel'],
    'weighted blankets': ['weighted blanket', 'sensory blanket', 'anxiety blanket', 'cooling weighted blanket'],
    'pots & pans': ['cookware', 'frying pan', 'saucepan', 'non stick pan', 'wok', 'casserole dish'],
    'kitchen knives': ['kitchen knife', 'chef knife', 'knife set', 'santoku knife', 'bread knife'],
    'baking trays & tins': ['baking tray', 'cake tin', 'baking tin', 'loaf tin', 'muffin tray'],
    'kitchen utensils & gadgets': ['kitchen utensils', 'kitchen gadgets', 'utensil set', 'kitchen tools'],
    'mixing bowls & measuring': ['mixing bowl', 'measuring jug', 'measuring cups', 'baking scales'],
    'dinnerware & plates': ['dinner set', 'plates', 'dinnerware', 'crockery set', 'dinner plates'],
    'glasses & mugs': ['mugs', 'drinking glasses', 'wine glasses', 'mug set', 'glassware'],
    'food storage & containers': ['food storage', 'storage containers', 'airtight containers', 'tupperware'],
    'lunch boxes': ['lunch box', 'bento box', 'lunch bag', 'kids lunch box', 'insulated lunch box'],
    'bathroom accessories': ['bathroom accessories', 'bathroom set', 'toilet brush', 'bathroom storage'],
    'shower curtains & rails': ['shower curtain', 'shower rail', 'shower curtain rings', 'curved shower rail'],
    'bath mats': ['bath mat', 'bathroom rug', 'memory foam bath mat', 'non slip bath mat'],
    'soap dispensers & toothbrush holders': ['soap dispenser', 'toothbrush holder', 'bathroom accessory set'],
    'mirrors': ['mirror', 'wall mirror', 'full length mirror', 'round mirror', 'bathroom mirror'],
    'towel rails': ['towel rail', 'heated towel rail', 'towel radiator', 'towel ring'],
    'garden furniture & parasols': ['garden furniture', 'garden table', 'garden chairs', 'patio set', 'parasol', 'outdoor furniture'],
    'garden sheds & storage': ['garden shed', 'storage shed', 'garden storage box', 'outdoor storage'],
    'plant pots & planters': ['plant pot', 'planter', 'garden pots', 'hanging planter', 'flower pot'],
    'seeds, bulbs & compost': ['seeds', 'bulbs', 'compost', 'vegetable seeds', 'flower seeds'],
    'lawn mowers & garden tools': ['lawn mower', 'garden tools', 'spade', 'fork', 'pruners', 'garden shed'],
    'bbq grills & accessories': ['bbq', 'barbecue', 'bbq grill', 'gas bbq', 'charcoal bbq'],
    'outdoor heaters & fire pits': ['fire pit', 'patio heater', 'outdoor heater', 'gas fire pit'],
    'hoses & watering': ['garden hose', 'hose reel', 'watering can', 'sprinkler'],
    'ceiling lights & pendants': ['ceiling light', 'pendant light', 'chandelier', 'led light', 'light fitting'],
    'floor & table lamps': ['floor lamp', 'table lamp', 'reading lamp', 'standing lamp'],
    'led strip lights': ['led strip lights', 'led lights', 'rgb led strip', 'smart led strip'],
    'outdoor & garden lighting': ['garden lighting', 'solar lights', 'outdoor lights', 'string lights'],
    'smart lighting': ['smart bulb', 'smart light', 'colour changing bulb', 'home lighting'],
    'wall art & prints': ['wall art', 'canvas print', 'framed print', 'poster', 'abstract art', 'wall decor'],
    'clocks': ['clock', 'wall clock', 'mantel clock', 'alarm clock'],
    'candles & holders': ['candle', 'scented candle', 'soy candle', 'candle holder', 'home fragrance', 'luxury candle'],
    'cushions & throws': ['cushion', 'scatter cushion', 'throw blanket', 'velvet cushion', 'sofa throw'],
    'rugs': ['rug', 'area rug', 'living room rug', 'bedroom rug', 'hall runner', 'washable rug'],
    'curtains & blinds': ['curtains', 'blackout curtains', 'eyelet curtains', 'roller blind', 'roman blind'],
    'vases & ornaments': ['vase', 'ornament', 'decorative vase', 'home ornament'],
    'power tools': ['power tool', 'drill', 'cordless drill', 'circular saw', 'power tool set'],
    'hand tools': ['hand tools', 'tool set', 'screwdriver set', 'hammer', 'spanner set'],
    'ladders & steps': ['ladder', 'step ladder', 'folding ladder', 'step stool'],
    'paint, brushes & rollers': ['paint', 'paint brush', 'paint roller', 'emulsion paint', 'wall paint'],
    'wallpaper & paste': ['wallpaper', 'wallpaper paste', 'feature wallpaper', 'peel and stick wallpaper'],
    'screws, fixings & rawlplugs': ['screws', 'fixings', 'rawlplugs', 'wall plugs', 'screw set'],
    'safety & security (locks, alarms)': ['door lock', 'alarm', 'home security', 'smoke alarm', 'padlock'],
    'cleaning products': ['cleaning', 'household cleaner', 'disinfectant', 'multi-surface cleaner', 'antibacterial'],
    'mops, brushes & cloths': ['mop', 'cleaning brush', 'microfibre cloth', 'mop bucket'],
    'laundry (detergent, pegs, airers)': ['laundry detergent', 'clothes airer', 'washing pegs', 'fabric softener'],
    'storage boxes & baskets': ['storage box', 'storage basket', 'plastic storage box', 'woven basket'],
  },
  books: {
    _base: ['book', 'reading', 'paperback', 'hardback', 'gift book', 'bestseller'],
    'literary fiction': ['fiction', 'novel', 'literary fiction', 'booker prize', 'contemporary fiction'],
    'crime & thriller': ['thriller', 'crime fiction', 'mystery', 'detective', 'suspense', 'murder mystery'],
    'science fiction': ['sci-fi', 'science fiction', 'space opera', 'dystopian', 'speculative fiction', 'cyberpunk'],
    'fantasy': ['fantasy', 'epic fantasy', 'magic', 'dragons', 'high fantasy', 'urban fantasy'],
    'romance': ['romance novel', 'love story', 'romantic fiction', 'contemporary romance'],
    'horror & gothic': ['horror', 'horror fiction', 'gothic fiction', 'scary book', 'supernatural horror'],
    'historical fiction': ['historical fiction', 'period drama book', 'war fiction', 'historical novel'],
    'humour': ['humour book', 'comedy book', 'funny book', 'satire'],
    'short stories & poetry': ['short stories', 'poetry book', 'poems', 'anthology'],
    'biographies & memoirs': ['biography', 'memoir', 'autobiography', 'life story', 'true story'],
    'history': ['history book', 'world history', 'military history', 'british history'],
    'politics & current affairs': ['politics book', 'current affairs', 'political book'],
    'true crime': ['true crime', 'true crime book', 'crime story', 'real life crime'],
    'science & nature': ['science book', 'nature book', 'popular science', 'physics book'],
    'philosophy': ['philosophy book', 'philosophy', 'stoicism book', 'ethics book'],
    'psychology & mental health': ['psychology book', 'mental health book', 'anxiety book', 'therapy book'],
    'self-help & motivation': ['self help', 'motivation', 'personal development', 'mindset', 'productivity', 'wellbeing'],
    'business & entrepreneurship': ['business book', 'entrepreneurship', 'leadership', 'management', 'startup'],
    'economics & finance': ['economics book', 'finance book', 'investing book', 'money book'],
    'law': ['law book', 'legal book', 'law textbook'],
    'cookbooks & food writing': ['cookbook', 'recipe book', 'cooking', 'baking book', 'food book'],
    'travel writing': ['travel writing', 'travel book', 'travel memoir', 'guidebook'],
    'sport & fitness books': ['sports book', 'fitness book', 'football book', 'training book'],
    'art, architecture & photography books': ['art book', 'photography book', 'architecture book', 'coffee table book'],
    'design & fashion books': ['design book', 'fashion book', 'interior design book'],
    'parenting & families': ['parenting book', 'baby book', 'family book', 'pregnancy book'],
    'religion & spirituality': ['religion book', 'spirituality book', 'bible', 'mindfulness book'],
    "children's picture books (0-5)": ['childrens book', 'picture book', 'toddler book', 'bedtime story', 'illustrated book'],
    "children's fiction (6-9)": ['childrens fiction', 'chapter book', 'kids novel', 'adventure story'],
    "children's fiction (9-12)": ['childrens fiction', 'middle grade book', 'kids novel', 'adventure book'],
    'young adult (ya)': ['ya fiction', 'teen book', 'young adult', 'coming of age', 'ya fantasy'],
    'educational & textbooks (school)': ['textbook', 'school book', 'revision guide', 'gcse book'],
    'academic & university': ['academic book', 'university textbook', 'course book'],
    'comics & graphic novels': ['comic book', 'graphic novel', 'comics', 'superhero comic'],
    'manga': ['manga', 'manga volume', 'japanese comic', 'shonen manga'],
    'cds & music albums': ['cd', 'music album', 'cd album', 'music cd'],
    'vinyl records': ['vinyl', 'vinyl record', 'lp record', 'record album'],
    'dvds & blu-ray (film)': ['dvd', 'blu-ray', 'film dvd', 'movie dvd'],
    'dvds & blu-ray (tv series)': ['tv series dvd', 'boxset', 'tv boxset', 'complete series'],
    'magazines & periodicals': ['magazine', 'subscription magazine', 'periodical'],
  },
  toys: {
    _base: ['toy', 'kids toy', 'children', 'play', 'gift for kids', 'educational toy'],
    'baby toys (0-12 months)': ['baby toy', 'sensory toy', 'rattle', 'activity mat', 'infant toy'],
    'toddler toys (1-3 years)': ['toddler toy', 'developmental toy', 'stacking toy', 'push along toy'],
    'preschool toys (3-5 years)': ['preschool toy', 'learning toy', 'shape sorter', 'educational toy'],
    'action figures & playsets': ['action figure', 'playset', 'superhero toy', 'collectible figure'],
    'superhero & movie figures': ['superhero figure', 'movie figure', 'action hero', 'marvel figure'],
    'dolls & dollhouses': ['doll', 'dollhouse', 'fashion doll', 'baby doll', 'barbie'],
    'doll accessories & clothing': ['doll clothes', 'doll accessories', 'doll furniture', 'doll shoes'],
    'lego sets': ['lego', 'building blocks', 'construction toy', 'stem toy', 'lego set'],
    'other building & construction': ['building blocks', 'construction toy', 'building set', 'brick set'],
    'board games': ['board game', 'family game', 'party game', 'strategy game', 'game night'],
    'card games & trading cards': ['card game', 'trading cards', 'pokemon cards', 'card game set'],
    'puzzles': ['jigsaw puzzle', 'puzzle', 'brain teaser', '1000 piece puzzle', 'kids puzzle'],
    'remote control cars & trucks': ['remote control car', 'rc car', 'toy car', 'radio controlled'],
    'remote control aircraft & drones': ['rc drone', 'toy drone', 'remote control plane', 'kids drone'],
    'arts & crafts kits for kids': ['arts and crafts', 'craft kit', 'creative toy', 'painting kit', 'kids craft'],
    'science & discovery kits': ['science kit', 'discovery kit', 'experiment kit', 'chemistry set'],
    'outdoor play equipment': ['outdoor toy', 'garden toy', 'swing set', 'slide', 'climbing frame'],
    'trampolines': ['trampoline', 'garden trampoline', 'kids trampoline', 'trampoline with net'],
    'paddling pools': ['paddling pool', 'kids pool', 'inflatable pool', 'garden pool'],
    'scooters': ['scooter', 'kids scooter', '3 wheel scooter', 'kick scooter', 'childrens scooter'],
    'balance bikes & tricycles': ['balance bike', 'tricycle', 'kids bike', 'first bike'],
    'ride-on cars': ['ride on car', 'kids electric car', 'ride on toy', 'battery car'],
    'soft toys & stuffed animals': ['soft toy', 'stuffed animal', 'teddy bear', 'plush toy', 'cuddly toy'],
    'fidget & sensory toys': ['fidget toy', 'sensory toy', 'fidget spinner', 'pop it'],
    'collectible figures & blind boxes': ['blind box', 'collectible figure', 'mystery box toy', 'mini figure'],
    'role play & dress up': ['dress up costume', 'role play toy', 'kids costume', 'pretend play'],
    'kitchen & food play': ['play kitchen', 'toy food', 'play food set', 'kids kitchen'],
    'electronic & interactive toys': ['interactive toy', 'electronic toy', 'talking toy', 'robot pet'],
    'coding & stem toys': ['stem toy', 'coding toy', 'robot toy', 'science kit', 'educational'],
    'sports toys & games': ['kids sports toy', 'garden games', 'outdoor game', 'toy sports set'],
    'pool & beach toys': ['beach toys', 'pool toys', 'sand toys', 'inflatable pool toy'],
  },
  health: {
    _base: ['health', 'beauty', 'skincare', 'wellness', 'personal care', 'self care'],
    'face moisturisers & creams': ['moisturiser', 'face cream', 'hydrating cream', 'anti-ageing', 'spf moisturiser', 'day cream'],
    'cleansers, toners & micellar water': ['cleanser', 'face wash', 'micellar water', 'toner', 'double cleanse'],
    'serums & face oils': ['serum', 'vitamin c serum', 'hyaluronic acid', 'face oil', 'retinol serum'],
    'face masks & exfoliators': ['face mask', 'sheet mask', 'exfoliator', 'clay mask', 'scrub'],
    'sunscreen & spf': ['sunscreen', 'spf', 'sun protection', 'factor 50', 'daily spf', 'sun cream'],
    'eye cream & treatments': ['eye cream', 'dark circle treatment', 'eye serum', 'anti-ageing eye cream'],
    'lip care': ['lip balm', 'lip care', 'chapstick', 'lip mask'],
    'foundation & concealer': ['foundation', 'concealer', 'full coverage', 'liquid foundation', 'bb cream'],
    'powder, bronzer & blush': ['bronzer', 'blush', 'setting powder', 'highlighter makeup'],
    'lipstick, lip gloss & liner': ['lipstick', 'lip gloss', 'lip liner', 'lip colour', 'nude lipstick'],
    'eyeshadow palettes': ['eyeshadow palette', 'eye makeup', 'neutral palette', 'smoky eye', 'glitter eyeshadow'],
    'eyeliner & mascara': ['mascara', 'eyeliner', 'volumising mascara', 'waterproof mascara', 'liquid eyeliner'],
    'eyebrow products': ['eyebrow pencil', 'brow gel', 'eyebrow powder', 'microblading pen'],
    'makeup setting sprays & primers': ['setting spray', 'makeup primer', 'face primer', 'fixing spray'],
    'makeup brushes & sponges': ['makeup brush', 'beauty blender', 'brush set', 'makeup sponge'],
    'makeup remover & wipes': ['makeup remover', 'makeup wipes', 'cleansing wipes', 'micellar wipes'],
    'shampoo & conditioner': ['shampoo', 'conditioner', 'hair care', 'anti-frizz', 'moisturising shampoo'],
    'hair treatments & masks': ['hair mask', 'hair treatment', 'deep conditioner', 'hair repair'],
    'hair styling (mousse, gel, wax, spray)': ['hair gel', 'hair wax', 'hairspray', 'hair mousse', 'styling product'],
    'hair oil & serum': ['hair oil', 'hair serum', 'argan oil', 'frizz control oil'],
    'hair colour & bleach': ['hair dye', 'hair colour', 'bleach kit', 'semi permanent colour'],
    'heated styling tools': ['hair straighteners', 'curling wand', 'hair dryer', 'heated brush'],
    'hairbrushes & combs': ['hair brush', 'comb', 'detangling brush', 'paddle brush'],
    'hair accessories': ['hair clips', 'scrunchies', 'hair bands', 'hair ties'],
    "perfume (women's)": ['perfume', 'womens fragrance', 'eau de parfum', 'floral perfume', 'gift set'],
    "perfume (men's)": ['mens perfume', 'aftershave', 'cologne', 'mens fragrance', 'eau de toilette'],
    'unisex & niche fragrances': ['unisex perfume', 'niche fragrance', 'designer fragrance'],
    'body sprays & deodorants': ['deodorant', 'body spray', 'antiperspirant', 'roll on deodorant'],
    'shaving razors & blades': ['razor', 'razor blades', 'disposable razor', 'safety razor'],
    'shaving foam & gel': ['shaving foam', 'shaving gel', 'shaving cream'],
    'aftershave & post-shave': ['aftershave', 'post shave balm', 'aftershave balm'],
    'electric shavers & trimmers': ['electric shaver', 'beard trimmer', 'hair clipper', 'trimmer', 'grooming kit'],
    'beard care & grooming': ['beard oil', 'beard balm', 'beard care', 'beard brush'],
    "men's skincare": ['mens skincare', 'mens moisturiser', 'mens face wash'],
    'vitamins & multivitamins': ['vitamins', 'multivitamins', 'supplements', 'health supplements', 'daily vitamins'],
    'protein powder & bars': ['protein powder', 'whey protein', 'protein bar', 'sports nutrition', 'gym supplement'],
    'pre-workout & sports nutrition': ['pre workout', 'sports nutrition', 'energy gel', 'bcaa'],
    'weight management': ['weight management', 'diet supplement', 'meal replacement', 'fat burner'],
    'omega 3, collagen & specialist supplements': ['omega 3', 'collagen', 'fish oil', 'specialist supplement'],
    'toothbrushes (manual & electric)': ['electric toothbrush', 'toothbrush', 'oral care', 'dental care', 'sonic toothbrush'],
    'toothpaste & whitening': ['toothpaste', 'teeth whitening', 'whitening strips', 'sensitive toothpaste'],
    'mouthwash & floss': ['mouthwash', 'dental floss', 'oral rinse'],
    'dental accessories': ['dental accessories', 'interdental brush', 'tongue scraper'],
    'feminine care': ['sanitary pads', 'tampons', 'menstrual cup', 'feminine hygiene'],
    'sexual health & contraception': ['condoms', 'lubricant', 'contraception', 'sexual wellness'],
    'first aid kits & plasters': ['first aid kit', 'plasters', 'bandages', 'antiseptic cream'],
    'pain relief & cold & flu': ['pain relief', 'paracetamol', 'cold and flu', 'headache tablets'],
    'blood pressure monitors & health monitors': ['blood pressure monitor', 'health monitor', 'thermometer', 'pulse oximeter'],
    'mobility aids & supports (knee, back, wrist)': ['knee support', 'back support', 'wrist brace', 'mobility aid'],
    'aromatherapy & essential oils': ['essential oil', 'aromatherapy', 'diffuser oil', 'lavender oil'],
    'massage & relaxation': ['massage gun', 'massager', 'relaxation', 'massage oil'],
    'bath & shower gels': ['shower gel', 'bath gel', 'body wash', 'bubble bath'],
    'body lotion & creams': ['body lotion', 'body cream', 'moisturising lotion', 'body butter'],
    'soap & hand wash': ['soap', 'hand wash', 'bar soap', 'liquid hand soap'],
  },
  sports: {
    _base: ['sports', 'fitness', 'exercise', 'gym', 'active lifestyle', 'workout'],
    'dumbbells & barbells': ['dumbbells', 'weights', 'barbell', 'free weights', 'strength training', 'home gym'],
    'weight benches & racks': ['weight bench', 'squat rack', 'power rack', 'bench press'],
    'resistance bands & tubes': ['resistance band', 'exercise band', 'booty band', 'workout band', 'glute band'],
    'yoga mats & accessories': ['yoga mat', 'yoga', 'pilates mat', 'exercise mat', 'non-slip yoga mat'],
    'cardio equipment (treadmills, bikes, rowing)': ['treadmill', 'exercise bike', 'rowing machine', 'cardio machine', 'home gym equipment'],
    'pull-up bars & suspension trainers': ['pull up bar', 'suspension trainer', 'trx', 'doorway pull up bar'],
    'foam rollers & recovery': ['foam roller', 'recovery roller', 'muscle roller', 'massage roller'],
    'road bikes': ['road bike', 'bicycle', 'cycling', 'road cycling', 'racing bike'],
    'mountain bikes': ['mountain bike', 'mtb', 'off road bike', 'hardtail bike', 'full suspension bike'],
    'electric bikes': ['electric bike', 'ebike', 'e-bike', 'electric mountain bike', 'folding electric bike'],
    'cycling helmets': ['cycling helmet', 'bike helmet', 'road helmet', 'mtb helmet'],
    'cycling clothing': ['cycling jersey', 'cycling shorts', 'bib shorts', 'cycling jacket', 'padded shorts'],
    'cycling accessories': ['bike lock', 'bike lights', 'bike pump', 'bike bell', 'panniers', 'bike rack', 'bike bag', 'top tube bag', 'frame bag', 'saddle bag', 'handlebar bag', 'bike tool bag', 'phone mount', 'phone holder', 'bottle cage', 'mudguards', 'bike computer', 'kickstand', 'puncture repair kit', 'multi tool', 'bike tool kit', 'bike basket'],
    "running shoes (men's)": ['mens running shoes', 'running trainers', 'road running', 'jogging shoes', 'trail shoes'],
    "running shoes (women's)": ['womens running shoes', 'running trainers', 'jogging shoes', 'ladies running shoes'],
    'running clothing & tights': ['running tights', 'compression leggings', 'running top', 'running jacket', 'activewear'],
    'running accessories & gadgets': ['running belt', 'gps watch', 'running armband', 'running gadget'],
    'swimming costumes & trunks': ['swimming costume', 'swimsuit', 'swim trunks', 'bikini', 'one piece swimsuit'],
    'swim goggles & caps': ['swimming goggles', 'swim cap', 'anti fog goggles', 'kids swim goggles'],
    'swimming equipment & pull buoys': ['pull buoy', 'swim fins', 'kickboard', 'swim training aid'],
    'football boots & trainers': ['football boots', 'astro trainers', 'firm ground boots', 'kids football boots'],
    'footballs': ['football', 'match ball', 'training ball', 'size 5 football', 'soccer ball'],
    'football clothing': ['football kit', 'football shirt', 'training top', 'football shorts'],
    'rugby': ['rugby ball', 'rugby boots', 'rugby shirt', 'rugby gear'],
    'cricket': ['cricket bat', 'cricket ball', 'cricket gloves', 'cricket pads'],
    'basketball': ['basketball', 'basketball hoop', 'basketball shoes', 'basketball jersey'],
    'netball': ['netball', 'netball hoop', 'netball bib'],
    'tennis rackets & strings': ['tennis racket', 'tennis', 'beginner racket', 'graphite racket'],
    'badminton': ['badminton racket', 'shuttlecock', 'badminton set'],
    'squash': ['squash racket', 'squash ball'],
    'golf clubs': ['golf clubs', 'driver', 'iron set', 'golf set', 'golf equipment'],
    'golf bags & trolleys': ['golf bag', 'golf trolley', 'golf cart bag', 'push trolley'],
    'golf clothing & accessories': ['golf clothing', 'golf gloves', 'golf shoes', 'golf accessories'],
    'camping tents': ['tent', 'camping tent', '2 man tent', '4 man tent', 'festival tent', 'outdoor camping'],
    'sleeping bags & mats': ['sleeping bag', 'camping mat', 'sleeping mat', '3 season sleeping bag'],
    'hiking boots & trail shoes': ['hiking boots', 'walking boots', 'trail shoes', 'waterproof boots'],
    'hiking clothing': ['hiking jacket', 'walking trousers', 'outdoor clothing', 'waterproof jacket'],
    'rucksacks & hydration packs': ['rucksack', 'hydration pack', 'hiking backpack', 'water bladder'],
    'camping cooking & lanterns': ['camping stove', 'camping lantern', 'camp cookware', 'gas stove'],
    'surfing & bodyboarding': ['surfboard', 'bodyboard', 'surf wax', 'surf leash'],
    'kayaking & paddleboarding': ['kayak', 'paddleboard', 'sup board', 'kayak paddle'],
    'water ski & wakeboard': ['wakeboard', 'water ski', 'tow rope'],
    'wetsuits': ['wetsuit', 'surf wetsuit', 'diving wetsuit', 'shortie wetsuit'],
    'ski & snowboard equipment': ['skis', 'snowboard', 'ski boots', 'snowboard boots'],
    'ski clothing & accessories': ['ski jacket', 'ski gloves', 'thermal base layer', 'ski goggles'],
    'boxing gloves & bags': ['boxing gloves', 'punch bag', 'boxing', 'mma gloves', 'martial arts'],
    'martial arts & mma': ['mma gloves', 'martial arts gi', 'karate uniform', 'sparring gear'],
    'wrestling': ['wrestling mat', 'wrestling shoes', 'wrestling gear'],
    'fishing rods': ['fishing rod', 'fishing', 'angling', 'carp rod', 'fishing tackle'],
    'fishing reels & lines': ['fishing reel', 'fishing line', 'spinning reel', 'fishing spool'],
    'fishing tackle & bait': ['fishing tackle', 'fishing bait', 'lures', 'fishing hooks'],
    'hunting & shooting accessories': ['hunting gear', 'shooting accessories', 'game bag', 'hunting knife'],
    'sports nutrition & recovery': ['sports nutrition', 'recovery drink', 'electrolytes', 'energy gel'],
    'sports protective gear': ['shin pads', 'protective gear', 'mouth guard', 'knee pads'],
  },
  automotive: {
    _base: ['car accessories', 'automotive', 'vehicle accessories', 'car parts', 'motoring'],
    'dash cams': ['dash cam', 'dashcam', 'car camera', 'driving recorder', 'dual dash cam', '4k dashcam'],
    'sat nav & gps': ['sat nav', 'gps', 'car navigation', 'satnav', 'truck sat nav'],
    'car stereos & head units': ['car stereo', 'head unit', 'car radio', 'android auto', 'apple carplay'],
    'car speakers & amplifiers': ['car speakers', 'car amplifier', 'car audio', 'door speakers'],
    'parking sensors & cameras': ['parking sensors', 'reversing camera', 'rear camera', 'parking camera'],
    'car seat covers': ['car seat cover', 'universal seat cover', 'leather seat cover', 'car interior'],
    'car mats (rubber & carpet)': ['car mats', 'rubber car mats', 'carpet mats', 'floor mats'],
    'steering wheel covers': ['steering wheel cover', 'leather steering cover'],
    'phone holders & mounts': ['phone holder', 'car phone mount', 'magnetic phone holder', 'dashboard mount'],
    'car air fresheners': ['car air freshener', 'car scent', 'vent clip air freshener'],
    'sunshades & window covers': ['car sunshade', 'window shade', 'windscreen cover', 'sun visor'],
    'car cleaning & valeting kits': ['car cleaning', 'car wash kit', 'valeting kit', 'microfibre cloth', 'car polish'],
    'car wax & polish': ['car wax', 'car polish', 'ceramic coating', 'ceramic wax'],
    'scratch removers & paint protection': ['scratch remover', 'paint protection film', 'touch up paint'],
    'jump starters & battery chargers': ['jump starter', 'portable jump starter', 'battery charger', 'car battery charger'],
    'car inverters & power adapters': ['car inverter', 'power inverter', '12v adapter'],
    'tyre inflators & gauges': ['tyre inflator', 'portable air compressor', 'tyre pump', 'digital tyre gauge'],
    'engine oil & additives': ['engine oil', 'motor oil', 'synthetic oil', 'oil additive', '5w30'],
    'coolant & antifreeze': ['coolant', 'antifreeze', 'radiator fluid'],
    'brake pads & discs': ['brake pads', 'brake discs', 'brake kit'],
    'oil, air & fuel filters': ['oil filter', 'air filter', 'fuel filter'],
    'spark plugs': ['spark plugs', 'ignition plugs'],
    'bulbs & led lighting': ['car bulbs', 'led headlight bulb', 'led car lights', 'h7 bulb'],
    'wipers': ['wiper blades', 'windscreen wipers', 'car wipers'],
    'tyres': ['car tyres', 'tyres', 'winter tyres', 'all season tyres'],
    'alloy wheels': ['alloy wheels', 'car alloys', 'wheel set'],
    'wheel trims & hub caps': ['wheel trims', 'hub caps', 'wheel covers'],
    'car body trim & accessories': ['car body trim', 'door trim', 'car styling accessories'],
    'car tools & garage equipment': ['car tools', 'garage tools', 'car toolkit', 'socket set'],
    'jacks & axle stands': ['car jack', 'axle stands', 'trolley jack'],
    'tow ropes & recovery straps': ['tow rope', 'recovery strap', 'winch strap'],
    'tow bars': ['tow bar', 'towbar', 'detachable towbar'],
    'child car seats & boosters': ['child car seat', 'booster seat', 'isofix car seat'],
    'motorbike helmets': ['motorcycle helmet', 'full face helmet', 'open face helmet', 'motorbike safety'],
    'motorbike clothing & gloves': ['motorbike jacket', 'motorbike gloves', 'motorcycle trousers'],
    'motorbike parts': ['motorbike parts', 'motorcycle parts', 'exhaust', 'brake lever'],
    'motorbike accessories': ['motorbike accessories', 'bike cover', 'panniers motorcycle'],
    'van racking & storage': ['van racking', 'van shelving', 'van storage'],
    'van accessories': ['van accessories', 'van mats', 'van seat covers'],
  },
  food: {
    _base: ['food', 'grocery', 'uk food', 'gourmet', 'foodie', 'artisan'],
    'fresh fruit': ['fresh fruit', 'seasonal fruit', 'fruit box'],
    'fresh vegetables': ['fresh vegetables', 'seasonal veg', 'vegetable box'],
    'fresh herbs': ['fresh herbs', 'herb plant', 'growing herbs'],
    'bread & bakery': ['bread', 'artisan bread', 'sourdough', 'bakery'],
    'cakes & pastries': ['cake', 'pastries', 'traybake', 'celebration cake'],
    'meat & poultry': ['meat', 'poultry', 'chicken', 'beef'],
    'fish & seafood': ['fish', 'seafood', 'salmon', 'prawns'],
    'dairy (milk, cheese, butter, yoghurt)': ['cheese', 'milk', 'yoghurt', 'butter'],
    'eggs': ['eggs', 'free range eggs', 'organic eggs'],
    'tinned vegetables & beans': ['tinned vegetables', 'tinned beans', 'baked beans'],
    'tinned fish & meat': ['tinned fish', 'tinned tuna', 'tinned meat'],
    'tinned soups': ['tinned soup', 'canned soup'],
    'pasta, noodles & rice': ['pasta', 'rice', 'noodles', 'basmati rice'],
    'grains, pulses & lentils': ['lentils', 'pulses', 'quinoa', 'grains'],
    'breakfast cereals & granola': ['cereal', 'granola', 'breakfast cereal', 'muesli'],
    'porridge & oats': ['porridge oats', 'oats', 'instant porridge'],
    'sauces, gravies & marinades': ['sauce', 'gravy', 'marinade', 'pasta sauce'],
    'ketchup, mustard & mayo': ['ketchup', 'mustard', 'mayonnaise', 'condiments'],
    'spices, herbs & seasonings': ['spices', 'herbs', 'seasoning', 'chilli', 'herb blend', 'rub'],
    'salt & pepper': ['salt', 'pepper', 'sea salt', 'peppercorns'],
    'cooking oils, vinegar & dressings': ['olive oil', 'cooking oil', 'vinegar', 'salad dressing'],
    'snacks, crisps & popcorn': ['snacks', 'crisps', 'popcorn', 'healthy snacks', 'sharing snacks'],
    'nuts & dried fruit': ['nuts', 'dried fruit', 'mixed nuts', 'raisins'],
    'chocolate & sweets': ['chocolate', 'sweets', 'confectionery', 'gift chocolate', 'luxury chocolate', 'candy'],
    'biscuits & cookies': ['biscuits', 'cookies', 'chocolate biscuits'],
    'crackers': ['crackers', 'crispbread', 'water crackers'],
    'tea': ['tea', 'herbal tea', 'green tea', 'english breakfast tea', 'loose leaf tea', 'tea bags'],
    'coffee & hot chocolate': ['coffee', 'ground coffee', 'instant coffee', 'specialty coffee', 'hot chocolate'],
    'herbal & fruit infusions': ['herbal tea', 'fruit tea', 'infusion tea'],
    'soft drinks & juices': ['soft drink', 'juice', 'fruit juice', 'fizzy drink'],
    'energy drinks': ['energy drink', 'sports drink'],
    'water': ['bottled water', 'sparkling water', 'still water'],
    'beer & cider': ['beer', 'cider', 'craft beer', 'ale'],
    'wine': ['wine', 'red wine', 'white wine', 'rose wine'],
    'spirits & liqueurs': ['spirits', 'liqueur', 'gin', 'whisky', 'vodka'],
    'non-alcoholic alternatives': ['non alcoholic', 'alcohol free', 'mocktail'],
    'organic & natural foods': ['organic', 'natural food', 'healthy food', 'organic groceries', 'wholefoods'],
    'vegan & plant-based': ['vegan', 'plant-based', 'dairy-free', 'vegan food', 'meat-free'],
    'gluten-free': ['gluten free', 'coeliac', 'wheat free', 'gluten free food'],
    'diabetic & low-sugar': ['low sugar', 'diabetic food', 'sugar free'],
    "world foods (asian, caribbean, middle eastern, european)": ['world food', 'asian food', 'caribbean food', 'international food', 'ethnic grocery'],
    'baking (flour, sugar, yeast, chocolate chips)': ['baking', 'flour', 'baking supplies', 'bread making', 'cake making'],
    'jam, honey & spreads': ['jam', 'honey', 'spread', 'marmalade'],
    'pickles & chutneys': ['pickle', 'chutney', 'relish'],
    'baby food & formula': ['baby food', 'infant formula', 'baby milk', 'weaning food'],
  },
  baby: {
    _base: ['baby', 'infant', 'newborn', 'toddler', 'baby gift', 'new baby'],
    'baby bottles & teats': ['baby bottle', 'feeding bottle', 'anti-colic bottle', 'breast feeding'],
    'breast pumps': ['breast pump', 'electric breast pump', 'manual breast pump'],
    'sterilisers & warmers': ['bottle steriliser', 'bottle warmer', 'steam steriliser'],
    'bibs & feeding accessories': ['baby bibs', 'feeding accessories', 'weaning bibs'],
    'weaning & high chairs': ['high chair', 'weaning', 'baby food', 'first foods', 'booster seat'],
    'baby food & formula': ['baby food', 'infant formula', 'baby milk', 'weaning food'],
    'snacks & drinks for toddlers': ['toddler snacks', 'baby snacks', 'toddler drinks'],
    "nappies (disposable)": ['nappies', 'disposable nappies', 'baby nappies', 'newborn nappies', 'nappy'],
    'reusable nappies & wraps': ['reusable nappy', 'cloth nappy', 'nappy wrap'],
    'nappy bags & changing mats': ['changing mat', 'nappy bag', 'changing bag'],
    'baby wipes': ['baby wipes', 'sensitive wipes', 'water wipes'],
    "baby clothing (0-6 months)": ['baby clothes', 'newborn clothing', 'baby outfit', 'babygrow', 'sleepsuit'],
    "baby clothing (6-18 months)": ['baby clothes', 'baby outfit', 'toddler clothing', 'baby vest', 'baby top'],
    'baby clothing (18m-2yr)': ['baby clothes', 'toddler clothing', 'baby outfit'],
    'toddler clothing (2-5 years)': ['toddler clothes', 'kids clothing', 'toddler outfit'],
    'pram suits & snowsuits': ['snowsuit', 'pram suit', 'baby snowsuit'],
    'baby footwear': ['baby shoes', 'first walker shoes', 'baby booties'],
    'pushchairs & prams': ['pushchair', 'pram', 'stroller', 'baby buggy', 'travel system', 'pram system'],
    'travel systems': ['travel system', 'pram travel system', '3 in 1 travel system'],
    'buggy boards': ['buggy board', 'stroller board'],
    'baby car seats (group 0, 0+)': ['baby car seat', 'infant car seat', 'group 0 seat', 'newborn car seat'],
    'toddler car seats (group 1, 2, 3)': ['toddler car seat', 'group 1 car seat', 'booster car seat'],
    'baby monitors (video & audio)': ['baby monitor', 'video baby monitor', 'wifi baby monitor', 'smart baby monitor'],
    'baby alarms': ['baby alarm', 'baby movement monitor'],
    'cots & cribs': ['cot', 'baby cot', 'crib', 'cotbed', 'co-sleeper', 'moses basket'],
    'moses baskets & stands': ['moses basket', 'moses basket stand'],
    'baby bedding & sleeping bags': ['baby sleeping bag', 'cot bedding', 'baby blanket'],
    'baby baths & changing units': ['baby bath', 'changing unit', 'baby bath tub'],
    'baby skincare & bath products': ['baby skincare', 'baby lotion', 'baby bath', 'gentle wash', 'organic baby'],
    'baby toiletries': ['baby toiletries', 'baby shampoo', 'baby lotion'],
    'dummies & teethers': ['dummy', 'teether', 'soother', 'pacifier'],
    'baby carriers & slings': ['baby carrier', 'baby sling', 'baby wrap'],
    'baby bouncers & rockers': ['baby bouncer', 'baby rocker', 'baby swing'],
    'baby walkers & activity centres': ['baby walker', 'activity centre', 'baby entertainer'],
    'baby toys & rattles': ['baby toy', 'rattle', 'sensory toy', 'teether', 'activity toy'],
    'stair gates & baby safety': ['stair gate', 'baby gate', 'safety gate'],
    'baby monitors & safety': ['baby monitor', 'baby safety', 'socket covers'],
    'kids bedroom furniture': ['kids bed', 'childrens furniture', 'kids desk', 'bunk bed', 'toddler bed'],
    'kids bedding': ['kids bedding', 'kids duvet cover', 'childrens bedding'],
    'school bags & lunchboxes': ['school bag', 'lunchbox', 'kids backpack'],
    'kids stationery': ['kids stationery', 'school stationery', 'pencil case'],
    "children's books (0-5)": ['childrens book', 'picture book', 'toddler book'],
    "children's books (5-12)": ['childrens book', 'kids novel', 'chapter book'],
  },
  pets: {
    _base: ['pet', 'pet supplies', 'pet care', 'animal', 'uk pets'],
    'dog dry food': ['dog food', 'dry dog food', 'kibble', 'grain free dog food', 'dog nutrition'],
    'dog wet food & pouches': ['dog wet food', 'dog pouches', 'wet dog food'],
    'dog treats & chews': ['dog treats', 'dog chews', 'dental chews', 'training treats'],
    'dog leads & harnesses': ['dog lead', 'dog harness', 'no pull harness', 'dog walking', 'retractable lead'],
    'dog collars & id tags': ['dog collar', 'id tag', 'personalised collar'],
    'dog beds & crates': ['dog bed', 'dog crate', 'pet bed', 'dog kennel', 'washable dog bed'],
    'dog coats & accessories': ['dog coat', 'dog jacket', 'dog accessories'],
    'dog toys': ['dog toy', 'chew toy', 'rope toy', 'interactive dog toy', 'squeaky toy'],
    'dog grooming (brushes, shampoo, clippers)': ['dog grooming', 'dog brush', 'dog shampoo', 'slicker brush', 'dog clippers'],
    'dog training & behaviour': ['dog training', 'training clicker', 'behaviour aid'],
    'dog health & dental': ['dog dental', 'dog health', 'dog supplements'],
    'cat dry food': ['cat food', 'dry cat food', 'cat kibble', 'indoor cat food', 'hairball cat food'],
    'cat wet food & pouches': ['cat wet food', 'cat pouches', 'wet cat food'],
    'cat treats': ['cat treats', 'cat snacks', 'dreamies'],
    'cat litter & litter trays': ['cat litter', 'clumping litter', 'litter tray', 'silica gel litter'],
    'cat beds & cat trees': ['cat tree', 'cat scratching post', 'cat furniture', 'indoor cat', 'cat tower', 'cat bed'],
    'cat toys': ['cat toy', 'cat wand', 'interactive cat toy', 'catnip toy', 'laser pointer'],
    'cat collars & leads': ['cat collar', 'cat lead', 'cat harness'],
    'cat grooming': ['cat grooming', 'cat brush', 'cat shampoo'],
    'cat flaps & doors': ['cat flap', 'cat door', 'microchip cat flap'],
    'cat health': ['cat health', 'cat supplements', 'hairball remedy'],
    'fish tanks & aquariums': ['fish tank', 'aquarium', 'nano tank'],
    'fish food': ['fish food', 'tropical fish food', 'goldfish food'],
    'aquarium filters, heaters & pumps': ['aquarium filter', 'aquarium heater', 'air pump'],
    'aquarium decorations': ['aquarium decoration', 'fish tank ornament', 'aquarium plants'],
    'bird cages & aviaries': ['bird cage', 'aviary', 'parrot cage'],
    'bird food & seed': ['bird food', 'wild bird seed', 'sunflower seeds', 'fat balls', 'bird feeder'],
    'bird treats & accessories': ['bird treats', 'bird toys', 'bird accessories'],
    'rabbit & guinea pig food': ['rabbit food', 'guinea pig food', 'hay'],
    'small animal cages & runs': ['rabbit hutch', 'guinea pig cage', 'small animal run'],
    'small animal bedding & accessories': ['small animal bedding', 'hamster bedding', 'sawdust'],
    'reptile vivariums & enclosures': ['vivarium', 'reptile tank', 'reptile enclosure'],
    'reptile heat & lighting': ['reptile heat lamp', 'uvb light', 'heat mat'],
    'reptile food & supplements': ['reptile food', 'live food', 'reptile supplements'],
    'veterinary & pet health products': ['pet health', 'vet products', 'pet supplements'],
    'flea & tick treatment': ['flea treatment', 'tick treatment', 'flea collar', 'frontline', 'pet health'],
    'pet carriers & travel accessories': ['pet carrier', 'cat carrier', 'dog travel accessories'],
  },
  arts: {
    _base: ['art', 'craft', 'creative', 'art supplies', 'handmade', 'diy'],
    'acrylic paints & sets': ['acrylic paint', 'painting set', 'artist paint', 'acrylic art', 'canvas painting'],
    'oil paints & sets': ['oil paint', 'oil painting', 'artist oil', 'fine art', 'oil painting set'],
    'watercolour paints': ['watercolour', 'watercolor', 'water colour painting', 'watercolour set'],
    'gouache & inks': ['gouache paint', 'ink', 'india ink', 'gouache set'],
    'spray paints': ['spray paint', 'aerosol paint', 'graffiti spray'],
    'paintbrushes & palette knives': ['paintbrush', 'palette knife', 'artist brush set'],
    'palette & mixing trays': ['palette', 'mixing tray', 'paint palette'],
    'canvas (stretched & boards)': ['canvas', 'stretched canvas', 'canvas board', 'painting surface', 'artist canvas'],
    'watercolour paper': ['watercolour paper', 'art paper', 'cold press paper'],
    'sketchbooks': ['sketchbook', 'drawing pad', 'art journal'],
    'pencils, charcoal & pastels': ['pencil', 'charcoal', 'pastel', 'drawing pencil', 'sketching'],
    'colouring pencils & pens': ['colouring pencils', 'colouring pens', 'adult colouring'],
    'fine liners & technical pens': ['fine liner', 'technical pen', 'drawing pen'],
    'markers & brush pens': ['markers', 'brush pens', 'copic markers', 'alcohol markers', 'art pens'],
    'fabric & felt': ['fabric', 'felt', 'cotton fabric', 'craft felt'],
    'yarn & wool (knitting & crochet)': ['yarn', 'wool', 'knitting yarn', 'crochet yarn', 'chunky wool'],
    'knitting needles & crochet hooks': ['knitting needles', 'crochet hook', 'knitting set'],
    'sewing machines': ['sewing machine', 'dressmaking', 'quilting', 'fabric sewing', 'beginner sewing machine'],
    'sewing thread & needles': ['sewing thread', 'needles', 'thread set'],
    'fabric scissors & cutting tools': ['fabric scissors', 'rotary cutter', 'cutting mat'],
    'embroidery & cross stitch kits': ['embroidery kit', 'cross stitch', 'needlework', 'embroidery hoop', 'sewing kit'],
    'scrapbooking & card making': ['scrapbooking', 'card making', 'craft paper'],
    'washi tape & stickers': ['washi tape', 'stickers', 'decorative tape'],
    'resin art supplies': ['resin art', 'epoxy resin', 'resin mould', 'uv resin', 'resin craft'],
    'jewellery making (beads, wire, clasps)': ['jewellery making', 'beading', 'craft beads', 'wire jewellery', 'diy jewellery'],
    'clay & air-dry clay': ['clay', 'air dry clay', 'polymer clay', 'sculpting clay', 'pottery'],
    'sculpting tools': ['sculpting tools', 'clay tools', 'pottery tools'],
    'printmaking & lino cutting': ['lino cutting', 'printmaking', 'lino print kit'],
    'candle making (wax, wicks, moulds)': ['candle making', 'soy wax', 'candle supplies', 'diy candle', 'candle wicks'],
    'soap making': ['soap making', 'soap base', 'soap mould'],
    'photography equipment': ['camera equipment', 'photography gear', 'lighting kit'],
    'darkroom & film photography': ['film camera', 'darkroom', '35mm film'],
    'acoustic guitars': ['guitar', 'acoustic guitar', 'beginner guitar', 'classical guitar', 'folk guitar'],
    'electric guitars & basses': ['electric guitar', 'bass guitar', 'guitar', 'rock guitar', 'fender style'],
    'piano & digital keyboards': ['keyboard', 'digital piano', 'piano', 'synthesizer', 'learning piano'],
    'drums & electronic drum kits': ['drum kit', 'electronic drums', 'practice pad'],
    'ukulele': ['ukulele', 'uke', 'soprano ukulele'],
    'violin & strings': ['violin', 'violin strings', 'cello'],
    'wind & brass instruments': ['trumpet', 'saxophone', 'flute', 'clarinet'],
    'music accessories (strings, picks, stands)': ['guitar strings', 'guitar picks', 'music stand'],
    'sheet music & music books': ['sheet music', 'music book', 'songbook'],
    'coin collecting': ['coin collecting', 'collectable coin', 'coin album'],
    'stamp collecting': ['stamp collecting', 'stamp album', 'collectable stamp'],
    'trading cards & collectibles (pokémon, football etc.)': ['trading cards', 'pokemon cards', 'football cards', 'collectibles'],
    'model making & miniatures': ['model kit', 'miniatures', 'model making'],
    'airfix & scale models': ['airfix', 'scale model', 'model kit'],
    '3d printing supplies': ['3d printer filament', '3d printing', 'pla filament'],
    'laser cutting materials': ['laser cutting', 'plywood sheet', 'acrylic sheet'],
    'party & event supplies': ['party supplies', 'party decorations', 'event supplies'],
    'balloons & decorations': ['balloons', 'party decorations', 'foil balloons'],
  },
  office: {
    _base: ['office', 'stationery', 'desk', 'workspace', 'school supplies', 'work from home'],
    'ballpoint & rollerball pens': ['pen', 'ballpoint pen', 'rollerball pen', 'writing pen', 'smooth pen'],
    'fountain pens': ['fountain pen', 'ink pen', 'calligraphy pen'],
    'gel pens': ['gel pen', 'gel ink pen', 'coloured gel pens'],
    'highlighters & markers': ['highlighter', 'marker pen', 'stabilo', 'fluorescent highlighter'],
    'pencils & mechanical pencils': ['pencil', 'mechanical pencil', 'hb pencil'],
    'notebooks (hardback)': ['notebook', 'hardback notebook', 'journal', 'writing book', 'a5 notebook'],
    'notebooks (softback & spiral)': ['notebook', 'spiral notebook', 'notepad', 'writing pad', 'a4 notebook'],
    'planners & diaries': ['planner', 'diary', '2026 planner', 'organiser', 'daily planner', 'weekly planner'],
    'sticky notes & memo pads': ['sticky notes', 'post it notes', 'memo pad', 'desk notes'],
    'folders & ring binders': ['ring binder', 'folder', 'lever arch file'],
    'document wallets & sleeves': ['document wallet', 'plastic sleeve', 'punched pockets'],
    'filing cabinets & desktop organisers': ['filing cabinet', 'desk organiser', 'desktop tidy'],
    'paper (a4, a3, coloured)': ['a4 paper', 'printer paper', 'coloured paper'],
    'card & envelopes': ['card stock', 'envelopes', 'craft card'],
    'printer labels & stickers': ['printer labels', 'address labels', 'sticker sheets'],
    'ink cartridges (inkjet)': ['ink cartridge', 'inkjet cartridge', 'replacement ink'],
    'toner cartridges (laser)': ['toner cartridge', 'laser toner'],
    'printers': ['printer', 'inkjet printer', 'laser printer', 'home printer', 'wireless printer'],
    'scanners': ['scanner', 'document scanner', 'photo scanner'],
    'shredders': ['paper shredder', 'cross cut shredder', 'office shredder'],
    'laminators & laminating pouches': ['laminator', 'laminating pouches', 'a4 laminator'],
    'binding machines': ['binding machine', 'comb binder'],
    'office chairs (ergonomic)': ['ergonomic chair', 'office chair', 'desk chair', 'lumbar support', 'computer chair'],
    'standing desks': ['standing desk', 'sit stand desk', 'adjustable desk', 'height adjustable desk'],
    'monitor stands & laptop risers': ['monitor stand', 'laptop stand', 'laptop riser', 'desk organiser', 'ergonomic stand'],
    'whiteboards & cork boards': ['whiteboard', 'dry erase board', 'corkboard', 'notice board', 'magnetic board'],
    'notice board accessories': ['notice board pins', 'push pins', 'noticeboard accessories'],
    'staplers, punches & tape dispensers': ['stapler', 'hole punch', 'tape dispenser'],
    'scissors, letter openers & rulers': ['scissors', 'letter opener', 'ruler'],
    'calculators': ['calculator', 'scientific calculator', 'desktop calculator'],
    'presentation clickers & pointers': ['presentation clicker', 'laser pointer', 'remote presenter'],
    'desk lamps': ['desk lamp', 'led desk lamp', 'study lamp', 'office lamp', 'eye care lamp'],
    'cable management': ['cable management', 'cable organiser', 'cable clips'],
  },
  antiques: {
    _base: ['antique', 'vintage', 'collectible', 'rare', 'retro', 'period piece', 'uk antiques'],
    'antique furniture (victorian, georgian, edwardian)': ['antique furniture', 'victorian furniture', 'georgian', 'edwardian', 'period furniture'],
    'mid-century modern furniture': ['mid century furniture', 'mid century modern', 'retro furniture'],
    'vintage clothing & accessories (pre-1990)': ['vintage clothing', 'retro fashion', 'vintage style', 'pre-owned', 'vintage dress'],
    'vintage watches': ['vintage watch', 'mechanical watch', 'antique watch', 'collectors watch', 'pocket watch'],
    'vintage cameras & electronics': ['vintage camera', 'retro electronics', 'film camera', 'antique radio'],
    'original oil paintings & watercolours': ['original painting', 'oil painting', 'original artwork', 'signed painting', 'fine art'],
    'prints & engravings': ['antique print', 'engraving', 'vintage print'],
    'ceramics & pottery (china, porcelain, stoneware)': ['ceramics', 'pottery', 'porcelain', 'china', 'antique china'],
    'glass & crystal (victorian, art deco, etc.)': ['antique glass', 'crystal glass', 'victorian glass'],
    'silver & silverplate': ['antique silver', 'silverplate', 'sterling silver'],
    'pewter & metalware': ['pewter', 'antique metalware', 'brass antique'],
    'antique clocks & mantel clocks': ['antique clock', 'mantel clock', 'carriage clock'],
    'pocket watches': ['pocket watch', 'antique pocket watch'],
    'coins & banknotes (uk)': ['coin', 'uk coin', 'numismatics', 'old coins', 'collectors coin', 'banknote'],
    'coins & banknotes (world)': ['world coins', 'foreign coins', 'world banknotes'],
    'stamps (british)': ['british stamps', 'stamp collection'],
    'stamps (world & thematic)': ['world stamps', 'thematic stamps'],
    'first edition & antiquarian books': ['first edition', 'rare book', 'antiquarian book', 'collectors book', 'signed book'],
    'postcards, photographs & ephemera': ['vintage postcard', 'old photograph', 'ephemera'],
    'military memorabilia & medals': ['military memorabilia', 'medal', 'ww2 memorabilia', 'military badge', 'army collectible'],
    'uniforms & badges': ['military uniform', 'badge', 'vintage badge'],
    'sports memorabilia (signed shirts, programmes)': ['sports memorabilia', 'signed shirt', 'football memorabilia', 'match programme'],
    'vintage toys & games': ['vintage toy', 'retro toy', 'vintage game'],
    'tin toys & dolls': ['tin toy', 'antique doll', 'vintage tin toy'],
    'vintage jewellery': ['vintage jewellery', 'antique jewellery', 'art deco jewellery', 'estate jewellery'],
    'art nouveau & art deco': ['art deco', 'art nouveau', 'art deco antique'],
    'maps, globes & scientific instruments': ['antique map', 'vintage globe', 'scientific instrument'],
    'advertising & breweriana': ['advertising sign', 'breweriana', 'vintage advertising'],
    'pub & barware': ['pub sign', 'barware', 'vintage bar accessories'],
    'fossils, minerals & natural history': ['fossil', 'mineral specimen', 'natural history'],
  },
  travel: {
    _base: ['travel', 'luggage', 'holiday', 'travel accessories', 'trip', 'travel gift'],
    'hard shell suitcases (cabin)': ['cabin suitcase', 'carry on luggage', 'hand luggage', 'cabin bag', '20 inch suitcase'],
    'hard shell suitcases (medium / large)': ['suitcase', 'large suitcase', 'hold luggage', 'holiday suitcase', '4 wheel suitcase'],
    'soft shell suitcases': ['soft suitcase', 'lightweight suitcase', 'fabric suitcase', 'expanding suitcase'],
    'wheeled holdalls & duffel bags': ['holdall', 'duffel bag', 'wheeled holdall', 'weekend bag'],
    'backpacks (travel & hiking)': ['travel backpack', 'hiking rucksack', 'backpack', 'carry on backpack', 'laptop backpack'],
    'day packs & daybags': ['day pack', 'daybag', 'small backpack'],
    'laptop bags & briefcases': ['laptop bag', 'briefcase', 'laptop case'],
    'handbags & crossbody bags': ['crossbody bag', 'travel handbag', 'sling bag'],
    'travel pillows (neck & inflatable)': ['travel pillow', 'neck pillow', 'inflatable pillow', 'flight pillow', 'memory foam travel pillow'],
    'eye masks & earplugs': ['sleep mask', 'eye mask', 'earplugs', 'flight eye mask'],
    'luggage locks, straps & tags': ['luggage lock', 'tsa lock', 'luggage strap', 'luggage tag', 'travel security'],
    'packing cubes & compression bags': ['packing cubes', 'compression bags', 'luggage organiser'],
    'travel adapters & multi-plugs': ['travel adapter', 'universal adapter', 'world plug', 'usb travel adapter'],
    'portable power banks': ['power bank', 'portable charger', 'travel power bank'],
    'travel wallets & passport holders': ['passport holder', 'travel wallet', 'rfid blocking', 'document holder', 'travel organiser'],
    'money belts & pouches': ['money belt', 'travel pouch', 'hidden money pouch'],
    'toiletry bags & wash bags': ['wash bag', 'toiletry bag', 'travel toiletry bag', 'mens wash bag', 'waterproof wash bag'],
    'mini travel bottles & containers': ['travel bottles', 'travel size containers', 'liquid travel bottles'],
    'travel clothing (packable jackets, scarves)': ['packable jacket', 'travel scarf', 'travel clothing'],
    'waterproof bags & dry sacks': ['dry bag', 'waterproof bag', 'dry sack'],
    'maps, guidebooks & travel books': ['travel guide', 'map', 'guidebook'],
    'travel games & entertainment': ['travel games', 'card games travel', 'travel entertainment'],
  },
  software: {
    _base: ['software', 'digital download', 'activation key', 'license key', 'instant delivery'],
    'pc software (windows)': ['windows software', 'pc software', 'windows key'],
    'mac software (macos)': ['mac software', 'macos software', 'apple software'],
    'antivirus & internet security': ['antivirus', 'internet security', 'cybersecurity', 'malware protection', 'online security'],
    'vpn software': ['vpn', 'virtual private network', 'privacy software', 'anonymous browsing'],
    'design & creative (adobe, affinity etc.)': ['design software', 'photo editing', 'video editing software', 'creative suite'],
    'video editing software': ['video editing software', 'video editor', 'premiere pro'],
    'audio & music production software': ['music production software', 'daw software', 'audio software'],
    'cad & engineering software': ['cad software', 'engineering software', 'autocad'],
    'business & office software': ['office software', 'microsoft office', 'word processor', 'spreadsheet', 'business tools'],
    'accounting software': ['accounting software', 'bookkeeping software', 'quickbooks'],
    'educational software & learning tools': ['learning software', 'educational software', 'elearning'],
    'gaming (pc / digital code)': ['pc game', 'digital game', 'steam key', 'game code', 'gaming download'],
    'gaming dlc & in-game currency': ['dlc code', 'in game currency', 'game credits'],
    'amazon gift cards': ['amazon gift card', 'amazon voucher', 'gift card', 'amazon code'],
    "itunes & app store gift cards": ['itunes gift card', 'app store gift card', 'apple gift card'],
    'gaming gift cards (playstation, xbox, nintendo, steam)': ['psn gift card', 'xbox gift card', 'nintendo eshop', 'steam wallet', 'gaming voucher'],
    'retail & restaurant gift cards': ['gift card', 'retail voucher', 'restaurant gift card'],
    'other digital downloads & e-books': ['ebook', 'digital download', 'e-book'],
  },
  other: {
    _base: ['miscellaneous', 'general', 'unique', 'gift idea', 'variety'],
    'miscellaneous': ['miscellaneous', 'other', 'misc item', 'unique find'],
  },
};

function getSuggestedTags(catValue, subcatText) {
  const catData = TAG_SUGGESTIONS[catValue];
  if (!catData) return [];
  const base = catData._base || [];
  if (subcatText) {
    const key = subcatText.toLowerCase();
    const subTags = catData[key] || [];
    const all = [...subTags, ...base.filter(t => !subTags.includes(t))];
    return all.slice(0, 20);
  }
  return base;
}

function getCurrentTagList() {
  const input = document.getElementById('product-tags');
  if (!input || !input.value.trim()) return [];
  return input.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

function renderTagChips(catValue, subcatText) {
  const container = document.getElementById('tag-suggestions');
  const chipsEl   = document.getElementById('tag-chips');
  if (!container || !chipsEl) return;
  const tags = getSuggestedTags(catValue, subcatText);
  if (!tags.length) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  chipsEl.innerHTML = '';
  const current = getCurrentTagList();
  tags.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ap-tag-chip' + (current.includes(tag.toLowerCase()) ? ' selected' : '');
    chip.textContent = tag;
    chip.addEventListener('click', () => {
      const input = document.getElementById('product-tags');
      if (!input) return;
      let list = getCurrentTagList();
      const idx = list.indexOf(tag.toLowerCase());
      if (idx >= 0) { list.splice(idx, 1); chip.classList.remove('selected'); }
      else          { list.push(tag);       chip.classList.add('selected'); }
      input.value = list.join(', ');
    });
    chipsEl.appendChild(chip);
  });
}

function bindTagSuggestions() {
  const catSel = document.getElementById('product-category');
  const subSel = document.getElementById('product-subcategory');
  catSel?.addEventListener('change', () => {
    renderTagChips(catSel.value, '');
  });
  subSel?.addEventListener('change', () => {
    const subcatText = subSel.options[subSel.selectedIndex]?.text || '';
    renderTagChips(catSel.value, subcatText);
  });
}

// ======================================================
// IMAGE UPLOADS (Cloudinary)
// ======================================================

async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`,
    { method: 'POST', body: fd }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Upload failed');
  }

  const data = await res.json();
  return data.secure_url;
}

async function handleFile(n, file) {
  if (!file.type.startsWith('image/')) {
    window.showToast?.('Please select an image file', 'error');
    return;
  }

  const zone    = document.querySelector(`.ap-upload-zone[data-slot="${n}"]`);
  const preview = document.getElementById(`preview-${n}`);
  const overlay = document.getElementById(`overlay-${n}`);

  // Instant local preview
  const blobUrl = URL.createObjectURL(file);
  preview.src = blobUrl;
  zone.classList.add('has-image');
  zone.draggable = true;
  overlay.style.display = 'flex';
  pendingUploads.add(n);

  try {
    const cdnUrl = await uploadToCloudinary(file);
    uploadedUrls[n] = cdnUrl;
    preview.src = cdnUrl;
    URL.revokeObjectURL(blobUrl);
    const cbEl = zone?.querySelector('.img-slot-check');
    if (cbEl) cbEl.style.display = '';
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    clearSlot(n);
    window.showToast?.('Image upload failed — try again', 'error');
  } finally {
    pendingUploads.delete(n);
    if (overlay) overlay.style.display = 'none';
  }
}

function clearSlot(n) {
  const zone    = document.querySelector(`.ap-upload-zone[data-slot="${n}"]`);
  const preview = document.getElementById(`preview-${n}`);
  const overlay = document.getElementById(`overlay-${n}`);
  const input   = document.getElementById(`img-input-${n}`);
  if (zone)    { zone.classList.remove('has-image'); zone.draggable = false; }
  if (preview) preview.src = '';
  if (overlay) overlay.style.display = 'none';
  if (input)   input.value = '';
  uploadedUrls[n] = null;
  const cb = zone?.querySelector('.img-slot-check');
  if (cb) { cb.checked = false; cb.style.display = 'none'; }
}

// Re-renders a slot's DOM (preview, has-image class, draggable, checkbox)
// purely from the current uploadedUrls[n] value — used after reordering.
function renderSlotImage(n) {
  const zone    = document.querySelector(`.ap-upload-zone[data-slot="${n}"]`);
  const preview = document.getElementById(`preview-${n}`);
  if (!zone || !preview) return;
  const url = uploadedUrls[n];
  const cb  = zone.querySelector('.img-slot-check');
  if (url) {
    preview.src = url;
    zone.classList.add('has-image');
    zone.draggable = true;
    if (cb) cb.style.display = '';
  } else {
    preview.src = '';
    zone.classList.remove('has-image');
    zone.draggable = false;
    if (cb) { cb.checked = false; cb.style.display = 'none'; }
  }
}

// Drag-and-drop reorder: dropping on a filled slot swaps the two images;
// dropping on an empty slot moves the image there and closes the gap left
// behind, shifting everything else up to stay contiguous.
// FLIP animation: slides each affected preview image from its old screen
// position to its new one, so reordering visibly "moves" rather than snaps.
function flipAnimateSlots(changedSlots, rectsBefore, urlBeforeBySlot) {
  changedSlots.forEach((n) => {
    const newUrl = uploadedUrls[n];
    if (!newUrl) return;
    const oldSlot = Object.keys(urlBeforeBySlot).find(k => urlBeforeBySlot[k] === newUrl);
    if (oldSlot == null || !rectsBefore[oldSlot]) return;

    const img = document.getElementById(`preview-${n}`);
    if (!img) return;
    const newRect = img.getBoundingClientRect();
    const dx = rectsBefore[oldSlot].left - newRect.left;
    const dy = rectsBefore[oldSlot].top  - newRect.top;
    if (!dx && !dy) return;

    img.style.transition = 'none';
    img.style.transform  = `translate(${dx}px, ${dy}px)`;
    img.style.zIndex     = '30';
    void img.offsetWidth; // force reflow so the start position is applied
    img.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
    img.style.transform  = 'translate(0, 0)';
    img.addEventListener('transitionend', function done() {
      img.style.transition = '';
      img.style.transform  = '';
      img.style.zIndex     = '';
      img.removeEventListener('transitionend', done);
    });
  });
}

function reorderImages(fromSlot, toSlot) {
  if (fromSlot === toSlot || !uploadedUrls[fromSlot]) return;

  const allSlots = Array.from({ length: 20 }, (_, i) => i + 1);

  // Snapshot positions + url-by-slot before any DOM/state changes
  const rectsBefore = {};
  allSlots.forEach((n) => {
    const img = document.getElementById(`preview-${n}`);
    if (img) rectsBefore[n] = img.getBoundingClientRect();
  });
  const urlBeforeBySlot = { ...uploadedUrls };

  let changedSlots;

  if (uploadedUrls[toSlot]) {
    const tmp = uploadedUrls[fromSlot];
    uploadedUrls[fromSlot] = uploadedUrls[toSlot];
    uploadedUrls[toSlot] = tmp;
    changedSlots = [fromSlot, toSlot];
  } else {
    const filledSlots = allSlots.filter(n => uploadedUrls[n]);
    const movingUrl    = uploadedUrls[fromSlot];
    const orderedUrls  = filledSlots.filter(n => n !== fromSlot).map(n => uploadedUrls[n]);
    const insertIndex  = filledSlots.filter(n => n !== fromSlot && n <= toSlot).length;
    orderedUrls.splice(insertIndex, 0, movingUrl);

    changedSlots = [];
    allSlots.forEach((n, i) => {
      const newVal = orderedUrls[i] || null;
      if (uploadedUrls[n] !== newVal) changedSlots.push(n);
      uploadedUrls[n] = newVal;
    });
  }

  changedSlots.forEach(n => renderSlotImage(n));
  requestAnimationFrame(() => flipAnimateSlots(changedSlots, rectsBefore, urlBeforeBySlot));
}

function bindSlot(n) {
  const zone  = document.querySelector(`.ap-upload-zone[data-slot="${n}"]`);
  const input = document.getElementById(`img-input-${n}`);
  const removeBtn = document.querySelector(`.ap-remove-btn[data-slot="${n}"]`);
  if (!zone || !input) return;

  if (!zone.querySelector('.img-slot-check')) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'img-slot-check';
    cb.dataset.slot = n;
    cb.style.cssText = 'position:absolute;top:5px;left:5px;z-index:15;width:16px;height:16px;cursor:pointer;accent-color:#14b8a6;display:' + (uploadedUrls[n] ? '' : 'none');
    cb.addEventListener('click', e => e.stopPropagation());
    zone.appendChild(cb);
  }

  // Tap/click → open file picker (skip if clicking remove button or slot already filled)
  zone.addEventListener('click', (e) => {
    if (e.target.closest('.ap-remove-btn')) return;
    if (uploadedUrls[n] || pendingUploads.has(n)) return;
    input.click();
  });

  // Drag-and-drop (external files, and internal reorder between slots)
  zone.draggable = !!uploadedUrls[n];

  zone.addEventListener('dragstart', (e) => {
    if (!uploadedUrls[n]) { e.preventDefault(); return; }
    _dragSrcSlot = n;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(n));
  });
  zone.addEventListener('dragend', () => { _dragSrcSlot = null; });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (_dragSrcSlot != null) {
      reorderImages(_dragSrcSlot, n);
      _dragSrcSlot = null;
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) handleFile(n, file);
  });

  // File selected from picker / camera
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(n, file);
    input.value = '';
  });

  // Remove
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSlot(n);
    });
  }
}

// ======================================================
// VIDEO UPLOADS (Cloudinary)
// ======================================================

async function uploadVideoToCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/video/upload`,
    { method: 'POST', body: fd }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Upload failed');
  }
  const data = await res.json();
  return data.secure_url;
}

function videoUrlId(n) {
  return n === 1 ? 'product-video-url' : `product-video-url${n}`;
}

async function handleVideoFile(n, file) {
  const urlId   = videoUrlId(n);
  const zone    = document.querySelector(`.ap-video-zone[data-video="${n}"]`);
  const preview = document.getElementById(`video-preview-${n}`);
  const overlay = document.getElementById(`video-overlay-${n}`);
  const urlInput = document.getElementById(urlId);
  if (!zone) return;

  const blobUrl = URL.createObjectURL(file);
  if (preview) preview.src = blobUrl;
  zone.classList.add('has-video');
  if (overlay) overlay.style.display = 'flex';

  try {
    const cdnUrl = await uploadVideoToCloudinary(file);
    if (urlInput) urlInput.value = cdnUrl;
    if (preview) { URL.revokeObjectURL(blobUrl); preview.src = cdnUrl; }
  } catch (err) {
    console.error('Video upload error:', err);
    clearVideoSlot(n);
    window.showToast?.('Video upload failed — try again', 'error');
  } finally {
    if (overlay) overlay.style.display = 'none';
  }
}

function clearVideoSlot(n) {
  const urlId   = videoUrlId(n);
  const zone    = document.querySelector(`.ap-video-zone[data-video="${n}"]`);
  const preview = document.getElementById(`video-preview-${n}`);
  const urlInput = document.getElementById(urlId);
  if (zone)    zone.classList.remove('has-video');
  if (preview) preview.src = '';
  if (urlInput) urlInput.value = '';
}

function bindVideoSlots() {
  [1, 2, 3, 4, 5].forEach((n) => {
    const zone      = document.querySelector(`.ap-video-zone[data-video="${n}"]`);
    const fileInput = document.getElementById(`video-file-${n}`);
    const removeBtn = zone?.querySelector('.ap-remove-btn');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', (e) => {
      if (e.target.closest('.ap-remove-btn')) return;
      if (zone.classList.contains('has-video')) return;
      fileInput.click();
    });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) handleVideoFile(n, file);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleVideoFile(n, file);
      fileInput.value = '';
    });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearVideoSlot(n);
    });
  });
}

function bindImageUploads() {
  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].forEach(bindSlot);

  // Inject "Select All" / "Clear Selected" buttons for image slots
  const uploadBtn = document.getElementById('ap-select-all-btn');
  const imgBtnRow = uploadBtn?.parentNode;
  if (imgBtnRow && !document.getElementById('img-sel-all-btn')) {
    const selAllBtn = document.createElement('button');
    selAllBtn.type = 'button';
    selAllBtn.id = 'img-sel-all-btn';
    selAllBtn.textContent = '☑ Select All';
    selAllBtn.style.cssText = 'font-size:0.82rem;padding:5px 12px;background:#f0f9f8;border:1px solid #0b6b6a;color:#0b6b6a;border-radius:6px;cursor:pointer;font-weight:600';
    const clearSelBtn = document.createElement('button');
    clearSelBtn.type = 'button';
    clearSelBtn.id = 'img-clear-sel-btn';
    clearSelBtn.textContent = '✕ Clear Selected';
    clearSelBtn.style.cssText = 'font-size:0.82rem;padding:5px 12px;background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;cursor:pointer;font-weight:600';
    selAllBtn.addEventListener('click', () => {
      const filledCbs = Array.from(document.querySelectorAll('.img-slot-check')).filter(c => c.style.display !== 'none');
      const allChecked = filledCbs.length > 0 && filledCbs.every(c => c.checked);
      filledCbs.forEach(c => c.checked = !allChecked);
    });
    clearSelBtn.addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('.img-slot-check:checked'));
      if (!checked.length) { window.showToast?.('No images selected', 'error'); return; }
      if (!confirm(`Clear ${checked.length} selected image(s)?`)) return;
      checked.forEach(cb => clearSlot(parseInt(cb.dataset.slot)));
    });
    imgBtnRow.appendChild(selAllBtn);
    imgBtnRow.appendChild(clearSelBtn);
  }

  const showMoreBtn   = document.getElementById('ap-show-more');
  const extraSlots    = document.getElementById('ap-extra-slots');
  if (showMoreBtn && extraSlots) {
    showMoreBtn.addEventListener('click', () => {
      const open = extraSlots.classList.toggle('open');
      showMoreBtn.textContent = open ? '− Hide extra photo slots' : '+ Show more photo slots';
    });
  }

  const multiInput   = document.getElementById('ap-multi-input');
  const selectAllBtn = document.getElementById('ap-select-all-btn');
  if (multiInput && selectAllBtn) {
    selectAllBtn.addEventListener('click', () => multiInput.click());
    multiInput.addEventListener('change', () => {
      const files = Array.from(multiInput.files);
      const emptySlots = Array.from({ length: 20 }, (_, i) => i + 1)
        .filter(n => !uploadedUrls[n] && !pendingUploads.has(n));
      const toFill = files.slice(0, emptySlots.length);
      if (toFill.some((_, i) => emptySlots[i] > 5) && extraSlots) {
        extraSlots.classList.add('open');
        if (showMoreBtn) showMoreBtn.textContent = '− Hide extra photo slots';
      }
      toFill.forEach((file, i) => handleFile(emptySlots[i], file));
      multiInput.value = '';
    });
  }
}

// ======================================================
// VARIANT BUILDER
// ======================================================

let _variantRowId = 0;
let _variantGlobalMode = 'color';

function getAttrNames() {
  return Array.from(document.querySelectorAll('#attr-names-wrap .attr-name-input'))
    .map(el => el.value.trim());
}

function addAttrInput(name, addColToRows) {
  const wrap = document.getElementById('attr-names-wrap');
  if (!wrap) return;
  const isFirst = wrap.querySelectorAll('.attr-name-input').length === 0;
  const idx = wrap.querySelectorAll('.attr-group').length;
  const div = document.createElement('div');
  div.className = 'attr-group';
  div.innerHTML = `<span class="attr-group-label">Attribute ${idx + 1}</span><div class="attr-group-row"><input type="text" class="vb-input attr-name-input" value="${name || ''}" placeholder="${isFirst ? 'e.g. Colour' : 'e.g. Model, Size'}" />${!isFirst ? '<button type="button" class="attr-remove-btn" title="Remove attribute">&times;</button>' : ''}</div>`;
  wrap.appendChild(div);
  div.querySelector('.attr-name-input').addEventListener('input', syncVariantHeaders);
  if (!isFirst) {
    div.querySelector('.attr-remove-btn').addEventListener('click', () => {
      const attrIdx = Array.from(wrap.querySelectorAll('.attr-group')).indexOf(div);
      document.querySelectorAll('#variant-rows tr').forEach(tr => {
        const cells = tr.querySelectorAll('.vb-dyn-attr-td');
        if (cells[attrIdx]) cells[attrIdx].remove();
      });
      div.remove();
      wrap.querySelectorAll('.attr-group').forEach((g, i) => {
        const lbl = g.querySelector('.attr-group-label');
        if (lbl) lbl.textContent = `Attribute ${i + 1}`;
      });
      syncVariantHeaders();
    });
  }
  if (addColToRows) {
    document.querySelectorAll('#variant-rows tr').forEach(tr => {
      const swatchTd = tr.querySelector('.vb-color-cell');
      if (!swatchTd) return;
      const td = document.createElement('td');
      td.className = 'vb-dyn-attr-td';
      td.innerHTML = '<input type="text" class="vb-input" name="vr-attr" placeholder="" />';
      tr.insertBefore(td, swatchTd);
    });
  }
  syncVariantHeaders();
}

function syncVariantHeaders() {
  const names = getAttrNames();
  const headerRow = document.getElementById('vb-header-row');
  if (!headerRow) return;
  headerRow.querySelectorAll('.vb-attr-th, .vb-check-th').forEach(th => th.remove());
  const swatchTh = headerRow.querySelector('.vb-swatch-th');
  names.forEach((name, i) => {
    const th = document.createElement('th');
    th.className = 'vb-attr-th';
    th.textContent = name || `Attribute ${i + 1}`;
    headerRow.insertBefore(th, swatchTh);
  });
  const checkTh = document.createElement('th');
  checkTh.className = 'vb-check-th';
  checkTh.style.cssText = 'width:28px;text-align:center;vertical-align:middle;padding:4px';
  checkTh.innerHTML = '<input type="checkbox" id="vr-check-all-hdr" title="Select / deselect all rows" style="width:15px;height:15px;cursor:pointer;accent-color:#14b8a6" />';
  headerRow.insertBefore(checkTh, headerRow.firstElementChild);
}

function setRowMode(tr, mode) {
  tr.dataset.mode = mode;
  tr.querySelectorAll('.vr-mode-btn').forEach(b => {
    const active = b.dataset.pick === mode;
    b.classList.toggle('vr-mode-active', active);
    b.style.background  = active ? (mode === 'image' ? '#6366f1' : '#14b8a6') : '';
    b.style.color       = active ? '#fff' : '';
    b.style.borderColor = active ? (mode === 'image' ? '#6366f1' : '#14b8a6') : '';
  });
}

function addVariantRow(data) {
  data = data || {};
  const tbody = document.getElementById('variant-rows');
  if (!tbody) return;
  const id = ++_variantRowId;
  const attrNames = getAttrNames();
  const attrVals = data.attrs || [data.attr1 || '', data.attr2 || '', data.attr3 || ''];
  const color = data.color || '#ffffff';
  const imgSrc = data.image || '';
  const rowMode = data.displayMode || _variantGlobalMode;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  const _ph = ['e.g. Black', 'e.g. Large', 'e.g. iPhone 15'];
  const attrCells = attrNames.map((_, i) =>
    `<td class="vb-dyn-attr-td"><input type="text" class="vb-input" name="vr-attr" value="${attrVals[i] || ''}" placeholder="${_ph[i] || 'e.g. value'}" /></td>`
  ).join('');
  tr.innerHTML = `
    <td class="vb-check-td" style="width:28px;text-align:center;vertical-align:middle;padding:4px">
      <input type="checkbox" class="vr-row-check" style="width:15px;height:15px;cursor:pointer;accent-color:#14b8a6" />
    </td>
    ${attrCells}
    <td class="vb-color-cell">
      <input type="color" class="vb-color-pick" name="vr-color" value="${color}" data-user-set="${data.color ? 'true' : 'false'}" title="Pick swatch colour" />
      <span class="vr-mode-sel"><button type="button" class="vr-mode-btn" data-pick="color" title="Show as colour swatch on product page">Clr</button><button type="button" class="vr-mode-btn" data-pick="image" title="Show as image thumbnail on product page">Img</button></span>
    </td>
    <td class="ao-img-cell">
      <div class="ao-img-wrap">
        <div class="vr-thumb-wrap${imgSrc ? ' has-img' : ''}">
          <img class="vr-img-preview" src="${imgSrc}" alt="" />
          <div class="vr-thumb-overlay">
            <button type="button" class="vr-img-clear">CLR</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <input type="text" class="vb-input ao-img-url vr-img-url" name="vr-image" value="${imgSrc}" placeholder="Paste URL or upload…" style="flex:1;min-width:0" />
        </div>
      </div>
    </td>
    <td><input type="number" class="vb-input vb-input-sm" name="vr-price" step="0.01" min="0" value="${data.price != null ? data.price : ''}" placeholder="0.00" /></td>
    <td><input type="number" class="vb-input vb-input-sm" name="vr-stock" min="0" value="${data.stock != null ? data.stock : ''}" placeholder="0" /></td>
    <td><input type="text" class="vb-input" name="vr-sku" value="${data.sku || ''}" placeholder="SKU-001" /></td>
    <td><button type="button" class="vb-remove-btn" data-row="${id}">✕</button></td>
  `;
  tbody.appendChild(tr);
  setRowMode(tr, rowMode);

  // Wire per-row upload button
  const uploadBtn   = tr.querySelector('.vr-upload-btn');
  const uploadInput = tr.querySelector('.vr-upload-input');
  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', async () => {
      const file = uploadInput.files[0];
      if (!file) return;
      uploadBtn.textContent = '⏳';
      uploadBtn.disabled = true;
      try {
        const url = await uploadToCloudinary(file);
        const urlInput = tr.querySelector('[name="vr-image"]');
        const img      = tr.querySelector('.vr-img-preview');
        const wrap     = tr.querySelector('.vr-thumb-wrap');
        if (urlInput) urlInput.value = url;
        if (img)      img.src = url;
        if (wrap)     wrap.classList.add('has-img');
        sampleDominantColor(url, (hex) => {
          const picker = tr.querySelector('[name="vr-color"]');
          if (picker) { picker.value = hex; picker.dataset.userSet = 'true'; }
          // Propagate image + colour to other rows sharing the same first attribute value
          const firstAttrVal = tr.querySelector('[name="vr-attr"]')?.value.trim();
          if (firstAttrVal) {
            document.getElementById('variant-rows')?.querySelectorAll('tr').forEach(row => {
              if (row === tr) return;
              if (row.querySelector('[name="vr-attr"]')?.value.trim() !== firstAttrVal) return;
              const ri = row.querySelector('[name="vr-image"]');
              if (ri && !ri.value) {
                ri.value = url;
                const rImg = row.querySelector('.vr-img-preview');
                const rWrap = row.querySelector('.vr-thumb-wrap');
                const rPick = row.querySelector('[name="vr-color"]');
                if (rImg) rImg.src = url;
                if (rWrap) rWrap.classList.add('has-img');
                if (rPick) { rPick.value = hex; rPick.dataset.userSet = 'true'; }
              }
            });
          }
        });
      } catch { window.showToast?.('Image upload failed', 'error'); }
      uploadBtn.textContent = '📷';
      uploadBtn.disabled = false;
      uploadInput.value = '';
    });
  }

  // Auto-sample dominant colour from image when no colour is stored yet
  if (imgSrc && !data.color) {
    sampleDominantColor(imgSrc, (hex) => {
      const picker = tr.querySelector('[name="vr-color"]');
      if (picker) { picker.value = hex; picker.dataset.userSet = 'true'; }
    });
  }
}

function getVariants() {
  if (!document.getElementById('has-variants')?.checked) return [];
  const attrNames = getAttrNames();
  const variants = [];
  document.querySelectorAll('#variant-rows tr').forEach((tr) => {
    const attrInputs = Array.from(tr.querySelectorAll('[name="vr-attr"]'));
    const a1 = attrInputs[0]?.value.trim();
    if (!a1) return;
    const priceRaw = parseFloat(tr.querySelector('[name="vr-price"]')?.value);
    const stockRaw = parseInt(tr.querySelector('[name="vr-stock"]')?.value, 10);
    const sku = tr.querySelector('[name="vr-sku"]')?.value.trim();
    const color = tr.querySelector('[name="vr-color"]')?.value || '';
    const image = tr.querySelector('[name="vr-image"]')?.value.trim() || '';
    const displayMode = tr.dataset.mode || 'color';
    const attributes = {};
    attrNames.forEach((name, i) => {
      if (name) attributes[name] = attrInputs[i]?.value.trim() || '';
    });
    variants.push({
      attributes,
      price: isNaN(priceRaw) ? undefined : priceRaw,
      stock: isNaN(stockRaw) ? 0 : stockRaw,
      sku: sku || undefined,
      color: tr.querySelector('[name="vr-color"]')?.dataset.userSet === 'true' ? color : '',
      image,
      displayMode,
    });
  });
  return variants;
}

function sampleDominantColor(src, onColor) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  // Append cache-bust so the browser makes a fresh CORS request instead of
  // reusing a cached non-CORS response (which would taint the canvas).
  img.src = src + (src.includes('?') ? '&' : '?') + '_s4l=1';
  img.onload = () => {
    try {
      const SIZE = 80;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

      // Bucket pixels by 4-bit quantised RGB (16×16×16 = 4 096 buckets).
      // Each bucket stores [rSum, gSum, bSum, count] so we can average
      // within the winning bucket for accuracy.
      const buckets = new Map();

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;           // skip transparent
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Skip near-white backgrounds (lum > 235) and near-black shadows (lum < 20)
        const lum = (r * 299 + g * 587 + b * 114) / 1000;
        if (lum > 235 || lum < 20) continue;

        // Quantise: keep top 4 bits of each channel
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const e = buckets.get(key);
        if (e) { e[0] += r; e[1] += g; e[2] += b; e[3]++; }
        else    { buckets.set(key, [r, g, b, 1]); }
      }

      if (!buckets.size) return;

      // Find the bucket with the most pixels — that is the dominant colour by area
      let best = 0, winner = null;
      for (const e of buckets.values()) {
        if (e[3] > best) { best = e[3]; winner = e; }
      }

      // Average within the winning bucket gives the true representative colour
      const r = Math.round(winner[0] / winner[3]);
      const g = Math.round(winner[1] / winner[3]);
      const b = Math.round(winner[2] / winner[3]);

      const hex = (v) => v.toString(16).padStart(2, '0');
      onColor(`#${hex(r)}${hex(g)}${hex(b)}`);
    } catch { /* CORS blocked — leave picker as-is */ }
  };
}

function openGenModal() {
  const attrNames = getAttrNames();
  if (!attrNames.length) return;
  const existingVals = attrNames.map((_, i) =>
    [...new Set(Array.from(document.querySelectorAll('#variant-rows tr')).map(tr => {
      const inputs = tr.querySelectorAll('[name="vr-attr"]');
      return inputs[i]?.value.trim();
    }).filter(Boolean))]
  );
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:460px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)';
  box.innerHTML = `
    <h3 style="margin:0 0 6px;font-size:1rem;color:#111827">Generate all combinations</h3>
    <p style="margin:0 0 16px;font-size:0.82rem;color:#6b7280">Enter values for each attribute — one per line. Every combination will be created as a variant row.</p>
    ${attrNames.map((name, i) => `
      <div style="margin-bottom:14px">
        <label style="display:block;font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:4px">${name || `Attribute ${i+1}`}</label>
        <textarea data-idx="${i}" rows="4" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.85rem;resize:vertical;box-sizing:border-box;font-family:inherit">${existingVals[i].join('\n')}</textarea>
      </div>`).join('')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
      <button id="_gen-cancel" style="padding:7px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:0.9rem">Cancel</button>
      <button id="_gen-ok" style="padding:7px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:600">&#9889; Generate</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.querySelector('#_gen-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#_gen-ok').addEventListener('click', () => {
    const arrays = Array.from(box.querySelectorAll('textarea')).map(ta =>
      ta.value.split('\n').map(v => v.trim()).filter(Boolean));
    if (arrays.some(a => !a.length)) { alert('Please enter at least one value for each attribute.'); return; }
    function combos(arrs) {
      if (!arrs.length) return [[]];
      return arrs[0].flatMap(v => combos(arrs.slice(1)).map(r => [v, ...r]));
    }
    const tbody = document.getElementById('variant-rows');
    const normKey = (v) => String(v || '').trim().toLowerCase();
    const allCombos = combos(arrays);
    const newKeys = new Set(allCombos.map(c => c.map(normKey).join('\x00')));
    // Snapshot image/colour/price from existing rows, keyed by first attribute value
    // (case/whitespace-insensitive so retyping "black" vs "Black" in the modal still inherits)
    const snap = {};
    tbody.querySelectorAll('tr').forEach(row => {
      const rawFirst = row.querySelector('[name="vr-attr"]')?.value.trim();
      const first = normKey(rawFirst);
      if (!first || snap[first]) return;
      snap[first] = {
        image: row.querySelector('[name="vr-image"]')?.value.trim() || '',
        color: row.querySelector('[name="vr-color"]')?.dataset.userSet === 'true' ? row.querySelector('[name="vr-color"]').value : '',
        price: row.querySelector('[name="vr-price"]')?.value || '',
        stock: row.querySelector('[name="vr-stock"]')?.value || '',
        sku:   row.querySelector('[name="vr-sku"]')?.value || '',
        displayMode: row.dataset.mode || 'color',
      };
    });
    // Remove rows that are not in the new combination set (old colour-only rows)
    Array.from(tbody.querySelectorAll('tr')).forEach(row => {
      const key = Array.from(row.querySelectorAll('[name="vr-attr"]')).map(i => normKey(i.value)).join('\x00');
      if (!newKeys.has(key)) row.remove();
    });
    // Add missing combinations, inheriting image/colour from matching colour snapshot
    const existingKeys = new Set(
      Array.from(tbody.querySelectorAll('tr')).map(row =>
        Array.from(row.querySelectorAll('[name="vr-attr"]')).map(i => normKey(i.value)).join('\x00')
      )
    );
    allCombos.forEach(combo => {
      if (existingKeys.has(combo.map(normKey).join('\x00'))) return;
      const s = snap[normKey(combo[0])] || {};
      addVariantRow({ attrs: combo, image: s.image, color: s.color, price: s.price, stock: s.stock, sku: s.sku, displayMode: s.displayMode });
    });
    overlay.remove();
  });
}

function bindVariants() {
  const toggle = document.getElementById('has-variants');
  const builder = document.getElementById('variant-builder');
  if (!toggle || !builder) return;

  toggle.addEventListener('change', () => {
    builder.style.display = toggle.checked ? '' : 'none';
    if (toggle.checked && !document.querySelector('#variant-rows tr')) {
      addVariantRow();
    }
  });

  document.getElementById('btn-add-variant')?.addEventListener('click', () => addVariantRow());
  document.getElementById('btn-add-attr')?.addEventListener('click', () => addAttrInput('', true));
  document.getElementById('btn-gen-variants')?.addEventListener('click', openGenModal);
  addAttrInput('Colour');

  // Wire header checkbox: select all / deselect all variant rows
  document.getElementById('vb-header-row')?.addEventListener('change', (e) => {
    if (e.target.id === 'vr-check-all-hdr') {
      document.querySelectorAll('#variant-rows .vr-row-check').forEach(c => c.checked = e.target.checked);
    }
  });

  // Inject Select All + Remove Selected buttons into the variant button row
  const vbBtnRow = document.querySelector('.vb-btn-row');
  if (vbBtnRow && !document.getElementById('vr-sel-all-btn')) {
    const selAllBtn = document.createElement('button');
    selAllBtn.type = 'button';
    selAllBtn.id = 'vr-sel-all-btn';
    selAllBtn.textContent = '☑ Select All';
    selAllBtn.style.cssText = 'font-size:0.82rem;padding:6px 12px;background:#f0f9f8;border:1px solid #0b6b6a;color:#0b6b6a;border-radius:6px;cursor:pointer;font-weight:600';
    const removeSelBtn = document.createElement('button');
    removeSelBtn.type = 'button';
    removeSelBtn.id = 'vr-remove-sel-btn';
    removeSelBtn.textContent = '✕ Remove Selected';
    removeSelBtn.style.cssText = 'font-size:0.82rem;padding:6px 12px;background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;cursor:pointer;font-weight:600';
    selAllBtn.addEventListener('click', () => {
      const checks = Array.from(document.querySelectorAll('#variant-rows .vr-row-check'));
      const allChecked = checks.length > 0 && checks.every(c => c.checked);
      checks.forEach(c => c.checked = !allChecked);
      const hdr = document.getElementById('vr-check-all-hdr');
      if (hdr) hdr.checked = !allChecked;
    });
    removeSelBtn.addEventListener('click', () => {
      const checked = Array.from(document.querySelectorAll('#variant-rows .vr-row-check:checked'));
      if (!checked.length) { window.showToast?.('No rows selected', 'error'); return; }
      if (!confirm(`Remove ${checked.length} variant row(s)?`)) return;
      checked.forEach(cb => cb.closest('tr')?.remove());
      const hdr = document.getElementById('vr-check-all-hdr');
      if (hdr) hdr.checked = false;
    });
    vbBtnRow.appendChild(selAllBtn);
    vbBtnRow.appendChild(removeSelBtn);
  }

  const variantRows = document.getElementById('variant-rows');
  variantRows?.addEventListener('click', (e) => {
    if (e.target.classList.contains('vr-mode-btn')) {
      const tr = e.target.closest('tr');
      setRowMode(tr, e.target.dataset.pick);
      if (e.target.dataset.pick === 'color') {
        const picker = tr.querySelector('[name="vr-color"]');
        const imgUrl = tr.querySelector('[name="vr-image"]')?.value.trim();
        if (picker && picker.dataset.userSet !== 'true' && imgUrl) {
          sampleDominantColor(imgUrl, (hex) => {
            picker.value = hex;
            picker.dataset.userSet = 'true';
          });
        }
      }
    }
    if (e.target.classList.contains('vb-remove-btn')) {
      e.target.closest('tr').remove();
    }
    if (e.target.classList.contains('vr-img-clear')) {
      const td   = e.target.closest('td');
      const wrap = td.querySelector('.vr-thumb-wrap');
      const img  = td.querySelector('.vr-img-preview');
      const url  = td.querySelector('[name="vr-image"]');
      const doIt = async () => {
        const ok = await showConfirm('Clear this variant image? The colour swatch will remain.');
        if (!ok) return;
        if (img)  img.src = '';
        if (url)  url.value = '';
        if (wrap) wrap.classList.remove('has-img');
      };
      doIt();
    }
  });
  variantRows?.addEventListener('input', (e) => {
    if (e.target.classList.contains('vb-color-pick')) {
      e.target.dataset.userSet = 'true';
    }
    if (e.target.classList.contains('vr-img-url')) {
      const url     = e.target.value.trim();
      const td      = e.target.closest('td');
      const preview = td.querySelector('.vr-img-preview');
      const wrap    = td.querySelector('.vr-thumb-wrap');
      if (preview) preview.src = url;
      if (wrap)    wrap.classList.toggle('has-img', !!url);
      if (url) sampleDominantColor(url, (hex) => {
        const picker = e.target.closest('tr')?.querySelector('[name="vr-color"]');
        if (picker) { picker.value = hex; picker.dataset.userSet = 'true'; }
      });
    }
  });

  // Bulk variant image upload — one picker fills rows sequentially, creates new rows as needed
  const vrBulkBtn   = document.getElementById('vr-bulk-img-btn');
  const vrBulkInput = document.getElementById('vr-bulk-img-input');
  if (vrBulkBtn && vrBulkInput) {
    vrBulkBtn.addEventListener('click', () => vrBulkInput.click());
    vrBulkInput.addEventListener('change', async () => {
      const files = Array.from(vrBulkInput.files);
      if (!files.length) return;
      vrBulkBtn.disabled = true;
      vrBulkBtn.textContent = 'Uploading…';
      const tbody = document.getElementById('variant-rows');
      for (const file of files) {
        try {
          // Colour name = filename without extension (e.g. "Army Green.jpg" → "Army Green")
          const colourName = file.name.replace(/\.[^.]+$/, '').trim();
          const url = await uploadToCloudinary(file);
          const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
          // Prefer a row whose first attr matches the filename; fall back to first empty row
          let targetRow = rows.find(r => {
            const v = r.querySelector('[name="vr-attr"]')?.value.trim().toLowerCase();
            return v === colourName.toLowerCase();
          }) || rows.find(r => !r.querySelector('[name="vr-image"]')?.value.trim());
          if (!targetRow) { addVariantRow({ attrs: [colourName] }); targetRow = tbody?.querySelector('tr:last-child'); }
          if (!targetRow) continue;
          // Always set colour name from filename into first attr input
          const firstAttr = targetRow.querySelector('[name="vr-attr"]');
          if (firstAttr) firstAttr.value = colourName;
          const urlInput = targetRow.querySelector('[name="vr-image"]');
          const img      = targetRow.querySelector('.vr-img-preview');
          const wrap     = targetRow.querySelector('.vr-thumb-wrap');
          if (urlInput) urlInput.value = url;
          if (img)      img.src = url;
          if (wrap)     wrap.classList.add('has-img');
          sampleDominantColor(url, (hex) => {
            const picker = targetRow.querySelector('[name="vr-color"]');
            if (picker && picker.dataset.userSet !== 'true') {
              picker.value = hex; picker.dataset.userSet = 'true';
            }
            // Propagate image + colour to other rows sharing the same first attribute value
            const firstAttrVal = targetRow.querySelector('[name="vr-attr"]')?.value.trim();
            if (firstAttrVal) {
              tbody?.querySelectorAll('tr').forEach(row => {
                if (row === targetRow) return;
                if (row.querySelector('[name="vr-attr"]')?.value.trim() !== firstAttrVal) return;
                const ri = row.querySelector('[name="vr-image"]');
                if (ri && !ri.value) {
                  ri.value = url;
                  const rImg = row.querySelector('.vr-img-preview');
                  const rWrap = row.querySelector('.vr-thumb-wrap');
                  const rPick = row.querySelector('[name="vr-color"]');
                  if (rImg) rImg.src = url;
                  if (rWrap) rWrap.classList.add('has-img');
                  if (rPick) { rPick.value = hex; rPick.dataset.userSet = 'true'; }
                }
              });
            }
          });
        } catch {
          window.showToast?.('One image failed to upload — skipped', 'error');
        }
      }
      vrBulkInput.value = '';
      vrBulkBtn.disabled = false;
      vrBulkBtn.textContent = '📷 Bulk upload images';
    });
  }

  // Inject "Set all: [Clr] [Img]" control above variant table — works regardless of HTML version
  const vbTable = document.querySelector('.vb-table');
  if (vbTable && !document.getElementById('vb-global-ctrl')) {
    const ctrl = document.createElement('div');
    ctrl.id = 'vb-global-ctrl';
    ctrl.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280';
    const lbl = document.createElement('span');
    lbl.textContent = 'Set all rows:';
    const btnClr = document.createElement('button');
    btnClr.type = 'button'; btnClr.id = 'vb-btn-clr';
    btnClr.textContent = 'Colour';
    btnClr.style.cssText = 'padding:3px 10px;background:#14b8a6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600';
    const btnImg = document.createElement('button');
    btnImg.type = 'button'; btnImg.id = 'vb-btn-img';
    btnImg.textContent = 'Image';
    btnImg.style.cssText = 'padding:3px 10px;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600';
    function setGlobalMode(mode) {
      _variantGlobalMode = mode;
      btnClr.style.cssText = mode === 'color'
        ? 'padding:3px 10px;background:#14b8a6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600'
        : 'padding:3px 10px;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600';
      btnImg.style.cssText = mode === 'image'
        ? 'padding:3px 10px;background:#6366f1;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600'
        : 'padding:3px 10px;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600';
      document.querySelectorAll('#variant-rows tr').forEach(tr => setRowMode(tr, mode));
    }
    btnClr.addEventListener('click', () => setGlobalMode('color'));
    btnImg.addEventListener('click', () => setGlobalMode('image'));
    const sep = document.createElement('span');
    sep.textContent = '|';
    sep.style.cssText = 'color:#d1d5db;margin:0 2px';
    const topSelAll = document.createElement('button');
    topSelAll.type = 'button';
    topSelAll.textContent = '☑ Select All';
    topSelAll.style.cssText = 'padding:3px 10px;background:#f0f9f8;border:1px solid #0b6b6a;color:#0b6b6a;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600';
    topSelAll.addEventListener('click', () => document.getElementById('vr-sel-all-btn')?.click());
    const topRemSel = document.createElement('button');
    topRemSel.type = 'button';
    topRemSel.textContent = '✕ Remove Selected';
    topRemSel.style.cssText = 'padding:3px 10px;background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600';
    topRemSel.addEventListener('click', () => document.getElementById('vr-remove-sel-btn')?.click());
    ctrl.appendChild(lbl); ctrl.appendChild(btnClr); ctrl.appendChild(btnImg);
    ctrl.appendChild(sep); ctrl.appendChild(topSelAll); ctrl.appendChild(topRemSel);
    vbTable.parentNode.insertBefore(ctrl, vbTable);
  }
  // Also wire existing checkbox if HTML was uploaded
  const colorModeEl = document.getElementById('vb-color-mode');
  if (colorModeEl) colorModeEl.addEventListener('change', () => {
    document.getElementById(colorModeEl.checked ? 'vb-btn-clr' : 'vb-btn-img')?.click();
  });
}

// ======================================================
// ADD-ONS BUILDER
// ======================================================

let _addonRowId = 0;

function addAddonRow(data) {
  data = data || {};
  const tbody = document.getElementById('addon-rows');
  if (!tbody) return;
  const id = ++_addonRowId;
  const tr = document.createElement('tr');
  tr.dataset.rowId = id;
  const imgSrc = data.image || '';
  tr.innerHTML = `
    <td class="ao-img-cell">
      <div class="ao-img-wrap">
        <img class="ao-img-preview" src="${imgSrc}" alt="" style="${imgSrc ? '' : 'display:none'}" />
        <input type="text" class="vb-input ao-img-url" name="ao-image" value="${imgSrc}" placeholder="Paste image URL…" />
      </div>
    </td>
    <td><input type="text" class="vb-input" name="ao-name" value="${data.name || ''}" placeholder="e.g. Battery pack" /></td>
    <td><input type="number" class="vb-input vb-input-sm" name="ao-price" step="0.01" min="0" value="${data.price != null ? data.price : ''}" placeholder="0.00" /></td>
    <td><input type="text" class="vb-input" name="ao-desc" value="${data.description || ''}" placeholder="Short description (optional)" /></td>
    <td><button type="button" class="vb-remove-btn" data-row="${id}">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function getAddOns() {
  if (!document.getElementById('has-addons')?.checked) return [];
  const addOns = [];
  document.querySelectorAll('#addon-rows tr').forEach((tr) => {
    const name = tr.querySelector('[name="ao-name"]')?.value.trim();
    if (!name) return;
    const price = parseFloat(tr.querySelector('[name="ao-price"]')?.value);
    const description = tr.querySelector('[name="ao-desc"]')?.value.trim();
    const image = tr.querySelector('[name="ao-image"]')?.value.trim();
    addOns.push({
      name,
      price: isNaN(price) ? 0 : price,
      description: description || '',
      image: image || '',
    });
  });
  return addOns;
}

function bindAddOns() {
  const toggle = document.getElementById('has-addons');
  const builder = document.getElementById('addon-builder');
  if (!toggle || !builder) return;

  toggle.addEventListener('change', () => {
    builder.style.display = toggle.checked ? '' : 'none';
    if (toggle.checked && !document.querySelector('#addon-rows tr')) {
      addAddonRow();
    }
  });

  document.getElementById('btn-add-addon')?.addEventListener('click', () => addAddonRow());

  const tbody = document.getElementById('addon-rows');
  tbody?.addEventListener('click', (e) => {
    if (e.target.classList.contains('vb-remove-btn')) {
      e.target.closest('tr').remove();
    }
  });
  tbody?.addEventListener('input', (e) => {
    if (e.target.classList.contains('ao-img-url')) {
      const url = e.target.value.trim();
      const preview = e.target.closest('td').querySelector('.ao-img-preview');
      if (preview) { preview.src = url; preview.style.display = url ? '' : 'none'; }
    }
  });
}

// ======================================================
// SUBCATEGORY LOGIC
// ======================================================

function bindSubcategory() {
  categorySelect.addEventListener('change', () => {
    const val = categorySelect.value;
    subcategorySelect.innerHTML = '<option value="">Select subcategory</option>';
    if (!val || !subcategoriesMap[val]) {
      subcategorySelect.disabled = true;
      return;
    }
    subcategorySelect.disabled = false;
    subcategoriesMap[val].forEach((sub) => {
      const opt = document.createElement('option');
      opt.value = sub.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      opt.textContent = sub;
      subcategorySelect.appendChild(opt);
    });
  });
}

// ======================================================
// STATUS RADIO VISUAL
// ======================================================

function bindStatusRadio() {
  document.querySelectorAll('input[name="productStatus"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.ap-status-opt').forEach((el) => el.classList.remove('selected'));
      radio.closest('.ap-status-opt').classList.add('selected');
    });
  });
}

// ======================================================
// SEO COLLAPSIBLE
// ======================================================

function bindSeoToggle() {
  const toggle = document.getElementById('seo-toggle');
  const body   = document.getElementById('seo-body');
  const icon   = document.getElementById('seo-icon');
  if (!toggle || !body) return;

  toggle.addEventListener('click', () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    icon.textContent = open ? '▸' : '▾';
    toggle.style.paddingBottom = open ? '0' : '10px';
    toggle.style.borderBottom = open ? 'none' : '1px solid #f3f4f6';
    toggle.style.marginBottom = open ? '0' : '16px';
  });
}

// ======================================================
// HELPERS
// ======================================================

function setMsg(text, type) {
  const el = document.getElementById('form-msg');
  if (!el) return;
  el.textContent = text;
  el.className = `ap-form-msg ${type}`;
}

function numOrNull(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) || v === 0 ? undefined : v;
}

// Like numOrNull but allows 0 (e.g. costPrice = 0 is a valid "no cost"
// value the vendor may deliberately set — numOrNull would silently drop it
// and the field never reaches the update payload at all).
function numOrUndef(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? undefined : v;
}

// ======================================================
// SHIPPING MODE (Free / I'll Charge / Collection Only)
// ======================================================

function setShippingMode(mode) {
  const hidden = document.getElementById('product-shipping-mode');
  const toggle = document.getElementById('product-ship-charge-toggle');
  if (hidden) hidden.value = mode;
  document.querySelectorAll('.ap-ship-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  if (toggle) toggle.checked = mode === 'charge';
  // The shipping cost field stays visible and keeps its value across mode
  // changes now — it's also the markup calculator's reference cost, needed
  // whether or not this mode actually charges the buyer for it.
}

function bindShippingMode() {
  const grid = document.getElementById('ap-ship-grid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.ap-ship-btn');
      if (!btn) return;
      setShippingMode(btn.dataset.mode);
    });
  }
  const toggle = document.getElementById('product-ship-charge-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => setShippingMode(toggle.checked ? 'charge' : 'free'));
  }
}

// ======================================================
// INIT
// ======================================================

async function prefillFreeReturns() {
  const token = localStorage.getItem('s4l_token');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/vendor/me`, { headers: { Authorization: `Bearer ${token}` } });
    const { vendor } = await res.json();
    const cb = document.getElementById('product-free-returns');
    if (cb && vendor?.freeReturns) cb.checked = true;
  } catch { /* leave unchecked on failure */ }
}

function initAddProduct() {
  bindSubcategory();
  bindShippingMode();
  bindImageUploads();
  bindVideoSlots();
  bindTagSuggestions();
  bindStatusRadio();
  bindSeoToggle();
  bindVariants();
  bindAddOns();
  prefillFreeReturns();
}

if (document.readyState === 'complete') {
  initAddProduct();
} else {
  window.addEventListener('load', initAddProduct, { once: true });
}

// ======================================================
// SUBMIT
// ======================================================

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('s4l_token');
    if (!token) { await showAlert('Not authenticated'); return; }

    const vendorRes = await fetch(`${API_BASE}/vendor/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { vendor } = await vendorRes.json();
    if (!vendor)                      { await showAlert('Create your store first'); return; }
    if (vendor.status === 'pending')  { await showAlert('Your store is under review'); return; }
    if (vendor.status === 'suspended'){ await showAlert('Your store is suspended'); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    // Block submit if any upload is still in progress
    if (pendingUploads.size > 0) {
      window.showToast?.('Please wait for images to finish uploading', 'error');
      reset(btn);
      return;
    }

    // Collect uploaded Cloudinary URLs
    const images = Array.from({ length: 20 }, (_, i) => i + 1).map((n) => uploadedUrls[n]).filter(Boolean);

    // Collect tags
    const tagsRaw = document.getElementById('product-tags')?.value.trim();
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    // Dimensions (only include if at least one is set)
    const w = numOrNull('product-width');
    const h = numOrNull('product-height');
    const l = numOrNull('product-length');
    const dimensions = (w || h || l) ? { width: w, height: h, length: l } : undefined;

    // SEO title/desc
    const seoTitle = document.getElementById('product-seo-title')?.value.trim() || undefined;
    const seoDesc  = document.getElementById('product-seo-desc')?.value.trim()  || undefined;

    // Compare & cost price
    const comparePrice  = numOrNull('product-compare-price');
    const costPrice     = numOrNull('product-cost-price');
    const shippingMode  = document.getElementById('product-shipping-mode')?.value || 'free';
    const collectionOnly = shippingMode === 'collection';
    // Always saved, whether or not it's charged to the buyer — also the
    // reference figure the markup calculator uses. shipIncluded (below) is
    // the single source of truth for whether the buyer actually pays it;
    // the "Charge for shipping" checkbox/button grid used to have no
    // save/load wiring here at all, so it never actually affected checkout.
    const shippingCost  = collectionOnly ? 0 : numOrNull('product-shipping-cost');
    const shipIncluded  = shippingMode !== 'charge';
    const weight        = numOrNull('product-weight');
    const estDeliveryMinDays = numOrNull('product-delivery-min');
    const estDeliveryMaxDays = numOrNull('product-delivery-max');

    const active = document.querySelector('input[name="productStatus"]:checked')?.value !== 'draft';

    const product = {
      name:             document.getElementById('product-name')?.value.trim(),
      shortDescription: document.getElementById('product-short-desc')?.value.trim() || undefined,
      bulletPoints:     document.getElementById('product-bullet-points')?.value.trim() || undefined,
      description:      document.getElementById('product-description')?.value.trim(),
      price:            Number(document.getElementById('product-price')?.value),
      comparePrice,
      costPrice,
      shippingCost,
      shipIncluded,
      collectionOnly,
      images,
      category:         categorySelect.value,
      subcategory:      subcategorySelect.value,
      tags,
      stock:            Number(document.getElementById('product-stock')?.value),
      sku:              document.getElementById('product-sku')?.value.trim() || undefined,
      trackInventory:   document.getElementById('track-inventory')?.checked,
      allowBackorder:   document.getElementById('allow-backorder')?.checked,
      weight,
      dimensions,
      estDeliveryMinDays,
      estDeliveryMaxDays,
      freeReturns:      !!document.getElementById('product-free-returns')?.checked,
      supplier:         document.getElementById('product-supplier')?.value.trim() || undefined,
      supplierUrl:      document.getElementById('product-supplier-url')?.value.trim() || undefined,
      seoTitle,
      seoDescription:  seoDesc,
      active,
      comingSoon:       !!(document.getElementById('coming-soon')?.checked),
      videoUrl:         document.getElementById('product-video-url')?.value.trim()  || '',
      videoUrl2:        document.getElementById('product-video-url2')?.value.trim() || '',
      videoUrl3:        document.getElementById('product-video-url3')?.value.trim() || '',
      videoUrl4:        document.getElementById('product-video-url4')?.value.trim() || '',
      videoUrl5:        document.getElementById('product-video-url5')?.value.trim() || '',
      variantDisplay:   document.getElementById('vb-color-mode')?.checked !== false ? 'color' : 'image',
      variants: getVariants(),
      addOns: getAddOns(),
      conditionGrade:     document.getElementById('refurb-condition-grade')?.value  || undefined,
      testedStatus:       document.getElementById('refurb-tested-status')?.value    || undefined,
      warrantyPeriod:     document.getElementById('refurb-warranty')?.value.trim()  || undefined,
      serialNumber:       document.getElementById('refurb-serial')?.value.trim()    || undefined,
      refurbishmentNotes: document.getElementById('refurb-notes')?.value.trim()     || undefined,
    };

    // Validation
    if (!product.name)                              { showToast('Product name required', 'error'); reset(btn); return; }
    if (!Number.isFinite(product.price) || product.price < 0) { showToast('Invalid price', 'error'); reset(btn); return; }
    if (!product.category)                          { showToast('Select a category', 'error'); reset(btn); return; }
    if (!product.subcategory)                       { showToast('Select a subcategory', 'error'); reset(btn); return; }
    if (shippingMode === 'charge' && !(product.shippingCost > 0)) {
      showToast('Enter a shipping cost, or choose Free/Collection instead', 'error'); reset(btn); return;
    }

    try {
      showToast('Creating product…');
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(product),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Product creation failed');

      showToast('Product created!');
      setTimeout(() => { window.location.href = '/account/vendor/products.html'; }, 1000);
    } catch (err) {
      reset(btn);
      showToast(err.message || 'Product creation failed', 'error');
    }
  });
}

function reset(btn) {
  btn.disabled = false;
  btn.textContent = 'Create Product';
}
