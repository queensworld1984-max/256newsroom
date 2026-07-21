import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { io as socketIO } from 'socket.io-client';
import InstallAppBanner from './components/InstallAppBanner.jsx';
import NewsPage from './pages/NewsPage.jsx';
import { usePersistedForm, usePersistedValue, useDraftableForm } from './hooks/usePersistedForm.js';

function UnsavedDraftBanner({onRestore,onDiscard,label='You have unsaved edits from before the page refreshed.'}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#92400e'}}>
      <span style={{flex:1,minWidth:200}}>⚠️ {label}</span>
      <button type="button" onClick={onRestore} style={{background:'#92400e',color:'#fff',border:'none',borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>Restore edits</button>
      <button type="button" onClick={onDiscard} style={{background:'transparent',color:'#92400e',border:'1px solid #fcd34d',borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Discard</button>
    </div>
  );
}

// Must match backend/routes/orders.js TAX_RATE. URA VAT registration is threshold-based
// (18% only once rolling 12-month sales exceed UGX 300M) — keep at 0 until then.
const TAX_RATE=0;
const NAVY='#131921',NAVY2='#232F3E',YELLOW='#FFD814',ORANGE='#FF9900',CREAM='#FFF8EC';
const WHITE='#FFFFFF',LIGHT='#EAEDED',GOLD='#C8992A',RED='#B12704';
const RED2='#CC0C39',GREEN='#007600',LINK='#007185',TEXT='#0F1111';
const MUTED='#565959',BORDER='#DDD',SF="Arial,Helvetica,sans-serif";
// 256 family luxury design tokens
const BLACK='#0A0A0A',PF="'Playfair Display',Georgia,serif",DM="'DM Sans',system-ui,sans-serif";
const GL='#F5D060',GD='#9A6A10',GSHINE='linear-gradient(135deg,#f5d060 0%,#c8992a 25%,#f0c84a 45%,#9a6a10 65%,#f5d060 85%,#c8992a 100%)';
const GSWEEP='linear-gradient(90deg,#9a6a10 0%,#f5d060 20%,#c8992a 40%,#f5d060 60%,#9a6a10 80%,#f5d060 100%)';
// 256mall v1 design tokens
const BN="'Bebas Neue',Impact,sans-serif";
const BL="'Barlow','DM Sans',system-ui,sans-serif";
const BLC="'Barlow Condensed',sans-serif";
const MG_GOLD='linear-gradient(135deg,#7B5E00 0%,#C8980A 10%,#FFE566 24%,#FFF0A0 34%,#FFD700 44%,#E8B820 52%,#FFF3B0 60%,#D4A017 70%,#FFE033 80%,#B8860B 90%,#8B6E00 100%)';
const MG_BLACK='linear-gradient(135deg,#000 0%,#0a0a0a 18%,#1a1a1a 30%,#2a2a2a 38%,#0f0f0f 46%,#1e1e1e 54%,#050505 64%,#121212 74%,#000 84%,#0d0d0d 92%,#000 100%)';
const MG_WHITE='linear-gradient(135deg,#aaa 0%,#ccc 12%,#eee 22%,#fff 32%,#f0f0f0 40%,#ddd 50%,#fff 58%,#e8e8e8 66%,#bbb 76%,#ddd 86%,#aaa 100%)';
const MG_RED='linear-gradient(135deg,#2a0000 0%,#7a0a0a 12%,#c0202a 24%,#ff4444 34%,#ff7070 42%,#cc2020 52%,#ff5555 60%,#991010 70%,#ff3333 80%,#7a0808 90%,#2a0000 100%)';
const GOLD_STRIP='linear-gradient(90deg,#8B6E00 0%,#FFD700 30%,#FFF0A0 50%,#FFD700 70%,#8B6E00 100%)';
const MG_GOLD_H='linear-gradient(90deg,#8B6E00 0%,#C8980A 10%,#FFE566 22%,#FFF0A0 32%,#FFD700 42%,#FFF3B0 50%,#FFD700 58%,#E8B820 68%,#FFE566 78%,#C8980A 88%,#8B6E00 100%)';
const MG_BLACK_H='linear-gradient(90deg,#000 0%,#080808 8%,#161616 16%,#242424 24%,#181818 32%,#0a0a0a 40%,#202020 48%,#0c0c0c 56%,#1a1a1a 64%,#080808 72%,#141414 80%,#020202 88%,#000 100%)';
const METAL_STRIPE='linear-gradient(90deg,#000 0%,#1a1a1a 10%,#000 18%,#8B6E00 24%,#FFD700 34%,#FFF0A0 42%,#FFD700 50%,#8B6E00 58%,#2a0000 66%,#C0202A 74%,#ff7070 80%,#C0202A 86%,#2a0000 92%,#888 94%,#fff 96%,#888 98%,#000 100%)';
const NAV_BG='linear-gradient(180deg,#1a1a1a 0%,#0f0f0f 15%,#000 30%,#0a0a0a 45%,#141414 55%,#000 70%,#0d0d0d 85%,#050505 100%)';

const LAUNCH_GATE = false;

const DEPTS=[
  {name:'Electronics',slug:'electronics',icon:'📱'},
  {name:'Computers & Laptops',slug:'computers',icon:'💻'},
  {name:'Smart Home',slug:'smart-home',icon:'🏠'},
  {name:'Arts & Crafts',slug:'arts-crafts',icon:'🎨'},
  {name:'Automotive',slug:'automotive',icon:'🚗'},
  {name:'Baby & Kids',slug:'baby-kids',icon:'👶'},
  {name:'Beauty & Personal Care',slug:'beauty',icon:'💄'},
  {name:"Women's Fashion",slug:'womens-fashion',icon:'👗'},
  {name:"Men's Fashion",slug:'mens-fashion',icon:'👔'},
  {name:"Girls' Fashion",slug:'girls-fashion',icon:'👧'},
  {name:"Boys' Fashion",slug:'boys-fashion',icon:'👦'},
  {name:'Health & Household',slug:'health',icon:'💊'},
  {name:'Home & Kitchen',slug:'home-kitchen',icon:'🏡'},
  {name:'Industrial & Scientific',slug:'industrial',icon:'🔬'},
  {name:'Luggage & Travel',slug:'luggage',icon:'🧳'},
  {name:'Movies & Television',slug:'movies-tv',icon:'🎬'},
  {name:'Pet Supplies',slug:'pets',icon:'🐾'},
  {name:'Sports & Outdoors',slug:'sports',icon:'⚽'},
  {name:'Tools & Home Improvement',slug:'tools',icon:'🔧'},
  {name:'Toys & Games',slug:'toys-games',icon:'🎮'},
  {name:'Video Games',slug:'video-games',icon:'🕹'},
  {name:'Uganda Fresh Produce',slug:'fresh-produce',icon:'🥬'},
  {name:'Agriculture & Farming',slug:'agriculture',icon:'🌾'},
  {name:'African Fashion & Crafts',slug:'african-fashion',icon:'🪘'},
];

const SLIDES=[
  {
    badge:'🇺🇬 Uganda\'s Largest Online Mall',
    h1:"256 Mall —",h2:'Everything Delivered.',
    sub:'Shop from thousands of verified sellers across Uganda. Pay with MTN MoMo or Airtel Money. Delivered to all 146 districts.',
    cta:'Shop Now →',link:'/products',
    ac:'#FFD700',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #0a0702 48%, #1e1000 62%, #522a00 76%, #8B4800 88%, #C87000 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'⚡ Flash Deals',
    h1:'Up to 60% Off',h2:'Today Only.',
    sub:'Electronics, fashion, food, beauty. New deals every 24 hours from verified Ugandan sellers.',
    cta:'See Deals →',link:'/products',
    ac:'#60a5fa',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #00040f 48%, #000d28 62%, #001e5a 76%, #003090 88%, #0044bb 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'🇺🇬 Fresh Produce',
    h1:'Farm to',h2:'Your Door.',
    sub:'Matooke, coffee, avocado, vegetables. Ordered online, delivered fresh directly from Ugandan farms.',
    cta:'Order Fresh →',link:'/produce',
    ac:'#4ade80',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #010c02 48%, #012c0a 62%, #034820 76%, #056830 88%, #077a38 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'🪘 Uganda Made',
    h1:'Shop',h2:'Uganda Made.',
    sub:'Authentic crafts, kitenge, kanzus and food products from local Ugandan makers and artisans.',
    cta:'Shop Uganda Made →',link:'/products',
    ac:'#fb923c',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #0b0200 48%, #220900 62%, #4e1400 76%, #842200 88%, #a83000 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'📱 Electronics',
    h1:'Best Prices',h2:'In Uganda.',
    sub:'Smartphones, laptops, TVs, accessories. All from verified sellers. Samsung, HP, Hisense, Itel and more.',
    cta:'Shop Electronics →',link:'/category/electronics',
    ac:'#93c5fd',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #000208 48%, #00061c 62%, #000c3c 76%, #001468 88%, #001e88 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'👗 Fashion',
    h1:'Fashion for',h2:'Everyone.',
    sub:"Women's, men's, kids' — African wear, kitenge, shoes and more from Uganda's top fashion sellers.",
    cta:'Shop Fashion →',link:'/category/womens-fashion',
    ac:'#f472b6',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #090006 48%, #200015 62%, #480040 76%, #780070 88%, #980090 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'🏪 Sell on 256 Mall',
    h1:'Start Selling',h2:'Today — Free.',
    sub:'Reach 45 million Ugandans. Free listing. Get paid via MTN MoMo and Airtel Money payouts.',
    cta:'Start Selling →',link:'/sell',
    ac:'#34d399',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #010a03 48%, #022212 62%, #044025 76%, #066035 88%, #077840 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b6?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1553413077-190dd305871c?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1566576912321-d58dfa81b843?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1571867424488-4565932edb41?w=200&h=200&fit=crop&q=85',
    ],
  },
  {
    badge:'🐄 Animal Market',
    h1:'GPS Verified',h2:'Farmers.',
    sub:'Cattle, goats, chickens, pigs. Buy direct from verified farms across all 146 districts. Health certified.',
    cta:'Browse Animals →',link:'/animals',
    ac:'#fbbf24',
    bg:'linear-gradient(to right, #000 0%, #030303 32%, #0a0600 48%, #201200 62%, #402400 76%, #6e3c00 88%, #8B5000 100%)',
    visuals:[
      'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1598021680151-46e7d2d5d98f?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1484557985045-edf25e08da73?w=200&h=200&fit=crop&q=85',
      'https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=200&h=200&fit=crop&q=85',
    ],
  },
];

const MOCK_PRODUCTS=[];

const MOCK_PRODUCE=[
  {id:'demo-pr1',product_name:'Matooke',product_name_luganda:'Matooke',listing_tier:'retail',retail_price:28000,retail_unit:'bunch',district:'Wakiso',farmer_name:'Ssempala Farm',is_organic:false,photos:['https://images.unsplash.com/photo-1481349518771-20055b2a7b24?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr2',product_name:'Fresh Tomatoes',product_name_luganda:'Nyanya',listing_tier:'retail',retail_price:9000,retail_unit:'tray',district:'Mukono',farmer_name:'Namutebi Gardens',photos:['https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr3',product_name:'Fresh Beef — Bone In',listing_tier:'retail',retail_price:22000,retail_unit:'kg',district:'Kampala',farmer_name:'Kato Butchery',photos:['https://images.unsplash.com/photo-JHWfH8V2INk?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr4',product_name:'Beef Steak Cuts',listing_tier:'retail',retail_price:28000,retail_unit:'kg',district:'Kampala',farmer_name:'Kato Butchery',photos:['https://images.unsplash.com/photo-Pam9FIkHok4?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr5',product_name:'Goat Meat — Bone In',listing_tier:'retail',retail_price:24000,retail_unit:'kg',district:'Wakiso',farmer_name:'Ssali Livestock',photos:['https://images.unsplash.com/photo-cvj-7TZjvA0?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr6',product_name:'Fresh Pork Chops',listing_tier:'retail',retail_price:15000,retail_unit:'kg',district:'Kampala',farmer_name:'Mugisha Piggery',photos:['https://images.unsplash.com/photo-DxJvLtab4ak?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr7',product_name:'Dressed Chicken — Whole',listing_tier:'retail',retail_price:38000,retail_unit:'bird',district:'Wakiso',farmer_name:'Kironde Poultry',photos:['https://images.unsplash.com/photo-oqZ7gu3ytDg?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr8',product_name:'Chicken Pieces — 1kg Pack',listing_tier:'retail',retail_price:14000,retail_unit:'kg',district:'Wakiso',farmer_name:'Kironde Poultry',photos:['https://images.unsplash.com/photo-9ZrWR8R961U?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr9',product_name:'Tilapia — Whole Fresh',listing_tier:'retail',retail_price:20000,retail_unit:'kg',district:'Jinja',farmer_name:'Lake Victoria Fish',photos:['https://images.unsplash.com/photo-buf2kUxGOXU?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr10',product_name:'Nile Perch Fillet — Fresh',listing_tier:'retail',retail_price:26000,retail_unit:'kg',district:'Jinja',farmer_name:'Lake Victoria Fish',photos:['https://images.unsplash.com/photo-kC9KUtSiflw?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr11',product_name:'Pork Ribs — Whole Rack',listing_tier:'retail',retail_price:13000,retail_unit:'kg',district:'Kampala',farmer_name:'Mugisha Piggery',photos:['https://images.unsplash.com/photo-iSDSIrV9zEo?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr12',product_name:'Minced Beef (Ground)',listing_tier:'retail',retail_price:24000,retail_unit:'kg',district:'Kampala',farmer_name:'Kato Butchery',photos:['https://images.unsplash.com/photo-AQ_BdsvLgqA?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr13',product_name:'Eggs — Tray of 30',listing_tier:'retail',retail_price:15000,retail_unit:'tray',district:'Kampala',farmer_name:'Kironde Poultry',photos:['https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr14',product_name:'Fresh Milk',listing_tier:'retail',retail_price:3800,retail_unit:'litre',district:'Mbarara',farmer_name:'Kiruhura Dairy',is_organic:true,photos:['https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr15',product_name:'Avocado',product_name_luganda:'Ovakado',listing_tier:'retail',retail_price:16000,retail_unit:'dozen',district:'Mbale',farmer_name:'Mbale Farms',photos:['https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=400&q=80']},
  {id:'demo-pr16',product_name:'Red Kidney Beans',product_name_luganda:'Ebijanjalo',listing_tier:'retail',retail_price:7000,retail_unit:'kg',district:'Masaka',farmer_name:'Ssali Grains',photos:['https://images.unsplash.com/photo-1590165482129-1b8b27698780?auto=format&fit=crop&w=400&q=80']},
];

const MOCK_ANIMALS=[
  {id:'demo-a1',animal_type:'cattle',name:'Ankole Long-horn Cattle',breed:'Ankole',age_months:36,weight_kg:320,price:4500000,unit:'head',qty:4,district:'Kiruhura',village:'Sanga',seller:'Tumwesigye Livestock',phone:'0772100001',lat:-0.2135,lng:30.8514,vaccinated:true,health_cert:true,movement_permit:true,photo:'https://images.unsplash.com/photo-1546445317-29f4545e9d53?auto=format&fit=crop&w=400&q=80',desc:'Strong healthy bulls, fully vaccinated. FMD & CBPP vaccinated. Movement permit from DVO available.'},
  {id:'demo-a2',animal_type:'cattle',name:'Friesian × Zebu Heifers',breed:'Friesian Cross',age_months:20,weight_kg:280,price:5500000,unit:'head',qty:3,district:'Mbarara',seller:'Mbarara Dairy Farm',phone:'0772100009',lat:-0.6072,lng:30.6545,vaccinated:true,health_cert:true,movement_permit:true,photo:'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=400&q=80',desc:'Pregnant heifers, high milk yield. Brucellosis-tested negative.'},
  {id:'demo-a3',animal_type:'goat',name:'Mubende Goats',breed:'Mubende',age_months:18,weight_kg:35,price:380000,unit:'head',qty:12,district:'Mubende',seller:'Nakirya Goat Farm',phone:'0752100002',lat:0.5635,lng:31.3674,vaccinated:true,health_cert:true,movement_permit:false,photo:'https://images.unsplash.com/photo-1598021680151-46e7d2d5d98f?auto=format&fit=crop&w=400&q=80',desc:'Mature does and bucks. PPR & Brucellosis vaccinated.'},
  {id:'demo-a4',animal_type:'sheep',name:'Rwandan Short-tail Sheep',breed:'Rwandan',age_months:24,weight_kg:45,price:320000,unit:'head',qty:20,district:'Kabale',seller:'Kabale Highland Farm',phone:'0702100004',lat:-1.2514,lng:29.9894,vaccinated:true,health_cert:true,movement_permit:true,photo:'https://images.unsplash.com/photo-1484557985045-edf25e08da73?auto=format&fit=crop&w=400&q=80',desc:'Fattened sheep, ideal for celebrations and religious events.'},
  {id:'demo-a5',animal_type:'pig',name:'Large White Pigs',breed:'Large White',age_months:8,weight_kg:90,price:550000,unit:'head',qty:6,district:'Wakiso',seller:'Mugisha Piggery',phone:'0782100003',lat:0.3614,lng:32.5011,vaccinated:true,health_cert:true,movement_permit:false,photo:'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=400&q=80',desc:'Ready for slaughter or breeding. ASF-free certified zone.'},
  {id:'demo-a6',animal_type:'chicken',name:'Indigenous Chicken (Nkoko)',breed:'Local Free-range',age_months:6,weight_kg:1.5,price:28000,unit:'bird',qty:200,district:'Kampala',village:'Bwaise',seller:'Nakato Poultry',phone:'0782100005',lat:0.3614,lng:32.5611,vaccinated:true,health_cert:false,movement_permit:false,photo:'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=400&q=80',desc:'Free-range local chicken. Newcastle disease vaccinated.'},
  {id:'demo-a7',animal_type:'chicken',name:'Broiler Chicken (4kg+)',breed:'Broiler',age_months:2,weight_kg:4.2,price:38000,unit:'bird',qty:500,district:'Wakiso',seller:'Kironde Poultry Farm',phone:'0752100006',lat:0.3314,lng:32.5211,vaccinated:true,health_cert:true,movement_permit:false,photo:'https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?auto=format&fit=crop&w=400&q=80',desc:'Ready-to-slaughter broilers. Gumboro & Newcastle vaccinated.'},
  {id:'demo-a8',animal_type:'duck',name:'Muscovy Ducks',breed:'Muscovy',age_months:4,weight_kg:2.8,price:45000,unit:'bird',qty:50,district:'Jinja',seller:'Jinja Bird Farm',phone:'0782100007',lat:0.4244,lng:33.2042,vaccinated:true,health_cert:false,movement_permit:false,photo:'https://images.unsplash.com/photo-1548767797-d8c844163c4a?auto=format&fit=crop&w=400&q=80',desc:'Free-range Muscovy ducks.'},
  {id:'demo-a9',animal_type:'turkey',name:'Turkey Birds',breed:'Broad-breasted White',age_months:6,weight_kg:8,price:100000,unit:'bird',qty:25,district:'Mukono',seller:'Mukono Turkey Farm',phone:'0752100010',lat:0.3536,lng:32.7551,vaccinated:true,health_cert:false,movement_permit:false,photo:'https://images.unsplash.com/photo-1574068468671-af23f4f04a50?auto=format&fit=crop&w=400&q=80',desc:'Ideal for Christmas and Easter celebrations.'},
  {id:'demo-a10',animal_type:'rabbit',name:'New Zealand White Rabbits',breed:'New Zealand White',age_months:4,weight_kg:2.5,price:50000,unit:'pair',qty:30,district:'Kampala',seller:'City Rabbit Farm',phone:'0702100008',lat:0.3476,lng:32.5825,vaccinated:false,health_cert:false,movement_permit:false,photo:'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=400&q=80',desc:'Breeding pairs and market-weight rabbits available.'},
];

const MOCK_REALESTATE=[
  {id:'re1',listing_type:'house-sale',title:'4 Bedroom Bungalow — Muyenga Hill',price:450000000,price_type:'total',bedrooms:4,bathrooms:3,size_value:280,size_unit:'sqm',district:'Kampala',area:'Muyenga',contact_name:'Ssali Properties',contact_phone:'0772200001',contact_whatsapp:'0772200001',photos:['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80'],description:'Spacious family bungalow with servant quarters, tiled garden and 2-car garage. All rooms en-suite. Tarmac road access.',amenities:['Garage','Garden','Servant Quarters','Security Wall','Solar','Borehole'],is_verified:true,is_featured:true},
  {id:'re2',listing_type:'house-sale',title:'3 Bedroom Townhouse — Ntinda',price:280000000,price_type:'total',bedrooms:3,bathrooms:2,size_value:160,size_unit:'sqm',district:'Kampala',area:'Ntinda',contact_name:'Nakato Real Estate',contact_phone:'0752200002',contact_whatsapp:'0752200002',photos:['https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=400&q=80'],description:'Modern townhouse in gated community. Good road access, close to schools and shopping centres. Ready for occupancy.',amenities:['Parking','Perimeter Wall','DSTV','Backup Generator'],is_verified:true},
  {id:'re3',listing_type:'house-sale',title:'5 Bedroom Mansion — Kololo',price:1200000000,price_type:'total',bedrooms:5,bathrooms:5,size_value:550,size_unit:'sqm',district:'Kampala',area:'Kololo',contact_name:'Prime Estates Uganda',contact_phone:'0782200003',contact_whatsapp:'0782200003',photos:['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=400&q=80'],description:'Luxury residence with swimming pool, gym, home cinema and panoramic city views. High-security neighbourhood.',amenities:['Swimming Pool','Gym','Home Cinema','4-Car Garage','Smart Home','CCTV'],is_verified:true,is_featured:true},
  {id:'re4',listing_type:'house-rent',title:'2 Bedroom Apartment — Bukoto',price:1200000,price_type:'per_month',bedrooms:2,bathrooms:1,size_value:85,size_unit:'sqm',district:'Kampala',area:'Bukoto',contact_name:'Mugisha Rentals',contact_phone:'0702200004',contact_whatsapp:'0702200004',photos:['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80'],description:'Modern 2-bedroom apartment with backup power, water storage and parking. Quiet compound, near main road.',amenities:['Parking','Backup Power','Water Storage','Security Guard'],is_verified:true},
  {id:'re5',listing_type:'house-rent',title:'3 Bedroom House — Najjera',price:800000,price_type:'per_month',bedrooms:3,bathrooms:2,size_value:120,size_unit:'sqm',district:'Wakiso',area:'Najjera',contact_name:'Namukasa Properties',contact_phone:'0772200005',contact_whatsapp:'0772200005',photos:['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80'],description:'Self-contained 3-bedroom home with garden, parking and borehole. In a quiet residential area, tarmac road.',amenities:['Garden','Parking','Borehole','Perimeter Wall'],is_verified:false},
  {id:'re6',listing_type:'house-rent',title:'1 Bedroom Self-Contained — Kawempe',price:400000,price_type:'per_month',bedrooms:1,bathrooms:1,size_value:45,size_unit:'sqm',district:'Kampala',area:'Kawempe',contact_name:'Kato Agency',contact_phone:'0752200006',contact_whatsapp:'0752200006',photos:['https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=400&q=80'],description:'Neat self-contained unit, tiled floors, indoor toilet and shower, compound parking available.',amenities:['Parking','Tiled Floors','Water Meter'],is_verified:true},
  {id:'re7',listing_type:'land-sale',title:'50×100ft Residential Plot — Kira',price:95000000,price_type:'total',size_value:465,size_unit:'sqm',district:'Wakiso',area:'Kira',contact_name:'Lubega Land Brokers',contact_phone:'0782200007',contact_whatsapp:'0782200007',photos:['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80'],description:'Ready-to-build freehold plot with land title. On murram road, water and electricity available nearby.',amenities:['Land Title','Freehold','Ready to Build'],is_verified:true},
  {id:'re8',listing_type:'land-sale',title:'Quarter Acre Commercial Plot — Entebbe Road',price:320000000,price_type:'total',size_value:1012,size_unit:'sqm',district:'Wakiso',area:'Entebbe Road',contact_name:'Capital Land Ltd',contact_phone:'0772200008',contact_whatsapp:'0772200008',photos:['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80'],description:'Strategic commercial plot on Entebbe Road corridor. Mailo land, road frontage, suitable for hotel, flats or commercial centre.',amenities:['Mailo Title','Road Frontage','Commercial Zone'],is_verified:true,is_featured:true},
  {id:'re9',listing_type:'farmland',title:'10 Acres Farm Land — Luwero',price:85000000,price_type:'total',size_value:10,size_unit:'acres',district:'Luwero',area:'Wobulenzi',contact_name:'Ssempijja Farms',contact_phone:'0702200009',contact_whatsapp:'0702200009',photos:['https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=400&q=80'],description:'Fertile red soil farmland currently under maize and banana. Perennial river runs through. Title available. Accessible murram road.',amenities:['Land Title','Perennial Water','Fertile Soil','Road Access'],is_verified:true},
  {id:'re10',listing_type:'farmland',title:'50 Acres Cattle Ranch — Kiruhura',price:420000000,price_type:'total',size_value:50,size_unit:'acres',district:'Kiruhura',area:'Sanga',contact_name:'Tumwesigye Estate',contact_phone:'0752200010',contact_whatsapp:'0752200010',photos:['https://images.unsplash.com/photo-1500076656116-558758965ce3?auto=format&fit=crop&w=400&q=80'],description:'Established cattle ranch in Kiruhura with existing fencing, water troughs, dip tank and staff quarters. Ideal for beef or dairy.',amenities:['Existing Fencing','Dip Tank','Water Troughs','Staff Quarters','Land Title'],is_verified:true,is_featured:true},
  {id:'re11',listing_type:'land-lease',title:'20 Acres for Lease — Masaka (Farming)',price:3000000,price_type:'per_year',size_value:20,size_unit:'acres',district:'Masaka',area:'Kyotera',contact_name:'Kasozi Land',contact_phone:'0782200011',contact_whatsapp:'0782200011',photos:['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80'],description:'Fertile land available for long-term farming lease (5–20 year agreements). Suitable for maize, coffee, vegetables. Good rainfall.',amenities:['Long-Term Lease','Fertile Soil','Good Rainfall','Road Access'],is_verified:true},
  {id:'re12',listing_type:'land-lease',title:'100 Acres Agricultural Lease — Nakasongola',price:8000000,price_type:'per_year',size_value:100,size_unit:'acres',district:'Nakasongola',area:'Nakasongola',contact_name:'Nakalembe Properties',contact_phone:'0702200012',contact_whatsapp:'0702200012',photos:['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&q=80'],description:'Large scale agricultural lease. Suitable for commercial farming of maize, soya, sunflower. Currently unused, savanna terrain.',amenities:['Long-Term Lease','Flat Terrain','Good Soil','Seasonal Water'],is_verified:false},
];

const MOCK_WHOLESALE=[
  {id:'demo-w1',business_name:'Sserunjogi Wholesale Electronics',business_type:'wholesale',district:'Kampala',area:'Kikuubo',street_address:'Kikuubo Lane, Kampala',phone:'0772300001',whatsapp:'0772300001',categories:['Electronics','Phones','Accessories'],min_order_ugx:500000,is_verified:true,description:'Leading electronics wholesaler in Kikuubo. TVs, phones, home appliances. Serving Uganda since 2010.'},
  {id:'demo-w2',business_name:'Namutebi Fabrics & Kitenges',business_type:'wholesale',district:'Kampala',area:'Kikuubo',street_address:'Ben Kiwanuka Street',phone:'0752300002',whatsapp:'0752300002',categories:['Fabrics','Kitenges','Textiles'],min_order_ugx:300000,is_verified:true,description:'Premium kitenges, cotton fabrics and accessories. Best prices in Kampala.'},
  {id:'demo-w3',business_name:'Ssali Hardware Wholesale',business_type:'wholesale',district:'Kampala',area:'Nakasero',street_address:'Nakasero Road',phone:'0782300003',whatsapp:'0782300003',categories:['Hardware','Building Materials','Tools'],min_order_ugx:1000000,is_verified:true,description:'Construction materials, cement, iron sheets, roofing. Nationwide delivery available.'},
  {id:'demo-w4',business_name:'Kampala Grains & Pulses',business_type:'wholesale',district:'Kampala',area:'St Balikuddembe Market',phone:'0702300004',whatsapp:'0702300004',categories:['Maize','Beans','Rice','Cereals'],min_order_ugx:200000,is_verified:false,description:'Bulk maize, beans, rice and cereals. Direct from Northern Uganda farmers.'},
  {id:'demo-w5',business_name:'Jinja Steel Manufacturers',business_type:'manufacturer',district:'Jinja',area:'Walukuba Industrial Area',phone:'0772300005',whatsapp:'0772300005',categories:['Steel','Iron','Metal Products'],min_order_ugx:2000000,is_verified:true,description:'Steel bars, wire mesh, roofing sheets. Factory-direct prices.'},
  {id:'demo-w6',business_name:'Mbarara Dairy Wholesale',business_type:'wholesale',district:'Mbarara',area:'Industrial Area',phone:'0752300006',whatsapp:'0752300006',categories:['Dairy','Milk','Cheese','Ghee'],min_order_ugx:500000,is_verified:true,description:'Bulk fresh milk, ghee and cheese from Ankole dairy farms. Daily collection.'},
];

const MOCK_EXPORT=[
  {id:'demo-e1',category_slug:'coffee',product_name:'Uganda Robusta Coffee — Washed',price_per_kg:2.65,price_per_tonne:2650,annual_volume_tonnes:500,min_order_tonnes:5,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'FAQ Screen 15',grade_color:'#f59e0b',grade_desc:'Fair Average Quality · Moisture 12.5% max · 0 primary defects/300g · Screen 15+',certifications:['UCDA Certified','Rainforest Alliance','ISO 9001'],district:'Masaka',seller_name:'Masaka Coffee Cooperative',seller_phone:'+256 702 001 012',lead_time_weeks:4,payment_terms:'30% advance, 70% against Bill of Lading',specs:[{k:'Moisture',v:'≤12.5%'},{k:'Screen',v:'15+'},{k:'Defects',v:'0 primary / 5 secondary'},{k:'Outturn',v:'FOT Kampala'},{k:'Packaging',v:'60kg jute bags'}],photo:'https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=600',description:'Premium washed Uganda Robusta sourced from Masaka region cooperatives. Clean cup, low acidity, full body. Ideal for espresso blends.'},
  {id:'demo-e2',category_slug:'coffee',product_name:'Bugisu AA Arabica Coffee',price_per_kg:6.20,price_per_tonne:6200,annual_volume_tonnes:200,min_order_tonnes:2,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'AA Screen 18 Specialty',grade_color:'#a855f7',grade_desc:'Screen 18+ · Specialty Grade 80+ SCA score · Single origin Mt Elgon · Cupping: Floral, Citrus, Dark Chocolate',certifications:['UCDA Certified','Cup of Excellence','UTZ','Fair Trade'],district:'Mbale',seller_name:'Bugisu Cooperative Union',seller_phone:'+256 782 001 022',lead_time_weeks:4,payment_terms:'LC at sight or 50% TT advance',specs:[{k:'SCA Score',v:'80–86 pts'},{k:'Screen',v:'18+'},{k:'Moisture',v:'≤11%'},{k:'Altitude',v:'1,600–2,200m'},{k:'Process',v:'Washed & Natural'}],photo:'https://images.pexels.com/photos/942808/pexels-photo-942808.jpeg?auto=compress&cs=tinysrgb&w=600',description:'Single-origin Arabica from Mt Elgon slopes. Award-winning cup profile — floral, citrus notes with dark chocolate finish. Specialty roaster favourite.'},
  {id:'demo-e3',category_slug:'vanilla',product_name:'Uganda Vanilla Grade A Beans',price_per_kg:175,price_per_tonne:175000,annual_volume_tonnes:10,min_order_tonnes:0.05,currency:'USD',pricing_basis:'FOB',port:'Entebbe',grade:'Grade A Gourmet',grade_color:'#10b981',grade_desc:'Length 15–20cm · Moisture 25–35% · Vanillin content 1.6%+ · Hand-cured, sun-dried · No mold, no splits',certifications:['UNBS Certified','USDA Organic','EU Organic','Rainforest Alliance'],district:'Mbarara',seller_name:'Mbarara Vanilla Estate',seller_phone:'+256 772 001 013',lead_time_weeks:2,payment_terms:'100% advance for new buyers · 30% deposit repeat buyers',specs:[{k:'Length',v:'15–20cm'},{k:'Vanillin',v:'≥1.6%'},{k:'Moisture',v:'25–35%'},{k:'Color',v:'Dark brown–black'},{k:'Packaging',v:'Vacuum sealed, 100g bundles'}],photo:'https://images.pexels.com/photos/4963318/pexels-photo-4963318.jpeg?auto=compress&cs=tinysrgb&w=600',description:'Prized Uganda vanilla — among the world\'s finest. Hand-cured for 6 months. Rich, creamy flavour profile. Supplied to EU & US gourmet food manufacturers.'},
  {id:'demo-e4',category_slug:'simsim',product_name:'White Sesame (Simsim) Hulled',price_per_kg:1.52,price_per_tonne:1520,annual_volume_tonnes:1000,min_order_tonnes:20,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'99.98% Purity',grade_color:'#f59e0b',grade_desc:'99.98% purity · Moisture ≤0.10% · FFA ≤1.0% · Machine cleaned · No foreign matter',certifications:['SGS Tested','UNBS Certified','HACCP'],district:'Gulu',seller_name:'Gulu Simsim Exporters Ltd',seller_phone:'+256 702 033 001',lead_time_weeks:6,payment_terms:'LC at sight or 30% advance, balance on shipment',specs:[{k:'Purity',v:'99.98%+'},{k:'Moisture',v:'≤0.10%'},{k:'FFA',v:'≤1.0%'},{k:'Oil Content',v:'48–52%'},{k:'Packaging',v:'25kg PP bags or bulk'}],photo:'https://images.pexels.com/photos/5755536/pexels-photo-5755536.jpeg?auto=compress&cs=tinysrgb&w=600',description:'Machine-cleaned hulled white sesame from Northern Uganda. Uniform cream-white colour, high oil content. Popular in Middle East, Asia and EU food markets.'},
  {id:'demo-e5',category_slug:'cocoa',product_name:'Uganda Cocoa Beans — Organic',price_per_kg:9.40,price_per_tonne:9400,annual_volume_tonnes:80,min_order_tonnes:1,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'Grade 1 Fermented',grade_color:'#92400e',grade_desc:'Grade 1 · Fermentation 6–7 days · Defects <5% · Moisture ≤7.5% · ICCO/Uganda standard',certifications:['UCCA Certified','EU Organic','Fairtrade','Rainforest Alliance'],district:'Bundibugyo',seller_name:'Bundibugyo Cocoa Cooperative',seller_phone:'+256 782 044 001',lead_time_weeks:5,payment_terms:'LC at sight or 40% advance, 60% on BL',specs:[{k:'Fermentation',v:'6–7 days'},{k:'Moisture',v:'≤7.5%'},{k:'Defects',v:'<5%'},{k:'Bean Count',v:'85–100/100g'},{k:'Packaging',v:'60kg jute bags'}],photo:'https://images.pexels.com/photos/4157754/pexels-photo-4157754.jpeg?auto=compress&cs=tinysrgb&w=600',description:'Fully fermented organic cocoa from Bundibugyo — Uganda\'s premier cocoa belt. Complex fruity-earthy profile. Increasingly sought by European craft chocolate makers.'},
  {id:'demo-e6',category_slug:'fresh-fish',product_name:'Nile Perch Fillets — IQF Frozen',price_per_kg:4.35,price_per_tonne:4350,annual_volume_tonnes:300,min_order_tonnes:5,currency:'USD',pricing_basis:'FOB',port:'Entebbe',grade:'EU Grade A',grade_color:'#0ea5e9',grade_desc:'EU Grade A · Skin-off boneless · IQF frozen · Glaze ≤20% · No bones · EU/USFDA compliant',certifications:['UFIA Licensed','EU Approved','HACCP','USFDA Registered'],district:'Jinja',seller_name:'Lake Victoria Fish Processors',seller_phone:'+256 752 055 001',lead_time_weeks:2,payment_terms:'LC at sight or TT 30 days for approved buyers',specs:[{k:'Process',v:'Skin-off, boneless IQF'},{k:'Glaze',v:'≤20%'},{k:'Net Weight',v:'10kg/carton'},{k:'Temp',v:'-18°C or below'},{k:'Shelf Life',v:'24 months frozen'}],photo:'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Lates_niloticus.jpg/800px-Lates_niloticus.jpg',description:'Premium IQF Nile Perch from Lake Victoria. EU-approved processing plants. Consistent quality, year-round supply. Largest freshwater fish export from Uganda.'},
  {id:'demo-e7',category_slug:'tea',product_name:'Uganda CTC Black Tea — BOP',price_per_kg:2.90,price_per_tonne:2900,annual_volume_tonnes:400,min_order_tonnes:10,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'BOP (Broken Orange Pekoe)',grade_color:'#dc2626',grade_desc:'BOP Grade · Bright red-amber liquor · Brisk, full body · Theaflavin ≥1.4% · Moisture ≤6%',certifications:['UGTB Certified','Rainforest Alliance','ISO 22000'],district:'Kanungu',seller_name:'Kigezi Tea Estates',seller_phone:'+256 702 066 001',lead_time_weeks:3,payment_terms:'LC at sight or 30-day credit for established buyers',specs:[{k:'Grade',v:'BOP / BOPF / Dust'},{k:'Moisture',v:'≤6%'},{k:'Theaflavin',v:'≥1.4%'},{k:'Liquor',v:'Bright, brisk'},{k:'Packaging',v:'50kg plywood chests'}],photo:'https://upload.wikimedia.org/wikipedia/commons/c/cc/Assam_black_tea.jpg',description:'High-grown Ugandan CTC black tea from Kigezi highlands. Bright, brisk liquor with full body. Blends well. Sold at Mombasa Tea Auction under Uganda origins.'},
  {id:'demo-e8',category_slug:'groundnuts',product_name:'Groundnuts — Blanched & Sorted',price_per_kg:1.28,price_per_tonne:1280,annual_volume_tonnes:600,min_order_tonnes:10,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'Fancy Blanched',grade_color:'#f59e0b',grade_desc:'Fancy grade · Blanched skinless · Size 38/42 (per oz) · Aflatoxin <4ppb · Moisture ≤8%',certifications:['UNBS Certified','SGS Tested','HACCP'],district:'Gulu',seller_name:'Northern Uganda Groundnut Exporters',seller_phone:'+256 772 077 001',lead_time_weeks:5,payment_terms:'30% advance, 70% against shipping documents',specs:[{k:'Grade',v:'Fancy Blanched'},{k:'Size',v:'38/42 ct/oz'},{k:'Moisture',v:'≤8%'},{k:'Aflatoxin',v:'<4ppb (EU standard)'},{k:'Packaging',v:'25kg vacuum PP bags'}],photo:'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Peanuts_%28Arachis_hypogaea%29_-_in_shell%2C_shell_cracked_open%2C_shelled%2C_peeled.jpg/800px-Peanuts_%28Arachis_hypogaea%29_-_in_shell%2C_shell_cracked_open%2C_shelled%2C_peeled.jpg',description:'Premium blanched groundnuts from Northern Uganda. Aflatoxin-tested below EU limits. Ideal for confectionery, peanut butter and snack food manufacturers.'},
  {id:'demo-e9',category_slug:'herbs-spices',product_name:'Dried Red Chili — Cayenne',price_per_kg:2.95,price_per_tonne:2950,annual_volume_tonnes:50,min_order_tonnes:1,currency:'USD',pricing_basis:'FOB',port:'Mombasa',grade:'Grade 1 Dried',grade_color:'#dc2626',grade_desc:'Grade 1 · Scoville 40,000–50,000 HU · Moisture ≤12% · No mold · Uniform red colour',certifications:['UNBS Certified','SGS Tested'],district:'Arua',seller_name:'Arua Spice Traders Ltd',seller_phone:'+256 752 088 001',lead_time_weeks:3,payment_terms:'50% advance, 50% on shipment',specs:[{k:'Scoville',v:'40,000–50,000 HU'},{k:'Moisture',v:'≤12%'},{k:'Colour',v:'Uniform bright red'},{k:'Foreign Matter',v:'≤0.5%'},{k:'Packaging',v:'25kg or 50kg PP bags'}],photo:'https://images.pexels.com/photos/2893882/pexels-photo-2893882.jpeg?auto=compress&cs=tinysrgb&w=600',description:'Sun-dried cayenne chili from West Nile region. Consistent heat level, vibrant colour. Exported to spice processors in India, UAE and Netherlands.'},
];

const MOCK_DIRECTORY=[
  {id:'demo-d1',business_name:'Sserunjogi Wholesale Electronics',business_type:'wholesale',category:'Electronics',district:'Kampala',area:'Kikuubo',street_address:'Kikuubo Lane, Plot 14, Kampala',phone:'0772300001',whatsapp:'0772300001',pin_status:'open',accepts_walkin:true,is_verified:true,rating:4.8,total_reviews:127,lat:0.3163,lng:32.5822,open_hours:'Mon–Sat 8am–7pm · Sun 10am–4pm',emoji:'📱',bg:'linear-gradient(135deg,#0a0a2a,#1a1a4a)',description:'Leading electronics wholesaler in Kikuubo. TVs, phones, home appliances at unbeatable wholesale prices. Bulk orders welcome.',products:[{name:'Samsung Galaxy A54 5G',price:1650000},{name:'Vitron 43" Smart TV',price:890000},{name:'HP Laptop Core i5 8GB',price:1850000},{name:'Hisense Fridge 200L',price:1200000},{name:'LG Washing Machine 7kg',price:1450000}]},
  {id:'demo-d2',business_name:'Namutebi Fabrics & Kitenges',business_type:'wholesale',category:'Fabrics & Textiles',district:'Kampala',area:'Kikuubo',street_address:'Ben Kiwanuka Street, Kampala',phone:'0752300002',whatsapp:'0752300002',pin_status:'open',accepts_walkin:true,is_verified:true,rating:4.6,total_reviews:89,lat:0.3156,lng:32.5815,open_hours:'Mon–Sat 8am–6pm',emoji:'👗',bg:'linear-gradient(135deg,#2d0a3a,#4a1a5a)',description:'Premium kitenges, cotton fabrics and accessories. Wholesale and retail. New arrivals from DRC and China every week.',products:[{name:'Kitenge 6 yards',price:85000},{name:'Cotton Fabric (yard)',price:18000},{name:'Ankara Print 6yd',price:95000},{name:'Lace Fabric (yard)',price:45000},{name:'School Uniform Fabric',price:12000}]},
  {id:'demo-d3',business_name:'Ssali Hardware & Building',business_type:'wholesale',category:'Hardware & Construction',district:'Kampala',area:'Nakasero',street_address:'Nakasero Road, Kampala',phone:'0782300003',whatsapp:'0782300003',pin_status:'open',accepts_walkin:true,is_verified:true,rating:4.5,total_reviews:203,lat:0.3289,lng:32.5734,open_hours:'Mon–Sat 7:30am–6pm',emoji:'🔧',bg:'linear-gradient(135deg,#1a1a00,#3a3a00)',description:'Construction materials, hardware and tools. Iron sheets, cement, PVC pipes, paints. Delivery available countrywide.',products:[{name:'Iron Sheet gauge 28',price:38000},{name:'Cement 50kg bag',price:28000},{name:'PVC Pipe 4" (6m)',price:45000},{name:'Dulux Paint 20L',price:185000},{name:'Rebar 12mm',price:32000}]},
  {id:'demo-d4',business_name:'Kampala City Pharmacy',business_type:'service',category:'Pharmacy',district:'Kampala',area:'Wandegeya',street_address:'Wandegeya Market Road, Kampala',phone:'0772400001',whatsapp:'0772400001',pin_status:'open',accepts_walkin:true,is_verified:true,rating:4.7,total_reviews:312,lat:0.3421,lng:32.5712,open_hours:'Mon–Sun 7am–10pm',emoji:'💊',bg:'linear-gradient(135deg,#003a00,#005500)',description:'Licensed pharmacy. Prescription and OTC medicines. Health checks available. Qualified pharmacists on duty 24/7.',products:[{name:'Paracetamol 500mg x100',price:8000},{name:'Amoxicillin 500mg x21',price:25000},{name:'Artemether/Lumefantrine',price:18000},{name:'Blood Pressure Monitor',price:95000},{name:'Pregnancy Test Kit',price:5000}]},
  {id:'demo-d5',business_name:'Mbarara Fresh Market',business_type:'retail',category:'Food & Groceries',district:'Mbarara',area:'Mbarara Town Centre',street_address:'High Street, Mbarara',phone:'0752400002',whatsapp:'0752400002',pin_status:'open',accepts_walkin:true,is_verified:false,rating:4.3,total_reviews:67,lat:-0.6072,lng:30.6545,open_hours:'Mon–Sun 6am–8pm',emoji:'🛒',bg:'linear-gradient(135deg,#0a2a0a,#1a4a1a)',description:'Fresh produce, dairy and meat products daily. Supplied by local farmers. Competitive prices every day.',products:[{name:'Matooke (bunch)',price:25000},{name:'Fresh Milk (litre)',price:3500},{name:'Beef (kg)',price:14000},{name:'Tomatoes (tray)',price:8000},{name:'Eggs (tray of 30)',price:12500}]},
  {id:'demo-d6',business_name:'Gulu Hardware & Paints',business_type:'retail',category:'Hardware',district:'Gulu',area:'Gulu Town Centre',street_address:'Awere Road, Gulu',phone:'0782400003',whatsapp:'0782400003',pin_status:'open',accepts_walkin:true,is_verified:false,rating:4.1,total_reviews:45,lat:2.7747,lng:32.2990,open_hours:'Mon–Sat 8am–6pm',emoji:'🏗️',bg:'linear-gradient(135deg,#1a1000,#3a2000)',description:'Hardware, paints, plumbing and electrical supplies. Serving Gulu and all of northern Uganda.',products:[{name:'Roof Paint 20L',price:165000},{name:'PVC Elbow 2"',price:3500},{name:'Wire 2.5mm (100m)',price:85000},{name:'Burglar Door Lock',price:45000},{name:'Cement 50kg',price:32000}]},
  {id:'demo-d7',business_name:'Jinja Steel & Metal Works',business_type:'manufacturer',category:'Steel & Metal',district:'Jinja',area:'Walukuba Industrial',street_address:'Walukuba Industrial Area, Jinja',phone:'0772500001',whatsapp:'0772500001',pin_status:'open',accepts_walkin:false,is_verified:true,rating:4.9,total_reviews:56,lat:0.4244,lng:33.2042,open_hours:'Mon–Fri 8am–5pm · Sat 8am–1pm',emoji:'🏭',bg:'linear-gradient(135deg,#1a1a1a,#2a2a2a)',description:'Steel bars, wire mesh, gates, window grills. Custom fabrication orders welcome. Factory-direct pricing.',products:[{name:'Steel Bar 12mm (12m)',price:95000},{name:'Wire Mesh 6×6 sheet',price:145000},{name:'Custom Gate',price:850000},{name:'Window Grill per m²',price:120000},{name:'Roofing Sheet per metre',price:38000}]},
  {id:'demo-d8',business_name:'Mama Agnes Restaurant',business_type:'restaurant',category:'Restaurant & Food',district:'Kampala',area:'Kabalagala',street_address:'Kabalagala Road, Kampala',phone:'0702500002',whatsapp:'0702500002',pin_status:'open',accepts_walkin:true,is_verified:true,rating:4.6,total_reviews:445,lat:0.2887,lng:32.5994,open_hours:'Mon–Sun 7am–9pm',emoji:'🍽️',bg:'linear-gradient(135deg,#2a0000,#4a0000)',description:'Authentic Ugandan cuisine. Matoke, beans, matooke, posho, chicken, beef stew. Best rolex in Kampala!',products:[{name:'Matoke + Beans',price:6000},{name:'Chicken + Rice',price:15000},{name:'Rolex (2 eggs)',price:4000},{name:'Fresh Fish + Posho',price:12000},{name:'Full Breakfast',price:8000}]},
];

const SHOP_SECTIONS=[];

function toast(msg){
  const el=document.createElement('div');
  el.textContent=msg;
  Object.assign(el.style,{position:'fixed',bottom:'20px',right:'20px',background:NAVY2,
    color:WHITE,borderRadius:'6px',padding:'12px 18px',fontSize:'14px',fontWeight:'600',
    zIndex:'9999',fontFamily:SF,boxShadow:'0 4px 16px rgba(0,0,0,.4)',
    border:`1px solid ${YELLOW}`});
  document.body.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .3s';el.style.opacity='0';setTimeout(()=>el.remove(),300)},2500);
}

function useCart(){
  const [items,setItems]=useState([]);
  const [sessionId]=useState(()=>{
    let id=localStorage.getItem('256mall_session');
    if(!id){id='sess_'+Date.now()+'_'+Math.random().toString(36).slice(2);localStorage.setItem('256mall_session',id);}
    return id;
  });
  const load=async()=>{try{const r=await fetch(`/api/cart/${sessionId}`);const d=await r.json();if(d.success)setItems(d.items);}catch(e){}};
  useEffect(()=>{load();},[]);
  const add=async(pid,qty=1)=>{
    if(pid?.startsWith('demo-')||pid?.startsWith('sg-')){toast('That\'s a preview item — browse real listings to buy →');return false;}
    try{
      const r=await fetch('/api/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,productId:pid,quantity:qty})});
      if(!r.ok){toast('Could not add to cart — please try again');return false;}
      load();toast('Added to cart ✓');return true;
    }catch(e){toast('Could not add to cart — please try again');return false;}
  };
  const remove=async(pid)=>{try{await fetch(`/api/cart/${sessionId}/${pid}`,{method:'DELETE'});load();}catch(e){}};
  const updateQty=async(pid,qty)=>{try{await fetch('/api/cart/quantity',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,productId:pid,quantity:qty})});load();}catch(e){}};
  return{items,add,remove,updateQty,sessionId,count:items.reduce((s,i)=>s+i.quantity,0)};
}

function useAuth(){
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('256mall_user')||'null');}catch(e){return null;}});
  const logout=()=>{localStorage.removeItem('256mall_token');localStorage.removeItem('256mall_user');setUser(null);};
  return{user,setUser,logout};
}

// ── Product Card (Amazon white style) ────────────────────────────────────────
function PCard({p,onAdd}){
  const nav=useNavigate();
  const {openChat}=useChat()||{};
  const [imgErr,setImgErr]=useState(false);
  const disc=p.original_price?Math.round((1-p.price/p.original_price)*100):0;
  const stars=Math.min(5,Math.round(p.rating||0));
  const handleClick=()=>p.id?.startsWith('demo-')?nav('/products'):nav(`/product/${p.id}`);

  const IMGS={
    'electronics':'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=300&fit=crop',
    'computers':'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop',
    'smart-home':'https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=300&h=300&fit=crop',
    'womens-fashion':'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop',
    'mens-fashion':'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=300&h=300&fit=crop',
    'african-fashion':'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=300&h=300&fit=crop',
    'girls-fashion':'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=300&h=300&fit=crop',
    'boys-fashion':'https://images.unsplash.com/photo-1519238359922-989b5675a267?w=300&h=300&fit=crop',
    'beauty':'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300&h=300&fit=crop',
    'home-kitchen':'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=300&fit=crop',
    'sports':'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=300&h=300&fit=crop',
    'baby-kids':'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&h=300&fit=crop',
    'automotive':'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=300&h=300&fit=crop',
    'toys-games':'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=300&h=300&fit=crop',
    'video-games':'https://images.unsplash.com/photo-1593118247619-e2d6f056869e?w=300&h=300&fit=crop',
    'health':'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=300&fit=crop',
    'luggage':'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop',
    'tools':'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=300&h=300&fit=crop',
    'pets':'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=300&fit=crop',
    'agriculture':'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=300&h=300&fit=crop',
    'fresh-produce':'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=300&h=300&fit=crop',
    'coffee':'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=300&h=300&fit=crop',
    'industrial':'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=300&h=300&fit=crop',
    'movies-tv':'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=300&fit=crop',
    'arts-crafts':'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?w=300&h=300&fit=crop',
    'matooke':'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop',
  };

  const getFallbackImg=()=>{
    const cat=p.category_slug||p.category||'';
    const nm=(p.name||'').toLowerCase();
    if(IMGS[cat])return IMGS[cat];
    if(nm.includes('phone')||nm.includes('samsung')||nm.includes('itel')||nm.includes('techno')||nm.includes('infinix'))return IMGS['electronics'];
    if(nm.includes('laptop')||nm.includes('computer')||nm.includes(' hp ')||nm.includes('dell')||nm.includes('lenovo'))return IMGS['computers'];
    if(nm.includes('smart tv')||nm.includes('vitron')||nm.includes('hisense')||nm.includes('television'))return IMGS['smart-home'];
    if(nm.includes('dress')||nm.includes('kitenge')||nm.includes('blouse')||nm.includes('ankara')||nm.includes('skirt'))return IMGS['womens-fashion'];
    if(nm.includes('suit')||nm.includes('kanzu')||nm.includes("men's shirt"))return IMGS['mens-fashion'];
    if(nm.includes('beauty')||nm.includes('lotion')||nm.includes('cream')||nm.includes('shampoo')||nm.includes('perfume'))return IMGS['beauty'];
    if(nm.includes('matooke')||nm.includes('banana'))return IMGS['matooke'];
    if(nm.includes('coffee')||nm.includes('arabica'))return IMGS['coffee'];
    if(nm.includes('fridge')||nm.includes('cooker')||nm.includes('microwave')||nm.includes('oven'))return IMGS['home-kitchen'];
    if(nm.includes('football')||nm.includes('soccer')||nm.includes('jersey')||nm.includes('racket'))return IMGS['sports'];
    if(nm.includes('toy')||nm.includes('lego'))return IMGS['toys-games'];
    if(nm.includes('playstation')||nm.includes('xbox')||nm.includes('console'))return IMGS['video-games'];
    if(nm.includes('baby')||nm.includes('infant')||nm.includes('diaper'))return IMGS['baby-kids'];
    if(nm.includes('tyre')||nm.includes('car part')||nm.includes('auto'))return IMGS['automotive'];
    if(nm.includes('craft')||nm.includes('basket')||nm.includes('bead'))return IMGS['arts-crafts'];
    if(nm.includes('drill')||nm.includes('hammer')||nm.includes('wrench'))return IMGS['tools'];
    return 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=300&h=300&fit=crop';
  };

  const imgSrc=(!imgErr&&p.primary_image)?p.primary_image:getFallbackImg();

  return(
    <div onClick={handleClick}
      style={{background:WHITE,border:'2px solid #000',borderRadius:6,overflow:'hidden',
        cursor:'pointer',flex:'0 0 calc((100% - 48px)/5)',width:'auto',minWidth:0,fontFamily:BL,transition:'box-shadow .2s,transform .2s',
        boxShadow:'0 2px 8px rgba(0,0,0,.08)'}}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,.18)';e.currentTarget.style.transform='translateY(-2px)';}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.08)';e.currentTarget.style.transform='none';}}>
      <div style={{height:3,background:GOLD_STRIP}}/>
      <div style={{aspectRatio:'1/1',background:'#F7F8F8',overflow:'hidden',position:'relative'}}>
        <img src={imgSrc} alt={p.name} onError={()=>setImgErr(true)}
          style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .3s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
        {disc>0&&<span style={{position:'absolute',top:0,left:0,background:MG_RED,color:WHITE,fontSize:11,fontWeight:700,padding:'3px 8px',fontFamily:BLC,letterSpacing:.5}}>-{disc}%</span>}
        {p.is_uganda_made&&<span style={{position:'absolute',bottom:4,left:0,background:GOLD,color:'#000',fontSize:10,fontWeight:700,padding:'3px 8px',fontFamily:BLC,letterSpacing:.3}}>🇺🇬 UG Made</span>}
        {p.is_flash_sale&&<span style={{position:'absolute',top:0,right:0,background:MG_BLACK,color:'#FFD700',fontSize:10,fontWeight:700,padding:'3px 8px',fontFamily:BLC,letterSpacing:.3}}>⚡ FLASH</span>}
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:2,background:GOLD_STRIP}}/>
      </div>
      <div style={{padding:'10px 11px 13px'}}>
        {p.seller_name&&<div style={{fontSize:11,color:MUTED,marginBottom:2,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',fontFamily:BLC}}>{p.seller_name}</div>}
        <div style={{fontSize:13,color:'#111',lineHeight:1.4,minHeight:36,marginBottom:6,fontWeight:600,
          display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
          {p.name}
        </div>
        {stars>0&&<div style={{color:'#B8860B',fontSize:12,marginBottom:5}}>
          {'★'.repeat(stars)}{'☆'.repeat(5-stars)}
          {p.total_reviews>0&&<span style={{color:MUTED,fontSize:11,marginLeft:3}}>({p.total_reviews})</span>}
        </div>}
        <div style={{marginBottom:2}}>
          <span style={{display:'inline-block',background:MG_GOLD,color:'#1A0F00',fontFamily:BLC,
            fontSize:14,fontWeight:700,padding:'3px 9px',borderRadius:4,border:'1px solid #8B6E00',letterSpacing:.3}}>
            UGX {Number(p.price).toLocaleString()}
          </span>
        </div>
        {p.original_price&&<div style={{fontSize:11,color:MUTED,textDecoration:'line-through',marginBottom:2}}>UGX {Number(p.original_price).toLocaleString()}</div>}
        {disc>0&&<div style={{fontSize:11,color:'#007600',marginBottom:3,fontFamily:BLC,letterSpacing:.3}}>Save UGX {Number(p.original_price-p.price).toLocaleString()}</div>}
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
          {(()=>{
            const opts=Array.isArray(p.delivery_options)&&p.delivery_options.length>0
              ?p.delivery_options
              :['delivery'];
            const MAP={walkin:{icon:'🚶',label:'Walk-in',bg:'#eff6ff',color:'#1d4ed8'},
                       pickup:{icon:'🏪',label:'Pickup',bg:'#eff6ff',color:'#1d4ed8'},
                       delivery:{icon:'🛵',label:'Local Delivery',bg:'#f0fdf4',color:'#15803d'},
                       nationwide:{icon:'🚚',label:'Nationwide',bg:'#fff7ed',color:'#c2410c'}};
            return opts.map(o=>{const m=MAP[o]||{icon:'📦',label:o,bg:'#f3f4f6',color:'#374151'};
              return <span key={o} style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:8,background:m.bg,color:m.color,border:`1px solid ${m.color}30`,whiteSpace:'nowrap'}}>{m.icon} {m.label}</span>;
            });
          })()}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
          <button onClick={e=>{e.stopPropagation();onAdd(p.id);}}
            style={{background:'#fff',color:'#000',border:'2px solid #000',
              borderRadius:4,padding:'7px 4px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:BLC,letterSpacing:.4,transition:'opacity .15s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            ADD TO CART
          </button>
          <button onClick={async e=>{e.stopPropagation();if(await onAdd(p.id))nav('/checkout');}}
            style={{background:MG_GOLD,color:'#1A0F00',border:'none',
              borderRadius:4,padding:'7px 4px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:BLC,letterSpacing:.4,transition:'opacity .15s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            BUY NOW
          </button>
        </div>
        <button onClick={e=>{e.stopPropagation();openChat&&openChat({type:'product',id:p.id,name:p.name,seller_id:p.seller_id,seller_name:p.seller_name,seller_phone:p.seller_phone||p.seller_whatsapp});}}
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%',background:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:4,padding:'6px 4px',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:BLC,letterSpacing:.3}}>
          💬 CHAT WITH SELLER
        </button>
      </div>
    </div>
  );
}

// ── Grid Product Card (fills grid cell, square image) ─────────────────────────
function GPCard({p,cart}){
  const nav=useNavigate();
  const [imgErr,setImgErr]=useState(false);
  const disc=p.original_price?Math.round((1-p.price/p.original_price)*100):0;
  const stars=Math.min(5,Math.round(p.rating||0));
  const isNew=!p.is_uganda_made&&!p.is_flash_sale&&disc===0;
  const imgSrc=(!imgErr&&p.primary_image)?p.primary_image:'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=400&fit=crop';
  const goToPage=()=>p.id?.startsWith('sg-')?nav('/products'):nav(`/product/${p.id}`);
  return(
    <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,overflow:'hidden',fontFamily:SF,
      transition:'box-shadow .2s',display:'flex',flexDirection:'column'}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.18)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      {/* Square image via padding trick */}
      <div style={{paddingBottom:'100%',position:'relative',background:'#F7F8F8',cursor:'pointer',overflow:'hidden'}}
        onClick={goToPage}>
        <img src={imgSrc} alt={p.name} onError={()=>setImgErr(true)}
          style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover',transition:'transform .35s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.07)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
        {disc>0&&<span style={{position:'absolute',top:0,left:0,background:RED2,color:WHITE,fontSize:11,fontWeight:700,padding:'4px 9px'}}>-{disc}%</span>}
        {p.is_uganda_made&&<span style={{position:'absolute',bottom:0,left:0,background:GOLD,color:'#000',fontSize:10,fontWeight:700,padding:'3px 8px'}}>🇺🇬 UG Made</span>}
        {p.is_flash_sale&&<span style={{position:'absolute',top:0,right:0,background:'#7c3aed',color:WHITE,fontSize:10,fontWeight:700,padding:'4px 8px'}}>⚡ Flash</span>}
        {isNew&&<span style={{position:'absolute',top:0,left:0,background:'#16a34a',color:WHITE,fontSize:10,fontWeight:700,padding:'4px 9px'}}>NEW</span>}
      </div>
      {/* Info */}
      <div style={{padding:'10px 12px 6px',flex:1,cursor:'pointer'}} onClick={goToPage}>
        {p.seller_name&&<div style={{fontSize:11,color:MUTED,marginBottom:2,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{p.seller_name}</div>}
        <div style={{fontSize:13,color:TEXT,lineHeight:1.4,minHeight:36,marginBottom:4,
          display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{p.name}</div>
        {stars>0&&<div style={{color:'#C45500',fontSize:12,marginBottom:3}}>
          {'★'.repeat(stars)}{'☆'.repeat(5-stars)}
          {p.total_reviews>0&&<span style={{color:MUTED,fontSize:11,marginLeft:3}}>({p.total_reviews})</span>}
        </div>}
        <div style={{marginBottom:2}}>
          <span style={{fontSize:15,fontWeight:700,color:RED}}>UGX {Number(p.price).toLocaleString()}</span>
          {p.original_price&&<span style={{fontSize:11,color:MUTED,textDecoration:'line-through',marginLeft:6}}>UGX {Number(p.original_price).toLocaleString()}</span>}
        </div>
        {disc>0&&<div style={{fontSize:11,color:GREEN,marginBottom:2}}>Save UGX {Number(p.original_price-p.price).toLocaleString()}</div>}
        <div style={{fontSize:11,color:'#007185',marginBottom:6}}>🚚 FREE Delivery eligible</div>
      </div>
      {/* Buttons */}
      <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:6}}>
        <button onClick={e=>{e.stopPropagation();cart.add(p.id);}}
          style={{width:'100%',background:YELLOW,color:TEXT,border:'1px solid #FCD200',borderRadius:20,
            padding:'7px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:DM}}
          onMouseEnter={e=>e.currentTarget.style.background='#F7CA00'}
          onMouseLeave={e=>e.currentTarget.style.background=YELLOW}>Add to cart</button>
        <button onClick={async e=>{e.stopPropagation();if(await cart.add(p.id))nav('/checkout');}}
          style={{width:'100%',background:'#FFA41C',color:TEXT,border:'1px solid #FA8900',borderRadius:20,
            padding:'7px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:DM}}
          onMouseEnter={e=>e.currentTarget.style.background='#FA8900'}
          onMouseLeave={e=>e.currentTarget.style.background='#FFA41C'}>Buy now</button>
      </div>
    </div>
  );
}

// ── Shop Grid Section (Amazon-style 5-col product grid) ───────────────────────
function ShopGrid({title,emoji,seeAll,products,cart}){
  const nav=useNavigate();
  return(
    <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:4,padding:'18px 20px 22px',marginBottom:8,fontFamily:DM}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <h2 style={{fontSize:20,fontWeight:700,color:TEXT,margin:0}}>{emoji} {title}</h2>
        <span onClick={()=>nav(seeAll)} style={{fontSize:13,color:LINK,cursor:'pointer',whiteSpace:'nowrap',fontWeight:500}}>See all →</span>
      </div>
      <div className="shop-grid-row" style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
        {products.map(p=><GPCard key={p.id} p={p} cart={cart}/>)}
      </div>
    </div>
  );
}

function EmptyProductRow({message='No live products in this section yet.',action='View product listings',path='/products'}){
  const nav=useNavigate();
  return(
    <div style={{flex:'1 0 100%',background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:'24px 18px',textAlign:'center',color:MUTED,fontFamily:DM}}>
      <div style={{fontSize:14,marginBottom:12}}>{message}</div>
      <button onClick={()=>nav(path)} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
        {action} →
      </button>
    </div>
  );
}

const MEGA_CATS=[
  {name:'Fresh Market',icon:'🥬',path:'/produce',groups:[
    {name:'Fruits',items:[{n:'Bananas (Matooke)',s:'produce'},{n:'Avocados',s:'produce'},{n:'Mangoes',s:'produce'},{n:'Pineapples',s:'produce'},{n:'Pawpaw',s:'produce'}]},
    {name:'Vegetables',items:[{n:'Tomatoes',s:'produce'},{n:'Onions',s:'produce'},{n:'Cabbage',s:'produce'},{n:'Dodo (Greens)',s:'produce'},{n:'Sukuma Wiki',s:'produce'},{n:'Peppers',s:'produce'},{n:'Eggplant',s:'produce'}]},
    {name:'Meat',items:[{n:'Beef',s:'produce'},{n:'Goat (Chevon)',s:'produce'},{n:'Pork',s:'produce'},{n:'Chicken (Local & Broilers)',s:'produce'}]},
    {name:'Fish',items:[{n:'Tilapia',s:'produce'},{n:'Nile Perch',s:'produce'},{n:'Mukene (Silverfish)',s:'produce'}]},
    {name:'Grains & Cereals',items:[{n:'Maize',s:'produce'},{n:'Rice',s:'produce'},{n:'Beans',s:'produce'},{n:'Millet',s:'produce'},{n:'Sorghum',s:'produce'}]},
    {name:'Dairy & Eggs',items:[{n:'Fresh Milk',s:'produce'},{n:'Yogurt',s:'produce'},{n:'Eggs',s:'produce'}]},
    {name:'Farm Produce',items:[{n:'Cassava',s:'produce'},{n:'Sweet Potatoes',s:'produce'},{n:'Irish Potatoes',s:'produce'},{n:'Packaged Bulk Produce',s:'produce'}]},
  ]},
  {name:'Animal Market',icon:'🐄',path:'/animals',groups:[
    {name:'Cattle',items:[{n:'Dairy Cows',s:'animals'},{n:'Beef Cattle',s:'animals'},{n:'Ankole Long-horn',s:'animals'}]},
    {name:'Goats & Sheep',items:[{n:'Mubende Goats',s:'animals'},{n:'Sheep',s:'animals'}]},
    {name:'Pigs',items:[{n:'Breeding Pigs',s:'animals'},{n:'Market-ready Pigs',s:'animals'}]},
    {name:'Poultry',items:[{n:'Layers',s:'animals'},{n:'Broilers',s:'animals'},{n:'Local Chicken',s:'animals'},{n:'Ducks',s:'animals'},{n:'Turkeys',s:'animals'}]},
    {name:'Feeds & Vet Supplies',items:[{n:'Poultry Feed',s:'products'},{n:'Dairy Feed',s:'products'},{n:'Vaccines',s:'products'},{n:'Medicines',s:'products'},{n:'Equipment',s:'products'}]},
    {name:'Breeding Services',items:[{n:'Livestock Services',s:'animals'},{n:'AI Services',s:'animals'}]},
  ]},
  {name:'Wholesale',icon:'🏭',path:'/wholesale',groups:[
    {name:'Bulk Food Supplies',items:[{n:'Rice, Sugar & Flour',s:'wholesale'},{n:'Cooking Oil',s:'wholesale'},{n:'Shop Stock',s:'wholesale'},{n:'Packaged Goods',s:'wholesale'}]},
    {name:'Packaging Materials',items:[{n:'Boxes',s:'wholesale'},{n:'Plastic Packaging',s:'wholesale'},{n:'Woven Bags',s:'wholesale'}]},
    {name:'Construction Materials',items:[{n:'Cement',s:'wholesale'},{n:'Steel & Iron',s:'wholesale'},{n:'Roofing Sheets',s:'wholesale'},{n:'Timber',s:'wholesale'}]},
    {name:'Industrial Supplies',items:[{n:'Tools',s:'wholesale'},{n:'Equipment',s:'wholesale'},{n:'Safety Gear',s:'wholesale'}]},
  ]},
  {name:'Export Hub',icon:'✈️',path:'/export',groups:[
    {name:'Coffee',items:[{n:'Robusta Green Beans',s:'export'},{n:'Bugisu Arabica',s:'export'},{n:'Processed Coffee',s:'export'}]},
    {name:'Other Commodities',items:[{n:'Uganda Vanilla',s:'export'},{n:'Cocoa Beans',s:'export'},{n:'CTC Black Tea',s:'export'},{n:'Simsim (Sesame)',s:'export'}]},
    {name:'Fish Exports',items:[{n:'Nile Perch IQF Frozen',s:'export'},{n:'Tilapia Fillets',s:'export'}]},
    {name:'Agricultural',items:[{n:'Maize',s:'export'},{n:'Soya Beans',s:'export'},{n:'Dried Beans',s:'export'}]},
    {name:'Export Services',items:[{n:'Logistics',s:'export'},{n:'Documentation',s:'export'},{n:'Quality Testing',s:'export'}]},
  ]},
  {name:'Real Estate',icon:'🏘️',path:'/realestate',groups:[
    {name:'Residential',items:[{n:'Houses for Sale',s:'realestate'},{n:'Houses for Rent',s:'realestate'},{n:'Apartments for Rent',s:'realestate'}]},
    {name:'Land',items:[{n:'Residential Land',s:'realestate'},{n:'Commercial Land',s:'realestate'},{n:'Farm Land',s:'realestate'},{n:'Land for Lease',s:'realestate'}]},
    {name:'Commercial Property',items:[{n:'Shops for Rent',s:'realestate'},{n:'Warehouses',s:'realestate'},{n:'Office Space',s:'realestate'}]},
    {name:'Short Stay',items:[{n:'Airbnb / Guesthouses',s:'realestate'},{n:'Short-term Rentals',s:'realestate'}]},
  ]},
  {name:'Business Directory',icon:'📍',path:'/directory',groups:[
    {name:'Food & Hospitality',items:[{n:'Restaurants',s:'directory'},{n:'Caterers',s:'directory'},{n:'Supermarkets',s:'directory'}]},
    {name:'Retail & Trade',items:[{n:'Retail Shops',s:'directory'},{n:'Wholesalers',s:'directory'},{n:'Open Markets',s:'directory'}]},
    {name:'Services',items:[{n:'Cleaning',s:'directory'},{n:'Repairs',s:'directory'},{n:'Logistics & Transport',s:'directory'}]},
    {name:'Professionals',items:[{n:'Lawyers',s:'directory'},{n:'Doctors',s:'directory'},{n:'Accountants',s:'directory'}]},
    {name:'Manufacturers',items:[{n:'Food Processing',s:'directory'},{n:'Textiles',s:'directory'},{n:'Construction',s:'directory'}]},
  ]},
  {name:'Electronics',icon:'📱',path:'/category/electronics',groups:[
    {name:'Mobile Phones',items:[{n:'Smartphones',s:'category/electronics'},{n:'Feature Phones',s:'category/electronics'},{n:'Phone Accessories',s:'category/electronics'},{n:'Power Banks',s:'category/electronics'}]},
    {name:'TVs & Audio',items:[{n:'Smart TVs',s:'category/electronics'},{n:'LED TVs',s:'category/electronics'},{n:'Headphones',s:'category/electronics'},{n:'Speakers',s:'category/electronics'}]},
    {name:'Computers & Laptops',items:[{n:'Laptops',s:'category/computers'},{n:'Desktops',s:'category/computers'},{n:'Monitors',s:'category/computers'},{n:'Printers',s:'category/electronics'}]},
    {name:'Smart Devices',items:[{n:'Smart Home',s:'category/smart-home'},{n:'Security Cameras',s:'category/electronics'},{n:'Routers & Modems',s:'category/electronics'}]},
  ]},
  {name:'Fashion',icon:'👗',path:'/category/womens-fashion',groups:[
    {name:"Women's Fashion",items:[{n:'Dresses',s:'category/womens-fashion'},{n:'Tops',s:'category/womens-fashion'},{n:'Trousers',s:'category/womens-fashion'}]},
    {name:"Men's Fashion",items:[{n:'Shirts',s:'category/mens-fashion'},{n:'Trousers',s:'category/mens-fashion'},{n:'Suits',s:'category/mens-fashion'}]},
    {name:"Kids' Fashion",items:[{n:"Girls' Clothes",s:'category/girls-fashion'},{n:"Boys' Clothes",s:'category/boys-fashion'}]},
    {name:'Shoes',items:[{n:'Casual Shoes',s:'category/womens-fashion'},{n:'Formal Shoes',s:'category/mens-fashion'},{n:'Sports Shoes',s:'category/sports'}]},
    {name:'African Wear',items:[{n:'Kitenge',s:'category/african-fashion'},{n:'Ankara',s:'category/african-fashion'},{n:'Tailored Wear',s:'category/african-fashion'}]},
    {name:'Bags & Accessories',items:[{n:'Handbags',s:'category/womens-fashion'},{n:'Backpacks',s:'category/womens-fashion'},{n:'Belts',s:'category/womens-fashion'}]},
  ]},
  {name:'Beauty & Personal Care',icon:'💄',path:'/category/beauty',groups:[
    {name:'Skincare',items:[{n:'Face Creams',s:'category/beauty'},{n:'Body Lotion',s:'category/beauty'},{n:'Sunscreen',s:'category/beauty'}]},
    {name:'Hair Care',items:[{n:'Hair Products',s:'category/beauty'},{n:'Wigs & Extensions',s:'category/beauty'},{n:'Hair Accessories',s:'category/beauty'}]},
    {name:'Makeup',items:[{n:'Lipstick',s:'category/beauty'},{n:'Foundation',s:'category/beauty'},{n:'Eye Makeup',s:'category/beauty'}]},
    {name:'Fragrances',items:[{n:'Perfumes',s:'category/beauty'},{n:'Body Spray',s:'category/beauty'}]},
  ]},
  {name:'Health & Pharmacy',icon:'💊',path:'/category/health',groups:[
    {name:'Medicines',items:[{n:'Pain Relief',s:'category/health'},{n:'Cold & Flu',s:'category/health'},{n:'Antibiotics',s:'category/health'}]},
    {name:'Supplements',items:[{n:'Vitamins',s:'category/health'},{n:'Herbal Products',s:'category/health'},{n:'Protein Supplements',s:'category/health'}]},
    {name:'Medical Devices',items:[{n:'Thermometers',s:'category/health'},{n:'BP Monitors',s:'category/health'},{n:'Glucose Monitors',s:'category/health'}]},
    {name:'Hygiene',items:[{n:'Sanitizers',s:'category/health'},{n:'Soaps',s:'category/health'},{n:'Masks',s:'category/health'}]},
  ]},
  {name:'Baby, Kids & Toys',icon:'👶',path:'/category/baby-kids',groups:[
    {name:'Baby Essentials',items:[{n:'Diapers',s:'category/baby-kids'},{n:'Feeding',s:'category/baby-kids'},{n:'Strollers',s:'category/baby-kids'},{n:'Baby Clothes',s:'category/baby-kids'}]},
    {name:'Toys & Games',items:[{n:'Educational Toys',s:'category/toys-games'},{n:'Dolls',s:'category/toys-games'},{n:'Board Games',s:'category/toys-games'}]},
    {name:'Kids Electronics',items:[{n:'Tablets',s:'category/baby-kids'},{n:'Learning Devices',s:'category/baby-kids'}]},
    {name:'Ride-ons & Bikes',items:[{n:'Bicycles',s:'category/baby-kids'},{n:'Scooters',s:'category/baby-kids'},{n:'Electric Ride-ons',s:'category/baby-kids'}]},
  ]},
  {name:'Home & Kitchen',icon:'🏡',path:'/category/home-kitchen',groups:[
    {name:'Furniture',items:[{n:'Sofas',s:'category/home-kitchen'},{n:'Beds',s:'category/home-kitchen'},{n:'Tables & Chairs',s:'category/home-kitchen'},{n:'Wardrobes',s:'category/home-kitchen'}]},
    {name:'Cookware & Appliances',items:[{n:'Pots & Pans',s:'category/home-kitchen'},{n:'Gas Cookers',s:'category/home-kitchen'},{n:'Blenders',s:'category/home-kitchen'},{n:'Fridges',s:'category/home-kitchen'}]},
    {name:'Bedding',items:[{n:'Mattresses',s:'category/home-kitchen'},{n:'Bedsheets',s:'category/home-kitchen'},{n:'Pillows',s:'category/home-kitchen'}]},
    {name:'Cleaning',items:[{n:'Detergents',s:'category/home-kitchen'},{n:'Brooms & Mops',s:'category/home-kitchen'},{n:'Disinfectants',s:'category/home-kitchen'}]},
  ]},
  {name:'Automotive',icon:'🚗',path:'/category/automotive',groups:[
    {name:'Car Parts',items:[{n:'Engine Parts',s:'category/automotive'},{n:'Filters',s:'category/automotive'},{n:'Brakes',s:'category/automotive'},{n:'Tyres',s:'category/automotive'}]},
    {name:'Car Accessories',items:[{n:'Car Covers',s:'category/automotive'},{n:'Seat Covers',s:'category/automotive'},{n:'Floor Mats',s:'category/automotive'}]},
    {name:'Tools & Kits',items:[{n:'Jacks',s:'category/automotive'},{n:'Jump Starters',s:'category/automotive'},{n:'Tyre Inflators',s:'category/automotive'}]},
  ]},
  {name:'Tools & Industrial',icon:'🔧',path:'/category/tools',groups:[
    {name:'Hand Tools',items:[{n:'Hammers',s:'category/tools'},{n:'Screwdrivers',s:'category/tools'},{n:'Spanners',s:'category/tools'},{n:'Pliers',s:'category/tools'}]},
    {name:'Power Tools',items:[{n:'Drills',s:'category/tools'},{n:'Saws',s:'category/tools'},{n:'Grinders',s:'category/tools'}]},
    {name:'Industrial',items:[{n:'Safety Gear',s:'category/industrial'},{n:'Generators',s:'category/tools'},{n:'Welding Equipment',s:'category/tools'}]},
  ]},
  {name:'Uganda Made',icon:'🇺🇬',path:'/products',groups:[
    {name:'Local Fashion',items:[{n:'Kitenge Designs',s:'category/african-fashion'},{n:'Tailored Wear',s:'category/african-fashion'},{n:'Beadwork',s:'category/african-fashion'}]},
    {name:'Crafts & Art',items:[{n:'Baskets',s:'products'},{n:'Wood Carvings',s:'products'},{n:'Beaded Jewellery',s:'products'},{n:'Paintings',s:'products'}]},
    {name:'Agricultural Products',items:[{n:'Ugandan Coffee',s:'export'},{n:'Honey',s:'products'},{n:'Vanilla Extract',s:'products'},{n:'Dried Fruits',s:'products'}]},
    {name:'Beauty & Wellness',items:[{n:'Shea Butter',s:'products'},{n:'Herbal Products',s:'products'},{n:'Natural Oils',s:'products'}]},
    {name:'Local Brands & SMEs',items:[{n:'Ugandan Startups',s:'products'},{n:'Local Food Brands',s:'products'},{n:'Artisan Makers',s:'products'}]},
  ]},
];

function Navbar({cartCount,user,logout}){
  const nav=useNavigate();
  const [q,setQ]=useState('');
  const [sugg,setSugg]=useState([]);
  const [megaOpen,setMegaOpen]=useState(false);
  const [megaActive,setMegaActive]=useState(0);
  const [mobOpen,setMobOpen]=useState(false);
  const [mobDrill,setMobDrill]=useState(null);
  const megaTimer=useRef(null);

  useEffect(()=>{
    if(q.length<2){setSugg([]);return;}
    const t=setTimeout(async()=>{
      try{const r=await fetch(`/api/search/suggest?q=${q}`);const d=await r.json();setSugg(d.suggestions||[]);}catch(e){}
    },320);
    return()=>clearTimeout(t);
  },[q]);

  const go=()=>{if(q.trim()){nav(`/search?q=${encodeURIComponent(q.trim())}`);setQ('');setSugg([]);}};
  const openMega=()=>{clearTimeout(megaTimer.current);setMegaOpen(true);};
  const closeMega=()=>{megaTimer.current=setTimeout(()=>setMegaOpen(false),140);};

  const [homeOpen,setHomeOpen]=useState(false);
  const [accOpen,setAccOpen]=useState(false);
  const homeTimer=useRef(null);
  const openHome=()=>{clearTimeout(homeTimer.current);setHomeOpen(true);};
  const closeHome=()=>{homeTimer.current=setTimeout(()=>setHomeOpen(false),140);};

  const NavItem=({children,path,variant=''})=>(
    <div onClick={()=>nav(path)}
      style={{padding:'0 14px',color:variant==='flash'?'#8B0000':variant==='dark'?'#FFD700':'#1A0F00',
        background:variant==='dark'?MG_BLACK_H:'transparent',
        fontSize:12,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
        display:'flex',alignItems:'center',fontFamily:BLC,letterSpacing:.5,
        fontWeight:variant==='flash'?900:800,textTransform:'uppercase',
        height:'100%',borderBottom:'2px solid transparent',transition:'border-color .15s'}}
      onMouseEnter={e=>{e.currentTarget.style.borderBottom=`2px solid ${variant==='flash'?'#8B0000':'#000'}`;}}
      onMouseLeave={e=>{e.currentTarget.style.borderBottom='2px solid transparent';}}>
      {children}
    </div>
  );

  return(
    <>
      {/* ── Mobile full-screen drawer ── */}
      {mobOpen&&(
        <div style={{position:'fixed',inset:0,background:NAVY,zIndex:10000,display:'flex',flexDirection:'column',fontFamily:DM}}>
          <div style={{padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #2d3748',flexShrink:0}}>
            <div style={{color:WHITE,fontWeight:900,fontSize:22}}>256 <span style={{color:YELLOW}}>MALL</span></div>
            <button onClick={()=>{setMobOpen(false);setMobDrill(null);}} style={{background:'transparent',border:'1px solid #555',borderRadius:6,color:WHITE,width:38,height:38,fontSize:20,cursor:'pointer'}}>✕</button>
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {mobDrill===null?(
              <>
                <div style={{padding:'12px 20px'}}>
                  <div style={{display:'flex',borderRadius:6,overflow:'hidden',border:`1px solid ${YELLOW}`}}>
                    <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){go();setMobOpen(false);}}}
                      placeholder="Search 256 Mall..." style={{flex:1,padding:'10px 14px',border:'none',outline:'none',fontSize:14,fontFamily:DM}}/>
                    <button onClick={()=>{go();setMobOpen(false);}} style={{background:YELLOW,border:'none',padding:'0 16px',cursor:'pointer',fontSize:16}}>🔍</button>
                  </div>
                </div>
                <div style={{padding:'6px 20px 2px',fontSize:11,color:'#6b7280',fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>Platform</div>
                {[['🏠','Home','/'],['📰','News','/news'],[' 🥬','Fresh Market','/produce'],['🐄','Animal Market','/animals'],
                  ['🏭','Wholesale','/wholesale'],['✈️','Export Hub','/export'],
                  ['🏘️','Real Estate','/realestate'],['📍','Business Directory','/directory'],['🇺🇬','Uganda Made','/products'],
                  ['🚴','256 Delivery','/delivery']
                ].map(([icon,label,path])=>(
                  <div key={path} onClick={()=>{nav(path);setMobOpen(false);setMobDrill(null);}}
                    style={{padding:'14px 20px',borderBottom:'1px solid #1f2937',fontSize:16,color:WHITE,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>{icon} {label}</span><span style={{color:YELLOW}}>›</span>
                  </div>
                ))}
                <div style={{padding:'10px 20px 2px',fontSize:11,color:'#6b7280',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginTop:6}}>Shop by Category</div>
                {MEGA_CATS.map((cat,i)=>(
                  <div key={cat.name} onClick={()=>setMobDrill(i)}
                    style={{padding:'13px 20px',borderBottom:'1px solid #1f2937',fontSize:15,color:WHITE,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>{cat.icon} {cat.name}</span><span style={{color:YELLOW}}>›</span>
                  </div>
                ))}
                <div style={{padding:'10px 20px 2px',fontSize:11,color:'#6b7280',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginTop:6}}>Account</div>
                {[
                  user?['👤','My Account','/account']:['🔑','Sign In','/login'],
                  ['🏪','Sell on 256 Mall','/sell'],
                  ['🌾','Join as Farmer','/farmers/join'],
                  ['🚴','Drive with 256 Delivery','/driver/register'],
                  ['📦','Track Order','/track'],
                  ['🛒','Cart','/cart'],
                ].map(([icon,label,path])=>(
                  <div key={path} onClick={()=>{nav(path);setMobOpen(false);}}
                    style={{padding:'13px 20px',borderBottom:'1px solid #1f2937',fontSize:15,color:WHITE,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span>{icon} {label}</span><span style={{color:YELLOW}}>›</span>
                  </div>
                ))}
                {user&&<div onClick={()=>{logout();setMobOpen(false);}} style={{padding:'13px 20px',color:'#f87171',cursor:'pointer',fontSize:15}}>🚪 Sign Out</div>}
              </>
            ):(
              <>
                <div onClick={()=>setMobDrill(null)} style={{padding:'14px 20px',borderBottom:'1px solid #2d3748',color:YELLOW,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',gap:6}}>
                  ‹ Back
                </div>
                <div style={{padding:'16px 20px 8px',fontSize:18,fontWeight:700,color:WHITE}}>
                  {MEGA_CATS[mobDrill].icon} {MEGA_CATS[mobDrill].name}
                </div>
                <div onClick={()=>{nav(MEGA_CATS[mobDrill].path);setMobOpen(false);setMobDrill(null);}}
                  style={{padding:'12px 20px',borderBottom:'1px solid #1f2937',fontSize:14,color:YELLOW,cursor:'pointer',fontWeight:600}}>
                  View All {MEGA_CATS[mobDrill].name} →
                </div>
                {MEGA_CATS[mobDrill].groups.map(g=>(
                  <div key={g.name}>
                    <div style={{padding:'10px 20px 3px',fontSize:11,color:'#6b7280',fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>{g.name}</div>
                    {g.items.map(item=>(
                      <div key={item.n} onClick={()=>{nav('/'+item.s);setMobOpen(false);setMobDrill(null);}}
                        style={{padding:'12px 24px',borderBottom:'1px solid #1f2937',fontSize:15,color:WHITE,cursor:'pointer',display:'flex',justifyContent:'space-between'}}>
                        <span>{item.n}</span><span style={{color:'#4b5563'}}>›</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="top-bar-text" style={{background:NAVY,padding:'10px 16px',textAlign:'center',fontFamily:"'DM Serif Display',Georgia,serif",fontSize:20,fontWeight:700,letterSpacing:'.02em',color:GOLD}}>
        256 Mall — Uganda's National Online Shopping Mall
      </div>

      {/* ── Metal stripe ── */}
      <div style={{height:4,background:METAL_STRIPE}}/>

      {/* ── Main sticky nav ── */}
      <div className="main-nav-row" style={{background:CREAM,padding:'0 16px',height:72,display:'flex',alignItems:'center',gap:8,position:'sticky',top:0,zIndex:1000,fontFamily:BL,borderBottom:'3px solid transparent',borderImage:`${GOLD_STRIP} 1`,borderImageSlice:1}}>
        {/* Logo */}
        <div className="nav-logo" onClick={()=>nav('/')} style={{cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',height:56,transition:'opacity .15s'}}
          onMouseEnter={e=>e.currentTarget.style.opacity='.75'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <img src="/logo.png" alt="256 Mall" style={{height:'100%',width:'auto',display:'block'}}/>
        </div>

        {/* ── All Departments mega menu ── */}
        <div className="hide-mobile" style={{position:'relative',flexShrink:0,display:'flex',alignItems:'stretch'}}
          onMouseEnter={openMega} onMouseLeave={closeMega}>
          <div
            style={{padding:'7px 16px',color:'#1A0F00',background:MG_GOLD,fontSize:13,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6,userSelect:'none',borderRadius:4,fontFamily:BLC,letterSpacing:.5,textTransform:'uppercase'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            ☰ All Departments
          </div>
          {megaOpen&&(
            <div style={{position:'absolute',top:'100%',left:0,zIndex:1001,background:WHITE,
              boxShadow:'0 12px 48px rgba(0,0,0,.22)',border:'1px solid #e5e7eb',
              borderTop:'none',display:'flex',width:'min(960px, 95vw)'}}
              onMouseEnter={openMega} onMouseLeave={closeMega}>
              {/* Left: category list */}
              <div style={{width:210,background:'#f8f9fa',borderRight:'1px solid #e5e7eb',flexShrink:0,overflowY:'auto',maxHeight:'75vh'}}>
                <div style={{padding:'10px 16px 6px',fontSize:11,color:'#6b7280',fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>All Categories</div>
                {MEGA_CATS.map((cat,i)=>(
                  <div key={cat.name}
                    onMouseEnter={()=>setMegaActive(i)}
                    onClick={()=>{nav(cat.path);setMegaOpen(false);}}
                    style={{padding:'9px 16px',fontSize:13.5,color:megaActive===i?NAVY:TEXT,
                      background:megaActive===i?WHITE:'transparent',cursor:'pointer',
                      display:'flex',alignItems:'center',gap:10,fontWeight:megaActive===i?700:400,
                      borderLeft:megaActive===i?`3px solid ${YELLOW}`:'3px solid transparent',
                      transition:'all .1s'}}>
                    <span style={{fontSize:15,flexShrink:0}}>{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span style={{marginLeft:'auto',color:'#9ca3af',fontSize:12}}>›</span>
                  </div>
                ))}
              </div>
              {/* Right: subcategories */}
              <div style={{flex:1,padding:'16px 20px',overflowY:'auto',maxHeight:'75vh'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,paddingBottom:10,borderBottom:'2px solid #f0f0f0'}}>
                  <div style={{fontSize:16,fontWeight:800,color:TEXT,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:20}}>{MEGA_CATS[megaActive].icon}</span>{MEGA_CATS[megaActive].name}
                  </div>
                  <div onClick={()=>{nav(MEGA_CATS[megaActive].path);setMegaOpen(false);}}
                    style={{fontSize:13,color:LINK,cursor:'pointer',fontWeight:600,padding:'4px 10px',border:`1px solid ${LINK}`,borderRadius:4}}>
                    View All →
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:'14px 20px'}}>
                  {MEGA_CATS[megaActive].groups.map(g=>(
                    <div key={g.name}>
                      <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:7,paddingBottom:4,
                        borderBottom:'1px solid #e5e7eb',textTransform:'uppercase',letterSpacing:.5}}>
                        {g.name}
                      </div>
                      {g.items.map(item=>(
                        <div key={item.n}
                          onClick={()=>{nav('/'+item.s);setMegaOpen(false);}}
                          style={{padding:'3px 0',fontSize:13,color:MUTED,cursor:'pointer',lineHeight:1.6}}
                          onMouseEnter={e=>e.currentTarget.style.color=LINK}
                          onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
                          {item.n}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="hide-mobile" style={{flex:1,position:'relative'}}>
          <div style={{display:'flex',borderRadius:4,overflow:'hidden',border:`2px solid ${YELLOW}`}}>
            <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}
              placeholder="Search 256 Mall — electronics, fashion, food, property..."
              style={{flex:1,padding:'9px 14px',border:'none',outline:'none',fontSize:15,color:TEXT,fontFamily:SF,background:WHITE}}/>
            <button onClick={go} style={{background:YELLOW,border:'none',padding:'0 20px',cursor:'pointer',fontSize:18}}
              onMouseEnter={e=>e.currentTarget.style.background='#F7CA00'}
              onMouseLeave={e=>e.currentTarget.style.background=YELLOW}>🔍</button>
          </div>
          {sugg.length>0&&(
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:WHITE,border:'1px solid #CCC',borderRadius:4,zIndex:1001,boxShadow:'0 8px 24px rgba(0,0,0,.2)'}}>
              {sugg.map((s,i)=>(
                <div key={i} onClick={()=>{nav(`/search?q=${encodeURIComponent(s)}`);setSugg([]);setQ('');}}
                  style={{padding:'10px 16px',fontSize:14,color:TEXT,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f5f5f5'}
                  onMouseLeave={e=>e.currentTarget.style.background=WHITE}>
                  🔍 {s}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Sell on 256 Mall — bold standout */}
        <div className="hide-mobile" onClick={()=>nav('/sell')}
          style={{cursor:'pointer',flexShrink:0,padding:'7px 14px',borderRadius:6,border:'2px solid rgba(139,110,0,.5)',background:'rgba(200,153,42,0.12)',transition:'all .15s',textAlign:'center'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(200,153,42,0.22)';e.currentTarget.style.borderColor='#8B6E00';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(200,153,42,0.12)';e.currentTarget.style.borderColor='rgba(139,110,0,.5)';}}>
          <div style={{fontSize:10,color:'#8B6E00',fontFamily:BLC,letterSpacing:.8,fontWeight:700}}>Become a</div>
          <div style={{fontFamily:BN,fontSize:15,letterSpacing:1,color:'#1A0F00',fontWeight:900,lineHeight:1.1}}>SELLER ›</div>
        </div>
        {/* Help & Support */}
        <div className="hide-mobile" style={{position:'relative',flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.querySelector('.help-dropdown').style.display='block'}
          onMouseLeave={e=>e.currentTarget.querySelector('.help-dropdown').style.display='none'}>
          <div style={{cursor:'pointer',padding:'0 8px',transition:'opacity .15s',textAlign:'center'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.65'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            <div style={{fontSize:10,color:'rgba(0,0,0,.5)',fontFamily:BLC}}>Help &</div>
            <div style={{fontFamily:BN,fontSize:14,letterSpacing:.5,
              background:MG_BLACK,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>SUPPORT ▾</div>
          </div>
          <div className="help-dropdown" style={{display:'none',position:'absolute',top:'100%',right:0,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,boxShadow:'0 8px 32px rgba(0,0,0,.18)',zIndex:2000,minWidth:260,overflow:'hidden'}}>
            {/* Header */}
            <div style={{background:`linear-gradient(135deg,${NAVY},${NAVY2})`,padding:'14px 16px'}}>
              <div style={{fontSize:14,fontWeight:800,color:WHITE,marginBottom:2}}>How can we help?</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.55)'}}>256 Mall support · Mon–Sun 7am–9pm</div>
            </div>
            {/* Options */}
            {[
              {icon:'💬',title:'Live Chat',sub:'Chat with our team now',action:'chat',color:'#0ea5e9'},
              {icon:'📞',title:'Call Us',sub:'+256 700 000 000',action:'call',color:'#16a34a'},
              {icon:'✉️',title:'Email Support',sub:'support@256mall.ug',action:'email',color:'#7c3aed'},
              {icon:'📋',title:'Track Your Order',sub:'Find your order status',action:'track',color:'#f59e0b'},
              {icon:'🔄',title:'Returns & Disputes',sub:'Open a dispute or return',action:'dispute',color:'#dc2626'},
            ].map(({icon,title,sub,action,color})=>(
              <div key={action}
                onClick={()=>{
                  if(action==='call')window.location.href='tel:+256700000000';
                  else if(action==='email')window.location.href='mailto:support@256mall.ug?subject=256 Mall Support Request';
                  else if(action==='track')nav('/track');
                  else if(action==='dispute')nav('/account?tab=disputes');
                  else if(action==='chat'){/* open chat widget */const btn=document.querySelector('[data-chat-open]');if(btn)btn.click();}
                }}
                style={{padding:'11px 16px',fontSize:13,color:TEXT,cursor:'pointer',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${BORDER}`,transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                onMouseLeave={e=>e.currentTarget.style.background=WHITE}>
                <div style={{width:36,height:36,borderRadius:8,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{icon}</div>
                <div>
                  <div style={{fontWeight:700,color:TEXT}}>{title}</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:1}}>{sub}</div>
                </div>
              </div>
            ))}
            <div style={{padding:'10px 16px',background:'#f8fafc',fontSize:11,color:MUTED,textAlign:'center'}}>
              256 Mall · Kampala, Uganda · support@256mall.ug
            </div>
          </div>
        </div>

        {/* Account dropdown */}
        <div className="hide-mobile" style={{position:'relative',flexShrink:0}}
          onMouseEnter={()=>setAccOpen(true)} onMouseLeave={()=>setAccOpen(false)}>
          <div style={{cursor:'pointer',padding:'0 8px',transition:'opacity .15s',opacity:accOpen?.75:1}}
            onClick={()=>nav(user?'/account':'/login')}>
            <div style={{fontSize:10,color:'rgba(0,0,0,.5)',fontFamily:BLC}}>{user?`Hello, ${user.name?.split(' ')[0]||'User'}`:'Hello, sign in'}</div>
            <div style={{fontFamily:BN,fontSize:14,letterSpacing:.5,
              background:MG_BLACK,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>ACCOUNT ▾</div>
          </div>
          {accOpen&&(
            <div style={{position:'absolute',top:'100%',right:0,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,
              boxShadow:'0 8px 32px rgba(0,0,0,.18)',zIndex:2000,minWidth:220,overflow:'hidden'}}>
              {user?(
                <>
                  <div style={{padding:'10px 16px',borderBottom:`1px solid ${BORDER}`,fontSize:12,color:MUTED}}>Signed in as <strong style={{color:TEXT}}>{user.name?.split(' ')[0]}</strong></div>
                  {[
                    ['👤','My Account','/account'],
                    ['📦','My Orders','/account?tab=orders'],
                    ['🚚','Track Order','/track'],
                    ['❤️','Saved Items','/account?tab=wishlist'],
                    ['📍','My Addresses','/account?tab=addresses'],
                    ['💳','Payment Methods','/account?tab=payments'],
                    ['🔄','Returns & Disputes','/account?tab=disputes'],
                    ['🏪','Seller Dashboard','/seller/dashboard'],
                  ].map(([ic,lb,path])=>(
                    <div key={lb} onClick={()=>{nav(path);setAccOpen(false);}}
                      style={{padding:'10px 16px',fontSize:13,color:TEXT,cursor:'pointer',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${BORDER}`}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e=>e.currentTarget.style.background=WHITE}>
                      <span>{ic}</span>{lb}
                    </div>
                  ))}
                  <div onClick={()=>{logout();setAccOpen(false);}}
                    style={{padding:'10px 16px',fontSize:13,color:'#dc2626',cursor:'pointer',display:'flex',alignItems:'center',gap:10}}
                    onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'}
                    onMouseLeave={e=>e.currentTarget.style.background=WHITE}>
                    🚪 Sign Out
                  </div>
                </>
              ):(
                <>
                  <div style={{padding:'12px 16px',borderBottom:`1px solid ${BORDER}`}}>
                    <button onClick={()=>{nav('/login');setAccOpen(false);}} style={{width:'100%',background:YELLOW,color:TEXT,border:'none',borderRadius:6,padding:'9px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:SF,marginBottom:8}}>Sign In</button>
                    <div style={{fontSize:12,color:MUTED,textAlign:'center'}}>New customer? <span onClick={()=>{nav('/register');setAccOpen(false);}} style={{color:'#0ea5e9',cursor:'pointer',fontWeight:600}}>Create account</span></div>
                  </div>
                  {[['📦','Track Order','/track'],['🔑','Sign In','/login']].map(([ic,lb,path])=>(
                    <div key={lb} onClick={()=>{nav(path);setAccOpen(false);}}
                      style={{padding:'10px 16px',fontSize:13,color:TEXT,cursor:'pointer',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${BORDER}`}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e=>e.currentTarget.style.background=WHITE}>
                      <span>{ic}</span>{lb}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        {/* Cart */}
        <div onClick={()=>nav('/cart')} style={{cursor:'pointer',flexShrink:0,padding:'0 8px',display:'flex',alignItems:'center',gap:5,transition:'opacity .15s'}}
          onMouseEnter={e=>e.currentTarget.style.opacity='.75'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          <div style={{position:'relative'}}>
            <span style={{fontSize:28}}>🛒</span>
            {cartCount>0&&<div style={{position:'absolute',top:-8,right:-8,background:YELLOW,color:TEXT,borderRadius:'50%',width:20,height:20,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{cartCount}</div>}
          </div>
          <div style={{fontFamily:BN,fontSize:14,letterSpacing:.5,
            background:MG_BLACK,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>CART</div>
        </div>
        <button onClick={()=>setMobOpen(true)} className="mob-btn"
          style={{display:'none',background:'transparent',border:'none',color:'#1A0F00',fontSize:26,cursor:'pointer',flexShrink:0}}>☰</button>
      </div>

      {/* ── Gold strip thick ── */}
      <div style={{height:3,background:GOLD_STRIP}}/>

      {/* ── Category bar ── */}
      <div className="hide-mobile" style={{background:MG_GOLD_H,fontFamily:BLC,position:'relative',borderBottom:'2px solid #000',height:46}}>
        <div style={{display:'flex',alignItems:'stretch',overflowX:'auto',scrollbarWidth:'none',height:'100%',padding:'0 8px'}}>

          {/* HOME — dropdown of all categories */}
          <div style={{position:'relative',flexShrink:0,display:'flex',alignItems:'stretch'}}
            onMouseEnter={openHome} onMouseLeave={closeHome}>
            <div onClick={()=>nav('/')}
              style={{padding:'0 14px',color:'#1A0F00',fontSize:12,cursor:'pointer',whiteSpace:'nowrap',
                display:'flex',alignItems:'center',gap:4,fontFamily:BLC,letterSpacing:.5,fontWeight:800,
                textTransform:'uppercase',height:'100%',borderBottom:'2px solid transparent',transition:'border-color .15s',userSelect:'none'}}
              onMouseEnter={e=>e.currentTarget.style.borderBottom='2px solid #000'}
              onMouseLeave={e=>e.currentTarget.style.borderBottom='2px solid transparent'}>
              🏠 HOME ▾
            </div>
            {homeOpen&&(
              <div style={{position:'absolute',top:'100%',left:0,zIndex:999,background:WHITE,
                boxShadow:'0 12px 40px rgba(0,0,0,.2)',border:'1px solid #e5e7eb',
                borderTop:'none',minWidth:220,maxHeight:'80vh',overflowY:'auto'}}
                onMouseEnter={openHome} onMouseLeave={closeHome}>
                <div style={{padding:'8px 14px 6px',fontSize:11,color:'#6b7280',fontWeight:700,
                  letterSpacing:1,textTransform:'uppercase',borderBottom:'1px solid #f0f0f0'}}>
                  All Departments
                </div>
                {MEGA_CATS.map(cat=>(
                  <div key={cat.name}
                    onClick={()=>{nav(cat.path);setHomeOpen(false);}}
                    style={{padding:'9px 16px',fontSize:13,color:TEXT,cursor:'pointer',
                      display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid #f7f7f7'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f0f7ff';e.currentTarget.style.color=LINK;}}
                    onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=TEXT;}}>
                    <span style={{fontSize:16,flexShrink:0}}>{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span style={{marginLeft:'auto',color:'#9ca3af',fontSize:12}}>›</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <NavItem path="/news">📰 News</NavItem>

          {/* Platform pillars */}
          <NavItem path="/products?flash_sale=true" variant="flash">⚡ Flash Deals</NavItem>
          <NavItem path="/produce">🥬 Fresh Market</NavItem>
          <NavItem path="/animals">🐄 Animal Market</NavItem>
          <NavItem path="/wholesale">🏭 Wholesale</NavItem>
          <NavItem path="/export">✈️ Export Hub</NavItem>
          <NavItem path="/realestate">🏘️ Real Estate</NavItem>
          <NavItem path="/directory">📍 Directory</NavItem>
          <NavItem path="/products">🇺🇬 Uganda Made</NavItem>
          <NavItem path="/delivery" variant="dark">🚴 256 Delivery</NavItem>
        </div>
      </div>

      {/* ── Gold strip (2px) ── */}
      <div style={{height:2,background:GOLD_STRIP}}/>

      <style>{`
        *::-webkit-scrollbar{display:none}
        @media(max-width:768px){
          .mob-btn{display:block!important}
          .nav-loc{display:none!important}
        }
        @media(min-width:900px){.nav-loc{display:flex!important}}
      `}</style>
    </>
  );
}

// ── Hero Slider ───────────────────────────────────────────────────────────────
function HeroSlider(){
  const nav=useNavigate();
  const [idx,setIdx]=useState(0);
  const [animating,setAnimating]=useState(false);
  const ref=useRef(null);

  const go=useCallback((next)=>{
    if(animating)return;
    setAnimating(true);
    setIdx((next+SLIDES.length)%SLIDES.length);
    setTimeout(()=>setAnimating(false),480);
    clearInterval(ref.current);
    ref.current=setInterval(()=>go_auto(),5500);
  },[animating]);

  const go_auto=()=>setIdx(i=>(i+1)%SLIDES.length);

  useEffect(()=>{
    ref.current=setInterval(go_auto,5500);
    return()=>clearInterval(ref.current);
  },[]);

  const s=SLIDES[idx];
  const resetTimer=()=>{clearInterval(ref.current);ref.current=setInterval(go_auto,5500);};

  return(
    <div style={{position:'relative',overflow:'hidden',fontFamily:DM}}>

      {/* ── Uganda identity stripe ── */}
      <div style={{display:'flex',height:4}}>
        <div style={{flex:1,background:'#000'}}/>
        <div style={{flex:1,background:YELLOW}}/>
        <div style={{flex:1,background:'#C8102E'}}/>
        <div style={{flex:1,background:'#000'}}/>
        <div style={{flex:1,background:YELLOW}}/>
        <div style={{flex:1,background:'#C8102E'}}/>
      </div>

      {/* ── Slide body ── */}
      <div style={{background:s.bg,minHeight:480,display:'flex',flexDirection:'column',transition:'background 0.7s ease'}}>

        {/* Main content area */}
        <div className="hero-content" style={{flex:1,maxWidth:1280,margin:'0 auto',width:'100%',padding:'44px 32px 32px',display:'flex',alignItems:'center',gap:40,boxSizing:'border-box'}}>

          {/* Left: text block */}
          <div key={idx} className="hero-text-in" style={{flex:1,minWidth:0}}>
            {/* Badge */}
            <div style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:20,padding:'5px 14px',fontSize:12,fontWeight:700,color:'rgba(255,255,255,.9)',letterSpacing:.5,marginBottom:18,backdropFilter:'blur(4px)'}}>
              {s.badge}
            </div>

            {/* Headline */}
            <div style={{marginBottom:18}}>
              <div style={{fontFamily:BN,fontSize:'clamp(48px,6vw,88px)',lineHeight:1,letterSpacing:2,
                background:MG_WHITE,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{s.h1}</div>
              <div style={{fontFamily:BN,fontSize:'clamp(48px,6vw,88px)',lineHeight:1,letterSpacing:2,
                background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{s.h2}</div>
            </div>

            {/* Subtext */}
            <p style={{fontSize:'clamp(14px,1.8vw,17px)',color:'rgba(255,255,255,.75)',margin:'0 0 28px',lineHeight:1.7,maxWidth:520}}>{s.sub}</p>

            {/* CTA row */}
            <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
              <button onClick={()=>nav(s.link)}
                style={{background:MG_GOLD,color:'#1A0F00',border:'none',borderRadius:4,padding:'13px 28px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:BLC,whiteSpace:'nowrap',letterSpacing:.5,textTransform:'uppercase',transition:'transform .15s,opacity .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.opacity='.88';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='none';}}>
                {s.cta} →
              </button>
              <button onClick={()=>nav('/produce')}
                style={{background:'rgba(255,255,255,.1)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:4,padding:'12px 22px',fontSize:14,cursor:'pointer',fontFamily:SF,backdropFilter:'blur(4px)',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.2)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}>
                🥬 Fresh Market
              </button>
              <button onClick={()=>nav('/wholesale')}
                style={{background:'rgba(255,255,255,.1)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:4,padding:'12px 22px',fontSize:14,cursor:'pointer',fontFamily:SF,backdropFilter:'blur(4px)',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.2)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}>
                🏭 Wholesale
              </button>
            </div>
          </div>

          {/* Right: unified image banner */}
          <div className="hero-visual" style={{
            flexShrink:0,width:370,height:350,borderRadius:14,overflow:'hidden',
            border:`2px solid ${s.ac}66`,
            boxShadow:`0 10px 48px rgba(0,0,0,.65),0 0 0 1px ${s.ac}22`,
          }}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr',width:'100%',height:'100%',gap:2,background:'#000'}}>
              {s.visuals.map((url,i)=>(
                <div key={i} style={{overflow:'hidden'}}>
                  <img src={url} alt="" loading="lazy"
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block',transition:'transform .45s ease'}}
                    onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Trust / impact bar ── */}
        <div style={{borderTop:'1px solid rgba(255,255,255,.12)',padding:'14px 32px',background:'rgba(0,0,0,.25)',backdropFilter:'blur(4px)'}}>
          <div style={{maxWidth:1280,margin:'0 auto',display:'flex',gap:0,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{fontSize:12,color:'rgba(255,255,255,.55)',marginRight:20,flexShrink:0}}>🇺🇬 Supporting Uganda's digital economy:</div>
            {[['5M+','Ugandans in 5 yrs'],['146','Districts served'],['10,000+','Products'],['500+','Verified sellers'],['24/7','Support']].map(([n,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginRight:24,flexShrink:0}}>
                <span style={{fontSize:15,fontWeight:800,color:s.ac}}>{n}</span>
                <span style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Uganda identity stripe (bottom) ── */}
      <div style={{display:'flex',height:3}}>
        <div style={{flex:1,background:'#C8102E'}}/>
        <div style={{flex:1,background:YELLOW}}/>
        <div style={{flex:1,background:'#000'}}/>
        <div style={{flex:1,background:'#C8102E'}}/>
        <div style={{flex:1,background:YELLOW}}/>
        <div style={{flex:1,background:'#000'}}/>
      </div>

      {/* ── Dots ── */}
      <div style={{position:'absolute',bottom:22,left:'50%',transform:'translateX(-50%)',display:'flex',gap:7,alignItems:'center'}}>
        {SLIDES.map((_,i)=>(
          <div key={i}
            onClick={()=>{setIdx(i);resetTimer();}}
            style={{width:i===idx?32:8,height:8,borderRadius:4,background:i===idx?YELLOW:'rgba(255,255,255,.35)',cursor:'pointer',transition:'all .35s',boxShadow:i===idx?`0 0 8px ${YELLOW}66`:''}}/>
        ))}
      </div>

      {/* ── Arrows ── */}
      <button
        onClick={()=>{setIdx(i=>(i-1+SLIDES.length)%SLIDES.length);resetTimer();}}
        style={{position:'absolute',left:14,top:'50%',transform:'translateY(-60%)',background:'rgba(0,0,0,.45)',border:'1px solid rgba(255,255,255,.2)',color:WHITE,width:42,height:42,borderRadius:'50%',cursor:'pointer',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',transition:'background .15s'}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,.7)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,.45)'}>‹</button>
      <button
        onClick={()=>{setIdx(i=>(i+1)%SLIDES.length);resetTimer();}}
        style={{position:'absolute',right:14,top:'50%',transform:'translateY(-60%)',background:'rgba(0,0,0,.45)',border:'1px solid rgba(255,255,255,.2)',color:WHITE,width:42,height:42,borderRadius:'50%',cursor:'pointer',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',transition:'background .15s'}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,.7)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,.45)'}>›</button>

      <style>{`
        @media(max-width:768px){.hero-visual{display:none!important}}
        @keyframes heroTextIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        .hero-text-in{animation:heroTextIn .55s cubic-bezier(.22,1,.36,1) forwards}
        @media(max-width:1100px){.shop-grid-row{grid-template-columns:repeat(4,1fr)!important}}
        @media(max-width:700px){.shop-grid-row{grid-template-columns:repeat(2,1fr)!important}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        .stat-shimmer{animation:shimmer 3s linear infinite}
      `}</style>
    </div>
  );
}

// ── Deal of the Day ───────────────────────────────────────────────────────────
function DealOfDay(){
  const nav=useNavigate();

  return(
    <div className="resp-section" style={{background:MG_BLACK,padding:'38px 44px',fontFamily:BL,position:'relative',border:'3px solid transparent',borderImage:`${GOLD_STRIP} 1`,borderImageSlice:1,overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 82% 32%,rgba(255,215,0,.16),transparent 34%)',pointerEvents:'none'}}/>
      <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:24,flexWrap:'wrap'}}>
        <div style={{maxWidth:760}}>
          <div style={{fontFamily:BLC,fontSize:14,fontWeight:900,letterSpacing:2.5,textTransform:'uppercase',color:'#FFD700',marginBottom:8}}>Seller Opportunity</div>
          <div style={{fontFamily:BN,fontSize:64,lineHeight:.95,color:WHITE,letterSpacing:1.2,textTransform:'uppercase'}}>Start selling with 256 Mall</div>
          <div style={{fontFamily:BL,fontSize:18,lineHeight:1.5,color:'rgba(255,255,255,.76)',marginTop:12}}>
            Open your shop, list products, and reach buyers across Uganda.
          </div>
        </div>
        <button onClick={()=>nav('/sell')}
          style={{background:MG_GOLD,color:'#1A0F00',border:'2px solid #FFD700',borderRadius:6,padding:'18px 34px',fontFamily:BLC,fontSize:18,fontWeight:900,letterSpacing:1.2,textTransform:'uppercase',cursor:'pointer',boxShadow:'0 8px 28px rgba(255,215,0,.28)',whiteSpace:'nowrap'}}>
          Start Selling →
        </button>
      </div>
    </div>
  );
}

// ── Horizontal Scroll Row ─────────────────────────────────────────────────────
function HRow({title,eyebrow,slug,seeAll,cart,badge,flag,sort,alt=false}){
  const nav=useNavigate();
  const [products,setProducts]=useState([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const rowRef=useRef(null);
  const goToAll=()=>nav(seeAll||(slug?`/category/${slug}`:'/products'));

  useEffect(()=>{
    const params=new URLSearchParams({limit:12,sort:sort||'popular'});
    if(slug)params.set('category',slug);
    else if(flag==='featured')params.set('featured','true');
    else if(flag==='uganda_made')params.set('uganda_made','true');
    fetch(`/api/products?${params}`).then(r=>r.json())
      .then(d=>{setProducts(d.products||[]);setTotal(d.total||0);})
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[slug,flag,sort]);

  const scroll=dir=>{if(rowRef.current)rowRef.current.scrollBy({left:dir*420,behavior:'smooth'});};
  const secBg=alt
    ?'linear-gradient(135deg,#e8e8e8 0%,#f5f5f5 30%,#fff 60%,#e0e0e0 100%)'
    :'linear-gradient(135deg,#fff 0%,#f5f5f5 40%,#fff 80%,#eeeeee 100%)';

  return(
    <div className="resp-section" style={{background:secBg,padding:'24px 32px 28px',marginBottom:0,fontFamily:BL,position:'relative',borderTop:'3px solid transparent',borderImage:`${GOLD_STRIP} 1`,borderImageSlice:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          {eyebrow&&<div style={{fontFamily:BLC,fontSize:12,color:'#888',textTransform:'uppercase',letterSpacing:2,marginBottom:4}}>{eyebrow}</div>}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontFamily:BN,fontSize:40,color:'#111',letterSpacing:1,lineHeight:1}}>{title}</div>
            {badge&&<span style={{background:MG_RED,color:WHITE,fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:3,fontFamily:BLC,letterSpacing:.5}}>{badge}</span>}
          </div>
        </div>
        <span onClick={goToAll}
          style={{fontSize:12,color:'#000',cursor:'pointer',whiteSpace:'nowrap',fontWeight:700,fontFamily:BLC,letterSpacing:.5,
            textTransform:'uppercase',borderBottom:'3px solid #D4A017',paddingBottom:2,flexShrink:0,marginTop:6}}>
          Discover More →
        </span>
      </div>
      <div style={{position:'relative'}}>
        <button className="scroll-btn" onClick={()=>scroll(-1)}
          style={{position:'absolute',left:-20,top:'50%',transform:'translateY(-50%)',zIndex:10,background:WHITE,border:'2px solid #000',borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>‹</button>
        <div ref={rowRef} className="product-row" style={{display:'flex',flexWrap:'nowrap',gap:12,overflowX:'auto',scrollbarWidth:'none',padding:'4px 2px'}}>
          {loading
            ?Array(5).fill(0).map((_,i)=><div key={i} style={{flex:'0 0 calc((100% - 48px)/5)',height:380,background:'#f0f0f0',borderRadius:4,flexShrink:0}}/>)
            :products.length>0
              ?products.map(p=><PCard key={p.id} p={p} onAdd={cart.add}/>)
              :<EmptyProductRow message={`No live products in ${title} yet.`} action="Open category" path={seeAll||(slug?`/category/${slug}`:'/products')}/>}
          {!loading&&products.length>0&&total>products.length&&(
            <div onClick={goToAll}
              style={{flex:'0 0 calc((100% - 48px)/5)',minWidth:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                gap:10,background:MG_BLACK,border:'2px solid #000',borderRadius:6,cursor:'pointer',textAlign:'center',padding:'0 16px',
                transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <div style={{fontFamily:BN,fontSize:30,color:'#FFD700',lineHeight:1}}>+{total-products.length}</div>
              <div style={{fontFamily:BLC,fontSize:13,color:WHITE,fontWeight:700,letterSpacing:.5,textTransform:'uppercase',lineHeight:1.3}}>
                View All {title}
              </div>
              <div style={{fontFamily:BLC,fontSize:18,color:'#FFD700'}}>→</div>
            </div>
          )}
        </div>
        <button className="scroll-btn" onClick={()=>scroll(1)}
          style={{position:'absolute',right:-20,top:'50%',transform:'translateY(-50%)',zIndex:10,background:WHITE,border:'2px solid #000',borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>›</button>
      </div>
    </div>
  );
}
// ── All Departments Grid ──────────────────────────────────────────────────────
function DeptGrid(){
  const nav=useNavigate();
  return(
    <div style={{background:WHITE,padding:'20px 24px',marginBottom:8,fontFamily:SF,border:`1px solid ${BORDER}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{fontSize:20,fontWeight:700,color:TEXT,margin:0}}>Shop by Department</h2>
        <span onClick={()=>nav('/products')} style={{fontSize:13,color:LINK,cursor:'pointer'}}>See all →</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'var(--cols-8)',gap:8}}>
        {DEPTS.map(d=>(
          <div key={d.slug} onClick={()=>nav(`/category/${d.slug}`)}
            style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:4,padding:'16px 6px 12px',textAlign:'center',cursor:'pointer',transition:'box-shadow .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,.13)';e.currentTarget.style.borderColor='#aaa';}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=BORDER;}}>
            <div style={{fontSize:28,marginBottom:7,lineHeight:1}}>{d.icon}</div>
            <div style={{fontSize:11,color:TEXT,fontWeight:500,lineHeight:1.35,marginBottom:6}}>{d.name}</div>
            <div style={{fontSize:11,color:LINK,fontWeight:600}}>Shop now</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Uganda Made Banner ────────────────────────────────────────────────────────
function UgandaMadeBanner({cart}){
  const nav=useNavigate();
  const [products,setProducts]=useState([]);
  useEffect(()=>{
    fetch('/api/products?uganda_made=true&limit=10').then(r=>r.json()).then(d=>setProducts(d.products||[])).catch(()=>{});
  },[]);
  const rowRef=useRef(null);
  const scroll=dir=>{if(rowRef.current)rowRef.current.scrollBy({left:dir*420,behavior:'smooth'});};
  return(
    <div style={{background:'linear-gradient(135deg,#1a3300 0%,#2a4a00 100%)',padding:'20px 24px 24px',marginBottom:8,fontFamily:SF,border:'1px solid #4a6a00'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:WHITE,margin:'0 0 4px'}}>🇺🇬 Uganda Made</h2>
          <div style={{fontSize:13,color:'#aad',margin:0}}>Proudly crafted by Ugandan entrepreneurs</div>
        </div>
        <span onClick={()=>nav('/products')} style={{fontSize:13,color:YELLOW,cursor:'pointer'}}>See all Uganda Made →</span>
      </div>
      <div style={{position:'relative'}}>
        <button className="scroll-btn" onClick={()=>scroll(-1)} style={{position:'absolute',left:-16,top:'50%',transform:'translateY(-50%)',zIndex:10,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.3)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
        <div ref={rowRef} className="product-row" style={{display:'flex',flexWrap:'nowrap',gap:12,overflowX:'auto',scrollbarWidth:'none',padding:'4px 2px'}}>
          {products.length>0
            ?products.map(p=><PCard key={p.id} p={p} onAdd={cart.add}/>)
            :<EmptyProductRow message="No live Uganda Made products yet." action="View product listings" path="/products"/>}
        </div>
        <button className="scroll-btn" onClick={()=>scroll(1)} style={{position:'absolute',right:-16,top:'50%',transform:'translateY(-50%)',zIndex:10,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.3)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
      </div>
    </div>
  );
}

// ── Boda Tracking (post-checkout) ─────────────────────────────────────────────
function BodaTracker({orderId}){
  const [delivery,setDelivery]=useState(null);
  const [tick,setTick]=useState(0);

  useEffect(()=>{
    const load=async()=>{
      try{const r=await fetch(`/api/deliveries/tracking/${orderId}`);const d=await r.json();if(d.success)setDelivery(d.delivery);}catch(e){}
    };
    load();
    const t=setInterval(()=>{load();setTick(p=>p+1);},12000);
    return()=>clearInterval(t);
  },[orderId]);

  const STATUS_STEPS=['pending','accepted','picked_up','delivered'];
  const STATUS_LABELS=['Order Received','Boda Picked Up','En Route to You','Delivered!'];
  const STATUS_ICONS=['📋','🏍️','🚀','✅'];
  const cur=STATUS_STEPS.indexOf(delivery?.status||'pending');

  return(
    <div style={{background:WHITE,border:`2px solid ${YELLOW}`,borderRadius:12,padding:24,marginTop:24,fontFamily:DM}}>
      <h3 style={{fontSize:18,fontWeight:700,color:TEXT,margin:'0 0 6px'}}>🏍️ Boda Delivery Tracking</h3>
      <p style={{fontSize:13,color:MUTED,margin:'0 0 20px'}}>Order #{orderId?.slice(0,8).toUpperCase()} · Updates every 12 seconds</p>

      {/* Progress steps */}
      <div style={{display:'flex',justifyContent:'space-between',position:'relative',marginBottom:24}}>
        <div style={{position:'absolute',top:20,left:'12.5%',right:'12.5%',height:3,background:'#eee',zIndex:0}}>
          <div style={{height:'100%',background:YELLOW,width:`${Math.max(0,cur/(STATUS_STEPS.length-1))*100}%`,transition:'width .5s'}}/>
        </div>
        {STATUS_STEPS.map((st,i)=>(
          <div key={st} style={{textAlign:'center',flex:1,zIndex:1}}>
            <div style={{width:42,height:42,borderRadius:'50%',background:i<=cur?YELLOW:'#eee',margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,border:`2px solid ${i<=cur?YELLOW:BORDER}`}}>
              {STATUS_ICONS[i]}
            </div>
            <div style={{fontSize:11,color:i<=cur?TEXT:MUTED,fontWeight:i===cur?700:400}}>{STATUS_LABELS[i]}</div>
          </div>
        ))}
      </div>

      {/* Driver info */}
      {delivery?.driver_name?(
        <div style={{background:LIGHT,borderRadius:8,padding:16,display:'flex',alignItems:'center',gap:16}}>
          <div style={{width:54,height:54,background:NAVY2,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>🏍️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:TEXT}}>{delivery.driver_name}</div>
            <div style={{fontSize:13,color:MUTED}}>{delivery.driver_phone} · {delivery.license_plate||'Boda Rider'}</div>
            <div style={{fontSize:13,color:GREEN,marginTop:4}}>Rating: {'★'.repeat(Math.round(delivery.driver_rating||5))} {delivery.driver_rating||5}/5</div>
          </div>
          <a href={`tel:${delivery.driver_phone}`}
            style={{background:YELLOW,color:TEXT,padding:'10px 18px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:700}}>
            📞 Call Driver
          </a>
        </div>
      ):(
        <div style={{background:LIGHT,borderRadius:8,padding:16,textAlign:'center',color:MUTED,fontSize:14}}>
          <div style={{fontSize:28,marginBottom:8}}>⏳</div>
          Finding a nearby boda rider for your delivery...
        </div>
      )}
    </div>
  );
}

// ── Site-wide Chat System ────────────────────────────────────────────────────
function getChatSession(){
  let t=localStorage.getItem('mall_chat_session');
  if(!t){t=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('mall_chat_session',t);}
  return t;
}
function getChatName(){return localStorage.getItem('mall_chat_name')||'';}
function setChatIdentity(name){localStorage.setItem('mall_chat_name',name);}

const FLAG_WARNING='⚠️ This message has been flagged. Payments must go through 256 Mall to protect both parties.';

const ChatCtx=React.createContext(null);
function ChatProvider({children}){
  const [open,setOpen]=React.useState(false);
  const [chatId,setChatId]=React.useState(null);
  const [product,setProduct]=React.useState(null);
  const [messages,setMessages]=React.useState([]);
  const [loading,setLoading]=React.useState(false);
  const [sending,setSending]=React.useState(false);
  const [draft,setDraft]=React.useState('');
  const [step,setStep]=React.useState('identity');
  const [buyerName,setBuyerName]=React.useState(getChatName);
  const [identErr,setIdentErr]=React.useState('');
  const [myChats,setMyChats]=React.useState([]);
  const [view,setView]=React.useState('chat');
  const [unreadTotal,setUnreadTotal]=React.useState(0);
  const bottomRef=React.useRef(null);
  const socketRef=React.useRef(null);
  const chatIdRef=React.useRef(null);

  // Keep chatIdRef in sync for socket handler
  React.useEffect(()=>{chatIdRef.current=chatId;},[chatId]);

  // Connect socket once
  React.useEffect(()=>{
    const s=socketIO('/',{path:'/socket.io',transports:['websocket','polling']});
    socketRef.current=s;
    s.on('chat_message',(msg)=>{
      if(msg.chat_id===chatIdRef.current||(!msg.chat_id&&msg.conversation_id===chatIdRef.current)){
        setMessages(prev=>{
          if(prev.find(m=>m.id===msg.id))return prev;
          return[...prev,msg];
        });
      }
      // Update unread badge in inbox
      setMyChats(prev=>prev.map(ch=>ch.id===msg.chat_id?{...ch,last_message:msg.body}:ch));
    });
    s.on('new_chat',()=>{
      setUnreadTotal(n=>n+1);
    });
    // Join buyer chat room when chatId is known
    return()=>s.disconnect();
  },[]);

  // Join/leave socket room on chatId change
  React.useEffect(()=>{
    if(chatId&&socketRef.current){
      socketRef.current.emit('join_chat',chatId);
    }
  },[chatId]);

  // Load messages
  React.useEffect(()=>{
    if(!chatId)return;
    setLoading(true);
    fetch(`/api/chat/${chatId}`)
      .then(r=>r.json())
      .then(d=>{if(d.success)setMessages(d.messages||[]);})
      .finally(()=>setLoading(false));
  },[chatId]);

  React.useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  // Poll fallback every 6s when chat open
  React.useEffect(()=>{
    if(!open||!chatId)return;
    const t=setInterval(()=>{
      fetch(`/api/chat/${chatId}`).then(r=>r.json()).then(d=>{if(d.success)setMessages(d.messages||[]);}).catch(()=>{});
    },6000);
    return()=>clearInterval(t);
  },[open,chatId]);

  // Poll inbox unread count
  React.useEffect(()=>{
    const t=setInterval(()=>{
      if(!getChatName())return;
      fetch(`/api/chat/session/${getChatSession()}`).then(r=>r.json()).then(d=>{
        if(d.success){
          const total=(d.chats||[]).reduce((s,ch)=>s+(ch.unread_buyer||0),0);
          setUnreadTotal(total);
        }
      }).catch(()=>{});
    },15000);
    return()=>clearInterval(t);
  },[]);

  const openChat=React.useCallback((prod)=>{
    setProduct(prod);setOpen(true);setView('chat');
    if(getChatName()){
      setStep('chat');
      const session=getChatSession();
      if(prod?.id){
        fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          product_type:prod.type,product_id:prod.id,product_name:prod.name,
          seller_id:prod.seller_id,seller_name:prod.seller_name,seller_phone:prod.seller_phone,
          buyer_name:getChatName(),buyer_session:session
        })}).then(r=>r.json()).then(d=>{if(d.success)setChatId(d.chat_id);}).catch(()=>{});
      }
    }else{setStep('identity');}
  },[]);

  const startChat=async()=>{
    if(!buyerName.trim()){setIdentErr('Enter your name to start chatting.');return;}
    const name=buyerName.trim();
    setChatIdentity(name);setBuyerName(name);setIdentErr('');setStep('chat');
    try{
      const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        product_type:product?.type||'product',product_id:product?.id,product_name:product?.name,
        seller_id:product?.seller_id,seller_name:product?.seller_name,seller_phone:product?.seller_phone,
        buyer_name:name,buyer_session:getChatSession(),
        first_message:`Hi, I am interested in ${product?.name||'your product'}. Is it available?`
      })});
      const d=await r.json();
      if(d.success){setChatId(d.chat_id);setMessages([]);}
    }catch(e){}
  };

  const sendMessage=async()=>{
    if(!draft.trim()||!chatId||sending)return;
    const body=draft.trim();setDraft('');setSending(true);
    try{
      const r=await fetch(`/api/chat/${chatId}/message`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender_type:'buyer',sender_name:getChatName(),body})});
      const d=await r.json();
      if(d.success)setMessages(prev=>[...prev,d.message]);
    }catch(e){}finally{setSending(false);}
  };

  const loadInbox=React.useCallback(()=>{
    setView('inbox');
    fetch(`/api/chat/session/${getChatSession()}`).then(r=>r.json()).then(d=>{if(d.success){setMyChats(d.chats||[]);const t=(d.chats||[]).reduce((s,c)=>s+(c.unread_buyer||0),0);setUnreadTotal(t);}}).catch(()=>{});
  },[]);

  const fmtTime=ts=>ts?new Date(ts).toLocaleTimeString('en-UG',{hour:'2-digit',minute:'2-digit'}):'';

  const widget=open?(
    <div style={{position:'fixed',bottom:80,right:16,width:340,maxHeight:'78vh',background:WHITE,border:`1px solid ${BORDER}`,borderRadius:14,boxShadow:'0 8px 40px rgba(0,0,0,.25)',zIndex:9000,display:'flex',flexDirection:'column',fontFamily:DM,overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${NAVY},${NAVY2})`,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'rgba(255,255,255,.15)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>💬</div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:WHITE,lineHeight:1.2}}>{view==='inbox'?'My Conversations':product?.name?product.name.slice(0,28)+(product.name.length>28?'…':''):'256 Mall Chat'}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,.55)'}}>{view==='inbox'?'All your chats':product?.seller_name?`Chatting with ${product.seller_name}`:'256 Mall'}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={view==='inbox'?()=>setView('chat'):loadInbox}
            style={{background:'rgba(255,255,255,.12)',border:'none',borderRadius:6,padding:'4px 8px',color:WHITE,fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:DM,position:'relative'}}>
            {view==='inbox'?'← Chat':'📬 Inbox'}
            {view!=='inbox'&&unreadTotal>0&&<span style={{position:'absolute',top:-4,right:-4,background:RED,color:WHITE,borderRadius:'50%',width:14,height:14,fontSize:8,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{unreadTotal}</span>}
          </button>
          <button onClick={()=>setOpen(false)} style={{background:'rgba(255,255,255,.12)',border:'none',borderRadius:'50%',width:24,height:24,color:WHITE,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
      </div>

      {view==='inbox'?(
        <div style={{flex:1,overflowY:'auto',padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:10,textTransform:'uppercase',letterSpacing:.8}}>Your conversations</div>
          {myChats.length===0
            ?<div style={{fontSize:13,color:MUTED,textAlign:'center',padding:'24px 0'}}>No chats yet.<br/><span style={{fontSize:11}}>Click "💬 Chat" on any product to start.</span></div>
            :myChats.map(ch=>(
              <div key={ch.id} onClick={()=>{setChatId(ch.id);setProduct({type:ch.product_type,id:ch.product_id,name:ch.product_name,seller_name:ch.seller_name});setView('chat');setStep('chat');}}
                style={{padding:'10px 12px',border:`1px solid ${ch.unread_buyer>0?YELLOW:BORDER}`,borderRadius:8,marginBottom:8,cursor:'pointer',background:ch.unread_buyer>0?'#fffbeb':'#f8fafc',transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f0f4ff'}
                onMouseLeave={e=>e.currentTarget.style.background=ch.unread_buyer>0?'#fffbeb':'#f8fafc'}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:ch.unread_buyer>0?700:600,color:TEXT,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.product_name||'Chat'}</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.seller_name}</div>
                    <div style={{fontSize:11,color:MUTED,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.last_message||'No messages yet'}</div>
                  </div>
                  {ch.unread_buyer>0&&<span style={{background:YELLOW,color:TEXT,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:10,flexShrink:0}}>{ch.unread_buyer} new</span>}
                </div>
              </div>
            ))}
        </div>
      ):step==='identity'?(
        <div style={{padding:20,flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:TEXT,marginBottom:6}}>Start your conversation</div>
          <div style={{fontSize:12,color:MUTED,marginBottom:14,lineHeight:1.5}}>Chatting with <strong>{product?.seller_name||'the seller'}</strong> about <strong>{product?.name}</strong></div>
          <div style={{fontSize:11,color:'#0369a1',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:6,padding:'8px 12px',marginBottom:14,lineHeight:1.5}}>
            🔒 Your phone number is private until you place an order.
          </div>
          {identErr&&<div style={{color:RED,fontSize:12,marginBottom:10}}>{identErr}</div>}
          <input placeholder="Your name *" value={buyerName} onChange={e=>setBuyerName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&startChat()}
            style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:6,padding:'10px 12px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:TEXT,marginBottom:14}}
            autoFocus/>
          <button onClick={startChat} style={{width:'100%',background:NAVY,color:WHITE,border:'none',borderRadius:8,padding:'11px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>Start Chatting →</button>
        </div>
      ):(
        <>
          {/* Product strip */}
          {product?.name&&(
            <div style={{background:'#f8fafc',borderBottom:`1px solid ${BORDER}`,padding:'7px 14px',flexShrink:0}}>
              <div style={{fontSize:11,fontWeight:600,color:TEXT,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>📦 {product.name}</div>
            </div>
          )}
          {/* Messages */}
          <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
            {loading?<div style={{textAlign:'center',color:MUTED,fontSize:13,padding:'20px 0'}}>Loading…</div>
            :messages.length===0?<div style={{textAlign:'center',color:MUTED,fontSize:13,padding:'20px 0'}}>No messages yet. Say hello! 👋</div>
            :messages.map(m=>{
              const isBuyer=m.sender_type==='buyer';
              return(
                <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:isBuyer?'flex-end':'flex-start'}}>
                  <div style={{maxWidth:'84%',background:isBuyer?NAVY:'#f3f4f6',color:isBuyer?WHITE:TEXT,borderRadius:isBuyer?'12px 12px 2px 12px':'12px 12px 12px 2px',padding:'8px 12px',fontSize:13,lineHeight:1.5,border:m.is_flagged?'2px solid #f59e0b':'none'}}>
                    {m.body}
                    {m.is_flagged&&(
                      <div style={{marginTop:6,padding:'5px 8px',background:'rgba(245,158,11,.15)',borderRadius:6,fontSize:10,color:'#92400e',fontWeight:600}}>
                        ⚠️ Flagged — all payments must go through 256 Mall to keep both parties protected.
                      </div>
                    )}
                  </div>
                  <div style={{fontSize:9,color:MUTED,marginTop:2}}>{isBuyer?'You':m.sender_name||'Seller'} · {fmtTime(m.created_at)}{m.is_read&&isBuyer?' · ✓':''}</div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>
          {/* Input */}
          <div style={{borderTop:`1px solid ${BORDER}`,padding:'9px 12px',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              style={{flex:1,border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 12px',fontSize:13,fontFamily:SF,outline:'none',color:TEXT,resize:'none',maxHeight:80,overflowY:'auto'}}/>
            <button onClick={sendMessage} disabled={!draft.trim()||sending}
              style={{background:draft.trim()?NAVY:'#e5e7eb',color:draft.trim()?WHITE:MUTED,border:'none',borderRadius:'50%',width:36,height:36,cursor:draft.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0,transition:'background .15s'}}>
              ➤
            </button>
          </div>
          <div style={{padding:'4px 14px 8px',fontSize:9,color:MUTED,textAlign:'center'}}>
            💳 All payments must go through 256 Mall — flagging any off-platform requests
          </div>
        </>
      )}
    </div>
  ):null;

  return(
    <ChatCtx.Provider value={{openChat,chatId,unreadTotal}}>
      {children}
      {widget}
      {!open&&(
        <button onClick={()=>{if(getChatName()){loadInbox();setView('inbox');}setOpen(true);}}
          data-chat-open="true"
          style={{position:'fixed',bottom:16,right:16,width:52,height:52,borderRadius:'50%',background:NAVY,color:WHITE,border:'none',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,.3)',zIndex:8999,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,transition:'transform .15s'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
          💬
          {unreadTotal>0&&<span style={{position:'absolute',top:0,right:0,background:RED,color:WHITE,borderRadius:'50%',width:18,height:18,fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{unreadTotal}</span>}
        </button>
      )}
    </ChatCtx.Provider>
  );
}
const useChat=()=>React.useContext(ChatCtx);


// ── Footer ────────────────────────────────────────────────────────────────────
function Footer(){
  const nav=useNavigate();
  return(
    <footer style={{fontFamily:BL,borderTop:'3px solid transparent',borderImage:`${GOLD_STRIP} 1`,borderImageSlice:1}}>
      <div style={{background:MG_GOLD_H,padding:'10px 0',textAlign:'center',borderBottom:'2px solid #000'}}>
        <span onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}
          style={{fontFamily:BLC,fontSize:13,color:'#000',cursor:'pointer',fontWeight:700,letterSpacing:.5}}>
          ↑ BACK TO TOP
        </span>
      </div>
      <div style={{background:'#000',padding:'40px 32px 24px',borderTop:'1px solid rgba(212,160,23,.2)'}}>
        <div className="footer-grid" style={{maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1fr',gap:32,marginBottom:32}}>
          <div>
            <div style={{fontFamily:BN,fontSize:28,letterSpacing:2,marginBottom:4}}>
            <span style={{background:MG_WHITE,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>256 </span>
            <span style={{background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>MALL</span>
          </div>
            <div style={{fontFamily:BLC,fontSize:11,color:'rgba(255,255,255,.5)',marginBottom:14,letterSpacing:.5}}>Uganda's Largest Online Mall</div>
            <p style={{fontFamily:BL,fontSize:13,color:'rgba(255,255,255,.6)',lineHeight:1.8,margin:0}}>Delivering to all 146 districts. Pay with MTN MoMo or Airtel Money. Verified Ugandan sellers only.</p>
          </div>
          {[
            {t:'Get to Know Us',links:[['About 256 Mall','/'],['Careers','/'],['Press Releases','/'],['Sell on 256 Mall','/sell']]},
            {t:'Make Money with Us',links:[['Sell on 256 Mall','/sell'],['Seller Dashboard','/account'],['Advertise Your Products','/'],['Become an Affiliate','/']]},
            {t:'Payment & Delivery',links:[['MTN MoMo','/'],['Airtel Money','/'],['Delivery Rates','/'],['Track Your Order','/track']]},
            {t:'Let Us Help You',links:[['Your Account','/account'],['Your Orders','/track'],['Returns Policy','/'],['Help','/'],['Contact Us','/']]},
          ].map(col=>(
            <div key={col.t}>
              <div style={{fontFamily:BLC,fontSize:12,fontWeight:700,color:'#FFD700',marginBottom:14,letterSpacing:1,textTransform:'uppercase'}}>{col.t}</div>
              {col.links.map(([l,p])=>(
                <div key={l} onClick={()=>nav(p)} style={{fontFamily:BL,fontSize:13,color:'rgba(255,255,255,.55)',marginBottom:9,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.color='#FFD700'}
                  onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.55)'}>{l}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#000',borderTop:'1px solid rgba(212,160,23,.2)',padding:'14px 32px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
        <div style={{fontFamily:BN,fontSize:22,letterSpacing:2}}>
          <span style={{background:MG_WHITE,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>256 </span>
          <span style={{background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>MALL</span>
        </div>
        <div style={{fontFamily:BLC,fontSize:12,color:'rgba(255,255,255,.4)',textAlign:'center',letterSpacing:.5}}>
          © 2026 256 Mall · A product of 256 AI Systems · Uganda's National E-Commerce Platform
        </div>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          {['Privacy','Terms','Cookies'].map(l=>(
            <span key={l} style={{fontFamily:BLC,fontSize:12,color:'rgba(255,255,255,.4)',cursor:'pointer'}}
              onMouseEnter={e=>e.currentTarget.style.color='#FFD700'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.4)'}>{l}</span>
          ))}
          <span onClick={()=>nav('/admin/review')} style={{fontFamily:BLC,fontSize:11,color:'rgba(255,255,255,.15)',cursor:'pointer',borderLeft:'1px solid rgba(255,255,255,.1)',paddingLeft:16}}
            onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.4)'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.15)'}>Staff</span>
        </div>
      </div>
      {/* Metal stripe at very bottom */}
      <div style={{height:4,background:METAL_STRIPE}}/>
    </footer>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
function LandingPage({cart}){
  const nav=useNavigate();
  const [products,setProducts]=useState([]);
  const rowRef=useRef(null);
  useEffect(()=>{
    fetch('/api/products?limit=12&sort=popular').then(r=>r.json()).then(d=>setProducts(d.products||[])).catch(()=>{});
  },[]);
  const scroll=dir=>{if(rowRef.current)rowRef.current.scrollBy({left:dir*420,behavior:'smooth'});};

  const SECTIONS=[
    {title:'256 Fresh Market',badge:'Meats & Produce',path:'/produce',cta:'Shop Fresh Market',items:[
      {label:'Beef & Meat',img:'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=200&h=200&fit=crop'},
      {label:'Fish & Seafood',img:'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=200&h=200&fit=crop'},
      {label:'Vegetables',img:'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=200&h=200&fit=crop'},
      {label:'Dairy & Eggs',img:'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&h=200&fit=crop'},
    ]},
    {title:'Animal Market',badge:'GPS Verified',path:'/animals',cta:'Browse animals',items:[
      {label:'Cattle',img:'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=200&h=200&fit=crop'},
      {label:'Goats',img:'https://images.unsplash.com/photo-1598021680151-46e7d2d5d98f?w=200&h=200&fit=crop'},
      {label:'Poultry',img:'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200&h=200&fit=crop'},
      {label:'Pigs',img:'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&h=200&fit=crop'},
    ]},
    {title:'Electronics',badge:'Phones & Tech',path:'/category/electronics',cta:'Shop electronics',items:[
      {label:'Smartphones',img:'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=200&h=200&fit=crop'},
      {label:'Laptops',img:'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop'},
      {label:'Smart TVs',img:'https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=200&h=200&fit=crop'},
      {label:'Headphones',img:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop'},
    ]},
    {title:'Fashion',badge:'All Styles',path:'/category/womens-fashion',cta:'Shop fashion',items:[
      {label:"Women's Wear",img:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop'},
      {label:"Men's Wear",img:'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=200&h=200&fit=crop'},
      {label:'Shoes',img:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop'},
      {label:'African Wear',img:'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=200&h=200&fit=crop'},
    ]},
    {title:'Beauty & Personal Care',badge:'Skincare & More',path:'/category/beauty',cta:'Shop beauty',items:[
      {label:'Skincare',img:'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop'},
      {label:'Hair Care',img:'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=200&h=200&fit=crop'},
      {label:'Makeup',img:'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=200&h=200&fit=crop'},
      {label:'Perfumes',img:'https://images.unsplash.com/photo-1541643600914-78b084683702?w=200&h=200&fit=crop'},
    ]},
    {title:'Health & Pharmacy',badge:'OTC & Wellness',path:'/category/health',cta:'Shop health',items:[
      {label:'Medicines',img:'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&h=200&fit=crop'},
      {label:'Supplements',img:'https://images.unsplash.com/photo-1550572017-edd951b55104?w=200&h=200&fit=crop'},
      {label:'Medical Devices',img:'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=200&h=200&fit=crop'},
      {label:'Herbal Products',img:'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200&h=200&fit=crop'},
    ]},
    {title:'Baby, Kids & Toys',badge:'Ages 0–14',path:'/category/baby-kids',cta:'Shop kids',items:[
      {label:'Baby Care',img:'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=200&h=200&fit=crop'},
      {label:'Kids Fashion',img:'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=200&h=200&fit=crop'},
      {label:'Toys',img:'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=200&h=200&fit=crop'},
      {label:'Bikes & Ride-ons',img:'https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=200&h=200&fit=crop'},
    ]},
    {title:'Home & Kitchen',badge:'Home Essentials',path:'/category/home-kitchen',cta:'Shop home',items:[
      {label:'Furniture',img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop'},
      {label:'Cookware',img:'https://images.unsplash.com/photo-1585515320310-259814833e62?w=200&h=200&fit=crop'},
      {label:'Appliances',img:'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=200&h=200&fit=crop'},
      {label:'Bedding',img:'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=200&h=200&fit=crop'},
    ]},
    {title:'Automotive',badge:'Cars & Vehicles',path:'/category/automotive',cta:'Shop automotive',items:[
      {label:'Car Parts',img:'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200&h=200&fit=crop'},
      {label:'Tyres',img:'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&h=200&fit=crop'},
      {label:'Accessories',img:'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=200&h=200&fit=crop'},
      {label:'Tools',img:'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=200&h=200&fit=crop'},
    ]},
    {title:'Tools & Industrial',badge:'Trade & Industry',path:'/category/tools',cta:'Shop tools',items:[
      {label:'Hand Tools',img:'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=200&h=200&fit=crop'},
      {label:'Power Tools',img:'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&h=200&fit=crop'},
      {label:'Safety Gear',img:'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=200&h=200&fit=crop'},
      {label:'Generators',img:'https://images.unsplash.com/photo-1589771243083-4b69f96eb2f2?w=200&h=200&fit=crop'},
    ]},
    {title:'Wholesale Trade',badge:'B2B Platform',path:'/wholesale',cta:'Browse wholesale',items:[
      {label:'Electronics',img:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop'},
      {label:'Fabrics & Textiles',img:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop'},
      {label:'Food & Grains',img:'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=200&h=200&fit=crop'},
      {label:'Hardware',img:'https://images.unsplash.com/photo-1553413077-190dd305871c?w=200&h=200&fit=crop'},
    ]},
    {title:'Export Hub',badge:'FOB Prices',path:'/export',cta:'View export hub',items:[
      {label:'Coffee',img:'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&h=200&fit=crop'},
      {label:'Vanilla',img:'https://images.unsplash.com/photo-1628191081676-8d5d5b9aaff8?w=200&h=200&fit=crop'},
      {label:'Cocoa',img:'https://images.unsplash.com/photo-1481391319764-2c4c2a9ec66c?w=200&h=200&fit=crop'},
      {label:'Simsim & Tea',img:'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=200&h=200&fit=crop'},
    ]},
    {title:'Real Estate',badge:'Buy · Rent · Lease',path:'/realestate',cta:'Browse real estate',items:[
      {label:'Houses for Sale',img:'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=200&h=200&fit=crop'},
      {label:'Houses for Rent',img:'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=200&h=200&fit=crop'},
      {label:'Land for Sale',img:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&h=200&fit=crop'},
      {label:'Farm Land',img:'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=200&h=200&fit=crop'},
    ]},
    {title:'Business Directory',badge:'All Districts',path:'/directory',cta:'Browse directory',items:[
      {label:'Kampala Shops',img:'https://images.unsplash.com/photo-1553413077-190dd305871c?w=200&h=200&fit=crop'},
      {label:'Wholesalers',img:'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&h=200&fit=crop'},
      {label:'Restaurants',img:'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&h=200&fit=crop'},
      {label:'Services',img:'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=200&h=200&fit=crop'},
    ]},
    {title:'Uganda Made',badge:'Shop Local 🇺🇬',path:'/products',cta:'Shop Uganda Made',items:[
      {label:'Crafts & Baskets',img:'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=200&h=200&fit=crop'},
      {label:'Kitenge Fashion',img:'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&h=200&fit=crop'},
      {label:'Coffee & Honey',img:'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&h=200&fit=crop'},
      {label:'Shea & Beauty',img:'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=200&h=200&fit=crop'},
    ]},
  ];

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#0d1b2a 0%,#1a2e4a 50%,#0d1b2a 100%)',padding:'72px 32px',textAlign:'center'}}>
        <div style={{maxWidth:780,margin:'0 auto'}}>
          <div style={{fontSize:13,color:YELLOW,fontWeight:700,letterSpacing:3,marginBottom:14,textTransform:'uppercase'}}>🇺🇬 Uganda's National E-Commerce Platform</div>
          <h1 style={{fontSize:54,fontWeight:900,color:WHITE,margin:'0 0 20px',lineHeight:1.1}}>
            One Mall.<br/><span style={{color:YELLOW}}>Everything Uganda.</span>
          </h1>
          <p style={{fontSize:18,color:'#c0c8d4',margin:'0 0 36px',lineHeight:1.7}}>
            Fresh produce · Live animals · Wholesale trade · Export commodities<br/>
            Electronics, fashion, home — all from verified Ugandan sellers.
          </p>
          <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
            <button onClick={()=>nav('/products')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'15px 34px',fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
              🛍️ Shop All Products
            </button>
            <button onClick={()=>nav('/produce')} style={{background:'rgba(255,255,255,.1)',color:WHITE,border:'1px solid rgba(255,255,255,.35)',borderRadius:4,padding:'15px 28px',fontSize:16,cursor:'pointer',fontFamily:DM}}>
              🥬 Fresh Market
            </button>
            <button onClick={()=>nav('/wholesale')} style={{background:'rgba(255,255,255,.1)',color:WHITE,border:'1px solid rgba(255,255,255,.35)',borderRadius:4,padding:'15px 28px',fontSize:16,cursor:'pointer',fontFamily:DM}}>
              🏭 Wholesale
            </button>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{background:'#37475A',padding:'11px 32px',display:'flex',justifyContent:'center',gap:36,flexWrap:'wrap'}}>
        {[['🚚','Free delivery over UGX 100,000'],['📱','MTN MoMo & Airtel Money'],['🔒','Verified Sellers Only'],['🇺🇬','All 146 Districts']].map(([icon,text])=>(
          <div key={text} style={{display:'flex',alignItems:'center',gap:8,color:WHITE,fontSize:13,whiteSpace:'nowrap'}}><span>{icon}</span><span>{text}</span></div>
        ))}
      </div>

      <div style={{maxWidth:1280,margin:'0 auto',padding:'28px 16px'}}>

        {/* What We Carry — Amazon-style 4-image cards */}
        <div style={{marginBottom:24}}>
          <h2 style={{fontSize:22,fontWeight:700,color:TEXT,margin:'0 0 16px'}}>What We Carry</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
            {SECTIONS.map(s=>(
              <div key={s.path} onClick={()=>nav(s.path)}
                style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:4,padding:'16px 14px 14px',cursor:'pointer',transition:'box-shadow .2s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 18px rgba(0,0,0,.14)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:3,lineHeight:1.2}}>{s.title}</div>
                <div style={{fontSize:11,color:MUTED,marginBottom:10}}>{s.badge}</div>
                {/* 2×2 image grid — replace each img src with your own photo */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
                  {s.items.map(item=>(
                    <div key={item.label}>
                      <div style={{width:'100%',paddingBottom:'100%',position:'relative',overflow:'hidden',borderRadius:3,background:'#f0f0f0'}}>
                        <img src={item.img} alt={item.label}
                          style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                      </div>
                      <div style={{fontSize:11,color:TEXT,marginTop:4,lineHeight:1.3}}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <span style={{fontSize:13,color:LINK,fontWeight:600}}>{s.cta} →</span>
              </div>
            ))}
          </div>
        </div>


        {/* Featured products */}
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:'22px 26px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style={{fontSize:20,fontWeight:700,color:TEXT,margin:0}}>⭐ Featured Products</h2>
            <span onClick={()=>nav('/products')} style={{fontSize:13,color:LINK,cursor:'pointer'}}>Shop all products →</span>
          </div>
          <div style={{position:'relative'}}>
            <button className="scroll-btn" onClick={()=>scroll(-1)} style={{position:'absolute',left:-16,top:'50%',transform:'translateY(-50%)',zIndex:10,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            <div ref={rowRef} className="product-row" style={{display:'flex',flexWrap:'nowrap',gap:12,overflowX:'auto',scrollbarWidth:'none',padding:'4px 2px'}}>
              {products.length>0
                ?products.map(p=><PCard key={p.id} p={p} onAdd={cart.add}/>)
                :<EmptyProductRow message="No live featured products yet." action="View product listings" path="/products"/>}
            </div>
            <button className="scroll-btn" onClick={()=>scroll(1)} style={{position:'absolute',right:-16,top:'50%',transform:'translateY(-50%)',zIndex:10,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.15)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
          </div>
        </div>

        {/* All category product rows */}
        {ROWS.slice(0,4).map(r=><HRow key={r.title} {...r} cart={cart}/>)}

        {/* Farmer + Seller CTAs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:8}}>
          <div style={{background:'linear-gradient(135deg,#0a3300 0%,#1a5200 100%)',borderRadius:8,padding:'30px 28px',border:'1px solid #2a6a00'}}>
            <div style={{fontSize:36,marginBottom:12}}>🌾</div>
            <h3 style={{fontSize:20,fontWeight:700,color:WHITE,margin:'0 0 8px'}}>Are you a farmer?</h3>
            <p style={{fontSize:13,color:'#90ee90',margin:'0 0 20px',lineHeight:1.65}}>List your produce, meat and live animals. Reach buyers in all 146 districts. Free to join.</p>
            <button onClick={()=>nav('/farmers/join')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'11px 22px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
              Join as Farmer →
            </button>
          </div>
          <div style={{background:NAVY2,borderRadius:8,padding:'30px 28px',border:`1px solid #3a4a5a`}}>
            <div style={{fontSize:36,marginBottom:12}}>🏪</div>
            <h3 style={{fontSize:20,fontWeight:700,color:WHITE,margin:'0 0 8px'}}>Sell on 256 Mall</h3>
            <p style={{fontSize:13,color:'#aaa',margin:'0 0 20px',lineHeight:1.65}}>Zero listing fees. Reach 45 million Ugandans. Get paid instantly via MTN MoMo or Airtel Money.</p>
            <button onClick={()=>nav('/sell')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'11px 22px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
              Start Selling Free →
            </button>
          </div>
        </div>

        {ROWS.slice(4,12).map(r=><HRow key={r.title} {...r} cart={cart}/>)}

        {/* Stats */}
        <div style={{background:WHITE,borderRadius:8,padding:'24px 32px',marginBottom:8,display:'grid',gridTemplateColumns:'var(--cols-4)',gap:0,border:`1px solid ${BORDER}`,textAlign:'center'}}>
          {[['10,000+','Products Listed'],['146','Districts Served'],['500+','Verified Sellers'],['24/7','Customer Support']].map(([n,l],i)=>(
            <div key={l} style={{borderRight:i<3?`1px solid ${BORDER}`:undefined,padding:'0 16px'}}>
              <div style={{fontSize:28,fontWeight:800,color:TEXT}}>{n}</div>
              <div style={{fontSize:13,color:MUTED,marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>

        {ROWS.slice(12).map(r=><HRow key={r.title} {...r} cart={cart}/>)}

        {/* Sell CTA bottom */}
        <div style={{background:NAVY2,borderRadius:8,padding:'32px 36px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:24,border:`1px solid ${BORDER}`}}>
          <div>
            <h3 style={{fontSize:22,fontWeight:700,color:WHITE,margin:'0 0 8px'}}>Start selling on 256 Mall</h3>
            <p style={{fontSize:14,color:'#aaa',margin:0}}>Reach 45 million Ugandans. Zero listing fees. Get paid via MTN MoMo.</p>
          </div>
          <div style={{display:'flex',gap:12}}>
            <button onClick={()=>nav('/sell')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'12px 24px',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
              Start Selling Free →
            </button>
            <button onClick={()=>nav('/products')} style={{background:'transparent',color:WHITE,border:'1px solid #555',borderRadius:4,padding:'12px 24px',fontSize:15,cursor:'pointer',fontFamily:DM}}>
              Browse Products
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
// ── Twin Banner ───────────────────────────────────────────────────────────────
function TwinBanner({panels}){
  const nav=useNavigate();
  return(
    <div style={{display:'grid',gridTemplateColumns:'var(--cols-twin)',gap:12,marginBottom:8,fontFamily:DM}}>
      {panels.map((d,i)=>(
        <div key={i} onClick={()=>nav(d.path)}
          style={{position:'relative',height:224,borderRadius:4,overflow:'hidden',cursor:'pointer',border:`1px solid ${BORDER}`}}
          onMouseEnter={e=>{const img=e.currentTarget.querySelector('img');if(img)img.style.transform='scale(1.05)';}}
          onMouseLeave={e=>{const img=e.currentTarget.querySelector('img');if(img)img.style.transform='scale(1)';}}>
          <img src={d.img} alt={d.title} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .5s',display:'block'}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(140deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.08) 65%)'}}/>
          <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,padding:'22px 24px',display:'flex',flexDirection:'column'}}>
            {d.label&&<div style={{fontSize:10,color:'rgba(255,255,255,.72)',fontWeight:800,letterSpacing:2,textTransform:'uppercase',marginBottom:8}}>{d.label}</div>}
            <div style={{fontSize:21,fontWeight:900,color:'#fff',marginBottom:8,lineHeight:1.15,maxWidth:280}}>{d.title}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.78)',lineHeight:1.6,maxWidth:290,marginBottom:'auto'}}>{d.sub}</div>
            <div style={{marginTop:18,alignSelf:'flex-start',background:d.ac||'#FFD814',color:d.dark?'#111':'#fff',fontSize:13,fontWeight:700,padding:'9px 20px',borderRadius:3,boxShadow:'0 3px 12px rgba(0,0,0,.4)'}}>
              {d.cta} →
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Uganda Brands Section ─────────────────────────────────────────────────────
function UgandaBrandsSection({cart}){
  const nav=useNavigate();
  const [products,setProducts]=useState([]);
  const rowRef=useRef(null);
  useEffect(()=>{
    fetch('/api/products?uganda_made=true&limit=12').then(r=>r.json()).then(d=>setProducts(d.products||[])).catch(()=>{});
  },[]);
  const scroll=dir=>{if(rowRef.current)rowRef.current.scrollBy({left:dir*420,behavior:'smooth'});};

  const BRANDS=[
    {name:'Uganda Coffee',icon:'☕',cat:'Premium Arabica & Robusta',badge:'Export Grade',img:'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=420&h=160&fit=crop&q=80',path:'/category/agriculture'},
    {name:'African Fashion',icon:'👗',cat:'Kitenges & Ankara Prints',badge:'100% Local',img:'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=420&h=160&fit=crop&q=80',path:'/category/african-fashion'},
    {name:'Handmade Crafts',icon:'🪘',cat:'Baskets, Beads & Art',badge:'Artisan Made',img:'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?w=420&h=160&fit=crop&q=80',path:'/category/arts-crafts'},
    {name:'Farm Produce',icon:'🌾',cat:'Direct from Uganda Farms',badge:'Farm Fresh',img:'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=420&h=160&fit=crop&q=80',path:'/produce'},
  ];

  return(
    <div style={{background:MG_BLACK,padding:'28px 32px 32px',fontFamily:BL,position:'relative',borderTop:'3px solid transparent',borderImage:`${GOLD_STRIP} 1`,borderImageSlice:1}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:14,borderBottom:'1px solid rgba(212,160,23,.3)'}}>
        <div>
          <div style={{fontFamily:BLC,fontSize:12,color:'rgba(255,255,255,.45)',textTransform:'uppercase',letterSpacing:2,marginBottom:4}}>Proudly Ugandan</div>
          <div style={{fontFamily:BN,fontSize:40,letterSpacing:1,
            background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>🇺🇬 UGANDAN BRANDS</div>
        </div>
        <span onClick={()=>nav('/products')} style={{fontFamily:BLC,fontSize:12,color:'#FFD700',cursor:'pointer',fontWeight:700,letterSpacing:.5,textTransform:'uppercase',borderBottom:'3px solid #D4A017',paddingBottom:2}}>Discover More →</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'var(--cols-4)',gap:12,marginBottom:22}}>
        {BRANDS.map(b=>(
          <div key={b.name} onClick={()=>nav(b.path)}
            style={{background:MG_BLACK,border:'1px solid #D4A017',borderRadius:6,overflow:'hidden',cursor:'pointer',transition:'transform .2s,box-shadow .2s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.4)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
            <div style={{height:3,background:GOLD_STRIP}}/>
            <div style={{position:'relative',height:110,overflow:'hidden'}}>
              <img src={b.img} alt={b.name} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform .4s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.07)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.7) 0%,rgba(0,0,0,.1) 60%)'}}/>
              <span style={{position:'absolute',top:7,right:7,background:MG_GOLD,color:'#1A0F00',fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:10,fontFamily:BLC,letterSpacing:.5}}>{b.badge}</span>
            </div>
            <div style={{padding:'10px 12px 14px'}}>
              <div style={{fontFamily:BN,fontSize:18,letterSpacing:.5,marginBottom:2,
                background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{b.icon} {b.name}</div>
              <div style={{fontFamily:BLC,fontSize:11,color:'rgba(255,255,255,.55)',marginBottom:8}}>{b.cat}</div>
              <span style={{fontFamily:BLC,fontSize:11,fontWeight:800,color:'#1A0F00',letterSpacing:.5,textTransform:'uppercase',
                background:MG_GOLD,padding:'4px 10px',borderRadius:3,cursor:'pointer'}}>Shop Now →</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{position:'relative'}}>
        <button className="scroll-btn" onClick={()=>scroll(-1)} style={{position:'absolute',left:-16,top:'50%',transform:'translateY(-50%)',zIndex:10,background:'#fff',border:'1px solid #ddd',borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.3)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
        <div ref={rowRef} className="product-row" style={{display:'flex',flexWrap:'nowrap',gap:12,overflowX:'auto',scrollbarWidth:'none',padding:'4px 2px'}}>
          {products.length>0
            ?products.map(p=><PCard key={p.id} p={p} onAdd={cart.add}/>)
            :<EmptyProductRow message="No live Uganda Made products yet." action="View product listings" path="/products"/>}
        </div>
        <button className="scroll-btn" onClick={()=>scroll(1)} style={{position:'absolute',right:-16,top:'50%',transform:'translateY(-50%)',zIndex:10,background:'#fff',border:'1px solid #ddd',borderRadius:'50%',width:38,height:38,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,.3)',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
      </div>
    </div>
  );
}


const ROWS=[
  {title:'Best Sellers',flag:'featured',seeAll:'/products'},
  {title:'Electronics & Gadgets',slug:'electronics',badge:'HOT'},
  {title:'Computers & Laptops',slug:'computers'},
  {title:'Smart Home',slug:'smart-home'},
  {title:'Arts & Crafts',slug:'arts-crafts'},
  {title:'Automotive',slug:'automotive'},
  {title:'Baby & Kids',slug:'baby-kids'},
  {title:'Beauty & Personal Care',slug:'beauty'},
  {title:"Women's Fashion",slug:'womens-fashion'},
  {title:"Men's Fashion",slug:'mens-fashion'},
  {title:"Girls' Fashion",slug:'girls-fashion'},
  {title:"Boys' Fashion",slug:'boys-fashion'},
  {title:'Health & Household',slug:'health'},
  {title:'Home & Kitchen',slug:'home-kitchen'},
  {title:'Industrial & Scientific',slug:'industrial'},
  {title:'Luggage & Travel',slug:'luggage'},
  {title:'Movies & Television',slug:'movies-tv'},
  {title:'Pet Supplies',slug:'pets'},
  {title:'Sports & Outdoors',slug:'sports'},
  {title:'Tools & Home Improvement',slug:'tools'},
  {title:'Toys & Games',slug:'toys-games'},
  {title:'Video Games',slug:'video-games'},
  {title:'Uganda Fresh Produce',slug:'fresh-produce'},
  {title:'Agriculture & Farming',slug:'agriculture',badge:'🇺🇬'},
  {title:'African Fashion & Crafts',slug:'african-fashion',badge:'LOCAL'},
];

function HomePage({cart}){
  const nav=useNavigate();
  const GS=()=><div style={{height:4,background:GOLD_STRIP}}/>;

  const BANNER_A=[
    {label:'Electronics',title:'Latest Phones & Tech',sub:"Samsung, Tecno, Itel, HP — Uganda's best prices guaranteed",
     img:'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=720&h=240&fit=crop&q=80',
     ac:'#60a5fa',dark:false,cta:'Shop Electronics',path:'/category/electronics'},
    {label:"Women's · Men's · African Fashion",title:'Fashion for Every Style',sub:'Kitenges, Ankara prints, designer wear, African streetwear',
     img:'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=720&h=240&fit=crop&q=80',
     ac:'#FFD814',dark:true,cta:'Shop Fashion',path:'/category/womens-fashion'},
  ];
  const BANNER_B=[
    {label:'256 Fresh Market',title:'Farm-Fresh Meat & Produce',sub:'Beef, pork, chicken, Nile perch, fresh milk — delivered daily',
     img:'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=720&h=240&fit=crop&q=80',
     ac:'#4ade80',dark:false,cta:'Shop Fresh Market',path:'/produce'},
    {label:'Live Animal Market',title:'Cattle, Goats & Poultry',sub:'GPS-verified farms · Health-certified · All 146 districts',
     img:'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=720&h=240&fit=crop&q=80',
     ac:'#f59e0b',dark:true,cta:'Visit Animal Market',path:'/animals'},
  ];
  const BANNER_C=[
    {label:'Uganda Wholesale Trade Hub',title:'B2B Marketplace',sub:'Browse catalogues · View MOQ pricing · Negotiate on-platform',
     img:'https://images.unsplash.com/photo-1553413077-190dd305871c?w=720&h=240&fit=crop&q=80',
     ac:'#a78bfa',dark:false,cta:'Browse Wholesale',path:'/wholesale'},
    {label:'Export Hub — FOB Mombasa & Entebbe',title:'Uganda Export Commodities',sub:'Coffee · Vanilla · Cocoa · Simsim · Tea — live USD pricing',
     img:'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=720&h=240&fit=crop&q=80',
     ac:'#FF9900',dark:false,cta:'View Export Hub',path:'/export'},
  ];

  const CATS=[
    {icon:'🥬',name:'Fresh Market',path:'/produce',subs:['🥩 Meat','🐟 Fish','🥦 Veggies','🥛 Dairy']},
    {icon:'🐄',name:'Animals',path:'/animals',subs:['🐄 Cattle','🐐 Goats','🐓 Poultry','🐖 Pigs']},
    {icon:'📱',name:'Electronics',path:'/category/electronics',subs:['📱 Phones','📺 TVs','🎧 Audio','⌨️ Accessories']},
    {icon:'💻',name:'Computers',path:'/category/computers',subs:['💻 Laptops','🖥️ Desktops','🖨️ Printers','💾 Storage']},
    {icon:'👗',name:"Women's",path:'/category/womens-fashion',subs:['👗 Dresses','👠 Shoes','👜 Bags','🧣 Accessories']},
    {icon:'👔',name:"Men's Fashion",path:'/category/mens-fashion',subs:['👔 Shirts','👖 Trousers','👞 Shoes','⌚ Watches']},
    {icon:'👶',name:'Baby & Kids',path:'/category/baby-kids',subs:['🍼 Baby Care','👶 Clothes','🧸 Toys','🚲 Ride-ons']},
    {icon:'💄',name:'Beauty',path:'/category/beauty',subs:['🧴 Skincare','💅 Makeup','💇 Hair','🌸 Fragrance']},
    {icon:'💊',name:'Health',path:'/category/health',subs:['💊 Medicines','🌿 Supplements','🩺 Devices','🧼 Hygiene']},
    {icon:'🏡',name:'Home & Kitchen',path:'/category/home-kitchen',subs:['🛋️ Furniture','🍳 Cookware','🧺 Bedding','🔌 Appliances']},
    {icon:'⚽',name:'Sports',path:'/category/sports',subs:['⚽ Team Sports','🏋️ Fitness','🎽 Sportswear','🏕️ Outdoor']},
    {icon:'🌾',name:'Agriculture',path:'/category/agriculture',subs:['🌱 Seeds','💧 Irrigation','🪣 Tools','🐄 Livestock']},
    {icon:'🏘️',name:'Real Estate',path:'/realestate',subs:['🏠 Houses','🏢 Apartments','🌳 Land','🏭 Commercial']},
    {icon:'🏭',name:'Wholesale',path:'/wholesale',subs:['📦 Bulk Food','🧱 Building','🔩 Industrial','🧴 Packaged']},
    {icon:'🪘',name:'Uganda Made',path:'/products',subs:['🪘 Crafts','👗 Fashion','☕ Coffee','🍯 Honey']},
  ];

  return(
    <div style={{background:'linear-gradient(180deg,#f8f8f8,#eeeeee,#f5f5f5,#e8e8e8)',minHeight:'100vh',fontFamily:BL,backgroundAttachment:'fixed'}}>

      {/* ── Hero Slider ── */}
      <HeroSlider/>
      <GS/>

      {/* ── Stats Strip ── */}
      <div style={{background:'linear-gradient(135deg,#7B5E00 0%,#C8980A 8%,#FFE566 18%,#FFF0A0 26%,#FFD700 34%,#E8B820 42%,#FFF3B0 50%,#D4A017 58%,#FFE033 68%,#C8980A 78%,#FFE566 88%,#8B6E00 100%)',borderBottom:'3px solid #8B6E00',borderTop:'3px solid #8B6E00',boxShadow:'0 2px 16px rgba(200,152,10,.45),inset 0 1px 0 rgba(255,255,255,.35)'}}>
        <div style={{maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'var(--cols-4)'}}>
          {[['10,000+','Products Listed'],['146','Districts Served'],['500+','Verified Sellers'],['24/7','Customer Support']].map(([n,l],i)=>(
            <div key={l} style={{padding:'20px 24px',borderRight:i<3?'1px solid rgba(139,110,0,.4)':undefined,textAlign:'center'}}>
              <div className="stat-shimmer-dark" style={{
                fontFamily:"'Playfair Display',Georgia,serif",
                fontWeight:900,fontSize:38,lineHeight:1,letterSpacing:1,marginBottom:4,
                background:'linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 15%,#000 28%,#3a3a3a 40%,#111 52%,#2d2d2d 64%,#000 76%,#1e1e1e 88%,#050505 100%)',
                backgroundSize:'200% auto',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{n}</div>
              <div style={{fontFamily:"'Playfair Display',Georgia,serif",fontWeight:700,fontSize:13,
                background:'linear-gradient(135deg,#000 0%,#1a1a1a 40%,#333 60%,#000 100%)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
                letterSpacing:.3,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes shimmer-dark{0%{background-position:-200% center}100%{background-position:200% center}}.stat-shimmer-dark{animation:shimmer-dark 3s linear infinite}`}</style>
      <GS/>

      {/* ── Deal of the Day ── */}
      <div style={{maxWidth:1280,margin:'0 auto',padding:'12px 16px 0'}}>
        <DealOfDay cart={cart}/>
      </div>
      <GS/>

      {/* ── Trust Bar ── */}
      <div className="resp-outer" style={{padding:'16px 48px',background:'linear-gradient(135deg,#fff 0%,#f8f8f8 100%)'}}>
        <div style={{maxWidth:1280,margin:'0 auto',background:MG_GOLD_H,borderRadius:6,border:'1px solid rgba(255,215,0,.5)',padding:'16px 24px'}}>
          <div style={{display:'grid',gridTemplateColumns:'var(--cols-4)',gap:0}}>
            {[['✅','Verified Sellers','Every seller is vetted'],['🚚','Fast Delivery','All 146 districts'],['📱','Mobile Payments','MoMo & Airtel'],['🔒','Buyer Protection','Secure transactions']].map(([ic,ttl,sub],i)=>(
              <div key={ttl} style={{display:'flex',alignItems:'center',gap:10,padding:'0 16px',borderRight:i<3?'1px solid rgba(0,0,0,.12)':undefined}}>
                <div style={{fontSize:22}}>{ic}</div>
                <div>
                  <div style={{fontFamily:BLC,fontSize:13,fontWeight:800,color:'#1A0F00',letterSpacing:.5}}>{ttl}</div>
                  <div style={{fontFamily:BL,fontSize:11,color:'rgba(0,0,0,.55)'}}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <GS/>

      {/* ── What We Carry ── */}
      <section className="wc-section">
        <div className="wc-header">
          <div>
            <div className="wc-eyebrow">Browse All</div>
            <div className="wc-title">What We Carry</div>
          </div>
          <a className="wc-view-all" href="/products">View All →</a>
        </div>
        <div className="wc-grid">

          <div className="wc-card">
            <div className="wc-card-header">256 Fresh Market</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1558030006-450675393462?w=200&h=200&fit=crop&auto=format" alt="Beef"/><div className="wc-sub-label">Beef &amp; Meat</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1534482421-64566f976cfa?w=200&h=200&fit=crop&auto=format" alt="Fish"/><div className="wc-sub-label">Fish &amp; Seafood</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=200&fit=crop&auto=format" alt="Vegetables"/><div className="wc-sub-label">Vegetables</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=200&h=200&fit=crop&auto=format" alt="Dairy"/><div className="wc-sub-label">Dairy &amp; Eggs</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/produce">Shop Fresh Market →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Animal Market</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=200&h=200&fit=crop&auto=format" alt="Cattle"/><div className="wc-sub-label">Cattle</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&h=200&fit=crop&auto=format" alt="Goats"/><div className="wc-sub-label">Goats</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=200&h=200&fit=crop&auto=format" alt="Poultry"/><div className="wc-sub-label">Poultry</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1585664811087-47f65abbad64?w=200&h=200&fit=crop&auto=format" alt="Pigs"/><div className="wc-sub-label">Pigs</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/animals">Browse Animals →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Electronics</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop&auto=format" alt="Smartphones"/><div className="wc-sub-label">Smartphones</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop&auto=format" alt="Laptops"/><div className="wc-sub-label">Laptops</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1593359677879-a4bb92f4834f?w=200&h=200&fit=crop&auto=format" alt="Smart TVs"/><div className="wc-sub-label">Smart TVs</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&auto=format" alt="Headphones"/><div className="wc-sub-label">Headphones</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/electronics">Shop Electronics →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Fashion</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=200&h=200&fit=crop&auto=format" alt="Women"/><div className="wc-sub-label">Women's Wear</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=200&h=200&fit=crop&auto=format" alt="Men"/><div className="wc-sub-label">Men's Wear</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&auto=format" alt="Shoes"/><div className="wc-sub-label">Shoes</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=200&h=200&fit=crop&auto=format" alt="African Wear"/><div className="wc-sub-label">African Wear</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/womens-fashion">Shop Fashion →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Beauty &amp; Personal Care</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=200&h=200&fit=crop&auto=format" alt="Skincare"/><div className="wc-sub-label">Skincare</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&h=200&fit=crop&auto=format" alt="Hair Care"/><div className="wc-sub-label">Hair Care</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop&auto=format" alt="Makeup"/><div className="wc-sub-label">Makeup</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1541643600914-78b084683702?w=200&h=200&fit=crop&auto=format" alt="Perfumes"/><div className="wc-sub-label">Perfumes</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/beauty">Shop Beauty →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Health &amp; Pharmacy</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&h=200&fit=crop&auto=format" alt="Medicines"/><div className="wc-sub-label">Medicines</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=200&h=200&fit=crop&auto=format" alt="Supplements"/><div className="wc-sub-label">Supplements</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1559757175-5700dde675bc?w=200&h=200&fit=crop&auto=format" alt="Medical"/><div className="wc-sub-label">Medical Devices</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=200&h=200&fit=crop&auto=format" alt="Herbal"/><div className="wc-sub-label">Herbal</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/health">Shop Health →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Baby, Kids &amp; Toys</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=200&h=200&fit=crop&auto=format" alt="Baby"/><div className="wc-sub-label">Baby Care</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=200&h=200&fit=crop&auto=format" alt="Kids"/><div className="wc-sub-label">Kids Fashion</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=200&h=200&fit=crop&auto=format" alt="Toys"/><div className="wc-sub-label">Toys</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=200&h=200&fit=crop&auto=format" alt="Bikes"/><div className="wc-sub-label">Bikes &amp; Ride-ons</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/baby-kids">Shop Kids →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Home &amp; Kitchen</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop&auto=format" alt="Furniture"/><div className="wc-sub-label">Furniture</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop&auto=format" alt="Cookware"/><div className="wc-sub-label">Cookware</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=200&h=200&fit=crop&auto=format" alt="Appliances"/><div className="wc-sub-label">Appliances</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1522771739844-6a9f6a14a27b?w=200&h=200&fit=crop&auto=format" alt="Bedding"/><div className="wc-sub-label">Bedding</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/home-kitchen">Shop Home →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Automotive</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=200&h=200&fit=crop&auto=format" alt="Car Parts"/><div className="wc-sub-label">Car Parts</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1580458148391-8c4951dc1465?w=200&h=200&fit=crop&auto=format" alt="Tyres"/><div className="wc-sub-label">Tyres</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&h=200&fit=crop&auto=format" alt="Accessories"/><div className="wc-sub-label">Accessories</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=200&h=200&fit=crop&auto=format" alt="Tools"/><div className="wc-sub-label">Tools</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/automotive">Shop Auto →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Tools &amp; Industrial</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1504148455328-c376907d081c?w=200&h=200&fit=crop&auto=format" alt="Hand Tools"/><div className="wc-sub-label">Hand Tools</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=200&h=200&fit=crop&auto=format" alt="Power Tools"/><div className="wc-sub-label">Power Tools</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=200&h=200&fit=crop&auto=format" alt="Safety"/><div className="wc-sub-label">Safety Gear</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=200&h=200&fit=crop&auto=format" alt="Generators"/><div className="wc-sub-label">Generators</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/category/tools">Shop Tools →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Wholesale Trade</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&h=200&fit=crop&auto=format" alt="Electronics"/><div className="wc-sub-label">Electronics</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=200&h=200&fit=crop&auto=format" alt="Textiles"/><div className="wc-sub-label">Fabrics &amp; Textiles</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=200&h=200&fit=crop&auto=format" alt="Grains"/><div className="wc-sub-label">Food &amp; Grains</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=200&h=200&fit=crop&auto=format" alt="Hardware"/><div className="wc-sub-label">Hardware</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/wholesale">Browse Wholesale →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Export Hub</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&h=200&fit=crop&auto=format" alt="Coffee"/><div className="wc-sub-label">Coffee</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.pexels.com/photos/4963318/pexels-photo-4963318.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&fit=crop" alt="Vanilla"/><div className="wc-sub-label">Vanilla</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=200&h=200&fit=crop&auto=format" alt="Cocoa"/><div className="wc-sub-label">Cocoa</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=200&h=200&fit=crop&auto=format" alt="Tea"/><div className="wc-sub-label">Simsim &amp; Tea</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/export">View Export Hub →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Real Estate</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&h=200&fit=crop&auto=format" alt="Houses for Sale"/><div className="wc-sub-label">Houses for Sale</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200&h=200&fit=crop&auto=format" alt="Rent"/><div className="wc-sub-label">Houses for Rent</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&h=200&fit=crop&auto=format" alt="Land"/><div className="wc-sub-label">Land for Sale</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1464082354059-27db6ce50048?w=200&h=200&fit=crop&auto=format" alt="Farm Land"/><div className="wc-sub-label">Farm Land</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/realestate">Browse Real Estate →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Business Directory</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=200&h=200&fit=crop&auto=format" alt="Shops"/><div className="wc-sub-label">Kampala Shops</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1553413077-190dd305871c?w=200&h=200&fit=crop&auto=format" alt="Wholesale"/><div className="wc-sub-label">Wholesalers</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop&auto=format" alt="Restaurants"/><div className="wc-sub-label">Restaurants</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=200&h=200&fit=crop&auto=format" alt="Services"/><div className="wc-sub-label">Services</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/directory">Browse Directory →</a></div>
          </div>

          <div className="wc-card">
            <div className="wc-card-header">Uganda Made</div>
            <div className="wc-sub-grid">
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1509909756405-be0199881695?w=200&h=200&fit=crop&auto=format" alt="Crafts"/><div className="wc-sub-label">Crafts &amp; Baskets</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=200&h=200&fit=crop&auto=format" alt="Kitenge"/><div className="wc-sub-label">Kitenge Fashion</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&h=200&fit=crop&auto=format" alt="Coffee"/><div className="wc-sub-label">Coffee &amp; Honey</div></div>
              <div className="wc-sub-item"><img className="wc-sub-img" src="https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=200&h=200&fit=crop&auto=format" alt="Shea"/><div className="wc-sub-label">Shea &amp; Beauty</div></div>
            </div>
            <div className="wc-card-footer"><a className="wc-card-link" href="/products">Shop Uganda Made →</a></div>
          </div>

        </div>
      </section>
      <GS/>

      {/* ── Product Carousels ── */}
      <div className="carousel-outer" style={{padding:'8px 48px'}}>

        <HRow title="Best Sellers" flag="featured" seeAll="/products" cart={cart} badge="🏆 TOP PICKS"/>
        <GS/>
        <HRow title="New Arrivals" flag="featured" sort="newest" seeAll="/products" cart={cart} badge="NEW IN"/>
        <GS/>

        <TwinBanner panels={BANNER_A}/>

        <HRow title="Electronics & Gadgets" slug="electronics" seeAll="/category/electronics" cart={cart} badge="HOT"/>
        <GS/>
        <HRow title="Computers & Laptops" slug="computers" seeAll="/category/computers" cart={cart}/>
        <GS/>
        <HRow title="Smart Home & Appliances" slug="smart-home" seeAll="/category/smart-home" cart={cart}/>
        <GS/>
        <HRow title="Women's Fashion" slug="womens-fashion" seeAll="/category/womens-fashion" cart={cart} badge="TRENDING"/>
        <HRow title="Men's Fashion" slug="mens-fashion" seeAll="/category/mens-fashion" cart={cart}/>

        <TwinBanner panels={BANNER_B}/>

        <HRow title="Beauty & Personal Care" slug="beauty" seeAll="/category/beauty" cart={cart} badge="🔥"/>
        <GS/>
        <HRow title="Home & Kitchen" slug="home-kitchen" seeAll="/category/home-kitchen" cart={cart}/>
        <GS/>

        <UgandaBrandsSection cart={cart}/>

        <HRow title="Baby & Kids" slug="baby-kids" seeAll="/category/baby-kids" cart={cart}/>
        <HRow title="Sports & Outdoors" slug="sports" seeAll="/category/sports" cart={cart}/>
        <GS/>
        <HRow title="Health & Household" slug="health" seeAll="/category/health" cart={cart}/>
        <HRow title="Toys & Games" slug="toys-games" seeAll="/category/toys-games" cart={cart}/>
        <GS/>
        <HRow title="Agriculture & Farming" slug="agriculture" seeAll="/category/agriculture" cart={cart} badge="🇺🇬"/>

        <TwinBanner panels={BANNER_C}/>

        <HRow title="⭐ Highly Rated" flag="featured" sort="rating" seeAll="/products" cart={cart} badge="TOP RATED"/>
        <GS/>
        <HRow title="African Fashion & Crafts" slug="african-fashion" seeAll="/category/african-fashion" cart={cart} badge="LOCAL"/>
        <HRow title="Tools & Home Improvement" slug="tools" seeAll="/category/tools" cart={cart}/>
        <HRow title="Video Games" slug="video-games" seeAll="/category/video-games" cart={cart}/>
        <HRow title="Luggage & Travel" slug="luggage" seeAll="/category/luggage" cart={cart}/>
        <HRow title="Pet Supplies" slug="pets" seeAll="/category/pets" cart={cart}/>
        <HRow title="Industrial & Scientific" slug="industrial" seeAll="/category/industrial" cart={cart}/>
        <HRow title="Arts & Crafts" slug="arts-crafts" seeAll="/category/arts-crafts" cart={cart}/>
        <HRow title="Automotive" slug="automotive" seeAll="/category/automotive" cart={cart}/>
        <HRow title="Movies & Television" slug="movies-tv" seeAll="/category/movies-tv" cart={cart}/>
        <HRow title="Girls' Fashion" slug="girls-fashion" seeAll="/category/girls-fashion" cart={cart}/>
        <HRow title="Boys' Fashion" slug="boys-fashion" seeAll="/category/boys-fashion" cart={cart}/>
        <HRow title="Uganda Fresh Produce" slug="fresh-produce" seeAll="/category/fresh-produce" cart={cart}/>

      </div>
      <GS/>

      {/* ── Seller CTA ── */}
      <div className="cta-section" style={{background:MG_BLACK,padding:'52px 48px',borderTop:'3px solid transparent',borderBottom:'3px solid transparent',borderImage:`${GOLD_STRIP} 1`,borderImageSlice:1}}>
        <div style={{maxWidth:960,margin:'0 auto',display:'grid',gridTemplateColumns:'var(--cols-twin)',gap:36}}>
          <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(212,160,23,.3)',borderRadius:6,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{height:3,background:GOLD_STRIP}}/>
            <div style={{padding:'28px 28px 28px',display:'flex',flexDirection:'column',gap:14,flex:1}}>
              <div style={{fontSize:36}}>🏪</div>
              <div style={{fontFamily:BN,fontSize:38,letterSpacing:1,lineHeight:1,
                background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>SELL ON 256 MALL</div>
              <p style={{fontFamily:BL,fontSize:14,color:'rgba(255,255,255,.72)',margin:0,lineHeight:1.75}}>Zero listing fees · Reach 45 million Ugandans · Get paid via MTN MoMo or Airtel Money. Join 500+ verified sellers.</p>
              <button onClick={()=>nav('/sell')}
                style={{background:MG_GOLD,color:'#1A0F00',border:'none',borderRadius:4,padding:'13px 28px',fontFamily:BLC,fontSize:14,fontWeight:800,letterSpacing:1,cursor:'pointer',alignSelf:'flex-start',transition:'opacity .15s',textTransform:'uppercase'}}
                onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                Start Selling Free →
              </button>
            </div>
          </div>
          <div style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(212,160,23,.3)',borderRadius:6,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{height:3,background:GOLD_STRIP}}/>
            <div style={{padding:'28px 28px 28px',display:'flex',flexDirection:'column',gap:14,flex:1}}>
              <div style={{fontSize:36}}>🌾</div>
              <div style={{fontFamily:BN,fontSize:38,letterSpacing:1,lineHeight:1,
                background:MG_GOLD,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>JOIN AS A FARMER</div>
              <p style={{fontFamily:BL,fontSize:14,color:'rgba(255,255,255,.72)',margin:0,lineHeight:1.75}}>List your produce, meat and live animals. Reach buyers across all 146 districts. GPS-verified farms. Free to join.</p>
              <button onClick={()=>nav('/farmers/join')}
                style={{background:MG_GOLD,color:'#1A0F00',border:'none',borderRadius:4,padding:'13px 28px',fontFamily:BLC,fontSize:14,fontWeight:800,letterSpacing:1,cursor:'pointer',alignSelf:'flex-start',transition:'opacity .15s',textTransform:'uppercase'}}
                onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
                onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                Join as Farmer →
              </button>
            </div>
          </div>
        </div>
      </div>
      <GS/>

      {/* ── Footer Stats ── */}
      <div style={{background:MG_BLACK_H,borderTop:'2px solid #000',borderBottom:'2px solid #000'}}>
        <div style={{maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'var(--cols-4)'}}>
          {[['5M+','Ugandans by 2027'],['146','Districts Covered'],['10,000+','Products Listed'],['500+','Verified Sellers']].map(([n,l],i)=>(
            <div key={l} style={{padding:'18px 20px',borderRight:i<3?'1px solid rgba(255,215,0,.15)':undefined,textAlign:'center'}}>
              <div className="stat-shimmer" style={{fontFamily:BN,fontSize:34,letterSpacing:1,
                background:GOLD_STRIP,backgroundSize:'200% auto',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{n}</div>
              <div style={{fontFamily:BLC,fontSize:12,color:'rgba(255,255,255,.55)',letterSpacing:.5,marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Products Page ─────────────────────────────────────────────────────────────
function ProductsPage({cart}){
  const nav=useNavigate();
  const {slug}=useParams();
  const [products,setProducts]=useState([]);
  const [categories,setCategories]=useState([]);
  const [loading,setLoading]=useState(true);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [sort,setSort]=useState('newest');
  const [activeCat,setActiveCat]=useState(slug||null);

  useEffect(()=>{fetch('/api/categories').then(r=>r.json()).then(d=>setCategories(d.categories||[])).catch(()=>{});},[]);
  useEffect(()=>{setActiveCat(slug||null);},[slug]);
  useEffect(()=>{load();},[activeCat,page,sort]);

  const load=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({page,limit:20,sort,...(activeCat&&{category:activeCat})});
      const r=await fetch(`/api/products?${p}`);const d=await r.json();
      setProducts(d.products||[]);setTotal(d.total||0);
    }catch(e){}finally{setLoading(false);}
  };

  const catName=categories.find(c=>c.slug===activeCat)?.name||(activeCat?activeCat.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'All Products');

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      <div style={{maxWidth:1280,margin:'0 auto',padding:'16px'}}>
        <div style={{display:'flex',gap:16}}>
          {/* Sidebar */}
          <div className="cat-sidebar" style={{width:220,flexShrink:0}}>
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:16}}>
              <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${BORDER}`}}>Department</div>
              <div onClick={()=>{setPage(1);nav('/products');}} style={{padding:'7px 10px',cursor:'pointer',fontSize:14,borderRadius:4,color:!activeCat?TEXT:'#555',fontWeight:!activeCat?700:400,background:!activeCat?LIGHT:WHITE,marginBottom:3}}>
                All Departments
              </div>
              {categories.map(cat=>(
                <div key={cat.id} onClick={()=>{setPage(1);nav(`/category/${cat.slug}`);}}
                  style={{padding:'7px 10px',cursor:'pointer',fontSize:14,borderRadius:4,color:activeCat===cat.slug?TEXT:'#555',fontWeight:activeCat===cat.slug?700:400,background:activeCat===cat.slug?LIGHT:WHITE,marginBottom:3,display:'flex',justifyContent:'space-between'}}>
                  <span>{cat.icon} {cat.name}</span>
                  {cat.product_count>0&&<span style={{color:MUTED,fontSize:12}}>{cat.product_count}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Main */}
          <div style={{flex:1}}>
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:'12px 18px',marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
              <div>
                <h1 style={{fontSize:20,color:TEXT,margin:'0 0 2px',fontWeight:700}}>{catName}</h1>
                <div style={{fontSize:13,color:MUTED}}>{total.toLocaleString()} results</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:14,color:TEXT}}>Sort by:</span>
                <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}
                  style={{border:`1px solid ${BORDER}`,borderRadius:4,padding:'6px 10px',fontSize:14,color:TEXT,fontFamily:SF,outline:'none',background:WHITE}}>
                  <option value="newest">Newest</option>
                  <option value="popular">Most Popular</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="rating">Avg. Customer Review</option>
                </select>
              </div>
            </div>

            {loading?(
              <div style={{display:'grid',gridTemplateColumns:'var(--cols-4)',gap:12}}>
                {Array(8).fill(0).map((_,i)=><div key={i} style={{height:310,background:WHITE,borderRadius:6,border:`1px solid ${BORDER}`}}/>)}
              </div>
            ):products.length===0?(
              <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:'60px 32px',textAlign:'center'}}>
                <div style={{fontSize:64,marginBottom:16}}>🔍</div>
                <h2 style={{fontSize:22,fontWeight:700,color:TEXT,marginBottom:10}}>No products found</h2>
                <p style={{color:MUTED,marginBottom:20}}>Be the first to sell in this category!</p>
                <button onClick={()=>nav('/sell')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'12px 24px',fontSize:15,fontWeight:700,cursor:'pointer'}}>Start Selling →</button>
              </div>
            ):(
              <>
                <div style={{display:'grid',gridTemplateColumns:'var(--cols-4)',gap:12,marginBottom:20}}>
                  {products.map(p=><PCard key={p.id} p={p} onAdd={cart.add}/>)}
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:8}}>
                  {page>1&&<button onClick={()=>setPage(p=>p-1)} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:4,padding:'8px 18px',color:LINK,fontSize:14,cursor:'pointer'}}>← Previous</button>}
                  <div style={{background:ORANGE,color:WHITE,borderRadius:4,padding:'8px 18px',fontWeight:700,fontSize:14}}>Page {page}</div>
                  {products.length===20&&<button onClick={()=>setPage(p=>p+1)} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:4,padding:'8px 18px',color:LINK,fontSize:14,cursor:'pointer'}}>Next →</button>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product Detail Page ───────────────────────────────────────────────────────
function ProductPage({cart}){
  const nav=useNavigate();
  const {openChat}=useChat()||{};
  const {id}=useParams();
  const [product,setProduct]=useState(null);
  const [loading,setLoading]=useState(true);
  const [qty,setQty]=useState(1);

  useEffect(()=>{
    fetch(`/api/products/${id}`).then(r=>r.json()).then(d=>{
      if(d.success||d.product)setProduct(d.product||d);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[id]);

  if(loading)return<div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,fontSize:16,color:MUTED}}>Loading product...</div>;
  if(!product)return<div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,fontSize:16,color:MUTED}}>Product not found. <span onClick={()=>nav('/products')} style={{color:LINK,cursor:'pointer',marginLeft:8}}>Browse all products →</span></div>;

  const disc=product.original_price?Math.round((1-product.price/product.original_price)*100):0;
  const stars=Math.min(5,Math.round(product.rating||0));

  return(
    <div style={{background:WHITE,minHeight:'100vh',fontFamily:DM}}>
      <div style={{maxWidth:1280,margin:'0 auto',padding:'16px'}}>
        <div style={{fontSize:13,color:LINK,marginBottom:16,cursor:'pointer'}} onClick={()=>nav('/products')}>← Back to results</div>
        <div className="prod-layout" style={{display:'flex',gap:32,alignItems:'flex-start',flexWrap:'wrap'}}>
          {/* Image */}
          <div className="prod-img" style={{width:380,flexShrink:0}}>
            <div style={{background:'#F7F8F8',border:`1px solid ${BORDER}`,borderRadius:8,height:380,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              {product.primary_image
                ?<img src={product.primary_image} alt={product.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                :<span style={{fontSize:80}}>🛍️</span>}
            </div>
          </div>

          {/* Details */}
          <div className="prod-details" style={{flex:1,minWidth:0}}>
            <h1 style={{fontSize:22,fontWeight:400,color:TEXT,margin:'0 0 8px',lineHeight:1.4}}>{product.name}</h1>
            <div style={{fontSize:13,color:LINK,marginBottom:8}}>by {product.seller_name||'Seller'}</div>
            {stars>0&&<div style={{color:'#C45500',fontSize:15,marginBottom:10}}>{'★'.repeat(stars)}{'☆'.repeat(5-stars)} <span style={{color:LINK,fontSize:13}}>({product.total_reviews||0} ratings)</span></div>}
            <div style={{borderTop:`1px solid ${BORDER}`,borderBottom:`1px solid ${BORDER}`,padding:'14px 0',margin:'14px 0'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:10}}>
                {disc>0&&<span style={{fontSize:13,color:RED}}>-{disc}%</span>}
                <span style={{fontSize:28,fontWeight:400,color:RED}}>UGX {Number(product.price).toLocaleString()}</span>
              </div>
              {product.original_price&&<div style={{fontSize:13,color:MUTED}}>Was: <span style={{textDecoration:'line-through'}}>UGX {Number(product.original_price).toLocaleString()}</span></div>}
              <div style={{fontSize:13,color:GREEN,marginTop:6,fontWeight:700}}>In Stock</div>
            </div>
            {product.description&&<p style={{fontSize:14,color:TEXT,lineHeight:1.7,marginBottom:16}}>{product.description}</p>}
            {product.is_uganda_made&&<div style={{display:'inline-block',background:'#f0f8e8',border:'1px solid #4a8a00',borderRadius:4,padding:'4px 12px',fontSize:12,fontWeight:700,color:'#2a5a00',marginBottom:14}}>🇺🇬 Made in Uganda</div>}
          </div>

          {/* Buy box */}
          <div className="prod-buybox" style={{width:240,flexShrink:0,border:`1px solid ${BORDER}`,borderRadius:8,padding:18}}>
            <div style={{fontSize:22,fontWeight:400,color:RED,marginBottom:4}}>UGX {Number(product.price).toLocaleString()}</div>
            <div style={{fontSize:13,color:GREEN,marginBottom:12,fontWeight:700}}>✓ In Stock</div>
            {/* Fulfillment options */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:6}}>Fulfillment options</div>
              {(()=>{
                const opts=Array.isArray(product.delivery_options)&&product.delivery_options.length>0
                  ?product.delivery_options:['delivery'];
                const MAP={
                  walkin: {icon:'🚶',label:'Walk-in / In Store',  desc:'Visit the seller directly',           color:'#1d4ed8'},
                  pickup: {icon:'🏪',label:'Self Pickup',          desc:'Order online, collect yourself',      color:'#1d4ed8'},
                  delivery:{icon:'🛵',label:'Local Delivery',       desc:'Delivered to your address nearby',   color:'#15803d'},
                  nationwide:{icon:'🚚',label:'Nationwide',         desc:'Any of the 146 districts in Uganda', color:'#c2410c'},
                };
                return opts.map(o=>{const m=MAP[o]||{icon:'📦',label:o,desc:'',color:'#374151'};return(
                  <div key={o} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 0',borderBottom:`1px solid ${BORDER}`}}>
                    <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{m.icon}</span>
                    <div><div style={{fontSize:13,fontWeight:600,color:TEXT}}>{m.label}</div><div style={{fontSize:11,color:MUTED}}>{m.desc}</div></div>
                  </div>
                );});
              })()}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <span style={{fontSize:13,color:TEXT}}>Qty:</span>
              <select value={qty} onChange={e=>setQty(Number(e.target.value))}
                style={{border:`1px solid ${BORDER}`,borderRadius:4,padding:'5px 8px',fontSize:14,fontFamily:DM}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={()=>{cart.add(product.id,qty);}}
              style={{width:'100%',background:YELLOW,color:TEXT,border:'1px solid #FCD200',borderRadius:20,padding:'10px',fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:10,fontFamily:DM}}
              onMouseEnter={e=>e.currentTarget.style.background='#F7CA00'}
              onMouseLeave={e=>e.currentTarget.style.background=YELLOW}>
              Add to Cart
            </button>
            <button onClick={async()=>{if(await cart.add(product.id,qty))nav('/checkout');}}
              style={{width:'100%',background:ORANGE,color:WHITE,border:'1px solid #E88A00',borderRadius:20,padding:'10px',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:DM}}
              onMouseEnter={e=>e.currentTarget.style.background='#E88A00'}
              onMouseLeave={e=>e.currentTarget.style.background=ORANGE}>
              Buy Now
            </button>
            <div style={{fontSize:12,color:MUTED,marginTop:10,textAlign:'center'}}>📱 Pay via MTN MoMo or Airtel Money</div>
            <button onClick={()=>openChat&&openChat({type:'product',id:product.id,name:product.name,seller_id:product.seller_id,seller_name:product.seller_name,seller_phone:product.seller_phone})}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8,background:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:20,padding:'9px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM,width:'100%'}}>
              💬 Chat with Seller
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cart Page ─────────────────────────────────────────────────────────────────
function CartPage({cart}){
  const nav=useNavigate();
  const subtotal=cart.items.reduce((s,i)=>s+i.price*i.quantity,0);
  return(
    <div style={{background:BLACK,minHeight:'100vh',padding:'20px 16px',fontFamily:DM}}>
      <div style={{maxWidth:1280,margin:'0 auto'}}>
        <div style={{height:3,background:GOLD_STRIP,borderRadius:2,marginBottom:24}}/>
        <h1 style={{fontSize:28,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:24}}>Shopping Cart</h1>
        {cart.items.length===0?(
          <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.08),rgba(200,153,42,0.02))',border:'1px solid rgba(200,153,42,0.25)',borderRadius:16,padding:'80px 32px',textAlign:'center',boxShadow:'0 4px 60px rgba(0,0,0,0.7)'}}>
            <div style={{fontSize:72,marginBottom:18}}>🛒</div>
            <h2 style={{fontSize:22,fontWeight:700,color:'#f0ede4',marginBottom:10,fontFamily:PF}}>Your 256 Mall cart is empty</h2>
            <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',marginBottom:28,lineHeight:1.6}}>Discover premium products and add them to your cart.</p>
            <button onClick={()=>nav('/products')} style={{background:GSHINE,color:'#07070e',border:'none',borderRadius:10,padding:'14px 36px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 28px rgba(200,153,42,0.45)',letterSpacing:.3}}>Shop Now →</button>
          </div>
        ):(
          <div style={{display:'flex',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:280,background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))',border:'1px solid rgba(200,153,42,0.22)',borderRadius:16,padding:'20px 24px',boxShadow:'0 4px 48px rgba(0,0,0,0.6)'}}>
              {cart.items.map((item,idx)=>(
                <div key={item.id} style={{display:'flex',gap:16,alignItems:'center',padding:'20px 0',borderTop:idx>0?'1px solid rgba(200,153,42,0.1)':'none'}}>
                  <div style={{width:88,height:88,background:'rgba(200,153,42,0.06)',border:'1px solid rgba(200,153,42,0.18)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,overflow:'hidden',flexShrink:0}}>
                    {item.image_url?<img src={item.image_url} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:'🛍️'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:18,fontWeight:900,color:'#F5D060',fontFamily:PF,marginBottom:4}}>UGX {Number(item.price*item.quantity).toLocaleString()}</div>
                    <div style={{fontSize:15,color:'#f0ede4',marginBottom:5,fontWeight:600,lineHeight:1.4}}>{item.name}</div>
                    <div style={{fontSize:12,color:'#4ade80',marginBottom:10,fontWeight:600}}>✓ In Stock</div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <select value={item.quantity} onChange={e=>cart.updateQty(item.product_id,Number(e.target.value))}
                        style={{background:'rgba(200,153,42,0.06)',border:'1px solid rgba(200,153,42,0.3)',borderRadius:8,padding:'6px 10px',fontSize:13,fontFamily:DM,color:'#f0ede4',outline:'none',cursor:'pointer'}}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n} style={{background:'#111'}}>{n}</option>)}
                      </select>
                      <span style={{color:'rgba(200,153,42,0.2)'}}>|</span>
                      <span onClick={()=>cart.remove(item.product_id)} style={{fontSize:13,color:'rgba(200,153,42,0.55)',cursor:'pointer',fontWeight:600,transition:'color .15s'}}
                        onMouseEnter={e=>e.currentTarget.style.color='#f87171'} onMouseLeave={e=>e.currentTarget.style.color='rgba(200,153,42,0.55)'}>Remove</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:11,color:'rgba(200,153,42,0.35)'}}>UGX {Number(item.price).toLocaleString()} each</div>
                  </div>
                </div>
              ))}
              <div style={{borderTop:'1px solid rgba(200,153,42,0.2)',paddingTop:16,textAlign:'right',marginTop:4}}>
                <span style={{fontSize:14,color:'rgba(200,153,42,0.5)'}}>Subtotal ({cart.items.reduce((s,i)=>s+i.quantity,0)} items): </span>
                <span style={{fontSize:22,fontWeight:900,color:'#F5D060',fontFamily:PF}}> UGX {subtotal.toLocaleString()}</span>
              </div>
            </div>
            <div style={{width:300,flexShrink:0,background:'linear-gradient(145deg,rgba(200,153,42,0.1),rgba(200,153,42,0.04))',border:'1px solid rgba(200,153,42,0.32)',borderRadius:16,padding:26,boxShadow:'0 0 60px rgba(200,153,42,0.07)',position:'sticky',top:80}}>
              <div style={{height:2,background:GOLD_STRIP,borderRadius:1,marginBottom:20}}/>
              <div style={{fontSize:9,letterSpacing:4,color:'rgba(200,153,42,0.45)',fontWeight:700,textTransform:'uppercase',marginBottom:16,fontFamily:DM}}>Order Summary</div>
              <div style={{fontSize:13,color:'#4ade80',marginBottom:14,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                <span>🛡️</span> 256 Mall Order Protection
              </div>
              <div style={{fontSize:13,color:'rgba(200,153,42,0.45)',marginBottom:6}}>
                Subtotal ({cart.items.reduce((s,i)=>s+i.quantity,0)} items)
              </div>
              <div style={{fontSize:26,fontWeight:900,color:'#F5D060',fontFamily:PF,marginBottom:22}}>UGX {subtotal.toLocaleString()}</div>
              <button onClick={()=>nav('/checkout')}
                style={{width:'100%',background:GSHINE,color:'#07070e',border:'none',borderRadius:10,padding:'14px',fontSize:15,fontWeight:800,cursor:'pointer',marginBottom:10,fontFamily:DM,boxShadow:'0 0 28px rgba(200,153,42,0.4)',letterSpacing:.3,transition:'box-shadow .2s'}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 0 40px rgba(200,153,42,0.6)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 0 28px rgba(200,153,42,0.4)'}>
                Proceed to Checkout →
              </button>
              <button onClick={()=>nav('/products')}
                style={{width:'100%',background:'transparent',color:'rgba(200,153,42,0.55)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:DM}}>
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Checkout Page ─────────────────────────────────────────────────────────────
// ── Delivery selector helpers ─────────────────────────────────────────────────
// upcountry: false=local only(≤50km), true=upcountry only(>50km), null=always
const DEL_OPTS=[
  {type:'walker',  label:'Walker',          icon:'🚶', upcountry:false, maxKm:2,   base:1500,  perKm:0,  time:'30–60 min',    desc:'Flat fee · on foot'},
  {type:'bicycle', label:'Bicycle Courier', icon:'🚲', upcountry:false, maxKm:5,   base:2000,  perKm:0,  time:'30–90 min',    desc:'Flat fee'},
  {type:'boda',    label:'Boda Boda',       icon:'🏍️', upcountry:false, maxKm:50,  base:2000,  perKm:400,time:'20–45 min',    desc:'+ UGX 400/km'},
  {type:'tuktuk',  label:'Tuktuk',          icon:'🛺', upcountry:false, maxKm:50,  base:3000,  perKm:500,time:'30–60 min',    desc:'+ UGX 500/km'},
  {type:'van',     label:'Van/Car',         icon:'🚐', upcountry:false, maxKm:50,  base:5000,  perKm:800,time:'30–90 min',    desc:'Heavy items · + UGX 800/km'},
  {type:'bus',     label:'Bus Parcel',      icon:'🚌', upcountry:true,  maxKm:null,base:8000,  perKm:0,  time:'Next day',     desc:'Drop at stage · flat fee'},
  {type:'taxi',    label:'Taxi / Minibus',  icon:'🚖', upcountry:true,  maxKm:null,base:10000, perKm:50, time:'Same/next day', desc:'Matched to route · + UGX 50/km'},
  {type:'pickup',  label:'Self Pickup',     icon:'🏪', upcountry:null,  maxKm:null,base:0,     perKm:0,  time:'Flexible',     desc:'FREE'},
];

function calcDeliveryFee(type,km){
  const o=DEL_OPTS.find(x=>x.type===type);
  if(!o)return 2000+Math.ceil(km||0)*400;
  return o.base+Math.ceil(km||0)*o.perKm;
}

function getAvailOpts(dist){
  if(dist===null)return DEL_OPTS.filter(o=>o.upcountry===false); // default: show local
  if(dist>50)return DEL_OPTS.filter(o=>o.upcountry===true||o.upcountry===null);
  return DEL_OPTS.filter(o=>(o.upcountry===false||o.upcountry===null)&&(o.maxKm===null||dist<=o.maxKm));
}

function defaultOpt(dist){
  if(dist===null)return 'boda';
  if(dist>50)return 'bus';
  if(dist>5)return 'boda';
  if(dist>2)return 'bicycle';
  return 'walker';
}

function haversineJS(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function DeliverySelector({onSelect, subtotal}){
  const [locState,setLocState]=useState('idle'); // idle|loading|got|denied
  const [coords,setCoords]=useState(null);
  const [dist,setDist]=useState(null);
  const [selected,setSelected]=useState(null);
  const SELLER_LAT=0.3476,SELLER_LNG=32.5825; // Kampala default

  const getLocation=()=>{
    setLocState('loading');
    if(!navigator.geolocation){setLocState('denied');return;}
    navigator.geolocation.getCurrentPosition(
      pos=>{
        const {latitude:lat,longitude:lng}=pos.coords;
        setCoords({lat,lng});
        const d=haversineJS(lat,lng,SELLER_LAT,SELLER_LNG);
        setDist(Math.round(d*10)/10);
        setLocState('got');
      },
      ()=>setLocState('denied'),
      {timeout:10000}
    );
  };

  const availOpts=getAvailOpts(dist);

  useEffect(()=>{
    if(locState==='got'||locState==='denied'){
      setSelected(defaultOpt(locState==='denied'?null:dist));
    }
  },[locState,dist]);

  const selectedOpt=DEL_OPTS.find(o=>o.type===selected);
  const fee=selectedOpt?calcDeliveryFee(selected,dist||5):0;

  return(
    <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(7,7,14,0.8))',border:'1px solid rgba(200,153,42,0.18)',borderRadius:18,padding:'24px 26px',boxShadow:'0 4px 40px rgba(0,0,0,0.5)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,paddingBottom:16,borderBottom:'1px solid rgba(200,153,42,0.12)'}}>
        <div style={{width:36,height:36,borderRadius:'50%',background:GSHINE,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,color:'#07070e',flexShrink:0,boxShadow:'0 0 16px rgba(200,153,42,0.4)'}}>2</div>
        <h2 style={{fontSize:17,fontWeight:800,color:'#f0ede4',margin:0,fontFamily:PF,letterSpacing:.3}}>Delivery Method</h2>
      </div>
      {locState==='idle'&&(
        <div style={{textAlign:'center',padding:'24px 0'}}>
          <div style={{fontSize:40,marginBottom:14}}>📍</div>
          <p style={{fontSize:14,color:'rgba(200,153,42,0.5)',marginBottom:20,lineHeight:1.6}}>Share your location to see delivery options and accurate fees.</p>
          <button onClick={getLocation} style={{background:GSHINE,color:'#07070e',border:'none',borderRadius:10,padding:'12px 28px',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 20px rgba(200,153,42,0.35)'}}>
            📍 Share My Location
          </button>
          <div style={{marginTop:14}}>
            <span onClick={()=>{setDist(5);setLocState('got');}} style={{fontSize:13,color:'rgba(200,153,42,0.55)',cursor:'pointer',fontWeight:600}}>
              Skip — use local fees →
            </span>
          </div>
        </div>
      )}
      {locState==='loading'&&<div style={{textAlign:'center',padding:24,color:'rgba(200,153,42,0.45)',fontSize:13,letterSpacing:2}}>DETECTING LOCATION…</div>}
      {locState==='denied'&&(
        <div>
          <p style={{fontSize:13,color:'#f87171',marginBottom:14,padding:'10px 14px',background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:8}}>⚠️ Location access denied. Showing local delivery options.</p>
          <div style={{display:'grid',gap:8}}>
            {getAvailOpts(null).map(o=><DelOptRow key={o.type} o={o} dist={5} selected={selected} onSelect={s=>{setSelected(s);onSelect(s,calcDeliveryFee(s,5),null,null);}}/>)}
          </div>
        </div>
      )}
      {locState==='got'&&(
        <div>
          <div style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.25)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#f0ede4'}}>
            📍 Location detected · Distance to seller: <strong style={{color:'#F5D060'}}>{dist} km</strong>
            {dist>50&&<span style={{marginLeft:10,background:'rgba(200,153,42,0.25)',color:'#F5D060',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:1}}>UPCOUNTRY</span>}
          </div>
          {dist>50&&(
            <div style={{background:'rgba(200,153,42,0.05)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:'rgba(200,153,42,0.6)',lineHeight:1.6}}>
              🛣️ <strong style={{color:'#F5D060'}}>Upcountry delivery:</strong> Boda boda and tuktuk unavailable beyond 50 km. Choose Bus Parcel, Taxi/Minibus, or self pickup.
            </div>
          )}
          <div style={{display:'grid',gap:8}}>
            {availOpts.map(o=>(
              <DelOptRow key={o.type} o={o} dist={dist} selected={selected}
                onSelect={s=>{setSelected(s);onSelect(s,calcDeliveryFee(s,dist),coords?.lat,coords?.lng);}}/>
            ))}
          </div>
          {selectedOpt&&(
            <div style={{marginTop:14,padding:'14px 18px',background:'rgba(200,153,42,0.1)',border:'1px solid rgba(200,153,42,0.3)',borderRadius:10,fontSize:14,color:'#f0ede4'}}>
              <strong style={{color:'#F5D060'}}>{selectedOpt.icon} {selectedOpt.label}</strong> selected ·
              Fee: <strong style={{color:'#F5D060'}}>UGX {fee.toLocaleString()}</strong> ·
              Items: UGX {subtotal.toLocaleString()} ·
              Tax: UGX {Math.round(subtotal*TAX_RATE).toLocaleString()} ·
              Total: <strong style={{color:'#F5D060'}}>UGX {(subtotal+Math.round(subtotal*TAX_RATE)+fee).toLocaleString()}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DelOptRow({o,dist,selected,onSelect}){
  const fee=calcDeliveryFee(o.type,dist||5);
  const isSelected=selected===o.type;
  return(
    <div onClick={()=>onSelect(o.type)}
      style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
        border:`2px solid ${isSelected?'rgba(200,153,42,0.6)':'rgba(200,153,42,0.15)'}`,
        borderRadius:10,cursor:'pointer',
        background:isSelected?'rgba(200,153,42,0.1)':'rgba(200,153,42,0.03)',
        transition:'all .15s',boxShadow:isSelected?'0 0 20px rgba(200,153,42,0.15)':'none'}}>
      <span style={{fontSize:24}}>{o.icon}</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:'#f0ede4',display:'flex',alignItems:'center',gap:6}}>
          {o.label}
          {o.type==='taxi'&&<span style={{fontSize:10,background:'rgba(96,165,250,0.2)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.3)',borderRadius:4,padding:'1px 6px',fontWeight:700}}>MATCHED</span>}
        </div>
        <div style={{fontSize:12,color:'rgba(200,153,42,0.45)'}}>{o.time} · {o.desc}</div>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{fontWeight:800,color:fee===0?'#4ade80':'#F5D060',fontSize:14,fontFamily:PF}}>
          {fee===0?'FREE':`UGX ${fee.toLocaleString()}`}
        </div>
      </div>
      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${isSelected?'#C8992A':'rgba(200,153,42,0.3)'}`,
        background:isSelected?GSHINE:'transparent',flexShrink:0,boxShadow:isSelected?'0 0 10px rgba(200,153,42,0.5)':'none'}}/>
    </div>
  );
}

function CheckoutPage({cart,auth}){
  const nav=useNavigate();
  const [form,setForm,clearCheckoutForm]=usePersistedForm('checkout',{name:'',phone:'',address:'',district:'Kampala',notes:''});
  const [delivery,setDelivery]=useState({type:'boda',fee:0,buyerLat:null,buyerLng:null});
  const [payMethod,setPayMethod]=useState('cod');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [orderId,setOrderId]=useState(null);
  const [deliveryId,setDeliveryId]=useState(null);
  const subtotal=cart.items.reduce((s,i)=>s+i.price*i.quantity,0);
  const tax=Math.round(subtotal*TAX_RATE);

  const submit=async()=>{
    if(!form.name||!form.phone||!form.address){setError('Please fill in your name, phone and delivery address.');return;}
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json',...(auth.user&&{'Authorization':`Bearer ${localStorage.getItem('256mall_token')}`})},
        body:JSON.stringify({sessionId:cart.sessionId,deliveryName:form.name,deliveryPhone:form.phone,deliveryAddress:form.address,deliveryDistrict:form.district,notes:form.notes,deliveryType:delivery.type,deliveryFee:delivery.fee,paymentMethod:payMethod==='pesapal'?'pesapal':'cod'})});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Order failed. Please try again.');return;}
      const oId=d.order?.id||null;
      const oNum=d.order?.order_number||oId;
      // Create delivery order
      if(oId&&delivery.type!=='pickup'){
        await fetch('/api/delivery/orders',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({order_id:oId,delivery_type:delivery.type,buyer_lat:delivery.buyerLat,buyer_lng:delivery.buyerLng,buyer_address:form.address})});
      }
      if(payMethod==='pesapal'&&oId){
        const pr=await fetch('/api/pesapal/initiate',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({orderId:oId,orderNumber:oNum,email:auth.user?.email||'',name:form.name,phone:form.phone,userId:auth.user?.id||null})});
        const pd=await pr.json();
        if(pd.redirectUrl){window.location.href=pd.redirectUrl;return;}
        setError(pd.error||'Could not initiate Pesapal payment.');return;
      }
      clearCheckoutForm();
      setOrderId(oId||'new');
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const MInp={width:'100%',background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'12px 14px',fontSize:14,fontFamily:DM,outline:'none',boxSizing:'border-box',color:'#f0ede4',marginBottom:12};

  if(orderId)return(
    <div style={{background:'linear-gradient(160deg,#07070e 0%,#0d0b04 50%,#07070e 100%)',minHeight:'100vh',padding:'48px 16px',fontFamily:DM}}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}@keyframes pulseRing{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.4)}50%{box-shadow:0 0 0 16px rgba(74,222,128,0)}}@keyframes shimmerBar{0%{background-position:200% center}100%{background-position:-200% center}}`}</style>
      <div style={{maxWidth:600,margin:'0 auto',animation:'fadeUp .6s ease'}}>
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{width:88,height:88,borderRadius:'50%',background:'linear-gradient(135deg,rgba(74,222,128,0.2),rgba(74,222,128,0.05))',border:'2px solid rgba(74,222,128,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,margin:'0 auto 24px',animation:'pulseRing 2s ease-in-out infinite',boxShadow:'0 0 60px rgba(74,222,128,0.15)'}}>✓</div>
          <div style={{fontSize:11,letterSpacing:5,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:12}}>Order Confirmed</div>
          <h1 style={{fontSize:36,fontWeight:900,fontFamily:PF,background:'linear-gradient(135deg,#f5d060,#c8992a,#f5d060)',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 12px',lineHeight:1.2}}>Thank You, {form.name.split(' ')[0]}.</h1>
          <p style={{fontSize:15,color:'rgba(200,153,42,0.5)',lineHeight:1.7,maxWidth:400,margin:'0 auto 28px'}}>Your order has been placed. {delivery.type==='pickup'?'Please collect from the seller at your convenience.':'A rider will be assigned and on their way shortly.'}</p>
          <div style={{height:2,background:'linear-gradient(90deg,transparent,#c8992a,#f5d060,#c8992a,transparent)',borderRadius:2,marginBottom:36,backgroundSize:'200% auto',animation:'shimmerBar 3s linear infinite'}}/>
        </div>

        <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.09),rgba(200,153,42,0.03))',border:'1px solid rgba(200,153,42,0.25)',borderRadius:20,overflow:'hidden',marginBottom:16,boxShadow:'0 8px 60px rgba(0,0,0,0.6)'}}>
          <div style={{padding:'20px 28px',borderBottom:'1px solid rgba(200,153,42,0.12)',display:'flex',gap:16,alignItems:'center'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,letterSpacing:3,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Contact Unlocked</div>
              <div style={{fontSize:14,fontWeight:700,color:'#f0ede4'}}>{form.name} · <span style={{color:'#4ade80'}}>{form.phone}</span></div>
            </div>
            <div style={{fontSize:11,color:'rgba(74,222,128,0.6)',background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:20,padding:'4px 12px',fontWeight:700}}>Shared with seller</div>
          </div>
          <div style={{padding:'20px 28px',borderBottom:'1px solid rgba(200,153,42,0.12)'}}>
            <div style={{fontSize:10,letterSpacing:3,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:8}}>256 Mall Support</div>
            <a href="tel:+256700000000" style={{fontSize:15,fontWeight:800,color:'#4ade80',textDecoration:'none',letterSpacing:.5}}>+256 700 000 000</a>
            <div style={{fontSize:12,color:'rgba(200,153,42,0.4)',marginTop:4}}>For order issues, disputes or late delivery.</div>
          </div>
          <div style={{padding:'16px 28px',fontSize:12,color:'rgba(200,153,42,0.4)',lineHeight:1.7}}>
            Continue chatting with the seller via the <strong style={{color:'rgba(200,153,42,0.7)'}}>💬 Chat</strong> button — your order reference is visible to them.
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:32}}>
          <button onClick={()=>nav('/track')} style={{flex:1,background:GSHINE,color:'#07070e',border:'none',borderRadius:12,padding:'15px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 32px rgba(200,153,42,0.35)',letterSpacing:.3}}>Track My Order →</button>
          <button onClick={()=>nav('/products')} style={{flex:1,background:'rgba(200,153,42,0.07)',color:'rgba(200,153,42,0.6)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:12,padding:'15px',fontSize:15,cursor:'pointer',fontFamily:DM,fontWeight:600}}>Continue Shopping</button>
        </div>

        {orderId!=='new'&&<BodaTracker orderId={orderId}/>}
      </div>
    </div>
  );

  const StepHead=({n,title})=>(
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,paddingBottom:16,borderBottom:'1px solid rgba(200,153,42,0.12)'}}>
      <div style={{width:36,height:36,borderRadius:'50%',background:GSHINE,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:900,color:'#07070e',flexShrink:0,boxShadow:'0 0 16px rgba(200,153,42,0.4)'}}>{n}</div>
      <h2 style={{fontSize:17,fontWeight:800,color:'#f0ede4',margin:0,fontFamily:PF,letterSpacing:.3}}>{title}</h2>
    </div>
  );
  const F2={width:'100%',background:'rgba(10,10,14,0.6)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:10,padding:'13px 16px',fontSize:14,fontFamily:DM,outline:'none',boxSizing:'border-box',color:'#f0ede4',marginBottom:12,transition:'border .15s,box-shadow .15s'};
  const onF=e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.6)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(200,153,42,0.08)';};
  const onB=e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.2)';e.currentTarget.style.boxShadow='none';};
  return(
    <div style={{background:'linear-gradient(160deg,#07070e 0%,#0d0b04 60%,#07070e 100%)',minHeight:'100vh',padding:'28px 16px 60px',fontFamily:DM}}>
      <style>{`@keyframes shimCO{0%{background-position:200% center}100%{background-position:-200% center}}`}</style>
      <div style={{maxWidth:1040,margin:'0 auto'}}>
        {/* Page title */}
        <div style={{marginBottom:28}}>
          <div style={{height:2,background:'linear-gradient(90deg,transparent,#c8992a,#f5d060,#c8992a,transparent)',backgroundSize:'200% auto',animation:'shimCO 3s linear infinite',borderRadius:2,marginBottom:20}}/>
          <div style={{fontSize:10,letterSpacing:4,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Secure Checkout</div>
          <div style={{fontSize:26,fontWeight:900,fontFamily:PF,background:'linear-gradient(135deg,#f5d060,#c8992a)',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Complete Your Order</div>
        </div>

        <div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
          {/* ── Left: Steps ── */}
          <div style={{flex:1,minWidth:300,display:'flex',flexDirection:'column',gap:16}}>

            {/* Step 1 */}
            <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(7,7,14,0.8))',border:'1px solid rgba(200,153,42,0.18)',borderRadius:18,padding:'24px 26px',boxShadow:'0 4px 40px rgba(0,0,0,0.5)'}}>
              <StepHead n="1" title="Delivery Details"/>
              {[['Full Name','name','text'],['Phone Number','phone','tel'],['Delivery Address','address','text']].map(([pl,key,type])=>(
                <input key={key} type={type} placeholder={pl+' *'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}
                  style={F2} onFocus={onF} onBlur={onB}/>
              ))}
              <select value={form.district} onChange={e=>setForm({...form,district:e.target.value})}
                style={{...F2,appearance:'none',cursor:'pointer'}} onFocus={onF} onBlur={onB}>
                {['Kampala','Wakiso','Mukono','Jinja','Entebbe','Mbarara','Gulu','Lira','Mbale','Fort Portal','Kabale','Masaka','Soroti','Arua','Hoima'].map(d=><option key={d} style={{background:'#111'}}>{d}</option>)}
              </select>
              <textarea placeholder="Special delivery instructions (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}
                rows={2} style={{...F2,resize:'vertical',marginBottom:0}} onFocus={onF} onBlur={onB}/>
            </div>

            {/* Step 2 */}
            <DeliverySelector subtotal={subtotal} onSelect={(type,fee,lat,lng)=>setDelivery({type,fee,buyerLat:lat,buyerLng:lng})}/>

            {/* Step 3 */}
            <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(7,7,14,0.8))',border:'1px solid rgba(200,153,42,0.18)',borderRadius:18,padding:'24px 26px',boxShadow:'0 4px 40px rgba(0,0,0,0.5)'}}>
              <StepHead n="3" title="Payment Method"/>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:18}}>
                {[
                  {v:'cod',label:'Pay on Delivery',sub:`MTN MoMo or Airtel Money when your order arrives`,badge:null,accent:'rgba(251,191,36,0.25)',accentBorder:'rgba(251,191,36,0.5)',icon:'📱'},
                  {v:'pesapal',label:'Pay Online Now',sub:'Visa · Mastercard · MTN MoMo · Airtel Money',badge:'SECURE',accent:'rgba(96,165,250,0.15)',accentBorder:'rgba(96,165,250,0.5)',icon:'💳'},
                ].map(opt=>(
                  <div key={opt.v} onClick={()=>setPayMethod(opt.v)}
                    style={{padding:'16px 18px',borderRadius:14,cursor:'pointer',
                      border:`2px solid ${payMethod===opt.v?opt.accentBorder:'rgba(200,153,42,0.15)'}`,
                      background:payMethod===opt.v?opt.accent:'rgba(200,153,42,0.03)',
                      boxShadow:payMethod===opt.v?`0 0 24px ${opt.accentBorder.replace('0.5','0.15')}`:'none',
                      transition:'all .2s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:42,height:42,borderRadius:12,background:payMethod===opt.v?opt.accent:'rgba(200,153,42,0.06)',border:`1px solid ${payMethod===opt.v?opt.accentBorder:'rgba(200,153,42,0.15)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{opt.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                          <span style={{fontWeight:800,fontSize:14,color:'#f0ede4'}}>{opt.label}</span>
                          {opt.badge&&<span style={{fontSize:9,fontWeight:700,letterSpacing:1,background:'rgba(96,165,250,0.15)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.3)',borderRadius:4,padding:'2px 6px'}}>{opt.badge}</span>}
                        </div>
                        <div style={{fontSize:12,color:'rgba(200,153,42,0.45)',lineHeight:1.5}}>{opt.sub}</div>
                      </div>
                      <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${payMethod===opt.v?opt.accentBorder:'rgba(200,153,42,0.25)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {payMethod===opt.v&&<div style={{width:10,height:10,borderRadius:'50%',background:opt.accentBorder}}/>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {error&&<div style={{color:'#f87171',fontSize:13,marginBottom:14,padding:'12px 16px',background:'rgba(248,113,113,0.06)',borderRadius:10,border:'1px solid rgba(248,113,113,0.2)'}}>{error}</div>}
              {cart.items.length===0&&<div style={{color:'#fbbf24',fontSize:13,marginBottom:14,padding:'12px 16px',background:'rgba(251,191,36,0.06)',borderRadius:10,border:'1px solid rgba(251,191,36,0.2)'}}>Your cart is empty — <span onClick={()=>nav('/products')} style={{textDecoration:'underline',cursor:'pointer',fontWeight:700}}>browse products</span> to add something before checking out.</div>}
              <button onClick={submit} disabled={loading||cart.items.length===0}
                style={{width:'100%',background:loading?'rgba(200,153,42,0.2)':GSHINE,color:loading?'rgba(200,153,42,0.4)':'#07070e',border:'none',borderRadius:12,padding:'16px',fontSize:16,fontWeight:900,cursor:loading?'not-allowed':'pointer',fontFamily:PF,boxShadow:loading?'none':'0 0 36px rgba(200,153,42,0.45)',transition:'all .2s',letterSpacing:.5}}>
                {loading?(payMethod==='pesapal'?'Redirecting to Pesapal…':'Placing Order…'):(payMethod==='pesapal'?'Pay Now with Pesapal →':'Place Order →')}
              </button>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:14,fontSize:11,color:'rgba(200,153,42,0.35)'}}>
                <span>🔒</span><span>256-bit encrypted · Secured by 256 Mall</span>
              </div>
            </div>
          </div>

          {/* ── Right: Order Summary ── */}
          <div style={{width:310,flexShrink:0,position:'sticky',top:20}}>
            <div style={{background:'linear-gradient(160deg,rgba(200,153,42,0.11),rgba(7,7,14,0.95))',border:'1px solid rgba(200,153,42,0.28)',borderRadius:20,overflow:'hidden',boxShadow:'0 8px 60px rgba(0,0,0,0.5)'}}>
              <div style={{padding:'20px 24px',borderBottom:'1px solid rgba(200,153,42,0.12)'}}>
                <div style={{fontSize:9,letterSpacing:4,color:'rgba(200,153,42,0.45)',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Your Order</div>
                <div style={{fontSize:13,color:'rgba(200,153,42,0.4)'}}>{cart.items.length} item{cart.items.length!==1?'s':''}</div>
              </div>
              <div style={{padding:'16px 24px',maxHeight:280,overflowY:'auto'}}>
                {cart.items.map(item=>(
                  <div key={item.id} style={{display:'flex',gap:12,marginBottom:14,alignItems:'flex-start'}}>
                    {item.image?<img src={item.image} alt="" style={{width:44,height:44,borderRadius:8,objectFit:'cover',border:'1px solid rgba(200,153,42,0.15)',flexShrink:0}}/>
                      :<div style={{width:44,height:44,background:'rgba(200,153,42,0.07)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📦</div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:GL,fontFamily:PF,marginBottom:2}}>UGX {Number(item.price*item.quantity).toLocaleString()}</div>
                      <div style={{fontSize:13,fontWeight:600,color:'#f0ede4',lineHeight:1.3,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.name}</div>
                      <div style={{fontSize:12,color:'rgba(200,153,42,0.4)'}}>Qty {item.quantity} × UGX {Number(item.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:'16px 24px',borderTop:'1px solid rgba(200,153,42,0.12)'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'rgba(200,153,42,0.5)',marginBottom:8}}><span>Subtotal</span><span>UGX {subtotal.toLocaleString()}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'rgba(200,153,42,0.5)',marginBottom:8}}>
                  <span>Tax{TAX_RATE>0?` (VAT ${Math.round(TAX_RATE*100)}%)`:''}</span><span>UGX {tax.toLocaleString()}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:16}}>
                  <span style={{color:'rgba(200,153,42,0.5)'}}>Delivery · {DEL_OPTS.find(o=>o.type===delivery.type)?.label||'Boda'}</span>
                  <span style={{color:delivery.fee===0?'#4ade80':GL,fontWeight:600}}>{delivery.fee===0?'FREE':`UGX ${delivery.fee.toLocaleString()}`}</span>
                </div>
                <div style={{height:1,background:'linear-gradient(90deg,transparent,rgba(200,153,42,0.3),transparent)',marginBottom:16}}/>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:700,color:'rgba(200,153,42,0.5)',textTransform:'uppercase',letterSpacing:1}}>Total</span>
                  <span style={{fontSize:24,fontWeight:900,color:'#F5D060',fontFamily:PF}}>UGX {(subtotal+tax+delivery.fee).toLocaleString()}</span>
                </div>
              </div>
              <div style={{padding:'14px 24px',background:'rgba(74,222,128,0.05)',borderTop:'1px solid rgba(74,222,128,0.12)',display:'flex',gap:10,alignItems:'flex-start'}}>
                <span style={{fontSize:18,flexShrink:0}}>🛡️</span>
                <div style={{fontSize:11,color:'rgba(74,222,128,0.6)',lineHeight:1.6}}><strong style={{color:'#4ade80'}}>Buyer Protection</strong> — Payment held until delivery confirmed.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage({auth}){
  const nav=useNavigate();
  const [mode,setMode]=useState(window.location.pathname.includes('/register')?'register':'login');
  const [form,setForm,clearAuthForm]=usePersistedForm('auth',{name:'',email:'',phone:'',password:''});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const returnTo=new URLSearchParams(window.location.search).get('return')||'/';

  const submit=async()=>{
    setLoading(true);setError('');
    try{
      const payload=mode==='login'?form:{...form,referredByCode:localStorage.getItem('256mall_ref')||undefined};
      const r=await fetch(mode==='login'?'/api/auth/login':'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Authentication failed');return;}
      localStorage.setItem('256mall_token',d.token);
      localStorage.setItem('256mall_user',JSON.stringify(d.user));
      auth.setUser(d.user);
      clearAuthForm();
      nav(returnTo);
    }catch(e){setError('Connection error');}finally{setLoading(false);}
  };

  const AI={width:'100%',background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'12px 14px',fontSize:14,fontFamily:DM,marginBottom:12,outline:'none',boxSizing:'border-box',color:'#f0ede4'};
  const AF=e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.55)';e.currentTarget.style.boxShadow='0 0 12px rgba(200,153,42,0.12)';};
  const AB=e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.22)';e.currentTarget.style.boxShadow='none';};
  return(
    <div style={{background:BLACK,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:DM}}>
      <div style={{maxWidth:420,width:'100%'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{height:2,background:GOLD_STRIP,borderRadius:1,marginBottom:24}}/>
          <div onClick={()=>nav('/')} style={{cursor:'pointer',display:'inline-block'}}>
            <span style={{fontFamily:PF,fontWeight:900,fontSize:32,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>256 MALL</span>
          </div>
          <div style={{fontSize:10,letterSpacing:4,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginTop:6,fontFamily:DM}}>Uganda's Premium Marketplace</div>
        </div>
        <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.08),rgba(200,153,42,0.02))',border:'1px solid rgba(200,153,42,0.28)',borderRadius:16,padding:'36px 32px',boxShadow:'0 0 80px rgba(200,153,42,0.07),0 16px 48px rgba(0,0,0,0.6)'}}>
          <h2 style={{fontSize:24,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 4px'}}>
            {mode==='login'?'Welcome Back':'Create Account'}
          </h2>
          <div style={{fontSize:13,color:'rgba(200,153,42,0.45)',marginBottom:28,fontFamily:DM}}>256 Mall · {mode==='login'?'Sign in to your account':'Join Uganda\'s premium marketplace'}</div>
          {mode==='register'&&<input placeholder="Your full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={AI} onFocus={AF} onBlur={AB}/>}
          <input type="email" placeholder="Email address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={AI} onFocus={AF} onBlur={AB}/>
          {mode==='register'&&<input type="tel" placeholder="Phone number (+256...)" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={AI} onFocus={AF} onBlur={AB}/>}
          <input type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} onKeyDown={e=>e.key==='Enter'&&submit()} style={{...AI,marginBottom:6}} onFocus={AF} onBlur={AB}/>
          {error&&<div style={{color:'#f87171',fontSize:13,margin:'10px 0',padding:'10px 14px',background:'rgba(248,113,113,0.06)',border:'1px solid rgba(248,113,113,0.22)',borderRadius:8}}>{error}</div>}
          <button onClick={submit} disabled={loading}
            style={{width:'100%',background:loading?'rgba(200,153,42,0.2)':GSHINE,color:loading?'rgba(200,153,42,0.4)':'#07070e',border:'none',borderRadius:10,padding:'14px',fontSize:15,fontWeight:800,cursor:loading?'not-allowed':'pointer',marginTop:14,fontFamily:DM,boxShadow:loading?'none':'0 0 24px rgba(200,153,42,0.4)',letterSpacing:.3,transition:'all .2s'}}>
            {loading?'Please wait…':(mode==='login'?'Sign In →':'Create Your Account →')}
          </button>
          <div style={{borderTop:'1px solid rgba(200,153,42,0.15)',marginTop:22,paddingTop:18,textAlign:'center',fontSize:13}}>
            <span style={{color:'rgba(200,153,42,0.4)'}}>{mode==='login'?'New to 256 Mall?':'Already have an account?'} </span>
            <span onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}} style={{color:'#F5D060',cursor:'pointer',fontWeight:700}}>
              {mode==='login'?'Create your account':'Sign in'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sell Page ─────────────────────────────────────────────────────────────────
const SELL_DISTRICTS=['Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Mbale','Kabale','Masaka','Soroti','Arua','Hoima','Fort Portal','Entebbe','Ntinda','Kira','Kasese','Iganga','Tororo','Moroto','Kitgum','Apac','Nebbi','Adjumani','Moyo','Yumbe','Koboko','Maracha','Zombo','Pakwach','Nwoya','Amuru','Pader','Agago','Kole','Alebtong','Otuke','Oyam','Dokolo','Amolatar','Kaberamaido','Kaliro','Namutumba','Bugweri','Butebo','Pallisa','Budaka','Kibuku','Kween','Bulambuli','Sironko','Manafwa','Namisindwa','Butaleja','Busia','Tororo','Bukedea','Serere','Ngora','Katakwi','Amuria','Kapelebyong','Kumi','Bukedea','Kaabong','Abim','Kotido','Napak','Nakapiripirit','Amudat','Nabilatuk','Kakumiro','Kagadi','Bunyangabu','Kabarole','Kamwenge','Kyegegwa','Kyenjojo','Ntoroko','Bundibugyo','Kibaale','Mubende','Mityana','Kiboga','Butebo','Gomba','Lwengo','Kalungu','Bukomansimbi','Lyantonde','Rakai','Kiruhura','Isingiro','Ntungamo','Mitooma','Sheema','Buhweju','Bushenyi','Rubirizi','Kanungu','Rukiga','Rubanda','Rukungiri','Kisoro','Kisoro','Kabale','Luwero','Nakaseke','Nakasongola','Kayunga','Buikwe','Buvuma','Mayuge','Bugiri','Kamuli','Buyende','Luuka','Namayingo','Butebo','Kasanda','Mubende'];

const SELLER_TYPES=[
  {value:'retail',  icon:'🛍️', label:'Individual / Retail Seller',
   desc:'Sell clothes, electronics, household items, beauty products, crafts, phones, accessories, or any everyday products.',
   detail:'Best for individuals, small shops, online sellers, and anyone starting from a phone.'},
  {value:'business',icon:'🏢', label:'Business / Registered Shop',
   desc:'For registered companies, shops, boutiques, supermarkets, pharmacies, hardware stores, restaurants, and established brands.',
   detail:'Create your online storefront, manage products, receive orders, and grow your business across Uganda.'},
  {value:'farmer',  icon:'🌾', label:'Farmer / Producer',
   desc:'Sell fresh produce, fruits, vegetables, grains, livestock, poultry, dairy products, and raw agricultural products.',
   detail:'Reach buyers, markets, restaurants, traders, and businesses across all 146 districts.'},
  {value:'wholesale',icon:'🏭',label:'Wholesaler / Distributor',
   desc:'Supply products in bulk to retailers, supermarkets, restaurants, schools, institutions, resellers, and businesses.',
   detail:'Best for distributors, importers, manufacturers, and large-scale suppliers.'},
];

const SELL_CATEGORIES=[
  {value:'electronics',  icon:'📱', label:'Electronics & Phones',       color:'#3b82f6',
   desc:'Phones, laptops, TVs, accessories, gaming, smart devices and electronics.',
   subs:['Smartphones','Laptops','Tablets','TVs','Audio & Speakers','Gaming','Accessories','Smart Devices','Cameras']},
  {value:'fashion',      icon:'👗', label:'Fashion & Clothing',          color:'#ec4899',
   desc:'Clothing, shoes, bags, jewelry, watches and fashion accessories.',
   subs:['Women\'s Fashion','Men\'s Fashion','Shoes','Bags','Watches','Jewelry','African Wear','Kids Fashion']},
  {value:'beauty',       icon:'💄', label:'Beauty & Personal Care',      color:'#d946ef',
   desc:'Beauty products, cosmetics, skincare, haircare and perfumes.',
   subs:['Makeup','Skincare','Hair Care','Perfumes','Barbershop Products','Salon Supplies']},
  {value:'home',         icon:'🏠', label:'Home & Living',               color:'#f97316',
   desc:'Furniture, home appliances, kitchenware and household products.',
   subs:['Furniture','Kitchen Appliances','Home Decor','Bedding','Cleaning Supplies','Cookware']},
  {value:'agriculture',  icon:'🌾', label:'Agriculture & Farm Produce',  color:'#16a34a',
   desc:'Fresh produce, grains, farm inputs and agricultural products.',
   subs:['Vegetables','Fruits','Grains','Seeds','Fertilizers','Farm Tools','Dairy Products']},
  {value:'livestock',    icon:'🐄', label:'Livestock & Poultry',         color:'#92400e',
   desc:'Live animals, poultry, feeds and livestock-related products.',
   subs:['Cattle','Goats','Sheep','Pigs','Poultry','Rabbits','Animal Feeds','Veterinary Supplies']},
  {value:'wholesale',    icon:'🏭', label:'Wholesale & Bulk Supply',     color:'#0891b2',
   desc:'Bulk products supplied to retailers, institutions and resellers.',
   subs:['Bulk Food','Wholesale Electronics','Wholesale Fashion','Packaging','Industrial Supplies']},
  {value:'health',       icon:'💊', label:'Health & Pharmacy',           color:'#dc2626',
   desc:'Medicines, supplements, medical equipment and healthcare products.',
   subs:['Medicines','Supplements','Medical Equipment','Hygiene Products','Baby Care']},
  {value:'realestate',   icon:'🏘️', label:'Real Estate & Property',      color:'#15803d',
   desc:'Land, houses, rentals, commercial property and farm land.',
   subs:['Land','Houses for Sale','Rentals','Commercial Property','Farm Land']},
  {value:'automotive',   icon:'🚗', label:'Automotive',                  color:'#1d4ed8',
   desc:'Vehicles, motorcycles, spare parts and car accessories.',
   subs:['Cars','Motorcycles','Spare Parts','Tires','Car Accessories']},
  {value:'construction', icon:'🛠️', label:'Construction & Hardware',     color:'#b45309',
   desc:'Building materials, tools and construction supplies.',
   subs:['Cement','Steel','Paint','Plumbing','Electrical','Tools']},
  {value:'entertainment',icon:'🎮', label:'Toys, Sports & Entertainment', color:'#7c3aed',
   desc:'Toys, gaming products, sports equipment and entertainment items.',
   subs:['Toys','PlayStation','Sports Equipment','Bicycles','Musical Equipment']},
  {value:'education',    icon:'📚', label:'Books, Education & Office',   color:'#0e7490',
   desc:'Books, stationery, office supplies and educational materials.',
   subs:['Books','Stationery','School Supplies','Office Equipment','Printing Supplies']},
  {value:'services',     icon:'🧑‍💼',label:'Services & Digital Products', color:'#6d28d9',
   desc:'Professional services, digital services and online business services.',
   subs:['Graphic Design','Web Design','Social Media Services','Printing Services','Repair Services','Consulting']},
];

const BUSINESS_PRODUCT_TYPES=[
  {value:'retail-shop',label:'Retail Shop / General Merchandise'},
  {value:'supermarket',label:'Supermarket / Grocery Store'},
  {value:'mini-market',label:'Mini Market / Convenience Store'},
  {value:'wholesale-shop',label:'Wholesale Shop / Distributor'},
  {value:'electronics-shop',label:'Electronics / Phone Shop'},
  {value:'computer-shop',label:'Computer / ICT Shop'},
  {value:'fashion-boutique',label:'Fashion Boutique / Clothing Store'},
  {value:'shoe-bag-shop',label:'Shoes / Bags / Accessories Shop'},
  {value:'beauty-cosmetics',label:'Beauty / Cosmetics Shop'},
  {value:'salon-barbershop',label:'Salon / Barbershop'},
  {value:'spa-wellness',label:'Spa / Wellness Center'},
  {value:'pharmacy-clinic',label:'Pharmacy / Drug Shop'},
  {value:'medical-clinic',label:'Clinic / Medical Center'},
  {value:'dental-optical',label:'Dental / Optical Clinic'},
  {value:'restaurant',label:'Restaurant'},
  {value:'cafe-bakery',label:'Cafe / Bakery'},
  {value:'bar-lounge',label:'Bar / Lounge'},
  {value:'catering',label:'Catering Service'},
  {value:'hotel-guesthouse',label:'Hotel / Guest House / Lodge'},
  {value:'hardware',label:'Hardware / Building Materials'},
  {value:'construction',label:'Construction Company / Contractor'},
  {value:'plumbing-electrical',label:'Plumbing / Electrical Services'},
  {value:'furniture',label:'Furniture / Carpentry'},
  {value:'home-decor',label:'Home Decor / Interior Design'},
  {value:'real-estate-agency',label:'Real Estate Agency / Property Manager'},
  {value:'automotive-spares',label:'Auto Spare Parts Shop'},
  {value:'garage-mechanic',label:'Garage / Mechanic / Auto Repair'},
  {value:'car-dealer',label:'Car Dealer / Bond'},
  {value:'boda-taxi',label:'Transport / Boda / Taxi Service'},
  {value:'logistics-delivery',label:'Logistics / Delivery / Courier'},
  {value:'farm-produce',label:'Farm Produce Vendor'},
  {value:'agro-inputs',label:'Agro Inputs / Farm Supplies'},
  {value:'butchery',label:'Butchery / Meat Shop'},
  {value:'fish-seafood',label:'Fish / Seafood Vendor'},
  {value:'dairy',label:'Dairy / Milk Products'},
  {value:'other-product',label:'Other Physical Product Business'},
];

const BUSINESS_SERVICE_TYPES=[
  {value:'salon-barbershop',label:'Salon / Barbershop'},
  {value:'spa-wellness',label:'Spa / Wellness Center'},
  {value:'medical-clinic',label:'Clinic / Medical Center'},
  {value:'dental-optical',label:'Dental / Optical Clinic'},
  {value:'restaurant',label:'Restaurant'},
  {value:'cafe-bakery',label:'Cafe / Bakery'},
  {value:'bar-lounge',label:'Bar / Lounge'},
  {value:'catering',label:'Catering Service'},
  {value:'hotel-guesthouse',label:'Hotel / Guest House / Lodge'},
  {value:'construction',label:'Construction Company / Contractor'},
  {value:'plumbing-electrical',label:'Plumbing / Electrical Services'},
  {value:'real-estate-agency',label:'Real Estate Agency / Property Manager'},
  {value:'garage-mechanic',label:'Garage / Mechanic / Auto Repair'},
  {value:'boda-taxi',label:'Transport / Boda / Taxi Service'},
  {value:'logistics-delivery',label:'Logistics / Delivery / Courier'},
  {value:'school-training',label:'School / Training Center'},
  {value:'printing',label:'Printing / Branding Service'},
  {value:'professional-services',label:'Professional Services'},
  {value:'legal',label:'Legal Services / Law Firm'},
  {value:'accounting',label:'Accounting / Tax / Audit Services'},
  {value:'consulting',label:'Consulting / Business Advisory'},
  {value:'marketing-design',label:'Marketing / Branding / Graphic Design'},
  {value:'photography-video',label:'Photography / Videography'},
  {value:'it-software',label:'IT / Software / Web Services'},
  {value:'repair-services',label:'Repair Services'},
  {value:'cleaning-laundry',label:'Cleaning / Laundry Services'},
  {value:'security',label:'Security Company'},
  {value:'events',label:'Events / Decoration / Rentals'},
  {value:'travel-tourism',label:'Travel / Tourism Agency'},
  {value:'money-finance',label:'Mobile Money / Financial Services'},
  {value:'ngo-community',label:'NGO / Community Organization'},
  {value:'other-service',label:'Other Service Business'},
];

const MAX_CATS=5;

const SELL_PORTALS=[
  {id:'general',  icon:'🛍️', label:'General Seller',      sub:'Retail · Business · Wholesale · Individual',  color:YELLOW,    bg:'#fffbe6', border:YELLOW,    textColor:TEXT,  desc:'Sell products, run a shop, or list items in any category. Electronics, fashion, food, beauty and more.'},
  {id:'directory',icon:'📍', label:'Business Directory',   sub:'Shops · Services · Restaurants · Clinics',    color:'#38bdf8', bg:'#0c1a2e', border:'#0ea5e9', textColor:WHITE, desc:'List your physical business with phone, location pin, products & prices. Free listing, verified within 48 hours.'},
  {id:'animals',  icon:'🐄', label:'Animal Market Seller', sub:'Cattle · Goats · Pigs · Poultry · Rabbits',   color:'#f59e0b', bg:'#2a1800', border:'#f59e0b', textColor:WHITE, desc:'List livestock and poultry with GPS-verified farm profile. Compliance-checked under Uganda Livestock Act.'},
  {id:'export',   icon:'✈️', label:'Export Hub',           sub:'Coffee · Vanilla · Cocoa · Simsim · Tea',     color:'#60a5fa', bg:'#1e293b', border:'#3b82f6', textColor:WHITE, desc:'Reach international buyers in 50+ countries. Live FOB pricing in USD. UCDA/UEPB verified exporters.'},
  {id:'realestate',icon:'🏘️',label:'Real Estate',          sub:'Houses · Land · Farm Land · Commercial',      color:'#86efac', bg:'#f0fdf4', border:'#16a34a', textColor:TEXT,  desc:'List property for sale, rent, or lease. Free listing, reviewed within 24 hours, all 146 districts.'},
];

function SellPage({auth}){
  const nav=useNavigate();
  const [searchParams]=useSearchParams();
  const storeFormRef=useRef(null);
  const [portal,setPortal,clearPortal]=usePersistedValue('sell-portal','');
  const [step,setStep,clearStep]=usePersistedValue('sell-step',1);
  const [form,setForm,clearForm]=usePersistedForm('sell-store',{sellerType:'',shopName:'',description:'',businessOffering:'',businessPath:'',district:'',address:'',phone:'',email:'',mtnMomo:'',airtelMoney:''});
  const [selCats,setSelCats,clearSelCats]=usePersistedValue('sell-cats',[]);
  const [selSubs,setSelSubs,clearSelSubs]=usePersistedValue('sell-subs',{});
  const [catSearch,setCatSearch]=useState('');
  const [prod,setProd,clearProd]=usePersistedForm('sell-listing',{name:'',category:'',subcategory:'',price:'',description:'',condition:'new',quantity:'',delivery:[],district:'',area:''});
  const [prodImages,setProdImages]=useState([]);
  const [prodSubmitted,setProdSubmitted]=useState(false);
  const [createdSeller,setCreatedSeller,clearCreatedSeller]=usePersistedValue('sell-created-seller',null);
  const clearSellDrafts=()=>{clearPortal();clearStep();clearForm();clearSelCats();clearSelSubs();clearProd();clearCreatedSeller();};
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const fp=(k,v)=>setProd(p=>({...p,[k]:v}));
  const isService=(portal||'general')==='directory'&&form.businessOffering==='service';
  const inp={width:'100%',border:`1px solid ${BORDER}`,borderRadius:8,padding:'12px 14px',fontSize:14,fontFamily:SF,marginBottom:0,outline:'none',boxSizing:'border-box',color:TEXT,background:WHITE};
  const selInp={...inp,appearance:'none',backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23666'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:30,cursor:'pointer'};

  const toggleCat=v=>{
    if(selCats.includes(v)){setSelCats(a=>a.filter(x=>x!==v));setSelSubs(s=>{const n={...s};delete n[v];return n;});}
    else{if(selCats.length>=MAX_CATS)return;setSelCats(a=>[...a,v]);}
  };
  const toggleSub=(cat,sub)=>setSelSubs(s=>({...s,[cat]:s[cat]?.includes(sub)?s[cat].filter(x=>x!==sub):[...(s[cat]||[]),sub]}));
  const toggleDelivery=opt=>fp('delivery',prod.delivery.includes(opt)?prod.delivery.filter(x=>x!==opt):[...prod.delivery,opt]);

  const filteredCats=SELL_CATEGORIES.filter(c=>{
    if(!catSearch.trim())return true;
    const q=catSearch.toLowerCase();
    return c.label.toLowerCase().includes(q)||c.desc.toLowerCase().includes(q)||c.subs.some(s=>s.toLowerCase().includes(q));
  });

  const buildCategories=()=>selCats.map(v=>{const cat=SELL_CATEGORIES.find(c=>c.value===v);return{value:v,label:cat?.label||v,subs:selSubs[v]||[]};});

  const prodCatOptions=selCats.length>0
    ?SELL_CATEGORIES.filter(c=>selCats.includes(c.value))
    :SELL_CATEGORIES;
  const activeProdCat=SELL_CATEGORIES.find(c=>c.value===prod.category);
  const prodSubOptions=activeProdCat?.subs||[];

  const addImages=e=>{
    const files=Array.from(e.target.files||[]);
    const remaining=10-prodImages.length;
    const toAdd=files.slice(0,remaining).map(file=>({file,preview:URL.createObjectURL(file)}));
    setProdImages(imgs=>[...imgs,...toAdd]);
  };
  const removeImage=i=>setProdImages(imgs=>{URL.revokeObjectURL(imgs[i].preview);return imgs.filter((_,idx)=>idx!==i);});

  const canNext1=!!form.sellerType;
  const canNext2=form.shopName.trim()&&form.district;
  const canNext3=isService
    ?prod.name.trim()&&prod.price&&prod.description.trim()
    :prod.name.trim()&&prod.category&&prod.price&&prod.description.trim()&&prod.delivery.length>0;
  const canSubmit=form.phone.trim()&&(form.mtnMomo.trim()||form.airtelMoney.trim());

  const TOTAL_STEPS=5;
  const STEP_LABELS=['Seller Type','Shop Details','First Product','Phone & Payment','Complete Setup'];

  const buildSellReturn=(type=regType)=>{
    const params=new URLSearchParams();
    params.set('sellerType',type);
    if(type==='directory'){
      if(form.businessOffering) params.set('businessOffering',form.businessOffering);
      if(form.businessPath) params.set('businessPath',form.businessPath);
      if(prod.category) params.set('businessType',prod.category);
    }
    return `/sell?${params.toString()}`;
  };

  const selectStoreType=(id)=>{
    setPortal(id);
    f('sellerType',id);
    setError('');
    if(!auth.user){
      nav(`/register?return=${encodeURIComponent(buildSellReturn(id))}`);
      return;
    }
    setTimeout(()=>storeFormRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),80);
  };

  useEffect(()=>{
    const type=searchParams.get('sellerType');
    if(!type) return;
    const allowed=['general','freshproduce','directory','animals','electronics','export','realestate'];
    if(!allowed.includes(type)) return;
    setPortal(type);
    f('sellerType',type);
    const offering=searchParams.get('businessOffering');
    const path=searchParams.get('businessPath');
    const businessType=searchParams.get('businessType');
    if(type==='directory'){
      if(['physical-product','service'].includes(offering)) f('businessOffering',offering);
      if(['online','physical-location','both'].includes(path)) f('businessPath',path);
      if(businessType) fp('category',businessType);
    }
    if(auth.user) setTimeout(()=>storeFormRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),120);
  },[searchParams,auth.user]);

  const createStore=async()=>{
    if(!auth.user){nav('/login?return=/sell');return;}
    if(!form.sellerType){setError('Please select a store type first');return;}
    if(!form.shopName.trim()||!form.district){setError('Store name and district are required');return;}
    if(regType==='directory'&&(!form.businessOffering||!form.businessPath||!prod.category)){setError('Choose service or physical products, business path, and business type.');return;}
    if(!form.phone.trim()||!(form.mtnMomo.trim()||form.airtelMoney.trim())){setError('Phone number and at least one mobile money payout number are required');return;}
    setLoading(true);setError('');
    try{
      const categories=buildCategories();
      const catDesc=categories.length>0?`Categories: ${categories.map(c=>`${c.label}${c.subs.length?` (${c.subs.join(', ')})`:''}` ).join('; ')}.`:'';
      const directoryDesc=regType==='directory'
        ?`Directory path: ${form.businessOffering||'not selected'} · ${form.businessPath||'not selected'}.`
        :'';
      const sellerDescription=[form.description.trim(),directoryDesc,catDesc].filter(Boolean).join('\n\n');
      const sellerRes=await fetch('/api/sellers/register',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('256mall_token')}`},
        body:JSON.stringify({...form,sellerType:form.sellerType,userId:auth.user.id,description:sellerDescription,categories})});
      const sellerData=await sellerRes.json();
      if(!sellerRes.ok){setError(sellerData.error||'Registration failed');return;}
      setCreatedSeller(sellerData.seller);
      setTimeout(()=>document.getElementById('first-product-form')?.scrollIntoView({behavior:'smooth',block:'start'}),100);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const listFirstProduct=async()=>{
    if(!auth.user){nav('/login?return=/sell');return;}
    if(!createdSeller){setError(isService?'Create your store before listing your first service.':'Create your store before listing your first product.');return;}
    if(isService){
      if(!prod.name.trim()||!prod.price||!prod.description.trim()){
        setError('Service name, starting price and description are required.');
        return;
      }
    }else{
      if(!prod.name.trim()||!prod.category||!prod.price||!prod.description.trim()||prod.delivery.length===0){
        setError('Product name, category, price, description and delivery method are required.');
        return;
      }
      if(prodImages.length===0){
        setError('Add at least one real product image before listing the product.');
        return;
      }
    }
    setLoading(true);setError('');
    try{
      let imageUrls=[];
      if(prodImages.length>0){
        const fd=new FormData();
        prodImages.forEach(img=>fd.append('images',img.file));
        const upRes=await fetch('/api/upload/product-images',{method:'POST',body:fd,
          headers:{'Authorization':`Bearer ${localStorage.getItem('256mall_token')}`}});
        const upData=await upRes.json();
        if(!upRes.ok||!upData.urls?.length){setError(upData.error||'Image upload failed.');return;}
        imageUrls=upData.urls;
      }

      const productRes=await fetch('/api/products',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('256mall_token')}`},
        body:JSON.stringify({seller_id:createdSeller.id,name:prod.name,description:prod.description,
          price:parseInt(prod.price.toString().replace(/[^0-9]/g,'')),
          stock_quantity:isService?0:(prod.quantity?parseInt(prod.quantity):0),
          condition:prod.condition,subcategory:prod.subcategory,
          delivery_options:isService?[]:prod.delivery,is_pending_review:true,images:imageUrls})});
      const productData=await productRes.json().catch(()=>({}));
      if(!productRes.ok){setError(productData.error||(isService?'Failed to list service.':'Failed to list product.'));return;}

      setSuccess(true);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const goNext=()=>{
    if(step===1&&!canNext1){setError('Please select a seller type');return;}
    if(step===2&&!canNext2){setError('Shop name and district are required');return;}
    if(step===3){
      if(!canNext3){setError(isService?'Service name, price and description are required':'Product name, category, price, description and delivery method are required');return;}
      setProdSubmitted(true);
    }
    if(step===4&&!canSubmit){setError('Phone number and at least one mobile money number are required');return;}
    setError('');setStep(s=>s+1);
  };

  const SI={width:'100%',background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'12px 14px',fontSize:14,fontFamily:DM,outline:'none',boxSizing:'border-box',color:'#f0ede4',marginBottom:0};
  const SF2=e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.55)';e.currentTarget.style.boxShadow='0 0 12px rgba(200,153,42,0.12)';};
  const SB2=e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.22)';e.currentTarget.style.boxShadow='none';};

  if(success)return(
    <div style={{background:BLACK,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM,padding:16}}>
      <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.09),rgba(200,153,42,0.02))',border:'1px solid rgba(200,153,42,0.3)',borderRadius:20,padding:'52px 36px',textAlign:'center',maxWidth:520,width:'100%',boxShadow:'0 0 80px rgba(200,153,42,0.08)'}}>
        <div style={{height:3,background:GOLD_STRIP,borderRadius:2,marginBottom:32}}/>
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(74,222,128,0.15)',border:'2px solid rgba(74,222,128,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 20px',boxShadow:'0 0 32px rgba(74,222,128,0.2)'}}>🎉</div>
        <h2 style={{fontSize:26,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:12}}>Store Created on 256 Mall</h2>
        <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',marginBottom:28}}>Your shop is set up and your first {isService?'service':'product'} is waiting for review.</p>
        <div style={{display:'flex',flexDirection:'column',gap:10,margin:'0 0 28px',textAlign:'left'}}>
          {[['✅','Shop created','Your shop is set up and ready.'],
            [isService?'🧰':'📦',isService?'Service submitted':'Product submitted','Under review — goes live within 24 hrs.'],
            ['💰','Payouts ready','You\'ll receive payments via mobile money.']].map(([ic,title,sub])=>(
            <div key={title} style={{display:'flex',gap:14,alignItems:'flex-start',background:'rgba(200,153,42,0.06)',border:'1px solid rgba(200,153,42,0.18)',borderRadius:10,padding:'14px 16px'}}>
              <span style={{fontSize:22,flexShrink:0}}>{ic}</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:'#f0ede4',marginBottom:3}}>{title}</div>
                <div style={{fontSize:12,color:'rgba(200,153,42,0.5)',lineHeight:1.5}}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>setSuccess(false)||setStep(2)||setProdImages([])||setProdSubmitted(false)||setProd({name:'',category:isService?prod.category:'',subcategory:'',price:'',description:'',condition:'new',quantity:'',delivery:[],district:'',area:''})}
            style={{background:GSHINE,color:'#07070e',border:'none',borderRadius:10,padding:'13px 24px',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 20px rgba(200,153,42,0.35)'}}>
            {isService?'+ Add Another Service':'+ Add Another Product'}
          </button>
          <button onClick={()=>{clearSellDrafts();nav('/seller/dashboard');}}
            style={{background:'transparent',color:'rgba(200,153,42,0.55)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'13px 24px',fontSize:14,cursor:'pointer',fontFamily:DM}}>
            Go to Dashboard →
          </button>
        </div>
        <p style={{fontSize:12,color:'rgba(200,153,42,0.35)',marginTop:20}}>Complete verification to unlock full seller features.</p>
      </div>
    </div>
  );

  const regType=portal||'general';
  const storeSlug=(form.shopName||'your-store-name').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'your-store-name';
  const finalStoreUrl=`https://256mall.ug/store/${createdSeller?.shop_slug||storeSlug}`;
  const storeCategoryOptions=regType==='directory'
    ?(form.businessOffering==='service'?BUSINESS_SERVICE_TYPES:BUSINESS_PRODUCT_TYPES)
    :SELL_CATEGORIES.map(c=>({value:c.value,label:c.label}));
  const regTypes=[
    {id:'general',icon:'🛍️',title:'General Seller',tags:'Retail · Business · Wholesale · Individual',desc:'Sell products, run a shop, or list items in any category.'},
    {id:'freshproduce',icon:'🥬',title:'Fresh Produce',tags:'Vegetables · Fruits · Grains · Dairy',desc:'List fresh farm produce for daily delivery, priced per kg, crate, or bunch.'},
    {id:'directory',icon:'📍',title:'Business Directory',tags:'Shops · Services · Restaurants · Clinics',desc:'List your physical business with phone, location pin, products and prices.'},
    {id:'animals',icon:'🐄',title:'Animal Market Seller',tags:'Cattle · Goats · Pigs · Poultry · Rabbits',desc:'List livestock with a GPS-verified farm profile.'},
    {id:'electronics',icon:'📱',title:'Electronics',tags:'Phones · Computers · Appliances · Accessories',desc:'Sell phones, computers, appliances, condition and warranty information.'},
    {id:'export',icon:'✈️',title:'Export Hub',tags:'Coffee · Vanilla · Cocoa · Simsim · Tea',desc:'Reach international buyers with live FOB pricing in USD.'},
    {id:'realestate',icon:'🏡',title:'Real Estate',tags:'Houses · Land · Farm Land · Commercial',desc:'List property for sale, rent, or lease across all 146 districts.'},
  ];
  const panelCopy={
    general:['GENERAL SELLER STORE','Your retail storefront','Store / business name','Product category','e.g. Nakato Electronics'],
    freshproduce:['FRESH PRODUCE STORE','Your fresh market storefront','Store / vendor name','Sold by','e.g. Nalongo Fresh Produce'],
    directory:['BUSINESS DIRECTORY LISTING','Your business profile page','Business name','Business type','e.g. Kampala Comfort Clinic'],
    animals:['ANIMAL MARKET STORE','Your farm storefront','Farm / store name','Livestock type','e.g. Kiboga Livestock Farm'],
    electronics:['ELECTRONICS STORE','Your electronics storefront','Store name','Category','e.g. Kampala Tech Hub'],
    export:['EXPORT HUB STORE','Your international storefront','Export company name','Commodity','e.g. Nile Highlands Exports Ltd'],
    realestate:['REAL ESTATE STORE','Your property listings page','Agency / landlord name','Property type','e.g. Entebbe Prime Properties'],
  }[regType]||[];

  return(
    <div className="seller-reg-page">
      <style>{`
        .seller-reg-page{--ink:#0d0f0c;--paper:#f7f5f0;--paper2:#fbfaf6;--card:#fff;--line:rgba(13,15,12,.10);--line2:rgba(13,15,12,.16);--muted:rgba(13,15,12,.58);--muted2:rgba(13,15,12,.42);--gold:#92660a;--gold2:#c99a2e;--goldSoft:#d9b869;--red:#b91c1c;background:var(--paper);color:var(--ink);font-family:'Outfit','DM Sans',system-ui,sans-serif;min-height:100vh}
        .seller-reg-page *{box-sizing:border-box}
        .sr-hero{text-align:center;padding:88px 24px 64px;background:radial-gradient(ellipse 900px 400px at 50% 0%,rgba(201,154,46,.14),transparent 70%),var(--ink);border-bottom:3px solid var(--gold2)}
        .sr-eyebrow{font-family:monospace;font-size:12.5px;letter-spacing:.32em;color:var(--goldSoft);font-weight:700;margin-bottom:22px;text-transform:uppercase}
        .sr-hero h1{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:700;font-size:56px;line-height:1.1;margin:0 0 20px;color:#fff}
        .sr-hero h1 span{color:var(--goldSoft)}
        .sr-sub{font-size:16px;color:rgba(247,245,240,.68);max-width:620px;margin:0 auto 34px;line-height:1.6}
        .sr-stats{display:flex;justify-content:center;flex-wrap:wrap}
        .sr-stat{display:flex;align-items:center;gap:8px;font-family:monospace;font-size:12.5px;font-weight:700;color:#fff;padding:0 24px;border-right:1px solid rgba(247,245,240,.16)}
        .sr-stat:last-child{border-right:none}.sr-dot{width:6px;height:6px;border-radius:50%;background:var(--goldSoft)}
        .sr-step{max-width:1000px;margin:64px auto 26px;padding:0 24px}.sr-step-kicker{font-family:monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:10px}
        .sr-step-num{font-size:11px;color:#fff;background:var(--ink);width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;letter-spacing:0}.sr-step.done .sr-step-num{background:var(--gold2)}
        .sr-step-title{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:24px;font-weight:700;color:var(--ink)}.sr-step-title span{font-family:inherit;font-style:normal;font-weight:400;color:var(--muted);font-size:13px;margin-left:12px}
        .sr-line{height:1px;background:linear-gradient(90deg,var(--gold2),var(--line) 60%);margin-top:18px}
        .sr-grid{max-width:1000px;margin:0 auto;padding:0 24px 8px;display:grid;grid-template-columns:1fr 1fr;gap:16px}.sr-card{background:var(--card);border:2px solid var(--ink);border-radius:4px;padding:26px;display:flex;gap:16px;cursor:pointer;transition:.15s}.sr-card:hover,.sr-card.active{border-color:var(--gold2);box-shadow:0 10px 26px rgba(13,15,12,.12);transform:translateY(-2px)}.sr-card.full{grid-column:1/-1;max-width:490px;margin:0 auto;width:100%}
        .sr-card-icon{flex-shrink:0;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:21px;background:var(--paper);border:1.5px solid var(--ink)}.sr-card-title{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:18px;font-weight:700;margin:0 0 4px}.sr-tags{font-family:monospace;font-size:11.5px;letter-spacing:.04em;color:var(--gold);font-weight:700;margin-bottom:8px;text-transform:uppercase}.sr-desc{font-size:13.5px;line-height:1.55;color:var(--muted);margin:0}
        .sr-select{margin-top:18px;display:flex;align-items:center;justify-content:center;gap:9px;font-family:monospace;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--ink);border:2px solid var(--gold);border-radius:6px;padding:14px 18px;background:linear-gradient(120deg,#fdeec0 0%,#e9c569 25%,#c99a2e 55%,#f3d98a 80%,#e9c569 100%);box-shadow:0 4px 12px rgba(201,154,46,.35),inset 0 1px 0 rgba(255,255,255,.55)}.sr-card.active .sr-select{background:var(--ink);border-color:var(--ink);color:#fff}
        .sr-panel{max-width:1000px;margin:0 auto;padding:0 24px 8px}.sr-store-card,.sr-plan-card,.sr-theme-card{background:var(--card);border:2px solid var(--ink);border-radius:4px;padding:36px}.sr-panel-eyebrow{font-family:monospace;font-size:11.5px;letter-spacing:.14em;color:var(--gold);font-weight:700;margin-bottom:8px;text-transform:uppercase}.sr-panel-heading{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:23px;font-weight:700;margin:0 0 26px}
        .sr-store-grid{display:grid;grid-template-columns:220px 1fr;gap:32px}.sr-brand-col{display:flex;flex-direction:column;gap:14px;align-items:center}.sr-logo-drop{width:110px;height:110px;border-radius:50%;border:2px solid var(--ink);box-shadow:inset 0 0 0 4px #fff,inset 0 0 0 5px var(--gold2);background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--muted2);font-family:monospace;font-size:10.5px;font-weight:700}.sr-banner-drop{width:100%;height:60px;border-radius:4px;border:2px solid var(--ink);box-shadow:inset 0 0 0 3px #fff,inset 0 0 0 4px var(--gold2);background:var(--paper);font-family:monospace;font-size:10.5px;font-weight:700;letter-spacing:.04em;color:var(--muted2);display:flex;align-items:center;justify-content:center}
        .sr-fields{display:flex;flex-direction:column;gap:20px}.sr-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.sr-field{display:flex;flex-direction:column;gap:7px}.sr-field label{font-family:monospace;font-size:11.5px;font-weight:700;letter-spacing:.05em;color:var(--muted2);text-transform:uppercase}.sr-field input,.sr-field select,.sr-field textarea{border:1px solid var(--line2);background:var(--paper);border-radius:9px;padding:11px 13px;font-family:inherit;font-size:14px;color:#0d0f0c;width:100%}.sr-field input::placeholder,.sr-field textarea::placeholder{color:rgba(13,15,12,.38)}.sr-field textarea{min-height:70px;resize:vertical}
        .sr-double-frame{position:relative;border:2px solid var(--ink);box-shadow:inset 0 0 0 4px #fff,inset 0 0 0 5px var(--gold2)}
        .sr-url{display:flex;align-items:center;border:1px solid var(--line2);background:var(--paper);border-radius:9px;overflow:hidden}.sr-prefix{padding:11px 12px;font-family:monospace;font-size:12.5px;color:var(--muted);background:rgba(13,15,12,.04);border-right:1px solid var(--line2);white-space:nowrap}.sr-url input{border:none;background:transparent;border-radius:0}.sr-status{font-family:monospace;font-size:11.5px;color:var(--gold);font-weight:700;margin-top:2px}
        .sr-plans,.sr-themes{display:flex;gap:16px;flex-wrap:wrap}.sr-plan,.sr-theme{flex:1 1 210px;border:1.5px solid var(--ink);border-radius:6px;padding:20px;cursor:pointer}.sr-plan.active,.sr-theme.active{border-color:var(--gold);box-shadow:0 8px 20px rgba(146,102,10,.14)}.sr-plan-name,.sr-theme-name{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:16px;font-weight:700;margin-bottom:4px}.sr-price{font-family:'Playfair Display',Georgia,serif;font-size:26px;color:var(--gold);margin:10px 0 2px}.sr-pill{display:inline-block;font-family:monospace;font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff;background:var(--gold2);padding:3px 9px;border-radius:999px;margin:8px 0 12px}.sr-small{font-size:12px;color:var(--muted);line-height:1.5}.sr-swatches{display:flex;gap:8px;margin-bottom:14px}.sr-swatch{width:26px;height:26px;border-radius:50%;border:1px solid rgba(13,15,12,.15)}
        .sr-link-panel{max-width:1000px;margin:0 auto;padding:0 24px 90px}.sr-link-card{background:var(--ink);border:2px solid var(--gold2);border-radius:6px;padding:36px;color:var(--paper);text-align:center}.sr-link-box{display:flex;max-width:560px;margin:0 auto 16px;border:1px solid rgba(247,245,240,.22);border-radius:10px;overflow:hidden;background:rgba(247,245,240,.06)}.sr-link-box input{flex:1;border:none;background:transparent;color:var(--paper);font-family:monospace;font-size:14px;padding:13px 16px}.sr-link-box button,.sr-create{border:none;background:linear-gradient(135deg,var(--gold2),var(--gold));color:#fff;font-size:13px;font-weight:800;padding:0 22px;cursor:pointer}.sr-create{border-radius:8px;padding:13px 28px;color:#fff}.sr-create:disabled{opacity:.6;cursor:not-allowed}.sr-footer{margin-top:30px;padding-top:24px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .sr-image-drop{position:relative;border:2px dashed var(--gold2);background:rgba(201,154,46,.08);border-radius:10px;padding:22px;text-align:center;color:var(--gold);font-family:monospace;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}.sr-image-drop input{position:absolute;inset:0;opacity:0;cursor:pointer}.sr-image-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.sr-image-thumb{position:relative;aspect-ratio:1;border-radius:8px;background-size:cover;background-position:center;border:1px solid var(--line2);overflow:hidden}.sr-image-thumb button{position:absolute;top:5px;right:5px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(13,15,12,.82);color:#fff;cursor:pointer}
        @media(max-width:700px){.sr-grid,.sr-store-grid,.sr-row{grid-template-columns:1fr}.sr-hero h1{font-size:38px}.sr-stat{border-right:none;padding:6px 14px}.sr-brand-col{flex-direction:row}.sr-card.full{max-width:none}.sr-step-title span{display:block;margin:6px 0 0}.sr-link-box{flex-direction:column}.sr-link-box button{padding:12px}}
      `}</style>

      <section className="sr-hero">
        <div className="sr-eyebrow">256 Mall · Seller Registration</div>
        <h1>Start Selling on <span>256 Mall</span></h1>
        <p className="sr-sub">Reach 45 million Ugandans · Unlimited product listings · Get paid via MTN MoMo or Airtel Money</p>
        <div className="sr-stats">
          {['Unlimited products','MoMo payouts','146 districts','Sales analytics'].map(x=><div key={x} className="sr-stat"><span className="sr-dot"/>{x}</div>)}
        </div>
      </section>

      <div className="sr-step done"><div className="sr-step-kicker"><span className="sr-step-num">1</span> Step One</div><div className="sr-step-title">Choose your registration type<span>Your store is built for the category you pick</span></div><div className="sr-line"/></div>
      <div className="sr-grid">
        {regTypes.map((r,i)=>(
          <button key={r.id} type="button" onClick={()=>selectStoreType(r.id)} className={`sr-card ${regType===r.id?'active':''} ${i===6?'full':''}`}>
            <div className="sr-card-icon">{r.icon}</div>
            <div style={{flex:1,textAlign:'left'}}>
              <div className="sr-card-title">{r.title}</div>
              <div className="sr-tags">{r.tags}</div>
              <p className="sr-desc">{r.desc}</p>
              <div className="sr-select"><span>{regType===r.id?'✓':''}</span>Select this store type</div>
            </div>
          </button>
        ))}
      </div>

      {!auth.user&&(
        <div className="sr-panel" style={{marginTop:30}}>
          <div className="sr-store-card" style={{textAlign:'center'}}>
            <div className="sr-panel-heading">Create your account to continue</div>
            <p className="sr-small" style={{margin:'0 0 20px'}}>Choose your path now. You can still change it after account creation before creating the store.</p>
            {regType==='directory'&&(
              <div className="sr-fields" style={{textAlign:'left',marginBottom:22}}>
                <div className="sr-row">
                  <div className="sr-field"><label>What do you offer?</label><select value={form.businessOffering} onChange={e=>{f('businessOffering',e.target.value);fp('category','');}}><option value="">Select</option><option value="physical-product">Physical Products</option><option value="service">Services</option></select></div>
                  <div className="sr-field"><label>Business path</label><select value={form.businessPath} onChange={e=>f('businessPath',e.target.value)}><option value="">Select</option><option value="online">Online Business</option><option value="physical-location">Physical Location</option><option value="both">Online + Physical Location</option></select></div>
                </div>
                <div className="sr-field"><label>Business type</label><select value={prod.category} onChange={e=>fp('category',e.target.value)} disabled={!form.businessOffering}><option value="">{!form.businessOffering?'Choose product/service first':'Select'}</option>{storeCategoryOptions.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
              </div>
            )}
            <button className="sr-create" onClick={()=>nav(`/register?return=${encodeURIComponent(buildSellReturn(regType))}`)}>Create Account to Continue</button>
          </div>
        </div>
      )}

      {auth.user&&(
        <>
          <div className="sr-step" ref={storeFormRef}><div className="sr-step-kicker"><span className="sr-step-num">2</span> Step Two</div><div className="sr-step-title">Set up your store<span>Add your own photos and business details</span></div><div className="sr-line"/></div>
          <div className="sr-panel">
            <div className="sr-panel-eyebrow">{panelCopy[0]}</div>
            <div className="sr-panel-heading">{panelCopy[1]}</div>
            <div className="sr-store-card">
              <div className="sr-store-grid">
                <div className="sr-brand-col">
                  <div className="sr-logo-drop"><span style={{fontSize:22}}>{regTypes.find(r=>r.id===regType)?.icon}</span><span>STORE LOGO</span></div>
                  <div className="sr-banner-drop">+ Add cover banner</div>
                </div>
                <div className="sr-fields">
                  {regType==='directory'&&(
                    <>
                      <div className="sr-row">
                        <div className="sr-field"><label>What do you offer?</label><select value={form.businessOffering} onChange={e=>{f('businessOffering',e.target.value);fp('category','');}}><option value="">Select</option><option value="physical-product">Physical Products</option><option value="service">Services</option></select></div>
                        <div className="sr-field"><label>Business path</label><select value={form.businessPath} onChange={e=>f('businessPath',e.target.value)}><option value="">Select</option><option value="online">Online Business</option><option value="physical-location">Physical Location</option><option value="both">Online + Physical Location</option></select></div>
                      </div>
                    </>
                  )}
                  <div className="sr-row">
                    <div className="sr-field"><label>{panelCopy[2]}</label><input value={form.shopName} onChange={e=>f('shopName',e.target.value)} placeholder={panelCopy[4]}/></div>
                    <div className="sr-field"><label>{panelCopy[3]}</label><select value={prod.category} onChange={e=>fp('category',e.target.value)} disabled={regType==='directory'&&!form.businessOffering}><option value="">{regType==='directory'&&!form.businessOffering?'Choose product/service first':'Select'}</option>{storeCategoryOptions.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                  </div>
                  <div className="sr-field"><label>Store URL</label><div className="sr-url"><div className="sr-prefix">256mall.ug/store/</div><input value={storeSlug} onChange={e=>f('shopName',e.target.value.replace(/-/g,' '))}/></div><div className="sr-status">✓ Available</div></div>
                  <div className="sr-field"><label>Store description</label><textarea value={form.description} onChange={e=>f('description',e.target.value)} placeholder="Tell buyers what you sell and what makes your store different."/></div>
                  <div className="sr-row">
                    <div className="sr-field"><label>District</label><select value={form.district} onChange={e=>f('district',e.target.value)}><option value="">Select district</option>{[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                    <div className="sr-field"><label>MoMo / Airtel payout number</label><input value={form.mtnMomo||form.airtelMoney} onChange={e=>f('mtnMomo',e.target.value)} placeholder="07XX XXX XXX"/></div>
                  </div>
                  <div className="sr-row">
                    <div className="sr-field"><label>Phone</label><input value={form.phone} onChange={e=>f('phone',e.target.value)} placeholder="07XX XXX XXX"/></div>
                    <div className="sr-field"><label>Email</label><input value={form.email} onChange={e=>f('email',e.target.value)} placeholder="seller@example.com"/></div>
                  </div>
                </div>
              </div>
              <div className="sr-footer">
                <div className="sr-small">Your storefront will use this name, category, payout number and public contact information.</div>
                <button className="sr-create" type="button" onClick={createStore} disabled={loading||!!createdSeller}>{createdSeller?'Store Created':loading?'Creating store...':'Create Store'}</button>
              </div>
              {error&&<div style={{marginTop:14,color:'#b91c1c',fontSize:13}}>{error}</div>}
            </div>
          </div>

          {createdSeller&&(
            <>
              <div className="sr-step done" id="first-product-form"><div className="sr-step-kicker"><span className="sr-step-num">3</span> {isService?'First Service':'First Product'}</div><div className="sr-step-title">{isService?'List your first service':'List your first product'}<span>{isService?'Services are reviewed before they go live':'Products need real images before they can go live'}</span></div><div className="sr-line"/></div>
              <div className="sr-panel">
                <div className="sr-store-card sr-double-frame">
                  {isService?(
                    <div className="sr-fields">
                      <div className="sr-field"><label>Service name</label><input value={prod.name} onChange={e=>fp('name',e.target.value)} placeholder="e.g. Same-Day Kampala Delivery"/></div>
                      <div className="sr-row">
                        <div className="sr-field"><label>Starting price / rate (UGX)</label><input value={prod.price} onChange={e=>fp('price',e.target.value)} placeholder="UGX 15,000"/></div>
                        <div className="sr-field"><label>Coverage area / districts served</label><input value={prod.subcategory} onChange={e=>fp('subcategory',e.target.value)} placeholder="e.g. Kampala, Wakiso, Mukono"/></div>
                      </div>
                      <div className="sr-field"><label>Service description</label><textarea value={prod.description} onChange={e=>fp('description',e.target.value)} placeholder="Describe exactly what buyers get, response time and how to book."/></div>
                      <div className="sr-field">
                        <label>Service photos (optional)</label>
                        <div className="sr-image-drop">Add photos of your work, vehicle or team<input type="file" accept="image/*" multiple onChange={addImages}/></div>
                        {prodImages.length>0&&<div className="sr-image-grid">{prodImages.map((img,i)=><div key={img.preview} className="sr-image-thumb" style={{backgroundImage:`url(${img.preview})`}}><button type="button" onClick={()=>removeImage(i)}>×</button></div>)}</div>}
                        <div className="sr-status">Optional — services can go live without photos.</div>
                      </div>
                    </div>
                  ):(
                    <div className="sr-fields">
                      <div className="sr-row">
                        <div className="sr-field"><label>Product name</label><input value={prod.name} onChange={e=>fp('name',e.target.value)} placeholder="e.g. Ankara Wrap Dress"/></div>
                        <div className="sr-field"><label>Product category</label><select value={prod.category} onChange={e=>fp('category',e.target.value)}><option value="">Select category</option>{prodCatOptions.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                      </div>
                      <div className="sr-row">
                        <div className="sr-field"><label>Price</label><input value={prod.price} onChange={e=>fp('price',e.target.value)} placeholder="UGX 50,000"/></div>
                        <div className="sr-field"><label>Quantity</label><input value={prod.quantity} onChange={e=>fp('quantity',e.target.value)} placeholder="10"/></div>
                      </div>
                      <div className="sr-row">
                        <div className="sr-field"><label>Condition</label><select value={prod.condition} onChange={e=>fp('condition',e.target.value)}><option value="new">Brand New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div>
                        <div className="sr-field"><label>Subcategory</label><select value={prod.subcategory} onChange={e=>fp('subcategory',e.target.value)}><option value="">Optional</option>{prodSubOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                      </div>
                      <div className="sr-field"><label>Product description</label><textarea value={prod.description} onChange={e=>fp('description',e.target.value)} placeholder="Describe the exact item buyers will receive."/></div>
                      <div className="sr-field"><label>Delivery options</label><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['pickup','boda','courier','upcountry'].map(opt=><button key={opt} type="button" onClick={()=>toggleDelivery(opt)} className="sr-create" style={{background:prod.delivery.includes(opt)?'linear-gradient(135deg,var(--gold2),var(--gold))':'transparent',color:prod.delivery.includes(opt)?'#fff':'var(--gold)',border:'1px solid var(--gold2)',padding:'9px 14px'}}>{prod.delivery.includes(opt)?'✓ ':''}{opt}</button>)}</div></div>
                      <div className="sr-field">
                        <label>Product images</label>
                        <div className="sr-image-drop">Add actual product images<input type="file" accept="image/*" multiple onChange={addImages}/></div>
                        {prodImages.length>0&&<div className="sr-image-grid">{prodImages.map((img,i)=><div key={img.preview} className="sr-image-thumb" style={{backgroundImage:`url(${img.preview})`}}><button type="button" onClick={()=>removeImage(i)}>×</button></div>)}</div>}
                        <div className="sr-status">Required: at least one real product image before submission.</div>
                      </div>
                    </div>
                  )}
                  <div className="sr-footer">
                    <div className="sr-small">{isService?'Your service will be reviewed first before it appears live.':'Your product will be reviewed first. It cannot appear live without uploaded product images.'}</div>
                    <button className="sr-create" type="button" onClick={listFirstProduct} disabled={loading}>{loading?(isService?'Submitting service...':'Submitting product...'):(isService?'List First Service':'List First Product')}</button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="sr-step"><div className="sr-step-kicker"><span className="sr-step-num">{createdSeller?'4':'3'}</span> Step {createdSeller?'Four':'Three'}</div><div className="sr-step-title">Choose your subscription plan<span>Unlimited product listings on every plan</span></div><div className="sr-line"/></div>
          <div className="sr-panel"><div className="sr-plan-card"><div className="sr-plans">
            {[['Rural & Farm Produce','UGX 10,000','Villages · Farms · Rural Districts'],['Town & City','UGX 20,000','Towns · Municipalities · Cities'],['Wholesale','UGX 30,000','Bulk · Kikuubo-Style · Traders'],['Export','UGX 50,000','International Buyers']].map((p,i)=><div key={p[0]} className={`sr-plan ${i===0?'active':''}`}><div className="sr-plan-name">{p[0]}</div><div className="sr-small">{p[2]}</div><div className="sr-price">{p[1]} <span style={{fontSize:11,color:'var(--muted)'}}>/month</span></div><div className="sr-pill">Unlimited Products</div><div className="sr-small">Flat monthly fee per store, not a per-item charge.</div></div>)}
          </div></div></div>

          <div className="sr-step"><div className="sr-step-kicker"><span className="sr-step-num">{createdSeller?'5':'4'}</span> Step {createdSeller?'Five':'Four'}</div><div className="sr-step-title">Choose your store theme<span>This colors your storefront</span></div><div className="sr-line"/></div>
          <div className="sr-panel"><div className="sr-theme-card"><div className="sr-themes">
            {[['Gold Heritage',['#92660a','#c99a2e','#0d0f0c']],['Emerald Prestige',['#1f5c3f','#3f8f66','#0d0f0c']],['Crimson Elegance',['#8a1a1a','#b91c1c','#0d0f0c']],['Sapphire Blue',['#1e4d8f','#3f7fc9','#0d0f0c']],['Pearl White',['#9a8b6a','#cbbf9c','#fff']],['Amber Orange',['#b5560a','#e8873a','#0d0f0c']]].map((t,i)=><div key={t[0]} className={`sr-theme ${i===0?'active':''}`}><div className="sr-swatches">{t[1].map(c=><span key={c} className="sr-swatch" style={{background:c}}/>)}</div><div className="sr-theme-name">{t[0]}</div><div className="sr-small">{i===0?'The 256 Mall signature look.':'Optional storefront accent theme.'}</div></div>)}
          </div></div></div>

          <div className="sr-step"><div className="sr-step-kicker"><span className="sr-step-num">{createdSeller?'6':'5'}</span> Step {createdSeller?'Six':'Five'}</div><div className="sr-step-title">Get your store link<span>Share it anywhere</span></div><div className="sr-line"/></div>
          <div className="sr-link-panel"><div className="sr-link-card"><div className="sr-panel-eyebrow">Your store link</div><div className="sr-panel-heading" style={{color:'var(--paper)'}}>Here is your storefront link</div><div className="sr-link-box"><input readOnly value={finalStoreUrl}/><button onClick={()=>navigator.clipboard?.writeText(finalStoreUrl)}>Copy Link</button></div><div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}><a className="share-btn" href={`https://wa.me/?text=${encodeURIComponent('Check out my store on 256 Mall: '+finalStoreUrl)}`} target="_blank" rel="noopener noreferrer" style={{color:'var(--paper)',border:'1px solid rgba(247,245,240,.22)',padding:'9px 18px',borderRadius:8}}>Share on WhatsApp</a><button className="sr-create" onClick={()=>{clearSellDrafts();nav('/seller/dashboard');}}>View Dashboard</button></div></div></div>
        </>
      )}
    </div>
  );

  return(
    <div style={{background:BLACK,minHeight:'100vh',fontFamily:DM}}>

      {/* Hero */}
      <div style={{background:'linear-gradient(180deg,#0f0a00 0%,#0a0800 50%,#050503 100%)',borderBottom:'1px solid rgba(200,153,42,0.2)',padding:'44px 20px 36px',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:GOLD_STRIP}}/>
        <div style={{fontSize:10,letterSpacing:5,color:'rgba(200,153,42,0.45)',fontWeight:700,textTransform:'uppercase',marginBottom:12,fontFamily:DM}}>256 Mall · Seller Registration</div>
        <h1 style={{fontSize:32,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 10px'}}>Start Selling on 256 Mall</h1>
        <p style={{fontSize:14,color:'rgba(200,153,42,0.5)',margin:0,lineHeight:1.7}}>Reach 45 million Ugandans · Zero listing fees · Get paid via MTN MoMo or Airtel Money</p>
        <div style={{display:'flex',gap:24,justifyContent:'center',marginTop:18,flexWrap:'wrap'}}>
          {[['🆓','Free to list'],['📱','MoMo payouts'],['🚚','146 districts'],['📊','Sales analytics']].map(([ic,lb])=>(
            <div key={lb} style={{fontSize:13,color:'rgba(200,153,42,0.6)',display:'flex',alignItems:'center',gap:6}}><span>{ic}</span><span>{lb}</span></div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:740,margin:'0 auto',padding:'28px 16px 80px'}}>

        {/* Portal picker */}
        <div style={{marginBottom:portal==='general'?24:0}}>
          <div style={{fontSize:10,letterSpacing:3,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:14,textAlign:'center',fontFamily:DM}}>Choose Your Registration Type</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
            {SELL_PORTALS.map(p=>{
              const active=portal===p.id;
              const isExternal=p.id!=='general';
              return(
                <button key={p.id}
                  onClick={()=>{
                    if(isExternal){
                      if(p.id==='directory')nav('/directory?list=1');
                      else if(p.id==='animals')nav('/animals/register');
                      else if(p.id==='export')nav('/export/register');
                      else if(p.id==='realestate')nav('/realestate/list');
                    }else{setPortal(active?'':p.id);setStep(1);setError('');}
                  }}
                  style={{position:'relative',display:'flex',alignItems:'flex-start',gap:12,textAlign:'left',
                    background:active?'rgba(200,153,42,0.1)':'rgba(200,153,42,0.03)',
                    border:`2px solid ${active?'rgba(200,153,42,0.5)':'rgba(200,153,42,0.15)'}`,
                    borderRadius:12,padding:'16px',cursor:'pointer',fontFamily:DM,
                    transition:'all .15s',boxShadow:active?'0 0 24px rgba(200,153,42,0.12)':'none'}}>
                  <div style={{width:44,height:44,borderRadius:10,background:active?'rgba(200,153,42,0.2)':'rgba(200,153,42,0.06)',border:`1px solid ${active?'rgba(200,153,42,0.4)':'rgba(200,153,42,0.15)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{p.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:active?'#F5D060':'#f0ede4',marginBottom:3}}>{p.label}</div>
                    <div style={{fontSize:11,color:'rgba(200,153,42,0.45)',marginBottom:4,lineHeight:1.4}}>{p.sub}</div>
                    <div style={{fontSize:11,color:'rgba(200,153,42,0.35)',lineHeight:1.5}}>{p.desc}</div>
                  </div>
                  {active&&p.id==='general'&&<div style={{position:'absolute',top:12,right:14,fontSize:16,color:'#F5D060'}}>✓</div>}
                  {isExternal&&<div style={{position:'absolute',top:12,right:14,fontSize:11,color:'rgba(200,153,42,0.45)',fontWeight:600}}>→</div>}
                </button>
              );
            })}
          </div>
        </div>

        {portal==='general'&&(
          <>
            {!auth.user?(
              <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))',border:'1px solid rgba(200,153,42,0.22)',borderRadius:14,padding:'36px 28px',textAlign:'center',marginTop:4,boxShadow:'0 2px 32px rgba(0,0,0,0.5)'}}>
                <div style={{fontSize:40,marginBottom:14}}>🔐</div>
                <h3 style={{fontSize:18,fontWeight:800,fontFamily:PF,color:'#f0ede4',marginBottom:8}}>Sign In to Continue</h3>
                <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',marginBottom:24,lineHeight:1.6}}>You need a 256 Mall account to register as a seller.</p>
                <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                  <button onClick={()=>nav('/register?return=/sell')} style={{background:GSHINE,color:'#07070e',border:'none',borderRadius:10,padding:'12px 24px',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 20px rgba(200,153,42,0.35)'}}>Create Account →</button>
                  <button onClick={()=>nav('/login?return=/sell')} style={{background:'transparent',color:'rgba(200,153,42,0.55)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'12px 24px',fontSize:14,cursor:'pointer',fontFamily:DM}}>Sign In</button>
                </div>
              </div>
            ):(
              <>
                {/* Progress bar */}
                <div style={{margin:'24px 0 20px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:0}}>
                    {STEP_LABELS.map((label,i)=>{
                      const n=i+1;const done=step>n;const active=step===n;
                      return(
                        <React.Fragment key={n}>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1,minWidth:0}}>
                            <div style={{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:12,fontWeight:800,flexShrink:0,marginBottom:6,
                              background:done?GSHINE:active?GSHINE:'rgba(200,153,42,0.1)',
                              color:'#07070e',
                              border:`2px solid ${done||active?'transparent':'rgba(200,153,42,0.2)'}`,
                              boxShadow:active?'0 0 0 4px rgba(200,153,42,0.2),0 0 16px rgba(200,153,42,0.35)':'none',
                              opacity:done||active?1:0.5,
                              transition:'all .2s'}}>
                              {done?'✓':n}
                            </div>
                            <div style={{fontSize:9,fontWeight:active?700:400,color:active?'#F5D060':'rgba(200,153,42,0.35)',textAlign:'center',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:64,textTransform:'uppercase',letterSpacing:.5}}>{label}</div>
                          </div>
                          {i<TOTAL_STEPS-1&&<div style={{height:2,flex:1,background:step>n?GSHINE:'rgba(200,153,42,0.12)',marginBottom:20,transition:'background .3s'}}/>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))',border:'1px solid rgba(200,153,42,0.22)',borderRadius:14,padding:'28px 24px',boxShadow:'0 2px 40px rgba(0,0,0,0.5)'}}>

                  {/* STEP 1 — Seller Type */}
                  {step===1&&(
                    <div>
                      <h3 style={{fontSize:20,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 6px'}}>What type of seller are you?</h3>
                      <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',margin:'0 0 22px',lineHeight:1.6}}>Choose the option that best describes your business.</p>
                      <div style={{display:'flex',flexDirection:'column',gap:12}}>
                        {SELLER_TYPES.map(({value,icon,label,desc,detail})=>{
                          const sel=form.sellerType===value;
                          return(
                            <button key={value} onClick={()=>f('sellerType',value)}
                              style={{display:'flex',alignItems:'flex-start',gap:16,
                                background:sel?'rgba(200,153,42,0.1)':'rgba(200,153,42,0.03)',
                                border:`2px solid ${sel?'rgba(200,153,42,0.55)':'rgba(200,153,42,0.15)'}`,
                                borderRadius:12,padding:'18px',cursor:'pointer',textAlign:'left',fontFamily:DM,
                                boxShadow:sel?'0 0 24px rgba(200,153,42,0.12)':'none',
                                transition:'all .15s'}}>
                              <div style={{width:50,height:50,borderRadius:12,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,
                                background:sel?'rgba(200,153,42,0.2)':'rgba(200,153,42,0.06)',border:`1px solid ${sel?'rgba(200,153,42,0.4)':'rgba(200,153,42,0.15)'}`}}>
                                {icon}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:15,fontWeight:700,color:sel?'#F5D060':'#f0ede4',marginBottom:5,lineHeight:1.3}}>{label}</div>
                                <div style={{fontSize:13,color:'rgba(200,153,42,0.5)',marginBottom:5,lineHeight:1.6}}>{desc}</div>
                                <div style={{fontSize:12,color:sel?'rgba(200,153,42,0.7)':'rgba(200,153,42,0.35)',lineHeight:1.5,fontStyle:'italic'}}>{detail}</div>
                              </div>
                              <div style={{width:22,height:22,borderRadius:'50%',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',
                                background:sel?GSHINE:'transparent',border:`2px solid ${sel?'transparent':'rgba(200,153,42,0.25)'}`,
                                fontSize:12,color:'#07070e',fontWeight:800,transition:'all .15s',boxShadow:sel?'0 0 10px rgba(200,153,42,0.4)':'none'}}>
                                {sel?'✓':''}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 2 — Shop Details */}
                  {step===2&&(
                    <div>
                      <h3 style={{fontSize:20,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 6px'}}>Tell us about your shop</h3>
                      <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',margin:'0 0 22px',lineHeight:1.6}}>This appears on your public seller profile.</p>
                      <div style={{display:'flex',flexDirection:'column',gap:16}}>
                        <div>
                          <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Shop / Business Name *</label>
                          <input placeholder="e.g. Nakato Electronics, Ssempala Farm, Kibo Fashions" value={form.shopName} onChange={e=>f('shopName',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                        </div>

                        {/* Category selector */}
                        <div style={{background:'rgba(200,153,42,0.04)',border:'1.5px solid rgba(200,153,42,0.2)',borderRadius:14,padding:'18px 16px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                            <label style={{fontSize:13,fontWeight:700,color:'#f0ede4',fontFamily:DM}}>What categories do you sell in?</label>
                            <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:10,
                              background:selCats.length===MAX_CATS?'rgba(248,113,113,0.1)':'rgba(200,153,42,0.1)',
                              color:selCats.length===MAX_CATS?'#f87171':'#F5D060',
                              border:`1px solid ${selCats.length===MAX_CATS?'rgba(248,113,113,0.3)':'rgba(200,153,42,0.3)'}`}}>
                              {selCats.length}/{MAX_CATS}
                            </span>
                          </div>
                          <p style={{fontSize:12,color:'rgba(200,153,42,0.4)',margin:'0 0 14px',lineHeight:1.5}}>Select up to 5 categories that best describe what you sell.</p>
                          {selCats.length>0&&(
                            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14,padding:'10px 12px',background:'rgba(200,153,42,0.04)',borderRadius:9,border:'1px solid rgba(200,153,42,0.15)'}}>
                              {selCats.map(v=>{
                                const cat=SELL_CATEGORIES.find(c=>c.value===v);
                                return(
                                  <button key={v} onClick={()=>toggleCat(v)}
                                    style={{display:'inline-flex',alignItems:'center',gap:5,background:cat.color+'22',
                                      border:`1.5px solid ${cat.color}66`,borderRadius:20,padding:'5px 11px 5px 9px',
                                      fontSize:12,fontWeight:600,color:cat.color,cursor:'pointer',fontFamily:DM}}>
                                    <span>{cat.icon}</span><span>{cat.label}</span>
                                    <span style={{fontSize:16,fontWeight:300,lineHeight:1,marginLeft:3,opacity:.65}}>×</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div style={{position:'relative',marginBottom:12}}>
                            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'rgba(200,153,42,0.4)',pointerEvents:'none'}}>🔍</span>
                            <input placeholder="Search categories — e.g. phones, maize, clothing..."
                              value={catSearch} onChange={e=>setCatSearch(e.target.value)}
                              style={{...SI,paddingLeft:38}} onFocus={SF2} onBlur={SB2}/>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,maxHeight:460,overflowY:'auto',paddingRight:2}}>
                            {filteredCats.length===0&&<div style={{gridColumn:'1 / -1',textAlign:'center',padding:'24px 0',color:'rgba(200,153,42,0.4)',fontSize:13}}>No categories match your search.</div>}
                            {filteredCats.map(cat=>{
                              const sel=selCats.includes(cat.value);
                              const locked=!sel&&selCats.length>=MAX_CATS;
                              const subsForCat=selSubs[cat.value]||[];
                              return(
                                <div key={cat.value} style={{border:`2px solid ${sel?cat.color+'88':'rgba(200,153,42,0.12)'}`,borderRadius:10,background:sel?cat.color+'0d':'rgba(200,153,42,0.03)',opacity:locked?0.4:1,overflow:'hidden',gridColumn:sel?'1 / -1':'auto',transition:'all .15s'}}>
                                  <button onClick={()=>!locked&&toggleCat(cat.value)}
                                    style={{width:'100%',display:'flex',alignItems:'flex-start',gap:11,background:'transparent',border:'none',padding:'12px 13px',cursor:locked?'not-allowed':'pointer',textAlign:'left',fontFamily:DM}}>
                                    <div style={{width:36,height:36,borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginTop:1,background:sel?cat.color+'22':'rgba(200,153,42,0.06)',border:`1px solid ${sel?cat.color+'55':'rgba(200,153,42,0.15)'}`}}>{cat.icon}</div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:13,fontWeight:700,color:sel?cat.color:'#f0ede4',marginBottom:3,lineHeight:1.2}}>{cat.label}</div>
                                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',lineHeight:1.45}}>{cat.desc}</div>
                                    </div>
                                    <div style={{width:20,height:20,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2,background:sel?cat.color:'transparent',border:`2px solid ${sel?cat.color:'rgba(200,153,42,0.2)'}`,fontSize:11,color:'#07070e',fontWeight:800,transition:'all .15s'}}>{sel?'✓':''}</div>
                                  </button>
                                  {sel&&(
                                    <div style={{padding:'0 13px 13px',borderTop:`1px dashed ${cat.color}44`}}>
                                      <div style={{fontSize:11,fontWeight:600,color:cat.color,textTransform:'uppercase',letterSpacing:.5,margin:'9px 0 8px'}}>Subcategories <span style={{color:MUTED,fontWeight:400,textTransform:'none',letterSpacing:0}}>(optional)</span></div>
                                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                                        {cat.subs.map(sub=>{
                                          const subSel=subsForCat.includes(sub);
                                          return(<button key={sub} onClick={()=>toggleSub(cat.value,sub)} style={{background:subSel?cat.color:WHITE,color:subSel?WHITE:TEXT,border:`1.5px solid ${subSel?cat.color:BORDER}`,borderRadius:20,padding:'5px 13px',fontSize:12,fontWeight:subSel?600:400,cursor:'pointer',fontFamily:SF,transition:'all .12s'}}>{subSel?'✓ ':''}{sub}</button>);
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {selCats.length===MAX_CATS&&(
                            <div style={{fontSize:12,color:'#92400e',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'9px 13px',marginTop:10,display:'flex',alignItems:'center',gap:7}}>
                              <span style={{fontSize:15}}>⚠️</span><span>Maximum of 5 categories reached. Remove one to add another.</span>
                            </div>
                          )}
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          <div>
                            <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>District *</label>
                            <select value={form.district} onChange={e=>f('district',e.target.value)} style={{...SI,appearance:'none',cursor:'pointer'}} onFocus={SF2} onBlur={SB2}>
                              <option value="" style={{background:'#111'}}>Select district</option>
                              {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d} style={{background:'#111'}}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Area / Address</label>
                            <input placeholder="e.g. Kalerwe Market, Stall 14" value={form.address} onChange={e=>f('address',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3 — First Product */}
                  {step===3&&(
                    <div>
                      {prodSubmitted?(
                        <div style={{textAlign:'center',padding:'20px 0 24px'}}>
                          <div style={{width:70,height:70,borderRadius:'50%',background:'rgba(74,222,128,0.12)',border:'2px solid rgba(74,222,128,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,margin:'0 auto 16px',boxShadow:'0 0 24px rgba(74,222,128,0.15)'}}>📦</div>
                          <h3 style={{fontSize:18,fontWeight:900,fontFamily:PF,color:'#4ade80',margin:'0 0 8px'}}>Product Submitted!</h3>
                          <p style={{fontSize:14,color:'rgba(200,153,42,0.55)',margin:'0 0 6px',lineHeight:1.6}}>
                            <strong style={{color:'#f0ede4'}}>{prod.name}</strong> is in the review queue and will go live within 24 hours.
                          </p>
                          <p style={{fontSize:13,color:'rgba(200,153,42,0.4)'}}>Continue to add your contact and payment details.</p>
                        </div>
                      ):(
                        <>
                          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
                            <div style={{width:40,height:40,borderRadius:10,background:'rgba(200,153,42,0.15)',border:'1px solid rgba(200,153,42,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📦</div>
                            <div>
                              <h3 style={{fontSize:20,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:0}}>List Your First Product</h3>
                              <p style={{fontSize:12,color:'rgba(200,153,42,0.45)',margin:0}}>Your product goes live before setup is complete.</p>
                            </div>
                          </div>
                          <div style={{background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#4ade80',marginBottom:22,marginTop:14}}>
                            🚀 <strong>List first, finish setup later.</strong> Buyers can find your product while you complete your shop profile.
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:16}}>

                            <div>
                              <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Product Name *</label>
                              <input placeholder="e.g. Samsung Galaxy A54 5G, Fresh Maize (50kg bag), Black Leather Shoes" value={prod.name} onChange={e=>fp('name',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                            </div>

                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                              <div>
                                <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Category *</label>
                                <select value={prod.category} onChange={e=>{fp('category',e.target.value);fp('subcategory','');}} style={{...SI,appearance:'none',cursor:'pointer'}} onFocus={SF2} onBlur={SB2}>
                                  <option value="" style={{background:'#111'}}>Select category</option>
                                  {prodCatOptions.map(c=><option key={c.value} value={c.value} style={{background:'#111'}}>{c.icon} {c.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:6}}>Subcategory</label>
                                <select value={prod.subcategory} onChange={e=>fp('subcategory',e.target.value)} style={{...selInp,color:prod.subcategory?TEXT:MUTED}} disabled={!prod.category}>
                                  <option value="">Select subcategory</option>
                                  {prodSubOptions.map(s=><option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            </div>

                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                              <div>
                                <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Price (UGX) *</label>
                                <input placeholder="e.g. 150000" value={prod.price} onChange={e=>fp('price',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2} inputMode="numeric"/>
                              </div>
                              <div>
                                <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Condition *</label>
                                <select value={prod.condition} onChange={e=>fp('condition',e.target.value)} style={{...SI,appearance:'none',cursor:'pointer'}} onFocus={SF2} onBlur={SB2}>
                                  <option value="new" style={{background:'#111'}}>New</option>
                                  <option value="used" style={{background:'#111'}}>Used</option>
                                  <option value="refurbished" style={{background:'#111'}}>Refurbished</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Product Description *</label>
                              <textarea placeholder="Describe your product: features, size, colour, brand, what is included, condition details..." value={prod.description} onChange={e=>fp('description',e.target.value)}
                                style={{...SI,minHeight:100,resize:'vertical',lineHeight:1.6}} onFocus={SF2} onBlur={SB2}/>
                            </div>

                            <div>
                              <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Product Images <span style={{color:'rgba(200,153,42,0.35)',fontWeight:400,textTransform:'none',letterSpacing:0}}>(up to 10)</span></label>
                              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:8}}>
                                {prodImages.map((img,i)=>(
                                  <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:8,overflow:'hidden',border:'1px solid rgba(200,153,42,0.2)'}}>
                                    <img src={img.preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                    <button onClick={()=>removeImage(i)} style={{position:'absolute',top:3,right:3,width:20,height:20,borderRadius:'50%',background:'rgba(0,0,0,.75)',border:'1px solid rgba(200,153,42,0.3)',color:'#f0ede4',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
                                    {i===0&&<div style={{position:'absolute',bottom:3,left:3,fontSize:9,fontWeight:800,background:GSHINE,color:'#07070e',borderRadius:4,padding:'1px 6px'}}>MAIN</div>}
                                  </div>
                                ))}
                                {prodImages.length<10&&(
                                  <label style={{aspectRatio:'1',borderRadius:8,border:'2px dashed rgba(200,153,42,0.25)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',background:'rgba(200,153,42,0.03)',gap:4}}>
                                    <span style={{fontSize:24,color:'rgba(200,153,42,0.4)'}}>📷</span>
                                    <span style={{fontSize:10,color:'rgba(200,153,42,0.4)',textAlign:'center',lineHeight:1.3}}>Add photo</span>
                                    <input type="file" accept="image/*" multiple capture="environment" onChange={addImages} style={{display:'none'}}/>
                                  </label>
                                )}
                              </div>
                              <p style={{fontSize:11,color:'rgba(200,153,42,0.35)',margin:0}}>Tap the camera icon to take photos or choose from gallery. First image is your main listing photo.</p>
                            </div>

                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                              <div>
                                <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Quantity / Stock</label>
                                <input placeholder="e.g. 10" value={prod.quantity} onChange={e=>fp('quantity',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2} inputMode="numeric"/>
                              </div>
                              <div>
                                <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Product Location</label>
                                <select value={prod.district} onChange={e=>fp('district',e.target.value)} style={{...SI,appearance:'none',cursor:'pointer'}} onFocus={SF2} onBlur={SB2}>
                                  <option value="" style={{background:'#111'}}>Same as shop ({form.district||'district'})</option>
                                  {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d} style={{background:'#111'}}>{d}</option>)}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:10,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Delivery Options *</label>
                              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                {[['walkin','🚶','Walk-in / In Store','Customers visit your shop and buy directly.'],
                                  ['pickup','🏪','Self Pickup','Buyer orders and collects from your location.'],
                                  ['delivery','🛵','Local Delivery','You deliver within your district or nearby areas.'],
                                  ['nationwide','🚚','Nationwide Delivery','Deliver to any of the 146 districts in Uganda.']].map(([val,ic,title,sub])=>{
                                  const sel=prod.delivery.includes(val);
                                  return(
                                    <button key={val} onClick={()=>toggleDelivery(val)}
                                      style={{display:'flex',alignItems:'flex-start',gap:12,
                                        background:sel?'rgba(200,153,42,0.1)':'rgba(200,153,42,0.03)',
                                        border:`2px solid ${sel?'rgba(200,153,42,0.55)':'rgba(200,153,42,0.15)'}`,
                                        borderRadius:10,padding:'14px',cursor:'pointer',textAlign:'left',fontFamily:DM,
                                        transition:'all .15s',boxShadow:sel?'0 0 16px rgba(200,153,42,0.1)':'none'}}>
                                      <span style={{fontSize:22,flexShrink:0,lineHeight:1,marginTop:1}}>{ic}</span>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:13,fontWeight:700,color:sel?'#F5D060':'#f0ede4',marginBottom:3}}>{title}</div>
                                        <div style={{fontSize:11,color:'rgba(200,153,42,0.45)',lineHeight:1.4}}>{sub}</div>
                                      </div>
                                      <div style={{width:20,height:20,borderRadius:'50%',flexShrink:0,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',
                                        background:sel?GSHINE:'transparent',border:`2px solid ${sel?'transparent':'rgba(200,153,42,0.25)'}`,
                                        fontSize:11,color:'#07070e',fontWeight:800,transition:'all .15s',boxShadow:sel?'0 0 10px rgba(200,153,42,0.4)':'none'}}>
                                        {sel?'✓':''}
                                      </div>
                                    </button>
                                  );
                                })}
                                {prod.delivery.length===0&&<div style={{fontSize:11,color:'#f87171',padding:'8px 12px',background:'rgba(248,113,113,0.08)',borderRadius:8,border:'1px solid rgba(248,113,113,0.2)',marginTop:4}}>⚠️ Select at least one fulfillment option so buyers know how to receive their order.</div>}
                              </div>
                            </div>

                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* STEP 4 — Phone & Payment */}
                  {step===4&&(
                    <div>
                      <h3 style={{fontSize:20,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 6px'}}>Phone & Payment Details</h3>
                      <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',margin:'0 0 22px',lineHeight:1.6}}>Add your contact details and at least one mobile money number where you can receive payouts.</p>
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          <div>
                            <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Phone Number *</label>
                            <input placeholder="07XX XXX XXX" value={form.phone} onChange={e=>f('phone',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                          </div>
                          <div>
                            <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Email Address</label>
                            <input placeholder="yourname@email.com" type="email" value={form.email} onChange={e=>f('email',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                          </div>
                        </div>
                        <div style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.28)',borderRadius:10,padding:'14px 16px',fontSize:13,color:'#f0ede4',lineHeight:1.6}}>
                          💰 <strong style={{color:'#F5D060'}}>Payout setup</strong> — Add at least one mobile money number where you can receive payouts from completed orders on 256 Mall.
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                          <div>
                            <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>MTN MoMo Number</label>
                            <input placeholder="077 / 078 XXXXXXX" value={form.mtnMomo} onChange={e=>f('mtnMomo',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                          </div>
                          <div>
                            <label style={{fontSize:10,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1.5,fontFamily:DM}}>Airtel Money Number</label>
                            <input placeholder="070 / 075 XXXXXXX" value={form.airtelMoney} onChange={e=>f('airtelMoney',e.target.value)} style={SI} onFocus={SF2} onBlur={SB2}/>
                          </div>
                        </div>
                        {error&&<div style={{color:'#f87171',fontSize:13,padding:'10px 14px',background:'rgba(248,113,113,0.06)',borderRadius:8,border:'1px solid rgba(248,113,113,0.22)'}}>{error}</div>}
                      </div>
                    </div>
                  )}

                  {/* STEP 5 — Complete Setup */}
                  {step===5&&(
                    <div>
                      <h3 style={{fontSize:20,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 6px'}}>Complete Seller Setup</h3>
                      <p style={{fontSize:13,color:'rgba(200,153,42,0.5)',margin:'0 0 20px',lineHeight:1.6}}>Review your details below and create your shop.</p>
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
                        {[
                          ['Seller type',SELLER_TYPES.find(t=>t.value===form.sellerType)?.label||'—'],
                          ['Shop name',form.shopName||'—'],
                          ['Categories',selCats.length>0?selCats.map(v=>SELL_CATEGORIES.find(c=>c.value===v)?.icon+' '+SELL_CATEGORIES.find(c=>c.value===v)?.label).join(', '):'None selected'],
                          ['District',form.district||'—'],
                          ['Phone',form.phone||'—'],
                          ['MTN MoMo',form.mtnMomo||'—'],
                          ['Airtel Money',form.airtelMoney||'—'],
                          ['First product',prod.name||'—'],
                        ].map(([k,v])=>(
                          <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',fontSize:13,padding:'10px 14px',background:'rgba(200,153,42,0.05)',border:'1px solid rgba(200,153,42,0.12)',borderRadius:8}}>
                            <span style={{color:'rgba(200,153,42,0.45)',flexShrink:0,marginRight:12,textTransform:'uppercase',fontSize:10,fontWeight:700,letterSpacing:1}}>{k}</span>
                            <span style={{color:'#f0ede4',fontWeight:600,textAlign:'right',minWidth:0,wordBreak:'break-word'}}>{v}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:8,padding:'12px 14px',fontSize:13,color:'#4ade80',marginBottom:10}}>
                        ✅ Your product will go live within 24 hours after review.
                      </div>
                      {error&&<div style={{color:'#f87171',fontSize:13,padding:'10px 14px',background:'rgba(248,113,113,0.06)',borderRadius:8,border:'1px solid rgba(248,113,113,0.22)',marginTop:10}}>{error}</div>}
                    </div>
                  )}

                  {/* Navigation */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:28,paddingTop:20,borderTop:'1px solid rgba(200,153,42,0.15)'}}>
                    {step>1
                      ?<button onClick={()=>{setError('');if(step===4&&prodSubmitted)setProdSubmitted(false);setStep(s=>s-1);}}
                          style={{background:'transparent',color:'rgba(200,153,42,0.55)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'11px 22px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:DM}}>
                          ← Back
                        </button>
                      :<div/>
                    }
                    {step<5
                      ?<button onClick={goNext}
                          style={{background:GSHINE,color:'#07070e',border:'none',borderRadius:10,padding:'13px 32px',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:DM,minWidth:140,boxShadow:'0 0 20px rgba(200,153,42,0.35)',letterSpacing:.3}}>
                          {step===3&&prodSubmitted?'Continue →':step===3?'Submit & Continue →':'Continue →'}
                        </button>
                      :<button onClick={submit} disabled={loading}
                          style={{background:loading?'rgba(200,153,42,0.2)':GSHINE,color:loading?'rgba(200,153,42,0.4)':'#07070e',border:'none',borderRadius:10,padding:'13px 36px',fontSize:14,fontWeight:800,cursor:loading?'not-allowed':'pointer',fontFamily:DM,boxShadow:loading?'none':'0 0 24px rgba(200,153,42,0.4)',letterSpacing:.3}}>
                          {loading?'Creating your shop…':'Complete Seller Setup →'}
                        </button>
                    }
                  </div>
                  {error&&step<4&&<div style={{color:'#f87171',fontSize:13,marginTop:12,padding:'10px 14px',background:'rgba(248,113,113,0.06)',borderRadius:8,border:'1px solid rgba(248,113,113,0.22)'}}>{error}</div>}
                </div>
              </>
            )}
          </>
        )}

        {!portal&&(
          <div style={{textAlign:'center',padding:'24px 0 0',color:'rgba(200,153,42,0.35)',fontSize:13}}>
            ↑ Select a registration type above to get started
          </div>
        )}

        <p style={{textAlign:'center',fontSize:12,color:'rgba(200,153,42,0.3)',marginTop:22,lineHeight:1.6}}>
          By registering you agree to the 256 Mall <span style={{color:'rgba(200,153,42,0.55)',cursor:'pointer'}}>Seller Terms</span> and <span style={{color:'rgba(200,153,42,0.55)',cursor:'pointer'}}>Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}

// ── Track Page ────────────────────────────────────────────────────────────────
function TrackPage(){
  const nav=useNavigate();
  const [mode,setMode]=useState('number'); // 'number' | 'phone'
  const [num,setNum]=useState('');
  const [phone,setPhone]=useState('');
  const [order,setOrder]=useState(null);
  const [orders,setOrders]=useState([]); // phone lookup returns multiple
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const trackByNumber=async()=>{
    if(!num.trim()){setError('Enter your order number.');return;}
    setLoading(true);setError('');setOrder(null);setOrders([]);
    try{
      const r=await fetch(`/api/orders/track/${num.trim().toUpperCase()}`);
      const d=await r.json();
      if(!r.ok){setError(d.error||'Order not found.');return;}
      setOrder(d.order);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const trackByPhone=async()=>{
    if(!phone.trim()){setError('Enter your phone number.');return;}
    setLoading(true);setError('');setOrder(null);setOrders([]);
    try{
      const clean=phone.replace(/\D/g,'').replace(/^256/,'0');
      const r=await fetch(`/api/orders/by-phone/${encodeURIComponent(clean)}`);
      const d=await r.json();
      if(!r.ok){setError(d.error||'No orders found for this number.');return;}
      if(d.orders.length===1)setOrder(d.orders[0]);
      else setOrders(d.orders);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const STATUS_STEPS=[
    {key:'pending',    label:'Order Placed',  icon:'📋', desc:'Your order has been received'},
    {key:'confirmed',  label:'Confirmed',     icon:'✅', desc:'Seller confirmed your order'},
    {key:'processing', label:'Preparing',     icon:'📦', desc:'Items being packed'},
    {key:'shipped',    label:'On the Way',    icon:'🏍️', desc:'Out for delivery'},
    {key:'delivered',  label:'Delivered',     icon:'🎉', desc:'Order complete'},
  ];
  const STATUS_ORDER=['pending','confirmed','processing','shipped','delivered'];

  const PAY_METHODS={mtn_momo:'MTN MoMo',airtel_money:'Airtel Money',cod:'Cash on Delivery',bank:'Bank Transfer'};
  const PAY_STATUS_STYLE={
    pending:{bg:'#fffbeb',color:'#92400e',border:'#fde68a',label:'Payment Pending'},
    paid:   {bg:'#f0fdf4',color:'#166534',border:'#bbf7d0',label:'Paid'},
    failed: {bg:'#fef2f2',color:'#991b1b',border:'#fecaca',label:'Payment Failed'},
  };
  const ORDER_STATUS_STYLE={
    pending:   {bg:'#fffbeb',color:'#92400e',label:'Pending'},
    confirmed: {bg:'#eff6ff',color:'#1d4ed8',label:'Confirmed'},
    processing:{bg:'#f5f3ff',color:'#6d28d9',label:'Processing'},
    shipped:   {bg:'#fff7ed',color:'#c2410c',label:'In Transit'},
    delivered: {bg:'#f0fdf4',color:'#166534',label:'Delivered'},
    cancelled: {bg:'#fef2f2',color:'#991b1b',label:'Cancelled'},
  };

  const OrderCard=({o,expanded=false})=>{
    const cur=Math.max(0,STATUS_ORDER.indexOf(o.status||'pending'));
    const ps=PAY_STATUS_STYLE[o.payment_status]||PAY_STATUS_STYLE.pending;
    const os=ORDER_STATUS_STYLE[o.status]||ORDER_STATUS_STYLE.pending;
    const items=Array.isArray(o.items)?o.items:[];
    return(
      <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:12,overflow:'hidden',boxShadow:'0 2px 16px rgba(0,0,0,.07)',marginBottom:16}}>
        {/* Order header */}
        <div style={{background:`linear-gradient(135deg,${NAVY},${NAVY2})`,padding:'16px 20px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.5)',fontWeight:600,letterSpacing:.8,textTransform:'uppercase',marginBottom:4}}>Order Number</div>
            <div style={{fontSize:22,fontWeight:900,color:WHITE,letterSpacing:1,fontFamily:'monospace'}}>{o.order_number}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.5)',marginTop:4}}>{o.created_at?new Date(o.created_at).toLocaleString('en-UG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):''}</div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{background:os.bg,color:os.color,fontSize:12,fontWeight:700,padding:'5px 12px',borderRadius:20}}>{os.label}</span>
            <span style={{background:ps.bg,color:ps.color,fontSize:12,fontWeight:700,padding:'5px 12px',borderRadius:20,border:`1px solid ${ps.border}`}}>{ps.label}</span>
          </div>
        </div>

        <div style={{padding:'18px 20px'}}>
          {/* Status timeline */}
          <div style={{marginBottom:22}}>
            <div style={{display:'flex',alignItems:'center',position:'relative'}}>
              <div style={{position:'absolute',left:'calc(10% + 20px)',right:'calc(10% + 20px)',top:20,height:3,background:'#e5e7eb',zIndex:0}}>
                <div style={{height:'100%',background:'#16a34a',width:`${Math.max(0,cur/(STATUS_STEPS.length-1))*100}%`,transition:'width .6s ease'}}/>
              </div>
              {STATUS_STEPS.map((s,i)=>{
                const done=i<cur;const active=i===cur;
                return(
                  <div key={s.key} style={{flex:1,textAlign:'center',zIndex:1}}>
                    <div style={{width:40,height:40,borderRadius:'50%',margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,
                      background:done?'#16a34a':active?YELLOW:'#f3f4f6',
                      border:`2px solid ${done?'#16a34a':active?ORANGE:BORDER}`,
                      boxShadow:active?'0 0 0 4px rgba(255,216,20,.3)':'none',
                      transition:'all .3s'}}>
                      {done?'✓':s.icon}
                    </div>
                    <div style={{fontSize:10,fontWeight:active||done?700:400,color:active?ORANGE:done?'#16a34a':MUTED,lineHeight:1.3}}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{textAlign:'center',marginTop:8,fontSize:13,color:MUTED}}>{STATUS_STEPS[cur]?.desc}</div>
          </div>

          {/* Items */}
          {items.length>0&&(
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>Items Ordered</div>
              <div style={{border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden'}}>
                {items.map((it,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:i>0?`1px solid ${BORDER}`:'none',background:i%2===0?WHITE:'#fafafa'}}>
                    {it.product_image
                      ?<img src={it.product_image} alt={it.product_name} style={{width:44,height:44,objectFit:'cover',borderRadius:6,flexShrink:0,border:`1px solid ${BORDER}`}}/>
                      :<div style={{width:44,height:44,background:'#f3f4f6',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>📦</div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:TEXT,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.product_name}</div>
                      <div style={{fontSize:12,color:MUTED}}>Qty: {it.quantity} × UGX {Number(it.unit_price).toLocaleString()}</div>
                    </div>
                    <div style={{fontSize:14,fontWeight:800,color:RED,flexShrink:0}}>UGX {Number(it.total_price).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals + payment */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>
            <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'14px 16px'}}>
              <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>Order Summary</div>
              {[
                ['Subtotal', `UGX ${Number(o.subtotal||0).toLocaleString()}`],
                ['Tax', `UGX ${Number(o.tax_amount||0).toLocaleString()}`],
                ['Delivery Fee', `UGX ${Number(o.delivery_fee||0).toLocaleString()}`],
              ].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,color:MUTED,marginBottom:5}}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:800,color:TEXT,marginTop:8,paddingTop:8,borderTop:`2px solid ${BORDER}`}}>
                <span>Total</span><span style={{color:RED}}>UGX {Number(o.total||0).toLocaleString()}</span>
              </div>
            </div>
            <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'14px 16px'}}>
              <div style={{fontSize:11,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>Payment</div>
              <div style={{fontSize:13,fontWeight:600,color:TEXT,marginBottom:6}}>{PAY_METHODS[o.payment_method]||o.payment_method||'—'}</div>
              <div style={{display:'inline-block',background:ps.bg,color:ps.color,fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:12,border:`1px solid ${ps.border}`,marginBottom:8}}>{ps.label}</div>
              {o.payment_status==='pending'&&o.payment_method==='mtn_momo'&&(
                <div style={{fontSize:11,color:MUTED,lineHeight:1.5}}>Dial *165# → Send Money → 256Mall<br/>Ref: <strong>{o.order_number}</strong></div>
              )}
              {o.payment_status==='pending'&&o.payment_method==='airtel_money'&&(
                <div style={{fontSize:11,color:MUTED,lineHeight:1.5}}>Dial *185# → Make Payment → 256Mall<br/>Ref: <strong>{o.order_number}</strong></div>
              )}
              {o.payment_method==='cod'&&<div style={{fontSize:11,color:MUTED}}>Pay cash when order arrives</div>}
            </div>
          </div>

          {/* Delivery address */}
          <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:8,padding:'12px 16px',marginBottom:16,display:'flex',gap:10,alignItems:'flex-start'}}>
            <span style={{fontSize:18,flexShrink:0}}>📍</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:'#0369a1',marginBottom:3}}>Delivering to</div>
              <div style={{fontSize:13,fontWeight:600,color:TEXT}}>{o.delivery_name} · {o.delivery_phone}</div>
              <div style={{fontSize:12,color:MUTED}}>{o.delivery_address}{o.delivery_address&&o.delivery_district?', ':''}{o.delivery_district}</div>
            </div>
          </div>

          {/* Boda tracker if in transit */}
          {o.id&&['shipped','confirmed','processing'].includes(o.status)&&<BodaTracker orderId={o.id}/>}

          {/* Help */}
          <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${BORDER}`,display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
            <a href="tel:+256700000000" style={{background:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:600,textDecoration:'none'}}>📞 Call Support</a>
            <a href={`https://wa.me/256700000000?text=Help with order ${o.order_number}`} target="_blank" rel="noreferrer" style={{background:'#f0fdf4',color:'#166534',border:'1px solid #bbf7d0',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:600,textDecoration:'none'}}>💬 WhatsApp Support</a>
            <button onClick={()=>nav('/account?tab=orders')} style={{background:'#f8fafc',color:MUTED,border:`1px solid ${BORDER}`,borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:DM}}>My Account →</button>
          </div>
        </div>
      </div>
    );
  };

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${NAVY},${NAVY2})`,padding:'28px 16px 24px'}}>
        <div style={{maxWidth:720,margin:'0 auto',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:10}}>📦</div>
          <h1 style={{fontSize:26,fontWeight:800,color:WHITE,margin:'0 0 6px'}}>Track Your Order</h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,.6)',margin:'0 0 24px'}}>Enter your order number or the phone number you used when ordering</p>

          {/* Mode toggle */}
          <div style={{display:'inline-flex',background:'rgba(255,255,255,.1)',borderRadius:8,padding:4,marginBottom:20}}>
            {[['number','📋 Order Number'],['phone','📱 Phone Number']].map(([key,label])=>(
              <button key={key} onClick={()=>{setMode(key);setError('');setOrder(null);setOrders([]);}}
                style={{padding:'8px 20px',borderRadius:6,border:'none',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM,transition:'all .15s',
                  background:mode===key?WHITE:'transparent',color:mode===key?TEXT:WHITE}}>
                {label}
              </button>
            ))}
          </div>

          {/* Search inputs */}
          {mode==='number'?(
            <div style={{display:'flex',gap:8,maxWidth:480,margin:'0 auto'}}>
              <input value={num} onChange={e=>setNum(e.target.value)} onKeyDown={e=>e.key==='Enter'&&trackByNumber()}
                placeholder="e.g. ORD15366483"
                style={{flex:1,border:'2px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 16px',fontSize:15,fontFamily:'monospace',outline:'none',color:TEXT,background:WHITE,letterSpacing:1}}
                autoFocus/>
              <button onClick={trackByNumber} disabled={loading}
                style={{background:YELLOW,color:TEXT,border:'none',borderRadius:8,padding:'12px 22px',fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:DM,flexShrink:0,opacity:loading?.7:1}}>
                {loading?'…':'Track'}
              </button>
            </div>
          ):(
            <div style={{display:'flex',gap:8,maxWidth:480,margin:'0 auto'}}>
              <input value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&trackByPhone()}
                placeholder="e.g. 0772 123 456"
                style={{flex:1,border:'2px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 16px',fontSize:15,fontFamily:SF,outline:'none',color:TEXT,background:WHITE}}/>
              <button onClick={trackByPhone} disabled={loading}
                style={{background:YELLOW,color:TEXT,border:'none',borderRadius:8,padding:'12px 22px',fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:DM,flexShrink:0,opacity:loading?.7:1}}>
                {loading?'…':'Find Orders'}
              </button>
            </div>
          )}
          {error&&<div style={{color:'#fca5a5',fontSize:13,marginTop:10,fontWeight:600}}>{error}</div>}
        </div>
      </div>

      <div style={{maxWidth:720,margin:'0 auto',padding:'20px 16px'}}>
        {/* Single order result */}
        {order&&<OrderCard o={order} expanded/>}

        {/* Multiple orders from phone lookup */}
        {orders.length>1&&(
          <>
            <div style={{fontSize:14,fontWeight:600,color:MUTED,marginBottom:14}}>{orders.length} orders found for this number</div>
            {orders.map(o=>(
              <div key={o.id} onClick={()=>{setOrder(o);setOrders([]);}} style={{cursor:'pointer'}}>
                <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:'14px 18px',marginBottom:10,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,transition:'box-shadow .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.1)'}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:TEXT,fontFamily:'monospace',letterSpacing:.5}}>{o.order_number}</div>
                    <div style={{fontSize:12,color:MUTED,marginTop:3}}>{o.created_at?new Date(o.created_at).toLocaleDateString('en-UG',{day:'numeric',month:'short',year:'numeric'}):''} · {(Array.isArray(o.items)?o.items.length:0)} item{(Array.isArray(o.items)?o.items.length:0)!==1?'s':''}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:15,fontWeight:800,color:RED}}>UGX {Number(o.total).toLocaleString()}</div>
                    <span style={{background:(ORDER_STATUS_STYLE[o.status]||ORDER_STATUS_STYLE.pending).bg,color:(ORDER_STATUS_STYLE[o.status]||ORDER_STATUS_STYLE.pending).color,fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:12}}>{(ORDER_STATUS_STYLE[o.status]||ORDER_STATUS_STYLE.pending).label}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!order&&orders.length===0&&!loading&&!error&&(
          <div style={{textAlign:'center',padding:'40px 20px',color:MUTED}}>
            <div style={{fontSize:56,marginBottom:14}}>🔍</div>
            <div style={{fontSize:17,fontWeight:700,color:TEXT,marginBottom:8}}>Enter your order details above</div>
            <div style={{fontSize:14,color:MUTED,marginBottom:24}}>Use your order number (starts with ORD) or the phone number you used when placing the order.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
              <button onClick={()=>nav('/products')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:8,padding:'11px 20px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>Continue Shopping</button>
              <button onClick={()=>nav('/account?tab=orders')} style={{background:WHITE,color:TEXT,border:`1px solid ${BORDER}`,borderRadius:8,padding:'11px 20px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:DM}}>My Account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Search Page ───────────────────────────────────────────────────────────────
function SearchPage({cart}){
  const nav=useNavigate();
  const [searchParams]=useSearchParams();
  const q=searchParams.get('q')||'';
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!q){setLoading(false);return;}
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r=>r.json()).then(d=>setProducts(d.products||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[q]);

  return(
    <div style={{background:LIGHT,minHeight:'100vh',padding:'16px',fontFamily:DM}}>
      <div style={{maxWidth:1280,margin:'0 auto'}}>
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:'12px 18px',marginBottom:12}}>
          <h1 style={{fontSize:18,fontWeight:400,color:TEXT,margin:'0 0 2px'}}>
            {q?<>Results for <em>"{q}"</em></>:'Search Results'}
          </h1>
          <div style={{fontSize:13,color:MUTED}}>{loading?'Searching...':products.length+' results'}</div>
        </div>
        {loading?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
            {Array(10).fill(0).map((_,i)=><div key={i} style={{height:300,background:WHITE,borderRadius:6,border:`1px solid ${BORDER}`}}/>)}
          </div>
        ):products.length===0?(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:'60px 32px',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:14}}>🔍</div>
            <div style={{fontSize:20,fontWeight:700,color:TEXT,marginBottom:8}}>No results for "{q}"</div>
            <p style={{color:MUTED,marginBottom:20}}>Try different keywords or browse our departments</p>
            <button onClick={()=>nav('/products')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'10px 22px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Browse All Products</button>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
            {products.map(p=><PCard key={p.id} p={p} onAdd={cart.add}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Produce Teaser (Home) ─────────────────────────────────────────────────────
function ProduceTeaser(){
  const nav=useNavigate();
  const [cats,setCats]=useState([]);
  useEffect(()=>{fetch('/api/produce/categories').then(r=>r.json()).then(d=>setCats((d.categories||[]).slice(0,10))).catch(()=>{});},[]);
  const DEFAULT_CATS=[
    {slug:'matooke',name:'Matooke',icon:'🍌'},{slug:'tomatoes',name:'Tomatoes',icon:'🍅'},
    {slug:'meat',name:'Fresh Beef',icon:'🥩'},{slug:'chicken',name:'Live Chicken',icon:'🐔'},
    {slug:'fresh-fish',name:'Fish',icon:'🐟'},{slug:'avocado',name:'Avocado',icon:'🥑'},
    {slug:'milk',name:'Fresh Milk',icon:'🥛'},{slug:'eggs',name:'Eggs',icon:'🥚'},
    {slug:'beans',name:'Beans',icon:'🫘'},{slug:'coffee',name:'Coffee',icon:'☕'},
  ];
  return(
    <div style={{marginBottom:8}}>
      <div style={{background:'linear-gradient(135deg,#0a3300 0%,#1a5200 100%)',padding:'22px 26px 20px',border:'1px solid #2a6a00',borderRadius:'4px 4px 0 0',fontFamily:DM}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div>
            <h2 style={{fontSize:21,fontWeight:700,color:WHITE,margin:'0 0 4px'}}>🥬 256 Fresh Market</h2>
            <div style={{fontSize:13,color:'#90ee90'}}>Fresh meat, chicken, fish, produce · Retail · Wholesale · Export</div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>nav('/produce?tier=wholesale')} style={{background:'rgba(255,255,255,.12)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:4,padding:'7px 14px',fontSize:13,cursor:'pointer',fontFamily:DM}}>Wholesale</button>
            <button onClick={()=>nav('/produce?tier=export')} style={{background:'rgba(255,255,255,.12)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:4,padding:'7px 14px',fontSize:13,cursor:'pointer',fontFamily:DM}}>Export</button>
            <button onClick={()=>nav('/produce')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'7px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM}}>Shop All →</button>
          </div>
        </div>
        <div style={{display:'flex',gap:10,overflowX:'auto',scrollbarWidth:'none'}}>
          {(cats.length>0?cats:DEFAULT_CATS).map(c=>(
            <div key={c.slug} onClick={()=>nav(`/produce?category=${c.slug}`)}
              style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:8,padding:'12px 16px',textAlign:'center',cursor:'pointer',flexShrink:0,minWidth:82,transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.2)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.1)';}}>
              <div style={{fontSize:26,marginBottom:5}}>{c.icon}</div>
              <div style={{fontSize:11,color:WHITE,fontWeight:500}}>{c.name}</div>
            </div>
          ))}
        </div>
      </div>
      <div onClick={()=>nav('/animals')} style={{background:'linear-gradient(135deg,#1a0a00 0%,#2a1800 100%)',padding:'14px 26px',border:'1px solid #3a2000',borderRadius:'0 0 4px 4px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',fontFamily:DM}}
        onMouseEnter={e=>e.currentTarget.style.background='linear-gradient(135deg,#2a1500 0%,#3a2200 100%)'}
        onMouseLeave={e=>e.currentTarget.style.background='linear-gradient(135deg,#1a0a00 0%,#2a1800 100%)'}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontSize:32}}>🐄</span>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:WHITE}}>Live Animal Market</div>
            <div style={{fontSize:12,color:'#f59e0b'}}>Cattle · Goats · Pigs · Poultry · Rabbits — GPS-pinned, verified sellers</div>
          </div>
        </div>
        <span style={{color:'#f59e0b',fontSize:20}}>›</span>
      </div>
    </div>
  );
}

// ── Produce Card ──────────────────────────────────────────────────────────────
function ProduceCard({p,onClick}){
  const {openChat}=useChat()||{};
  const tier=p.listing_tier||'retail';
  const tierColor=tier==='export'?'#2563eb':tier==='wholesale'?'#7c3aed':'#16a34a';
  const price=tier==='export'?`$${p.export_price} USD/${p.export_unit||'kg'}`:
    tier==='wholesale'?`UGX ${Number(p.wholesale_price).toLocaleString()}/${p.wholesale_unit||'kg'}`:
    `UGX ${Number(p.retail_price).toLocaleString()}/${p.retail_unit||'kg'}`;

  return(
    <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden',fontFamily:SF,transition:'box-shadow .15s',display:'flex',flexDirection:'column'}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.15)'}
      onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
      {/* Clickable image + header → detail page */}
      <div onClick={onClick} style={{cursor:'pointer'}}>
        <div style={{height:150,background:'#f0f7ee',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
          {p.photos&&p.photos[0]
            ?<img src={p.photos[0]} alt={p.product_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            :<span style={{fontSize:52}}>🥬</span>}
          <span style={{position:'absolute',top:6,left:6,background:tierColor,color:WHITE,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10}}>
            {tier.toUpperCase()}
          </span>
          {p.is_organic&&<span style={{position:'absolute',top:6,right:6,background:'#15803d',color:WHITE,fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:10}}>🌿 ORG</span>}
        </div>
        <div style={{padding:'10px 12px 8px'}}>
          <div style={{fontSize:14,fontWeight:600,color:TEXT,marginBottom:2,lineHeight:1.35}}>{p.product_name}</div>
          {p.product_name_luganda&&<div style={{fontSize:11,color:MUTED,marginBottom:4}}>{p.product_name_luganda}</div>}
          <div style={{fontSize:15,fontWeight:700,color:'#15803d',marginBottom:3}}>{price}</div>
          <div style={{fontSize:11,color:MUTED,marginBottom:8}}>📍 {p.district||'Uganda'} · {p.farmer_name||p.seller_name||'Farmer'}</div>
        </div>
      </div>
      {/* Action buttons */}
      <div style={{padding:'0 12px 12px',marginTop:'auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        <button onClick={onClick}
          style={{background:'#15803d',color:WHITE,border:'none',borderRadius:5,padding:'8px 4px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:SF}}>
          🛒 Buy Now
        </button>
        <button onClick={e=>{e.stopPropagation();openChat&&openChat({type:'produce',id:p.id,name:p.product_name,seller_id:p.farmer_id||p.seller_id,seller_name:p.farmer_name||p.seller_name,seller_phone:p.farmer_phone||p.seller_phone});}}
          style={{background:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:5,padding:'8px 4px',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:SF,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
          💬 Chat
        </button>
      </div>
    </div>
  );
}

// ── Produce Market Page ───────────────────────────────────────────────────────
function ProduceMarketPage(){
  const nav=useNavigate();
  const [searchParams,setSearchParams]=useSearchParams();
  const [listings,setListings]=useState([]);
  const [cats,setCats]=useState([]);
  const [loading,setLoading]=useState(true);
  const [total,setTotal]=useState(0);
  const tier=searchParams.get('tier')||'retail';
  const cat=searchParams.get('category')||'';
  const dist=searchParams.get('district')||'';
  const DISTRICTS=['','Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Mbale','Kabale','Masaka','Soroti','Arua','Hoima','Fort Portal'];

  useEffect(()=>{fetch('/api/produce/categories').then(r=>r.json()).then(d=>setCats(d.categories||[])).catch(()=>{});},[]);
  useEffect(()=>{load();},[tier,cat,dist]);

  const load=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({limit:24,...(tier&&{tier}),...(cat&&{category:cat}),...(dist&&{district:dist})});
      const r=await fetch(`/api/produce?${p}`);const d=await r.json();
      setListings(d.listings||[]);setTotal(d.total||0);
    }catch(e){setListings([]);}finally{setLoading(false);}
  };
  const set=obj=>setSearchParams({tier,...(cat&&{category:cat}),...(dist&&{district:dist}),...obj});

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      <div style={{background:'linear-gradient(135deg,#0a3300 0%,#1a5200 100%)',padding:'28px 24px 24px'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <h1 style={{fontSize:28,fontWeight:800,color:WHITE,margin:'0 0 6px'}}>🥬 256 Fresh Market</h1>
          <p style={{fontSize:14,color:'#90ee90',margin:'0 0 20px'}}>Farm-fresh produce from across Uganda · {total} listings available</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[['retail','🛒 Retail'],['wholesale','🏭 Wholesale'],['export','✈️ Export']].map(([t,l])=>(
              <button key={t} onClick={()=>set({tier:t,category:'',district:''})}
                style={{background:tier===t?YELLOW:'rgba(255,255,255,.15)',color:tier===t?TEXT:WHITE,border:tier===t?'none':'1px solid rgba(255,255,255,.3)',borderRadius:20,padding:'8px 20px',fontSize:14,fontWeight:tier===t?700:400,cursor:'pointer',fontFamily:DM}}>
                {l}
              </button>
            ))}
            <select value={dist} onChange={e=>set({district:e.target.value})}
              style={{marginLeft:'auto',border:'1px solid rgba(255,255,255,.3)',borderRadius:20,padding:'8px 16px',fontSize:13,background:'rgba(255,255,255,.15)',color:WHITE,fontFamily:SF,outline:'none'}}>
              {DISTRICTS.map(d=><option key={d} value={d} style={{color:TEXT}}>{d||'All Districts'}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:'0 auto',padding:'16px'}}>
        {cats.length>0&&(
          <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto',scrollbarWidth:'none',paddingBottom:4}}>
            <button onClick={()=>set({category:''})} style={{flexShrink:0,background:!cat?NAVY:WHITE,color:!cat?WHITE:TEXT,border:`1px solid ${BORDER}`,borderRadius:20,padding:'6px 16px',fontSize:13,cursor:'pointer',fontFamily:SF,fontWeight:!cat?700:400}}>All</button>
            {cats.map(c=>(
              <button key={c.slug} onClick={()=>set({category:c.slug})}
                style={{flexShrink:0,background:cat===c.slug?NAVY:WHITE,color:cat===c.slug?WHITE:TEXT,border:`1px solid ${BORDER}`,borderRadius:20,padding:'6px 16px',fontSize:13,cursor:'pointer',fontFamily:SF,fontWeight:cat===c.slug?700:400}}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {tier==='export'&&(
          <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'14px 18px',marginBottom:16,fontSize:13,color:'#1e40af',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:24}}>✈️</span>
            <div><strong>Export listings</strong> — Priced in USD · FOB Mombasa/Entebbe · Minimum order quantities apply · Contact seller for shipping terms</div>
          </div>
        )}
        {tier==='wholesale'&&(
          <div style={{background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:8,padding:'14px 18px',marginBottom:16,fontSize:13,color:'#5b21b6',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:24}}>🏭</span>
            <div><strong>Wholesale listings</strong> — Bulk prices · Minimum order quantities apply · Contact seller to confirm availability</div>
          </div>
        )}

        {loading?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
            {Array(12).fill(0).map((_,i)=><div key={i} style={{height:260,background:WHITE,borderRadius:8,border:`1px solid ${BORDER}`}}/>)}
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
            {(listings.length>0?listings:MOCK_PRODUCE.filter(p=>!tier||p.listing_tier===tier)).map(p=>(
              <ProduceCard key={p.id} p={p} onClick={()=>listings.length>0?nav(`/produce/${p.id}`):nav('/farmers/join')}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Produce Listing Detail ────────────────────────────────────────────────────
function ProduceDetailPage(){
  const nav=useNavigate();
  const {openChat}=useChat()||{};
  const {id}=useParams();
  const [listing,setListing]=useState(null);
  const [loading,setLoading]=useState(true);
  const [form,setForm,clearOrderForm]=usePersistedForm(`produce-order-${id}`,{buyer_name:'',buyer_phone:'',quantity:1,delivery_type:'pickup',delivery_address:''});
  const [ordered,setOrdered]=useState(false);
  const [err,setErr]=useState('');
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{
    fetch(`/api/produce/${id}`).then(r=>r.json()).then(d=>{if(d.listing)setListing(d.listing);}).catch(()=>{}).finally(()=>setLoading(false));
  },[id]);

  const submit=async()=>{
    if(!form.buyer_name||!form.buyer_phone||!form.quantity){setErr('Name, phone and quantity are required.');return;}
    setSubmitting(true);setErr('');
    try{
      const r=await fetch('/api/produce/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,listing_id:id})});
      const d=await r.json();
      if(!r.ok){setErr(d.error||'Order failed.');return;}
      clearOrderForm();
      setOrdered(true);
    }catch(e){setErr('Connection error.');}finally{setSubmitting(false);}
  };

  if(loading)return<div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,color:MUTED}}>Loading...</div>;
  if(!listing)return<div style={{minHeight:'60vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,color:MUTED}}>Listing not found. <span onClick={()=>nav('/produce')} style={{color:LINK,cursor:'pointer',marginLeft:8}}>Back to market →</span></div>;

  const tier=listing.listing_tier||'retail';
  const price=tier==='export'?`$${listing.export_price} USD/${listing.export_unit||'kg'}`:
    tier==='wholesale'?`UGX ${Number(listing.wholesale_price).toLocaleString()}/${listing.wholesale_unit||'kg'}`:
    `UGX ${Number(listing.retail_price).toLocaleString()}/${listing.retail_unit||'kg'}`;
  const tierColor=tier==='export'?'#2563eb':tier==='wholesale'?'#7c3aed':'#16a34a';
  const inp={width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'9px 12px',fontSize:14,fontFamily:SF,marginBottom:10,outline:'none',boxSizing:'border-box',color:TEXT};

  if(ordered)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}>
      <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:'48px',textAlign:'center',maxWidth:480}}>
        <div style={{fontSize:64,marginBottom:14}}>✅</div>
        <h2 style={{fontSize:22,fontWeight:700,color:TEXT,marginBottom:8}}>Order Placed!</h2>
        <p style={{color:MUTED,marginBottom:20}}>The seller will contact you on <strong>{form.buyer_phone}</strong> to confirm your order.</p>
        <button onClick={()=>nav('/produce')} style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:4,padding:'11px 24px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Back to Market →</button>
      </div>
    </div>
  );

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      <div style={{maxWidth:1100,margin:'0 auto',padding:'16px'}}>
        <div style={{fontSize:13,color:LINK,cursor:'pointer',marginBottom:14}} onClick={()=>nav('/produce')}>← Back to Fresh Market</div>
        <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:300}}>
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden',marginBottom:12}}>
              <div style={{height:280,background:'#f0f7ee',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {listing.photos&&listing.photos[0]?<img src={listing.photos[0]} alt={listing.product_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:80}}>🥬</span>}
              </div>
            </div>
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:18}}>
              <h1 style={{fontSize:22,fontWeight:700,color:TEXT,margin:'0 0 4px'}}>{listing.product_name}</h1>
              {listing.product_name_luganda&&<div style={{fontSize:13,color:MUTED,marginBottom:8}}>{listing.product_name_luganda}</div>}
              <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
                <span style={{background:tierColor,color:WHITE,fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:10}}>{tier.toUpperCase()}</span>
                {listing.is_organic&&<span style={{background:'#dcfce7',color:'#15803d',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:10}}>🌿 Organic</span>}
                {listing.variety&&<span style={{background:'#f0f9ff',color:'#0369a1',fontSize:11,padding:'3px 10px',borderRadius:10}}>{listing.variety}</span>}
              </div>
              <div style={{fontSize:22,fontWeight:700,color:'#15803d',marginBottom:8}}>{price}</div>
              {tier==='wholesale'&&listing.wholesale_min_qty&&<div style={{fontSize:13,color:MUTED,marginBottom:4}}>Min order: {listing.wholesale_min_qty} {listing.wholesale_unit||'units'}</div>}
              {tier==='export'&&listing.export_min_qty&&<div style={{fontSize:13,color:MUTED,marginBottom:4}}>Min order: {listing.export_min_qty} {listing.export_unit||'tonnes'}</div>}
              <div style={{fontSize:13,color:MUTED,marginBottom:4}}>📍 {listing.district||'Uganda'}{listing.village&&` · ${listing.village}`}</div>
              {listing.harvest_date&&<div style={{fontSize:13,color:MUTED,marginBottom:4}}>🗓️ Harvested: {new Date(listing.harvest_date).toLocaleDateString()}</div>}
              {listing.description&&<p style={{fontSize:14,color:TEXT,lineHeight:1.7,marginTop:12,borderTop:`1px solid ${BORDER}`,paddingTop:12}}>{listing.description}</p>}
            </div>
          </div>

          <div style={{width:300,flexShrink:0}}>
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:20,position:'sticky',top:80}}>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 16px',paddingBottom:12,borderBottom:`1px solid ${BORDER}`}}>Place Order</h3>
              <input placeholder="Your name *" value={form.buyer_name} onChange={e=>setForm({...form,buyer_name:e.target.value})} style={inp}/>
              <input placeholder="Your phone *" value={form.buyer_phone} onChange={e=>setForm({...form,buyer_phone:e.target.value})} style={inp}/>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <input type="number" min={1} placeholder="Quantity" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}
                  style={{...inp,marginBottom:0,flex:1}}/>
                <span style={{fontSize:13,color:MUTED,flexShrink:0}}>{tier==='retail'?listing.retail_unit:tier==='wholesale'?listing.wholesale_unit:listing.export_unit||'unit'}</span>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:600,color:MUTED,marginBottom:6}}>How will you receive this order?</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {(()=>{
                    const opts=Array.isArray(listing?.delivery_options)&&listing.delivery_options.length>0
                      ?listing.delivery_options:['walkin','pickup','delivery','nationwide'];
                    const MAP={
                      walkin: {icon:'🚶',label:'Walk-in / Visit in store', desc:"Come to the seller's location"},
                      pickup: {icon:'🏪',label:'Self Pickup',               desc:'Order & collect yourself — free'},
                      delivery:{icon:'🛵',label:'Local Delivery',            desc:'Delivered to your address'},
                      nationwide:{icon:'🚚',label:'Nationwide Delivery',     desc:'All 146 districts in Uganda'},
                    };
                    return opts.map(o=>{const m=MAP[o]||{icon:'📦',label:o,desc:''};const sel=form.delivery_type===o;return(
                      <button key={o} type="button" onClick={()=>setForm({...form,delivery_type:o})}
                        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',border:`2px solid ${sel?'#16a34a':BORDER}`,borderRadius:8,background:sel?'#f0fdf4':'#f8fafc',cursor:'pointer',textAlign:'left',fontFamily:DM,transition:'all .15s'}}>
                        <span style={{fontSize:18,flexShrink:0}}>{m.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:sel?700:500,color:sel?'#16a34a':TEXT}}>{m.label}</div>
                          <div style={{fontSize:11,color:MUTED}}>{m.desc}</div>
                        </div>
                        <span style={{width:18,height:18,borderRadius:'50%',border:`2px solid ${sel?'#16a34a':BORDER}`,background:sel?'#16a34a':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:WHITE,fontWeight:700,flexShrink:0}}>{sel?'✓':''}</span>
                      </button>
                    );});
                  })()}
                </div>
              </div>
              {form.delivery_type==='delivery'&&<input placeholder="Delivery address" value={form.delivery_address} onChange={e=>setForm({...form,delivery_address:e.target.value})} style={inp}/>}
              {err&&<div style={{color:RED,fontSize:13,marginBottom:10,padding:'8px 12px',background:'#fff0f0',borderRadius:4}}>{err}</div>}
              <button onClick={submit} disabled={submitting}
                style={{width:'100%',background:submitting?'#ccc':'#16a34a',color:WHITE,border:'none',borderRadius:4,padding:'12px',fontSize:15,fontWeight:700,cursor:submitting?'default':'pointer',fontFamily:DM}}>
                {submitting?'Placing Order...':'Order Now →'}
              </button>
              <div style={{fontSize:12,color:MUTED,marginTop:10,textAlign:'center'}}>Seller will confirm via phone call or WhatsApp</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wholesale Page ────────────────────────────────────────────────────────────
// ── Trade Messaging Modal ─────────────────────────────────────────────────────
function TradeMessenger({business, product, onClose}){
  const [step,setStep]=useState('intro'); // intro | chat
  const [convId,setConvId]=useState(null);
  const [messages,setMessages]=useState([]);
  const [buyer,setBuyer]=usePersistedForm('trade-buyer-identity',{name:'',phone:'',email:''});
  const [text,setText]=useState('');
  const [sending,setSending]=useState(false);
  const [file,setFile]=useState(null);
  const [videoRoom,setVideoRoom]=useState(null);
  const [typing,setTyping]=useState(false);
  const [socket,setSocket]=useState(null);
  const bottomRef=useRef(null);
  const fileRef=useRef(null);

  useEffect(()=>{
    const s=socketIO('/',{path:'/socket.io',transports:['websocket','polling']});
    setSocket(s);
    return()=>s.disconnect();
  },[]);

  useEffect(()=>{if(convId&&socket){socket.emit('join_conversation',convId);}
    socket?.on('new_message',msg=>setMessages(m=>[...m,msg]));
    socket?.on('typing',d=>{if(d.sender!=='buyer'){setTyping(true);setTimeout(()=>setTyping(false),2000);}});
    return()=>{socket?.off('new_message');socket?.off('typing');};
  },[convId,socket]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[messages,typing]);

  const startConv=async()=>{
    if(!buyer.name||(!buyer.phone&&!buyer.email)){alert('Please enter your name and phone or email');return;}
    try{
      const r=await fetch('/api/trade/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buyer_name:buyer.name,buyer_phone:buyer.phone||null,buyer_email:buyer.email||null,business_id:business.id,product_id:product?.id||null,subject:`Enquiry: ${product?.name||business.business_name}`,first_message:product?`Hi, I am interested in ${product.name}. Please share availability and best price.`:null})});
      const d=await r.json();
      if(d.success){
        setConvId(d.conversation.id);
        const r2=await fetch(`/api/trade/conversations/${d.conversation.id}`);
        const d2=await r2.json();
        setMessages(d2.messages||[]);
        setStep('chat');
      } else {
        alert(d.error||'Could not start conversation. Please try again.');
      }
    }catch(e){alert('Connection error. Please check your internet and try again.');}
  };

  const send=async()=>{
    if((!text.trim()&&!file)||sending)return;
    const msgText=text.trim();
    setSending(true);
    setText('');setFile(null);
    const optimistic={id:'tmp-'+Date.now(),sender_type:'buyer',sender_name:buyer.name,message_type:file?(file.type.startsWith('image/')?'image':'file'):'text',body:msgText,created_at:new Date().toISOString()};
    setMessages(m=>[...m,optimistic]);
    try{
      const fd=new FormData();
      fd.append('sender_type','buyer');fd.append('sender_name',buyer.name);
      if(msgText)fd.append('body',msgText);
      if(file)fd.append('file',file);
      fd.append('message_type',optimistic.message_type);
      const r=await fetch(`/api/trade/conversations/${convId}/messages`,{method:'POST',body:fd});
      const d=await r.json();
      if(d.success){
        setMessages(m=>m.map(msg=>msg.id===optimistic.id?d.message:msg));
      }
    }catch(e){
      setMessages(m=>m.filter(msg=>msg.id!==optimistic.id));
      setText(msgText);
      alert('Failed to send message. Please try again.');
    }finally{setSending(false);}
  };

  const startVideo=()=>{
    const room='256mall-trade-'+convId.slice(0,8);
    setVideoRoom(room);
    // Also send a system message
    fetch(`/api/trade/conversations/${convId}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender_type:'buyer',sender_name:buyer.name,message_type:'video_call',body:`📹 Video call started. Join: https://meet.jit.si/${room}`})});
  };

  const formatTime=d=>new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9500,display:'flex',alignItems:'center',justifyContent:'center',padding:12}} onClick={onClose}>
      <div style={{background:WHITE,borderRadius:12,width:'100%',maxWidth:520,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,.4)'}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:WHITE}}>{business.business_name}</div>
            {product&&<div style={{fontSize:11,color:'#c7d2fe'}}>{product.name} · UGX {Number(product.price_per_unit).toLocaleString()}/{product.unit}</div>}
          </div>
          {step==='chat'&&<button onClick={startVideo} title="Start video call" style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:6,padding:'6px 10px',color:WHITE,cursor:'pointer',fontSize:18}}>📹</button>}
          <button onClick={onClose} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:6,padding:'6px 10px',color:WHITE,cursor:'pointer',fontSize:16}}>✕</button>
        </div>

        {/* Video frame */}
        {videoRoom&&(
          <div style={{background:'#000',height:240,position:'relative'}}>
            <iframe src={`https://meet.jit.si/${videoRoom}#config.prejoinPageEnabled=false&config.startWithVideoMuted=false`}
              allow="camera;microphone;fullscreen;display-capture" style={{width:'100%',height:'100%',border:'none'}}/>
            <button onClick={()=>setVideoRoom(null)} style={{position:'absolute',top:8,right:8,background:'#dc2626',color:WHITE,border:'none',borderRadius:4,padding:'4px 10px',cursor:'pointer',fontSize:12,fontWeight:700}}>End Call</button>
          </div>
        )}

        {step==='intro'?(
          <div style={{padding:24,overflowY:'auto'}}>
            {product&&(
              <div style={{background:'#f5f3ff',border:'1px solid #ddd8fe',borderRadius:8,padding:14,marginBottom:20,display:'flex',gap:14,alignItems:'center'}}>
                {product.photos?.[0]&&<img src={product.photos[0]} alt={product.name} style={{width:72,height:72,objectFit:'cover',borderRadius:6}}/>}
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{product.name}</div>
                  <div style={{fontSize:13,color:'#5b21b6',fontWeight:600}}>UGX {Number(product.price_per_unit).toLocaleString()} / {product.unit}</div>
                  <div style={{fontSize:12,color:MUTED}}>Min order: {product.min_order_qty} {product.min_order_unit||product.unit}</div>
                </div>
              </div>
            )}
            <div style={{fontSize:13,color:MUTED,marginBottom:16,lineHeight:1.6}}>
              💬 All messages are <strong>on-platform</strong> and recorded for buyer protection. You can text, share images, make video calls and send offers — all inside 256 Mall.
            </div>
            {[['name','Your Full Name *'],['phone','Phone / WhatsApp'],['email','Email']].map(([k,label])=>(
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:12,color:MUTED,marginBottom:4}}>{label}</div>
                <input value={buyer[k]} onChange={e=>setBuyer(b=>({...b,[k]:e.target.value}))}
                  style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:6,padding:'9px 12px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
            <button onClick={startConv} style={{width:'100%',background:'#4f46e5',color:WHITE,border:'none',borderRadius:8,padding:'12px 0',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:SF,marginTop:8}}>
              💬 Start Secure Chat →
            </button>
            <div style={{fontSize:11,color:MUTED,textAlign:'center',marginTop:10}}>🔒 Protected by 256 Mall · No off-platform payments</div>
          </div>
        ):(
          <>
            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'12px 14px',background:'#f8fafc',display:'flex',flexDirection:'column',gap:8,minHeight:200}}>
              {messages.map((m,i)=>{
                const isMe=m.sender_type==='buyer';
                const isSystem=m.sender_type==='system';
                if(isSystem) return <div key={i} style={{textAlign:'center',fontSize:11,color:MUTED,padding:'4px 0'}}>{m.body}</div>;
                return(
                  <div key={i} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start'}}>
                    <div style={{maxWidth:'80%',background:isMe?'#4f46e5':WHITE,color:isMe?WHITE:TEXT,borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px',padding:'9px 13px',boxShadow:'0 1px 4px rgba(0,0,0,.08)'}}>
                      {m.message_type==='image'&&m.file_url&&<img src={m.file_url} alt="img" style={{maxWidth:220,borderRadius:6,display:'block',marginBottom:m.body?6:0}}/>}
                      {m.message_type==='file'&&m.file_url&&<a href={m.file_url} target="_blank" rel="noreferrer" style={{color:isMe?'#c7d2fe':'#4f46e5',fontSize:13}}>📎 {m.file_name||'Download file'}</a>}
                      {m.message_type==='video_call'&&<div style={{fontSize:13}}>📹 {m.body}</div>}
                      {m.message_type==='offer'&&<div style={{fontSize:13}}>💼 <strong>Offer:</strong> UGX {Number(m.offer_price).toLocaleString()} × {m.offer_qty} {m.offer_unit}</div>}
                      {m.body&&m.message_type==='text'&&<div style={{fontSize:13,lineHeight:1.5}}>{m.body}</div>}
                      <div style={{fontSize:10,opacity:.6,marginTop:4,textAlign:'right'}}>{formatTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              {typing&&<div style={{fontSize:12,color:MUTED,fontStyle:'italic'}}>Seller is typing...</div>}
              <div ref={bottomRef}/>
            </div>

            {/* File preview */}
            {file&&<div style={{padding:'6px 14px',background:'#f0f0ff',borderTop:`1px solid ${BORDER}`,fontSize:12,color:'#4f46e5',display:'flex',alignItems:'center',gap:8}}>
              📎 {file.name} ({(file.size/1024).toFixed(0)}KB)
              <button onClick={()=>setFile(null)} style={{marginLeft:'auto',background:'none',border:'none',color:RED,cursor:'pointer',fontSize:16}}>✕</button>
            </div>}

            {/* Input bar */}
            <div style={{padding:'10px 12px',borderTop:`1px solid ${BORDER}`,display:'flex',gap:8,alignItems:'center',background:WHITE}}>
              <button onClick={()=>fileRef.current?.click()} title="Attach file/image" style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#6366f1',flexShrink:0}}>📎</button>
              <input ref={fileRef} type="file" style={{display:'none'}} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={e=>setFile(e.target.files[0]||null)}/>
              <input value={text} onChange={e=>{setText(e.target.value);socket?.emit('typing',{convId,sender:'buyer'});}}
                onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),send())}
                placeholder="Type a message..." style={{flex:1,border:`1px solid ${BORDER}`,borderRadius:20,padding:'9px 14px',fontSize:13,fontFamily:SF,outline:'none'}}/>
              <button onClick={send} disabled={sending||(!text.trim()&&!file)}
                style={{background:'#4f46e5',color:WHITE,border:'none',borderRadius:20,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:SF,opacity:sending?0.6:1}}>
                {sending?'…':'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Wholesale Page ─────────────────────────────────────────────────────────────
// ── Wholesale Hub — B2B Trade Infrastructure ──────────────────────────────────
const TRUST_LEVELS_V2 = [
  { level:0, icon:'🆕', label:'New Seller',         color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db',
    req:'Just joined 256 Mall. No verifications yet.',
    what:'This seller has registered but not yet completed any verification steps. Exercise standard caution.',
    badge_label:'New Seller' },
  { level:1, icon:'✓',  label:'Phone Verified',     color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe',
    req:'Mobile number confirmed via OTP.',
    what:'We have confirmed this seller can receive calls and messages at the listed number.',
    badge_label:'Phone Verified' },
  { level:2, icon:'🪪', label:'Identity Verified',  color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe',
    req:'National ID (NIN), passport, or driving permit checked against seller profile.',
    what:'A real person with verified government ID is behind this account.',
    badge_label:'ID Verified' },
  { level:3, icon:'📍', label:'Location Verified',  color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc',
    req:'Physical business address confirmed on-ground by 256 Mall agent.',
    what:'An agent physically visited and confirmed this business location exists.',
    badge_label:'Location Verified' },
  { level:4, icon:'⭐', label:'Trusted Seller',     color:'#d97706', bg:'#fffbeb', border:'#fde68a',
    req:'Rating ≥ 4.0 · 10+ verified reviews · 80%+ delivery success rate.',
    what:'Earned through consistent performance — buyers rate this seller highly and orders are delivered.',
    badge_label:'Trusted Seller' },
  { level:5, icon:'🏢', label:'Registered Business',color:'#059669', bg:'#ecfdf5', border:'#a7f3d0',
    req:'TIN number and trading licence both on file with 256 Mall.',
    what:'This seller is a formally registered Ugandan business with tax and trade documentation.',
    badge_label:'Registered Biz' },
  { level:6, icon:'🏭', label:'Trade Verified',     color:'#b45309', bg:'#fff7ed', border:'#fed7aa',
    req:'Physical premises audit completed by 256 Mall trade team.',
    what:'Our trade team visited the factory, warehouse, or shop and verified production/inventory capacity.',
    badge_label:'Trade Verified' },
  { level:7, icon:'✈️', label:'Export Verified',    color:'#1d4ed8', bg:'#eff6ff', border:'#93c5fd',
    req:'Export licence, UCDA/UEPB/UFIA certification and shipping history confirmed.',
    what:'Cleared for international trade with verified export documentation and track record.',
    badge_label:'Export Verified' },
];

function getTrustMeta(biz){
  const n = biz.trust_level_num ?? 0;
  return TRUST_LEVELS_V2[Math.min(n, 7)];
}
const WH_DISTRICTS=['','Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Mbale','Kabale','Masaka','Arua','Tororo','Fort Portal','Soroti','Hoima','Moroto','Kotido','Adjumani','Moyo'];
const WH_CATS=[
  {id:'agriculture',label:'Agriculture & Food',icon:'🌾',subs:['Grains & Cereals','Coffee & Tea','Dairy','Livestock Feed','Fresh Produce','Spices','Sugar','Edible Oil']},
  {id:'construction',label:'Construction & Industrial',icon:'🏗️',subs:['Cement','Steel & Iron','Pipes & Fittings','Electricals','Roofing','Tiles','Paint','Hardware']},
  {id:'manufacturing',label:'Manufacturing Inputs',icon:'🏭',subs:['Packaging','Chemicals','Plastics','Raw Materials','Industrial Gases']},
  {id:'electronics',label:'Electronics Distribution',icon:'📱',subs:['Phones','Appliances','Solar','Accessories','Computers','Batteries']},
  {id:'textiles',label:'Fashion & Textiles',icon:'🧵',subs:['Fabrics','Kitenges','Uniforms','Tailoring Materials','Shoes','Bags']},
  {id:'hospitality',label:'Hospitality Supplies',icon:'🏨',subs:['Hotel Supplies','Restaurant Equipment','Cleaning Supplies','Linen']},
  {id:'medical',label:'Medical & Pharmaceutical',icon:'⚕️',subs:['Clinic Supplies','Hospital Equipment','Lab Supplies','PPE']},
  {id:'stationery',label:'Stationery & Office',icon:'🖊️',subs:['Paper','Printing','Office Furniture','IT Supplies']},
];

function TrustBadge({biz, size='sm'}){
  const [open,setOpen]=useState(false);
  const t=getTrustMeta(biz||{});
  const score=biz?.trust_score??0;
  const sz=size==='lg'?{fontSize:12,padding:'5px 12px',gap:5}:{fontSize:10,padding:'3px 9px',gap:4};
  return(
    <>
      <button onClick={e=>{e.stopPropagation();setOpen(true);}}
        style={{background:t.bg,color:t.color,border:`1px solid ${t.border}`,borderRadius:12,
          display:'inline-flex',alignItems:'center',gap:sz.gap,padding:sz.padding,fontSize:sz.fontSize,
          fontWeight:800,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
        {t.icon} {t.badge_label}
        {score>0&&<span style={{background:t.color,color:'#fff',borderRadius:8,padding:'1px 6px',fontSize:9,fontWeight:900}}>{score}</span>}
      </button>
      {open&&(
        <TrustModal biz={biz} onClose={()=>setOpen(false)}/>
      )}
    </>
  );
}

function TrustModal({biz,onClose}){
  const achieved=biz?.trust_level_num??0;
  const score=biz?.trust_score??0;
  const factors=[
    {label:'Star Rating',     value:biz?.rating??0,   fmt:v=>v?`${v} ★`:'No ratings yet',  good:v=>v>=4},
    {label:'Reviews',         value:biz?.total_reviews??0, fmt:v=>`${v} reviews`,            good:v=>v>=10},
    {label:'Delivery Success',value:biz?.delivery_success_rate??0, fmt:v=>`${v}%`,           good:v=>v>=80},
    {label:'Repeat Customers',value:biz?.repeat_customer_rate??0,  fmt:v=>`${v}%`,           good:v=>v>=20},
    {label:'Total Orders',    value:biz?.total_orders??0, fmt:v=>`${v} orders`,              good:v=>v>=5},
  ];
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,maxWidth:480,width:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',padding:'20px 24px',borderRadius:'16px 16px 0 0',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:4}}>{biz?.business_name}</div>
            <div style={{fontSize:13,color:'#a5b4fc'}}>Trust & Verification Report</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,color:'#fff',padding:'6px 10px',cursor:'pointer',fontSize:16}}>✕</button>
        </div>
        {/* Trust score bar */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #e5e7eb'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:700,color:'#1e1b4b'}}>Trust Score</span>
            <span style={{fontSize:24,fontWeight:900,color:score>=70?'#059669':score>=40?'#d97706':'#dc2626'}}>{score}<span style={{fontSize:13,color:'#6b7280',fontWeight:400}}>/100</span></span>
          </div>
          <div style={{height:10,background:'#e5e7eb',borderRadius:5,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${score}%`,background:score>=70?'linear-gradient(90deg,#059669,#34d399)':score>=40?'linear-gradient(90deg,#d97706,#fbbf24)':'linear-gradient(90deg,#dc2626,#f87171)',borderRadius:5,transition:'width .4s'}}/>
          </div>
          <div style={{fontSize:11,color:'#6b7280',marginTop:6}}>Based on verifications, reviews, delivery and order history</div>
        </div>
        {/* Badge levels */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #e5e7eb'}}>
          <div style={{fontSize:13,fontWeight:800,color:'#1e1b4b',marginBottom:14}}>Verification Levels</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {TRUST_LEVELS_V2.map(lvl=>{
              const earned=lvl.level<=achieved;
              return(
                <div key={lvl.level} style={{display:'flex',gap:12,alignItems:'flex-start',opacity:earned?1:.5}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:earned?lvl.bg:'#f3f4f6',border:`2px solid ${earned?lvl.border:'#e5e7eb'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>
                    {earned?lvl.icon:'○'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <span style={{fontSize:13,fontWeight:700,color:earned?lvl.color:'#6b7280'}}>{lvl.label}</span>
                      {earned&&<span style={{background:'#dcfce7',color:'#15803d',fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:8}}>EARNED</span>}
                    </div>
                    <div style={{fontSize:11,color:'#6b7280',lineHeight:1.5}}>{earned?lvl.what:lvl.req}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Dynamic factors */}
        <div style={{padding:'20px 24px'}}>
          <div style={{fontSize:13,fontWeight:800,color:'#1e1b4b',marginBottom:14}}>Performance Signals</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {factors.map(f=>(
              <div key={f.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',background:f.good(f.value)?'#f0fdf4':'#fafafa',borderRadius:8,border:`1px solid ${f.good(f.value)?'#bbf7d0':'#e5e7eb'}`}}>
                <span style={{fontSize:12,color:'#374151',fontWeight:600}}>{f.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:f.good(f.value)?'#059669':'#d97706'}}>{f.fmt(f.value)}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:16,padding:'12px 14px',background:'#f8fafc',borderRadius:8,fontSize:11,color:'#6b7280',lineHeight:1.6}}>
            💡 <strong>About Trust Levels:</strong> 256 Mall supports both formal and informal Ugandan businesses. A New Seller can still trade — trust builds gradually through activity and verification. No business is blocked for being informal.
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductTierTable({product}){
  const tiers=[];
  if(product.tier1_price){tiers.push({range:`1–${product.tier2_qty?product.tier2_qty-1:9}`,price:product.tier1_price,save:null});}
  if(product.tier2_price){const save=product.tier1_price?Math.round((1-product.tier2_price/product.tier1_price)*100):null;tiers.push({range:`${product.tier2_qty||10}–${product.tier3_qty?product.tier3_qty-1:49}`,price:product.tier2_price,save});}
  if(product.tier3_price){const save=product.tier1_price?Math.round((1-product.tier3_price/product.tier1_price)*100):null;tiers.push({range:`${product.tier3_qty||50}+`,price:product.tier3_price,save});}
  if(!tiers.length) return null;
  return(
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,marginTop:8}}>
      <thead><tr style={{background:'#f1f5f9'}}>
        <th style={{padding:'5px 8px',textAlign:'left',fontWeight:700,color:'#374151'}}>Quantity</th>
        <th style={{padding:'5px 8px',textAlign:'right',fontWeight:700,color:'#374151'}}>Price/Unit</th>
        <th style={{padding:'5px 8px',textAlign:'right',fontWeight:700,color:'#059669'}}>Save</th>
      </tr></thead>
      <tbody>{tiers.map((t,i)=>(
        <tr key={i} style={{borderTop:'1px solid #e5e7eb',background:i===tiers.length-1?'#f0fdf4':'#fff'}}>
          <td style={{padding:'5px 8px',color:'#374151'}}>{t.range} {product.unit||'units'}</td>
          <td style={{padding:'5px 8px',textAlign:'right',fontWeight:700,color:'#1e3a5f'}}>UGX {Number(t.price).toLocaleString()}</td>
          <td style={{padding:'5px 8px',textAlign:'right',color:'#059669',fontWeight:700}}>{t.save?`${t.save}%`:'—'}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function SupplierCard({biz,onMessage,onRFQ}){
  const nav=useNavigate();
  const cats=Array.isArray(biz.categories)?biz.categories:(typeof biz.categories==='string'?JSON.parse(biz.categories||'[]'):[]);
  const certs=Array.isArray(biz.certifications)?biz.certifications:(typeof biz.certifications==='string'?JSON.parse(biz.certifications||'[]'):[]);
  const wdists=Array.isArray(biz.warehouse_districts)?biz.warehouse_districts:(typeof biz.warehouse_districts==='string'?JSON.parse(biz.warehouse_districts||'[]'):[]);
  return(
    <div style={{background:WHITE,border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,.07)',display:'flex',flexDirection:'column'}}>
      {/* Header strip */}
      <div style={{background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)',padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:16,fontWeight:800,color:WHITE,marginBottom:4,lineHeight:1.2}}>{biz.business_name}</div>
          <div style={{fontSize:11,color:'#a5b4fc'}}>📍 {biz.area?`${biz.area}, `:''}{ biz.district}</div>
        </div>
        <TrustBadge biz={biz}/>
      </div>
      {/* Body */}
      <div style={{padding:'14px 16px',flex:1,display:'flex',flexDirection:'column',gap:10}}>
        {biz.description&&<p style={{fontSize:12,color:MUTED,lineHeight:1.6,margin:0}}>{biz.description.slice(0,110)}{biz.description.length>110?'…':''}</p>}
        {/* Category pills */}
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {cats.slice(0,4).map(c=><span key={c} style={{background:'#eff6ff',color:'#1d4ed8',fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:600}}>{c}</span>)}
        </div>
        {/* Price per unit — gold button */}
        {biz.featured_price>0&&(
          <div style={{background:'linear-gradient(135deg,#92620a,#d4a520,#f0c840,#d4a520,#92620a)',borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'baseline',gap:6,boxShadow:'0 2px 8px rgba(180,120,0,.3)'}}>
            <span style={{fontSize:16,fontWeight:900,color:'#1a0800'}}>UGX {Number(biz.featured_price).toLocaleString()}</span>
            <span style={{fontSize:11,fontWeight:600,color:'rgba(26,8,0,.55)'}}>/ {biz.featured_unit||'unit'}</span>
          </div>
        )}
        {/* MOQ — separate row */}
        {biz.featured_moq>0&&(
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <span style={{background:'#ede9fe',color:'#5b21b6',fontSize:10,fontWeight:800,padding:'3px 9px',borderRadius:5,letterSpacing:.5,textTransform:'uppercase',flexShrink:0}}>MOQ</span>
            <span style={{fontSize:13,color:'#1e1b4b',fontWeight:700}}>{biz.featured_moq} {biz.featured_moq_unit||biz.featured_unit||'units'}</span>
          </div>
        )}
        {/* Key stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          {biz.min_order_ugx>0&&<div style={{fontSize:11,color:'#374151'}}><span style={{fontWeight:700}}>Min. Value:</span> UGX {Number(biz.min_order_ugx).toLocaleString()}</div>}
          {biz.delivery_available&&<div style={{fontSize:11,color:'#059669',fontWeight:600}}>🚚 Delivers</div>}
          {biz.export_capability&&<div style={{fontSize:11,color:'#0369a1',fontWeight:600}}>🌍 Exports</div>}
          {biz.established_year&&<div style={{fontSize:11,color:MUTED}}>Est. {biz.established_year}</div>}
          {biz.capacity_notes&&<div style={{fontSize:11,color:MUTED,gridColumn:'1/-1'}}>⚡ {biz.capacity_notes}</div>}
        </div>
        {/* Cert pills */}
        {certs.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4}}>{certs.slice(0,3).map(c=><span key={c} style={{background:'#ecfdf5',color:'#065f46',fontSize:9,padding:'2px 7px',borderRadius:10,border:'1px solid #a7f3d0'}}>✓ {c}</span>)}</div>}
        {wdists.length>0&&<div style={{fontSize:11,color:MUTED}}>🏭 Warehouses: {wdists.slice(0,3).join(', ')}</div>}
        {biz.rating&&<div style={{fontSize:12,color:'#f59e0b',fontWeight:700}}>{'★'.repeat(Math.round(biz.rating))} {biz.rating} <span style={{color:MUTED,fontWeight:400}}>({biz.total_reviews||0} reviews)</span></div>}
      </div>
      {/* Actions */}
      <div style={{padding:'12px 16px',borderTop:'1px solid #e5e7eb',display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>nav(`/wholesale/supplier/${biz.id}`)} style={{flex:1,background:'linear-gradient(135deg,#1e1b4b,#312e81)',color:WHITE,border:'none',borderRadius:7,padding:'8px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>View Storefront →</button>
        <button onClick={()=>onRFQ&&onRFQ(biz)} style={{flex:1,background:'#fffbeb',color:'#b45309',border:'1px solid #fcd34d',borderRadius:7,padding:'8px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>📋 Request Quote</button>
        <button onClick={()=>onMessage&&onMessage(biz)} style={{background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',borderRadius:7,padding:'8px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>💬</button>
      </div>
    </div>
  );
}

function RFQBoard({onSwitchTab}){
  const [rfqs,setRfqs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [quoteModal,setQuoteModal]=useState(null);
  const [catFilter,setCatFilter]=useState('');
  const [distFilter,setDistFilter]=useState('');
  const [form,setForm]=usePersistedForm('rfq-post',{buyer_name:'',buyer_phone:'',buyer_company:'',category:'',product_name:'',quantity:'',quantity_unit:'units',description:'',delivery_district:'',delivery_date:'',budget_ugx:''});
  const [qForm,setQForm]=usePersistedForm('rfq-quote',{business_name:'',price_per_unit:'',quantity_available:'',unit:'',lead_time_days:'',payment_terms:'',notes:''});
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{loadRFQs();},[catFilter,distFilter]);
  const loadRFQs=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({status:'open',limit:30,...(catFilter&&{category:catFilter}),...(distFilter&&{district:distFilter})});
      const r=await fetch(`/api/wholesale/rfq?${p}`);const d=await r.json();
      setRfqs(d.rfqs||[]);
    }catch(e){setRfqs([]);}finally{setLoading(false);}
  };

  const submitRFQ=async()=>{
    if(!form.buyer_name||!form.buyer_phone||!form.category||!form.product_name||!form.quantity||!form.delivery_district)
      return alert('Please fill all required fields');
    setSubmitting(true);
    try{
      const tok=localStorage.getItem('256mall_token');
      const r=await fetch('/api/wholesale/rfq',{method:'POST',headers:{'Content-Type':'application/json',...(tok&&{Authorization:`Bearer ${tok}`})},body:JSON.stringify(form)});
      const d=await r.json();
      if(d.success){setShowForm(false);setForm({buyer_name:'',buyer_phone:'',buyer_company:'',category:'',product_name:'',quantity:'',quantity_unit:'units',description:'',delivery_district:'',delivery_date:'',budget_ugx:''});loadRFQs();alert('RFQ posted! Suppliers will respond shortly.');}
      else alert(d.error||'Failed to post RFQ');
    }catch(e){alert('Network error');}finally{setSubmitting(false);}
  };

  const submitQuote=async()=>{
    if(!quoteModal||!qForm.business_name||!qForm.price_per_unit||!qForm.quantity_available||!qForm.unit) return alert('Fill required fields');
    setSubmitting(true);
    try{
      const r=await fetch(`/api/wholesale/rfq/${quoteModal.id}/quote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(qForm)});
      const d=await r.json();
      if(d.success){setQuoteModal(null);setQForm({business_name:'',price_per_unit:'',quantity_available:'',unit:'',lead_time_days:'',payment_terms:'',notes:''});alert('Quote submitted!');}
      else alert(d.error||'Failed');
    }catch(e){alert('Network error');}finally{setSubmitting(false);}
  };

  const fi={width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'9px 12px',fontSize:13,fontFamily:DM,outline:'none',boxSizing:'border-box'};
  return(
    <div>
      {/* Header + filters */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:'#1e1b4b'}}>📋 RFQ Board</div>
          <div style={{fontSize:13,color:MUTED}}>Buyers post requests · Suppliers compete with best prices</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',color:WHITE,border:'none',borderRadius:8,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Post an RFQ</button>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{...fi,width:'auto',flex:1,minWidth:140}}>
          <option value="">All Categories</option>
          {WH_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <select value={distFilter} onChange={e=>setDistFilter(e.target.value)} style={{...fi,width:'auto',flex:1,minWidth:140}}>
          {WH_DISTRICTS.map(d=><option key={d} value={d}>{d||'All Districts'}</option>)}
        </select>
      </div>

      {/* RFQ list */}
      {loading?<div style={{textAlign:'center',padding:'40px 0',color:MUTED}}>Loading RFQs…</div>
      :rfqs.length===0?<div style={{textAlign:'center',padding:'60px 0',color:MUTED}}>
        <div style={{fontSize:40,marginBottom:12}}>📋</div>
        <div style={{fontWeight:700,marginBottom:8}}>No open RFQs yet</div>
        <div style={{fontSize:13}}>Be the first to post what you need</div>
        <button onClick={()=>setShowForm(true)} style={{marginTop:16,background:'#1e1b4b',color:WHITE,border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Post an RFQ</button>
      </div>
      :<div style={{display:'flex',flexDirection:'column',gap:12}}>
        {rfqs.map(rfq=>(
          <div key={rfq.id} style={{background:WHITE,border:'1px solid #e5e7eb',borderRadius:10,padding:'16px',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:15,fontWeight:800,color:'#1e1b4b'}}>{rfq.product_name}</span>
                  <span style={{background:'#eff6ff',color:'#1d4ed8',fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:10}}>{rfq.category}</span>
                  <span style={{background:'#f0fdf4',color:'#059669',fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:10}}>✦ {rfq.quote_count||0} quotes</span>
                </div>
                <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12,color:MUTED,marginBottom:6}}>
                  <span>📦 Qty: <b style={{color:'#1e1b4b'}}>{rfq.quantity} {rfq.quantity_unit}</b></span>
                  <span>📍 <b style={{color:'#1e1b4b'}}>{rfq.delivery_district}</b></span>
                  {rfq.delivery_date&&<span>📅 By <b style={{color:'#1e1b4b'}}>{new Date(rfq.delivery_date).toLocaleDateString()}</b></span>}
                  {rfq.budget_ugx&&<span>💰 Budget: <b style={{color:'#059669'}}>UGX {Number(rfq.budget_ugx).toLocaleString()}</b></span>}
                </div>
                {rfq.description&&<p style={{fontSize:12,color:MUTED,margin:0,lineHeight:1.5}}>{rfq.description.slice(0,120)}{rfq.description.length>120?'…':''}</p>}
                <div style={{fontSize:11,color:MUTED,marginTop:6}}>By {rfq.buyer_name}{rfq.buyer_company?` · ${rfq.buyer_company}`:''} · {new Date(rfq.created_at).toLocaleDateString()}</div>
              </div>
              <button onClick={()=>setQuoteModal(rfq)} style={{background:'linear-gradient(135deg,#d97706,#b45309)',color:WHITE,border:'none',borderRadius:7,padding:'9px 18px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>Submit Quote →</button>
            </div>
          </div>
        ))}
      </div>}

      {/* Post RFQ Modal */}
      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setShowForm(false)}>
          <div style={{background:WHITE,borderRadius:14,padding:'28px 24px',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,color:'#1e1b4b',marginBottom:4}}>📋 Post a Request for Quote</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:20}}>Suppliers will see your request and send competitive quotes</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Your Name *</label>
                <input value={form.buyer_name} onChange={e=>setForm(f=>({...f,buyer_name:e.target.value}))} style={fi} placeholder="Full name"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Phone *</label>
                <input value={form.buyer_phone} onChange={e=>setForm(f=>({...f,buyer_phone:e.target.value}))} style={fi} placeholder="07XXXXXXXX"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Company</label>
                <input value={form.buyer_company} onChange={e=>setForm(f=>({...f,buyer_company:e.target.value}))} style={fi} placeholder="Company name"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Category *</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={fi}>
                  <option value="">Select category</option>
                  {WH_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Product / Item *</label>
                <input value={form.product_name} onChange={e=>setForm(f=>({...f,product_name:e.target.value}))} style={fi} placeholder="e.g. Maize flour, Cement bags"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Quantity *</label>
                <input type="number" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} style={fi} placeholder="500"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Unit</label>
                <select value={form.quantity_unit} onChange={e=>setForm(f=>({...f,quantity_unit:e.target.value}))} style={fi}>
                  {['units','kg','tonnes','bags','litres','boxes','pallets','metres','pieces'].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Delivery District *</label>
                <select value={form.delivery_district} onChange={e=>setForm(f=>({...f,delivery_district:e.target.value}))} style={fi}>
                  <option value="">Select district</option>
                  {WH_DISTRICTS.filter(Boolean).map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Needed By</label>
                <input type="date" value={form.delivery_date} onChange={e=>setForm(f=>({...f,delivery_date:e.target.value}))} style={fi}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Budget (UGX)</label>
                <input type="number" value={form.budget_ugx} onChange={e=>setForm(f=>({...f,budget_ugx:e.target.value}))} style={fi} placeholder="e.g. 5000000"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Description / Specifications</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...fi,height:80,resize:'vertical'}} placeholder="Quality grade, packaging preference, delivery conditions…"/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,background:LIGHT,color:TEXT,border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
              <button onClick={submitRFQ} disabled={submitting} style={{flex:2,background:'linear-gradient(135deg,#1e1b4b,#312e81)',color:WHITE,border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:700,cursor:'pointer',opacity:submitting?.6:1}}>
                {submitting?'Posting…':'Post RFQ →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Modal */}
      {quoteModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setQuoteModal(null)}>
          <div style={{background:WHITE,borderRadius:14,padding:'28px 24px',width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,color:'#1e1b4b',marginBottom:4}}>Submit Quote for: {quoteModal.product_name}</div>
            <div style={{fontSize:12,color:MUTED,marginBottom:20}}>Qty needed: {quoteModal.quantity} {quoteModal.quantity_unit} · District: {quoteModal.delivery_district}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Your Business Name *</label>
                <input value={qForm.business_name} onChange={e=>setQForm(f=>({...f,business_name:e.target.value}))} style={fi} placeholder="Business or supplier name"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Price per Unit (UGX) *</label>
                  <input type="number" value={qForm.price_per_unit} onChange={e=>setQForm(f=>({...f,price_per_unit:e.target.value}))} style={fi} placeholder="150000"/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Quantity Available *</label>
                  <input type="number" value={qForm.quantity_available} onChange={e=>setQForm(f=>({...f,quantity_available:e.target.value}))} style={fi}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Unit *</label>
                  <select value={qForm.unit} onChange={e=>setQForm(f=>({...f,unit:e.target.value}))} style={fi}>
                    <option value="">Select unit</option>
                    {['units','kg','tonnes','bags','litres','boxes','pallets','metres','pieces'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Lead Time (days)</label>
                  <input type="number" value={qForm.lead_time_days} onChange={e=>setQForm(f=>({...f,lead_time_days:e.target.value}))} style={fi} placeholder="7"/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Payment Terms</label>
                <input value={qForm.payment_terms} onChange={e=>setQForm(f=>({...f,payment_terms:e.target.value}))} style={fi} placeholder="e.g. 50% upfront, 50% on delivery"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Notes</label>
                <textarea value={qForm.notes} onChange={e=>setQForm(f=>({...f,notes:e.target.value}))} style={{...fi,height:70,resize:'vertical'}} placeholder="Additional details, certifications, delivery arrangements…"/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>setQuoteModal(null)} style={{flex:1,background:LIGHT,color:TEXT,border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
              <button onClick={submitQuote} disabled={submitting} style={{flex:2,background:'linear-gradient(135deg,#d97706,#b45309)',color:WHITE,border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:700,cursor:'pointer',opacity:submitting?.6:1}}>
                {submitting?'Submitting…':'Submit Quote →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcurementFeed(){
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [contactModal,setContactModal]=useState(null);
  const [form,setForm]=usePersistedForm('procurement-post',{poster_name:'',poster_phone:'',poster_company:'',title:'',category:'',description:'',quantity:'',quantity_unit:'units',delivery_district:'',budget_ugx:'',deadline_date:''});
  const [submitting,setSubmitting]=useState(false);

  useEffect(()=>{loadPosts();},[]);
  const loadPosts=async()=>{
    setLoading(true);
    try{
      const r=await fetch('/api/wholesale/procurement?limit=40');const d=await r.json();
      setPosts(d.posts||[]);
    }catch(e){setPosts([]);}finally{setLoading(false);}
  };

  const submitPost=async()=>{
    if(!form.poster_name||!form.poster_phone||!form.title||!form.category||!form.quantity||!form.delivery_district) return alert('Fill all required fields');
    setSubmitting(true);
    try{
      const tok=localStorage.getItem('256mall_token');
      const r=await fetch('/api/wholesale/procurement',{method:'POST',headers:{'Content-Type':'application/json',...(tok&&{Authorization:`Bearer ${tok}`})},body:JSON.stringify(form)});
      const d=await r.json();
      if(d.success){setShowForm(false);setForm({poster_name:'',poster_phone:'',poster_company:'',title:'',category:'',description:'',quantity:'',quantity_unit:'units',delivery_district:'',budget_ugx:'',deadline_date:''});loadPosts();alert('Procurement post published!');}
      else alert(d.error||'Failed');
    }catch(e){alert('Network error');}finally{setSubmitting(false);}
  };

  const fi={width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'9px 12px',fontSize:13,fontFamily:DM,outline:'none',boxSizing:'border-box'};
  return(
    <div>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:'#1e1b4b'}}>🛒 Procurement Marketplace</div>
          <div style={{fontSize:13,color:MUTED}}>Businesses post what they need · Suppliers respond with availability</div>
        </div>
        <button onClick={()=>setShowForm(true)} style={{background:'linear-gradient(135deg,#059669,#047857)',color:WHITE,border:'none',borderRadius:8,padding:'10px 22px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Post What You Need</button>
      </div>

      {/* Posts */}
      {loading?<div style={{textAlign:'center',padding:'40px 0',color:MUTED}}>Loading…</div>
      :posts.length===0?<div style={{textAlign:'center',padding:'60px 0',color:MUTED}}>
        <div style={{fontSize:40,marginBottom:12}}>🛒</div>
        <div style={{fontWeight:700,marginBottom:8}}>No procurement posts yet</div>
        <button onClick={()=>setShowForm(true)} style={{marginTop:16,background:'#059669',color:WHITE,border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Post Your Need</button>
      </div>
      :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
        {posts.map(p=>(
          <div key={p.id} style={{background:WHITE,border:'1px solid #e5e7eb',borderRadius:10,padding:'16px',boxShadow:'0 1px 4px rgba(0,0,0,.06)',display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
              <div style={{fontSize:15,fontWeight:800,color:'#1e1b4b',flex:1,lineHeight:1.3}}>{p.title}</div>
              <span style={{background:'#eff6ff',color:'#1d4ed8',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,flexShrink:0}}>{p.category}</span>
            </div>
            {p.description&&<p style={{fontSize:12,color:MUTED,margin:0,lineHeight:1.5}}>{p.description.slice(0,100)}{p.description.length>100?'…':''}</p>}
            <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:MUTED}}>
              <span>📦 {p.quantity} {p.quantity_unit}</span>
              <span>📍 {p.delivery_district}</span>
              {p.budget_ugx&&<span style={{color:'#059669',fontWeight:700}}>UGX {Number(p.budget_ugx).toLocaleString()}</span>}
              {p.deadline_date&&<span>📅 By {new Date(p.deadline_date).toLocaleDateString()}</span>}
            </div>
            <div style={{fontSize:11,color:MUTED}}>By {p.poster_name}{p.poster_company?` · ${p.poster_company}`:''}</div>
            <button onClick={()=>setContactModal(p)}
              style={{background:'linear-gradient(135deg,#059669,#047857)',color:WHITE,border:'none',borderRadius:7,padding:'9px 0',fontSize:12,fontWeight:700,cursor:'pointer',marginTop:'auto'}}>
              📞 I Can Supply This →
            </button>
          </div>
        ))}
      </div>}

      {/* Post Form Modal */}
      {showForm&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setShowForm(false)}>
          <div style={{background:WHITE,borderRadius:14,padding:'28px 24px',width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,color:'#1e1b4b',marginBottom:4}}>🛒 Post Your Procurement Need</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:20}}>Suppliers across Uganda will see this and reach out</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Your Name *</label>
                <input value={form.poster_name} onChange={e=>setForm(f=>({...f,poster_name:e.target.value}))} style={fi} placeholder="Full name"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Phone *</label>
                <input value={form.poster_phone} onChange={e=>setForm(f=>({...f,poster_phone:e.target.value}))} style={fi} placeholder="07XXXXXXXX"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Company</label>
                <input value={form.poster_company} onChange={e=>setForm(f=>({...f,poster_company:e.target.value}))} style={fi} placeholder="Company or organisation"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>What Do You Need? *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={fi} placeholder="e.g. 500 bags of cement — monthly supply"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Category *</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={fi}>
                  <option value="">Select</option>
                  {WH_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Quantity *</label>
                <input type="number" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} style={fi}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Unit</label>
                <select value={form.quantity_unit} onChange={e=>setForm(f=>({...f,quantity_unit:e.target.value}))} style={fi}>
                  {['units','kg','tonnes','bags','litres','boxes','pallets','metres','pieces'].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Delivery District *</label>
                <select value={form.delivery_district} onChange={e=>setForm(f=>({...f,delivery_district:e.target.value}))} style={fi}>
                  <option value="">Select</option>
                  {WH_DISTRICTS.filter(Boolean).map(d=><option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Budget (UGX)</label>
                <input type="number" value={form.budget_ugx} onChange={e=>setForm(f=>({...f,budget_ugx:e.target.value}))} style={fi} placeholder="Optional"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Deadline Date</label>
                <input type="date" value={form.deadline_date} onChange={e=>setForm(f=>({...f,deadline_date:e.target.value}))} style={fi}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={{fontSize:12,fontWeight:700,color:'#374151',display:'block',marginBottom:4}}>Specifications / Description</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...fi,height:80,resize:'vertical'}} placeholder="Quality grade, delivery conditions, packaging requirements…"/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button onClick={()=>setShowForm(false)} style={{flex:1,background:LIGHT,color:TEXT,border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:700,cursor:'pointer'}}>Cancel</button>
              <button onClick={submitPost} disabled={submitting} style={{flex:2,background:'linear-gradient(135deg,#059669,#047857)',color:WHITE,border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:700,cursor:'pointer',opacity:submitting?.6:1}}>
                {submitting?'Publishing…':'Publish Need →'}
              </button>
            </div>
          </div>
        </div>
      )}
      {contactModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setContactModal(null)}>
          <div style={{background:WHITE,borderRadius:14,padding:'28px 24px',width:'100%',maxWidth:420,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:20,marginBottom:8}}>📞</div>
            <div style={{fontSize:17,fontWeight:800,color:'#1e1b4b',marginBottom:6}}>Contact {contactModal.poster_name}</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:20}}>Re: {contactModal.title}</div>
            <a href={`tel:${contactModal.poster_phone}`} style={{display:'block',background:'linear-gradient(135deg,#059669,#047857)',color:WHITE,textDecoration:'none',borderRadius:8,padding:'12px 0',fontSize:15,fontWeight:700,marginBottom:10}}>
              📞 Call: {contactModal.poster_phone}
            </a>
            <a href={`https://wa.me/256${contactModal.poster_phone?.replace(/^0/,'')}`} target="_blank" rel="noreferrer"
              style={{display:'block',background:'#25d366',color:WHITE,textDecoration:'none',borderRadius:8,padding:'12px 0',fontSize:15,fontWeight:700,marginBottom:16}}>
              💬 WhatsApp
            </a>
            <button onClick={()=>setContactModal(null)} style={{background:LIGHT,color:TEXT,border:'none',borderRadius:8,padding:'10px 28px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WholesaleHub(){
  const nav=useNavigate();
  const [tab,setTab]=useState('browse');
  const [businesses,setBusinesses]=useState([]);
  const [loading,setLoading]=useState(true);
  const [distFilter,setDistFilter]=useState('');
  const [catFilter,setCatFilter]=useState('');
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState('rating');
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [messenger,setMessenger]=useState(null);
  const [rfqPreFill,setRfqPreFill]=useState(null);
  const [stats,setStats]=useState({suppliers:0,rfqs:0,procurement:0});

  useEffect(()=>{loadStats();},[]);
  useEffect(()=>{if(tab==='browse')loadBiz();},[tab,distFilter,catFilter,sort,page]);

  const loadStats=async()=>{
    try{
      const [bizRes,rfqRes,procRes]=await Promise.all([
        fetch('/api/wholesale?limit=1'),
        fetch('/api/wholesale/rfq?status=open&limit=1'),
        fetch('/api/wholesale/procurement?limit=1'),
      ]);
      const [bizD,rfqD,procD]=await Promise.all([bizRes.json(),rfqRes.json(),procRes.json()]);
      setStats({suppliers:bizD.total||0,rfqs:rfqD.rfqs?.length||0,procurement:procD.posts?.length||0});
    }catch(e){}
  };

  const loadBiz=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({sort,page,limit:12,...(distFilter&&{district:distFilter}),...(catFilter&&{category:catFilter}),...(search&&{search})});
      const r=await fetch(`/api/wholesale?${p}`);const d=await r.json();
      setBusinesses(d.businesses||[]);setTotal(d.total||0);
    }catch(e){setBusinesses([]);}finally{setLoading(false);}
  };

  const TABS=[{id:'browse',label:'Browse Suppliers',icon:'🏭'},{id:'rfq',label:'RFQ Board',icon:'📋'},{id:'procurement',label:'Procurement',icon:'🛒'},{id:'register',label:'List My Business',icon:'➕'}];

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh',fontFamily:DM}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',padding:'36px 24px 32px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,opacity:.07,backgroundImage:'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',backgroundSize:'12px 12px'}}/>
        <div style={{maxWidth:1200,margin:'0 auto',position:'relative'}}>
          <div style={{display:'inline-block',background:'rgba(255,215,0,.15)',border:'1px solid rgba(255,215,0,.35)',borderRadius:20,padding:'4px 14px',fontSize:11,color:'#ffd700',fontWeight:800,letterSpacing:'.1em',marginBottom:12}}>🏭 UGANDA B2B TRADE INFRASTRUCTURE</div>
          <h1 style={{fontSize:32,fontWeight:900,color:WHITE,margin:'0 0 10px',lineHeight:1.15}}>Uganda's Digital<br/>Wholesale Network</h1>
          <p style={{fontSize:14,color:'#a5b4fc',margin:'0 0 24px',lineHeight:1.6,maxWidth:520}}>Post an RFQ · Find verified suppliers · Trade with confidence. Built for Ugandan businesses — agriculture, construction, manufacturing and more.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:28}}>
            <button onClick={()=>setTab('rfq')} style={{background:'linear-gradient(135deg,#d97706,#b45309)',color:WHITE,border:'none',borderRadius:8,padding:'12px 24px',fontSize:14,fontWeight:800,cursor:'pointer'}}>📋 Post an RFQ →</button>
            <button onClick={()=>setTab('browse')} style={{background:'rgba(255,255,255,.12)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 24px',fontSize:14,fontWeight:800,cursor:'pointer'}}>Browse Suppliers →</button>
          </div>
          {/* Stats */}
          <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
            {[['🏭',stats.suppliers||'—','Registered Suppliers'],['📋',stats.rfqs||'—','Active RFQs'],['🛒',stats.procurement||'—','Procurement Posts'],['✅','100%','Ugandan Businesses']].map(([ic,v,l])=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>{ic}</span>
                <div><div style={{fontSize:18,fontWeight:800,color:WHITE,lineHeight:1}}>{v}</div><div style={{fontSize:10,color:'#94a3b8',fontWeight:600}}>{l}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{background:'#1e1b4b',padding:'8px 24px',overflowX:'auto'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',gap:24,whiteSpace:'nowrap',justifyContent:'center',flexWrap:'wrap'}}>
          {[['🏅','Trade Assured Suppliers'],['📋','RFQ in Minutes'],['💬','On-platform Negotiation'],['🌍','Export-ready Sourcing'],['🔒','Buyer Protection']].map(([ic,t])=>(
            <span key={t} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'#a5b4fc',padding:'4px 0'}}>{ic} {t}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:WHITE,borderBottom:'2px solid #e5e7eb',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'14px 20px',border:'none',borderBottom:tab===t.id?'3px solid #312e81':'3px solid transparent',background:'none',fontSize:13,fontWeight:tab===t.id?800:500,color:tab===t.id?'#312e81':MUTED,cursor:'pointer',whiteSpace:'nowrap',transition:'all .2s'}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px'}}>
        {/* Browse Suppliers Tab */}
        {tab==='browse'&&(
          <div>
            {/* Search + filters */}
            <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} onKeyDown={e=>e.key==='Enter'&&loadBiz()} placeholder="🔍 Search suppliers, products, keywords…"
                style={{flex:2,minWidth:180,border:'1px solid #d1d5db',borderRadius:7,padding:'9px 14px',fontSize:13,fontFamily:DM,outline:'none'}}/>
              <select value={catFilter} onChange={e=>{setCatFilter(e.target.value);setPage(1);}}
                style={{flex:1,minWidth:140,border:'1px solid #d1d5db',borderRadius:7,padding:'9px 12px',fontSize:13,fontFamily:DM,outline:'none'}}>
                <option value="">All Categories</option>
                {WH_CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <select value={distFilter} onChange={e=>{setDistFilter(e.target.value);setPage(1);}}
                style={{flex:1,minWidth:120,border:'1px solid #d1d5db',borderRadius:7,padding:'9px 12px',fontSize:13,fontFamily:DM,outline:'none'}}>
                {WH_DISTRICTS.map(d=><option key={d} value={d}>{d||'All Districts'}</option>)}
              </select>
              <select value={sort} onChange={e=>setSort(e.target.value)}
                style={{minWidth:110,border:'1px solid #d1d5db',borderRadius:7,padding:'9px 12px',fontSize:13,fontFamily:DM,outline:'none'}}>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="name">Name A-Z</option>
                <option value="min_order">Min Order ↑</option>
                <option value="trust">Trust Score ↓</option>
              </select>
              <button onClick={loadBiz} style={{background:'#312e81',color:WHITE,border:'none',borderRadius:7,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>Search</button>
            </div>

            {/* Category quick-select */}
            <div style={{display:'flex',gap:8,marginBottom:20,overflowX:'auto',paddingBottom:4}}>
              <button onClick={()=>{setCatFilter('');setPage(1);}} style={{padding:'6px 14px',borderRadius:20,border:'1px solid #d1d5db',background:catFilter===''?'#312e81':WHITE,color:catFilter===''?WHITE:'#374151',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>All</button>
              {WH_CATS.map(c=>(
                <button key={c.id} onClick={()=>{setCatFilter(c.id);setPage(1);}} style={{padding:'6px 14px',borderRadius:20,border:'1px solid #d1d5db',background:catFilter===c.id?'#312e81':WHITE,color:catFilter===c.id?WHITE:'#374151',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>

            {loading?(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
                {Array(6).fill(0).map((_,i)=><div key={i} style={{height:300,background:'#e5e7eb',borderRadius:12,animation:'pulse 1.5s infinite'}}/>)}
              </div>
            ):businesses.length===0?(
              <div style={{textAlign:'center',padding:'60px 0',color:MUTED}}>
                <div style={{fontSize:48,marginBottom:16}}>🏭</div>
                <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>No suppliers found</div>
                <div style={{fontSize:14,marginBottom:20}}>Try a different category or district</div>
                <button onClick={()=>setTab('register')} style={{background:'#312e81',color:WHITE,border:'none',borderRadius:8,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>List Your Business →</button>
              </div>
            ):(
              <div>
                <div style={{fontSize:13,color:MUTED,marginBottom:14}}>{total} supplier{total!==1?'s':''} found</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16,marginBottom:24}}>
                  {businesses.map(b=><SupplierCard key={b.id} biz={b} onMessage={biz=>setMessenger({business:biz,product:null})} onRFQ={biz=>{setRfqPreFill(biz);setTab('rfq');}}/>)}
                </div>
                {/* Pagination */}
                {total>12&&(
                  <div style={{display:'flex',justifyContent:'center',gap:8}}>
                    <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:6,background:page===1?LIGHT:WHITE,cursor:page===1?'default':'pointer',fontSize:13}}>← Prev</button>
                    <span style={{padding:'8px 16px',fontSize:13,color:MUTED}}>Page {page} of {Math.ceil(total/12)}</span>
                    <button onClick={()=>setPage(p=>p+1)} disabled={page>=Math.ceil(total/12)} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:6,background:page>=Math.ceil(total/12)?LIGHT:WHITE,cursor:page>=Math.ceil(total/12)?'default':'pointer',fontSize:13}}>Next →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RFQ Tab */}
        {tab==='rfq'&&<RFQBoard/>}

        {/* Procurement Tab */}
        {tab==='procurement'&&<ProcurementFeed/>}

        {/* Register Tab */}
        {tab==='register'&&(
          <div style={{maxWidth:640,margin:'0 auto',textAlign:'center',padding:'48px 24px'}}>
            <div style={{fontSize:48,marginBottom:16}}>🏭</div>
            <div style={{fontSize:26,fontWeight:800,color:'#1e1b4b',marginBottom:12}}>List Your Wholesale Business</div>
            <p style={{fontSize:15,color:MUTED,lineHeight:1.7,marginBottom:24}}>Join Uganda's B2B trade network. Post your product catalogue, receive RFQ bids, negotiate on-platform and grow your wholesale business.</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,textAlign:'left',marginBottom:32}}>
              {[['📦','Unlimited products','List your full catalogue with pricing tiers'],['📋','RFQ notifications','Get notified when buyers post matching RFQs'],['💬','On-platform deals','Negotiate prices and share documents securely'],['✅','Get verified','Build trust with Uganda B2B buyers'],['🌍','Export reach','Connect with regional and international buyers'],['📊','Analytics','Track profile views and enquiry conversion']].map(([ic,t,d])=>(
                <div key={t} style={{display:'flex',gap:12,padding:'14px',background:'#f8fafc',borderRadius:10,border:'1px solid #e5e7eb'}}>
                  <span style={{fontSize:24,flexShrink:0}}>{ic}</span>
                  <div><div style={{fontSize:13,fontWeight:700,color:'#1e1b4b',marginBottom:3}}>{t}</div><div style={{fontSize:12,color:MUTED}}>{d}</div></div>
                </div>
              ))}
            </div>
            <button onClick={()=>nav('/sell')} style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',color:WHITE,border:'none',borderRadius:10,padding:'14px 40px',fontSize:15,fontWeight:800,cursor:'pointer',display:'inline-block'}}>Register as Wholesaler →</button>
            <div style={{fontSize:12,color:MUTED,marginTop:12}}>Free listing · No commission · Uganda-first</div>
          </div>
        )}
      </div>

      {/* CTA Banner */}
      {tab==='browse'&&(
        <div style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',margin:'0 auto 0',padding:'28px 24px'}}>
          <div style={{maxWidth:1200,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16}}>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:WHITE,marginBottom:6}}>Can't find a supplier? Post an RFQ.</div>
              <div style={{fontSize:13,color:'#a5b4fc'}}>Suppliers across Uganda will respond with competitive quotes within 24 hours.</div>
            </div>
            <button onClick={()=>setTab('rfq')} style={{background:YELLOW,color:'#1e1b4b',border:'none',borderRadius:8,padding:'12px 28px',fontSize:14,fontWeight:800,cursor:'pointer',flexShrink:0}}>Post RFQ →</button>
          </div>
        </div>
      )}

      {messenger&&<TradeMessenger business={messenger.business} product={messenger.product} onClose={()=>setMessenger(null)}/>}
    </div>
  );
}

// ── Wholesale Storefront (/wholesale/supplier/:id) ────────────────────────────
function WholesaleStorefront(){
  const {id}=useParams();
  const nav=useNavigate();
  const [biz,setBiz]=useState(null);
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('overview');
  const [messenger,setMessenger]=useState(null);
  const [rfqModal,setRfqModal]=useState(null);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const r=await fetch(`/api/wholesale/${id}`);const d=await r.json();
        if(d.success){setBiz(d.business);setProducts(d.products||[]);}
        else nav('/wholesale');
      }catch(e){nav('/wholesale');}finally{setLoading(false);}
    })();
  },[id]);

  if(loading) return <div style={{minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:MUTED}}>Loading supplier…</div>;
  if(!biz) return null;

  const cats=Array.isArray(biz.categories)?biz.categories:(typeof biz.categories==='string'?JSON.parse(biz.categories||'[]'):[]);
  const certs=Array.isArray(biz.certifications)?biz.certifications:(typeof biz.certifications==='string'?JSON.parse(biz.certifications||'[]'):[]);
  const wdists=Array.isArray(biz.warehouse_districts)?biz.warehouse_districts:(typeof biz.warehouse_districts==='string'?JSON.parse(biz.warehouse_districts||'[]'):[]);
  const factoryPhotos=Array.isArray(biz.factory_photos)?biz.factory_photos:(typeof biz.factory_photos==='string'?JSON.parse(biz.factory_photos||'[]'):[]);

  const TABS=[{id:'overview',label:'Overview'},{id:'products',label:`Products (${products.length})`},{id:'trade',label:'Trade Info'}];

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh',fontFamily:DM}}>
      {/* Back */}
      <div style={{background:WHITE,borderBottom:'1px solid #e5e7eb',padding:'10px 24px'}}>
        <button onClick={()=>nav('/wholesale')} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#312e81',fontWeight:600,fontFamily:DM}}>← Back to Wholesale Hub</button>
      </div>

      {/* Banner */}
      <div style={{background:'linear-gradient(135deg,#0f0c29 0%,#302b63 100%)',padding:'28px 24px'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
          {biz.logo_url&&<img src={biz.logo_url} alt={biz.business_name} style={{width:80,height:80,borderRadius:10,objectFit:'cover',border:'3px solid rgba(255,255,255,.2)',flexShrink:0}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:6}}>
              <h1 style={{fontSize:24,fontWeight:900,color:WHITE,margin:0}}>{biz.business_name}</h1>
              <TrustBadge biz={biz}/>
              {biz.is_verified&&<span style={{background:'#059669',color:WHITE,fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:12}}>✅ Verified</span>}
            </div>
            <div style={{fontSize:12,color:'#a5b4fc',marginBottom:8}}>📍 {biz.street_address||biz.area||''}{(biz.area||biz.street_address)?', ':''}{biz.district} · {biz.business_type}</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {cats.slice(0,5).map(c=><span key={c} style={{background:'rgba(255,255,255,.12)',color:'#c7d2fe',fontSize:11,padding:'3px 10px',borderRadius:12}}>{c}</span>)}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
            <button onClick={()=>setMessenger({business:biz,product:null})} style={{background:YELLOW,color:'#1e1b4b',border:'none',borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:800,cursor:'pointer'}}>💬 Message Supplier</button>
            {biz.phone&&<a href={`tel:${biz.phone}`} style={{background:'rgba(255,255,255,.12)',color:WHITE,border:'1px solid rgba(255,255,255,.2)',borderRadius:8,padding:'9px 18px',fontSize:12,fontWeight:600,textAlign:'center',textDecoration:'none'}}>📞 {biz.phone}</a>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:WHITE,borderBottom:'2px solid #e5e7eb'}}>
        <div style={{maxWidth:1100,margin:'0 auto',display:'flex'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'13px 20px',border:'none',borderBottom:tab===t.id?'3px solid #312e81':'3px solid transparent',background:'none',fontSize:13,fontWeight:tab===t.id?800:500,color:tab===t.id?'#312e81':MUTED,cursor:'pointer',whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>
        {/* Overview tab */}
        {tab==='overview'&&(
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {biz.description&&(
                <div style={{background:WHITE,borderRadius:10,padding:'20px',border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#1e1b4b',marginBottom:10}}>About {biz.business_name}</div>
                  <p style={{fontSize:13,color:MUTED,lineHeight:1.7,margin:0}}>{biz.description}</p>
                </div>
              )}
              {factoryPhotos.length>0&&(
                <div style={{background:WHITE,borderRadius:10,padding:'20px',border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#1e1b4b',marginBottom:12}}>Factory / Facility Photos</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
                    {factoryPhotos.map((ph,i)=><img key={i} src={ph} alt={`Facility ${i+1}`} style={{width:'100%',height:120,objectFit:'cover',borderRadius:7,border:'1px solid #e5e7eb'}}/>)}
                  </div>
                </div>
              )}
              {biz.video_url&&(
                <div style={{background:WHITE,borderRadius:10,padding:'20px',border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#1e1b4b',marginBottom:12}}>Business Video</div>
                  <video src={biz.video_url} controls style={{width:'100%',borderRadius:8,maxHeight:320}}/>
                </div>
              )}
            </div>
            {/* Sidebar */}
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{background:WHITE,borderRadius:10,padding:'18px',border:'1px solid #e5e7eb'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#1e1b4b',marginBottom:12}}>Quick Facts</div>
                {[
                  biz.established_year&&['Est.',biz.established_year],
                  biz.min_order_ugx>0&&['Min Order',`UGX ${Number(biz.min_order_ugx).toLocaleString()}`],
                  biz.capacity_notes&&['Capacity',biz.capacity_notes],
                  biz.payment_terms&&['Payment',biz.payment_terms],
                  biz.delivery_available!==undefined&&['Delivery',biz.delivery_available?'✅ Available':'❌ Not offered'],
                  biz.export_capability!==undefined&&['Export',biz.export_capability?'✅ Capable':'—'],
                  biz.rating&&['Rating',`${'★'.repeat(Math.round(biz.rating))} ${biz.rating} (${biz.total_reviews||0})`],
                ].filter(Boolean).map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'7px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}>
                    <span style={{color:MUTED,fontWeight:600}}>{k}</span>
                    <span style={{color:'#1e1b4b',fontWeight:700,textAlign:'right',maxWidth:'55%'}}>{v}</span>
                  </div>
                ))}
              </div>
              {certs.length>0&&(
                <div style={{background:WHITE,borderRadius:10,padding:'18px',border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1e1b4b',marginBottom:10}}>Certifications</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {certs.map(c=><div key={c} style={{background:'#ecfdf5',color:'#065f46',fontSize:12,padding:'6px 12px',borderRadius:7,border:'1px solid #a7f3d0',fontWeight:600}}>✓ {c}</div>)}
                  </div>
                </div>
              )}
              {wdists.length>0&&(
                <div style={{background:WHITE,borderRadius:10,padding:'18px',border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1e1b4b',marginBottom:10}}>Warehouse Districts</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {wdists.map(d=><span key={d} style={{background:'#eff6ff',color:'#1d4ed8',fontSize:11,padding:'4px 10px',borderRadius:10}}>🏭 {d}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products tab */}
        {tab==='products'&&(
          <div>
            {products.length===0?(
              <div style={{textAlign:'center',padding:'60px 0',color:MUTED}}>
                <div style={{fontSize:48,marginBottom:16}}>📦</div>
                <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>No products listed yet</div>
                <div style={{fontSize:14,marginBottom:20}}>Contact the supplier directly for their catalogue</div>
                <button onClick={()=>setMessenger({business:biz,product:null})} style={{background:'#312e81',color:WHITE,border:'none',borderRadius:8,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>💬 Contact Supplier</button>
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:16}}>
                {products.map(p=>{
                  const photo=Array.isArray(p.photos)?p.photos[0]:(typeof p.photos==='string'?JSON.parse(p.photos||'[]')[0]:null);
                  const pcerts=Array.isArray(p.certifications)?p.certifications:(typeof p.certifications==='string'?JSON.parse(p.certifications||'[]'):[]);
                  return(
                    <div key={p.id} style={{background:WHITE,border:'1px solid #e5e7eb',borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 1px 6px rgba(0,0,0,.06)'}}>
                      <div style={{height:180,background:'#f1f5f9',position:'relative',overflow:'hidden'}}>
                        {photo?<img src={photo} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48}}>📦</div>}
                        {p.quality_grade&&<div style={{position:'absolute',top:8,left:8,background:'#312e81',color:WHITE,fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:10}}>{p.quality_grade}</div>}
                        {p.export_ready&&<div style={{position:'absolute',top:8,right:8,background:'#059669',color:WHITE,fontSize:9,fontWeight:800,padding:'3px 9px',borderRadius:10}}>🌍 Export</div>}
                      </div>
                      <div style={{padding:'14px',flex:1,display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{fontSize:15,fontWeight:800,color:'#1e1b4b',lineHeight:1.3}}>{p.name}</div>
                        <div style={{background:'linear-gradient(135deg,#92620a,#d4a520,#f0c840,#d4a520,#92620a)',borderRadius:8,padding:'9px 14px',display:'flex',alignItems:'baseline',gap:6,boxShadow:'0 2px 8px rgba(180,120,0,.35)'}}>
                          <span style={{fontSize:20,fontWeight:900,color:'#1a0800'}}>UGX {Number(p.price_per_unit).toLocaleString()}</span>
                          <span style={{fontSize:12,fontWeight:500,color:'rgba(26,8,0,.6)'}}>/{p.unit}</span>
                        </div>
                        {p.min_order_qty&&<div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                          <span style={{background:'#ede9fe',color:'#5b21b6',fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:5,letterSpacing:.5,textTransform:'uppercase'}}>MOQ</span>
                          <span style={{fontSize:13,color:'#5b21b6',fontWeight:700}}>{p.min_order_qty} {p.min_order_unit||p.unit}</span>
                        </div>}
                        {p.production_capacity&&<div style={{fontSize:11,color:MUTED}}>⚡ Capacity: {p.production_capacity}</div>}
                        {p.lead_time_days&&<div style={{fontSize:11,color:MUTED}}>📅 Lead time: {p.lead_time_days} days</div>}
                        {p.origin_district&&<div style={{fontSize:11,color:MUTED}}>📍 Origin: {p.origin_district}</div>}
                        {p.packaging&&<div style={{fontSize:11,color:MUTED}}>📦 Pkg: {p.packaging}</div>}
                        {pcerts.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4}}>{pcerts.map(c=><span key={c} style={{background:'#ecfdf5',color:'#065f46',fontSize:9,padding:'2px 7px',borderRadius:8,border:'1px solid #a7f3d0'}}>✓ {c}</span>)}</div>}
                        <ProductTierTable product={p}/>
                        {p.quality_desc&&<p style={{fontSize:11,color:MUTED,margin:0,lineHeight:1.5}}>{p.quality_desc.slice(0,100)}{p.quality_desc.length>100?'…':''}</p>}
                        <div style={{display:'flex',gap:8,marginTop:'auto',paddingTop:4}}>
                          <button onClick={()=>setMessenger({business:biz,product:p})} style={{flex:1,background:'#312e81',color:WHITE,border:'none',borderRadius:7,padding:'9px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>💬 Enquire</button>
                          <button onClick={()=>setRfqModal(p)} style={{flex:1,background:'#fffbeb',color:'#b45309',border:'1px solid #fcd34d',borderRadius:7,padding:'9px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>📋 Request Quote</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Trade Info tab */}
        {tab==='trade'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[
              {title:'Payment & Financial',items:[['Payment Terms',biz.payment_terms||'Contact for terms'],['Min Order Value',biz.min_order_ugx>0?`UGX ${Number(biz.min_order_ugx).toLocaleString()}`:'Negotiable']]},
              {title:'Logistics',items:[['Delivery',biz.delivery_available?'✅ Available':'Contact supplier'],['Districts Served',wdists.length>0?wdists.join(', '):'All Uganda']]},
              {title:'Production',items:[['Capacity',biz.capacity_notes||'Contact for details'],['Lead Time','Contact supplier for current lead times']]},
              {title:'Compliance',items:[['TIN',biz.tin||'On file'],['Trading License',biz.trading_license||'On file'],['Export Capability',biz.export_capability?'✅ Yes — Export Ready':'Not currently']]},
            ].map(section=>(
              <div key={section.title} style={{background:WHITE,borderRadius:10,padding:'18px',border:'1px solid #e5e7eb'}}>
                <div style={{fontSize:13,fontWeight:800,color:'#1e1b4b',marginBottom:12}}>{section.title}</div>
                {section.items.map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #f1f5f9',fontSize:12,gap:8}}>
                    <span style={{color:MUTED,fontWeight:600,flexShrink:0}}>{k}</span>
                    <span style={{color:'#1e1b4b',fontWeight:700,textAlign:'right'}}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {messenger&&<TradeMessenger business={messenger.business} product={messenger.product} onClose={()=>setMessenger(null)}/>}
    </div>
  );
}

// (legacy name alias so existing route <WholesalePage/> works)
function WholesalePage(){
  const nav=useNavigate();
  const [businesses,setBusinesses]=useState([]);
  const [products,setProducts]=useState({}); // bizId → products[]
  const [loading,setLoading]=useState(true);
  const [dist,setDist]=useState('');
  const [search,setSearch]=useState('');
  const [expanded,setExpanded]=useState(null);
  const [messenger,setMessenger]=useState(null); // {business, product}
  const DISTRICTS=['','Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Mbale','Kabale','Masaka','Arua'];

  useEffect(()=>{load();},[dist]);
  const load=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({...(dist&&{district:dist}),limit:30});
      const r=await fetch(`/api/wholesale?${p}`);const d=await r.json();
      const bizList=d.businesses?.length>0?d.businesses:MOCK_WHOLESALE;
      setBusinesses(bizList);
      // Load products for all businesses in parallel
      const prods={};
      await Promise.all(bizList.map(async b=>{
        try{const pr=await fetch(`/api/trade/products/${b.id}`);const pd=await pr.json();prods[b.id]=pd.products||[];}catch(e){prods[b.id]=[];}
      }));
      setProducts(prods);
    }catch(e){setBusinesses(MOCK_WHOLESALE);}finally{setLoading(false);}
  };

  const shown=businesses.filter(b=>!search||(b.business_name+b.description+b.district).toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{background:'#f1f5f9',minHeight:'100vh',fontFamily:DM}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)',padding:'32px 24px 26px'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{background:'rgba(199,210,254,.2)',border:'1px solid rgba(199,210,254,.4)',borderRadius:20,padding:'3px 12px',fontSize:12,color:'#c7d2fe',fontWeight:700}}>🏭 WHOLESALE TRADE HUB</div>
          </div>
          <h1 style={{fontSize:30,fontWeight:900,color:WHITE,margin:'0 0 6px'}}>Uganda Wholesale Marketplace</h1>
          <p style={{fontSize:14,color:'#a5b4fc',margin:'0 0 20px'}}>Browse suppliers · View product catalogues · Negotiate prices · All messages on-platform</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <div style={{position:'relative',flex:1,minWidth:200}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search businesses or products..."
                style={{width:'100%',border:'1px solid rgba(255,255,255,.25)',borderRadius:20,padding:'9px 14px 9px 34px',fontSize:13,background:'rgba(255,255,255,.15)',color:WHITE,fontFamily:SF,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <select value={dist} onChange={e=>setDist(e.target.value)}
              style={{border:'1px solid rgba(255,255,255,.3)',borderRadius:20,padding:'9px 16px',fontSize:13,background:'rgba(255,255,255,.15)',color:WHITE,fontFamily:SF,outline:'none'}}>
              {DISTRICTS.map(d=><option key={d} value={d} style={{color:TEXT}}>{d||'All Districts'}</option>)}
            </select>
            <button onClick={()=>nav('/sell')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:20,padding:'9px 20px',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:SF,flexShrink:0}}>+ List My Business</button>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{background:'#1e1b4b',borderBottom:'1px solid #312e81',padding:'10px 24px'}}>
        <div style={{maxWidth:1280,margin:'0 auto',display:'flex',gap:24,flexWrap:'wrap',justifyContent:'center'}}>
          {[['💬','All messages on-platform'],['🔒','Buyer & seller protection'],['📹','Video calls included'],['📎','Share docs & images'],['💼','Send price offers']].map(([ic,t])=>(
            <div key={t} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#a5b4fc'}}>
              <span>{ic}</span><span>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div style={{maxWidth:1280,margin:'0 auto',padding:'20px 16px'}}>
        {loading?(
          <div style={{display:'grid',gap:16}}>
            {Array(4).fill(0).map((_,i)=><div key={i} style={{height:300,background:WHITE,borderRadius:10,border:`1px solid ${BORDER}`}}/>)}
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {shown.map(b=>{
              const bizProds=(products[b.id]||[]);
              const cats=Array.isArray(b.categories)?b.categories:(typeof b.categories==='string'?JSON.parse(b.categories||'[]'):[]);
              const isOpen=expanded===b.id;
              return(
                <div key={b.id} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
                  {/* Business header */}
                  <div style={{padding:'18px 20px',borderBottom:isOpen?`1px solid ${BORDER}`:'none'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                          <div style={{fontSize:18,fontWeight:800,color:TEXT}}>{b.business_name}</div>
                          {b.is_verified&&<span style={{background:'#dcfce7',color:'#15803d',fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:10}}>✓ VERIFIED</span>}
                          <span style={{background:'#f0f0ff',color:'#4f46e5',fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:10}}>{b.business_type||'Wholesale'}</span>
                        </div>
                        <div style={{fontSize:13,color:MUTED,marginBottom:8}}>📍 {b.street_address||b.area}, {b.district} &nbsp;·&nbsp; {cats.slice(0,3).join(' · ')}</div>
                        {b.description&&<p style={{fontSize:13,color:MUTED,lineHeight:1.6,margin:'0 0 10px'}}>{b.description.slice(0,120)}{b.description.length>120?'…':''}</p>}
                        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                          {b.min_order_ugx>0&&<span style={{fontSize:12,color:'#5b21b6',fontWeight:600}}>Min order: UGX {Number(b.min_order_ugx).toLocaleString()}</span>}
                          {b.delivery_available&&<span style={{background:'#f0fdf4',color:'#16a34a',fontSize:12,padding:'2px 8px',borderRadius:10}}>🚚 Delivery available</span>}
                          {b.payment_terms&&<span style={{fontSize:12,color:MUTED}}>💳 {b.payment_terms.slice(0,40)}</span>}
                        </div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
                        <button onClick={()=>setMessenger({business:b,product:null})}
                          style={{background:'#4f46e5',color:WHITE,border:'none',borderRadius:6,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:SF,whiteSpace:'nowrap'}}>
                          💬 Message Seller
                        </button>
                        {b.phone&&<a href={`tel:${b.phone}`} style={{background:'#f0f0ff',color:'#4f46e5',border:'1px solid #ddd8fe',borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:600,textAlign:'center',textDecoration:'none'}}>📞 {b.phone}</a>}
                        <button onClick={()=>setExpanded(isOpen?null:b.id)}
                          style={{background:isOpen?'#f0f0ff':LIGHT,color:isOpen?'#4f46e5':TEXT,border:`1px solid ${isOpen?'#ddd8fe':BORDER}`,borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:DM}}>
                          {isOpen?'▲ Hide Catalogue':'▼ View Catalogue'} {bizProds.length>0?`(${bizProds.length})`:''}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Product catalogue */}
                  {isOpen&&(
                    <div style={{padding:'16px 20px',background:'#fafbff'}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#4f46e5',marginBottom:12}}>📦 Product Catalogue — {b.business_name}</div>
                      {bizProds.length===0?(
                        <div style={{fontSize:13,color:MUTED,padding:'20px 0',textAlign:'center'}}>No products listed yet. Contact seller directly.</div>
                      ):(
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
                          {bizProds.map(p=>{
                            const photo=p.photos?.[0]||(typeof p.photos==='string'?JSON.parse(p.photos||'[]')[0]:null);
                            return(
                              <div key={p.id} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                                {/* Product image */}
                                <div style={{height:140,background:'#f8f8f8',overflow:'hidden',position:'relative'}}>
                                  {photo
                                    ?<img src={photo} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                    :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40}}>📦</div>}
                                  {p.quality_grade&&<div style={{position:'absolute',top:6,left:6,background:'#4f46e5',color:WHITE,fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:8}}>{p.quality_grade}</div>}
                                </div>
                                {/* Product info */}
                                <div style={{padding:'10px 12px',flex:1,display:'flex',flexDirection:'column',gap:4}}>
                                  <div style={{fontSize:13,fontWeight:700,color:TEXT,lineHeight:1.3}}>{p.name}</div>
                                  <div style={{background:'linear-gradient(135deg,#92620a,#d4a520,#f0c840,#d4a520,#92620a)',borderRadius:6,padding:'7px 10px',display:'flex',alignItems:'baseline',gap:4,boxShadow:'0 2px 6px rgba(180,120,0,.3)'}}>
                                    <span style={{fontSize:15,fontWeight:900,color:'#1a0800'}}>UGX {Number(p.price_per_unit).toLocaleString()}</span>
                                    <span style={{fontSize:11,fontWeight:500,color:'rgba(26,8,0,.6)'}}>/{p.unit}</span>
                                  </div>
                                  {p.min_order_qty&&<div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                                    <span style={{background:'#ede9fe',color:'#5b21b6',fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:4,letterSpacing:.4,textTransform:'uppercase'}}>MOQ</span>
                                    <span style={{fontSize:12,color:'#5b21b6',fontWeight:700}}>{p.min_order_qty} {p.min_order_unit||p.unit}</span>
                                  </div>}
                                  {p.quality_desc&&<div style={{fontSize:11,color:MUTED,lineHeight:1.5,marginTop:2}}>{p.quality_desc.slice(0,80)}{p.quality_desc.length>80?'…':''}</div>}
                                  {p.stock_qty!=null&&p.stock_qty>0&&<div style={{fontSize:11,color:GREEN}}>✓ In stock: {p.stock_qty.toLocaleString()} {p.unit}</div>}
                                  {p.stock_qty===0&&<div style={{fontSize:11,color:RED}}>Made to order</div>}
                                  <button onClick={()=>setMessenger({business:b,product:p})}
                                    style={{marginTop:'auto',paddingTop:8,background:'#4f46e5',color:WHITE,border:'none',borderRadius:6,padding:'8px 0',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
                                    💬 Enquire / Negotiate
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div style={{marginTop:32,background:'linear-gradient(135deg,#1e1b4b,#312e81)',borderRadius:12,padding:'28px 24px',textAlign:'center'}}>
          <div style={{fontSize:22,fontWeight:800,color:WHITE,marginBottom:8}}>🏭 List Your Wholesale Business</div>
          <p style={{color:'#a5b4fc',fontSize:14,margin:'0 0 18px'}}>Post your product catalogue · Receive enquiries · Negotiate on-platform. Free for Uganda businesses.</p>
          <button onClick={()=>nav('/sell')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:8,padding:'12px 32px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:DM}}>Register as Wholesaler →</button>
        </div>
      </div>

      {/* Messenger overlay */}
      {messenger&&<TradeMessenger business={messenger.business} product={messenger.product} onClose={()=>setMessenger(null)}/>}
    </div>
  );
}

// ── Export Hub Page ───────────────────────────────────────────────────────────
function ExportPage(){
  const [listings,setListings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState('');
  const [enquiry,setEnquiry]=useState(null);
  const [form,setForm,clearEnquiryForm]=usePersistedForm('export-enquiry',{buyer_name:'',buyer_company:'',buyer_country:'',buyer_email:'',buyer_phone:'',quantity_tonnes:'',message:''});
  const [sent,setSent]=useState(false);
  const CATS=[
    {label:'All Commodities',slug:''},
    {label:'☕ Coffee',slug:'coffee'},
    {label:'🍃 Tea',slug:'tea'},
    {label:'🌿 Vanilla',slug:'vanilla'},
    {label:'🍫 Cocoa',slug:'cocoa'},
    {label:'🌽 Maize',slug:'maize-grains'},
    {label:'🫘 Beans',slug:'beans'},
    {label:'🌱 Sesame',slug:'simsim'},
    {label:'🥜 Groundnuts',slug:'groundnuts'},
    {label:'🐟 Fish',slug:'fresh-fish'},
    {label:'🌶️ Spices',slug:'herbs-spices'},
  ];

  useEffect(()=>{load();},[cat]);
  const load=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({...(cat&&{category:cat}),limit:30});
      const r=await fetch(`/api/export?${p}`);const d=await r.json();
      setListings(d.listings||[]);
    }catch(e){setListings([]);}finally{setLoading(false);}
  };

  const shown=listings.length>0?listings:MOCK_EXPORT.filter(l=>!cat||l.category_slug===cat);

  const sendEnquiry=async()=>{
    try{
      await fetch('/api/export/enquiry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,listing_id:enquiry.id})});
      clearEnquiryForm();
      setSent(true);
    }catch(e){}
  };

  return(
    <div style={{background:'#0f172a',minHeight:'100vh',fontFamily:DM}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)',padding:'40px 24px 30px',borderBottom:'2px solid #1e3a5f'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <div style={{background:'rgba(96,165,250,.15)',border:'1px solid rgba(96,165,250,.4)',borderRadius:20,padding:'4px 14px',fontSize:12,color:'#60a5fa',fontWeight:700,letterSpacing:.5}}>🇺🇬 UGANDA EXPORT HUB</div>
            <div style={{background:'rgba(74,222,128,.1)',border:'1px solid rgba(74,222,128,.3)',borderRadius:20,padding:'4px 14px',fontSize:12,color:'#4ade80',fontWeight:600}}>✅ UCDA · UGCEA · FDA Registered</div>
          </div>
          <h1 style={{fontSize:34,fontWeight:900,color:WHITE,margin:'0 0 8px',letterSpacing:-.5}}>✈️ Export from Uganda</h1>
          <p style={{fontSize:15,color:'#94a3b8',margin:'0 0 10px'}}>Certified agricultural commodities · FOB Mombasa & Entebbe · Live market-referenced USD pricing</p>
          <div style={{fontSize:13,color:'#60a5fa',marginBottom:24}}>📊 Prices updated weekly based on ICE Futures, Mombasa Tea Auction & UCDA market reports</div>

          {/* Stats bar */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:24}}>
            {[['✈️','FOB Mombasa & Entebbe','Two international ports'],['📋','Grade Certified','UCDA, UGCEA, SGS, EU-Organic'],['📦','Min 50kg–20 tonnes','Samples to full containers'],['💰','USD Pricing','Wire transfer · LC · Escrow']].map(([ic,t,d])=>(
              <div key={t} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'14px 16px',display:'flex',gap:10,alignItems:'center'}}>
                <span style={{fontSize:24,flexShrink:0}}>{ic}</span>
                <div><div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:2}}>{t}</div><div style={{fontSize:11,color:'#64748b'}}>{d}</div></div>
              </div>
            ))}
          </div>

          {/* Category tabs */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {CATS.map(c=>(
              <button key={c.slug} onClick={()=>setCat(c.slug)}
                style={{background:cat===c.slug?'#60a5fa':'rgba(255,255,255,.08)',color:cat===c.slug?'#0f172a':WHITE,border:`1px solid ${cat===c.slug?'#60a5fa':'rgba(255,255,255,.15)'}`,borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:cat===c.slug?700:400,cursor:'pointer',fontFamily:SF,transition:'all .15s'}}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listings */}
      <div style={{maxWidth:1280,margin:'0 auto',padding:'24px 16px'}}>
        {loading?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))',gap:16}}>
            {Array(6).fill(0).map((_,i)=><div key={i} style={{height:480,background:'rgba(255,255,255,.04)',borderRadius:10,border:'1px solid rgba(255,255,255,.08)'}}/>)}
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))',gap:16}}>
            {shown.map(l=>{
              const ppkg=l.price_per_kg||(l.price_per_tonne/1000);
              const pptonne=l.price_per_tonne||(l.price_per_kg*1000);
              const certs=Array.isArray(l.certifications)?l.certifications:(typeof l.certifications==='string'?JSON.parse(l.certifications||'[]'):[]);
              const specs=Array.isArray(l.specs)?l.specs:[];
              const photo=l.photo||(l.photos&&l.photos[0]);
              return(
                <div key={l.id} style={{background:'#1e293b',border:'1px solid #334155',borderRadius:10,overflow:'hidden',fontFamily:SF,display:'flex',flexDirection:'column'}}>
                  {/* Image */}
                  <div style={{height:190,position:'relative',overflow:'hidden',background:'#0f172a'}}>
                    {photo
                      ?<img src={photo} alt={l.product_name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>
                      :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:64}}>🌾</div>}
                    {/* Price overlay */}
                    <div style={{position:'absolute',top:0,right:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(4px)',padding:'10px 14px',borderBottomLeftRadius:10}}>
                      <div style={{fontSize:22,fontWeight:900,color:'#60a5fa',letterSpacing:-.5}}>${ppkg.toFixed(2)}<span style={{fontSize:13,fontWeight:500,color:'#94a3b8'}}>/kg</span></div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>${Math.round(pptonne).toLocaleString()}/tonne</div>
                    </div>
                    {/* Port badge */}
                    <div style={{position:'absolute',bottom:8,left:8,background:'rgba(0,0,0,.7)',color:'#60a5fa',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:10,backdropFilter:'blur(4px)'}}>
                      ✈️ FOB {l.port||'Mombasa'}
                    </div>
                    {/* Grade badge */}
                    {l.grade&&<div style={{position:'absolute',top:8,left:8,background:l.grade_color||'#f59e0b',color:'#0f172a',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:10,letterSpacing:.3}}>
                      {l.grade}
                    </div>}
                  </div>

                  {/* Body */}
                  <div style={{padding:'16px 18px',flex:1,display:'flex',flexDirection:'column',gap:12}}>
                    {/* Name + origin */}
                    <div>
                      <div style={{fontSize:17,fontWeight:800,color:WHITE,marginBottom:4,lineHeight:1.3}}>{l.product_name}</div>
                      <div style={{fontSize:12,color:'#64748b'}}>📍 {l.district||'Uganda'} &nbsp;·&nbsp; 🕐 Lead time: {l.lead_time_weeks||4} weeks</div>
                    </div>

                    {/* Grade description */}
                    {l.grade_desc&&(
                      <div style={{background:'rgba(96,165,250,.08)',border:'1px solid rgba(96,165,250,.2)',borderRadius:6,padding:'8px 12px',fontSize:11,color:'#93c5fd',lineHeight:1.6}}>
                        <strong style={{color:'#60a5fa'}}>Grade: </strong>{l.grade_desc}
                      </div>
                    )}

                    {/* Specs table */}
                    {specs.length>0&&(
                      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid #334155',borderRadius:6,overflow:'hidden'}}>
                        {specs.map((s,i)=>(
                          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 10px',borderBottom:i<specs.length-1?'1px solid #1e293b':'none',background:i%2===0?'rgba(255,255,255,.02)':'transparent'}}>
                            <span style={{fontSize:11,color:'#64748b'}}>{s.k}</span>
                            <span style={{fontSize:11,color:WHITE,fontWeight:600}}>{s.v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Certifications */}
                    {certs.length>0&&(
                      <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                        {certs.map((c,i)=>(
                          <span key={i} style={{background:'rgba(74,222,128,.1)',border:'1px solid rgba(74,222,128,.25)',color:'#4ade80',fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:10}}>✓ {c}</span>
                        ))}
                      </div>
                    )}

                    {/* Order info */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div style={{background:'rgba(255,255,255,.04)',borderRadius:6,padding:'8px 10px'}}>
                        <div style={{fontSize:10,color:'#64748b',marginBottom:2}}>MIN ORDER</div>
                        <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{l.min_order_tonnes} tonne{l.min_order_tonnes!==1?'s':''}</div>
                      </div>
                      <div style={{background:'rgba(255,255,255,.04)',borderRadius:6,padding:'8px 10px'}}>
                        <div style={{fontSize:10,color:'#64748b',marginBottom:2}}>ANNUAL SUPPLY</div>
                        <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{l.annual_volume_tonnes} tonnes</div>
                      </div>
                    </div>

                    {/* Payment terms */}
                    {(l.payment_terms)&&(
                      <div style={{background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:6,padding:'8px 12px',fontSize:11,color:'#fbbf24'}}>
                        💳 <strong>Payment:</strong> {l.payment_terms}
                      </div>
                    )}

                    {/* Description */}
                    {l.description&&<p style={{fontSize:12,color:'#94a3b8',lineHeight:1.6,margin:0}}>{l.description}</p>}

                    {/* Actions */}
                    <div style={{display:'flex',gap:8,marginTop:'auto',paddingTop:4}}>
                      <button onClick={()=>{setEnquiry(l);setSent(false);setForm({buyer_name:'',buyer_company:'',buyer_country:'',buyer_email:'',buyer_phone:'',quantity_tonnes:'',message:''});}}
                        style={{flex:1,background:'#60a5fa',color:'#0f172a',border:'none',borderRadius:6,padding:'10px 0',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:DM}}>
                        📩 Send Enquiry
                      </button>
                      {l.seller_phone&&(
                        <a href={`https://wa.me/${l.seller_phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"
                          style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:6,padding:'10px 14px',fontSize:13,fontWeight:700,cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
                          💬 WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div style={{marginTop:40,background:'linear-gradient(135deg,#1e3a5f,#0f172a)',border:'1px solid #1e3a5f',borderRadius:12,padding:'32px 28px',textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:800,color:WHITE,marginBottom:8}}>✈️ List Your Export Commodity</div>
          <p style={{fontSize:14,color:'#94a3b8',margin:'0 0 6px'}}>Reach international buyers in 50+ countries. Live FOB pricing in USD/EUR. Free listing for verified Ugandan exporters.</p>
          <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:16,flexWrap:'wrap'}}>
            {['☕ Coffee','🌿 Vanilla','🍫 Cocoa','🌾 Simsim','🍵 Tea','🌽 Maize'].map(c=>(
              <span key={c} style={{background:'rgba(96,165,250,.15)',border:'1px solid rgba(96,165,250,.3)',borderRadius:20,padding:'4px 12px',fontSize:12,color:'#93c5fd'}}>{c}</span>
            ))}
          </div>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <button onClick={()=>window.location.href='/export/register'}
              style={{background:'#60a5fa',color:'#0f172a',border:'none',borderRadius:8,padding:'13px 32px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:DM}}>
              Register as Exporter →
            </button>
            <button style={{background:'transparent',color:'#60a5fa',border:'1px solid #60a5fa',borderRadius:8,padding:'12px 24px',fontSize:14,cursor:'pointer',fontFamily:DM}}>
              Contact Export Team
            </button>
          </div>
          <div style={{fontSize:12,color:'#475569',marginTop:12}}>✓ Free to register · Verified against UCDA/UEPB records · Live within 48 hrs</div>
        </div>
      </div>

      {/* Enquiry Modal */}
      {enquiry&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setEnquiry(null)}>
          <div style={{background:'#1e293b',border:'1px solid #334155',borderRadius:12,padding:28,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            {sent?(
              <div style={{textAlign:'center',padding:'20px 0'}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <div style={{fontSize:20,fontWeight:800,color:WHITE,marginBottom:8}}>Enquiry Sent!</div>
                <p style={{color:'#94a3b8',fontSize:14}}>The exporter will contact you within 24 hours.</p>
                <button onClick={()=>setEnquiry(null)} style={{marginTop:16,background:'#60a5fa',color:'#0f172a',border:'none',borderRadius:6,padding:'10px 24px',fontWeight:700,cursor:'pointer',fontFamily:DM}}>Close</button>
              </div>
            ):(
              <>
                <div style={{fontSize:16,fontWeight:800,color:WHITE,marginBottom:4}}>📩 Export Enquiry</div>
                <div style={{fontSize:13,color:'#60a5fa',marginBottom:18}}>{enquiry.product_name} — ${(enquiry.price_per_kg||(enquiry.price_per_tonne/1000)).toFixed(2)}/kg FOB {enquiry.port}</div>
                {[['buyer_name','Your Name *'],['buyer_company','Company / Organisation'],['buyer_country','Country *'],['buyer_email','Email *'],['buyer_phone','Phone / WhatsApp'],['quantity_tonnes','Quantity Required (tonnes) *']].map(([k,label])=>(
                  <div key={k} style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:'#94a3b8',marginBottom:4}}>{label}</div>
                    <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                      style={{width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid #334155',borderRadius:6,padding:'9px 12px',color:WHITE,fontSize:13,fontFamily:SF,outline:'none',boxSizing:'border-box'}}/>
                  </div>
                ))}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,color:'#94a3b8',marginBottom:4}}>Additional Requirements / Message</div>
                  <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={3}
                    style={{width:'100%',background:'rgba(255,255,255,.06)',border:'1px solid #334155',borderRadius:6,padding:'9px 12px',color:WHITE,fontSize:13,fontFamily:SF,outline:'none',resize:'vertical',boxSizing:'border-box'}}/>
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={sendEnquiry} style={{flex:1,background:'#60a5fa',color:'#0f172a',border:'none',borderRadius:6,padding:'11px 0',fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:DM}}>Submit Enquiry</button>
                  <button onClick={()=>setEnquiry(null)} style={{background:'rgba(255,255,255,.08)',color:WHITE,border:'1px solid #334155',borderRadius:6,padding:'11px 16px',fontSize:14,cursor:'pointer',fontFamily:DM}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Uganda Location Data ─────────────────────────────────────────────────────
const UG_DISTRICTS={
  Kampala:['Kampala Central','Kawempe','Makindye','Nakawa','Rubaga'],
  Wakiso:['Entebbe','Kira','Makindye-Ssabagabo','Nansana','Ssisa'],
  Mukono:['Mukono Town','Seeta-Namuganga','Goma','Kyampisi','Ntenjeru'],
  Jinja:['Jinja Central','Bugembe','Kakira','Mafubira','Walukuba'],
  Mbarara:['Mbarara City','Kakoba','Nyamitanga','Biharwe','Kakiika'],
  Gulu:['Gulu City','Bardege-Layibi','Pece-Laroo','Omoro','Aswa'],
  Lira:['Lira City','Ojwina','Railways','Bar Dege','Adyel'],
  Mbale:['Mbale City','Namatala','Industrial','Wanale','Bufumbo'],
  Arua:['Arua City','Ayivu','Vurra','Oluko','Maracha'],
  'Fort Portal':['Fort Portal City','Kabarole','Kasenda','Bunyangabu','Kitagwenda'],
};
const UG_QUICK_CITIES=['Kampala','Wakiso','Jinja','Gulu','Lira','Mbarara','Mbale','Arua','Fort Portal'];
const DIR_CATEGORIES=['All','Hardware','Pharmacy','Restaurant & Food','Electronics','Fabrics & Textiles','Medical','Automotive','Salon & Beauty','Supermarket','Steel & Metal','Food & Groceries','Construction','Wholesale'];
const DELIVERY_OPTS=[
  {type:'boda',icon:'🏍️',label:'Boda Boda',base:5000,perKm:1500,maxKm:30},
  {type:'tuk',icon:'🛺',label:'Tuk Tuk',base:8000,perKm:2000,maxKm:20},
  {type:'pickup',icon:'🛻',label:'Pickup Truck',base:35000,perKm:4000,maxKm:200},
  {type:'van',icon:'🚐',label:'Van / Lorry',base:80000,perKm:6000,maxKm:500},
];
const COST_GUIDE=[
  {cat:'Construction',icon:'🏗️',items:[{name:'Cement 50kg',range:'UGX 28,000–36,000'},{name:'Iron Sheet gauge 28 (m)',range:'UGX 35,000–42,000'},{name:'Rebar 12mm (12m)',range:'UGX 90,000–110,000'},{name:'Bricks (1,000)',range:'UGX 420,000–550,000'}]},
  {cat:'Food & Market',icon:'🛒',items:[{name:'Matooke (bunch)',range:'UGX 18,000–35,000'},{name:'Beef per kg',range:'UGX 14,000–22,000'},{name:'Rice 25kg (local)',range:'UGX 65,000–80,000'},{name:'Tomatoes (tray)',range:'UGX 7,000–14,000'}]},
  {cat:'Pharmacy',icon:'💊',items:[{name:'Paracetamol 500mg×100',range:'UGX 7,000–10,000'},{name:'Amoxicillin 500mg×21',range:'UGX 22,000–30,000'},{name:'ACT Malaria kit',range:'UGX 15,000–22,000'},{name:'IV Saline 1L',range:'UGX 4,500–7,000'}]},
  {cat:'Salon & Beauty',icon:'💇',items:[{name:'Ladies haircut',range:'UGX 8,000–20,000'},{name:'Braiding',range:'UGX 30,000–80,000'},{name:'Manicure',range:'UGX 10,000–25,000'},{name:'Men barber',range:'UGX 3,000–8,000'}]},
  {cat:'Mechanics',icon:'🔧',items:[{name:'Oil change (saloon)',range:'UGX 40,000–80,000'},{name:'Tyre repair (tubeless)',range:'UGX 10,000–20,000'},{name:'Brake pads (front)',range:'UGX 60,000–150,000'},{name:'Engine oil 4L synthetic',range:'UGX 80,000–160,000'}]},
  {cat:'Electronics',icon:'📱',items:[{name:'Samsung A-series mid',range:'UGX 800,000–2,000,000'},{name:'Smart TV 43"',range:'UGX 700,000–1,200,000'},{name:'Fridge 200L',range:'UGX 900,000–1,600,000'},{name:'Solar panel 200W',range:'UGX 300,000–550,000'}]},
];
const VERIFY_BADGES={
  phone:{label:'Phone Verified',color:'#0ea5e9',icon:'📞'},
  location:{label:'Location Verified',color:'#16a34a',icon:'📍'},
  permit:{label:'Business Permit',color:'#7c3aed',icon:'📋'},
  ura:{label:'URA/TIN',color:'#dc2626',icon:'🏛️'},
  physical:{label:'Physical Shop',color:'#d97706',icon:'🏪'},
};
const CAT_THEME={
  'Pharmacy':{accent:'#16a34a',bg:'#f0fdf4',icon:'💊'},
  'Restaurant & Food':{accent:'#dc2626',bg:'#fff1f2',icon:'🍽️'},
  'Hardware':{accent:'#d97706',bg:'#fffbeb',icon:'🔨'},
  'Hardware & Construction':{accent:'#d97706',bg:'#fffbeb',icon:'🔨'},
  'Medical':{accent:'#0ea5e9',bg:'#f0f9ff',icon:'🏥'},
  'Electronics':{accent:'#6366f1',bg:'#eef2ff',icon:'📱'},
  'Salon & Beauty':{accent:'#ec4899',bg:'#fdf2f8',icon:'💇'},
  'Automotive':{accent:'#64748b',bg:'#f8fafc',icon:'🔧'},
  'Steel & Metal':{accent:'#475569',bg:'#f8fafc',icon:'⚙️'},
  'Food & Groceries':{accent:'#16a34a',bg:'#f0fdf4',icon:'🛒'},
};
function haversineKm(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(km){return km<1?`${Math.round(km*1000)}m away`:km<10?`${km.toFixed(1)}km away`:`${Math.round(km)}km away`;}
function fmtPhone(p){if(!p)return null;const d=p.replace(/\D/g,'');return d.startsWith('256')?'+'+d:d.startsWith('0')?d:'+256'+d;}
function waLink(p){if(!p)return '#';const d=p.replace(/\D/g,'');return`https://wa.me/${d.startsWith('256')?d:d.startsWith('0')?'256'+d.slice(1):'256'+d}`;}

// ── Business Profile Page ─────────────────────────────────────────────────────
function BusinessProfilePage(){
  const {id}=useParams();
  const nav=useNavigate();
  const [searchParamsP]=useSearchParams();
  const isNew=searchParamsP.get('new')==='1';
  const [biz,setBiz]=useState(null);
  const [loading,setLoading]=useState(true);
  const [showClaim,setShowClaim]=useState(false);
  const [saved,setSaved]=useState(false);
  const [bannerDismissed,setBannerDismissed]=useState(false);

  useEffect(()=>{
    setLoading(true);
    fetch(`/api/directory/${id}`)
      .then(r=>r.json())
      .then(d=>{setBiz(d.business||d);setLoading(false);})
      .catch(()=>{const m=MOCK_DIRECTORY.find(x=>x.id===id);setBiz(m||null);setLoading(false);});
  },[id]);

  if(loading)return <div style={{minHeight:'100vh',background:LIGHT,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}><div style={{fontSize:32}}>⏳</div></div>;
  if(!biz)return <div style={{minHeight:'100vh',background:LIGHT,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}><div style={{textAlign:'center'}}><div style={{fontSize:48,marginBottom:12}}>🏪</div><div style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:8}}>Business not found</div><button onClick={()=>nav('/directory')} style={{background:NAVY,color:WHITE,border:'none',borderRadius:6,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer'}}>← Back to Directory</button></div></div>;

  const theme=CAT_THEME[biz.category]||{accent:LINK,bg:'#f0f9ff',icon:'🏪'};
  const phone=fmtPhone(biz.phone);
  const mapUrl=biz.lat&&biz.lng?`https://www.google.com/maps?q=${biz.lat},${biz.lng}&label=${encodeURIComponent(biz.business_name)}`:`https://www.google.com/maps/search/${encodeURIComponent((biz.street_address||biz.area||'')+' '+biz.district+' Uganda')}`;

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      <div style={{background:NAVY,padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
        <button onClick={()=>nav('/directory')} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:6,padding:'6px 14px',color:WHITE,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:DM}}>← Directory</button>
        <span style={{color:'rgba(255,255,255,.5)',fontSize:13}}>{biz.category||biz.business_type}</span>
      </div>

      {isNew&&!bannerDismissed&&(
        <div style={{background:'linear-gradient(135deg,#052e16,#14532d)',borderBottom:'2px solid #16a34a',padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:44,height:44,background:'rgba(22,163,74,.25)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>🎉</div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:'#86efac'}}>Your business is now live!</div>
              <div style={{fontSize:12,color:'rgba(134,239,172,.7)',marginTop:2}}>Share this page · Claim this listing to manage it · Update products &amp; prices anytime</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexShrink:0,flexWrap:'wrap'}}>
            <button onClick={()=>{try{if(navigator.share)navigator.share({title:biz.business_name,url:window.location.href});else navigator.clipboard?.writeText(window.location.href);}catch(e){}}} style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:6,padding:'9px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM}}>↗ Share listing</button>
            <button onClick={()=>nav(`/biz-dashboard?phone=${encodeURIComponent(biz.owner_phone||'')}`)} style={{background:'rgba(255,255,255,.1)',color:WHITE,border:'1px solid rgba(255,255,255,.25)',borderRadius:6,padding:'9px 16px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:DM}}>🏪 Manage listing</button>
            <button onClick={()=>setBannerDismissed(true)} style={{background:'transparent',color:'rgba(255,255,255,.4)',border:'none',cursor:'pointer',fontSize:20,padding:'0 4px',lineHeight:1}}>×</button>
          </div>
        </div>
      )}

      <div style={{background:biz.bg||`linear-gradient(135deg,${NAVY},${NAVY2})`,padding:'28px 20px'}}>
        <div style={{maxWidth:860,margin:'0 auto',display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{width:80,height:80,background:'rgba(255,255,255,.18)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,border:'2px solid rgba(255,255,255,.3)',flexShrink:0}}>{biz.emoji||theme.icon||'🏪'}</div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
              <h1 style={{fontSize:24,fontWeight:800,color:WHITE,margin:0}}>{biz.business_name}</h1>
              {biz.is_verified&&<span style={{background:'#16a34a',color:WHITE,fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:12}}>✓ VERIFIED</span>}
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,.7)',marginBottom:8}}>{biz.category||biz.business_type} · {biz.district}</div>
            {biz.rating>0&&<div style={{display:'flex',alignItems:'center',gap:6}}><span style={{color:'#f59e0b',fontSize:14}}>{'★'.repeat(Math.min(5,Math.round(biz.rating||0)))+'☆'.repeat(5-Math.min(5,Math.round(biz.rating||0)))}</span><span style={{color:WHITE,fontWeight:700,fontSize:14}}>{biz.rating}</span><span style={{color:'rgba(255,255,255,.6)',fontSize:12}}>({biz.total_reviews||0} reviews)</span></div>}
          </div>
          <div style={{display:'flex',gap:8,flexShrink:0}}>
            <button onClick={()=>setSaved(s=>!s)} style={{background:saved?'#f59e0b':'rgba(255,255,255,.15)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:DM}}>{saved?'♥ Saved':'♡ Save'}</button>
            <button onClick={()=>{if(navigator.share)navigator.share({title:biz.business_name,url:window.location.href});}} style={{background:'rgba(255,255,255,.15)',color:WHITE,border:'1px solid rgba(255,255,255,.3)',borderRadius:8,padding:'8px 14px',fontSize:13,cursor:'pointer',fontFamily:DM}}>↗ Share</button>
          </div>
        </div>
      </div>
      <div style={{maxWidth:860,margin:'0 auto',padding:'16px',display:'grid',gridTemplateColumns:'minmax(0,1fr) min(320px,100%)',gap:16,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16,display:'flex',gap:8,flexWrap:'wrap'}}>
            {phone&&<a href={`tel:${phone}`} style={{flex:'1 1 120px',background:'#0ea5e9',color:WHITE,borderRadius:8,padding:'12px 8px',fontSize:13,fontWeight:700,textAlign:'center',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>📞 Call</a>}
            {biz.whatsapp&&<a href={waLink(biz.whatsapp)} target="_blank" rel="noreferrer" style={{flex:'1 1 120px',background:'#16a34a',color:WHITE,borderRadius:8,padding:'12px 8px',fontSize:13,fontWeight:700,textAlign:'center',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>💬 WhatsApp</a>}
            <a href={mapUrl} target="_blank" rel="noreferrer" style={{flex:'1 1 120px',background:NAVY,color:WHITE,borderRadius:8,padding:'12px 8px',fontSize:13,fontWeight:700,textAlign:'center',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>🗺️ Directions</a>
          </div>
          {biz.description&&<div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}><div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>About</div><p style={{fontSize:14,color:TEXT,lineHeight:1.7,margin:0}}>{biz.description}</p></div>}
          {biz.products&&biz.products.length>0&&(
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
              <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:12}}>📦 Products & Prices</div>
              <div style={{border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden'}}>
                {biz.products.map((p,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:i%2===0?WHITE:'#fafafa',borderTop:i>0?`1px solid ${BORDER}`:'none'}}>
                    <span style={{fontSize:14,color:TEXT,flex:1,paddingRight:12,lineHeight:1.4}}>{p.name}</span>
                    <div style={{textAlign:'right',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>{p.condition&&p.condition!=='new'&&<span style={{...condStyle(p.condition),fontSize:9}}>{condLabel(p.condition)}</span>}{p.condition==='new'&&<span style={{...condStyle('new'),fontSize:9}}>New</span>}<span style={{fontSize:15,fontWeight:800,color:RED}}>UGX {Number(p.price).toLocaleString()}</span>{p.unit&&<div style={{fontSize:10,color:MUTED}}>{p.unit}</div>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:12}}>🚚 Delivery Options</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {DELIVERY_OPTS.map(d=>(
                <div key={d.type} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f8fafc',borderRadius:8,border:`1px solid ${BORDER}`}}>
                  <span style={{fontSize:22,flexShrink:0}}>{d.icon}</span>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:TEXT}}>{d.label}</div><div style={{fontSize:11,color:MUTED}}>From UGX {d.base.toLocaleString()} + UGX {d.perKm.toLocaleString()}/km</div></div>
                  {phone&&<a href={`tel:${phone}`} style={{background:'#0ea5e9',color:WHITE,fontSize:11,fontWeight:700,padding:'6px 12px',borderRadius:6,textDecoration:'none'}}>Request</a>}
                </div>
              ))}
            </div>
          </div>
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>⭐ Reviews</div>
            <div style={{fontSize:13,color:MUTED,fontStyle:'italic'}}>{biz.total_reviews>0?`${biz.total_reviews} reviews — detailed review system coming soon.`:'No reviews yet.'}</div>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14,position:'sticky',top:80}}>
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>📍 Location</div>
            <div style={{fontSize:14,fontWeight:600,color:TEXT,marginBottom:4}}>{biz.street_address||biz.area||'Address not added'}</div>
            <div style={{fontSize:12,color:MUTED,marginBottom:10}}>{[biz.area,biz.district].filter(Boolean).join(', ')}</div>
            <a href={mapUrl} target="_blank" rel="noreferrer" style={{display:'block',background:'#0ea5e9',color:WHITE,borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,textAlign:'center',textDecoration:'none'}}>🗺️ Open in Google Maps</a>
          </div>
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>🕐 Opening Hours</div>
            <div style={{fontSize:13,color:biz.open_hours?'#16a34a':MUTED,lineHeight:1.6}}>{biz.open_hours||'Hours not added — call to confirm'}</div>
            {biz.accepts_walkin&&<div style={{marginTop:8,fontSize:12,color:'#16a34a',fontWeight:600}}>✓ Walk-ins welcome</div>}
          </div>
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>📞 Contact</div>
            {phone?<a href={`tel:${phone}`} style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',marginBottom:8}}><span style={{fontSize:20}}>📞</span><span style={{fontSize:15,fontWeight:800,color:'#0c4a6e'}}>{phone}</span></a>:<div style={{fontSize:13,color:MUTED,marginBottom:8}}>Phone not added</div>}
            {biz.email&&<div style={{fontSize:12,color:MUTED,marginBottom:4}}>✉️ {biz.email}</div>}
            {biz.website&&<a href={biz.website} target="_blank" rel="noreferrer" style={{fontSize:12,color:LINK}}>🌐 {biz.website}</a>}
          </div>
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>🏅 Verification</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {biz.is_verified?Object.entries(VERIFY_BADGES).map(([k,v])=>(
                <span key={k} style={{background:v.color+'18',color:v.color,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:12,border:`1px solid ${v.color}40`}}>{v.icon} {v.label}</span>
              )):<span style={{fontSize:13,color:MUTED,fontStyle:'italic'}}>Not yet verified</span>}
            </div>
            <button onClick={()=>setShowClaim(true)} style={{marginTop:12,width:'100%',background:'transparent',border:`1px solid ${BORDER}`,borderRadius:6,padding:'8px',fontSize:12,fontWeight:600,color:MUTED,cursor:'pointer',fontFamily:DM}}>🏪 Claim this business</button>
          </div>
        </div>
      </div>
      {showClaim&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setShowClaim(false);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:WHITE,borderRadius:12,padding:28,maxWidth:420,width:'100%',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:12}}>🏪</div>
            <h3 style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:8}}>Claim This Business</h3>
            <p style={{fontSize:13,color:MUTED,marginBottom:20,lineHeight:1.6}}>Contact us via WhatsApp to verify ownership and gain access to update your listing, add products, photos and manage your profile.</p>
            <a href="https://wa.me/256700000000" style={{display:'block',background:'#16a34a',color:WHITE,borderRadius:8,padding:'12px',fontSize:14,fontWeight:700,textDecoration:'none',marginBottom:10}}>💬 WhatsApp to Claim</a>
            <button onClick={()=>setShowClaim(false)} style={{background:'transparent',border:`1px solid ${BORDER}`,borderRadius:6,padding:'10px',width:'100%',fontSize:13,cursor:'pointer',color:MUTED,fontFamily:DM}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Product Unit Options ────────────────────────────────────────────────────
const UNIT_OPTIONS=[
  {group:'Count',units:['per piece','per dozen (12)','per gross (144)','per pair','per set','per pack','per bundle']},
  {group:'Weight',units:['per kg','per gram','per 50kg bag','per tonne','per pound']},
  {group:'Volume',units:['per litre','per 500ml','per 20L jerrican','per gallon','per ml']},
  {group:'Length / Area',units:['per metre','per cm','per square metre (m²)','per foot','per roll']},
  {group:'Packaging',units:['per bag','per box','per carton','per tray','per tin','per sachet','per bottle','per sack','per bale']},
  {group:'Food',units:['per bunch','per tray (30 eggs)','per plate','per serving','per loaf','per crate']},
  {group:'Service / Time',units:['per job','per hour','per day','per week','per month','per session','per visit']},
  {group:'Land',units:['per acre','per plot','per square foot','per hectare']},
];
const UNIT_FLAT=['per piece',...UNIT_OPTIONS.flatMap(g=>g.units)];
const CONDITION_OPTIONS=[
  {value:'new',      label:'New',         color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0'},
  {value:'used',     label:'Used',        color:'#d97706', bg:'#fffbeb', border:'#fde68a'},
  {value:'refurb',   label:'Refurbished', color:'#0ea5e9', bg:'#f0f9ff', border:'#bae6fd'},
  {value:'openbox',  label:'Open Box',    color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe'},
];
const condStyle=v=>{const o=CONDITION_OPTIONS.find(x=>x.value===v)||CONDITION_OPTIONS[0];return{background:o.bg,color:o.color,border:`1px solid ${o.border}`,fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:8,whiteSpace:'nowrap'};};
const condLabel=v=>(CONDITION_OPTIONS.find(x=>x.value===v)||CONDITION_OPTIONS[0]).label;

// ── Business Directory Page ───────────────────────────────────────────────────
function BusinessDirectoryPage(){
  const [searchParams]=useSearchParams();
  const nav=useNavigate();
  const [userLat,setUserLat]=useState(null);
  const [userLng,setUserLng]=useState(null);
  const [locStatus,setLocStatus]=useState('idle');
  const [quickCity,setQuickCity]=useState('');
  const [dist,setDist]=useState('');
  const [subcounty,setSubcounty]=useState('');
  const [catFilter,setCatFilter]=useState('All');
  const [typeFilter,setTypeFilter]=useState('All');
  const [onlyOpen,setOnlyOpen]=useState(false);
  const [onlyVerified,setOnlyVerified]=useState(false);
  const [onlyDelivery,setOnlyDelivery]=useState(false);
  const [sortBy,setSortBy]=useState('nearest');
  const [q,setQ]=useState('');
  const [businesses,setBusinesses]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(searchParams.get('list')==='1');
  const [compareMode,setCompareMode]=useState(false);
  const [compareList,setCompareList]=useState([]);
  const [showCompare,setShowCompare]=useState(false);
  const [showCostGuide,setShowCostGuide]=useState(false);
  const [savedBiz,setSavedBiz]=useState([]);
  const blankForm={owner_name:'',owner_phone:'',business_name:'',business_type:'retail',category:'',description:'',phone:'',whatsapp:'',email:'',website:'',district:'Kampala',area:'',street_address:'',parish:'',village:'',open_hours:'',accepts_walkin:false,has_delivery:false};
  const [form,setForm]=useState(blankForm);
  const [products,setProducts]=useState([{name:'',price:'',unit:'per piece',condition:'new'}]);
  const [submitting,setSubmitting]=useState(false);
  const [submitErr,setSubmitErr]=useState('');
  const [submitOk,setSubmitOk]=useState(false);

  const addProduct=()=>setProducts(p=>[...p,{name:'',price:''}]);
  const removeProduct=i=>setProducts(p=>p.filter((_,idx)=>idx!==i));
  const updateProduct=(i,field,val)=>setProducts(p=>p.map((r,idx)=>idx===i?{...r,[field]:val}:r));

  useEffect(()=>{
    setLocStatus('asking');
    if(!navigator.geolocation){setLocStatus('denied');return;}
    navigator.geolocation.getCurrentPosition(
      pos=>{setUserLat(pos.coords.latitude);setUserLng(pos.coords.longitude);setLocStatus('granted');},
      ()=>setLocStatus('denied'),{timeout:8000}
    );
  },[]);

  useEffect(()=>{loadBiz();},[dist,typeFilter,catFilter]);

  const loadBiz=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({...(dist&&dist!=='All'&&{district:dist}),...(typeFilter&&typeFilter!=='All'&&{type:typeFilter}),...(catFilter&&catFilter!=='All'&&{category:catFilter})});
      const r=await fetch(`/api/directory?${p}&limit=60`);
      const d=await r.json();
      setBusinesses(d.businesses||[]);
    }catch(e){setBusinesses([]);}finally{setLoading(false);}
  };

  const submitBiz=async()=>{
    if(!form.owner_name||!form.owner_phone||!form.business_name||!form.phone||!form.district){
      setSubmitErr('Owner name, owner phone, business name, business phone and district are required.');return;
    }
    setSubmitting(true);setSubmitErr('');
    try{
      const validProducts=products.filter(p=>p.name.trim()&&p.price!=='');
      const payload={...form,products:validProducts.map(p=>({name:p.name.trim(),price:parseFloat(p.price)||0,unit:p.unit||'per piece',condition:p.condition||'new'}))};
      const r=await fetch('/api/directory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok){setSubmitErr(d.error||'Submission failed.');return;}
      setShowAdd(false);
      setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);
      nav(`/directory/${d.business_id}?new=1`);
    }catch(e){setSubmitErr('Connection error.');}finally{setSubmitting(false);}
  };

  const toggleCompare=b=>{
    setCompareList(prev=>{
      if(prev.find(x=>x.id===b.id))return prev.filter(x=>x.id!==b.id);
      if(prev.length>=4)return prev;
      return[...prev,b];
    });
  };

  const selectCity=city=>{setQuickCity(city);setDist(city);setSubcounty('');};

  const raw=businesses.length>0?businesses:MOCK_DIRECTORY;
  const addDist=b=>{if(userLat!==null&&b.lat&&b.lng)return haversineKm(userLat,userLng,b.lat,b.lng);return null;};
  const withDist=raw.map(b=>({...b,_km:addDist(b)}));

  const filtered=withDist.filter(b=>{
    if(q){
      const lq=q.toLowerCase().replace(/near me/i,'').replace(/cheapest/i,'').trim();
      if(lq&&!(b.business_name.toLowerCase().includes(lq)||b.category?.toLowerCase().includes(lq)||(b.description||'').toLowerCase().includes(lq)||(b.area||'').toLowerCase().includes(lq)||(b.district||'').toLowerCase().includes(lq)||(b.products||[]).some(p=>p.name.toLowerCase().includes(lq))))return false;
    }
    if(dist&&dist!=='All'&&b.district&&b.district.toLowerCase()!==dist.toLowerCase())return false;
    if(subcounty&&!(b.area||'').toLowerCase().includes(subcounty.toLowerCase()))return false;
    if(catFilter&&catFilter!=='All'&&b.category&&!b.category.toLowerCase().includes(catFilter.toLowerCase()))return false;
    if(typeFilter&&typeFilter!=='All'&&b.business_type&&b.business_type!==typeFilter)return false;
    if(onlyOpen&&b.pin_status!=='open')return false;
    if(onlyVerified&&!b.is_verified)return false;
    return true;
  });

  const sorted=[...filtered].sort((a,b)=>{
    if(sortBy==='nearest'){if(a._km!==null&&b._km!==null)return a._km-b._km;if(a._km!==null)return -1;if(b._km!==null)return 1;}
    if(sortBy==='rating')return(b.rating||0)-(a.rating||0);
    if(sortBy==='reviews')return(b.total_reviews||0)-(a.total_reviews||0);
    if(sortBy==='name')return a.business_name.localeCompare(b.business_name);
    if(sortBy==='open'){if(a.pin_status==='open'&&b.pin_status!=='open')return -1;if(b.pin_status==='open'&&a.pin_status!=='open')return 1;}
    return(b.is_verified?1:0)-(a.is_verified?1:0);
  });

  const shown=sorted;
  const subcountyOpts=UG_DISTRICTS[dist]||[];
  const pinColor=s=>s==='open'?'#16a34a':s==='busy'?'#d97706':'#dc2626';
  const pinLabel=s=>s==='open'?'Open Now':s==='busy'?'Busy':'Closed';
  const inp2={border:`1px solid ${BORDER}`,borderRadius:4,padding:'9px 12px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:TEXT,width:'100%'};

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${NAVY} 0%,${NAVY2} 100%)`,padding:'20px 16px 0'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8}}>
            <div>
              <h1 style={{fontSize:24,fontWeight:800,color:WHITE,margin:'0 0 2px'}}>📍 Business Directory</h1>
              <p style={{fontSize:12,color:'#94a3b8',margin:0}}>Find businesses · Compare prices · Call · WhatsApp · Directions</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>setShowCostGuide(s=>!s)} style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.25)',borderRadius:6,padding:'8px 14px',color:WHITE,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:DM}}>💰 Price Guide</button>
              <button onClick={()=>{setShowAdd(true);setSubmitOk(false);setSubmitErr('');setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:6,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:DM}}>+ List Your Business</button>
            </div>
          </div>

          {/* Location status */}
          <div style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,padding:'9px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:14,flexShrink:0}}>📍</span>
            {locStatus==='granted'&&userLat!==null
              ?<span style={{fontSize:13,color:'#86efac',fontWeight:600}}>Location detected — showing nearest businesses first</span>
              :locStatus==='asking'
              ?<span style={{fontSize:13,color:'#fbbf24'}}>Detecting your location…</span>
              :<span style={{fontSize:13,color:'rgba(255,255,255,.6)'}}>Location not available — select your area below</span>}
            {locStatus==='denied'&&<button onClick={()=>{setLocStatus('asking');navigator.geolocation?.getCurrentPosition(p=>{setUserLat(p.coords.latitude);setUserLng(p.coords.longitude);setLocStatus('granted');},()=>setLocStatus('denied'),{timeout:8000});}} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',borderRadius:6,padding:'4px 12px',color:WHITE,fontSize:12,cursor:'pointer',fontFamily:DM}}>Try Again</button>}
          </div>

          {/* Quick city pills */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            {UG_QUICK_CITIES.map(c=>(
              <button key={c} onClick={()=>quickCity===c?selectCity(''):selectCity(c)}
                style={{background:quickCity===c?YELLOW:'rgba(255,255,255,.12)',color:quickCity===c?TEXT:WHITE,border:'none',borderRadius:16,padding:'5px 14px',fontSize:12,fontWeight:quickCity===c?700:400,cursor:'pointer',fontFamily:DM,transition:'all .15s'}}>
                {c}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{display:'flex',border:`2px solid ${YELLOW}`,borderRadius:6,overflow:'hidden',background:WHITE,marginBottom:0}}>
            <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadBiz()}
              placeholder="Search: cement near me · pharmacy · rolex in Ntinda · mechanic open now…"
              style={{flex:1,padding:'11px 16px',border:'none',outline:'none',fontSize:14,color:TEXT,fontFamily:SF}}/>
            <button onClick={()=>loadBiz()} style={{background:YELLOW,border:'none',padding:'0 20px',cursor:'pointer',fontSize:18,flexShrink:0}}>🔍</button>
          </div>

          {/* Filter bar */}
          <div style={{display:'flex',gap:8,padding:'10px 0',flexWrap:'wrap',alignItems:'center'}}>
            <select value={dist} onChange={e=>{setDist(e.target.value);setSubcounty('');setQuickCity(e.target.value);}}
              style={{border:'1px solid rgba(255,255,255,.3)',borderRadius:6,padding:'7px 12px',fontSize:12,background:'rgba(255,255,255,.12)',color:WHITE,fontFamily:SF,outline:'none'}}>
              <option value="" style={{color:TEXT}}>All Districts</option>
              {Object.keys(UG_DISTRICTS).map(d=><option key={d} value={d} style={{color:TEXT}}>{d}</option>)}
            </select>
            {subcountyOpts.length>0&&(
              <select value={subcounty} onChange={e=>setSubcounty(e.target.value)}
                style={{border:'1px solid rgba(255,255,255,.3)',borderRadius:6,padding:'7px 12px',fontSize:12,background:'rgba(255,255,255,.12)',color:WHITE,fontFamily:SF,outline:'none'}}>
                <option value="" style={{color:TEXT}}>All Divisions</option>
                {subcountyOpts.map(s=><option key={s} value={s} style={{color:TEXT}}>{s}</option>)}
              </select>
            )}
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)}
              style={{border:'1px solid rgba(255,255,255,.3)',borderRadius:6,padding:'7px 12px',fontSize:12,background:'rgba(255,255,255,.12)',color:WHITE,fontFamily:SF,outline:'none'}}>
              {DIR_CATEGORIES.map(c=><option key={c} value={c} style={{color:TEXT}}>{c}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
              style={{border:'1px solid rgba(255,255,255,.3)',borderRadius:6,padding:'7px 12px',fontSize:12,background:'rgba(255,255,255,.12)',color:WHITE,fontFamily:SF,outline:'none'}}>
              <option value="nearest" style={{color:TEXT}}>📍 Nearest</option>
              <option value="rating" style={{color:TEXT}}>⭐ Best Rated</option>
              <option value="open" style={{color:TEXT}}>✅ Open Now</option>
              <option value="reviews" style={{color:TEXT}}>💬 Most Reviews</option>
              <option value="name" style={{color:TEXT}}>🔤 A–Z</option>
              <option value="verified" style={{color:TEXT}}>✓ Verified</option>
            </select>
            {[['onlyOpen','✅ Open Now',onlyOpen,setOnlyOpen],['onlyVerified','✓ Verified',onlyVerified,setOnlyVerified]].map(([k,lb,val,setter])=>(
              <button key={k} onClick={()=>setter(v=>!v)}
                style={{background:val?YELLOW:'rgba(255,255,255,.12)',color:val?TEXT:WHITE,border:'none',borderRadius:16,padding:'7px 14px',fontSize:12,fontWeight:val?700:400,cursor:'pointer',fontFamily:DM,transition:'all .15s'}}>
                {lb}
              </button>
            ))}
            <button onClick={()=>{setCompareMode(c=>!c);if(compareMode)setCompareList([]);}}
              style={{background:compareMode?'#7c3aed':'rgba(255,255,255,.12)',color:WHITE,border:'none',borderRadius:16,padding:'7px 14px',fontSize:12,fontWeight:compareMode?700:400,cursor:'pointer',fontFamily:DM,marginLeft:'auto'}}>
              ⚖️ Compare
            </button>
          </div>
        </div>
      </div>

      {/* Price guide panel */}
      {showCostGuide&&(
        <div style={{background:NAVY2,borderTop:`2px solid ${YELLOW}`,padding:'14px 16px',overflowX:'auto'}}>
          <div style={{maxWidth:1280,margin:'0 auto'}}>
            <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:10}}>💰 Local Price Guide — Uganda 2025</div>
            <div style={{display:'flex',gap:14,overflowX:'auto',paddingBottom:4}}>
              {COST_GUIDE.map(g=>(
                <div key={g.cat} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,padding:'12px 14px',minWidth:200,flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:YELLOW,marginBottom:8}}>{g.icon} {g.cat}</div>
                  {g.items.map(it=>(
                    <div key={it.name} style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:5}}>
                      <span style={{fontSize:11,color:'rgba(255,255,255,.6)',flex:1}}>{it.name}</span>
                      <span style={{fontSize:11,color:WHITE,fontWeight:600,flexShrink:0,whiteSpace:'nowrap'}}>{it.range}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compare bar */}
      {compareMode&&compareList.length>0&&(
        <div style={{background:'#7c3aed',padding:'10px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',position:'sticky',top:0,zIndex:200}}>
          <span style={{color:WHITE,fontSize:13,fontWeight:700,flexShrink:0}}>⚖️ Comparing {compareList.length}/4:</span>
          {compareList.map(b=><span key={b.id} style={{background:'rgba(255,255,255,.2)',color:WHITE,fontSize:12,padding:'4px 10px',borderRadius:12}}>{b.business_name}</span>)}
          <button onClick={()=>setShowCompare(true)} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:6,padding:'7px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM,marginLeft:'auto'}}>Compare Now →</button>
        </div>
      )}

      <div style={{maxWidth:1280,margin:'0 auto',padding:'14px 16px'}}>
        {/* Top CTA */}
        <div style={{background:`linear-gradient(135deg,${NAVY} 0%,#0f172a 100%)`,border:'2px solid #0ea5e9',borderRadius:10,padding:'16px 20px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,background:'rgba(14,165,233,.2)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>📍</div>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:WHITE}}>List Your Business — Free</div>
              <div style={{fontSize:12,color:'#94a3b8',marginTop:1}}>Phone · Location pin · Products & prices · Verified badge · Reach customers across Uganda</div>
            </div>
          </div>
          <button onClick={()=>{setShowAdd(true);setSubmitOk(false);setSubmitErr('');setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}} style={{background:'#0ea5e9',color:WHITE,border:'none',borderRadius:6,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:SF,flexShrink:0}}>
            + List Your Business
          </button>
        </div>

        {/* Results count */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:6}}>
          <div style={{fontSize:13,color:MUTED}}>
            {shown.length} {shown.length===1?'business':'businesses'} found{q?` for "${q}"`:''}{dist?` in ${dist}`:''}
            {locStatus==='granted'?' · sorted by distance':''}
          </div>
          {compareMode&&<span style={{fontSize:12,color:'#7c3aed',fontWeight:600}}>Select up to 4 businesses to compare</span>}
        </div>

        {/* Grid */}
        {loading?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:14}}>
            {Array(6).fill(0).map((_,i)=><div key={i} style={{height:380,background:WHITE,borderRadius:10,border:`1px solid ${BORDER}`}}/>)}
          </div>
        ):shown.length===0?(
          <div style={{textAlign:'center',padding:'60px 20px',background:WHITE,borderRadius:10,border:`1px solid ${BORDER}`}}>
            <div style={{fontSize:48,marginBottom:12}}>🔍</div>
            <div style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:8}}>No businesses found</div>
            <div style={{fontSize:14,color:MUTED,marginBottom:20}}>Try removing some filters or searching in a different area.</div>
            <button onClick={()=>{setQ('');setDist('');setCatFilter('All');setTypeFilter('All');setOnlyOpen(false);setOnlyVerified(false);setQuickCity('');}} style={{background:NAVY,color:WHITE,border:'none',borderRadius:6,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Clear Filters</button>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:14}}>
            {shown.map(b=>{
              const theme=CAT_THEME[b.category]||{accent:'#0ea5e9',bg:'#f0f9ff',icon:'🏪'};
              const phone=fmtPhone(b.phone);
              const mapUrl=b.lat&&b.lng?`https://www.google.com/maps?q=${b.lat},${b.lng}&label=${encodeURIComponent(b.business_name)}`:`https://www.google.com/maps/search/${encodeURIComponent((b.street_address||b.area||'')+' '+b.district+' Uganda')}`;
              const inCompare=compareList.find(x=>x.id===b.id);
              const isSaved=savedBiz.includes(b.id);
              return(
                <div key={b.id}
                  onClick={compareMode?()=>toggleCompare(b):undefined}
                  style={{background:WHITE,border:inCompare?'2px solid #7c3aed':`1px solid ${BORDER}`,borderRadius:10,overflow:'hidden',boxShadow:'0 2px 10px rgba(0,0,0,.06)',fontFamily:SF,transition:'all .15s',cursor:compareMode?'pointer':'default'}}
                  onMouseEnter={e=>{if(!compareMode)e.currentTarget.style.boxShadow='0 6px 22px rgba(0,0,0,.13)';}}
                  onMouseLeave={e=>{if(!compareMode)e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,.06)';}}>

                  {/* Header */}
                  <div style={{height:100,background:b.bg||`linear-gradient(135deg,${NAVY},${NAVY2})`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 14px',position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:52,height:52,background:'rgba(255,255,255,.18)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,border:'2px solid rgba(255,255,255,.3)',flexShrink:0}}>{b.emoji||theme.icon||'🏪'}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:WHITE,lineHeight:1.3,maxWidth:140,cursor:'pointer'}} onClick={e=>{e.stopPropagation();nav(`/directory/${b.id}`)}}>{b.business_name}</div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,.65)',marginTop:2}}>{b.category||b.business_type}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                      <span style={{background:pinColor(b.pin_status),color:WHITE,fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:10,whiteSpace:'nowrap'}}>● {pinLabel(b.pin_status)}</span>
                      {b.is_verified&&<span style={{background:'rgba(22,163,74,.85)',color:WHITE,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>✓ VERIFIED</span>}
                      {compareMode&&<span style={{background:inCompare?'#7c3aed':'rgba(255,255,255,.2)',color:WHITE,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>{inCompare?'✓':'+ Compare'}</span>}
                    </div>
                    <button onClick={e=>{e.stopPropagation();setSavedBiz(prev=>isSaved?prev.filter(x=>x!==b.id):[...prev,b.id]);}} style={{position:'absolute',top:7,left:7,background:'rgba(255,255,255,.15)',border:'none',borderRadius:'50%',width:26,height:26,cursor:'pointer',color:isSaved?'#f59e0b':WHITE,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
                      {isSaved?'♥':'♡'}
                    </button>
                  </div>

                  <div style={{padding:'11px 13px 13px'}}>
                    {/* Rating */}
                    {(b.rating>0||b.total_reviews>0)&&(
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:7}}>
                        <span style={{color:'#f59e0b',fontSize:11}}>{'★'.repeat(Math.min(5,Math.round(b.rating||0)))+'☆'.repeat(5-Math.min(5,Math.round(b.rating||0)))}</span>
                        <span style={{fontSize:11,fontWeight:700,color:TEXT}}>{b.rating||''}</span>
                        <span style={{fontSize:10,color:MUTED}}>({b.total_reviews||0})</span>
                        {b.accepts_walkin&&<span style={{marginLeft:'auto',fontSize:10,color:'#16a34a',fontWeight:600}}>✓ Walk-in</span>}
                      </div>
                    )}

                    {/* Location */}
                    <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:6,background:'#f8fafc',borderRadius:6,padding:'6px 9px'}}>
                      <span style={{fontSize:12,flexShrink:0}}>📍</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:TEXT,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.street_address||b.area||b.district}</div>
                        <div style={{fontSize:10,color:MUTED}}>{[b.area,b.district].filter(Boolean).join(', ')}</div>
                      </div>
                      {b._km!=null&&<span style={{fontSize:10,fontWeight:700,color:'#0ea5e9',flexShrink:0}}>{fmtDist(b._km)}</span>}
                      <a href={mapUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{flexShrink:0,background:'#0ea5e9',color:WHITE,fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius:4,textDecoration:'none',whiteSpace:'nowrap'}}>🗺️ Map</a>
                    </div>

                    {/* Hours */}
                    <div style={{fontSize:10,color:b.open_hours?'#16a34a':MUTED,marginBottom:7,fontWeight:b.open_hours?600:400}}>🕐 {b.open_hours||'Hours not added'}</div>

                    {/* Phone */}
                    {phone?(
                      <a href={`tel:${phone}`} onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center',gap:9,background:'#f0f9ff',border:'2px solid #0ea5e9',borderRadius:7,padding:'8px 11px',marginBottom:9,textDecoration:'none'}}>
                        <div style={{width:28,height:28,background:'#0ea5e9',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>📞</div>
                        <div>
                          <div style={{fontSize:9,color:'#0369a1',fontWeight:700,letterSpacing:.5,textTransform:'uppercase'}}>Tap to call</div>
                          <div style={{fontSize:15,fontWeight:900,color:'#0c4a6e',letterSpacing:.3}}>{phone}</div>
                        </div>
                      </a>
                    ):(
                      <div style={{fontSize:11,color:MUTED,fontStyle:'italic',marginBottom:9}}>📞 Phone not added</div>
                    )}

                    {/* Products */}
                    {b.products&&b.products.length>0?(
                      <div style={{marginBottom:9}}>
                        <div style={{fontSize:9,fontWeight:800,color:TEXT,marginBottom:4,textTransform:'uppercase',letterSpacing:.7}}>📦 Products & Prices</div>
                        <div style={{border:`1px solid ${BORDER}`,borderRadius:5,overflow:'hidden'}}>
                          {b.products.slice(0,3).map((p,i)=>(
                            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 9px',background:i%2===0?WHITE:'#fafafa',borderTop:i>0?`1px solid ${BORDER}`:'none'}}>
                              <span style={{fontSize:10,color:TEXT,flex:1,paddingRight:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</span>
                              <div style={{textAlign:'right',flexShrink:0}}>{p.condition&&<span style={{...condStyle(p.condition),display:'inline-block',marginBottom:2}}>{condLabel(p.condition)}</span>}<div style={{fontSize:11,fontWeight:800,color:RED}}>UGX {Number(p.price).toLocaleString()}</div>{p.unit&&<div style={{fontSize:9,color:MUTED,lineHeight:1.2}}>{p.unit}</div>}</div>
                            </div>
                          ))}
                          {b.products.length>3&&<div style={{padding:'4px 9px',fontSize:9,color:LINK,fontWeight:600,cursor:'pointer',background:'#f8fafc'}} onClick={e=>{e.stopPropagation();nav(`/directory/${b.id}`);}}>+{b.products.length-3} more →</div>}
                        </div>
                      </div>
                    ):(
                      <div style={{fontSize:10,color:MUTED,fontStyle:'italic',marginBottom:9}}>📦 Prices not added — call for details</div>
                    )}

                    {/* Description */}
                    {b.description&&<p style={{fontSize:10,color:MUTED,lineHeight:1.55,margin:'0 0 9px',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{b.description}</p>}

                    {/* Chips */}
                    <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:9}}>
                      {b.accepts_walkin&&<span style={{background:'#f0fdf4',color:'#16a34a',fontSize:9,fontWeight:600,padding:'2px 7px',borderRadius:9,border:'1px solid #bbf7d0'}}>🚶 Walk-in</span>}
                      <span style={{background:'#f0f9ff',color:'#0ea5e9',fontSize:9,fontWeight:600,padding:'2px 7px',borderRadius:9,border:'1px solid #bae6fd'}}>🏍️ Delivery</span>
                      {b.is_verified&&<span style={{background:'#f0fdf4',color:'#16a34a',fontSize:9,fontWeight:600,padding:'2px 7px',borderRadius:9,border:'1px solid #bbf7d0'}}>✓ Verified</span>}
                    </div>

                    {/* Action buttons */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                      {phone?<a href={`tel:${phone}`} onClick={e=>e.stopPropagation()} style={{background:NAVY,color:WHITE,borderRadius:4,padding:'7px 2px',fontSize:10,fontWeight:700,textAlign:'center',textDecoration:'none'}}>📞 Call</a>:<div/>}
                      {b.whatsapp?<a href={waLink(b.whatsapp)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{background:'#16a34a',color:WHITE,borderRadius:4,padding:'7px 2px',fontSize:10,fontWeight:700,textAlign:'center',textDecoration:'none'}}>💬 WA</a>:<div/>}
                      <a href={mapUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{background:'#0ea5e9',color:WHITE,borderRadius:4,padding:'7px 2px',fontSize:10,fontWeight:700,textAlign:'center',textDecoration:'none'}}>🗺️ Dir</a>
                      <button onClick={e=>{e.stopPropagation();nav(`/directory/${b.id}`);}} style={{background:'#7c3aed',color:WHITE,border:'none',borderRadius:4,padding:'7px 2px',fontSize:10,fontWeight:700,cursor:'pointer',width:'100%'}}>📋 More</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{background:NAVY2,borderRadius:8,padding:'22px 24px',marginTop:22,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:14}}>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:WHITE,marginBottom:3}}>List your business — it's free</div>
            <div style={{fontSize:12,color:'#94a3b8'}}>Add your photos, products, prices, phone and location pin · Reach customers across Uganda</div>
          </div>
          <button onClick={()=>{setShowAdd(true);setSubmitOk(false);setSubmitErr('');setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:6,padding:'11px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:SF,flexShrink:0}}>
            Add My Business →
          </button>
        </div>
      </div>

      {/* Compare Modal */}
      {showCompare&&compareList.length>0&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setShowCompare(false);}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:WHITE,borderRadius:12,width:'100%',maxWidth:900,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{background:NAVY,padding:'16px 20px',borderRadius:'12px 12px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:17,fontWeight:800,color:WHITE}}>⚖️ Price Comparison</div>
              <button onClick={()=>setShowCompare(false)} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',color:WHITE,fontSize:18}}>×</button>
            </div>
            <div style={{padding:20,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:500,fontFamily:SF}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    <th style={{padding:'10px 12px',textAlign:'left',fontSize:12,fontWeight:700,color:MUTED,borderBottom:`2px solid ${BORDER}`}}>Feature</th>
                    {compareList.map(b=>(
                      <th key={b.id} style={{padding:'10px 12px',textAlign:'center',fontSize:12,fontWeight:700,color:TEXT,borderBottom:`2px solid ${BORDER}`}}>
                        <div>{b.business_name}</div><div style={{fontSize:10,color:MUTED,fontWeight:400}}>{b.district}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Rating',b=>`${b.rating||'—'} ⭐ (${b.total_reviews||0})`],
                    ['Status',b=>b.pin_status==='open'?'✅ Open':'❌ Closed'],
                    ['Verified',b=>b.is_verified?'✓ Verified':'—'],
                    ['Location',b=>[b.area,b.district].filter(Boolean).join(', ')||'—'],
                    ['Distance',b=>b._km!=null?fmtDist(b._km):'—'],
                    ['Phone',b=>fmtPhone(b.phone)||'Not added'],
                    ['Walk-ins',b=>b.accepts_walkin?'✅ Yes':'—'],
                    ['Hours',b=>b.open_hours||'Not added'],
                  ].map(([label,fn])=>(
                    <tr key={label} style={{borderBottom:`1px solid ${BORDER}`}}>
                      <td style={{padding:'9px 12px',fontSize:12,fontWeight:600,color:MUTED}}>{label}</td>
                      {compareList.map(b=><td key={b.id} style={{padding:'9px 12px',fontSize:12,color:TEXT,textAlign:'center'}}>{fn(b)}</td>)}
                    </tr>
                  ))}
                  {compareList.some(b=>b.products&&b.products.length>0)&&(
                    <>
                      <tr style={{background:'#f8fafc'}}><td colSpan={compareList.length+1} style={{padding:'8px 12px',fontSize:11,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8}}>Products & Prices</td></tr>
                      {[0,1,2,3,4].map(i=>(
                        <tr key={i} style={{borderBottom:`1px solid ${BORDER}`}}>
                          <td style={{padding:'7px 12px',fontSize:11,color:MUTED}}>Product {i+1}</td>
                          {compareList.map(b=>{const p=b.products?.[i];return<td key={b.id} style={{padding:'7px 12px',fontSize:11,color:TEXT,textAlign:'center'}}>{p?<><div style={{fontWeight:600}}>{p.name}</div>{p.condition&&<span style={{...condStyle(p.condition),display:'inline-block',marginBottom:2}}>{condLabel(p.condition)}</span>}<div style={{color:RED,fontWeight:800}}>UGX {Number(p.price).toLocaleString()}</div>{p.unit&&<div style={{fontSize:10,color:MUTED}}>{p.unit}</div>}</>:'—'}</td>;})}
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              <div style={{marginTop:16,display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
                {compareList.map(b=>fmtPhone(b.phone)&&<a key={b.id} href={`tel:${fmtPhone(b.phone)}`} style={{background:NAVY,color:WHITE,borderRadius:6,padding:'9px 16px',fontSize:12,fontWeight:700,textDecoration:'none'}}>📞 Call {b.business_name.split(' ')[0]}</a>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Business Modal */}
      {showAdd&&(
        <div onClick={e=>{if(e.target===e.currentTarget){setShowAdd(false);setSubmitOk(false);setSubmitErr('');setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:WHITE,borderRadius:12,width:'100%',maxWidth:620,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.4)'}}>
            <div style={{background:`linear-gradient(135deg,${NAVY},${NAVY2})`,padding:'18px 22px',borderRadius:'12px 12px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:WHITE}}>📍 List Your Business</div>
                <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>Free listing · Verified within 48 hours · Reach customers across Uganda</div>
              </div>
              <button onClick={()=>{setShowAdd(false);setSubmitOk(false);setSubmitErr('');setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',color:WHITE,fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
            </div>

            {submitOk?(
              <div style={{padding:40,textAlign:'center'}}>
                <div style={{fontSize:56,marginBottom:14}}>🎉</div>
                <h3 style={{fontSize:20,fontWeight:700,color:TEXT,marginBottom:8}}>Business Submitted!</h3>
                <p style={{color:MUTED,fontSize:14,marginBottom:24,lineHeight:1.6}}>Your listing is received. Our team will verify and publish it within 1–2 business days.</p>
                <button onClick={()=>{setShowAdd(false);setSubmitOk(false);setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}} style={{background:NAVY,color:WHITE,border:'none',borderRadius:6,padding:'11px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Done</button>
              </div>
            ):(
              <div style={{padding:'18px 22px 22px'}}>
                {submitErr&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'10px 14px',color:'#b91c1c',fontSize:13,marginBottom:14}}>{submitErr}</div>}

                <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:7,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>CONTACT PERSON (Owner / Manager)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  <input placeholder="Full name *" value={form.owner_name} onChange={e=>setForm({...form,owner_name:e.target.value})} style={inp2}/>
                  <input placeholder="Your phone number *" value={form.owner_phone} onChange={e=>setForm({...form,owner_phone:e.target.value})} style={inp2}/>
                </div>

                <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:7,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>BUSINESS INFORMATION</div>
                <input placeholder="Business name *" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} style={{...inp2,marginBottom:8}}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <select value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} style={inp2}>
                    {['retail','wholesale','manufacturer','service','restaurant','pharmacy','hardware','salon','medical','automotive'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                  <input placeholder="Category (e.g. Pharmacy, Hardware) *" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={inp2}/>
                </div>
                <textarea placeholder="What do you sell or offer? Why should customers choose you? *" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} style={{...inp2,resize:'vertical',marginBottom:12}}/>

                <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:7,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>CONTACT & COMMUNICATION</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <input placeholder="Business phone * (customers will call this)" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={inp2}/>
                  <input placeholder="WhatsApp number" value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} style={inp2}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  <input placeholder="Email (optional)" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={inp2}/>
                  <input placeholder="Website (optional)" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} style={inp2}/>
                </div>

                <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:7,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>LOCATION *</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <select value={form.district} onChange={e=>setForm({...form,district:e.target.value,area:''})} style={inp2}>
                    {[...Object.keys(UG_DISTRICTS),'Mukono','Lira','Soroti','Masaka','Kabale','Hoima','Kasese','Bushenyi','Mubende','Kamuli','Iganga','Tororo','Busia','Moroto','Kotido','Adjumani'].map(d=><option key={d}>{d}</option>)}
                  </select>
                  <input placeholder="Subcounty / Division *" value={form.area} onChange={e=>setForm({...form,area:e.target.value})} style={inp2}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <input placeholder="Parish / Ward" value={form.parish||''} onChange={e=>setForm({...form,parish:e.target.value})} style={inp2}/>
                  <input placeholder="Village / Zone / Stage" value={form.village||''} onChange={e=>setForm({...form,village:e.target.value})} style={inp2}/>
                </div>
                <input placeholder="Street address / plot number / landmark" value={form.street_address} onChange={e=>setForm({...form,street_address:e.target.value})} style={{...inp2,marginBottom:8}}/>
                <input placeholder="Opening hours (e.g. Mon–Fri 8am–6pm · Sat 9am–1pm) *" value={form.open_hours} onChange={e=>setForm({...form,open_hours:e.target.value})} style={{...inp2,marginBottom:12}}/>

                <div style={{display:'flex',gap:20,marginBottom:18,flexWrap:'wrap'}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:TEXT,cursor:'pointer'}}>
                    <input type="checkbox" checked={form.accepts_walkin} onChange={e=>setForm({...form,accepts_walkin:e.target.checked})} style={{width:16,height:16}}/> Walk-in customers welcome
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:TEXT,cursor:'pointer'}}>
                    <input type="checkbox" checked={form.has_delivery||false} onChange={e=>setForm({...form,has_delivery:e.target.checked})} style={{width:16,height:16}}/> Delivery available
                  </label>
                </div>

                {/* Products & Prices */}
                <div style={{fontSize:11,fontWeight:700,color:TEXT,marginBottom:7,paddingBottom:6,borderBottom:`1px solid ${BORDER}`}}>PRODUCTS & PRICES <span style={{fontWeight:400,color:MUTED}}>(optional — used for price comparison)</span></div>
                <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'12px 14px',marginBottom:14}}>
                  <div style={{fontSize:12,color:MUTED,marginBottom:10,lineHeight:1.5}}>
                    Add the products or services you offer with <strong>fixed UGX prices</strong>. This lets customers compare prices across businesses and find the cheapest option near them.
                  </div>
                  {products.map((p,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 130px 110px 88px 32px',gap:6,marginBottom:6,alignItems:'center'}}>
                      <input
                        placeholder="Product / service name (e.g. Cement, Haircut, Oil change)"
                        value={p.name}
                        onChange={e=>updateProduct(i,'name',e.target.value)}
                        style={{...inp2,fontSize:13}}/>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:MUTED,pointerEvents:'none',fontWeight:600}}>UGX</span>
                        <input
                          type="number"
                          placeholder="Price"
                          value={p.price}
                          onChange={e=>updateProduct(i,'price',e.target.value)}
                          min="0"
                          style={{...inp2,fontSize:13,paddingLeft:40}}/>
                      </div>
                      <select value={p.unit||'per piece'} onChange={e=>updateProduct(i,'unit',e.target.value)}
                        style={{...inp2,fontSize:12,padding:'9px 6px',cursor:'pointer'}}>
                        {UNIT_OPTIONS.map(g=>(
                          <optgroup key={g.group} label={g.group}>
                            {g.units.map(u=><option key={u} value={u}>{u}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <select value={p.condition||'new'} onChange={e=>updateProduct(i,'condition',e.target.value)}
                        style={{...inp2,fontSize:12,padding:'9px 6px',cursor:'pointer',fontWeight:600,
                          background:CONDITION_OPTIONS.find(x=>x.value===(p.condition||'new'))?.bg||'#f0fdf4',
                          color:CONDITION_OPTIONS.find(x=>x.value===(p.condition||'new'))?.color||'#16a34a',
                          border:`1px solid ${CONDITION_OPTIONS.find(x=>x.value===(p.condition||'new'))?.border||'#bbf7d0'}`}}>
                        {CONDITION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button
                        onClick={()=>removeProduct(i)}
                        disabled={products.length===1}
                        style={{width:32,height:38,background:products.length===1?'#f1f5f9':'#fef2f2',border:`1px solid ${products.length===1?BORDER:'#fecaca'}`,borderRadius:4,cursor:products.length===1?'default':'pointer',color:products.length===1?MUTED:'#dc2626',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        ×
                      </button>
                    </div>
                  ))}
                  {products.length<20&&(
                    <button onClick={addProduct} style={{marginTop:4,background:'transparent',border:`1px dashed ${BORDER}`,borderRadius:6,padding:'7px 16px',fontSize:12,color:LINK,cursor:'pointer',fontFamily:SF,width:'100%'}}>
                      + Add another product / service
                    </button>
                  )}
                  <div style={{marginTop:8,fontSize:11,color:MUTED}}>
                    💡 Tip: Use exact, current prices. Customers will compare these with other nearby businesses. You can update them anytime after listing.
                  </div>
                </div>

                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button onClick={()=>{setShowAdd(false);setSubmitErr('');setForm(blankForm);setProducts([{name:'',price:'',unit:'per piece',condition:'new'}]);}} style={{background:'transparent',color:MUTED,border:`1px solid ${BORDER}`,borderRadius:6,padding:'10px 18px',fontSize:14,cursor:'pointer',fontFamily:SF}}>Cancel</button>
                  <button onClick={submitBiz} disabled={submitting} style={{background:NAVY,color:WHITE,border:'none',borderRadius:6,padding:'10px 26px',fontSize:14,fontWeight:700,cursor:submitting?'not-allowed':'pointer',fontFamily:SF,opacity:submitting?.7:1}}>
                    {submitting?'Submitting…':'Submit Listing'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Business Owner Dashboard ─────────────────────────────────────────────────
function BizDashboardPage(){
  const nav=useNavigate();
  const [searchParams]=useSearchParams();
  // Auth state
  const [phone,setPhone]=useState(searchParams.get('phone')||'');
  const [authed,setAuthed]=useState(false);
  const [authLoading,setAuthLoading]=useState(false);
  const [authErr,setAuthErr]=useState('');
  const [listings,setListings]=useState([]);
  const [activeBiz,setActiveBiz]=useState(null);
  // Dashboard state
  const [tab,setTab]=useState('overview');
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');
  const [saveErr,setSaveErr]=useState('');
  // Edit form mirrors the listing fields
  const bizEditor=useDraftableForm('biz-edit');
  const editForm=bizEditor.form,setEditForm=bizEditor.setForm;
  const [editProducts,setEditProducts]=useState([]);
  const [pinStatus,setPinStatus]=useState('open');
  const inp={border:`1px solid ${BORDER}`,borderRadius:6,padding:'9px 12px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:TEXT,width:'100%'};

  const login=async()=>{
    if(!phone.trim()){setAuthErr('Enter your registered phone number.');return;}
    setAuthLoading(true);setAuthErr('');
    try{
      const r=await fetch(`/api/directory/owner/by-phone?phone=${encodeURIComponent(phone.trim())}`);
      const d=await r.json();
      if(!r.ok){setAuthErr(d.error||'Login failed.');return;}
      setListings(d.businesses);
      const initial=d.businesses[0];
      loadBiz(initial);
      setAuthed(true);
    }catch(e){setAuthErr('Connection error.');}finally{setAuthLoading(false);}
  };

  const loadBiz=biz=>{
    setActiveBiz(biz);
    bizEditor.hydrate({
      business_name:biz.business_name||'',
      business_type:biz.business_type||'retail',
      category:biz.category||'',
      description:biz.description||'',
      phone:biz.phone||'',
      whatsapp:biz.whatsapp||'',
      email:biz.email||'',
      website:biz.website||'',
      district:biz.district||'Kampala',
      area:biz.area||'',
      parish:biz.parish||'',
      village:biz.village||'',
      street_address:biz.street_address||'',
      open_hours:biz.open_hours||'',
      accepts_walkin:biz.accepts_walkin||false,
      has_delivery:biz.has_delivery||false,
    },biz.id);
    setPinStatus(biz.pin_status||'open');
    const prods=Array.isArray(biz.products)&&biz.products.length>0
      ?biz.products.map(p=>({name:p.name||'',price:String(p.price||''),unit:p.unit||'per piece',condition:p.condition||'new'}))
      :[{name:'',price:'',unit:'per piece',condition:'new'}];
    setEditProducts(prods);
    setSaveMsg('');setSaveErr('');
  };

  const addEditProduct=()=>setEditProducts(p=>[...p,{name:'',price:''}]);
  const removeEditProduct=i=>setEditProducts(p=>p.filter((_,idx)=>idx!==i));
  const updateEditProduct=(i,field,val)=>setEditProducts(p=>p.map((r,idx)=>idx===i?{...r,[field]:val}:r));

  const save=async()=>{
    if(!activeBiz)return;
    setSaving(true);setSaveMsg('');setSaveErr('');
    try{
      const validProds=editProducts.filter(p=>p.name.trim()&&p.price!=='');
      const payload={
        owner_phone:phone,
        ...editForm,
        pin_status:pinStatus,
        products:validProds.map(p=>({name:p.name.trim(),price:parseFloat(p.price)||0,unit:p.unit||'per piece',condition:p.condition||'new'})),
      };
      const r=await fetch(`/api/directory/${activeBiz.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok){setSaveErr(d.error||'Save failed.');return;}
      setSaveMsg('Saved successfully.');
      bizEditor.clearDraft();
      // Refresh active listing data
      const refreshed={...activeBiz,...editForm,pin_status:pinStatus,products:validProds.map(p=>({name:p.name.trim(),price:parseFloat(p.price)||0}))};
      setActiveBiz(refreshed);
      setListings(prev=>prev.map(b=>b.id===activeBiz.id?refreshed:b));
    }catch(e){setSaveErr('Connection error.');}finally{setSaving(false);}
  };

  const deactivate=async()=>{
    if(!activeBiz||!window.confirm(`Remove "${activeBiz.business_name}" from the directory? This cannot be undone easily.`))return;
    try{
      const r=await fetch(`/api/directory/${activeBiz.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner_phone:phone})});
      if(r.ok){setListings(prev=>prev.filter(b=>b.id!==activeBiz.id));setActiveBiz(null);setSaveMsg('Listing removed.');}
    }catch(e){setSaveErr('Failed to remove.');}
  };

  // ── Login screen ──────────────────────────────────────────────────────────
  if(!authed)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:DM}}>
      <div style={{background:WHITE,borderRadius:14,padding:'36px 32px',maxWidth:440,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,.12)',border:`1px solid ${BORDER}`}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:64,height:64,background:`linear-gradient(135deg,${NAVY},${NAVY2})`,borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,margin:'0 auto 14px'}}>📍</div>
          <h1 style={{fontSize:22,fontWeight:800,color:TEXT,margin:'0 0 6px'}}>Business Dashboard</h1>
          <p style={{fontSize:13,color:MUTED,margin:0}}>Enter the phone number you used when listing your business</p>
        </div>
        {authErr&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'10px 14px',color:'#b91c1c',fontSize:13,marginBottom:14}}>{authErr}</div>}
        <input
          value={phone} onChange={e=>setPhone(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&login()}
          placeholder="e.g. 0772 123 456"
          style={{...inp,fontSize:16,padding:'12px 14px',marginBottom:14,letterSpacing:.5}}
          autoFocus/>
        <button onClick={login} disabled={authLoading}
          style={{width:'100%',background:NAVY,color:WHITE,border:'none',borderRadius:8,padding:'13px',fontSize:15,fontWeight:700,cursor:authLoading?'not-allowed':'pointer',fontFamily:DM,opacity:authLoading?.7:1}}>
          {authLoading?'Looking up…':'Access My Dashboard →'}
        </button>
        <div style={{marginTop:16,textAlign:'center',fontSize:12,color:MUTED}}>
          Don't have a listing yet? <span onClick={()=>nav('/directory?list=1')} style={{color:LINK,cursor:'pointer',fontWeight:600}}>List your business free →</span>
        </div>
      </div>
    </div>
  );

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const TABS=[['overview','📊 Overview'],['details','✏️ Edit Details'],['products','📦 Products & Prices'],['hours','🕐 Hours & Status'],['share','↗ Share']];
  const mapUrl=activeBiz?.lat&&activeBiz?.lng?`https://www.google.com/maps?q=${activeBiz.lat},${activeBiz.lng}&label=${encodeURIComponent(activeBiz?.business_name||'')}`:`https://www.google.com/maps/search/${encodeURIComponent((activeBiz?.street_address||activeBiz?.area||'')+' '+(activeBiz?.district||'')+' Uganda')}`;
  const profileUrl=`${window.location.origin}/directory/${activeBiz?.id}`;

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Top bar */}
      <div style={{background:NAVY,padding:'0 16px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>📍</span>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:WHITE,lineHeight:1}}>{activeBiz?.business_name||'Dashboard'}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>{activeBiz?.district} · {activeBiz?.category||activeBiz?.business_type}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {listings.length>1&&(
            <select onChange={e=>loadBiz(listings.find(b=>b.id===e.target.value))} value={activeBiz?.id||''}
              style={{border:'1px solid rgba(255,255,255,.25)',borderRadius:6,padding:'5px 10px',fontSize:12,background:'rgba(255,255,255,.1)',color:WHITE,outline:'none',cursor:'pointer'}}>
              {listings.map(b=><option key={b.id} value={b.id} style={{color:TEXT}}>{b.business_name}</option>)}
            </select>
          )}
          <a href={profileUrl} target="_blank" rel="noreferrer"
            style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',borderRadius:6,padding:'6px 12px',color:WHITE,fontSize:12,fontWeight:600,textDecoration:'none'}}>
            View listing ↗
          </a>
          <button onClick={()=>{setAuthed(false);setListings([]);setActiveBiz(null);setPhone('');}}
            style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',borderRadius:6,padding:'6px 12px',color:'rgba(255,255,255,.6)',fontSize:12,cursor:'pointer',fontFamily:DM}}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'16px'}}>
        {/* Status bar */}
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span style={{background:activeBiz?.is_active?'#dcfce7':'#fef2f2',color:activeBiz?.is_active?'#16a34a':'#dc2626',fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20}}>{activeBiz?.is_active?'● Live':'● Inactive'}</span>
          {activeBiz?.is_verified&&<span style={{background:'#dbeafe',color:'#1d4ed8',fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20}}>✓ Verified</span>}
          {activeBiz?.is_flagged&&<span style={{background:'#fef3c7',color:'#92400e',fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:20}}>⚠️ Flagged for review</span>}
          <div style={{marginLeft:'auto',display:'flex',gap:16}}>
            <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:800,color:TEXT}}>{activeBiz?.views||0}</div><div style={{fontSize:10,color:MUTED}}>Views</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:800,color:TEXT}}>{activeBiz?.total_reviews||0}</div><div style={{fontSize:10,color:MUTED}}>Reviews</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:20,fontWeight:800,color:TEXT}}>{activeBiz?.rating||'—'}</div><div style={{fontSize:10,color:MUTED}}>Rating</div></div>
          </div>
        </div>

        {/* Save messages */}
        {saveMsg&&<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'10px 14px',color:'#16a34a',fontSize:13,fontWeight:600,marginBottom:12}}>✓ {saveMsg}</div>}
        {saveErr&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'10px 14px',color:'#b91c1c',fontSize:13,marginBottom:12}}>{saveErr}</div>}

        {/* Tab bar */}
        <div style={{display:'flex',gap:4,marginBottom:16,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:4,overflowX:'auto'}}>
          {TABS.map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)}
              style={{flex:'1 1 auto',background:tab===key?NAVY:'transparent',color:tab===key?WHITE:MUTED,border:'none',borderRadius:7,padding:'9px 12px',fontSize:13,fontWeight:tab===key?700:400,cursor:'pointer',fontFamily:DM,whiteSpace:'nowrap',transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {tab==='overview'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:18,gridColumn:'1/-1'}}>
              <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:12}}>Quick Actions</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10}}>
                {[
                  {icon:'✏️',label:'Edit Details',action:()=>setTab('details')},
                  {icon:'📦',label:'Update Products',action:()=>setTab('products')},
                  {icon:'🕐',label:'Change Hours',action:()=>setTab('hours')},
                  {icon:'↗',label:'Share Listing',action:()=>setTab('share')},
                  {icon:'🗺️',label:'View on Map',action:()=>window.open(mapUrl,'_blank')},
                  {icon:'👁️',label:'View Public Page',action:()=>window.open(profileUrl,'_blank')},
                ].map(({icon,label,action})=>(
                  <button key={label} onClick={action}
                    style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'14px 10px',textAlign:'center',cursor:'pointer',fontFamily:DM,transition:'background .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0f4ff'}
                    onMouseLeave={e=>e.currentTarget.style.background='#f8fafc'}>
                    <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                    <div style={{fontSize:12,fontWeight:600,color:TEXT}}>{label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:18}}>
              <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:12}}>Listing Info</div>
              {[
                ['Business','',activeBiz?.business_name],
                ['Category','',activeBiz?.category||activeBiz?.business_type],
                ['Location','',activeBiz?.street_address||activeBiz?.area||activeBiz?.district],
                ['District','',activeBiz?.district],
                ['Phone','',activeBiz?.phone||'Not added'],
                ['WhatsApp','',activeBiz?.whatsapp||'Not added'],
                ['Hours','',activeBiz?.open_hours||'Not added'],
                ['Listed','',activeBiz?.created_at?new Date(activeBiz.created_at).toLocaleDateString('en-UG',{day:'numeric',month:'short',year:'numeric'}):'—'],
              ].map(([k,,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${BORDER}`,gap:12}}>
                  <span style={{fontSize:12,color:MUTED,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:12,color:TEXT,fontWeight:600,textAlign:'right'}}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:18}}>
              <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:12}}>Products ({(activeBiz?.products||[]).length})</div>
              {(activeBiz?.products||[]).length===0
                ?<div style={{fontSize:12,color:MUTED,fontStyle:'italic'}}>No products listed yet. <span onClick={()=>setTab('products')} style={{color:LINK,cursor:'pointer'}}>Add products →</span></div>
                :(activeBiz.products||[]).slice(0,6).map((p,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<Math.min(5,(activeBiz.products||[]).length-1)?`1px solid ${BORDER}`:'none'}}>
                    <span style={{fontSize:12,color:TEXT,flex:1,paddingRight:8}}>{p.name}</span>
                    <div style={{textAlign:'right',flexShrink:0}}>{p.condition&&<span style={{...condStyle(p.condition),display:'inline-block',marginBottom:2}}>{condLabel(p.condition)}</span>}<div style={{fontSize:13,fontWeight:800,color:RED}}>UGX {Number(p.price).toLocaleString()}</div>{p.unit&&<div style={{fontSize:10,color:MUTED}}>{p.unit}</div>}</div>
                  </div>
                ))}
              {(activeBiz?.products||[]).length>6&&<div style={{fontSize:11,color:MUTED,marginTop:4}}>+{activeBiz.products.length-6} more</div>}
            </div>

            {/* Danger zone */}
            <div style={{background:'#fff5f5',border:'1px solid #fecaca',borderRadius:10,padding:18,gridColumn:'1/-1'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#dc2626',marginBottom:8}}>Danger Zone</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div style={{fontSize:13,color:MUTED}}>Remove this listing from the directory permanently.</div>
                <button onClick={deactivate} style={{background:'#dc2626',color:WHITE,border:'none',borderRadius:6,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM}}>Remove Listing</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Details tab ── */}
        {tab==='details'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:22}}>
            <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:18}}>✏️ Edit Business Details</div>
            {bizEditor.pendingDraft&&<UnsavedDraftBanner onRestore={bizEditor.restoreDraft} onDiscard={bizEditor.discardDraft}/>}

            <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:'uppercase',letterSpacing:.8}}>Business</div>
            <input placeholder="Business name *" value={editForm.business_name||''} onChange={e=>setEditForm({...editForm,business_name:e.target.value})} style={{...inp,marginBottom:10}}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <select value={editForm.business_type||'retail'} onChange={e=>setEditForm({...editForm,business_type:e.target.value})} style={inp}>
                {['retail','wholesale','manufacturer','service','restaurant','pharmacy','hardware','salon','medical','automotive'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
              <input placeholder="Category" value={editForm.category||''} onChange={e=>setEditForm({...editForm,category:e.target.value})} style={inp}/>
            </div>
            <textarea placeholder="Description" value={editForm.description||''} onChange={e=>setEditForm({...editForm,description:e.target.value})} rows={4} style={{...inp,resize:'vertical',marginBottom:18}}/>

            <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:'uppercase',letterSpacing:.8}}>Contact</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <input placeholder="Business phone" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})} style={inp}/>
              <input placeholder="WhatsApp" value={editForm.whatsapp||''} onChange={e=>setEditForm({...editForm,whatsapp:e.target.value})} style={inp}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
              <input placeholder="Email" value={editForm.email||''} onChange={e=>setEditForm({...editForm,email:e.target.value})} style={inp}/>
              <input placeholder="Website" value={editForm.website||''} onChange={e=>setEditForm({...editForm,website:e.target.value})} style={inp}/>
            </div>

            <div style={{fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:'uppercase',letterSpacing:.8}}>Location</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <select value={editForm.district||'Kampala'} onChange={e=>setEditForm({...editForm,district:e.target.value})} style={inp}>
                {Object.keys(UG_DISTRICTS).concat(['Mukono','Lira','Soroti','Masaka','Kabale','Hoima','Kasese','Bushenyi','Mubende','Kamuli','Iganga','Tororo','Busia','Moroto','Adjumani']).map(d=><option key={d}>{d}</option>)}
              </select>
              <input placeholder="Subcounty / Division" value={editForm.area||''} onChange={e=>setEditForm({...editForm,area:e.target.value})} style={inp}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <input placeholder="Parish / Ward" value={editForm.parish||''} onChange={e=>setEditForm({...editForm,parish:e.target.value})} style={inp}/>
              <input placeholder="Village / Zone" value={editForm.village||''} onChange={e=>setEditForm({...editForm,village:e.target.value})} style={inp}/>
            </div>
            <input placeholder="Street address / landmark" value={editForm.street_address||''} onChange={e=>setEditForm({...editForm,street_address:e.target.value})} style={{...inp,marginBottom:18}}/>

            <div style={{display:'flex',gap:20,marginBottom:20}}>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:TEXT,cursor:'pointer'}}>
                <input type="checkbox" checked={!!editForm.accepts_walkin} onChange={e=>setEditForm({...editForm,accepts_walkin:e.target.checked})} style={{width:16,height:16}}/> Walk-in customers
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:TEXT,cursor:'pointer'}}>
                <input type="checkbox" checked={!!editForm.has_delivery} onChange={e=>setEditForm({...editForm,has_delivery:e.target.checked})} style={{width:16,height:16}}/> Delivery available
              </label>
            </div>

            <button onClick={save} disabled={saving} style={{background:NAVY,color:WHITE,border:'none',borderRadius:8,padding:'12px 32px',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:DM,opacity:saving?.7:1}}>
              {saving?'Saving…':'Save Changes'}
            </button>
          </div>
        )}

        {/* ── Products & Prices tab ── */}
        {tab==='products'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:22}}>
            <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:6}}>📦 Products & Prices</div>
            <div style={{fontSize:13,color:MUTED,marginBottom:18,lineHeight:1.5}}>
              List your products or services with <strong>fixed UGX prices</strong>. These appear on your listing and feed the price comparison algorithm — customers searching for e.g. "cement near me" will see your prices ranked against other businesses.
            </div>
            <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'12px 14px',marginBottom:16}}>
              <div style={{display:'grid',gridTemplateColumns:'28px 1fr 130px 110px 86px 36px',gap:8,marginBottom:6,padding:'0 2px'}}>
                <div/>
                <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8}}>Product / Service Name</div>
                <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8}}>UGX Price</div>
                <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8}}>Unit</div>
                <div style={{fontSize:10,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.8}}>Condition</div>
                <div/>
              </div>
              {editProducts.map((p,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'28px 1fr 130px 110px 86px 36px',gap:8,marginBottom:8,alignItems:'center'}}>
                  <div style={{fontSize:12,color:MUTED,textAlign:'center',fontWeight:600}}>{i+1}</div>
                  <input
                    placeholder="e.g. Cement, Haircut, Oil change"
                    value={p.name}
                    onChange={e=>updateEditProduct(i,'name',e.target.value)}
                    style={{...inp,fontSize:13}}/>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:MUTED,pointerEvents:'none',fontWeight:600}}>UGX</span>
                    <input
                      type="number" min="0" placeholder="0"
                      value={p.price}
                      onChange={e=>updateEditProduct(i,'price',e.target.value)}
                      style={{...inp,fontSize:13,paddingLeft:40}}/>
                  </div>
                  <select value={p.unit||'per piece'} onChange={e=>updateEditProduct(i,'unit',e.target.value)}
                    style={{...inp,fontSize:12,padding:'9px 6px',cursor:'pointer'}}>
                    {UNIT_OPTIONS.map(g=>(
                      <optgroup key={g.group} label={g.group}>
                        {g.units.map(u=><option key={u} value={u}>{u}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <select value={p.condition||'new'} onChange={e=>updateEditProduct(i,'condition',e.target.value)}
                    style={{...inp,fontSize:12,padding:'9px 6px',cursor:'pointer',fontWeight:700,
                      background:CONDITION_OPTIONS.find(x=>x.value===(p.condition||'new'))?.bg||'#f0fdf4',
                      color:CONDITION_OPTIONS.find(x=>x.value===(p.condition||'new'))?.color||'#16a34a',
                      border:`1px solid ${CONDITION_OPTIONS.find(x=>x.value===(p.condition||'new'))?.border||'#bbf7d0'}`}}>
                    {CONDITION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={()=>removeEditProduct(i)} disabled={editProducts.length===1}
                    style={{width:36,height:38,background:editProducts.length===1?'#f1f5f9':'#fef2f2',border:`1px solid ${editProducts.length===1?BORDER:'#fecaca'}`,borderRadius:6,cursor:editProducts.length===1?'default':'pointer',color:editProducts.length===1?MUTED:'#dc2626',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    ×
                  </button>
                </div>
              ))}
              {editProducts.length<50&&(
                <button onClick={addEditProduct} style={{width:'100%',marginTop:4,background:'transparent',border:`1px dashed ${BORDER}`,borderRadius:6,padding:'8px',fontSize:12,color:LINK,cursor:'pointer',fontFamily:SF}}>
                  + Add another product / service
                </button>
              )}
            </div>
            <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#92400e',marginBottom:18}}>
              💡 Use your real, current selling prices. Customers can sort by cheapest — accurate prices get you more calls.
            </div>
            <button onClick={save} disabled={saving} style={{background:NAVY,color:WHITE,border:'none',borderRadius:8,padding:'12px 32px',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:DM,opacity:saving?.7:1}}>
              {saving?'Saving…':'Save Products & Prices'}
            </button>
          </div>
        )}

        {/* ── Hours & Status tab ── */}
        {tab==='hours'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:22}}>
            <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:18}}>🕐 Hours & Open Status</div>

            <div style={{fontSize:12,fontWeight:700,color:TEXT,marginBottom:8}}>Current status shown on your listing</div>
            <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
              {[['open','● Open Now','#16a34a','#f0fdf4'],['busy','● Busy','#d97706','#fffbeb'],['closed','● Closed','#dc2626','#fff1f2']].map(([v,label,color,bg])=>(
                <button key={v} onClick={()=>setPinStatus(v)}
                  style={{flex:'1 1 130px',background:pinStatus===v?bg:'#f8fafc',border:`2px solid ${pinStatus===v?color:BORDER}`,borderRadius:8,padding:'14px 10px',textAlign:'center',cursor:'pointer',fontFamily:DM}}>
                  <div style={{fontSize:14,fontWeight:700,color:pinStatus===v?color:MUTED}}>{label}</div>
                  <div style={{fontSize:11,color:MUTED,marginTop:4}}>{v==='open'?'Customers can visit now':v==='busy'?'Serving customers — slower response':'Shop is closed for now'}</div>
                </button>
              ))}
            </div>

            <div style={{fontSize:12,fontWeight:700,color:TEXT,marginBottom:8}}>Opening hours text</div>
            <input
              placeholder="e.g. Mon–Fri 8am–6pm · Sat 9am–1pm · Sun Closed"
              value={editForm.open_hours||''}
              onChange={e=>setEditForm({...editForm,open_hours:e.target.value})}
              style={{...inp,marginBottom:8}}/>
            <div style={{fontSize:11,color:MUTED,marginBottom:20}}>This text appears on your listing card and profile page exactly as you type it.</div>

            <button onClick={save} disabled={saving} style={{background:NAVY,color:WHITE,border:'none',borderRadius:8,padding:'12px 32px',fontSize:14,fontWeight:700,cursor:saving?'not-allowed':'pointer',fontFamily:DM,opacity:saving?.7:1}}>
              {saving?'Saving…':'Save Hours & Status'}
            </button>
          </div>
        )}

        {/* ── Share tab ── */}
        {tab==='share'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:22}}>
            <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:18}}>↗ Share Your Listing</div>
            <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
              <input value={profileUrl} readOnly style={{...inp,flex:1,background:'transparent',border:'none',fontSize:13,color:LINK,cursor:'text'}}/>
              <button onClick={()=>navigator.clipboard?.writeText(profileUrl).then(()=>setSaveMsg('Link copied!'))} style={{background:NAVY,color:WHITE,border:'none',borderRadius:6,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:DM,flexShrink:0}}>Copy</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:20}}>
              {[
                {icon:'💬',label:'Share on WhatsApp',action:()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${activeBiz?.business_name} on 256 Mall: ${profileUrl}`)}`)},
                {icon:'📘',label:'Share on Facebook',action:()=>window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`)},
                {icon:'🐦',label:'Share on Twitter/X',action:()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${activeBiz?.business_name} — ${activeBiz?.category} in ${activeBiz?.district}`)}&url=${encodeURIComponent(profileUrl)}`)},
                {icon:'📱',label:'Native Share',action:()=>{try{navigator.share?.({title:activeBiz?.business_name,url:profileUrl});}catch(e){}}},
              ].map(({icon,label,action})=>(
                <button key={label} onClick={action}
                  style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'14px 10px',textAlign:'center',cursor:'pointer',fontFamily:DM}}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0f4ff'}
                  onMouseLeave={e=>e.currentTarget.style.background='#f8fafc'}>
                  <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                  <div style={{fontSize:12,fontWeight:600,color:TEXT}}>{label}</div>
                </button>
              ))}
            </div>
            <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'14px 16px'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#92400e',marginBottom:6}}>💡 Tips to get more customers</div>
              <ul style={{fontSize:13,color:'#78350f',margin:0,paddingLeft:20,lineHeight:1.8}}>
                <li>Share your listing link in your WhatsApp groups and status</li>
                <li>Print the URL on your receipts and packaging</li>
                <li>Ask satisfied customers to call from the listing (tracks your popularity)</li>
                <li>Keep your prices updated — customers sort by cheapest</li>
                <li>Add all your products so customers can compare you against competitors</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Farmer Join Page ──────────────────────────────────────────────────────────
function FarmerJoinPage(){
  const nav=useNavigate();
  const [form,setForm,clearFarmerForm]=usePersistedForm('farmer-join',{name:'',phone:'',nin:'',district:'Kampala',sub_county:'',village:'',farm_name:'',farm_size_acres:'',farmer_type:'smallholder',is_organic:false,is_cooperative:false,cooperative_name:'',password:''});
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState('');
  const inp={width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'9px 12px',fontSize:14,fontFamily:SF,marginBottom:10,outline:'none',boxSizing:'border-box',color:TEXT};
  const DISTRICTS=['Kampala','Wakiso','Mukono','Jinja','Mbarara','Gulu','Lira','Mbale','Kabale','Masaka','Soroti','Arua','Hoima','Fort Portal','Kasese','Bushenyi','Ibanda','Kiruhura','Kamuli','Iganga'];

  const submit=async()=>{
    if(!form.name||!form.phone||!form.password){setError('Name, phone and password are required.');return;}
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/farmers/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Registration failed.');return;}
      clearFarmerForm();
      setSuccess(true);
    }catch(e){setError('Connection error.');}finally{setLoading(false);}
  };

  if(success)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}>
      <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:'48px',textAlign:'center',maxWidth:480}}>
        <div style={{fontSize:64,marginBottom:14}}>🌾</div>
        <h2 style={{fontSize:22,fontWeight:700,color:TEXT,marginBottom:8}}>Welcome to 256 Fresh Market!</h2>
        <p style={{color:MUTED,marginBottom:20}}>Your farmer account has been created. You can now list your produce and reach buyers across Uganda.</p>
        <button onClick={()=>nav('/produce')} style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:4,padding:'11px 24px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Go to Fresh Market →</button>
      </div>
    </div>
  );

  return(
    <div style={{background:LIGHT,minHeight:'100vh',padding:'32px 16px',fontFamily:DM}}>
      <div style={{maxWidth:680,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <h1 style={{fontSize:28,fontWeight:700,color:TEXT,margin:'0 0 8px'}}>🌾 Join as a Farmer</h1>
          <p style={{fontSize:14,color:MUTED}}>List your produce and sell to retail buyers, wholesalers and exporters across Uganda</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
          {[['🆓','Free to list','No commission fees'],['📱','MoMo payments','Get paid directly'],['🌍','All tiers','Retail, wholesale, export']].map(([ic,t,d])=>(
            <div key={t} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:'16px 12px',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:6}}>{ic}</div>
              <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:3}}>{t}</div>
              <div style={{fontSize:11,color:MUTED}}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:28}}>
          <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 16px',paddingBottom:12,borderBottom:`1px solid ${BORDER}`}}>Personal Details</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:0}}>
            <input placeholder="Full name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{...inp,marginBottom:0}}/>
            <input placeholder="Phone number *" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={{...inp,marginBottom:0}}/>
          </div>
          <div style={{height:10}}/>
          <input placeholder="NIN (National ID number)" value={form.nin} onChange={e=>setForm({...form,nin:e.target.value})} style={inp}/>

          <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'8px 0 16px',paddingBottom:12,borderBottom:`1px solid ${BORDER}`}}>Farm Location</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <select value={form.district} onChange={e=>setForm({...form,district:e.target.value})} style={{...inp,marginBottom:0}}>
              {DISTRICTS.map(d=><option key={d}>{d}</option>)}
            </select>
            <input placeholder="Sub-county" value={form.sub_county} onChange={e=>setForm({...form,sub_county:e.target.value})} style={{...inp,marginBottom:0}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <input placeholder="Village" value={form.village} onChange={e=>setForm({...form,village:e.target.value})} style={{...inp,marginBottom:0}}/>
            <input placeholder="Farm name (optional)" value={form.farm_name} onChange={e=>setForm({...form,farm_name:e.target.value})} style={{...inp,marginBottom:0}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <input type="number" placeholder="Farm size (acres)" value={form.farm_size_acres} onChange={e=>setForm({...form,farm_size_acres:e.target.value})} style={{...inp,marginBottom:0}}/>
            <select value={form.farmer_type} onChange={e=>setForm({...form,farmer_type:e.target.value})} style={{...inp,marginBottom:0}}>
              <option value="smallholder">Smallholder farmer</option>
              <option value="commercial">Commercial farmer</option>
              <option value="cooperative">Cooperative member</option>
              <option value="exporter">Exporter</option>
            </select>
          </div>
          <div style={{display:'flex',gap:20,marginBottom:14}}>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,color:TEXT,cursor:'pointer'}}>
              <input type="checkbox" checked={form.is_organic} onChange={e=>setForm({...form,is_organic:e.target.checked})} style={{width:16,height:16}}/> 🌿 Organic farm
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:14,color:TEXT,cursor:'pointer'}}>
              <input type="checkbox" checked={form.is_cooperative} onChange={e=>setForm({...form,is_cooperative:e.target.checked})} style={{width:16,height:16}}/> 🤝 Part of a cooperative
            </label>
          </div>
          {form.is_cooperative&&<input placeholder="Cooperative name" value={form.cooperative_name} onChange={e=>setForm({...form,cooperative_name:e.target.value})} style={inp}/>}

          <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'8px 0 16px',paddingBottom:12,borderBottom:`1px solid ${BORDER}`}}>Account Password</h3>
          <input type="password" placeholder="Create a password *" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={inp}/>

          {error&&<div style={{color:RED,fontSize:13,marginBottom:10,padding:'8px 12px',background:'#fff0f0',borderRadius:4}}>{error}</div>}
          <button onClick={submit} disabled={loading}
            style={{width:'100%',background:loading?'#ccc':'#16a34a',color:WHITE,border:'none',borderRadius:4,padding:'13px',fontSize:15,fontWeight:700,cursor:loading?'default':'pointer',fontFamily:DM}}>
            {loading?'Creating account...':'Join 256 Fresh Market →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Animal Market Page ────────────────────────────────────────────────────────
const ANIMAL_TYPES=[
  {key:'',label:'All Animals',icon:'🐾'},
  {key:'cattle',label:'Cattle',icon:'🐄'},
  {key:'goat',label:'Goats',icon:'🐐'},
  {key:'sheep',label:'Sheep',icon:'🐑'},
  {key:'pig',label:'Pigs',icon:'🐷'},
  {key:'chicken',label:'Poultry',icon:'🐔'},
  {key:'duck',label:'Ducks',icon:'🦆'},
  {key:'turkey',label:'Turkeys',icon:'🦃'},
  {key:'rabbit',label:'Rabbits',icon:'🐇'},
];

// ── Real Estate ───────────────────────────────────────────────────────────────
const RE_TYPES=[
  {key:'',label:'All Listings',icon:'🏘️'},
  {key:'house-sale',label:'For Sale',icon:'🏠'},
  {key:'house-rent',label:'For Rent',icon:'🔑'},
  {key:'land-sale',label:'Land for Sale',icon:'📐'},
  {key:'farmland',label:'Farm Land',icon:'🌾'},
  {key:'land-lease',label:'Land for Lease',icon:'🤝'},
];

const RE_DISTRICTS=['','Kampala','Wakiso','Mukono','Jinja','Mbarara','Luwero','Masaka','Kiruhura','Mbale','Kabale','Gulu','Nakasongola','Soroti','Arua','Fort Portal'];

// ── Animal Seller Registration ────────────────────────────────────────────────
const ANIMAL_SELL_TYPES=[
  {v:'cattle',icon:'🐄',label:'Cattle',desc:'Bulls, heifers, dairy cows'},
  {v:'goats',icon:'🐐',label:'Goats',desc:'Mubende, Kigezi, Boer'},
  {v:'pigs',icon:'🐖',label:'Pigs',desc:'Piggery & commercial pork'},
  {v:'poultry',icon:'🐓',label:'Poultry',desc:'Broilers, layers, local chicken'},
  {v:'sheep',icon:'🐑',label:'Sheep',desc:'Meat & wool breeds'},
  {v:'ducks',icon:'🦆',label:'Ducks & Geese',desc:'Muscovy, Pekin, Geese'},
  {v:'rabbits',icon:'🐇',label:'Rabbits',desc:'Breeding & market pairs'},
  {v:'turkey',icon:'🦃',label:'Turkeys',desc:'Broad-breasted & heritage'},
];

function AnimalSellerRegPage(){
  const nav=useNavigate();
  const [step,setStep,clearAnimalStep]=usePersistedValue('animal-reg-step',1);
  const [animals,setAnimals,clearAnimals]=usePersistedValue('animal-reg-animals',[]);
  const [form,setForm,clearAnimalForm]=usePersistedForm('animal-reg',{name:'',phone:'',nin:'',district:'',sub_county:'',village:'',farm_name:'',farm_size_acres:'',farmer_type:'livestock',is_cooperative:false,cooperative_name:'',password:'',delivery_allowed:true,walkin_allowed:true,health_cert:false,vaccination:false,movement_permit:false,whatsapp:''});
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const inp={width:'100%',border:`1px solid ${BORDER}`,borderRadius:6,padding:'11px 14px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:TEXT,background:WHITE};

  const toggleAnimal=v=>setAnimals(a=>a.includes(v)?a.filter(x=>x!==v):[...a,v]);
  const canNext1=animals.length>0;
  const canNext2=form.name.trim()&&form.phone.trim()&&form.district;
  const canNext3=form.health_cert&&form.vaccination;
  const canSubmit=form.password.length>=6;

  const submit=async()=>{
    setLoading(true);setError('');
    const desc=`Animals: ${animals.join(', ')}. ${form.cooperative_name?'Cooperative: '+form.cooperative_name+'. ':''}`;
    try{
      const r=await fetch('/api/farmers/register',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,farmer_type:'livestock',farm_name:form.farm_name||`${form.name}'s Farm`,description:desc})});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Registration failed');return;}
      // Auto-login to get token
      try{
        const lr=await fetch('/api/farmers/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:form.phone,password:form.password})});
        const ld=await lr.json();
        if(ld.token) localStorage.setItem('256mall_farmer_token',ld.token);
      }catch(_){}
      clearAnimalStep();clearAnimals();clearAnimalForm();
      setSuccess(true);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const STEP_LABELS=['Animal Types','Farm & Identity','Compliance','Account'];

  if(success)return(
    <div style={{background:'#1a0a00',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:'#2a1800',border:'1px solid #f59e0b',borderRadius:12,padding:'48px 40px',textAlign:'center',maxWidth:480,width:'100%'}}>
        <div style={{fontSize:60,marginBottom:16}}>🐄</div>
        <h2 style={{fontSize:24,fontWeight:700,color:WHITE,marginBottom:8}}>Animal Market Profile Created!</h2>
        <p style={{fontSize:14,color:'#f59e0b',marginBottom:8,lineHeight:1.65}}>Welcome to 256 Animal Market, <strong>{form.name}</strong>.</p>
        <p style={{fontSize:14,color:'#d4a96a',marginBottom:28,lineHeight:1.65}}>Our compliance team will verify your health certificates and vaccination records within 24 hours. Once approved, you can start listing animals.</p>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>nav('/animals/dashboard')} style={{background:'#f59e0b',color:'#1a0a00',border:'none',borderRadius:6,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Go to Your Dashboard →</button>
          <button onClick={()=>nav('/animals')} style={{background:'transparent',color:'#d4a96a',border:'1px solid rgba(245,158,11,.3)',borderRadius:6,padding:'12px 24px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Browse Animal Market</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{background:'#1a0a00',minHeight:'100vh',padding:'28px 16px 60px',fontFamily:DM}}>
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:13,color:'#f59e0b',marginBottom:4,letterSpacing:.5}}>256 ANIMAL MARKET · SELLER REGISTRATION</div>
          <h1 style={{fontSize:26,fontWeight:700,color:WHITE,margin:0}}>List Your Animals</h1>
          <p style={{fontSize:13,color:'#d4a96a',marginTop:6}}>GPS-verified farms · Compliance checked · Reach buyers in all 146 districts</p>
        </div>

        {/* Step indicator */}
        <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
          {STEP_LABELS.map((label,i)=>{
            const n=i+1;const done=step>n;const active=step===n;
            return(
              <React.Fragment key={n}>
                <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:0}}>
                  <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0,
                    background:done?'#16a34a':active?'#f59e0b':'rgba(255,255,255,.15)',color:done||active?'#1a0a00':WHITE}}>
                    {done?'✓':n}
                  </div>
                  <div style={{fontSize:11,fontWeight:active?700:400,color:active?'#f59e0b':'#d4a96a',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</div>
                </div>
                {i<3&&<div style={{width:16,height:2,background:step>n?'#16a34a':'rgba(255,255,255,.15)',margin:'0 4px',flexShrink:0}}/>}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{background:'#2a1800',border:'1px solid rgba(245,158,11,.3)',borderRadius:10,padding:28}}>

          {step===1&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>What animals do you sell?</h3>
              <p style={{fontSize:13,color:'#d4a96a',margin:'0 0 18px'}}>Select all that apply. You can add listings for each type after registration.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {ANIMAL_SELL_TYPES.map(({v,icon,label,desc})=>{
                  const sel=animals.includes(v);
                  return(
                    <button key={v} onClick={()=>toggleAnimal(v)}
                      style={{display:'flex',alignItems:'center',gap:10,background:sel?'rgba(245,158,11,.15)':'rgba(255,255,255,.05)',
                        border:`2px solid ${sel?'#f59e0b':'rgba(255,255,255,.15)'}`,borderRadius:8,padding:'12px 14px',cursor:'pointer',textAlign:'left',fontFamily:DM}}>
                      <span style={{fontSize:24,flexShrink:0}}>{icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:2}}>{label}</div>
                        <div style={{fontSize:11,color:'#d4a96a'}}>{desc}</div>
                      </div>
                      {sel&&<div style={{marginLeft:'auto',color:'#f59e0b',fontSize:16,flexShrink:0}}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step===2&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>Farm &amp; Personal Details</h3>
              <p style={{fontSize:13,color:'#d4a96a',margin:'0 0 18px'}}>This information will be displayed on your seller profile.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Full Name *</label>
                    <input placeholder="Tumwesigye Robert" value={form.name} onChange={e=>f('name',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Phone Number *</label>
                    <input placeholder="07XX XXX XXX" value={form.phone} onChange={e=>f('phone',e.target.value)} style={inp}/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>National ID (NIN)</label>
                    <input placeholder="CM..." value={form.nin} onChange={e=>f('nin',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>WhatsApp Number</label>
                    <input placeholder="07XX XXX XXX" value={form.whatsapp} onChange={e=>f('whatsapp',e.target.value)} style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Farm / Ranch Name</label>
                  <input placeholder="e.g. Tumwesigye Livestock Farm" value={form.farm_name} onChange={e=>f('farm_name',e.target.value)} style={inp}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>District *</label>
                    <select value={form.district} onChange={e=>f('district',e.target.value)}
                      style={{...inp,appearance:'none',cursor:'pointer'}}>
                      <option value="">Select</option>
                      {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Sub-county</label>
                    <input placeholder="Sub-county" value={form.sub_county} onChange={e=>f('sub_county',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Village</label>
                    <input placeholder="Village" value={form.village} onChange={e=>f('village',e.target.value)} style={inp}/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Farm Size (acres)</label>
                    <input type="number" placeholder="e.g. 50" value={form.farm_size_acres} onChange={e=>f('farm_size_acres',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Seller Type</label>
                    <select value={form.farmer_type} onChange={e=>f('farmer_type',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                      <option value="livestock">Livestock Farmer</option>
                      <option value="commercial">Commercial Ranch</option>
                      <option value="cooperative">Cooperative / Group</option>
                    </select>
                  </div>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:'#d4a96a',cursor:'pointer',marginTop:4}}>
                  <input type="checkbox" checked={form.is_cooperative} onChange={e=>f('is_cooperative',e.target.checked)} style={{width:16,height:16,accentColor:'#f59e0b'}}/>
                  🤝 Part of a farmer cooperative or group
                </label>
                {form.is_cooperative&&<input placeholder="Cooperative name" value={form.cooperative_name} onChange={e=>f('cooperative_name',e.target.value)} style={inp}/>}
              </div>
            </div>
          )}

          {step===3&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>Compliance Declaration</h3>
              <p style={{fontSize:13,color:'#d4a96a',margin:'0 0 18px'}}>Required under the Uganda Livestock Act Cap 29. All sellers must confirm compliance before going live.</p>
              <div style={{background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.3)',borderRadius:8,padding:'16px',marginBottom:16}}>
                <div style={{fontSize:12,color:'#f59e0b',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>⚠️ Legal Requirements</div>
                {[
                  {k:'health_cert',label:'I have valid animal health certificates from a licensed government veterinarian',required:true},
                  {k:'vaccination',label:'Vaccination records are up to date (FMD, Brucellosis, CBPP for cattle; PPR for goats; ASF-free cert for pigs)',required:true},
                  {k:'movement_permit',label:'I hold or will obtain DVO movement permits before any inter-district sale',required:false},
                ].map(({k,label,required})=>(
                  <label key={k} style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14,cursor:'pointer'}}>
                    <input type="checkbox" checked={form[k]} onChange={e=>f(k,e.target.checked)}
                      style={{width:18,height:18,marginTop:1,accentColor:'#f59e0b',flexShrink:0}}/>
                    <div style={{fontSize:13,color:form[k]?WHITE:'#d4a96a',lineHeight:1.5}}>
                      {label}{required&&<span style={{color:'#ef4444',marginLeft:4}}>*</span>}
                    </div>
                  </label>
                ))}
              </div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                {[['🚚','Delivery allowed','delivery_allowed'],['🚶','Walk-in buyers allowed','walkin_allowed']].map(([ic,lb,kk])=>(
                  <label key={kk} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#d4a96a',cursor:'pointer',
                    background:form[kk]?'rgba(245,158,11,.15)':'rgba(255,255,255,.05)',border:`1px solid ${form[kk]?'#f59e0b':'rgba(255,255,255,.15)'}`,
                    borderRadius:6,padding:'8px 14px'}}>
                    <input type="checkbox" checked={form[kk]} onChange={e=>f(kk,e.target.checked)} style={{accentColor:'#f59e0b'}}/>
                    {ic} {lb}
                  </label>
                ))}
              </div>
              {!canNext3&&<div style={{fontSize:12,color:'#f87171',marginTop:12}}>⚠️ You must confirm the first two compliance points to continue.</div>}
            </div>
          )}

          {step===4&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>Create Your Account</h3>
              <p style={{fontSize:13,color:'#d4a96a',margin:'0 0 18px'}}>Set a password to access your seller dashboard and manage listings.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#f59e0b',display:'block',marginBottom:4}}>Password *</label>
                  <input type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e=>f('password',e.target.value)} style={inp}/>
                </div>
                <div style={{background:'rgba(255,255,255,.05)',borderRadius:8,padding:'14px 16px',marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#f59e0b',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Registration Summary</div>
                  {[
                    ['Animals',animals.join(', ')||'—'],
                    ['Name',form.name||'—'],
                    ['Phone',form.phone||'—'],
                    ['District',form.district||'—'],
                    ['Farm',form.farm_name||'—'],
                  ].map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}>
                      <span style={{color:'#d4a96a'}}>{k}</span>
                      <span style={{color:WHITE,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {error&&<div style={{color:'#f87171',fontSize:13,marginTop:12,padding:'9px 12px',background:'rgba(239,68,68,.1)',borderRadius:6,border:'1px solid rgba(239,68,68,.3)'}}>{error}</div>}
            </div>
          )}

          {/* Navigation */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:24,paddingTop:20,borderTop:'1px solid rgba(245,158,11,.2)'}}>
            {step>1
              ?<button onClick={()=>{setError('');setStep(s=>s-1);}} style={{background:'rgba(255,255,255,.08)',color:WHITE,border:'1px solid rgba(255,255,255,.2)',borderRadius:6,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:DM}}>← Back</button>
              :<button onClick={()=>nav('/animals')} style={{background:'transparent',color:'#d4a96a',border:'none',padding:'10px 0',fontSize:13,cursor:'pointer',fontFamily:DM}}>← Back to Animal Market</button>
            }
            {step<4
              ?<button onClick={()=>{
                  if(step===1&&!canNext1){setError('Select at least one animal type');return;}
                  if(step===2&&!canNext2){setError('Name, phone and district are required');return;}
                  if(step===3&&!canNext3){setError('You must confirm the compliance requirements');return;}
                  setError('');setStep(s=>s+1);
                }}
                style={{background:'#f59e0b',color:'#1a0a00',border:'none',borderRadius:6,padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
                Continue →
              </button>
              :<button onClick={submit} disabled={loading||!canSubmit}
                style={{background:canSubmit?'#f59e0b':'rgba(255,255,255,.15)',color:canSubmit?'#1a0a00':'#999',border:'none',borderRadius:6,padding:'10px 28px',fontSize:14,fontWeight:700,cursor:canSubmit?'pointer':'not-allowed',fontFamily:DM}}>
                {loading?'Registering…':'Register as Animal Seller →'}
              </button>
            }
          </div>
          {error&&step<4&&<div style={{color:'#f87171',fontSize:13,marginTop:10,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>{error}</div>}
        </div>
        <p style={{textAlign:'center',fontSize:12,color:'#d4a96a',marginTop:14}}>
          By registering you agree to comply with the Uganda Livestock Act Cap 29 and 256 Mall Seller Terms.
        </p>
      </div>
    </div>
  );
}

// ── Export Hub Registration ───────────────────────────────────────────────────
const EXPORT_COMMODITIES=[
  {v:'coffee',icon:'☕',label:'Coffee',desc:'Arabica, Robusta'},
  {v:'vanilla',icon:'🌿',label:'Vanilla',desc:'Whole pods, extract'},
  {v:'cocoa',icon:'🍫',label:'Cocoa',desc:'Beans, butter, powder'},
  {v:'simsim',icon:'🌾',label:'Simsim / Sesame',desc:'Hulled, natural'},
  {v:'tea',icon:'🍵',label:'Tea',desc:'Black, green'},
  {v:'maize',icon:'🌽',label:'Maize / Corn',desc:'White, yellow, flour'},
  {v:'beans',icon:'🫘',label:'Beans & Pulses',desc:'Soya, kidney, mung'},
  {v:'fish',icon:'🐟',label:'Fish',desc:'Nile perch, tilapia'},
  {v:'cotton',icon:'💐',label:'Cotton',desc:'Lint, seeds'},
  {v:'herbs',icon:'🌱',label:'Herbs & Spices',desc:'Chili, ginger, turmeric'},
  {v:'fruits',icon:'🍍',label:'Fruits',desc:'Pineapple, passion fruit'},
  {v:'hides',icon:'🐄',label:'Hides & Skins',desc:'Cattle, goat hides'},
];
const EXPORT_CERTS=['UCDA Certified','ISO 9001','Rainforest Alliance','Fairtrade','Organic (NOGAMU)','HACCP','SGS Tested','UNBS Certified'];
const EXPORT_PORTS=['Mombasa, Kenya','Dar es Salaam, Tanzania','Entebbe Airport (Air Freight)','Malaba Border Post','Busia Border Post'];

function ExportRegPage(){
  const nav=useNavigate();
  const [step,setStep,clearExpStep]=usePersistedValue('export-reg-step',1);
  const [commodities,setCommodities,clearExpCom]=usePersistedValue('export-reg-commodities',[]);
  const [certs,setCerts,clearExpCerts]=usePersistedValue('export-reg-certs',[]);
  const [form,setForm,clearExpForm]=usePersistedForm('export-reg',{shopName:'',description:'',district:'',address:'',businessTin:'',exportLicense:'',preferredPort:'Mombasa, Kenya',annualVolume:'',paymentTerms:'',phone:'',email:'',mtnMomo:'',airtelMoney:'',whatsapp:''});
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const inp={width:'100%',border:'1px solid #334155',borderRadius:6,padding:'11px 14px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:WHITE,background:'#1e293b'};

  const toggleCom=v=>setCommodities(a=>a.includes(v)?a.filter(x=>x!==v):[...a,v]);
  const toggleCert=v=>setCerts(a=>a.includes(v)?a.filter(x=>x!==v):[...a,v]);
  const canNext1=commodities.length>0;
  const canNext2=form.shopName.trim()&&form.district;
  const canSubmit=form.phone.trim()&&(form.email.trim()||form.whatsapp.trim());

  const submit=async()=>{
    setLoading(true);setError('');
    const desc=`Export commodities: ${commodities.join(', ')}. Annual volume: ${form.annualVolume||'N/A'} tonnes. Preferred port: ${form.preferredPort}. Payment: ${form.paymentTerms||'N/A'}.`;
    try{
      const r=await fetch('/api/sellers/register',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,sellerType:'exporter',description:desc,certifications:certs,mtnMomo:form.mtnMomo,airtelMoney:form.airtelMoney})});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Registration failed');return;}
      clearExpStep();clearExpCom();clearExpCerts();clearExpForm();
      setSuccess(true);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const STEP_LABELS=['Commodities','Company Details','Capacity & Certs','Contact'];

  if(success)return(
    <div style={{background:'#0f172a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:'#1e293b',border:'1px solid #3b82f6',borderRadius:12,padding:'48px 40px',textAlign:'center',maxWidth:480,width:'100%'}}>
        <div style={{fontSize:60,marginBottom:16}}>✈️</div>
        <h2 style={{fontSize:24,fontWeight:700,color:WHITE,marginBottom:8}}>Export Profile Created!</h2>
        <p style={{fontSize:14,color:'#93c5fd',marginBottom:8,lineHeight:1.65}}>Welcome to 256 Export Hub, <strong>{form.shopName}</strong>.</p>
        <p style={{fontSize:14,color:'#94a3b8',marginBottom:28,lineHeight:1.65}}>Our export team will verify your company details and certifications within 48 hours. You'll be able to list commodities with live FOB pricing once approved.</p>
        <div style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.25)',borderRadius:8,padding:'14px 18px',marginBottom:24,textAlign:'left'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#60a5fa',marginBottom:6}}>📋 NEXT STEPS</div>
          <div style={{fontSize:13,color:'#94a3b8',lineHeight:1.7}}>
            1. Our team contacts you within 48 hours via <strong style={{color:WHITE}}>{form.phone}</strong><br/>
            2. Submit export licenses and UCDA/certifications if required<br/>
            3. Once approved, log in to list your commodities with FOB pricing
          </div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>nav('/export')} style={{background:'#3b82f6',color:WHITE,border:'none',borderRadius:6,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Browse Export Hub →</button>
          {form.whatsapp&&<a href={`https://wa.me/${form.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:6,padding:'12px 24px',fontSize:14,fontWeight:700,cursor:'pointer',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>💬 WhatsApp Us</a>}
        </div>
      </div>
    </div>
  );

  return(
    <div style={{background:'#0f172a',minHeight:'100vh',padding:'28px 16px 60px',fontFamily:DM}}>
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:13,color:'#60a5fa',marginBottom:4,letterSpacing:.5}}>256 EXPORT HUB · EXPORTER REGISTRATION</div>
          <h1 style={{fontSize:26,fontWeight:700,color:WHITE,margin:0}}>Register as an Exporter</h1>
          <p style={{fontSize:13,color:'#94a3b8',marginTop:6}}>Reach buyers in 50+ countries · Live USD/EUR pricing · FOB Mombasa &amp; Entebbe</p>
        </div>

        {/* Step indicator */}
        <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
          {STEP_LABELS.map((label,i)=>{
            const n=i+1;const done=step>n;const active=step===n;
            return(
              <React.Fragment key={n}>
                <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:0}}>
                  <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0,
                    background:done?'#16a34a':active?'#3b82f6':'rgba(255,255,255,.1)',color:done||active?WHITE:'#64748b'}}>
                    {done?'✓':n}
                  </div>
                  <div style={{fontSize:11,fontWeight:active?700:400,color:active?'#60a5fa':'#64748b',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</div>
                </div>
                {i<3&&<div style={{width:16,height:2,background:step>n?'#16a34a':'rgba(255,255,255,.1)',margin:'0 4px',flexShrink:0}}/>}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{background:'#1e293b',border:'1px solid #334155',borderRadius:10,padding:28}}>

          {step===1&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>What do you export?</h3>
              <p style={{fontSize:13,color:'#94a3b8',margin:'0 0 18px'}}>Select all commodities you supply. You can add individual listings with pricing after registration.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {EXPORT_COMMODITIES.map(({v,icon,label,desc})=>{
                  const sel=commodities.includes(v);
                  return(
                    <button key={v} onClick={()=>toggleCom(v)}
                      style={{display:'flex',alignItems:'center',gap:10,background:sel?'rgba(59,130,246,.15)':'rgba(255,255,255,.03)',
                        border:`2px solid ${sel?'#3b82f6':'#334155'}`,borderRadius:8,padding:'10px 12px',cursor:'pointer',textAlign:'left',fontFamily:DM}}>
                      <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:WHITE,marginBottom:1}}>{label}</div>
                        <div style={{fontSize:11,color:'#94a3b8'}}>{desc}</div>
                      </div>
                      {sel&&<div style={{marginLeft:'auto',color:'#3b82f6',fontSize:16,flexShrink:0}}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step===2&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>Company Details</h3>
              <p style={{fontSize:13,color:'#94a3b8',margin:'0 0 18px'}}>Your company profile visible to international buyers.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Company / Business Name *</label>
                  <input placeholder="e.g. Masaka Coffee Cooperative Ltd" value={form.shopName} onChange={e=>f('shopName',e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Company Description</label>
                  <textarea placeholder="Brief description of your company, sourcing region, and supply capacity..." rows={3} value={form.description} onChange={e=>f('description',e.target.value)} style={{...inp,resize:'vertical'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>District / Region *</label>
                    <select value={form.district} onChange={e=>f('district',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                      <option value="">Select district</option>
                      {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Office / Warehouse Address</label>
                    <input placeholder="Plot 14, Nakivubo Road..." value={form.address} onChange={e=>f('address',e.target.value)} style={inp}/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>URA Tax ID (TIN)</label>
                    <input placeholder="1000XXXXXX" value={form.businessTin} onChange={e=>f('businessTin',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Export License No.</label>
                    <input placeholder="UCDA / UEPB license" value={form.exportLicense} onChange={e=>f('exportLicense',e.target.value)} style={inp}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step===3&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>Capacity &amp; Certifications</h3>
              <p style={{fontSize:13,color:'#94a3b8',margin:'0 0 18px'}}>Help buyers understand your scale and quality standards.</p>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Annual Export Volume (tonnes)</label>
                    <input type="number" placeholder="e.g. 500" value={form.annualVolume} onChange={e=>f('annualVolume',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Preferred Export Port</label>
                    <select value={form.preferredPort} onChange={e=>f('preferredPort',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                      {EXPORT_PORTS.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Preferred Payment Terms</label>
                  <select value={form.paymentTerms} onChange={e=>f('paymentTerms',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                    <option value="">Select payment terms</option>
                    <option value="LC at sight">LC at Sight (Letter of Credit)</option>
                    <option value="30% advance, 70% BL">30% advance, 70% against Bill of Lading</option>
                    <option value="50% advance, 50% shipment">50% advance, 50% on shipment</option>
                    <option value="100% advance">100% Advance Payment</option>
                    <option value="Negotiable">Negotiable</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:8}}>Certifications Held <span style={{color:'#64748b',fontWeight:400}}>(select all that apply)</span></label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {EXPORT_CERTS.map(c=>{
                      const sel=certs.includes(c);
                      return(
                        <button key={c} onClick={()=>toggleCert(c)}
                          style={{background:sel?'rgba(59,130,246,.2)':'rgba(255,255,255,.05)',border:`1px solid ${sel?'#3b82f6':'#334155'}`,
                            borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:sel?700:400,color:sel?'#93c5fd':WHITE,cursor:'pointer',fontFamily:DM}}>
                          {sel?'✓ ':''}{c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step===4&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:WHITE,margin:'0 0 6px'}}>Contact Details</h3>
              <p style={{fontSize:13,color:'#94a3b8',margin:'0 0 18px'}}>How international buyers and our team will reach you.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Phone Number *</label>
                    <input placeholder="07XX / +256..." value={form.phone} onChange={e=>f('phone',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Email Address *</label>
                    <input type="email" placeholder="company@example.com" value={form.email} onChange={e=>f('email',e.target.value)} style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>WhatsApp for Buyer Inquiries</label>
                  <input placeholder="+256 7XX XXX XXX" value={form.whatsapp} onChange={e=>f('whatsapp',e.target.value)} style={inp}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>MTN MoMo (local payments)</label>
                    <input placeholder="077 / 078 XXXXXXX" value={form.mtnMomo} onChange={e=>f('mtnMomo',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'#60a5fa',display:'block',marginBottom:4}}>Airtel Money</label>
                    <input placeholder="070 / 075 XXXXXXX" value={form.airtelMoney} onChange={e=>f('airtelMoney',e.target.value)} style={inp}/>
                  </div>
                </div>
                {/* Summary */}
                <div style={{background:'rgba(255,255,255,.04)',borderRadius:8,padding:'14px 16px',marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#60a5fa',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Review</div>
                  {[
                    ['Company',form.shopName||'—'],
                    ['Commodities',commodities.join(', ')||'—'],
                    ['District',form.district||'—'],
                    ['Port',form.preferredPort||'—'],
                    ['Certifications',certs.length?certs.join(', '):'None selected'],
                  ].map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}>
                      <span style={{color:'#64748b'}}>{k}</span>
                      <span style={{color:WHITE,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {error&&<div style={{color:'#f87171',fontSize:13,marginTop:12,padding:'9px 12px',background:'rgba(239,68,68,.1)',borderRadius:6,border:'1px solid rgba(239,68,68,.3)'}}>{error}</div>}
            </div>
          )}

          {/* Navigation */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:24,paddingTop:20,borderTop:'1px solid #334155'}}>
            {step>1
              ?<button onClick={()=>{setError('');setStep(s=>s-1);}} style={{background:'rgba(255,255,255,.05)',color:WHITE,border:'1px solid #334155',borderRadius:6,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:DM}}>← Back</button>
              :<button onClick={()=>nav('/export')} style={{background:'transparent',color:'#64748b',border:'none',padding:'10px 0',fontSize:13,cursor:'pointer',fontFamily:DM}}>← Back to Export Hub</button>
            }
            {step<4
              ?<button onClick={()=>{
                  if(step===1&&!canNext1){setError('Select at least one commodity');return;}
                  if(step===2&&!canNext2){setError('Company name and district are required');return;}
                  setError('');setStep(s=>s+1);
                }}
                style={{background:'#3b82f6',color:WHITE,border:'none',borderRadius:6,padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
                Continue →
              </button>
              :<button onClick={submit} disabled={loading||!canSubmit}
                style={{background:canSubmit?'#3b82f6':'rgba(255,255,255,.1)',color:canSubmit?WHITE:'#64748b',border:'none',borderRadius:6,padding:'10px 28px',fontSize:14,fontWeight:700,cursor:canSubmit?'pointer':'not-allowed',fontFamily:DM}}>
                {loading?'Registering…':'Register as Exporter →'}
              </button>
            }
          </div>
          {error&&step<4&&<div style={{color:'#f87171',fontSize:13,marginTop:10,padding:'8px 12px',background:'rgba(239,68,68,.1)',borderRadius:6}}>{error}</div>}
        </div>
        <p style={{textAlign:'center',fontSize:12,color:'#475569',marginTop:14}}>
          By registering you agree to 256 Mall Export Terms. All exporter details are verified against UCDA / UEPB records.
        </p>
      </div>
    </div>
  );
}

// ── Real Estate Listing Registration ─────────────────────────────────────────
const RE_LISTING_TYPES=[
  {v:'house-sale',icon:'🏠',label:'House for Sale',desc:'Residential property — sell'},
  {v:'house-rent',icon:'🔑',label:'House / Apartment for Rent',desc:'Residential rental'},
  {v:'land-sale',icon:'📐',label:'Land for Sale',desc:'Plot, acre, or large parcel'},
  {v:'farmland',icon:'🌾',label:'Farm Land',desc:'Agricultural land for farming'},
  {v:'land-lease',icon:'📋',label:'Land Lease',desc:'Long-term lease arrangement'},
  {v:'commercial',icon:'🏢',label:'Commercial Property',desc:'Office, shop, warehouse'},
];
const RE_AMENITIES=['Electricity (UMEME)','Borehole / Water','Security Wall','Tarmac Road Access','Title Deed','Mailo Land','Leasehold Title','Near Schools','Near Hospital','Parking','Backup Generator','Borehole'];
const RE_LISTER_TYPES=[
  {v:'owner',icon:'👤',label:'Property Owner',desc:'You own and are selling / renting directly'},
  {v:'agent',icon:'🧑‍💼',label:'Real Estate Agent',desc:'Licensed agent representing a client'},
  {v:'developer',icon:'🏗️',label:'Property Developer',desc:'Newly built or under-construction properties'},
];

function RealEstateListPage(){
  const nav=useNavigate();
  const [step,setStep,clearReStep]=usePersistedValue('realestate-list-step',1);
  const [amenities,setAmenities,clearReAmenities]=usePersistedValue('realestate-list-amenities',[]);
  const [form,setForm,clearReForm]=usePersistedForm('realestate-list',{listerType:'',listingType:'',title:'',description:'',district:'',area:'',address:'',price:'',priceType:'total',bedrooms:'',bathrooms:'',sizeValue:'',sizeUnit:'acres',contactName:'',contactPhone:'',contactWhatsapp:''});
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);
  const [error,setError]=useState('');
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const inp={width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'11px 14px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:TEXT,background:WHITE};
  const toggleAm=v=>setAmenities(a=>a.includes(v)?a.filter(x=>x!==v):[...a,v]);

  const canNext1=!!form.listerType;
  const canNext2=!!form.listingType;
  const canNext3=form.title.trim()&&form.district;
  const canSubmit=form.contactName.trim()&&form.contactPhone.trim();

  const needsBedrooms=['house-sale','house-rent','commercial'].includes(form.listingType);

  const submit=async()=>{
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/realestate',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          listing_type:form.listingType,title:form.title,description:form.description,
          price:form.price?parseInt(form.price.replace(/,/g,'')):null,price_type:form.priceType,
          bedrooms:form.bedrooms?parseInt(form.bedrooms):null,
          bathrooms:form.bathrooms?parseInt(form.bathrooms):null,
          size_value:form.sizeValue?parseFloat(form.sizeValue):null,size_unit:form.sizeUnit,
          district:form.district,area:form.area,address:form.address,
          amenities,contact_name:form.contactName,
          contact_phone:form.contactPhone,contact_whatsapp:form.contactWhatsapp,
          lister_type:form.listerType,
        })});
      const d=await r.json();
      if(!r.ok){setError(d.error||'Submission failed');return;}
      // Save listing ID to localStorage for dashboard
      if(d.listing?.id){
        const saved=JSON.parse(localStorage.getItem('256mall_re_ids')||'[]');
        if(!saved.includes(d.listing.id)) saved.unshift(d.listing.id);
        localStorage.setItem('256mall_re_ids',JSON.stringify(saved.slice(0,50)));
      }
      clearReStep();clearReAmenities();clearReForm();
      setSuccess(true);
    }catch(e){setError('Connection error. Please try again.');}finally{setLoading(false);}
  };

  const STEP_LABELS=['Lister Type','Property Type','Property Details','Contact'];

  if(success)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:WHITE,border:'1px solid #86efac',borderRadius:12,padding:'48px 40px',textAlign:'center',maxWidth:480,width:'100%'}}>
        <div style={{fontSize:60,marginBottom:16}}>🏘️</div>
        <h2 style={{fontSize:24,fontWeight:700,color:TEXT,marginBottom:8}}>Property Submitted!</h2>
        <p style={{fontSize:14,color:MUTED,marginBottom:8,lineHeight:1.65}}>Your listing <strong>{form.title}</strong> has been submitted.</p>
        <p style={{fontSize:14,color:MUTED,marginBottom:28,lineHeight:1.65}}>Our team will review and publish it within 24 hours. Buyers will be able to contact you at <strong>{form.contactPhone}</strong>.</p>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>nav('/realestate/dashboard')} style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:6,padding:'11px 24px',fontSize:14,fontWeight:700,cursor:'pointer'}}>Manage Your Listings →</button>
          <button onClick={()=>nav('/realestate')} style={{background:WHITE,color:TEXT,border:`1px solid ${BORDER}`,borderRadius:6,padding:'11px 24px',fontSize:14,fontWeight:600,cursor:'pointer'}}>Browse Listings</button>
          <button onClick={()=>{setSuccess(false);setStep(1);setForm({listerType:'',listingType:'',title:'',description:'',district:'',area:'',address:'',price:'',priceType:'total',bedrooms:'',bathrooms:'',sizeValue:'',sizeUnit:'acres',contactName:'',contactPhone:'',contactWhatsapp:''});setAmenities([]);}} style={{background:WHITE,color:MUTED,border:`1px solid ${BORDER}`,borderRadius:6,padding:'11px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>List Another</button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{background:LIGHT,minHeight:'100vh',padding:'28px 16px 60px',fontFamily:DM}}>
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:13,color:MUTED,marginBottom:4,letterSpacing:.5}}>256 REAL ESTATE · LIST YOUR PROPERTY</div>
          <h1 style={{fontSize:26,fontWeight:700,color:TEXT,margin:0}}>List a Property</h1>
          <p style={{fontSize:13,color:MUTED,marginTop:6}}>Free listing · Reach buyers across all 146 districts · Verified by our team</p>
        </div>

        {/* Step indicator */}
        <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
          {STEP_LABELS.map((label,i)=>{
            const n=i+1;const done=step>n;const active=step===n;
            return(
              <React.Fragment key={n}>
                <div style={{display:'flex',alignItems:'center',gap:6,flex:1,minWidth:0}}>
                  <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0,
                    background:done?'#16a34a':active?'#16a34a':BORDER,color:done||active?WHITE:'#999'}}>
                    {done?'✓':n}
                  </div>
                  <div style={{fontSize:11,fontWeight:active?700:400,color:active?TEXT:MUTED,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</div>
                </div>
                {i<3&&<div style={{width:16,height:2,background:step>n?'#16a34a':BORDER,margin:'0 4px',flexShrink:0}}/>}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,padding:28}}>

          {step===1&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 6px'}}>Who are you?</h3>
              <p style={{fontSize:13,color:MUTED,margin:'0 0 18px'}}>This helps buyers understand who they're dealing with.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {RE_LISTER_TYPES.map(({v,icon,label,desc})=>{
                  const sel=form.listerType===v;
                  return(
                    <button key={v} onClick={()=>f('listerType',v)}
                      style={{display:'flex',alignItems:'center',gap:14,background:sel?'#f0fdf4':WHITE,border:`2px solid ${sel?'#16a34a':BORDER}`,
                        borderRadius:8,padding:'14px 16px',cursor:'pointer',textAlign:'left',fontFamily:DM}}>
                      <span style={{fontSize:26,flexShrink:0}}>{icon}</span>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:TEXT,marginBottom:2}}>{label}</div>
                        <div style={{fontSize:12,color:MUTED}}>{desc}</div>
                      </div>
                      {sel&&<div style={{marginLeft:'auto',color:'#16a34a',fontSize:18,flexShrink:0}}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step===2&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 6px'}}>What type of property?</h3>
              <p style={{fontSize:13,color:MUTED,margin:'0 0 18px'}}>Select the listing type that best describes your property.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {RE_LISTING_TYPES.map(({v,icon,label,desc})=>{
                  const sel=form.listingType===v;
                  return(
                    <button key={v} onClick={()=>f('listingType',v)}
                      style={{display:'flex',alignItems:'flex-start',gap:10,background:sel?'#f0fdf4':WHITE,border:`2px solid ${sel?'#16a34a':BORDER}`,
                        borderRadius:8,padding:'12px 14px',cursor:'pointer',textAlign:'left',fontFamily:DM}}>
                      <span style={{fontSize:22,flexShrink:0,marginTop:1}}>{icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:2}}>{label}</div>
                        <div style={{fontSize:11,color:MUTED}}>{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step===3&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 6px'}}>Property Details</h3>
              <p style={{fontSize:13,color:MUTED,margin:'0 0 18px'}}>Provide accurate details to attract serious buyers.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Listing Title *</label>
                  <input placeholder="e.g. 3-Bedroom House for Sale in Ntinda, Kampala" value={form.title} onChange={e=>f('title',e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Description</label>
                  <textarea placeholder="Describe the property — size, features, access road, water, electricity, title type..." rows={3}
                    value={form.description} onChange={e=>f('description',e.target.value)} style={{...inp,resize:'vertical'}}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>District *</label>
                    <select value={form.district} onChange={e=>f('district',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                      <option value="">Select district</option>
                      {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Area / Estate</label>
                    <input placeholder="e.g. Ntinda, Bugolobi, Naalya" value={form.area} onChange={e=>f('area',e.target.value)} style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Full Address / Directions</label>
                  <input placeholder="e.g. Plot 14 Ntinda Road, opposite Total petrol station" value={form.address} onChange={e=>f('address',e.target.value)} style={inp}/>
                </div>
                {/* Price */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Asking Price (UGX)</label>
                    <input placeholder="e.g. 250,000,000" value={form.price} onChange={e=>f('price',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Price Type</label>
                    <select value={form.priceType} onChange={e=>f('priceType',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                      <option value="total">Total price</option>
                      <option value="per_month">Per month</option>
                      <option value="per_acre">Per acre</option>
                      <option value="per_sqm">Per sqm</option>
                      <option value="negotiable">Negotiable</option>
                    </select>
                  </div>
                </div>
                {/* Specs */}
                {needsBedrooms&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Bedrooms</label>
                      <select value={form.bedrooms} onChange={e=>f('bedrooms',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                        <option value="">N/A</option>
                        {[1,2,3,4,5,6,7,8,10].map(n=><option key={n} value={n}>{n} bed{n>1?'s':''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Bathrooms</label>
                      <select value={form.bathrooms} onChange={e=>f('bathrooms',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                        <option value="">N/A</option>
                        {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Size</label>
                      <div style={{display:'flex',gap:4}}>
                        <input type="number" placeholder="e.g. 200" value={form.sizeValue} onChange={e=>f('sizeValue',e.target.value)} style={{...inp,flex:1}}/>
                        <select value={form.sizeUnit} onChange={e=>f('sizeUnit',e.target.value)} style={{...inp,width:'auto',padding:'11px 8px',flexShrink:0}}>
                          <option value="sqm">sqm</option>
                          <option value="acres">acres</option>
                          <option value="hectares">ha</option>
                          <option value="perches">perches</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                {!needsBedrooms&&(
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Land Size</label>
                      <input type="number" placeholder="e.g. 50" value={form.sizeValue} onChange={e=>f('sizeValue',e.target.value)} style={inp}/>
                    </div>
                    <div>
                      <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Unit</label>
                      <select value={form.sizeUnit} onChange={e=>f('sizeUnit',e.target.value)} style={{...inp,appearance:'none',cursor:'pointer'}}>
                        <option value="acres">Acres</option>
                        <option value="hectares">Hectares</option>
                        <option value="perches">Perches</option>
                        <option value="sqm">sqm</option>
                      </select>
                    </div>
                  </div>
                )}
                {/* Amenities */}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:8}}>Amenities &amp; Features <span style={{color:MUTED,fontWeight:400}}>(select all that apply)</span></label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                    {RE_AMENITIES.map(a=>{
                      const sel=amenities.includes(a);
                      return(
                        <button key={a} onClick={()=>toggleAm(a)}
                          style={{background:sel?'#f0fdf4':WHITE,border:`1px solid ${sel?'#16a34a':BORDER}`,borderRadius:20,
                            padding:'5px 12px',fontSize:12,fontWeight:sel?700:400,color:sel?'#15803d':TEXT,cursor:'pointer',fontFamily:DM}}>
                          {sel?'✓ ':''}{a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step===4&&(
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 6px'}}>Your Contact Details</h3>
              <p style={{fontSize:13,color:MUTED,margin:'0 0 18px'}}>Buyers will contact you directly. Your number will be shown on the listing.</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Your Full Name *</label>
                  <input placeholder="Name shown to buyers" value={form.contactName} onChange={e=>f('contactName',e.target.value)} style={inp}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>Phone Number *</label>
                    <input placeholder="07XX XXX XXX" value={form.contactPhone} onChange={e=>f('contactPhone',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:TEXT,display:'block',marginBottom:4}}>WhatsApp</label>
                    <input placeholder="07XX XXX XXX" value={form.contactWhatsapp} onChange={e=>f('contactWhatsapp',e.target.value)} style={inp}/>
                  </div>
                </div>
                {/* Summary */}
                <div style={{background:LIGHT,borderRadius:8,padding:'14px 16px',marginTop:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Listing Summary</div>
                  {[
                    ['Type',RE_LISTING_TYPES.find(t=>t.v===form.listingType)?.label||'—'],
                    ['Title',form.title||'—'],
                    ['District',form.district||'—'],
                    ['Price',form.price?`UGX ${form.price} (${form.priceType})`:'Not specified'],
                    ['Amenities',amenities.length?`${amenities.length} selected`:'None'],
                  ].map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}>
                      <span style={{color:MUTED}}>{k}</span>
                      <span style={{color:TEXT,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:12,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'10px 14px'}}>
                  ⚠️ Reminder: Always provide accurate land ownership documents. Misrepresentation of title is a criminal offence under the Land Act Cap 227.
                </div>
              </div>
              {error&&<div style={{color:RED,fontSize:13,marginTop:12,padding:'9px 12px',background:'#fff0f0',borderRadius:6,border:'1px solid #fca5a5'}}>{error}</div>}
            </div>
          )}

          {/* Navigation */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:24,paddingTop:20,borderTop:`1px solid ${BORDER}`}}>
            {step>1
              ?<button onClick={()=>{setError('');setStep(s=>s-1);}} style={{background:WHITE,color:TEXT,border:`1px solid ${BORDER}`,borderRadius:6,padding:'10px 20px',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:DM}}>← Back</button>
              :<button onClick={()=>nav('/realestate')} style={{background:'transparent',color:MUTED,border:'none',padding:'10px 0',fontSize:13,cursor:'pointer',fontFamily:DM}}>← Back to Real Estate</button>
            }
            {step<4
              ?<button onClick={()=>{
                  if(step===1&&!canNext1){setError('Please select your lister type');return;}
                  if(step===2&&!canNext2){setError('Please select a property type');return;}
                  if(step===3&&!canNext3){setError('Listing title and district are required');return;}
                  setError('');setStep(s=>s+1);
                }}
                style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:6,padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
                Continue →
              </button>
              :<button onClick={submit} disabled={loading||!canSubmit}
                style={{background:canSubmit?'#16a34a':'#d1fae5',color:canSubmit?WHITE:'#6b7280',border:'none',borderRadius:6,padding:'10px 28px',fontSize:14,fontWeight:700,cursor:canSubmit?'pointer':'not-allowed',fontFamily:DM}}>
                {loading?'Submitting…':'Submit Listing →'}
              </button>
            }
          </div>
          {error&&step<4&&<div style={{color:RED,fontSize:13,marginTop:10,padding:'8px 12px',background:'#fff0f0',borderRadius:6}}>{error}</div>}
        </div>
        <p style={{textAlign:'center',fontSize:12,color:MUTED,marginTop:14}}>
          Free listing · Reviewed within 24 hours · By listing you agree to 256 Mall Property Terms.
        </p>
      </div>
    </div>
  );
}

function RealEstatePage(){
  const [listings,setListings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [type,setType]=useState('');
  const [dist,setDist]=useState('');
  const [total,setTotal]=useState(0);
  const [selected,setSelected]=useState(null);

  useEffect(()=>{load();},[type,dist]);
  const load=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({limit:24,...(type&&{type}),...(dist&&{district:dist})});
      const r=await fetch(`/api/realestate?${p}`);const d=await r.json();
      setListings(d.listings||[]);setTotal(d.total||0);
    }catch(e){setListings([]);}finally{setLoading(false);}
  };

  const fmt=price=>price>=1000000000?`${(price/1000000000).toFixed(1)}B`:(price>=1000000?`${Math.round(price/1000000)}M`:`${Number(price).toLocaleString()}`);
  const typeLabel=t=>RE_TYPES.find(r=>r.key===t)||{label:t,icon:'🏘️'};
  const typeColor=t=>({
    'house-sale':'#16a34a','house-rent':'#2563eb','land-sale':'#d97706','farmland':'#65a30d','land-lease':'#7c3aed'
  }[t]||'#374151');

  const data=listings.length>0?listings:MOCK_REALESTATE.filter(l=>!type||l.listing_type===type);

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0c1a0c 0%,#1a2e1a 50%,#0c1a0c 100%)',padding:'28px 24px 24px'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}>
            <span style={{fontSize:32}}>🏘️</span>
            <div>
              <h1 style={{fontSize:28,fontWeight:800,color:WHITE,margin:0}}>256 Real Estate</h1>
              <p style={{fontSize:14,color:'#86efac',margin:0}}>Houses · Land · Farm Land · Leases across all 146 districts · {total>0?`${total} listings`:''}</p>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16,alignItems:'center'}}>
            {RE_TYPES.map(t=>(
              <button key={t.key} onClick={()=>setType(t.key)}
                style={{background:type===t.key?'#86efac':'rgba(255,255,255,.12)',color:type===t.key?'#0a2a0a':WHITE,border:type===t.key?'none':'1px solid rgba(255,255,255,.25)',borderRadius:20,padding:'8px 16px',fontSize:13,fontWeight:type===t.key?700:400,cursor:'pointer',fontFamily:DM}}>
                {t.icon} {t.label}
              </button>
            ))}
            <select value={dist} onChange={e=>setDist(e.target.value)}
              style={{marginLeft:'auto',border:'1px solid rgba(255,255,255,.3)',borderRadius:20,padding:'8px 16px',fontSize:13,background:'rgba(255,255,255,.15)',color:WHITE,fontFamily:SF,outline:'none'}}>
              {RE_DISTRICTS.map(d=><option key={d} value={d} style={{color:TEXT}}>{d||'All Districts'}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{background:'#eff6ff',borderBottom:'1px solid #bfdbfe',padding:'10px 24px',fontSize:13,color:'#1e40af'}}>
        <div style={{maxWidth:1280,margin:'0 auto',display:'flex',gap:24,flexWrap:'wrap'}}>
          <span>📋 All listings require valid land title or lease agreement</span>
          <span>📞 Contact sellers directly · 256 Mall does not charge buyer fees</span>
          <span>⚠️ Always verify land ownership at KCCA or District Land Office before purchase</span>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:'0 auto',padding:'16px'}}>
        {loading?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
            {Array(8).fill(0).map((_,i)=><div key={i} style={{height:360,background:WHITE,borderRadius:8,border:`1px solid ${BORDER}`}}/>)}
          </div>
        ):(
          <>
            {data.length===0&&(
              <div style={{textAlign:'center',padding:'60px 24px',color:MUTED}}>
                <div style={{fontSize:48,marginBottom:12}}>🏘️</div>
                <div style={{fontSize:18,fontWeight:600,color:TEXT,marginBottom:8}}>No listings found</div>
                <div style={{fontSize:14}}>Try a different category or district</div>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
              {data.map(l=>(
                <div key={l.id} onClick={()=>setSelected(l)}
                  style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:10,overflow:'hidden',cursor:'pointer',transition:'box-shadow .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.12)'}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                  {/* Photo */}
                  <div style={{height:200,overflow:'hidden',position:'relative',background:'#f3f4f6'}}>
                    {(l.photos&&l.photos[0])?(
                      <img src={l.photos[0]} alt={l.title} style={{width:'100%',height:'100%',objectFit:'cover'}}
                        onError={e=>{e.target.parentElement.style.background='#e5e7eb';e.target.style.display='none'}}/>
                    ):(
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:48}}>🏘️</div>
                    )}
                    {/* Type badge */}
                    <div style={{position:'absolute',top:10,left:10,background:typeColor(l.listing_type),color:WHITE,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:12,letterSpacing:.3}}>
                      {typeLabel(l.listing_type).icon} {typeLabel(l.listing_type).label}
                    </div>
                    {l.is_featured&&(
                      <div style={{position:'absolute',top:10,right:10,background:'#f59e0b',color:'#1a0a00',fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:10,letterSpacing:.5}}>★ FEATURED</div>
                    )}
                    {l.is_verified&&(
                      <div style={{position:'absolute',bottom:10,left:10,background:'rgba(22,163,74,.9)',color:WHITE,fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:10}}>✓ Verified</div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{padding:'14px 16px'}}>
                    <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:6,lineHeight:1.3}}>{l.title}</div>
                    <div style={{fontSize:12,color:MUTED,marginBottom:10}}>📍 {l.area?`${l.area}, `:''}{l.district}</div>

                    {/* Price */}
                    <div style={{marginBottom:12}}>
                      {l.price?(
                        <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                          <span style={{fontSize:20,fontWeight:800,color:'#16a34a'}}>UGX {fmt(l.price)}</span>
                          {l.price_type==='per_month'&&<span style={{fontSize:12,color:MUTED}}>/month</span>}
                          {l.price_type==='per_year'&&<span style={{fontSize:12,color:MUTED}}>/year</span>}
                        </div>
                      ):(
                        <span style={{fontSize:14,color:MUTED,fontStyle:'italic'}}>Price negotiable</span>
                      )}
                    </div>

                    {/* Specs row */}
                    <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                      {l.bedrooms&&<span style={{fontSize:12,color:TEXT,background:'#f3f4f6',padding:'3px 8px',borderRadius:6}}>🛏 {l.bedrooms} bed</span>}
                      {l.bathrooms&&<span style={{fontSize:12,color:TEXT,background:'#f3f4f6',padding:'3px 8px',borderRadius:6}}>🚿 {l.bathrooms} bath</span>}
                      {l.size_value&&<span style={{fontSize:12,color:TEXT,background:'#f3f4f6',padding:'3px 8px',borderRadius:6}}>📐 {l.size_value} {l.size_unit}</span>}
                    </div>

                    {/* Description */}
                    {l.description&&<p style={{fontSize:12,color:MUTED,lineHeight:1.5,margin:'0 0 12px',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{l.description}</p>}

                    {/* Contact */}
                    <div style={{display:'flex',gap:8}}>
                      <a href={`tel:${l.contact_phone}`} onClick={e=>e.stopPropagation()}
                        style={{flex:1,background:NAVY,color:WHITE,border:'none',borderRadius:6,padding:'9px 0',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>
                        📞 Call
                      </a>
                      <a href={`https://wa.me/${(l.contact_whatsapp||l.contact_phone)?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                        style={{flex:1,background:'#16a34a',color:WHITE,border:'none',borderRadius:6,padding:'9px 0',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* List your property CTA */}
        <div style={{background:'linear-gradient(135deg,#0c1a0c,#1a2e1a)',borderRadius:10,padding:'28px 32px',marginTop:24,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:WHITE,marginBottom:4}}>List your property on 256 Mall</div>
            <div style={{fontSize:13,color:'#86efac'}}>Free listing · Houses · Land · Farm land · All 146 districts · Reach thousands of buyers</div>
          </div>
          <div style={{fontSize:12,color:'#aaa',maxWidth:360,lineHeight:1.7}}>Requirements: Valid land title or tenancy agreement · Seller NIN · GPS location · Clear photos. Listings go live within 24 hours after verification.</div>
        </div>
      </div>

      {/* Detail modal */}
      {selected&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:2000,overflowY:'auto',padding:'20px 16px'}} onClick={()=>setSelected(null)}>
          <div style={{maxWidth:680,margin:'0 auto',background:WHITE,borderRadius:12,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
            {selected.photos&&selected.photos[0]&&(
              <img src={selected.photos[0]} alt={selected.title} style={{width:'100%',height:280,objectFit:'cover'}}/>
            )}
            <div style={{padding:'20px 24px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12}}>
                <div>
                  <div style={{display:'inline-block',background:typeColor(selected.listing_type),color:WHITE,fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:10,marginBottom:8}}>
                    {typeLabel(selected.listing_type).icon} {typeLabel(selected.listing_type).label}
                  </div>
                  <h2 style={{fontSize:20,fontWeight:800,color:TEXT,margin:'0 0 4px'}}>{selected.title}</h2>
                  <div style={{fontSize:13,color:MUTED}}>📍 {selected.area?`${selected.area}, `:''}{selected.district}</div>
                </div>
                <button onClick={()=>setSelected(null)} style={{background:'transparent',border:'1px solid #ccc',borderRadius:6,width:36,height:36,fontSize:18,cursor:'pointer',flexShrink:0}}>✕</button>
              </div>

              <div style={{fontSize:26,fontWeight:800,color:'#16a34a',marginBottom:16}}>
                UGX {selected.price?Number(selected.price).toLocaleString():'Negotiable'}
                {selected.price_type==='per_month'&&<span style={{fontSize:14,color:MUTED,fontWeight:400}}> /month</span>}
                {selected.price_type==='per_year'&&<span style={{fontSize:14,color:MUTED,fontWeight:400}}> /year</span>}
              </div>

              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
                {selected.bedrooms&&<span style={{background:'#f3f4f6',padding:'6px 12px',borderRadius:8,fontSize:13}}>🛏 {selected.bedrooms} Bedrooms</span>}
                {selected.bathrooms&&<span style={{background:'#f3f4f6',padding:'6px 12px',borderRadius:8,fontSize:13}}>🚿 {selected.bathrooms} Bathrooms</span>}
                {selected.toilets&&<span style={{background:'#f3f4f6',padding:'6px 12px',borderRadius:8,fontSize:13}}>🚽 {selected.toilets} Toilets</span>}
                {selected.size_value&&<span style={{background:'#f3f4f6',padding:'6px 12px',borderRadius:8,fontSize:13}}>📐 {selected.size_value} {selected.size_unit}</span>}
              </div>

              {selected.description&&<p style={{fontSize:14,color:TEXT,lineHeight:1.7,margin:'0 0 16px'}}>{selected.description}</p>}

              {selected.amenities&&selected.amenities.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:8}}>Amenities & Features</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {selected.amenities.map(a=>(
                      <span key={a} style={{background:'#dcfce7',color:'#15803d',fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:8}}>✓ {a}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:8,padding:'14px 16px',marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:4}}>🧑‍💼 Contact Agent / Owner</div>
                <div style={{fontSize:14,color:TEXT,marginBottom:10}}>{selected.contact_name}</div>
                <div style={{display:'flex',gap:10}}>
                  <a href={`tel:${selected.contact_phone}`}
                    style={{flex:1,background:NAVY,color:WHITE,borderRadius:6,padding:'10px 0',fontSize:14,fontWeight:600,textAlign:'center',textDecoration:'none'}}>
                    📞 {selected.contact_phone}
                  </a>
                  <a href={`https://wa.me/${(selected.contact_whatsapp||selected.contact_phone)?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    style={{flex:1,background:'#16a34a',color:WHITE,borderRadius:6,padding:'10px 0',fontSize:14,fontWeight:600,textAlign:'center',textDecoration:'none'}}>
                    💬 WhatsApp
                  </a>
                </div>
              </div>

              <div style={{fontSize:12,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,padding:'10px 14px'}}>
                ⚠️ Always verify land ownership at the District Land Office or KCCA before paying any money. 256 Mall is a listing platform and does not guarantee title authenticity.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List a Property CTA */}
      <div style={{maxWidth:1280,margin:'0 auto',padding:'0 16px 40px'}}>
        <div style={{background:'linear-gradient(135deg,#0c1a0c,#1a2e1a)',borderRadius:10,padding:'28px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
          <div style={{flex:1,minWidth:220}}>
            <div style={{fontSize:20,fontWeight:800,color:WHITE,marginBottom:6}}>🏘️ Have a Property to Sell or Rent?</div>
            <div style={{fontSize:13,color:'#86efac',marginBottom:8}}>Free listing · Reach buyers across all 146 districts · Reviewed within 24 hours</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {['🏠 Houses','📐 Land','🌾 Farm Land','🏢 Commercial'].map(t=>(
                <span key={t} style={{fontSize:12,color:'#6ee7b7',background:'rgba(134,239,172,.1)',border:'1px solid rgba(134,239,172,.2)',borderRadius:20,padding:'3px 10px'}}>{t}</span>
              ))}
            </div>
          </div>
          <button onClick={()=>window.location.href='/realestate/list'}
            style={{background:'#16a34a',color:WHITE,border:'none',borderRadius:8,padding:'14px 32px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:SF,whiteSpace:'nowrap'}}>
            List Your Property →
          </button>
        </div>
      </div>
    </div>
  );
}

function AnimalMarketPage(){
  const [animals,setAnimals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [animalType,setAnimalType]=useState('');
  const [dist,setDist]=useState('');
  const DISTRICTS=['','Kampala','Wakiso','Mukono','Jinja','Mbarara','Kiruhura','Gulu','Lira','Mbale','Kabale','Mubende','Masaka'];

  const norm=a=>({
    ...a,
    name: a.name||a.product_name,
    breed: a.breed||a.variety,
    animal_type: a.animal_type||a.category_slug,
    price: a.price??a.retail_price,
    unit: a.unit||a.retail_unit||'head',
    qty: a.qty??a.retail_qty_available,
    seller: a.seller||a.farmer_name,
    phone: a.phone||a.farmer_phone||a.farmer_whatsapp,
    photo: a.photo||(Array.isArray(a.photos)?a.photos[0]:null),
    lat: a.lat||a.farm_lat,
    lng: a.lng||a.farm_lng,
    district: a.district||a.farmer_district,
    village: a.village||a.farmer_village,
    desc: a.desc||a.description,
  });

  useEffect(()=>{load();},[animalType,dist]);
  const load=async()=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({...(animalType&&{type:animalType}),...(dist&&{district:dist})});
      const r=await fetch(`/api/animals?${p}`);const d=await r.json();
      setAnimals((d.animals||[]).map(norm));
    }catch(e){setAnimals([]);}finally{setLoading(false);}
  };

  const mapUrl=(lat,lng)=>`https://www.google.com/maps?q=${lat},${lng}`;
  const typeIcon=t=>ANIMAL_TYPES.find(a=>a.key===t)?.icon||'🐾';

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Compliance banner */}
      <div style={{background:'#fef3c7',borderBottom:'2px solid #f59e0b',padding:'12px 24px',fontFamily:DM}}>
        <div style={{maxWidth:1280,margin:'0 auto',display:'flex',gap:14,alignItems:'flex-start'}}>
          <span style={{fontSize:24,flexShrink:0}}>⚠️</span>
          <div style={{fontSize:13,color:'#78350f',lineHeight:1.7}}>
            <strong>Animal Trading Compliance — Uganda Livestock Act Cap 29:</strong> All sellers must hold a valid animal health certificate from a government veterinarian · Movement permits required from the District Veterinary Officer (DVO) for cattle, goats and sheep · FMD, Brucellosis & CBPP vaccination records mandatory for cattle · ASF-free zone certification required for pigs · 256 Mall verifies seller compliance before listings go live · <strong>Report non-compliant sellers: 0800 100 256</strong>
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1a0a00 0%,#2a1800 100%)',padding:'28px 24px 24px'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <h1 style={{fontSize:28,fontWeight:800,color:WHITE,margin:'0 0 6px'}}>🐄 Live Animal Market</h1>
          <p style={{fontSize:14,color:'#f59e0b',margin:'0 0 20px'}}>Buy livestock & poultry from GPS-verified sellers across Uganda · All listings comply with Uganda Livestock Act</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            {ANIMAL_TYPES.map(t=>(
              <button key={t.key} onClick={()=>setAnimalType(t.key)}
                style={{background:animalType===t.key?'#f59e0b':'rgba(255,255,255,.12)',color:animalType===t.key?'#1a0a00':WHITE,border:animalType===t.key?'none':'1px solid rgba(255,255,255,.25)',borderRadius:20,padding:'8px 16px',fontSize:13,fontWeight:animalType===t.key?700:400,cursor:'pointer',fontFamily:DM}}>
                {t.icon} {t.label}
              </button>
            ))}
            <select value={dist} onChange={e=>setDist(e.target.value)}
              style={{marginLeft:'auto',border:'1px solid rgba(255,255,255,.3)',borderRadius:20,padding:'8px 16px',fontSize:13,background:'rgba(255,255,255,.15)',color:WHITE,fontFamily:SF,outline:'none'}}>
              {DISTRICTS.map(d=><option key={d} value={d} style={{color:TEXT}}>{d||'All Districts'}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1280,margin:'0 auto',padding:'16px'}}>
        <div style={{background:'#dcfce7',border:'1px solid #86efac',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:13,color:'#15803d',display:'flex',gap:10,alignItems:'center'}}>
          <span>✓</span>
          <span><strong>GPS Pins:</strong> Every listing shows the exact farm location. Click "📍 View Farm" to see it on Google Maps before you buy.</span>
        </div>

        {loading?(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>
            {Array(6).fill(0).map((_,i)=><div key={i} style={{height:280,background:WHITE,borderRadius:8,border:`1px solid ${BORDER}`}}/>)}
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:14}}>
            {(animals.length>0?animals:MOCK_ANIMALS.filter(a=>!animalType||a.animal_type===animalType)).map(a=>(
              <div key={a.id} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden',fontFamily:DM}}>
                {(a.photo||(a.photos&&a.photos[0]))&&(
                  <div style={{height:180,overflow:'hidden',position:'relative'}}>
                    <img src={a.photo||(a.photos&&a.photos[0])} alt={a.name}
                      style={{width:'100%',height:'100%',objectFit:'cover'}}
                      onError={e=>{e.target.parentElement.style.display='none'}}/>
                    <div style={{position:'absolute',top:8,left:8,background:'rgba(0,0,0,.55)',color:'#f59e0b',fontSize:10,fontWeight:800,padding:'3px 9px',borderRadius:10,letterSpacing:.5}}>
                      {a.animal_type?.toUpperCase()}
                    </div>
                  </div>
                )}
                <div style={{background:'linear-gradient(135deg,#1a0a00,#2a1800)',padding:'14px 18px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:28}}>{typeIcon(a.animal_type)}</span>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:WHITE,lineHeight:1.3}}>{a.name||a.product_name}</div>
                        {(a.breed||a.variety)&&<div style={{fontSize:11,color:'#f59e0b',marginTop:2}}>{a.breed||a.variety}{a.age_months?` · ${a.age_months>=12?`${Math.floor(a.age_months/12)}yr${a.age_months%12>0?' '+a.age_months%12+'mo':''}`:a.age_months+'mo'}`:''}</div>}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      {(a.price??a.retail_price)!=null?(
                        <div style={{fontSize:19,fontWeight:800,color:'#f59e0b',lineHeight:1}}>UGX {Number(a.price??a.retail_price).toLocaleString()}</div>
                      ):(
                        <div style={{fontSize:13,color:'#aaa',fontStyle:'italic'}}>Price on request</div>
                      )}
                      <div style={{fontSize:11,color:'#ccc',marginTop:2}}>per {a.unit||a.retail_unit||'head'}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{background:(a.qty??a.retail_qty_available)>0?'#16a34a':'#dc2626',color:WHITE,fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:6,display:'inline-flex',alignItems:'center',gap:4}}>
                      {(a.qty??a.retail_qty_available)>0?`✓ ${a.qty??a.retail_qty_available} in stock`:'Out of stock'}
                    </div>
                    {(a.qty??a.retail_qty_available)>10&&<div style={{fontSize:10,color:'#f59e0b'}}>Bulk available</div>}
                  </div>
                </div>

                <div style={{padding:'14px 18px'}}>
                  {a.weight_kg&&<div style={{fontSize:12,color:MUTED,marginBottom:8}}>⚖️ Approx. {a.weight_kg}kg/head</div>}
                  {a.desc&&<p style={{fontSize:13,color:TEXT,lineHeight:1.6,margin:'0 0 12px'}}>{a.desc}</p>}

                  {/* Compliance badges */}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                    {a.vaccinated&&<span style={{background:'#dcfce7',color:'#15803d',fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10}}>💉 Vaccinated</span>}
                    {a.health_cert&&<span style={{background:'#dbeafe',color:'#1d4ed8',fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10}}>📋 Health Cert</span>}
                    {a.movement_permit&&<span style={{background:'#fef9c3',color:'#854d0e',fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10}}>📄 Movement Permit</span>}
                    {!a.vaccinated&&<span style={{background:'#fee2e2',color:'#dc2626',fontSize:10,padding:'3px 9px',borderRadius:10}}>⚠ Vaccination pending</span>}
                  </div>

                  {/* Location */}
                  <div style={{background:'#f8fafc',border:`1px solid ${BORDER}`,borderRadius:6,padding:'10px 14px',marginBottom:12}}>
                    <div style={{fontSize:12,color:TEXT,marginBottom:6}}>📍 {a.district}{a.village?`, ${a.village}`:''}</div>
                    <a href={mapUrl(a.lat,a.lng)} target="_blank" rel="noreferrer"
                      style={{display:'inline-block',background:'#0ea5e9',color:WHITE,fontSize:12,fontWeight:600,padding:'5px 14px',borderRadius:4,textDecoration:'none'}}>
                      📍 View Farm on Map
                    </a>
                  </div>

                  {/* Seller + contact */}
                  <div style={{fontSize:12,color:MUTED,marginBottom:10}}>🧑‍🌾 Seller: <strong style={{color:TEXT}}>{a.seller}</strong></div>
                  <div style={{display:'flex',gap:8}}>
                    <a href={`tel:${a.phone}`} style={{flex:1,background:NAVY,color:WHITE,border:'none',borderRadius:4,padding:'9px 0',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>📞 Call Seller</a>
                    <a href={`https://wa.me/${a.phone?.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" style={{flex:1,background:'#16a34a',color:WHITE,border:'none',borderRadius:4,padding:'9px 0',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'center',textDecoration:'none'}}>💬 WhatsApp</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Seller CTA */}
        <div style={{background:'linear-gradient(135deg,#1a0a00,#2a1800)',borderRadius:8,padding:'28px',marginTop:20}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:20}}>
            <div style={{flex:1,minWidth:220}}>
              <div style={{fontSize:20,fontWeight:800,color:WHITE,marginBottom:6}}>🐄 Sell Your Animals on 256 Mall</div>
              <div style={{fontSize:13,color:'#f59e0b',marginBottom:10}}>Free listing · GPS pin required · Compliance verified by our team</div>
              <div style={{fontSize:12,color:'#d4a96a',lineHeight:1.7}}>Requirements: Valid NIN · Animal health certificate · Vaccination records · DVO movement permit for inter-district sales.</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'flex-start'}}>
              <button onClick={()=>window.location.href='/animals/register'}
                style={{background:'#f59e0b',color:'#1a0a00',border:'none',borderRadius:8,padding:'13px 28px',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:SF,whiteSpace:'nowrap'}}>
                Register as Animal Seller →
              </button>
              <div style={{fontSize:11,color:'#d4a96a',textAlign:'center'}}>✓ Free to register · Verified within 24 hrs</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 256 Delivery Landing Page ─────────────────────────────────────────────────
function DeliveryPage(){
  const nav=useNavigate();
  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Hero */}
      <div style={{background:'linear-gradient(135deg,#1a0a00 0%,#3a1800 55%,#1a0a00 100%)',padding:'60px 24px',textAlign:'center'}}>
        <div style={{fontSize:72,marginBottom:16}}>🚴</div>
        <h1 style={{fontSize:36,fontWeight:900,color:WHITE,margin:'0 0 12px'}}>256 <span style={{color:YELLOW}}>Delivery</span></h1>
        <p style={{fontSize:18,color:'#ddd',marginBottom:8}}>Uganda's fastest local delivery network</p>
        <p style={{fontSize:14,color:'#aaa',maxWidth:500,margin:'0 auto 32px'}}>
          Boda boda, bicycles, tuktuks, vans — we deliver across all Kampala suburbs and Uganda districts.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>nav('/driver/register')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:6,padding:'14px 28px',fontSize:16,fontWeight:700,cursor:'pointer'}}>
            🚴 Become a Driver
          </button>
          <button onClick={()=>nav('/driver/dashboard')} style={{background:'transparent',color:WHITE,border:'1px solid #555',borderRadius:6,padding:'14px 28px',fontSize:16,cursor:'pointer'}}>
            Driver Login
          </button>
        </div>
      </div>

      {/* How it works */}
      <div style={{maxWidth:900,margin:'0 auto',padding:'48px 24px'}}>
        <h2 style={{textAlign:'center',fontSize:24,fontWeight:700,color:TEXT,marginBottom:32}}>How 256 Delivery Works</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:24}}>
          {[
            {icon:'🛒',title:'Place Order',desc:'Shop on 256 Mall and choose your delivery type at checkout.'},
            {icon:'📍',title:'Share Location',desc:'Allow location access so we match you with the nearest available driver.'},
            {icon:'🏍️',title:'Driver Assigned',desc:'A verified nearby driver accepts your order within 30 seconds.'},
            {icon:'📦',title:'Delivered',desc:'Track your driver live and receive your order at your doorstep.'},
          ].map(s=>(
            <div key={s.title} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:24,textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:12}}>{s.icon}</div>
              <div style={{fontWeight:700,fontSize:16,color:TEXT,marginBottom:6}}>{s.title}</div>
              <div style={{fontSize:13,color:MUTED}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Options & Rates */}
      <div style={{background:WHITE,padding:'48px 24px'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <h2 style={{textAlign:'center',fontSize:24,fontWeight:700,color:TEXT,marginBottom:32}}>Delivery Options & Rates</h2>
          <div style={{gridColumn:'1/-1',fontWeight:700,fontSize:13,color:MUTED,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Local Delivery (within 50 km)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginBottom:24}}>
            {DEL_OPTS.filter(o=>o.upcountry===false||o.upcountry===null).map(o=>(
              <div key={o.type} style={{border:`1px solid ${BORDER}`,borderRadius:8,padding:20}}>
                <div style={{fontSize:32,marginBottom:8}}>{o.icon}</div>
                <div style={{fontWeight:700,fontSize:16,color:TEXT,marginBottom:4}}>{o.label}</div>
                <div style={{fontSize:13,color:MUTED,marginBottom:8}}>{o.time}</div>
                <div style={{fontWeight:700,color:o.base===0?GREEN:RED,fontSize:15}}>
                  {o.base===0?'FREE':
                    o.perKm>0?`UGX ${o.base.toLocaleString()} + UGX ${o.perKm}/km`:
                    `UGX ${o.base.toLocaleString()} flat`}
                </div>
                <div style={{fontSize:12,color:MUTED,marginTop:4}}>{o.desc}</div>
                {o.maxKm&&<div style={{fontSize:11,color:'#888',marginTop:4}}>Within {o.maxKm} km only</div>}
              </div>
            ))}
          </div>
          <div style={{gridColumn:'1/-1',fontWeight:700,fontSize:13,color:MUTED,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Upcountry Delivery (beyond 50 km)</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
            {DEL_OPTS.filter(o=>o.upcountry===true).map(o=>(
              <div key={o.type} style={{border:`1px solid ${BORDER}`,borderRadius:8,padding:20}}>
                <div style={{fontSize:32,marginBottom:8}}>{o.icon}</div>
                <div style={{fontWeight:700,fontSize:16,color:TEXT,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
                  {o.label}
                  {o.type==='taxi'&&<span style={{fontSize:10,background:'#1565c0',color:WHITE,borderRadius:3,padding:'1px 5px',fontWeight:600}}>MATCHED</span>}
                </div>
                <div style={{fontSize:13,color:MUTED,marginBottom:8}}>{o.time}</div>
                <div style={{fontWeight:700,color:RED,fontSize:15}}>
                  {o.perKm>0?`UGX ${o.base.toLocaleString()} + UGX ${o.perKm}/km`:`UGX ${o.base.toLocaleString()} flat`}
                </div>
                <div style={{fontSize:12,color:MUTED,marginTop:4}}>{o.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Driver CTA */}
      <div style={{background:'linear-gradient(135deg,#042a04,#0a4a0a)',padding:'48px 24px',textAlign:'center'}}>
        <h2 style={{fontSize:24,fontWeight:700,color:WHITE,marginBottom:12}}>Earn Money Delivering with 256 Delivery</h2>
        <p style={{fontSize:15,color:'#aad',marginBottom:24,maxWidth:500,margin:'0 auto 24px'}}>
          Join Uganda's growing delivery network. Work your own hours. Earn per delivery.
        </p>
        <button onClick={()=>nav('/driver/register')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:6,padding:'14px 32px',fontSize:16,fontWeight:700,cursor:'pointer'}}>
          Register as Driver →
        </button>
      </div>
    </div>
  );
}

// ── Driver Registration Page ──────────────────────────────────────────────────
function DriverRegisterPage(){
  const nav=useNavigate();
  const [form,setForm,clearDriverForm]=usePersistedForm('driver-register',{full_name:'',phone:'',nin:'',vehicle_type:'boda',plate_number:'',password:'',confirm:''});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);

  const submit=async()=>{
    if(!form.full_name||!form.phone||!form.vehicle_type||!form.password)
      return setError('Please fill all required fields.');
    if(form.password!==form.confirm) return setError('Passwords do not match.');
    setLoading(true);setError('');
    try{
      const r=await fetch('/api/delivery/agents/register',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({full_name:form.full_name,phone:form.phone,nin:form.nin,vehicle_type:form.vehicle_type,plate_number:form.plate_number,password:form.password})});
      const d=await r.json();
      if(!r.ok) return setError(d.error||'Registration failed.');
      localStorage.setItem('driver_token',d.token);
      localStorage.setItem('driver_agent',JSON.stringify(d.agent));
      clearDriverForm();
      setDone(true);
    }catch(e){setError('Connection error.');}finally{setLoading(false);}
  };

  if(done)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:40,maxWidth:440,textAlign:'center',width:'100%'}}>
        <div style={{fontSize:64,marginBottom:16}}>🎉</div>
        <h2 style={{fontSize:22,fontWeight:700,color:TEXT,marginBottom:8}}>Registration Submitted!</h2>
        <p style={{fontSize:14,color:MUTED,marginBottom:24}}>Your application is under review. Admin will verify your account within 24 hours. You'll be able to log in and go on duty once approved.</p>
        <button onClick={()=>nav('/driver/dashboard')} style={{background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          Go to Driver Dashboard →
        </button>
      </div>
    </div>
  );

  return(
    <div style={{background:LIGHT,minHeight:'100vh',padding:'32px 16px',fontFamily:DM}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:24,fontWeight:700,color:TEXT,margin:0}}>🚴 Register as a 256 Delivery Driver</h1>
          <p style={{fontSize:14,color:MUTED,marginTop:6}}>Join Uganda's delivery network. Earn per delivery on your own schedule.</p>
        </div>
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:28}}>
          {[['Full Name *','full_name','text'],['Phone Number *','phone','tel'],['NIN (National ID Number)','nin','text']].map(([pl,k,t])=>(
            <input key={k} type={t} placeholder={pl} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
              style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,marginBottom:12,fontFamily:SF,boxSizing:'border-box',color:TEXT,outline:'none'}}/>
          ))}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:13,color:MUTED,display:'block',marginBottom:4}}>Vehicle Type *</label>
            <select value={form.vehicle_type} onChange={e=>setForm({...form,vehicle_type:e.target.value})}
              style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,fontFamily:SF,color:TEXT,background:WHITE}}>
              <option value="boda">🏍️ Boda Boda</option>
              <option value="bicycle">🚲 Bicycle</option>
              <option value="walker">🚶 Walker (Foot)</option>
              <option value="tuktuk">🛺 Tuktuk</option>
              <option value="van">🚐 Van/Car</option>
              <option value="bus">🚌 Bus</option>
            </select>
          </div>
          {['boda','van','tuktuk'].includes(form.vehicle_type)&&(
            <input type="text" placeholder="Plate Number (e.g. UAP 001A)" value={form.plate_number} onChange={e=>setForm({...form,plate_number:e.target.value})}
              style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,marginBottom:12,fontFamily:SF,boxSizing:'border-box',color:TEXT,outline:'none'}}/>
          )}
          {[['Password *','password','password'],['Confirm Password *','confirm','password']].map(([pl,k,t])=>(
            <input key={k} type={t} placeholder={pl} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
              style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,marginBottom:12,fontFamily:SF,boxSizing:'border-box',color:TEXT,outline:'none'}}/>
          ))}
          {error&&<div style={{color:RED,fontSize:13,marginBottom:12,padding:'8px 12px',background:'#fff0f0',borderRadius:4,border:'1px solid #ffcccc'}}>{error}</div>}
          <button onClick={submit} disabled={loading}
            style={{width:'100%',background:loading?'#ccc':YELLOW,color:TEXT,border:'none',borderRadius:4,padding:13,fontSize:15,fontWeight:700,cursor:loading?'default':'pointer'}}>
            {loading?'Submitting...':'Submit Application →'}
          </button>
          <div style={{textAlign:'center',marginTop:14,fontSize:13,color:MUTED}}>
            Already registered?{' '}
            <span onClick={()=>nav('/driver/dashboard')} style={{color:LINK,cursor:'pointer',fontWeight:600}}>Go to Dashboard →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Driver Dashboard Page ─────────────────────────────────────────────────────
function DriverDashboardPage(){
  const nav=useNavigate();
  const [agent,setAgent]=useState(()=>{try{return JSON.parse(localStorage.getItem('driver_agent')||'null');}catch{return null;}});
  const [loginForm,setLoginForm]=useState({phone:'',password:''});
  const [loginErr,setLoginErr]=useState('');
  const [loginLoading,setLoginLoading]=useState(false);
  const [isOnDuty,setIsOnDuty]=useState(agent?.is_on_duty||false);
  const [earnings,setEarnings]=useState({today:0,week:0,total:0});
  const [orders,setOrders]=useState([]);
  const [activeOrder,setActiveOrder]=useState(null);
  const locationRef=useRef(null);

  const token=()=>localStorage.getItem('driver_token');

  const loadData=useCallback(async()=>{
    if(!token()) return;
    try{
      const [me,earn,ords]=await Promise.all([
        fetch('/api/delivery/agents/me',{headers:{Authorization:`Bearer ${token()}`}}).then(r=>r.json()),
        fetch('/api/delivery/agents/earnings',{headers:{Authorization:`Bearer ${token()}`}}).then(r=>r.json()),
        fetch('/api/delivery/agents/orders',{headers:{Authorization:`Bearer ${token()}`}}).then(r=>r.json()),
      ]);
      if(me.success){setAgent(me.agent);localStorage.setItem('driver_agent',JSON.stringify(me.agent));setIsOnDuty(me.agent.is_on_duty);}
      if(earn.success)setEarnings(earn);
      if(ords.success){
        setOrders(ords.orders||[]);
        setActiveOrder((ords.orders||[]).find(o=>['agent_assigned','picked_up'].includes(o.status))||null);
      }
    }catch(e){}
  },[]);

  useEffect(()=>{if(agent)loadData();},[agent]);

  // GPS ping when on duty
  useEffect(()=>{
    if(!isOnDuty||!token()){if(locationRef.current)clearInterval(locationRef.current);return;}
    const ping=()=>{
      navigator.geolocation?.getCurrentPosition(pos=>{
        fetch('/api/delivery/agents/location',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},
          body:JSON.stringify({lat:pos.coords.latitude,lng:pos.coords.longitude})}).catch(()=>{});
      });
    };
    ping();
    locationRef.current=setInterval(ping,30000);
    return()=>clearInterval(locationRef.current);
  },[isOnDuty]);

  // Socket for new order notifications
  useEffect(()=>{
    if(!agent?.id) return;
    const s=socketIO();
    s.emit('join_agent',agent.id);
    s.on('new_order',data=>{
      toast(`New delivery order! ID #${data.delivery_id}`);
      loadData();
    });
    return()=>s.disconnect();
  },[agent?.id]);

  const login=async()=>{
    if(!loginForm.phone||!loginForm.password) return setLoginErr('Phone and password required.');
    setLoginLoading(true);setLoginErr('');
    try{
      const r=await fetch('/api/delivery/agents/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(loginForm)});
      const d=await r.json();
      if(!r.ok) return setLoginErr(d.error||'Login failed.');
      localStorage.setItem('driver_token',d.token);
      localStorage.setItem('driver_agent',JSON.stringify(d.agent));
      setAgent(d.agent);setIsOnDuty(d.agent.is_on_duty);
    }catch(e){setLoginErr('Connection error.');}finally{setLoginLoading(false);}
  };

  const toggleDuty=async()=>{
    try{
      await fetch('/api/delivery/agents/duty',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},
        body:JSON.stringify({is_on_duty:!isOnDuty})});
      setIsOnDuty(v=>!v);
    }catch(e){}
  };

  const updateStatus=async(orderId,status)=>{
    try{
      await fetch(`/api/delivery/orders/${orderId}/status`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`},
        body:JSON.stringify({status})});
      loadData();
      toast(`Order marked as ${status} ✓`);
    }catch(e){}
  };

  const logout=()=>{localStorage.removeItem('driver_token');localStorage.removeItem('driver_agent');setAgent(null);};

  // Login screen
  if(!agent)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:36,maxWidth:380,width:'100%'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:48}}>🚴</div>
          <h2 style={{fontSize:20,fontWeight:700,color:TEXT,margin:'8px 0 4px'}}>Driver Login</h2>
          <p style={{fontSize:13,color:MUTED}}>256 Delivery Driver Portal</p>
        </div>
        <input type="tel" placeholder="Phone Number" value={loginForm.phone} onChange={e=>setLoginForm({...loginForm,phone:e.target.value})}
          style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,marginBottom:10,fontFamily:SF,boxSizing:'border-box',color:TEXT,outline:'none'}}/>
        <input type="password" placeholder="Password" value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})}
          onKeyDown={e=>e.key==='Enter'&&login()}
          style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,marginBottom:12,fontFamily:SF,boxSizing:'border-box',color:TEXT,outline:'none'}}/>
        {loginErr&&<div style={{color:RED,fontSize:13,marginBottom:10,padding:'8px 12px',background:'#fff0f0',borderRadius:4}}>{loginErr}</div>}
        <button onClick={login} disabled={loginLoading} style={{width:'100%',background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:12,fontSize:15,fontWeight:700,cursor:'pointer'}}>
          {loginLoading?'Logging in...':'Login →'}
        </button>
        <div style={{textAlign:'center',marginTop:14,fontSize:13}}>
          <span onClick={()=>nav('/driver/register')} style={{color:LINK,cursor:'pointer'}}>New driver? Register here</span>
        </div>
      </div>
    </div>
  );

  const verBadge=agent.is_verified
    ?<span style={{background:'#d4edda',color:GREEN,fontSize:12,padding:'2px 8px',borderRadius:10,fontWeight:600}}>✓ Verified</span>
    :<span style={{background:'#fff3cd',color:'#856404',fontSize:12,padding:'2px 8px',borderRadius:10,fontWeight:600}}>⏳ Pending Verification</span>;

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      {/* Header */}
      <div style={{background:NAVY,padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,background:YELLOW,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
            {agent.vehicle_type==='boda'?'🏍️':agent.vehicle_type==='bicycle'?'🚲':agent.vehicle_type==='tuktuk'?'🛺':agent.vehicle_type==='van'?'🚐':'🚶'}
          </div>
          <div>
            <div style={{color:WHITE,fontWeight:700,fontSize:16}}>{agent.full_name}</div>
            <div style={{color:'#aaa',fontSize:13}}>{agent.phone} · {verBadge}</div>
          </div>
        </div>
        <button onClick={logout} style={{background:'transparent',border:'1px solid #555',borderRadius:4,color:'#aaa',padding:'6px 12px',fontSize:13,cursor:'pointer'}}>Logout</button>
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'20px 16px'}}>
        {/* Duty Toggle */}
        <div style={{background:WHITE,border:`2px solid ${isOnDuty?GREEN:BORDER}`,borderRadius:12,padding:24,marginBottom:16,textAlign:'center'}}>
          <div style={{fontSize:14,color:MUTED,marginBottom:10}}>You are currently</div>
          <div style={{fontSize:28,fontWeight:900,color:isOnDuty?GREEN:MUTED,marginBottom:16}}>
            {isOnDuty?'🟢 ON DUTY':'🔴 OFF DUTY'}
          </div>
          {!agent.is_verified&&<p style={{fontSize:13,color:'#856404',background:'#fff3cd',padding:'8px 12px',borderRadius:4,marginBottom:16}}>Your account is pending admin verification. You can go on duty once approved.</p>}
          <button onClick={toggleDuty} disabled={!agent.is_verified}
            style={{background:isOnDuty?'#dc2626':GREEN,color:WHITE,border:'none',borderRadius:8,padding:'14px 40px',fontSize:18,fontWeight:700,cursor:agent.is_verified?'pointer':'not-allowed',opacity:agent.is_verified?1:0.5}}>
            {isOnDuty?'Go Off Duty':'Go On Duty'}
          </button>
          {isOnDuty&&<p style={{fontSize:12,color:MUTED,marginTop:10}}>📍 Your location is being shared every 30 seconds</p>}
        </div>

        {/* Earnings */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
          {[['Today','UGX '+earnings.today.toLocaleString(),'🌅'],['This Week','UGX '+earnings.week.toLocaleString(),'📅'],['Total','UGX '+earnings.total.toLocaleString(),'💰']].map(([l,v,i])=>(
            <div key={l} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:'16px 12px',textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:4}}>{i}</div>
              <div style={{fontSize:12,color:MUTED,marginBottom:4}}>{l}</div>
              <div style={{fontWeight:700,fontSize:14,color:TEXT}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Active Order */}
        {activeOrder&&(
          <div style={{background:WHITE,border:`2px solid ${YELLOW}`,borderRadius:10,padding:20,marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 12px'}}>🚀 Active Order #{activeOrder.id}</h3>
            <div style={{fontSize:13,color:MUTED,marginBottom:6}}>From: <strong style={{color:TEXT}}>{activeOrder.seller_address||'Seller location'}</strong></div>
            <div style={{fontSize:13,color:MUTED,marginBottom:6}}>To: <strong style={{color:TEXT}}>{activeOrder.buyer_address||'Buyer location'}</strong></div>
            <div style={{fontSize:13,color:MUTED,marginBottom:14}}>Distance: <strong>{activeOrder.distance_km}km</strong> · Fee: <strong style={{color:GREEN}}>UGX {Number(activeOrder.delivery_fee).toLocaleString()}</strong></div>
            {activeOrder.buyer_lat&&activeOrder.buyer_lng&&(
              <a href={`https://maps.google.com/?daddr=${activeOrder.buyer_lat},${activeOrder.buyer_lng}`} target="_blank" rel="noreferrer"
                style={{display:'block',background:'#4285f4',color:WHITE,textDecoration:'none',borderRadius:6,padding:'10px 0',textAlign:'center',marginBottom:10,fontSize:14,fontWeight:600}}>
                📍 Open in Google Maps
              </a>
            )}
            <div style={{display:'flex',gap:10}}>
              {activeOrder.status==='agent_assigned'&&(
                <button onClick={()=>updateStatus(activeOrder.id,'picked_up')} style={{flex:1,background:ORANGE,color:WHITE,border:'none',borderRadius:6,padding:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  📦 Picked Up
                </button>
              )}
              {activeOrder.status==='picked_up'&&(
                <button onClick={()=>updateStatus(activeOrder.id,'delivered')} style={{flex:1,background:GREEN,color:WHITE,border:'none',borderRadius:6,padding:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  ✅ Delivered
                </button>
              )}
            </div>
          </div>
        )}

        {/* Order History */}
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:20}}>
          <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 14px'}}>Recent Deliveries</h3>
          {orders.length===0&&<div style={{fontSize:13,color:MUTED,textAlign:'center',padding:20}}>No deliveries yet. Go on duty to start receiving orders.</div>}
          {orders.slice(0,20).map(o=>(
            <div key={o.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${LIGHT}`,fontSize:13}}>
              <div>
                <div style={{fontWeight:600,color:TEXT}}>Order #{o.id}</div>
                <div style={{color:MUTED}}>{o.buyer_address||'Delivery'} · {o.distance_km}km</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,color:GREEN}}>UGX {Number(o.delivery_fee).toLocaleString()}</div>
                <div style={{fontSize:11,color:MUTED,textTransform:'capitalize'}}>{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Buyer Live Tracking Page ──────────────────────────────────────────────────
function BuyerTrackingPage(){
  const {orderId}=useParams();
  const [delivery,setDelivery]=useState(null);
  const [agentPos,setAgentPos]=useState(null);
  const [noAgent,setNoAgent]=useState(false);
  const socketRef=useRef(null);

  useEffect(()=>{
    const load=async()=>{
      try{
        const r=await fetch(`/api/delivery/by-order/${orderId}`);
        const d=await r.json();
        if(d.success&&d.delivery){
          setDelivery(d.delivery);
          if(d.delivery.current_lat)setAgentPos({lat:d.delivery.current_lat,lng:d.delivery.current_lng});
        }
      }catch(e){}
    };
    load();
    const iv=setInterval(load,15000);

    // Socket for live location
    const s=socketIO();
    socketRef.current=s;
    if(orderId)s.emit('join_delivery',orderId);
    s.on('agent_location',pos=>setAgentPos(pos));
    s.on('order_update',data=>{load();});
    s.on('no_agent',()=>setNoAgent(true));
    return()=>{clearInterval(iv);s.disconnect();};
  },[orderId]);

  const STATUS_STEPS=['pending','agent_assigned','picked_up','delivered'];
  const STATUS_LABELS=['Finding Driver','Driver Assigned','Picked Up','Delivered'];
  const STATUS_ICONS=['🔍','🏍️','📦','✅'];
  const cur=STATUS_STEPS.indexOf(delivery?.status||'pending');

  return(
    <div style={{background:LIGHT,minHeight:'100vh',padding:'24px 16px',fontFamily:DM}}>
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <h2 style={{fontSize:20,fontWeight:700,color:TEXT,marginBottom:4}}>Live Delivery Tracking</h2>
        <p style={{fontSize:13,color:MUTED,marginBottom:20}}>Order #{orderId}</p>

        {/* Status steps */}
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:24,marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',position:'relative'}}>
            <div style={{position:'absolute',top:20,left:'12%',right:'12%',height:3,background:'#eee'}}>
              <div style={{height:'100%',background:YELLOW,width:`${Math.max(0,cur/(STATUS_STEPS.length-1))*100}%`,transition:'width .5s'}}/>
            </div>
            {STATUS_STEPS.map((st,i)=>(
              <div key={st} style={{textAlign:'center',flex:1,zIndex:1}}>
                <div style={{width:42,height:42,borderRadius:'50%',background:i<=cur?YELLOW:'#eee',margin:'0 auto 8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,border:`2px solid ${i<=cur?YELLOW:BORDER}`}}>
                  {STATUS_ICONS[i]}
                </div>
                <div style={{fontSize:11,color:i<=cur?TEXT:MUTED,fontWeight:i===cur?700:400}}>{STATUS_LABELS[i]}</div>
              </div>
            ))}
          </div>
        </div>

        {noAgent&&(
          <div style={{background:'#fff3cd',border:'1px solid #ffc107',borderRadius:8,padding:16,marginBottom:16,fontSize:14}}>
            ⚠️ No available drivers found near the seller. Please wait or choose Self Pickup.
          </div>
        )}

        {/* Driver Info */}
        {delivery?.agent_name?(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:20,marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700,color:TEXT,margin:'0 0 14px'}}>Your Driver</h3>
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <div style={{width:56,height:56,background:NAVY2,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,flexShrink:0}}>
                {delivery.vehicle_type==='boda'?'🏍️':delivery.vehicle_type==='bicycle'?'🚲':delivery.vehicle_type==='tuktuk'?'🛺':delivery.vehicle_type==='van'?'🚐':'🚶'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:16,color:TEXT}}>{delivery.agent_name}</div>
                <div style={{fontSize:13,color:MUTED}}>{delivery.agent_phone}</div>
                <div style={{fontSize:13,color:GREEN}}>★ {Number(delivery.agent_rating_val||5).toFixed(1)} rating</div>
              </div>
              <a href={`tel:${delivery.agent_phone}`} style={{background:YELLOW,color:TEXT,padding:'10px 16px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:700}}>
                📞 Call
              </a>
            </div>
            {agentPos&&(
              <div style={{marginTop:14}}>
                <a href={`https://maps.google.com/?saddr=${agentPos.lat},${agentPos.lng}`} target="_blank" rel="noreferrer"
                  style={{display:'block',background:'#4285f4',color:WHITE,textDecoration:'none',borderRadius:6,padding:'10px 0',textAlign:'center',fontSize:14,fontWeight:600}}>
                  📍 View Driver on Maps
                </a>
                <p style={{fontSize:11,color:MUTED,textAlign:'center',marginTop:6}}>Location updates every 30 seconds</p>
              </div>
            )}
          </div>
        ):(delivery&&!noAgent&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:20,textAlign:'center',marginBottom:16}}>
            <div style={{fontSize:40,marginBottom:8}}>⏳</div>
            <div style={{fontSize:14,color:MUTED}}>Finding a nearby driver for your order...</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Admin Delivery Panel Page ─────────────────────────────────────────────────
const ADMIN_KEY='mall256admin';

// ── Mall Admin Review Panel ───────────────────────────────────────────────────
function MallAdminPage(){
  const [key,setKey]=useState(()=>localStorage.getItem('mall_admin_key')||'');
  const [authed,setAuthed]=useState(false);
  const [tab,setTab]=useState('overview');
  const [counts,setCounts]=useState({products:0,farmers:0,sellers:0,realestate:0});
  const [analytics,setAnalytics]=useState(null);
  const [products,setProducts]=useState([]);
  const [farmers,setFarmers]=useState([]);
  const [sellers,setSellers]=useState([]);
  const [realestate,setRealestate]=useState([]);
  const [allUsers,setAllUsers]=useState([]);
  const [allOrders,setAllOrders]=useState([]);
  const [allSellers,setAllSellers]=useState([]);
  const [payouts,setPayouts]=useState([]);
  const [reviewSub,setReviewSub]=useState('products');
  const [orderFilter,setOrderFilter]=useState('');
  const [userSearch,setUserSearch]=useState('');
  const [sellerSearch,setSellerSearch]=useState('');
  const [payoutFilter,setPayoutFilter]=useState('requested');
  const [loading,setLoading]=useState(false);
  const [acting,setActing]=useState('');
  const [toast,setToast]=useState('');
  const [msg,setMsg]=useState('');
  const hdr=()=>({'x-admin-key':key,'Content-Type':'application/json'});

  const showToast=(t)=>{setToast(t);setTimeout(()=>setToast(''),2500);};

  const login=async()=>{
    setLoading(true);setMsg('');
    try{
      const [pr,ar]=await Promise.all([
        fetch('/api/admin/pending',{headers:hdr()}),
        fetch('/api/admin/analytics',{headers:hdr()}),
      ]);
      if(pr.ok){
        const [pd,ad]=await Promise.all([pr.json(),ar.json()]);
        setCounts(pd.counts);
        if(ad.success) setAnalytics(ad);
        localStorage.setItem('mall_admin_key',key);
        setAuthed(true);
      } else { setMsg('Invalid admin key'); }
    }catch(e){setMsg('Connection error');}
    setLoading(false);
  };

  const loadReview=async(sub)=>{
    setReviewSub(sub);setLoading(true);
    try{
      const ep={products:'/api/admin/products',farmers:'/api/admin/farmers',sellers:'/api/admin/sellers',realestate:'/api/admin/realestate'}[sub];
      const r=await fetch(ep,{headers:hdr()});const d=await r.json();
      if(sub==='products') setProducts(d.products||[]);
      if(sub==='farmers') setFarmers(d.farmers||[]);
      if(sub==='sellers') setSellers(d.sellers||[]);
      if(sub==='realestate') setRealestate(d.listings||[]);
    }catch(e){}
    setLoading(false);
  };

  const loadUsers=async(q='')=>{
    setLoading(true);
    try{const r=await fetch(`/api/admin/all-users?search=${encodeURIComponent(q)}&limit=60`,{headers:hdr()});const d=await r.json();if(d.success)setAllUsers(d.users||[]);}catch{}
    setLoading(false);
  };
  const loadOrders=async(s='')=>{
    setLoading(true);
    try{const r=await fetch(`/api/admin/all-orders?status=${s}&limit=80`,{headers:hdr()});const d=await r.json();if(d.success)setAllOrders(d.orders||[]);}catch{}
    setLoading(false);
  };
  const loadAllSellers=async(q='')=>{
    setLoading(true);
    try{const r=await fetch(`/api/admin/all-sellers?search=${encodeURIComponent(q)}&limit=60`,{headers:hdr()});const d=await r.json();if(d.success)setAllSellers(d.sellers||[]);}catch{}
    setLoading(false);
  };
  const loadPayouts=async(s='requested')=>{
    setLoading(true);
    try{const r=await fetch(`/api/admin/payouts?status=${s}`,{headers:hdr()});const d=await r.json();if(d.success)setPayouts(d.payouts||[]);}catch{}
    setLoading(false);
  };
  const refreshAnalytics=async()=>{
    try{const r=await fetch('/api/admin/analytics',{headers:hdr()});const d=await r.json();if(d.success)setAnalytics(d);}catch{}
  };

  const switchTab=async(t)=>{
    setTab(t);
    if(t==='overview') refreshAnalytics();
    if(t==='review') loadReview(reviewSub);
    if(t==='users') loadUsers(userSearch);
    if(t==='orders') loadOrders(orderFilter);
    if(t==='sellers') loadAllSellers(sellerSearch);
    if(t==='payouts') loadPayouts(payoutFilter);
  };

  const act=async(ep,label,method='PATCH',body={})=>{
    setActing(ep);
    try{
      const r=await fetch(ep,{method,headers:hdr(),body:JSON.stringify(body)});
      const d=await r.json();
      if(!r.ok){showToast(`❌ Failed: ${d.error||'Unknown error'}`);setActing('');return;}
      showToast(`✓ ${label}`);
      const cr=await fetch('/api/admin/pending',{headers:hdr()});const cd=await cr.json();setCounts(cd.counts);
      if(tab==='review') loadReview(reviewSub);
      if(tab==='users') loadUsers(userSearch);
      if(tab==='payouts') loadPayouts(payoutFilter);
      refreshAnalytics();
    }catch(e){showToast('❌ Network error');}
    setActing('');
  };

  const fmt=v=>v?new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';
  const money=v=>v?`UGX ${parseInt(v).toLocaleString()}`:'—';

  const MAIN_TABS=[
    {k:'overview',icon:'📊',label:'Overview'},
    {k:'orders',  icon:'🛍️',label:'Orders'},
    {k:'users',   icon:'👥',label:'Users'},
    {k:'sellers', icon:'🏪',label:'All Sellers'},
    {k:'payouts', icon:'💸',label:'Payouts'},
    {k:'review',  icon:'🔍',label:'Review Queue',count:(counts.products||0)+(counts.farmers||0)+(counts.realestate||0)},
  ];

  const GS=GSHINE;
  const GB='rgba(200,153,42,0.22)';
  const CARD={background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))',border:`1px solid ${GB}`,borderRadius:14,padding:'20px 22px',boxShadow:'0 2px 24px rgba(0,0,0,0.5)'};
  const ABT=(ep)=>({background:acting===ep?'rgba(200,153,42,0.5)':GS,color:'#07070e',border:'none',borderRadius:8,padding:'9px 22px',fontSize:13,fontWeight:800,cursor:acting?'not-allowed':'pointer',fontFamily:DM,opacity:acting&&acting!==ep?.35:1,boxShadow:acting===ep?'none':'0 0 14px rgba(200,153,42,0.35)'});
  const RBT=(ep)=>({background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:600,cursor:acting?'not-allowed':'pointer',fontFamily:DM,opacity:acting&&acting!==ep?.35:1});
  const EMPTY=(msg)=><div style={{...CARD,textAlign:'center',padding:56}}><div style={{fontSize:44,marginBottom:12,opacity:.4}}>✅</div><div style={{color:'rgba(200,153,42,0.4)',fontSize:14,fontFamily:DM}}>{msg}</div></div>;

  const orderStatColors={pending:'#fbbf24',paid:'#60a5fa',processing:'#a78bfa',shipped:'#38bdf8',delivered:'#4ade80',cancelled:'#f87171',disputed:'#fb923c',refunded:'#60a5fa'};
  const OSPill=({s})=>s?<span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',padding:'3px 8px',borderRadius:8,background:`${orderStatColors[s]||'#c8992a'}22`,color:orderStatColors[s]||'#c8992a',border:`1px solid ${orderStatColors[s]||'#c8992a'}44`,fontFamily:DM}}>{s}</span>:null;

  if(!authed)return(
    <div style={{minHeight:'100vh',background:BLACK,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM,padding:16}}>
      <div style={{background:'linear-gradient(145deg,#0d0d0d,#111108)',border:'1px solid rgba(200,153,42,0.4)',borderRadius:24,boxShadow:'0 0 120px rgba(200,153,42,0.08),inset 0 1px 0 rgba(200,153,42,0.08)',padding:'56px 44px',maxWidth:420,width:'100%',textAlign:'center'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:GS,display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,margin:'0 auto 24px',boxShadow:'0 0 40px rgba(200,153,42,0.4)'}}>🔐</div>
        <div style={{fontSize:10,letterSpacing:4,color:'rgba(200,153,42,0.55)',fontWeight:700,textTransform:'uppercase',marginBottom:10,fontFamily:DM}}>256 Mall · Command Centre</div>
        <h2 style={{fontSize:30,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 10px'}}>Admin Portal</h2>
        <p style={{fontSize:13,color:'rgba(200,153,42,0.45)',marginBottom:36,lineHeight:1.7,fontFamily:DM}}>Platform management & analytics</p>
        <input type="password" value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}
          placeholder="Enter admin key"
          style={{width:'100%',background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.28)',borderRadius:10,padding:'14px 16px',fontSize:14,color:'#f0ede4',outline:'none',boxSizing:'border-box',fontFamily:DM,marginBottom:18,letterSpacing:.5}}/>
        {msg&&<div style={{color:'#f87171',fontSize:13,marginBottom:14,padding:'10px 14px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,fontFamily:DM}}>{msg}</div>}
        <button onClick={login} disabled={loading||!key}
          style={{width:'100%',padding:'15px',fontSize:15,fontWeight:800,border:'none',borderRadius:10,cursor:loading||!key?'not-allowed':'pointer',fontFamily:DM,
            background:loading||!key?'rgba(200,153,42,0.2)':GS,
            color:loading||!key?'rgba(200,153,42,0.4)':'#07070e',
            boxShadow:loading||!key?'none':'0 0 28px rgba(200,153,42,0.4)'}}>
          {loading?'Verifying…':'Enter Admin Panel →'}
        </button>
      </div>
    </div>
  );

  const st=analytics?.stats||{};
  const recentOrders=analytics?.recent_orders||[];

  return(
    <div style={{minHeight:'100vh',background:BLACK,fontFamily:DM}}>

      {toast&&<div style={{position:'fixed',top:24,left:'50%',transform:'translateX(-50%)',background:toast.startsWith('✓')?'linear-gradient(135deg,#071a07,#0a2a0a)':'linear-gradient(135deg,#1a0707,#2a0a0a)',border:`1px solid ${toast.startsWith('✓')?'rgba(74,222,128,0.4)':'rgba(248,113,113,0.4)'}`,color:toast.startsWith('✓')?'#4ade80':'#f87171',borderRadius:12,padding:'14px 28px',fontSize:14,fontWeight:700,zIndex:9999,boxShadow:'0 8px 40px rgba(0,0,0,.8)',fontFamily:DM,whiteSpace:'nowrap'}}>{toast}</div>}

      {/* Top header */}
      <div style={{background:'linear-gradient(180deg,#0d0800 0%,#0a0900 100%)',borderBottom:'1px solid rgba(200,153,42,0.2)',padding:'20px 24px'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:6,fontFamily:DM}}>256 Mall · Admin Command Centre</div>
            <h1 style={{fontSize:26,fontWeight:900,margin:0,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Platform Dashboard</h1>
          </div>
          <button onClick={()=>{localStorage.removeItem('mall_admin_key');setAuthed(false);}}
            style={{background:'transparent',color:'rgba(200,153,42,0.4)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,padding:'9px 18px',fontSize:12,cursor:'pointer',fontFamily:DM}}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{background:'rgba(200,153,42,0.03)',borderBottom:'1px solid rgba(200,153,42,0.12)',padding:'0 24px',overflowX:'auto',scrollbarWidth:'none'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',gap:0}}>
          {MAIN_TABS.map(({k,icon,label,count})=>(
            <button key={k} onClick={()=>switchTab(k)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'14px 20px',background:'transparent',border:'none',
                borderBottom:`2px solid ${tab===k?GOLD:'transparent'}`,
                color:tab===k?GL:'rgba(200,153,42,0.4)',
                fontSize:13,fontWeight:tab===k?700:400,cursor:'pointer',fontFamily:DM,whiteSpace:'nowrap',flexShrink:0,
                transition:'all .15s'}}>
              <span>{icon}</span>{label}
              {count>0&&<span style={{background:'rgba(239,68,68,0.8)',color:'#fff',borderRadius:8,padding:'0 6px',fontSize:10,fontWeight:700}}>{count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'28px 24px 80px'}}>

        {loading&&<div style={{color:'rgba(200,153,42,0.35)',textAlign:'center',padding:72,fontSize:13,letterSpacing:3,fontFamily:DM}}>LOADING…</div>}

        {/* ── OVERVIEW ── */}
        {!loading&&tab==='overview'&&(
          <div>
            {/* KPI Grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14,marginBottom:28}}>
              {[
                {icon:'👥',label:'Total Users',val:st.users||0,sub:'registered buyers',color:'#60a5fa'},
                {icon:'🏪',label:'Active Sellers',val:st.sellers||0,sub:'on platform',color:GL},
                {icon:'📦',label:'Live Products',val:st.products||0,sub:'published',color:'#4ade80'},
                {icon:'🛍️',label:'Total Orders',val:st.total_orders||0,sub:'all time',color:'#a78bfa'},
                {icon:'💰',label:'Gross Revenue',val:null,ugx:st.revenue||0,sub:'excl. cancelled',color:GL},
                {icon:'💸',label:'Pending Payouts',val:st.pending_payouts_count||0,sub:`UGX ${((st.pending_payouts_amount||0)/1e6).toFixed(1)}M`,color:'#fb923c'},
                {icon:'📋',label:'Delivered',val:st.orders?.delivered||0,sub:'orders',color:'#4ade80'},
                {icon:'⏳',label:'Pending',val:st.orders?.pending||0,sub:'awaiting payment',color:'#fbbf24'},
              ].map(c=>(
                <div key={c.label} style={{...CARD,padding:'20px'}}>
                  <div style={{fontSize:28,marginBottom:10}}>{c.icon}</div>
                  {c.ugx!==undefined
                    ?<div style={{fontSize:18,fontWeight:900,color:c.color,lineHeight:1,marginBottom:5,fontFamily:PF}}>UGX {(c.ugx/1e6).toFixed(1)}M</div>
                    :<div style={{fontSize:30,fontWeight:900,color:c.color,lineHeight:1,marginBottom:5,fontFamily:PF}}>{c.val}</div>
                  }
                  <div style={{fontSize:12,fontWeight:700,color:'#f0ede4',marginBottom:3}}>{c.label}</div>
                  <div style={{fontSize:11,color:'rgba(200,153,42,0.45)'}}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Order status breakdown */}
            <div style={{...CARD,marginBottom:28}}>
              <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:16}}>Order Status Breakdown</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                {Object.entries(st.orders||{}).map(([status,count])=>(
                  <div key={status} style={{background:'rgba(200,153,42,0.06)',border:'1px solid rgba(200,153,42,0.18)',borderRadius:10,padding:'12px 18px',minWidth:100}}>
                    <div style={{fontSize:20,fontWeight:800,color:orderStatColors[status]||GL,fontFamily:PF}}>{count}</div>
                    <div style={{fontSize:11,color:'rgba(200,153,42,0.5)',marginTop:3,textTransform:'capitalize'}}>{status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending review callouts */}
            {((counts.products||0)+(counts.farmers||0)+(counts.sellers||0)+(counts.realestate||0))>0&&(
              <div style={{...CARD,marginBottom:28,borderColor:'rgba(239,68,68,0.3)'}}>
                <div style={{fontSize:10,letterSpacing:2,color:'rgba(239,68,68,0.7)',fontWeight:700,textTransform:'uppercase',marginBottom:14}}>Pending Review</div>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {[
                    {label:'Products',count:counts.products,sub:'products',click:()=>{setTab('review');setReviewSub('products');loadReview('products');}},
                    {label:'Farmers',count:counts.farmers,sub:'farmers',click:()=>{setTab('review');setReviewSub('farmers');loadReview('farmers');}},
                    {label:'Sellers',count:counts.sellers,sub:'sellers',click:()=>{setTab('review');setReviewSub('sellers');loadReview('sellers');}},
                    {label:'Real Estate',count:counts.realestate,sub:'listings',click:()=>{setTab('review');setReviewSub('realestate');loadReview('realestate');}},
                  ].filter(x=>x.count>0).map(x=>(
                    <button key={x.label} onClick={x.click}
                      style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,padding:'12px 18px',cursor:'pointer',fontFamily:DM,textAlign:'left'}}>
                      <div style={{fontSize:20,fontWeight:800,color:'#f87171'}}>{x.count}</div>
                      <div style={{fontSize:11,color:'rgba(248,113,113,0.7)',marginTop:2}}>{x.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {recentOrders.length>0&&(
              <div style={CARD}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                  <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase'}}>Recent Orders</div>
                  <button onClick={()=>switchTab('orders')} style={{fontSize:12,color:GL,background:'none',border:'none',cursor:'pointer',fontFamily:DM}}>View all →</button>
                </div>
                {recentOrders.map(o=>(
                  <div key={o.order_number} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid rgba(200,153,42,0.1)'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#f0ede4'}}>#{o.order_number}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',marginTop:2}}>{o.buyer_name||'Guest'} · {fmt(o.created_at)}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:GL}}>{money(o.total)}</div>
                    <OSPill s={o.status}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {!loading&&tab==='orders'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4',flex:1}}>All Orders</h2>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {[['','All'],['pending','Pending'],['paid','Paid'],['processing','Processing'],['shipped','Shipped'],['delivered','Delivered'],['cancelled','Cancelled'],['disputed','Disputed']].map(([s,l])=>(
                  <button key={s} onClick={()=>{setOrderFilter(s);loadOrders(s);}}
                    style={{background:orderFilter===s?'rgba(200,153,42,0.2)':'rgba(200,153,42,0.05)',border:`1px solid ${orderFilter===s?GOLD:GB}`,borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:orderFilter===s?700:400,cursor:'pointer',fontFamily:DM,color:orderFilter===s?GL:'rgba(200,153,42,0.5)',transition:'all .15s'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{fontSize:12,color:'rgba(200,153,42,0.4)',marginBottom:14,fontFamily:DM}}>{allOrders.length} orders shown</div>
            {allOrders.length===0?EMPTY('No orders found'):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {allOrders.map(o=>(
                  <div key={o.id} style={{...CARD,padding:'16px 20px',display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:700,color:'#f0ede4'}}>#{o.order_number}</span>
                        <OSPill s={o.status}/>
                      </div>
                      <div style={{fontSize:12,color:'rgba(200,153,42,0.45)'}}>👤 {o.buyer_name||'Guest'} · {o.delivery_phone||o.buyer_phone||'—'}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.3)',marginTop:2}}>{fmt(o.created_at)} · {o.delivery_district||'—'}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:800,color:GL,fontFamily:PF}}>{money(o.total)}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',marginTop:2}}>{o.payment_method||'—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {!loading&&tab==='users'&&(
          <div>
            <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4',flex:1}}>All Users</h2>
              <input value={userSearch} onChange={e=>setUserSearch(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&loadUsers(userSearch)}
                placeholder="Search name / phone / email…"
                style={{background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.25)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#f0ede4',outline:'none',fontFamily:DM,minWidth:240}}/>
              <button onClick={()=>loadUsers(userSearch)} style={{...ABT('search-users'),padding:'10px 20px'}}>Search</button>
            </div>
            <div style={{fontSize:12,color:'rgba(200,153,42,0.4)',marginBottom:14}}>{allUsers.length} users shown</div>
            {allUsers.length===0?EMPTY('No users found'):(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {allUsers.map(u=>(
                  <div key={u.id} style={{...CARD,padding:'16px 20px',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{width:42,height:42,borderRadius:'50%',background:GSHINE,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'#07070e',flexShrink:0}}>
                      {(u.name||'?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#f0ede4',marginBottom:3}}>{u.name}</div>
                      <div style={{fontSize:12,color:'rgba(200,153,42,0.55)'}}>{u.phone||'—'} {u.email?`· ${u.email}`:''}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.35)',marginTop:2}}>📍 {u.district||'—'} · Joined {fmt(u.created_at)}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:GL,fontFamily:PF}}>{u.order_count} orders</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',marginTop:2}}>{money(u.total_spent)} spent</div>
                    </div>
                    <div style={{flexShrink:0,display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:8,background:u.is_active?'rgba(74,222,128,0.12)':'rgba(248,113,113,0.12)',color:u.is_active?'#4ade80':'#f87171',border:`1px solid ${u.is_active?'rgba(74,222,128,0.3)':'rgba(248,113,113,0.3)'}`,fontFamily:DM}}>
                        {u.is_active?'Active':'Suspended'}
                      </span>
                      <button disabled={!!acting} onClick={()=>act(`/api/admin/users/${u.id}/toggle`,`${u.name} ${u.is_active?'suspended':'activated'}`)}
                        style={{...RBT(`tog-${u.id}`),padding:'6px 14px',fontSize:11}}>
                        {u.is_active?'Suspend':'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ALL SELLERS ── */}
        {!loading&&tab==='sellers'&&(
          <div>
            <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4',flex:1}}>All Sellers</h2>
              <input value={sellerSearch} onChange={e=>setSellerSearch(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&loadAllSellers(sellerSearch)}
                placeholder="Search shop / phone / email…"
                style={{background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.25)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#f0ede4',outline:'none',fontFamily:DM,minWidth:240}}/>
              <button onClick={()=>loadAllSellers(sellerSearch)} style={{...ABT('search-sellers'),padding:'10px 20px'}}>Search</button>
            </div>
            <div style={{fontSize:12,color:'rgba(200,153,42,0.4)',marginBottom:14}}>{allSellers.length} sellers shown</div>
            {allSellers.length===0?EMPTY('No sellers found'):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {allSellers.map(s=>(
                  <div key={s.id} style={{...CARD,padding:'16px 20px',display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:14,fontWeight:800,color:'#f0ede4'}}>{s.shop_name}</span>
                        <span style={{fontSize:10,fontWeight:700,padding:'2px 9px',borderRadius:8,background:s.is_verified?'rgba(74,222,128,0.12)':'rgba(251,191,36,0.12)',color:s.is_verified?'#4ade80':'#fbbf24',border:`1px solid ${s.is_verified?'rgba(74,222,128,0.3)':'rgba(251,191,36,0.3)'}`}}>
                          {s.is_verified?'✓ Verified':'⏳ Pending'}
                        </span>
                      </div>
                      <div style={{fontSize:12,color:'rgba(200,153,42,0.55)'}}>{s.phone||'—'} {s.email?`· ${s.email}`:''}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.35)',marginTop:2}}>📍 {s.district||'—'} · {s.seller_type||'—'} · Joined {fmt(s.created_at)}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:GL}}>{s.product_count} products</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',marginTop:2}}>Earned: {money(s.total_earned)}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)'}}>Balance: {money(s.available)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYOUTS ── */}
        {!loading&&tab==='payouts'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4',flex:1}}>Payout Management</h2>
              {[['requested','Pending'],['completed','Completed'],['rejected','Rejected']].map(([s,l])=>(
                <button key={s} onClick={()=>{setPayoutFilter(s);loadPayouts(s);}}
                  style={{background:payoutFilter===s?'rgba(200,153,42,0.2)':'rgba(200,153,42,0.04)',border:`1px solid ${payoutFilter===s?GOLD:GB}`,borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:payoutFilter===s?700:400,cursor:'pointer',fontFamily:DM,color:payoutFilter===s?GL:'rgba(200,153,42,0.45)',transition:'all .15s'}}>
                  {l}
                </button>
              ))}
            </div>
            {payouts.length===0?EMPTY(`No ${payoutFilter} payouts`):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {payouts.map(p=>(
                  <div key={p.id} style={{...CARD,padding:'18px 22px'}}>
                    <div style={{display:'flex',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{fontSize:15,fontWeight:800,color:'#f0ede4',marginBottom:4}}>{p.shop_name}</div>
                        <div style={{fontSize:12,color:'rgba(200,153,42,0.55)',marginBottom:3}}>{p.seller_phone||'—'} {p.seller_email?`· ${p.seller_email}`:''}</div>
                        <div style={{fontSize:11,color:'rgba(200,153,42,0.35)'}}>Requested: {fmt(p.created_at)}{p.processed_at?` · Processed: ${fmt(p.processed_at)}`:''}</div>
                        {p.notes&&<div style={{fontSize:11,color:'rgba(200,153,42,0.45)',marginTop:4,fontStyle:'italic'}}>{p.notes}</div>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:22,fontWeight:900,color:GL,fontFamily:PF}}>{money(p.amount)}</div>
                        <div style={{fontSize:11,color:'rgba(200,153,42,0.5)',marginTop:3}}>{p.method==='mtn_momo'?'MTN MoMo':'Airtel Money'} · {p.account_number||'—'}</div>
                        <div style={{marginTop:8}}>
                          <span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:8,background:p.status==='completed'?'rgba(74,222,128,0.12)':p.status==='rejected'?'rgba(248,113,113,0.12)':'rgba(251,191,36,0.12)',color:p.status==='completed'?'#4ade80':p.status==='rejected'?'#f87171':'#fbbf24',border:`1px solid ${p.status==='completed'?'rgba(74,222,128,0.3)':p.status==='rejected'?'rgba(248,113,113,0.3)':'rgba(251,191,36,0.3)'}`}}>
                            {p.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {p.status==='requested'&&(
                      <div style={{display:'flex',gap:8,marginTop:14}}>
                        <button disabled={!!acting} style={ABT(`pay-${p.id}`)} onClick={()=>act(`/api/admin/payouts/${p.id}/process`,`Payout of ${money(p.amount)} to ${p.shop_name} processed`)}>
                          {acting===`pay-${p.id}`?'Processing…':'✓ Process Payout'}
                        </button>
                        <button disabled={!!acting} style={RBT(`rej-${p.id}`)} onClick={()=>act(`/api/admin/payouts/${p.id}/reject`,`Payout rejected`,'PATCH',{reason:'Rejected by admin'})}>
                          {acting===`rej-${p.id}`?'Rejecting…':'✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW QUEUE ── */}
        {!loading&&tab==='review'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4',flex:1}}>Review Queue</h2>
              {[
                {k:'products',l:'Products',count:counts.products},
                {k:'farmers',l:'Farmers',count:counts.farmers},
                {k:'sellers',l:'Sellers',count:counts.sellers},
                {k:'realestate',l:'Real Estate',count:counts.realestate},
              ].map(({k,l,count})=>(
                <button key={k} onClick={()=>loadReview(k)}
                  style={{display:'flex',alignItems:'center',gap:6,background:reviewSub===k?'rgba(200,153,42,0.2)':'rgba(200,153,42,0.04)',border:`1px solid ${reviewSub===k?GOLD:GB}`,borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:reviewSub===k?700:400,cursor:'pointer',fontFamily:DM,color:reviewSub===k?GL:'rgba(200,153,42,0.5)',transition:'all .15s'}}>
                  {l}
                  {count>0&&<span style={{background:'#ef4444',color:'#fff',borderRadius:8,padding:'0 6px',fontSize:10,fontWeight:700}}>{count}</span>}
                </button>
              ))}
            </div>

            {/* Products Queue */}
            {reviewSub==='products'&&(
              products.length===0?EMPTY('No products pending review')
                :<div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {products.map(p=>(
                    <div key={p.id} style={CARD}>
                      <div style={{display:'flex',gap:16,alignItems:'flex-start',marginBottom:14}}>
                        {p.main_image&&<img src={p.main_image} alt="" style={{width:80,height:80,objectFit:'cover',borderRadius:10,flexShrink:0,border:'1px solid rgba(200,153,42,0.22)'}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:16,fontWeight:800,color:'#f0ede4',marginBottom:6,fontFamily:PF}}>{p.name}</div>
                          <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:12,marginBottom:6}}>
                            <span style={{color:'rgba(200,153,42,0.75)'}}>🏪 {p.shop_name}</span>
                            <span style={{color:'rgba(200,153,42,0.5)'}}>📍 {p.seller_district||'—'}</span>
                            <span style={{color:'rgba(200,153,42,0.5)'}}>📞 {p.seller_phone||'—'}</span>
                            <span style={{color:GL,fontWeight:700}}>💰 {money(p.price)}</span>
                            <span style={{color:'rgba(200,153,42,0.5)'}}>📅 {fmt(p.created_at)}</span>
                          </div>
                          {p.description&&<div style={{fontSize:12,color:'rgba(200,153,42,0.4)',lineHeight:1.6}}>{p.description.slice(0,200)}{p.description.length>200?'…':''}</div>}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button disabled={!!acting} style={ABT(`approve-${p.id}`)} onClick={()=>act(`/api/admin/products/${p.id}/approve`,`"${p.name}" approved & published`)}>{acting===`approve-${p.id}`?'Approving…':'✓ Approve & Publish'}</button>
                        <button disabled={!!acting} style={RBT(`reject-${p.id}`)} onClick={()=>act(`/api/admin/products/${p.id}/reject`,`"${p.name}" rejected`)}>{acting===`reject-${p.id}`?'Rejecting…':'✕ Reject'}</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* Farmers Queue */}
            {reviewSub==='farmers'&&(
              farmers.length===0?EMPTY('No farmers pending verification')
                :<div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {farmers.map(f=>(
                    <div key={f.id} style={CARD}>
                      <div style={{fontSize:17,fontWeight:800,color:'#f0ede4',marginBottom:6,fontFamily:PF}}>{f.name}</div>
                      <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:12,marginBottom:12}}>
                        <span style={{color:'rgba(200,153,42,0.75)'}}>📞 {f.phone}</span>
                        <span style={{color:'rgba(200,153,42,0.5)'}}>📍 {f.district}{f.sub_county?', '+f.sub_county:''}</span>
                        <span style={{color:'rgba(200,153,42,0.5)'}}>🏡 {f.farm_name||'—'} · {f.farmer_type}</span>
                        {f.is_organic&&<span style={{color:'rgba(100,210,100,0.7)'}}>🌿 Organic</span>}
                        <span style={{color:'rgba(200,153,42,0.35)'}}>📅 {fmt(f.created_at)}</span>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button disabled={!!acting} style={ABT(`verify-${f.id}`)} onClick={()=>act(`/api/admin/farmers/${f.id}/verify`,`${f.name} verified`,'PATCH',{verified:true})}>{acting===`verify-${f.id}`?'Verifying…':'✓ Verify Farmer'}</button>
                        <button disabled={!!acting} style={RBT(`reject-${f.id}`)} onClick={()=>act(`/api/admin/farmers/${f.id}/reject`,`${f.name} rejected`)}>{acting===`reject-${f.id}`?'Rejecting…':'✕ Reject'}</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* Sellers Queue */}
            {reviewSub==='sellers'&&(
              sellers.length===0?EMPTY('No sellers pending verification')
                :<div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {sellers.map(s=>(
                    <div key={s.id} style={CARD}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                        <div style={{fontSize:17,fontWeight:800,color:'#f0ede4',fontFamily:PF}}>{s.shop_name}</div>
                        <span style={{fontSize:10,background:'rgba(200,153,42,0.1)',color:'rgba(200,153,42,0.6)',borderRadius:6,padding:'2px 9px',border:'1px solid rgba(200,153,42,0.2)',fontWeight:700}}>{s.seller_type}</span>
                      </div>
                      <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:12,marginBottom:12}}>
                        <span style={{color:'rgba(200,153,42,0.75)'}}>📞 {s.phone||'—'}</span>
                        <span style={{color:'rgba(200,153,42,0.5)'}}>📧 {s.email||'—'}</span>
                        <span style={{color:'rgba(200,153,42,0.5)'}}>📍 {s.district||'—'}</span>
                        {s.business_tin&&<span style={{color:'rgba(200,153,42,0.5)'}}>🏛 TIN: {s.business_tin}</span>}
                        <span style={{color:'rgba(200,153,42,0.35)'}}>📅 {fmt(s.created_at)}</span>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <button disabled={!!acting} style={ABT(`verify-${s.id}`)} onClick={()=>act(`/api/admin/sellers/${s.id}/verify`,`${s.shop_name} verified`,'PATCH',{verified:true})}>{acting===`verify-${s.id}`?'Verifying…':'✓ Verify Seller'}</button>
                        <button disabled={!!acting} style={RBT(`reject-${s.id}`)} onClick={()=>act(`/api/admin/sellers/${s.id}/reject`,`${s.shop_name} rejected`)}>{acting===`reject-${s.id}`?'Rejecting…':'✕ Reject'}</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {/* Real Estate Queue */}
            {reviewSub==='realestate'&&(
              realestate.length===0?EMPTY('No real estate listings pending review')
                :<div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {realestate.map(l=>(
                    <div key={l.id} style={CARD}>
                      <div style={{fontSize:16,fontWeight:800,color:'#f0ede4',marginBottom:6,fontFamily:PF}}>{l.title}</div>
                      <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:12,marginBottom:8}}>
                        <span style={{color:'rgba(200,153,42,0.75)'}}>📋 {l.listing_type}</span>
                        <span style={{color:'rgba(200,153,42,0.5)'}}>📍 {l.district}{l.area?', '+l.area:''}</span>
                        <span style={{color:GL,fontWeight:700}}>💰 {money(l.price)}{l.price_type==='monthly'?' /mo':l.price_type==='acre'?' /acre':''}</span>
                        {l.bedrooms&&<span style={{color:'rgba(200,153,42,0.5)'}}>🛏 {l.bedrooms} bed</span>}
                        <span style={{color:'rgba(200,153,42,0.35)'}}>📅 {fmt(l.created_at)}</span>
                      </div>
                      {l.description&&<div style={{fontSize:12,color:'rgba(200,153,42,0.4)',lineHeight:1.6,marginBottom:10}}>{l.description.slice(0,160)}{l.description.length>160?'…':''}</div>}
                      <div style={{display:'flex',gap:8}}>
                        <button disabled={!!acting} style={ABT(`approve-${l.id}`)} onClick={()=>act(`/api/admin/realestate/${l.id}/approve`,`"${l.title}" published`)}>{acting===`approve-${l.id}`?'Publishing…':'✓ Approve & Publish'}</button>
                        <button disabled={!!acting} style={RBT(`reject-${l.id}`)} onClick={()=>act(`/api/admin/realestate/${l.id}/reject`,`"${l.title}" deleted`)}>{acting===`reject-${l.id}`?'Deleting…':'✕ Delete'}</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function AdminDeliveryPage(){
  const [tab,setTab]=useState('agents');
  const [agents,setAgents]=useState([]);
  const [active,setActive]=useState([]);
  const [earnings,setEarnings]=useState([]);
  const [key,setKey]=useState(()=>localStorage.getItem('admin_key')||'');
  const [keyInput,setKeyInput]=useState('');
  const [authed,setAuthed]=useState(()=>localStorage.getItem('admin_key')===ADMIN_KEY);

  const hdr=()=>({'x-admin-key':key||ADMIN_KEY});

  const load=async()=>{
    try{
      const [ag,ac,ea]=await Promise.all([
        fetch('/api/delivery/admin/agents',{headers:hdr()}).then(r=>r.json()),
        fetch('/api/delivery/admin/active',{headers:hdr()}).then(r=>r.json()),
        fetch('/api/delivery/admin/earnings',{headers:hdr()}).then(r=>r.json()),
      ]);
      if(ag.success)setAgents(ag.agents||[]);
      if(ac.success)setActive(ac.deliveries||[]);
      if(ea.success)setEarnings(ea.agents||[]);
    }catch(e){}
  };

  useEffect(()=>{if(authed)load();},[authed]);

  const verify=async(id,verified)=>{
    await fetch(`/api/delivery/admin/agents/${id}/verify`,{method:'PATCH',headers:{'Content-Type':'application/json',...hdr()},body:JSON.stringify({verified})});
    load();
  };

  if(!authed)return(
    <div style={{background:LIGHT,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:36,maxWidth:340,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🔐</div>
        <h2 style={{fontSize:18,fontWeight:700,color:TEXT,marginBottom:16}}>Admin Access</h2>
        <input type="password" placeholder="Admin key" value={keyInput} onChange={e=>setKeyInput(e.target.value)}
          style={{width:'100%',border:`1px solid ${BORDER}`,borderRadius:4,padding:'10px 14px',fontSize:14,marginBottom:12,fontFamily:SF,boxSizing:'border-box',outline:'none'}}/>
        <button onClick={()=>{setKey(keyInput);localStorage.setItem('admin_key',keyInput);setAuthed(keyInput===ADMIN_KEY)}}
          style={{width:'100%',background:YELLOW,color:TEXT,border:'none',borderRadius:4,padding:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
          Enter
        </button>
      </div>
    </div>
  );

  const TabBtn=({id,label})=>(
    <button onClick={()=>setTab(id)} style={{padding:'8px 20px',border:'none',borderRadius:4,fontSize:14,fontWeight:600,cursor:'pointer',background:tab===id?YELLOW:'transparent',color:tab===id?TEXT:MUTED}}>
      {label}
    </button>
  );

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      <div style={{background:NAVY,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{color:WHITE,fontWeight:700,fontSize:18}}>256 Delivery — Admin Panel</div>
        <button onClick={()=>{localStorage.removeItem('admin_key');setAuthed(false);}} style={{background:'transparent',border:'1px solid #555',borderRadius:4,color:'#aaa',padding:'6px 12px',fontSize:13,cursor:'pointer'}}>Logout</button>
      </div>
      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
          {[
            {l:'Total Agents',v:agents.length},
            {l:'Verified Agents',v:agents.filter(a=>a.is_verified).length},
            {l:'On Duty Now',v:agents.filter(a=>a.is_on_duty).length},
            {l:'Active Deliveries',v:active.length},
          ].map(s=>(
            <div key={s.l} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,padding:'16px 20px',textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:700,color:NAVY}}>{s.v}</div>
              <div style={{fontSize:13,color:MUTED}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:16,background:WHITE,border:`1px solid ${BORDER}`,borderRadius:6,padding:6,width:'fit-content'}}>
          <TabBtn id="agents" label="Delivery Agents"/>
          <TabBtn id="active" label="Active Deliveries"/>
          <TabBtn id="earnings" label="Earnings Report"/>
        </div>

        {/* Agents Tab */}
        {tab==='agents'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,fontWeight:700,color:TEXT}}>
              Registered Agents ({agents.length})
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:LIGHT}}>
                    {['Name','Phone','Vehicle','Plate','Deliveries','Earnings','Status','Action'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:MUTED,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a=>(
                    <tr key={a.id} style={{borderBottom:`1px solid ${LIGHT}`}}>
                      <td style={{padding:'10px 14px',fontWeight:600}}>{a.full_name}</td>
                      <td style={{padding:'10px 14px',color:MUTED}}>{a.phone}</td>
                      <td style={{padding:'10px 14px'}}>{a.vehicle_type}</td>
                      <td style={{padding:'10px 14px',color:MUTED}}>{a.plate_number||'—'}</td>
                      <td style={{padding:'10px 14px'}}>{a.total_deliveries}</td>
                      <td style={{padding:'10px 14px',fontWeight:600}}>UGX {Number(a.total_earnings).toLocaleString()}</td>
                      <td style={{padding:'10px 14px'}}>
                        {a.is_verified
                          ?<span style={{background:'#d4edda',color:GREEN,padding:'2px 8px',borderRadius:10,fontSize:12}}>✓ Verified</span>
                          :<span style={{background:'#fff3cd',color:'#856404',padding:'2px 8px',borderRadius:10,fontSize:12}}>⏳ Pending</span>}
                        {a.is_on_duty&&<span style={{background:'#d4edda',color:GREEN,padding:'2px 8px',borderRadius:10,fontSize:12,marginLeft:4}}>ON DUTY</span>}
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        {!a.is_verified
                          ?<button onClick={()=>verify(a.id,true)} style={{background:GREEN,color:WHITE,border:'none',borderRadius:4,padding:'4px 10px',fontSize:12,cursor:'pointer',marginRight:4}}>Verify</button>
                          :<button onClick={()=>verify(a.id,false)} style={{background:RED,color:WHITE,border:'none',borderRadius:4,padding:'4px 10px',fontSize:12,cursor:'pointer'}}>Revoke</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {agents.length===0&&<div style={{padding:24,textAlign:'center',color:MUTED}}>No agents registered yet.</div>}
            </div>
          </div>
        )}

        {/* Active Deliveries Tab */}
        {tab==='active'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,fontWeight:700,color:TEXT}}>
              Active Deliveries ({active.length})
            </div>
            {active.map(d=>(
              <div key={d.id} style={{padding:'14px 20px',borderBottom:`1px solid ${LIGHT}`,display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:600,color:TEXT}}>Delivery #{d.id}</div>
                  <div style={{fontSize:13,color:MUTED}}>From: {d.seller_address} → To: {d.buyer_address}</div>
                  <div style={{fontSize:13,color:MUTED}}>Type: {d.delivery_type} · {d.distance_km}km · UGX {Number(d.delivery_fee).toLocaleString()}</div>
                </div>
                <div>
                  {d.agent_name?(
                    <div style={{fontSize:13}}>
                      <div style={{fontWeight:600}}>{d.agent_name}</div>
                      <div style={{color:MUTED}}>{d.agent_phone}</div>
                    </div>
                  ):<span style={{color:MUTED,fontSize:13}}>No agent yet</span>}
                </div>
                <span style={{background:d.status==='delivered'?'#d4edda':d.status==='picked_up'?'#cce5ff':'#fff3cd',
                  color:d.status==='delivered'?GREEN:d.status==='picked_up'?'#004085':'#856404',
                  padding:'4px 10px',borderRadius:10,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>
                  {d.status.replace('_',' ')}
                </span>
              </div>
            ))}
            {active.length===0&&<div style={{padding:24,textAlign:'center',color:MUTED}}>No active deliveries.</div>}
          </div>
        )}

        {/* Earnings Tab */}
        {tab==='earnings'&&(
          <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:8,overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${BORDER}`,fontWeight:700,color:TEXT}}>Agent Earnings Report</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:LIGHT}}>
                    {['Agent','Phone','Vehicle','Total Deliveries','Today','Total Earnings','Rating'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:MUTED}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((a,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${LIGHT}`}}>
                      <td style={{padding:'10px 14px',fontWeight:600}}>{a.full_name}</td>
                      <td style={{padding:'10px 14px',color:MUTED}}>{a.phone}</td>
                      <td style={{padding:'10px 14px'}}>{a.vehicle_type}</td>
                      <td style={{padding:'10px 14px'}}>{a.total_deliveries}</td>
                      <td style={{padding:'10px 14px',color:GREEN,fontWeight:600}}>UGX {Number(a.today_earnings).toLocaleString()}</td>
                      <td style={{padding:'10px 14px',fontWeight:700}}>UGX {Number(a.total_earnings).toLocaleString()}</td>
                      <td style={{padding:'10px 14px'}}>★ {Number(a.rating||5).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {earnings.length===0&&<div style={{padding:24,textAlign:'center',color:MUTED}}>No earnings data yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Launch Gate ───────────────────────────────────────────────────────────────
function LaunchGatePage(){
  const [email,setEmail]=React.useState('');
  const [sent,setSent]=React.useState(false);
  return(
    <div style={{minHeight:'100vh',background:'#050810',display:'flex',flexDirection:'column',fontFamily:DM,position:'relative',overflow:'hidden'}}>
      {/* Background glow */}
      <div style={{position:'absolute',top:'-20%',left:'50%',transform:'translateX(-50%)',width:600,height:600,background:'radial-gradient(circle,rgba(255,216,20,.08) 0%,transparent 70%)',pointerEvents:'none'}}/>

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center',position:'relative'}}>
        {/* 256 family badge */}
        <a href="https://256.co.ug" style={{textDecoration:'none',marginBottom:40,display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:20,padding:'6px 16px'}}>
          <span style={{fontSize:14}}>🇺🇬</span>
          <span style={{fontSize:12,color:'rgba(255,255,255,.5)',letterSpacing:.5}}>Part of the</span>
          <span style={{fontSize:12,fontWeight:700,color:YELLOW,letterSpacing:.5}}>256 AI Technologies</span>
          <span style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>family</span>
        </a>

        {/* Logo */}
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:BN,fontSize:'clamp(52px,12vw,80px)',lineHeight:1,letterSpacing:2,color:WHITE}}>
            256 <span style={{color:YELLOW}}>MALL</span>
          </div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.35)',letterSpacing:4,textTransform:'uppercase',marginTop:6}}>Uganda's Digital Marketplace</div>
        </div>

        {/* Coming soon card */}
        <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,216,20,.3)',borderRadius:16,padding:'36px 40px',maxWidth:520,width:'100%',marginBottom:36,backdropFilter:'blur(10px)'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,216,20,.1)',border:'1px solid rgba(255,216,20,.3)',borderRadius:20,padding:'5px 14px',marginBottom:20}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:YELLOW,display:'inline-block',boxShadow:'0 0 8px '+YELLOW}}/>
            <span style={{fontSize:11,fontWeight:700,color:YELLOW,letterSpacing:1,textTransform:'uppercase'}}>Coming Soon</span>
          </div>
          <h2 style={{fontSize:'clamp(20px,5vw,28px)',fontWeight:800,color:WHITE,margin:'0 0 12px',lineHeight:1.3}}>
            We're putting the finishing touches on something great
          </h2>
          <p style={{fontSize:14,color:'rgba(255,255,255,.5)',lineHeight:1.7,margin:'0 0 24px'}}>
            Thousands of verified Ugandan sellers · Electronics, fashion, fresh produce & more · Delivered to all 146 districts · Pay with MTN MoMo or Airtel Money
          </p>
          {!sent?(
            <div style={{display:'flex',gap:8,maxWidth:380,margin:'0 auto'}}>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email for early access"
                style={{flex:1,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,padding:'11px 14px',fontSize:13,color:WHITE,outline:'none',fontFamily:DM}}
                onKeyDown={e=>e.key==='Enter'&&email.includes('@')&&setSent(true)}/>
              <button onClick={()=>email.includes('@')&&setSent(true)}
                style={{background:YELLOW,color:TEXT,border:'none',borderRadius:8,padding:'11px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM,flexShrink:0}}>
                Notify Me
              </button>
            </div>
          ):(
            <div style={{background:'rgba(22,163,74,.15)',border:'1px solid rgba(22,163,74,.3)',borderRadius:8,padding:'12px 20px',color:'#86efac',fontSize:13,fontWeight:600}}>
              ✓ You're on the list! We'll email you when 256 Mall launches.
            </div>
          )}
        </div>

        {/* Other 256 products */}
        <div style={{marginBottom:12,fontSize:12,color:'rgba(255,255,255,.3)',letterSpacing:.5,textTransform:'uppercase'}}>Explore our other products</div>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center',maxWidth:600}}>
          {[
            {name:'256 Delivery',desc:'Fast local delivery across Uganda',href:'https://delivery.256.ug',icon:'🚚',color:'#0ea5e9'},
            {name:'256 AI',desc:'AI assistant for Uganda',href:'https://256.co.ug',icon:'🤖',color:'#7c3aed'},
            {name:'256 Social',desc:'Uganda social network',href:'https://social.256.co.ug',icon:'👥',color:'#16a34a'},
            {name:'Portal',desc:'Manage all your 256 services',href:'https://portal.256.co.ug',icon:'🔑',color:'#f59e0b'},
          ].map(p=>(
            <a key={p.name} href={p.href} target="_blank" rel="noreferrer"
              style={{textDecoration:'none',display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'10px 16px',transition:'all .15s',minWidth:180}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.08)';e.currentTarget.style.borderColor='rgba(255,255,255,.2)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.04)';e.currentTarget.style.borderColor='rgba(255,255,255,.08)';}}>
              <div style={{width:36,height:36,borderRadius:8,background:p.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{p.icon}</div>
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:13,fontWeight:700,color:WHITE}}>{p.name}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.35)',marginTop:1}}>{p.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{textAlign:'center',padding:'16px',fontSize:11,color:'rgba(255,255,255,.2)'}}>
        © 2026 256 AI Technologies · Kampala, Uganda · <a href="mailto:hello@256.co.ug" style={{color:'rgba(255,255,255,.3)',textDecoration:'none'}}>hello@256.co.ug</a>
      </div>
    </div>
  );
}

// ── Animal Market Dashboard ───────────────────────────────────────────────────
function AnimalDashboardPage(){
  const nav=useNavigate();
  const FARMER_KEY='256mall_farmer_token';
  const tok=()=>localStorage.getItem(FARMER_KEY);
  const api=(url,opts={})=>fetch(url,{...opts,headers:{...(opts.headers||{}),'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json',...(opts.headers||{})}});
  const [tab,setTab]=useState('overview');
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [loginForm,setLoginForm]=useState({phone:'',password:''});
  const [loginErr,setLoginErr]=useState('');
  const [loginLoading,setLoginLoading]=useState(false);

  const load=async()=>{
    if(!tok()){setLoading(false);return;}
    setLoading(true);
    try{
      const r=await api('/api/farmers/me');
      const d=await r.json();
      if(!r.ok){if(r.status===401){localStorage.removeItem(FARMER_KEY);}setError(d.error||'Failed');setLoading(false);return;}
      setData(d);
    }catch(e){setError('Connection error');}finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);

  const login=async()=>{
    setLoginLoading(true);setLoginErr('');
    try{
      const r=await fetch('/api/farmers/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(loginForm)});
      const d=await r.json();
      if(!r.ok){setLoginErr(d.error||'Login failed');return;}
      localStorage.setItem(FARMER_KEY,d.token);
      load();
    }catch{setLoginErr('Connection error');}finally{setLoginLoading(false);}
  };

  const ugx=n=>n?'UGX '+parseInt(n).toLocaleString():'—';
  const fmtDate=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';

  if(loading)return(<div style={{background:'#1a0a00',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}><div style={{color:'#f59e0b',fontSize:14}}>Loading…</div></div>);

  if(!tok()||error==='Invalid token')return(
    <div style={{background:'#1a0a00',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:SF,padding:16}}>
      <div style={{background:'#2a1800',border:'1px solid #f59e0b',borderRadius:14,padding:'36px 28px',maxWidth:400,width:'100%'}}>
        <div style={{fontSize:40,textAlign:'center',marginBottom:12}}>🐄</div>
        <h2 style={{fontSize:20,fontWeight:800,color:WHITE,textAlign:'center',marginBottom:4}}>Animal Market Dashboard</h2>
        <p style={{fontSize:13,color:'#d4a96a',textAlign:'center',marginBottom:24}}>Sign in with your phone and password to manage your listings.</p>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <input placeholder="Phone number (e.g. 0701234567)" value={loginForm.phone} onChange={e=>setLoginForm(p=>({...p,phone:e.target.value}))}
            style={{width:'100%',border:'1px solid #f59e0b44',borderRadius:8,padding:'12px 14px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:WHITE,background:'#1a0a00'}}/>
          <input placeholder="Password" type="password" value={loginForm.password} onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))}
            style={{width:'100%',border:'1px solid #f59e0b44',borderRadius:8,padding:'12px 14px',fontSize:14,fontFamily:SF,outline:'none',boxSizing:'border-box',color:WHITE,background:'#1a0a00'}}/>
          {loginErr&&<div style={{fontSize:12,color:'#f87171',background:'rgba(239,68,68,.1)',borderRadius:6,padding:'8px 12px'}}>{loginErr}</div>}
          <button onClick={login} disabled={loginLoading}
            style={{background:'#f59e0b',color:'#1a0a00',border:'none',borderRadius:8,padding:'12px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
            {loginLoading?'Signing in…':'Sign In →'}
          </button>
          <button onClick={()=>nav('/animals/register')} style={{background:'transparent',color:'#f59e0b',border:'1px solid #f59e0b44',borderRadius:8,padding:'10px',fontSize:13,cursor:'pointer',fontFamily:DM}}>
            Register as Animal Seller
          </button>
        </div>
      </div>
    </div>
  );

  const farmer=data?.farmer||{};
  const stats=data?.stats||{};
  const listings=data?.listings||[];

  return(
    <div style={{background:'#1a0a00',minHeight:'100vh',fontFamily:DM}}>
      {/* Header */}
      <div style={{background:'#2a1800',borderBottom:'1px solid #f59e0b44',padding:'20px 16px 0'}}>
        <div style={{maxWidth:860,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
            <div style={{width:48,height:48,borderRadius:12,background:'#f59e0b22',border:'1px solid #f59e0b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🐄</div>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:800,color:WHITE}}>{farmer.farm_name||farmer.name}</div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:2}}>
                <span style={{fontSize:11,background:farmer.is_verified?'#22c55e':'#f59e0b',color:'#1a0a00',borderRadius:10,padding:'2px 9px',fontWeight:700}}>
                  {farmer.is_verified?'✓ Verified':'⏳ Under Review'}
                </span>
                <span style={{fontSize:11,color:'#d4a96a'}}>{farmer.district}</span>
              </div>
            </div>
            <button onClick={()=>{localStorage.removeItem(FARMER_KEY);nav('/animals/register');}} style={{fontSize:11,color:'#d4a96a',background:'transparent',border:'1px solid #f59e0b33',borderRadius:6,padding:'5px 10px',cursor:'pointer',fontFamily:DM}}>Sign Out</button>
          </div>
          <div style={{display:'flex',gap:0}}>
            {[['overview','📊','Overview'],['listings','🐄','My Listings'],['profile','🏡','Farm Profile']].map(([id,ic,lb])=>(
              <button key={id} onClick={()=>setTab(id)} style={{display:'flex',alignItems:'center',gap:5,padding:'10px 14px',background:'transparent',border:'none',borderBottom:`3px solid ${tab===id?'#f59e0b':'transparent'}`,color:tab===id?'#f59e0b':'#d4a96a',fontSize:13,fontWeight:tab===id?700:400,cursor:'pointer',fontFamily:SF,whiteSpace:'nowrap'}}>
                <span>{ic}</span>{lb}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'24px 16px 60px'}}>

        {tab==='overview'&&(
          <div>
            {/* Verification banner */}
            {!farmer.is_verified&&(
              <div style={{background:'#2a1800',border:'1px solid #f59e0b',borderRadius:12,padding:'16px',marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:700,color:'#f59e0b',marginBottom:4}}>⏳ Verification in progress</div>
                <div style={{fontSize:13,color:'#d4a96a',lineHeight:1.6}}>Our compliance team is verifying your health certificates and vaccination records. This takes up to 24 hours. Once verified, you can start listing animals.</div>
              </div>
            )}
            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
              {[
                {label:'Live Listings', val:stats.live||0,    icon:'✅', color:'#22c55e'},
                {label:'Total Listings',val:stats.total||0,   icon:'🐄', color:'#f59e0b'},
                {label:'Total Sales',   val:farmer.total_sales||0,icon:'💰',color:'#60a5fa'},
              ].map(s=>(
                <div key={s.label} style={{background:'#2a1800',border:`1px solid ${s.color}33`,borderRadius:12,padding:'16px 12px',textAlign:'center'}}>
                  <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.val}</div>
                  <div style={{fontSize:11,color:'#d4a96a',marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Farm details */}
            <div style={{background:'#2a1800',border:'1px solid #f59e0b33',borderRadius:12,padding:'18px'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#f59e0b',marginBottom:12}}>Farm Details</div>
              {[['Farmer',farmer.name],['Phone',farmer.phone],['District',farmer.district],['Sub-county',farmer.sub_county],['Village',farmer.village],['Farm size',farmer.farm_size_acres?`${farmer.farm_size_acres} acres`:null],['Farmer type',farmer.farmer_type],['Member since',fmtDate(farmer.created_at)]].map(([k,v])=>v?(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'8px 0',borderBottom:'1px solid #f59e0b11'}}>
                  <span style={{color:'#d4a96a'}}>{k}</span>
                  <span style={{color:WHITE,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span>
                </div>
              ):null)}
            </div>
          </div>
        )}

        {tab==='listings'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:800,color:WHITE}}>My Listings</div>
              <button onClick={()=>nav('/produce')} style={{background:'#f59e0b',color:'#1a0a00',border:'none',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM}}>Browse Produce Market →</button>
            </div>
            {listings.length===0
              ?<div style={{textAlign:'center',padding:'48px 0',color:'#d4a96a'}}>
                  <div style={{fontSize:36,marginBottom:12}}>🐄</div>
                  <div style={{fontSize:14,marginBottom:8}}>{farmer.is_verified?'No listings yet. Start adding your animals.':'Your account is under review before you can list.'}</div>
                </div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {listings.map(l=>(
                  <div key={l.id} style={{background:'#2a1800',border:'1px solid #f59e0b33',borderRadius:10,padding:'14px',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:52,height:52,borderRadius:8,background:'#1a0a00',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🐄</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:WHITE,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.product_name}</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {l.retail_price&&<span style={{fontSize:13,fontWeight:700,color:'#f59e0b'}}>{ugx(l.retail_price)}</span>}
                        <span style={{fontSize:11,color:'#d4a96a'}}>{l.district}</span>
                        <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:l.is_available?'#16a34a22':'#99182222',color:l.is_available?'#22c55e':'#f87171'}}>{l.is_available?'Live':'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {tab==='profile'&&(
          <div style={{background:'#2a1800',border:'1px solid #f59e0b33',borderRadius:12,padding:'20px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#f59e0b',marginBottom:14}}>Farm & Personal Profile</div>
            {[['Name',farmer.name],['Phone',farmer.phone],['NIN',farmer.nin],['District',farmer.district],['Sub-county',farmer.sub_county],['Village',farmer.village],['Farm Name',farmer.farm_name],['Farm Size',farmer.farm_size_acres?`${farmer.farm_size_acres} acres`:null],['Farmer Type',farmer.farmer_type],['Cooperative',farmer.is_cooperative?farmer.cooperative_name||'Yes':'No']].map(([k,v])=>v?(
              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'10px 0',borderBottom:'1px solid #f59e0b11'}}>
                <span style={{color:'#d4a96a'}}>{k}</span>
                <span style={{color:WHITE,fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{v}</span>
              </div>
            ):null)}
            <a href="https://wa.me/256200900256?text=I+need+help+with+my+Animal+Market+seller+account" target="_blank" rel="noopener noreferrer"
              style={{display:'block',marginTop:16,background:'#25D366',color:WHITE,borderRadius:8,padding:'11px',textAlign:'center',fontSize:13,fontWeight:700,textDecoration:'none',fontFamily:DM}}>
              💬 Contact Support on WhatsApp
            </a>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Real Estate Dashboard ─────────────────────────────────────────────────────
function RealEstateDashboardPage(){
  const nav=useNavigate();
  const [listings,setListings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [phone,setPhone]=useState('');
  const [searched,setSearched]=useState(false);
  const [toggling,setToggling]=useState(null);
  const GREEN='#16a34a';

  const ugx=n=>n?'UGX '+parseInt(n).toLocaleString():'Price on request';
  const fmtDate=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';

  // Load listings stored in localStorage + any new ones from this session
  const loadByIds=async()=>{
    const stored=JSON.parse(localStorage.getItem('256mall_re_ids')||'[]');
    if(!stored.length){setLoading(false);return;}
    try{
      const r=await fetch('/api/realestate/my-listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:stored})});
      const d=await r.json();
      if(d.success)setListings(d.listings||[]);
    }catch{}finally{setLoading(false);}
  };

  const searchByPhone=async()=>{
    if(!phone.trim())return;
    setLoading(true);
    try{
      const r=await fetch('/api/realestate/my-listings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:phone.trim()})});
      const d=await r.json();
      if(d.success){setListings(d.listings||[]);setSearched(true);}
    }catch{}finally{setLoading(false);}
  };

  useEffect(()=>{loadByIds();},[]);

  const toggleAvail=async(id,cur,contactPhone)=>{
    setToggling(id);
    try{
      const r=await fetch(`/api/realestate/${id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_available:!cur,contact_phone:contactPhone})});
      const d=await r.json();
      if(d.success)setListings(ls=>ls.map(l=>l.id===id?{...l,is_available:d.listing.is_available}:l));
    }catch{}finally{setToggling(null);}
  };

  const TYPE_LABELS={land:'Land','house-sale':'House for Sale','house-rent':'House for Rent',commercial:'Commercial',farmland:'Farm Land'};

  return(
    <div style={{background:LIGHT,minHeight:'100vh',fontFamily:DM}}>
      <div style={{background:`linear-gradient(135deg,#14532d 0%,#166534 100%)`,padding:'24px 16px',textAlign:'center'}}>
        <div style={{fontSize:13,color:'rgba(255,255,255,.5)',letterSpacing:1,marginBottom:4}}>256 REAL ESTATE · LISTING MANAGER</div>
        <h1 style={{fontSize:22,fontWeight:800,color:WHITE,margin:'0 0 4px'}}>My Property Listings</h1>
        <p style={{fontSize:13,color:'rgba(255,255,255,.65)'}}>Manage your submitted properties</p>
      </div>

      <div style={{maxWidth:720,margin:'0 auto',padding:'24px 16px 60px'}}>

        {/* Phone lookup */}
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:12,padding:'18px',marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:10}}>🔍 Find listings by phone number</div>
          <div style={{display:'flex',gap:8}}>
            <input placeholder="Enter the phone number you used when listing" value={phone} onChange={e=>setPhone(e.target.value)}
              style={{flex:1,border:`1px solid ${BORDER}`,borderRadius:8,padding:'10px 13px',fontSize:13,fontFamily:DM,outline:'none',color:TEXT,background:WHITE}}
              onKeyDown={e=>e.key==='Enter'&&searchByPhone()}/>
            <button onClick={searchByPhone} style={{background:GREEN,color:WHITE,border:'none',borderRadius:8,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM,flexShrink:0}}>Search</button>
          </div>
          <p style={{fontSize:11,color:MUTED,margin:'8px 0 0',lineHeight:1.5}}>Enter the exact phone number you provided when submitting the listing.</p>
        </div>

        {loading
          ?<div style={{textAlign:'center',padding:'40px 0',color:MUTED}}>Loading…</div>
          :listings.length===0
            ?<div style={{textAlign:'center',padding:'48px 0',color:MUTED}}>
                <div style={{fontSize:40,marginBottom:12}}>🏘️</div>
                <div style={{fontSize:14,marginBottom:6}}>{searched?'No listings found for that phone number.':'No listings found.'}</div>
                <div style={{fontSize:13,marginBottom:20,color:MUTED}}>Search by phone number above, or submit a new listing.</div>
                <button onClick={()=>nav('/realestate/list')} style={{background:GREEN,color:WHITE,border:'none',borderRadius:8,padding:'11px 24px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:DM}}>+ List a Property</button>
              </div>
            :<div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{listings.length} listing{listings.length!==1?'s':''} found</div>
                <button onClick={()=>nav('/realestate/list')} style={{background:GREEN,color:WHITE,border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:DM}}>+ Add Listing</button>
              </div>
              {listings.map(l=>(
                <div key={l.id} style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:12,padding:'16px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                        <span style={{fontSize:11,background:'#f0fdf4',color:GREEN,border:'1px solid #bbf7d0',borderRadius:8,padding:'2px 8px',fontWeight:600}}>{TYPE_LABELS[l.listing_type]||l.listing_type}</span>
                        <span style={{fontSize:11,color:MUTED}}>{l.district}{l.area?', '+l.area:''}</span>
                        <span style={{fontSize:11,background:l.is_available?'#f0fdf4':'#fff0f0',color:l.is_available?GREEN:RED,border:`1px solid ${l.is_available?'#bbf7d0':'#fca5a5'}`,borderRadius:8,padding:'2px 8px',fontWeight:700}}>{l.is_available?'Available':'Sold/Taken'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:ORANGE}}>{ugx(l.price)}{l.price_type==='monthly'?' /mo':l.price_type==='yearly'?' /yr':''}</div>
                      <div style={{fontSize:11,color:MUTED,marginTop:2}}>Listed {fmtDate(l.created_at)} · 👁 {l.views||0} views</div>
                    </div>
                    <button onClick={()=>toggleAvail(l.id,l.is_available,l.contact_phone)} disabled={toggling===l.id}
                      style={{fontSize:12,fontWeight:700,padding:'7px 16px',borderRadius:8,border:'none',
                        background:l.is_available?'#fff0f0':'#f0fdf4',color:l.is_available?RED:GREEN,
                        cursor:'pointer',fontFamily:DM,opacity:toggling===l.id?.6:1}}>
                      {toggling===l.id?'…':l.is_available?'Mark Sold/Taken':'Mark Available'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ── Buyer Dashboard ───────────────────────────────────────────────────────────
function BuyerDashboardPage({auth}){
  const nav=useNavigate();
  const [searchParams]=useSearchParams();
  const tok=()=>localStorage.getItem('256mall_token');
  const api=(url,opts={})=>fetch(url,{...opts,headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json',...(opts.headers||{})}});

  const [tab,setTab]=useState(searchParams.get('tab')||'home');
  const [profile,setProfile]=useState(null);
  const [counts,setCounts]=useState({});
  const [orders,setOrders]=useState([]);
  const [selOrder,setSelOrder]=useState(null);
  const [addresses,setAddresses]=useState([]);
  const [payments,setPayments]=useState([]);
  const [wishlist,setWishlist]=useState([]);
  const [disputes,setDisputes]=useState([]);
  const [notifications,setNotifications]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState('');

  // Address form
  const blankAddr={label:'home',full_name:'',phone:'',district:'',area:'',address_line:'',landmark:'',is_default:false};
  const [addrForm,setAddrForm]=usePersistedForm('buyer-address',blankAddr);
  const [editAddrId,setEditAddrId]=useState(null);
  const [showAddrForm,setShowAddrForm]=useState(false);

  // Payment form
  const [pmForm,setPmForm]=usePersistedForm('buyer-payment-method',{type:'mtn_momo',phone_number:'',nickname:''});
  const [showPmForm,setShowPmForm]=useState(false);

  // Dispute form
  const blankDisp={order_id:'',reason:'',description:'',preferred_resolution:'refund'};
  const [dispForm,setDispForm]=useState(blankDisp);
  const [showDispForm,setShowDispForm]=useState(false);

  // Settings form
  const settingsEditor=useDraftableForm('buyer-settings');
  const settingsForm=settingsEditor.form,setSettingsForm=settingsEditor.setForm;

  const showToast=(msg,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(''),2800);};
  const ugx=n=>n?'UGX '+parseInt(n).toLocaleString():'UGX 0';
  const fmt=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';

  const STATUS_COLOR={pending:'#92400e',paid:'#1d4ed8',processing:'#6d28d9',shipped:'#0369a1','out_for_delivery':'#0891b2',delivered:'#166534',cancelled:'#991b1b',disputed:'#9a3412',refunded:'#1d4ed8'};
  const STATUS_BG={pending:'#fef3c7',paid:'#dbeafe',processing:'#ede9fe',shipped:'#e0f2fe','out_for_delivery':'#cffafe',delivered:'#dcfce7',cancelled:'#fee2e2',disputed:'#ffedd5',refunded:'#dbeafe'};
  const STATUS_LABEL={pending:'Pending Payment',paid:'Paid',processing:'Processing',shipped:'Shipped','out_for_delivery':'Out for Delivery',delivered:'Delivered',cancelled:'Cancelled',disputed:'Disputed',refunded:'Refunded'};

  const load=async()=>{
    if(!auth?.user&&!tok()){nav('/login?return=/account');return;}
    setLoading(true);
    try{
      const [mr,or,ar,pr,wr,nr]=await Promise.all([
        api('/api/buyers/me'),
        api('/api/buyers/orders?limit=5'),
        api('/api/buyers/addresses'),
        api('/api/buyers/payment-methods'),
        api('/api/buyers/wishlist'),
        api('/api/buyers/notifications'),
      ]);
      const [md,od,ad,pd,wd,nd]=await Promise.all([mr.json(),or.json(),ar.json(),pr.json(),wr.json(),nr.json()]);
      if(md.success){setProfile(md.user);setCounts(md.counts);settingsEditor.hydrate({name:md.user.name||'',email:md.user.email||'',phone:md.user.phone||'',district:md.user.district||'',current_password:'',password:'',confirm_password:''});}
      if(od.success) setOrders(od.orders||[]);
      if(ad.success) setAddresses(ad.addresses||[]);
      if(pd.success) setPayments(pd.methods||[]);
      if(wd.success) setWishlist(wd.items||[]);
      if(nd.success) setNotifications(nd.notifications||[]);
    }catch(e){}
    setLoading(false);
  };

  const loadOrders=async(status)=>{
    const r=await api(`/api/buyers/orders?limit=20${status?'&status='+status:''}`);
    const d=await r.json();
    if(d.success) setOrders(d.orders||[]);
  };

  const loadDisputes=async()=>{
    const r=await api('/api/buyers/disputes');
    const d=await r.json();
    if(d.success) setDisputes(d.disputes||[]);
  };

  useEffect(()=>{load();},[]);
  useEffect(()=>{
    const t=searchParams.get('tab');
    if(t) setTab(t);
  },[searchParams]);
  useEffect(()=>{if(tab==='orders') loadOrders();if(tab==='disputes') loadDisputes();},[tab]);

  const saveAddress=async()=>{
    setSaving(true);
    try{
      const url=editAddrId?`/api/buyers/addresses/${editAddrId}`:'/api/buyers/addresses';
      const r=await api(url,{method:editAddrId?'PATCH':'POST',body:JSON.stringify(addrForm)});
      const d=await r.json();
      if(!r.ok){showToast(d.error||'Failed',false);return;}
      showToast(editAddrId?'Address updated':'Address saved');
      const ar=await api('/api/buyers/addresses');
      const ad=await ar.json();
      if(ad.success) setAddresses(ad.addresses||[]);
      setShowAddrForm(false);setEditAddrId(null);setAddrForm(blankAddr);
    }catch{}setSaving(false);
  };

  const deleteAddress=async(id)=>{
    await api(`/api/buyers/addresses/${id}`,{method:'DELETE'});
    setAddresses(a=>a.filter(x=>x.id!==id));showToast('Address removed');
  };

  const savePm=async()=>{
    setSaving(true);
    try{
      const r=await api('/api/buyers/payment-methods',{method:'POST',body:JSON.stringify(pmForm)});
      const d=await r.json();
      if(!r.ok){showToast(d.error||'Failed',false);return;}
      showToast('Payment method saved');
      const pr=await api('/api/buyers/payment-methods');
      const pd=await pr.json();
      if(pd.success) setPayments(pd.methods||[]);
      setShowPmForm(false);setPmForm({type:'mtn_momo',phone_number:'',nickname:''});
    }catch{}setSaving(false);
  };

  const setDefaultPm=async(id)=>{
    await api(`/api/buyers/payment-methods/${id}/default`,{method:'PATCH'});
    const pr=await api('/api/buyers/payment-methods');
    const pd=await pr.json();
    if(pd.success) setPayments(pd.methods||[]);
  };

  const deletePm=async(id)=>{
    await api(`/api/buyers/payment-methods/${id}`,{method:'DELETE'});
    setPayments(p=>p.filter(x=>x.id!==id));showToast('Payment method removed');
  };

  const removeWishlist=async(productId)=>{
    await api(`/api/buyers/wishlist/${productId}`,{method:'DELETE'});
    setWishlist(w=>w.filter(x=>x.product_id!==productId));showToast('Removed from wishlist');
  };

  const submitDispute=async()=>{
    setSaving(true);
    try{
      const r=await api('/api/buyers/disputes',{method:'POST',body:JSON.stringify(dispForm)});
      const d=await r.json();
      if(!r.ok){showToast(d.error||'Failed',false);setSaving(false);return;}
      showToast('Dispute submitted. We\'ll respond within 24–48 hours.');
      setShowDispForm(false);setDispForm(blankDisp);loadDisputes();
    }catch{}setSaving(false);
  };

  const saveSettings=async()=>{
    if(settingsForm.password&&settingsForm.password!==settingsForm.confirm_password){showToast('Passwords do not match',false);return;}
    setSaving(true);
    try{
      const r=await api('/api/buyers/me',{method:'PATCH',body:JSON.stringify(settingsForm)});
      const d=await r.json();
      if(!r.ok){showToast(d.error||'Failed',false);setSaving(false);return;}
      showToast('Settings saved');
      setProfile(d.user);
      settingsEditor.clearDraft();
      setSettingsForm(p=>({...p,current_password:'',password:'',confirm_password:''}));
    }catch{}setSaving(false);
  };

  const D=BLACK,DC='linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))';
  const GB2='rgba(200,153,42,0.22)',GL2=GL,GS2=GSHINE;
  const CARD2={background:DC,border:`1px solid ${GB2}`,borderRadius:14,boxShadow:'0 2px 24px rgba(0,0,0,0.5)'};
  const inp={width:'100%',background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:8,padding:'10px 13px',fontSize:13,fontFamily:DM,outline:'none',boxSizing:'border-box',color:'#f0ede4'};
  const GBTN={background:GS2,color:'#07070e',border:'none',borderRadius:8,padding:'10px 22px',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 16px rgba(200,153,42,0.3)'};
  const SEC={fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:2,color:'rgba(200,153,42,0.45)',marginBottom:6,fontFamily:DM};
  const STATUS_COLOR2={pending:'#fbbf24',paid:'#60a5fa',processing:'#a78bfa',shipped:'#38bdf8','out_for_delivery':'#34d399',delivered:'#4ade80',cancelled:'#f87171',disputed:'#fb923c',refunded:'#60a5fa'};
  const STATUS_BG2={pending:'rgba(251,191,36,0.12)',paid:'rgba(96,165,250,0.12)',processing:'rgba(167,139,250,0.12)',shipped:'rgba(56,189,248,0.12)','out_for_delivery':'rgba(52,211,153,0.12)',delivered:'rgba(74,222,128,0.12)',cancelled:'rgba(248,113,113,0.12)',disputed:'rgba(251,146,60,0.12)',refunded:'rgba(96,165,250,0.12)'};
  const SPill=({s})=>s?<span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',padding:'3px 9px',borderRadius:8,background:STATUS_BG2[s]||'rgba(200,153,42,0.08)',color:STATUS_COLOR2[s]||GL2,border:`1px solid ${STATUS_COLOR2[s]||GL2}33`}}>{STATUS_LABEL[s]||s}</span>:null;

  if(loading)return(
    <div style={{minHeight:'100vh',background:D,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:GS2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 20px',boxShadow:'0 0 32px rgba(200,153,42,0.35)'}}>🛍️</div>
        <div style={{color:'rgba(200,153,42,0.5)',fontSize:13,letterSpacing:2}}>LOADING YOUR ACCOUNT…</div>
      </div>
    </div>
  );

  if(!profile)return(
    <div style={{minHeight:'100vh',background:D,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM,padding:16}}>
      <div style={{...CARD2,padding:'52px 40px',maxWidth:380,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:52,marginBottom:16}}>🔐</div>
        <h2 style={{fontSize:22,fontWeight:800,background:'linear-gradient(90deg,#9a6a10,#f5d060,#c8992a)',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 8px'}}>Sign In Required</h2>
        <p style={{fontSize:13,color:'rgba(200,153,42,0.45)',marginBottom:24,lineHeight:1.6}}>Access your orders, wishlist, and more.</p>
        <button onClick={()=>nav('/login?return=/account')} style={{...GBTN,width:'100%',marginBottom:10}}>Sign In →</button>
        <button onClick={()=>nav('/register')} style={{width:'100%',background:'transparent',color:'rgba(200,153,42,0.5)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:8,padding:'10px 22px',fontSize:13,cursor:'pointer',fontFamily:DM}}>Create Account</button>
      </div>
    </div>
  );

  const TABS=[
    {k:'home',icon:'🏠',label:'Home'},
    {k:'orders',icon:'📦',label:'Orders'},
    {k:'wishlist',icon:'❤️',label:'Wishlist'},
    {k:'addresses',icon:'📍',label:'Addresses'},
    {k:'payments',icon:'💳',label:'Payments'},
    {k:'disputes',icon:'🔄',label:'Returns'},
    {k:'notifications',icon:'🔔',label:'Alerts'},
    {k:'settings',icon:'⚙️',label:'Settings'},
  ];

  const unreadCount=notifications.filter(n=>!n.is_read).length;

  return(
    <div style={{background:'linear-gradient(160deg,#07070e 0%,#0d0b04 40%,#07070e 100%)',minHeight:'100vh',fontFamily:DM}}>
      <style>{`@keyframes shimDB{0%{background-position:200% center}100%{background-position:-200% center}}`}</style>
      {toast&&<div style={{position:'fixed',top:24,left:'50%',transform:'translateX(-50%)',background:toast.ok?'linear-gradient(135deg,#071a07,#0a2a0a)':'linear-gradient(135deg,#1a0707,#2a0a0a)',border:`1px solid ${toast.ok?'rgba(74,222,128,0.4)':'rgba(248,113,113,0.4)'}`,color:toast.ok?'#4ade80':'#f87171',borderRadius:12,padding:'14px 28px',fontSize:14,fontWeight:700,zIndex:9999,boxShadow:'0 8px 40px rgba(0,0,0,.7)',fontFamily:DM,whiteSpace:'nowrap'}}>{toast.msg}</div>}

      {/* Header */}
      <div style={{background:'linear-gradient(180deg,rgba(13,11,4,0.98) 0%,rgba(7,7,14,0.97) 100%)',borderBottom:'1px solid rgba(200,153,42,0.15)',paddingBottom:0}}>
        <div style={{height:2,background:'linear-gradient(90deg,transparent,#9a6a10,#f5d060,#c8992a,#f5d060,#9a6a10,transparent)',backgroundSize:'200% auto',animation:'shimDB 4s linear infinite'}}/>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 20px 0'}}>
          <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:28}}>
            <div style={{position:'relative',flexShrink:0}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:GS2,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,fontWeight:900,color:'#07070e',boxShadow:'0 0 0 3px rgba(200,153,42,0.3),0 0 32px rgba(200,153,42,0.25)'}}>
                {profile.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{position:'absolute',bottom:2,right:2,width:14,height:14,borderRadius:'50%',background:'#4ade80',border:'2px solid #07070e',boxShadow:'0 0 6px rgba(74,222,128,0.6)'}}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,letterSpacing:4,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:5}}>My Account</div>
              <div style={{fontSize:24,fontWeight:900,fontFamily:PF,background:'linear-gradient(135deg,#f5d060,#c8992a,#f5d060)',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',lineHeight:1.1,marginBottom:5}}>
                Welcome back, {profile.name?.split(' ')[0]}.
              </div>
              <div style={{fontSize:12,color:'rgba(200,153,42,0.35)'}}>{profile.phone||profile.email}{profile.district?` · ${profile.district}`:''}</div>
            </div>
            {unreadCount>0&&(
              <div onClick={()=>setTab('notifications')} style={{background:'rgba(239,68,68,0.12)',color:'#f87171',border:'1px solid rgba(239,68,68,0.25)',borderRadius:20,padding:'6px 16px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                {unreadCount} new
              </div>
            )}
          </div>
          {/* Tab bar */}
          <div style={{display:'flex',gap:0,overflowX:'auto',scrollbarWidth:'none'}}>
            {TABS.map(({k,icon,label})=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{background:'transparent',color:tab===k?GL2:'rgba(200,153,42,0.35)',border:'none',
                  borderBottom:`2px solid ${tab===k?'#f5d060':'transparent'}`,
                  padding:'11px 18px',fontSize:12,fontWeight:tab===k?700:400,cursor:'pointer',fontFamily:DM,
                  whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5,flexShrink:0,transition:'all .2s',
                  letterSpacing:tab===k?.3:0}}>
                {icon} {label}
                {k==='notifications'&&unreadCount>0&&<span style={{background:'#ef4444',color:'#fff',borderRadius:8,padding:'1px 6px',fontSize:10,fontWeight:700}}>{unreadCount}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 16px 80px'}}>

        {/* ── HOME ── */}
        {tab==='home'&&(
          <div>
            {/* Protection Banner */}
            <div style={{background:'linear-gradient(135deg,rgba(200,153,42,0.1),rgba(200,153,42,0.03))',border:'1px solid rgba(200,153,42,0.2)',borderRadius:16,padding:'18px 24px',marginBottom:28,display:'flex',gap:16,alignItems:'center',boxShadow:'0 4px 40px rgba(0,0,0,0.3)'}}>
              <div style={{width:48,height:48,borderRadius:14,background:'linear-gradient(135deg,rgba(200,153,42,0.2),rgba(200,153,42,0.06))',border:'1px solid rgba(200,153,42,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🛡️</div>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:GL2,marginBottom:3,fontFamily:PF}}>256 Mall Buyer Protection</div>
                <div style={{fontSize:12,color:'rgba(200,153,42,0.5)',lineHeight:1.7}}>Your payment is held securely until your order is delivered. Disputes resolved within 48 hours.</div>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:14,marginBottom:28}}>
              {[
                {icon:'📦',title:'Orders',val:orders.length,sub:'total placed',tab:'orders',accent:'#f5d060'},
                {icon:'❤️',title:'Wishlist',val:counts.wishlist||0,sub:'saved items',tab:'wishlist',accent:'#f87171'},
                {icon:'📍',title:'Addresses',val:counts.addresses||0,sub:'saved',tab:'addresses',accent:'#60a5fa'},
                {icon:'💳',title:'Payments',val:counts.payment_methods||0,sub:'methods',tab:'payments',accent:'#4ade80'},
                {icon:'🔄',title:'Disputes',val:counts.open_disputes||0,sub:'open',tab:'disputes',accent:'#fb923c'},
                {icon:'⚙️',title:'Settings',val:null,sub:'account',tab:'settings',accent:'rgba(200,153,42,0.6)'},
              ].map(card=>(
                <div key={card.tab} onClick={()=>setTab(card.tab)}
                  style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(7,7,14,0.9))',border:'1px solid rgba(200,153,42,0.15)',borderRadius:16,padding:'22px 20px',cursor:'pointer',transition:'all .2s',boxShadow:'0 4px 24px rgba(0,0,0,0.4)'}}
                  onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${card.accent}50`;e.currentTarget.style.boxShadow=`0 0 28px ${card.accent}18`;e.currentTarget.style.transform='translateY(-2px)';}}
                  onMouseLeave={e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.15)';e.currentTarget.style.boxShadow='0 4px 24px rgba(0,0,0,0.4)';e.currentTarget.style.transform='none';}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                    <div style={{width:40,height:40,borderRadius:12,background:`${card.accent}18`,border:`1px solid ${card.accent}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{card.icon}</div>
                    <span style={{fontSize:10,color:card.accent,fontWeight:700,letterSpacing:1,opacity:.7}}>VIEW →</span>
                  </div>
                  {card.val!==null&&<div style={{fontSize:32,fontWeight:900,color:card.accent,lineHeight:1,marginBottom:4,fontFamily:PF}}>{card.val}</div>}
                  <div style={{fontSize:13,fontWeight:700,color:'#f0ede4',marginBottom:2}}>{card.title}</div>
                  <div style={{fontSize:11,color:'rgba(200,153,42,0.35)'}}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Recent Orders */}
            {orders.length>0&&(
              <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(7,7,14,0.9))',border:'1px solid rgba(200,153,42,0.15)',borderRadius:18,overflow:'hidden',boxShadow:'0 4px 40px rgba(0,0,0,0.4)'}}>
                <div style={{padding:'18px 24px',borderBottom:'1px solid rgba(200,153,42,0.1)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:16,fontWeight:800,color:'#f0ede4',fontFamily:PF}}>Recent Orders</div>
                  <button onClick={()=>setTab('orders')} style={{fontSize:12,color:GL2,background:'none',border:'none',cursor:'pointer',fontWeight:700,letterSpacing:.3}}>View all →</button>
                </div>
                {orders.slice(0,3).map((o,i)=>(
                  <div key={o.id} style={{padding:'16px 24px',borderBottom:i<2?'1px solid rgba(200,153,42,0.08)':'none',display:'flex',gap:14,alignItems:'center'}}>
                    <div style={{width:44,height:44,borderRadius:12,background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>📦</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:700,color:'#f0ede4',fontFamily:'monospace'}}>#{o.order_number}</span>
                        <SPill s={o.status}/>
                      </div>
                      <div style={{fontSize:12,color:'rgba(200,153,42,0.4)'}}>{fmt(o.created_at)} · <span style={{color:GL2,fontWeight:700}}>{ugx(o.total)}</span></div>
                    </div>
                    <button onClick={()=>{setSelOrder(o);setTab('order-detail');}}
                      style={{background:'rgba(200,153,42,0.1)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:10,padding:'8px 18px',fontSize:12,fontWeight:700,cursor:'pointer',color:GL2,flexShrink:0}}>
                      Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab==='orders'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
              {[['','All'],['pending','Pending'],['paid','Paid'],['shipped','Shipped'],['delivered','Delivered'],['cancelled','Cancelled']].map(([s,l])=>(
                <button key={s} onClick={()=>loadOrders(s)}
                  style={{background:'rgba(200,153,42,0.06)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:20,padding:'6px 16px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:DM,color:'rgba(200,153,42,0.6)'}}>
                  {l}
                </button>
              ))}
            </div>
            {orders.length===0
              ?<div style={{...CARD2,padding:56,textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:12,opacity:.4}}>📦</div>
                <div style={{fontSize:15,fontWeight:700,color:'#f0ede4',marginBottom:6}}>No orders yet</div>
                <div style={{fontSize:13,color:'rgba(200,153,42,0.4)',marginBottom:20}}>When you place an order, it will appear here.</div>
                <button onClick={()=>nav('/')} style={GBTN}>Start Shopping →</button>
              </div>
              :<div style={{display:'flex',flexDirection:'column',gap:12}}>
                {orders.map(o=>(
                  <div key={o.id} style={{...CARD2,overflow:'hidden'}}>
                    <div style={{padding:'12px 18px',borderBottom:'1px solid rgba(200,153,42,0.1)',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',background:'rgba(200,153,42,0.04)'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#f0ede4'}}>#{o.order_number}</span>
                      <SPill s={o.status}/>
                      <span style={{fontSize:12,color:'rgba(200,153,42,0.4)',marginLeft:'auto'}}>{fmt(o.created_at)}</span>
                    </div>
                    {(o.items||[]).filter(Boolean).map(item=>(
                      <div key={item.id} style={{padding:'12px 18px',borderBottom:'1px solid rgba(200,153,42,0.08)',display:'flex',gap:12,alignItems:'center'}}>
                        {item.product_image?<img src={item.product_image} alt="" style={{width:52,height:52,objectFit:'cover',borderRadius:8,flexShrink:0,border:'1px solid rgba(200,153,42,0.15)'}}/>
                          :<div style={{width:52,height:52,background:'rgba(200,153,42,0.06)',borderRadius:8,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#f0ede4',marginBottom:2}}>{item.product_name}</div>
                          <div style={{fontSize:12,color:'rgba(200,153,42,0.45)'}}>Qty: {item.quantity} · {ugx(item.unit_price)} each</div>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:GL2}}>{ugx(item.total_price)}</div>
                      </div>
                    ))}
                    <div style={{padding:'12px 18px',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <span style={{fontSize:14,fontWeight:800,color:GL2,flex:1}}>Total: {ugx(o.total)}</span>
                      <button onClick={()=>nav('/track')} style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer',color:'rgba(200,153,42,0.6)'}}>🚚 Track</button>
                      <button onClick={()=>{setSelOrder(o);setTab('order-detail');}} style={{...GBTN,padding:'7px 16px',fontSize:12}}>Details</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── ORDER DETAIL ── */}
        {tab==='order-detail'&&selOrder&&(
          <div>
            <button onClick={()=>setTab('orders')} style={{background:'none',border:'none',color:GL2,fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:20,padding:0}}>← Back to Orders</button>
            <div style={{...CARD2,overflow:'hidden',marginBottom:14}}>
              <div style={{padding:'18px 22px',borderBottom:'1px solid rgba(200,153,42,0.15)',background:'rgba(200,153,42,0.05)',display:'flex',gap:20,flexWrap:'wrap',alignItems:'center'}}>
                {[['ORDER',`#${selOrder.order_number}`],['PLACED',fmt(selOrder.created_at)],['TOTAL',ugx(selOrder.total)]].map(([k,v])=>(
                  <div key={k}><div style={{...SEC,marginBottom:3}}>{k}</div><div style={{fontSize:14,fontWeight:700,color:'#f0ede4'}}>{v}</div></div>
                ))}
                <SPill s={selOrder.status}/>
              </div>
              {(selOrder.items||[]).filter(Boolean).map(item=>(
                <div key={item.id} style={{padding:'16px 22px',borderBottom:'1px solid rgba(200,153,42,0.08)',display:'flex',gap:14,alignItems:'center'}}>
                  {item.product_image?<img src={item.product_image} alt="" style={{width:68,height:68,objectFit:'cover',borderRadius:10,flexShrink:0,border:'1px solid rgba(200,153,42,0.15)'}}/>
                    :<div style={{width:68,height:68,background:'rgba(200,153,42,0.06)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>📦</div>}
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#f0ede4',marginBottom:4}}>{item.product_name}</div>
                    <div style={{fontSize:12,color:'rgba(200,153,42,0.45)'}}>Qty: {item.quantity} · {ugx(item.unit_price)} each{item.seller_name?` · ${item.seller_name}`:''}</div>
                  </div>
                  <div style={{fontSize:15,fontWeight:800,color:GL2}}>{ugx(item.total_price)}</div>
                </div>
              ))}
              <div style={{padding:'18px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,borderTop:'1px solid rgba(200,153,42,0.1)'}}>
                <div><div style={SEC}>Delivery Address</div><div style={{fontSize:13,color:'rgba(200,153,42,0.6)',lineHeight:1.8}}>{selOrder.delivery_name}<br/>{selOrder.delivery_phone}<br/>{selOrder.delivery_address}</div></div>
                <div><div style={SEC}>Payment</div><div style={{fontSize:13,color:'rgba(200,153,42,0.6)',lineHeight:1.8}}>{selOrder.payment_method||'—'}<br/>Status: {selOrder.payment_status}</div></div>
              </div>
            </div>
            <div style={{background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:10,padding:'14px 18px',display:'flex',gap:12,alignItems:'flex-start',marginBottom:16}}>
              <span style={{fontSize:20}}>🛡️</span>
              <div style={{fontSize:12,color:'rgba(74,222,128,0.7)',lineHeight:1.6}}><strong style={{color:'#4ade80'}}>256 Mall Order Protection</strong> — Your payment is held securely until delivery confirmed. Open a dispute if anything goes wrong.</div>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button onClick={()=>nav('/track')} style={GBTN}>🚚 Track Order</button>
              <button onClick={()=>{setDispForm({...blankDisp,order_id:selOrder.id});setShowDispForm(true);setTab('disputes');}} style={{background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>Report a Problem</button>
            </div>
          </div>
        )}

        {/* ── WISHLIST ── */}
        {tab==='wishlist'&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:'#f0ede4',marginBottom:20}}>Saved Items <span style={{color:'rgba(200,153,42,0.5)',fontSize:14,fontWeight:400}}>({wishlist.length})</span></div>
            {wishlist.length===0
              ?<div style={{...CARD2,padding:56,textAlign:'center'}}>
                <div style={{fontSize:48,marginBottom:12,opacity:.4}}>❤️</div>
                <div style={{fontSize:15,fontWeight:700,color:'#f0ede4',marginBottom:6}}>Your wishlist is empty</div>
                <div style={{fontSize:13,color:'rgba(200,153,42,0.4)',marginBottom:20}}>Save items you love by clicking the heart on any product.</div>
                <button onClick={()=>nav('/')} style={GBTN}>Start Shopping →</button>
              </div>
              :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
                {wishlist.map(item=>(
                  <div key={item.id} style={{...CARD2,overflow:'hidden'}}>
                    <div style={{position:'relative',cursor:'pointer'}} onClick={()=>nav(`/product/${item.product_id}`)}>
                      {item.image?<img src={item.image} alt={item.name} style={{width:'100%',height:160,objectFit:'cover'}}/>
                        :<div style={{height:160,background:'rgba(200,153,42,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>📦</div>}
                      {!item.is_active&&<div style={{position:'absolute',top:8,left:8,background:'rgba(0,0,0,.8)',color:'#f87171',borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:600,border:'1px solid rgba(248,113,113,0.3)'}}>Out of Stock</div>}
                    </div>
                    <div style={{padding:'12px 14px'}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#f0ede4',marginBottom:4,lineHeight:1.3}}>{item.name}</div>
                      <div style={{fontSize:13,fontWeight:800,color:GL2,marginBottom:2}}>{ugx(item.price)}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',marginBottom:10}}>{item.shop_name}</div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>nav(`/product/${item.product_id}`)} style={{...GBTN,flex:1,padding:'7px',fontSize:12}}>View</button>
                        <button onClick={()=>removeWishlist(item.product_id)} style={{background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)',borderRadius:6,padding:'7px 10px',fontSize:12,cursor:'pointer'}}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── ADDRESSES ── */}
        {tab==='addresses'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:800,color:'#f0ede4'}}>Your Addresses</div>
              <button onClick={()=>{setAddrForm(blankAddr);setEditAddrId(null);setShowAddrForm(true);}} style={GBTN}>+ Add Address</button>
            </div>
            {showAddrForm&&(
              <div style={{...CARD2,padding:24,marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:800,color:'#f0ede4',marginBottom:16}}>{editAddrId?'Edit Address':'New Address'}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  {[['Label','label','select',['home','office','school','market','village','other']],['Full Name','full_name','text'],['Phone','phone','tel'],['District','district','select','districts'],['Area / Town','area','text'],['Landmark','landmark','text']].map(([lbl,k,t,opts])=>(
                    <div key={k}>
                      <label style={{fontSize:11,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>{lbl}</label>
                      {t==='select'?(
                        <select value={addrForm[k]} onChange={e=>setAddrForm(p=>({...p,[k]:e.target.value}))} style={{...inp,appearance:'none'}}>
                          {k==='district'?<><option value="">Select district</option>{[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}</>
                            :(opts||[]).map(l=><option key={l} value={l}>{l.charAt(0).toUpperCase()+l.slice(1)}</option>)}
                        </select>
                      ):<input value={addrForm[k]||''} onChange={e=>setAddrForm(p=>({...p,[k]:e.target.value}))} style={inp}/>}
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:14}}>
                  <label style={{fontSize:11,fontWeight:700,color:'rgba(200,153,42,0.5)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:.5}}>Full Address</label>
                  <input value={addrForm.address_line||''} onChange={e=>setAddrForm(p=>({...p,address_line:e.target.value}))} placeholder="Street, plot number" style={inp}/>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'rgba(200,153,42,0.6)',cursor:'pointer',marginBottom:16}}>
                  <input type="checkbox" checked={addrForm.is_default} onChange={e=>setAddrForm(p=>({...p,is_default:e.target.checked}))} style={{accentColor:GOLD}}/>
                  Set as default delivery address
                </label>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={saveAddress} disabled={saving||!addrForm.district} style={GBTN}>{saving?'Saving…':'Save Address'}</button>
                  <button onClick={()=>{setShowAddrForm(false);setEditAddrId(null);setAddrForm(blankAddr);}} style={{background:'transparent',color:'rgba(200,153,42,0.45)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,padding:'10px 20px',fontSize:13,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            )}
            {addresses.length===0&&!showAddrForm
              ?<div style={{...CARD2,padding:56,textAlign:'center'}}><div style={{fontSize:48,marginBottom:12,opacity:.4}}>📍</div><div style={{fontSize:14,color:'rgba(200,153,42,0.4)'}}>No saved addresses. Add one for faster checkout.</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {addresses.map(a=>(
                  <div key={a.id} style={{...CARD2,padding:'16px 20px',border:`1px solid ${a.is_default?'rgba(200,153,42,0.5)':GB2}`,display:'flex',gap:14,alignItems:'flex-start',boxShadow:a.is_default?'0 0 20px rgba(200,153,42,0.1)':'0 2px 24px rgba(0,0,0,0.5)'}}>
                    <span style={{fontSize:24,flexShrink:0}}>{'home'===a.label?'🏠':'office'===a.label?'🏢':'school'===a.label?'🏫':'village'===a.label?'🌳':'📍'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:5}}>
                        <span style={{fontSize:13,fontWeight:800,color:'#f0ede4',textTransform:'capitalize'}}>{a.label}</span>
                        {a.is_default&&<span style={{fontSize:10,background:'rgba(200,153,42,0.15)',color:GL2,borderRadius:6,padding:'2px 9px',fontWeight:700,border:'1px solid rgba(200,153,42,0.3)'}}>Default</span>}
                      </div>
                      <div style={{fontSize:13,color:'rgba(200,153,42,0.5)',lineHeight:1.8}}>
                        {a.full_name&&<>{a.full_name}<br/></>}{a.phone&&<>{a.phone}<br/></>}
                        {[a.address_line,a.area,a.district,a.landmark].filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <button onClick={()=>{setAddrForm({label:a.label,full_name:a.full_name||'',phone:a.phone||'',district:a.district,area:a.area||'',address_line:a.address_line||'',landmark:a.landmark||'',is_default:a.is_default});setEditAddrId(a.id);setShowAddrForm(true);}}
                        style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:6,padding:'6px 12px',fontSize:12,cursor:'pointer',color:'rgba(200,153,42,0.6)'}}>Edit</button>
                      <button onClick={()=>deleteAddress(a.id)} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',borderRadius:6,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── PAYMENTS ── */}
        {tab==='payments'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:800,color:'#f0ede4'}}>Payment Methods</div>
              <button onClick={()=>setShowPmForm(true)} style={GBTN}>+ Add Method</button>
            </div>
            <div style={{background:'rgba(200,153,42,0.05)',border:'1px solid rgba(200,153,42,0.18)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:12,color:'rgba(200,153,42,0.5)',lineHeight:1.6}}>
              🔒 We never store your Mobile Money PIN. Only your phone number is saved for quick checkout reference.
            </div>
            {showPmForm&&(
              <div style={{...CARD2,padding:24,marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:800,color:'#f0ede4',marginBottom:16}}>Add Payment Method</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                  <div>
                    <label style={{...SEC}}>Provider</label>
                    <select value={pmForm.type} onChange={e=>setPmForm(p=>({...p,type:e.target.value}))} style={{...inp,appearance:'none'}}>
                      <option value="mtn_momo">MTN Mobile Money</option>
                      <option value="airtel_money">Airtel Money</option>
                    </select>
                  </div>
                  <div>
                    <label style={{...SEC}}>Phone Number *</label>
                    <input value={pmForm.phone_number} onChange={e=>setPmForm(p=>({...p,phone_number:e.target.value}))} placeholder="+256 77X XXX XXX" style={inp}/>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{...SEC}}>Nickname (optional)</label>
                    <input value={pmForm.nickname} onChange={e=>setPmForm(p=>({...p,nickname:e.target.value}))} placeholder="e.g. My MTN number" style={inp}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={savePm} disabled={saving||!pmForm.phone_number} style={GBTN}>{saving?'Saving…':'Save'}</button>
                  <button onClick={()=>setShowPmForm(false)} style={{background:'transparent',color:'rgba(200,153,42,0.45)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,padding:'10px 20px',fontSize:13,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            )}
            {payments.length===0&&!showPmForm
              ?<div style={{...CARD2,padding:56,textAlign:'center'}}><div style={{fontSize:48,marginBottom:12,opacity:.4}}>💳</div><div style={{fontSize:14,color:'rgba(200,153,42,0.4)'}}>No payment methods saved. Add one for faster checkout.</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {payments.map(pm=>(
                  <div key={pm.id} style={{...CARD2,padding:'16px 20px',border:`1px solid ${pm.is_default?'rgba(200,153,42,0.5)':GB2}`,display:'flex',gap:14,alignItems:'center'}}>
                    <div style={{width:48,height:48,borderRadius:10,background:pm.type==='mtn_momo'?'rgba(251,191,36,0.15)':'rgba(248,113,113,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0,border:`1px solid ${pm.type==='mtn_momo'?'rgba(251,191,36,0.3)':'rgba(248,113,113,0.2)'}`}}>
                      {pm.type==='mtn_momo'?'📱':'📲'}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:3}}>
                        <span style={{fontSize:14,fontWeight:800,color:'#f0ede4'}}>{pm.type==='mtn_momo'?'MTN Mobile Money':'Airtel Money'}</span>
                        {pm.is_default&&<span style={{fontSize:10,background:'rgba(200,153,42,0.15)',color:GL2,borderRadius:6,padding:'2px 9px',fontWeight:700,border:'1px solid rgba(200,153,42,0.3)'}}>Default</span>}
                      </div>
                      <div style={{fontSize:13,color:'rgba(200,153,42,0.45)'}}>{pm.phone_number}{pm.nickname?` · ${pm.nickname}`:''}</div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {!pm.is_default&&<button onClick={()=>setDefaultPm(pm.id)} style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:6,padding:'6px 12px',fontSize:11,cursor:'pointer',color:'rgba(200,153,42,0.6)'}}>Set Default</button>}
                      <button onClick={()=>deletePm(pm.id)} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171',borderRadius:6,padding:'6px 12px',fontSize:11,cursor:'pointer'}}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── DISPUTES ── */}
        {tab==='disputes'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:800,color:'#f0ede4'}}>Returns & Disputes</div>
              <button onClick={()=>setShowDispForm(true)} style={{background:'rgba(239,68,68,0.12)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'9px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Open Dispute</button>
            </div>
            {showDispForm&&(
              <div style={{...CARD2,padding:24,marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:800,color:'#f0ede4',marginBottom:16}}>Open a Dispute or Return Request</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div><label style={SEC}>Order ID (optional)</label><input value={dispForm.order_id} onChange={e=>setDispForm(p=>({...p,order_id:e.target.value}))} placeholder="Paste order ID" style={inp}/></div>
                  <div><label style={SEC}>Reason *</label>
                    <select value={dispForm.reason} onChange={e=>setDispForm(p=>({...p,reason:e.target.value}))} style={{...inp,appearance:'none'}}>
                      <option value="">Select reason</option>
                      {[['item_not_delivered','Item not delivered'],['wrong_item','Wrong item received'],['fake_item','Fake or counterfeit item'],['damaged','Damaged item'],['incomplete','Incomplete order'],['late_delivery','Unacceptably late delivery'],['other','Other']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div><label style={SEC}>Preferred Resolution</label>
                    <select value={dispForm.preferred_resolution} onChange={e=>setDispForm(p=>({...p,preferred_resolution:e.target.value}))} style={{...inp,appearance:'none'}}>
                      {[['refund','Full Refund'],['replacement','Replacement Item'],['exchange','Exchange'],['seller_contact','Speak to Seller'],['partial_refund','Partial Refund']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:14}}><label style={SEC}>Description</label>
                  <textarea rows={4} value={dispForm.description} onChange={e=>setDispForm(p=>({...p,description:e.target.value}))} placeholder="Describe the issue in detail." style={{...inp,resize:'vertical'}}/>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={submitDispute} disabled={saving||!dispForm.reason} style={{background:'rgba(239,68,68,0.15)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Submitting…':'Submit Dispute'}</button>
                  <button onClick={()=>setShowDispForm(false)} style={{background:'transparent',color:'rgba(200,153,42,0.45)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,padding:'10px 20px',fontSize:13,cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            )}
            {disputes.length===0&&!showDispForm
              ?<div style={{...CARD2,padding:56,textAlign:'center'}}><div style={{fontSize:48,marginBottom:12,opacity:.4}}>✅</div><div style={{fontSize:14,color:'rgba(200,153,42,0.4)'}}>No disputes. We'll resolve any issues within 24–48 hours.</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {disputes.map(d=>(
                  <div key={d.id} style={{...CARD2,padding:'16px 20px'}}>
                    <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#f0ede4'}}>#{d.order_number||'No order linked'}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:8,background:d.status==='open'?'rgba(248,113,113,0.12)':'rgba(74,222,128,0.1)',color:d.status==='open'?'#f87171':'#4ade80',border:`1px solid ${d.status==='open'?'rgba(248,113,113,0.25)':'rgba(74,222,128,0.2)'}`,textTransform:'capitalize'}}>{d.status}</span>
                      <span style={{fontSize:11,color:'rgba(200,153,42,0.35)',marginLeft:'auto'}}>{fmt(d.created_at)}</span>
                    </div>
                    <div style={{fontSize:13,color:'rgba(200,153,42,0.7)',marginBottom:4,fontWeight:600}}>{d.reason?.replace(/_/g,' ')}</div>
                    {d.description&&<div style={{fontSize:12,color:'rgba(200,153,42,0.4)',lineHeight:1.6}}>{d.description}</div>}
                    {d.admin_response&&<div style={{background:'rgba(74,222,128,0.06)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'rgba(74,222,128,0.8)',marginTop:10}}><strong style={{color:'#4ade80'}}>256 Mall Response:</strong> {d.admin_response}</div>}
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab==='notifications'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:800,color:'#f0ede4'}}>Notifications {unreadCount>0&&<span style={{fontSize:14,fontWeight:400,color:GL2}}>({unreadCount} unread)</span>}</div>
              {notifications.some(n=>!n.is_read)&&(
                <button onClick={async()=>{await api('/api/buyers/notifications/read-all',{method:'PATCH'});setNotifications(n=>n.map(x=>({...x,is_read:true})));}}
                  style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer',color:'rgba(200,153,42,0.6)'}}>
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length===0
              ?<div style={{...CARD2,padding:56,textAlign:'center'}}><div style={{fontSize:48,marginBottom:12,opacity:.4}}>🔔</div><div style={{fontSize:14,color:'rgba(200,153,42,0.4)'}}>No notifications yet. Order updates will appear here.</div></div>
              :<div style={{display:'flex',flexDirection:'column',gap:8}}>
                {notifications.map(n=>(
                  <div key={n.id} style={{...CARD2,padding:'16px 18px',border:`1px solid ${n.is_read?GB2:'rgba(200,153,42,0.45)'}`,background:n.is_read?DC:'linear-gradient(145deg,rgba(200,153,42,0.12),rgba(200,153,42,0.04))',display:'flex',gap:14,alignItems:'flex-start'}}>
                    <span style={{fontSize:24,flexShrink:0}}>{n.type?.includes('delivered')?'📬':n.type?.includes('approved')?'✅':'🔔'}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#f0ede4',marginBottom:3}}>{n.title}</div>
                      <div style={{fontSize:12,color:'rgba(200,153,42,0.5)',lineHeight:1.6}}>{n.message}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.3)',marginTop:5}}>{fmt(n.created_at)}</div>
                    </div>
                    {!n.is_read&&<div style={{width:8,height:8,background:GL2,borderRadius:'50%',flexShrink:0,marginTop:4,boxShadow:'0 0 8px rgba(245,208,96,0.6)'}}/>}
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab==='settings'&&(
          <div>
            <div style={{fontSize:18,fontWeight:800,color:'#f0ede4',marginBottom:20}}>Account Settings</div>
            {settingsEditor.pendingDraft&&<UnsavedDraftBanner onRestore={settingsEditor.restoreDraft} onDiscard={settingsEditor.discardDraft}/>}
            <div style={{...CARD2,padding:24,marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:800,color:'#f0ede4',marginBottom:16}}>Personal Information</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4}}>
                {[['Full Name','name','text'],['Phone Number','phone','tel'],['Email Address','email','email']].map(([lbl,k,t])=>(
                  <div key={k}><label style={SEC}>{lbl}</label><input type={t} value={settingsForm[k]} onChange={e=>setSettingsForm(p=>({...p,[k]:e.target.value}))} style={inp}/></div>
                ))}
                <div><label style={SEC}>District</label>
                  <select value={settingsForm.district} onChange={e=>setSettingsForm(p=>({...p,district:e.target.value}))} style={{...inp,appearance:'none'}}>
                    <option value="">Select district</option>
                    {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{...CARD2,padding:24,marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:800,color:'#f0ede4',marginBottom:6}}>Change Password</div>
              <div style={{fontSize:12,color:'rgba(200,153,42,0.4)',marginBottom:16}}>Leave blank to keep your current password.</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div style={{gridColumn:'1/-1'}}><label style={SEC}>Current Password</label><input type="password" value={settingsForm.current_password} onChange={e=>setSettingsForm(p=>({...p,current_password:e.target.value}))} placeholder="Required to change password" style={inp}/></div>
                <div><label style={SEC}>New Password</label><input type="password" value={settingsForm.password} onChange={e=>setSettingsForm(p=>({...p,password:e.target.value}))} style={inp}/></div>
                <div><label style={SEC}>Confirm New Password</label><input type="password" value={settingsForm.confirm_password} onChange={e=>setSettingsForm(p=>({...p,confirm_password:e.target.value}))} style={inp}/></div>
              </div>
            </div>
            <button onClick={saveSettings} disabled={saving} style={{...GBTN,padding:'13px 36px',fontSize:14}}>{saving?'Saving…':'Save Changes'}</button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Seller Dashboard ─────────────────────────────────────────────────────────
function SellerDashboardPage({auth}){
  const nav=useNavigate();
  const tok=()=>localStorage.getItem('256mall_token');
  const api=(url,opts={})=>fetch(url,{...opts,headers:{...(opts.headers||{}),'Authorization':`Bearer ${tok()}`,'Content-Type':opts.body&&typeof opts.body==='string'?'application/json':undefined,...(opts.headers||{})}});

  const [tab,setTab]=useState('overview');
  const [dash,setDash]=useState(null);
  const [products,setProducts]=useState([]);
  const [prodTab,setProdTab]=useState('live');
  const [orders,setOrders]=useState([]);
  const [orderTab,setOrderTab]=useState('all');
  const [payouts,setPayouts]=useState({balance:{},payouts:[],transactions:[]});
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [payoutAmt,setPayoutAmt]=useState('');
  const [payoutMethod,setPayoutMethod]=useState('mtn_momo');
  const [payoutMsg,setPayoutMsg]=useState('');
  const [showAddProd,setShowAddProd]=useState(false);
  const [newProd,setNewProd]=usePersistedForm('seller-add-product',{name:'',category:'',subcategory:'',price:'',description:'',condition:'new',quantity:'',delivery:[]});
  const [newProdImages,setNewProdImages]=useState([]);
  const [addLoading,setAddLoading]=useState(false);
  const [editProd,setEditProd]=useState(null);
  const [profileEdit,setProfileEdit]=useState(false);
  const profileEditor=useDraftableForm('seller-profile');
  const profileForm=profileEditor.form,setProfileForm=profileEditor.setForm;
  const [saving,setSaving]=useState(false);
  const [notifications,setNotifications]=useState([]);
  const [showNotifs,setShowNotifs]=useState(false);
  const [sellerChats,setSellerChats]=useState([]);
  const [activeChat,setActiveChat]=useState(null);
  const [activeChatMsgs,setActiveChatMsgs]=useState([]);
  const [chatDraft,setChatDraft]=useState('');
  const [chatSending,setChatSending]=useState(false);
  const [chatUnread,setChatUnread]=useState(0);
  const sellerChatBottom=React.useRef(null);
  const sellerSocketRef=React.useRef(null);

  const SD=BLACK;
  const GS3=GSHINE;
  const GBS='rgba(200,153,42,0.22)';
  const DC3='linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))';
  const CARD3={background:DC3,border:`1px solid ${GBS}`,borderRadius:14,boxShadow:'0 2px 24px rgba(0,0,0,0.6)'};
  const GBTN3={background:GS3,color:'#07070e',border:'none',borderRadius:8,padding:'10px 22px',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:DM,boxShadow:'0 0 16px rgba(200,153,42,0.35)'};
  const inp={width:'100%',background:'rgba(200,153,42,0.04)',border:'1px solid rgba(200,153,42,0.22)',borderRadius:8,padding:'10px 13px',fontSize:13,fontFamily:DM,outline:'none',boxSizing:'border-box',color:'#f0ede4'};
  const selInp={...inp,appearance:'none',backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23c8992a'/%3E%3C/svg%3E")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:30,cursor:'pointer'};

  const ugx=n=>n?'UGX '+parseInt(n).toLocaleString():'UGX 0';
  const fmtDate=d=>d?new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'—';

  const loadDash=async()=>{
    setLoading(true);setError('');
    try{
      const [r,nr]=await Promise.all([
        api('/api/seller/dashboard'),
        api('/api/seller/notifications'),
      ]);
      const d=await r.json();
      if(!r.ok){if(r.status===404){setError('no_seller');}else setError(d.error||'Failed');return;}
      setDash(d);setProfile(d.seller);profileEditor.hydrate(d.seller);
      const nd=await nr.json();
      if(nd.success) setNotifications(nd.notifications||[]);
      // Auto-select "under review" products tab if seller has no live products yet
      const ps=d.stats?.products||{};
      if(parseInt(ps.under_review||0)>0&&parseInt(ps.live||0)===0)setProdTab('review');
    }catch(e){setError('Connection error');}finally{setLoading(false);}
  };

  const markAllRead=async()=>{
    await api('/api/seller/notifications/read-all',{method:'PATCH'});
    setNotifications(n=>n.map(x=>({...x,is_read:true})));
  };

  const loadProducts=async()=>{
    try{const r=await api(`/api/seller/products?tab=${prodTab}&limit=50`);const d=await r.json();if(d.success)setProducts(d.products||[]);}catch{}
  };
  const loadOrders=async()=>{
    try{const r=await api(`/api/seller/orders?tab=${orderTab}&limit=50`);const d=await r.json();if(d.success)setOrders(d.orders||[]);}catch{}
  };
  const loadPayouts=async()=>{
    try{const r=await api('/api/seller/payouts');const d=await r.json();if(d.success)setPayouts(d);}catch{}
  };

  const loadSellerChats=async()=>{
    if(!dash?.seller?.id)return;
    try{const r=await api(`/api/chat/seller/${dash.seller.id}`);const d=await r.json();if(d.success){setSellerChats(d.chats||[]);const u=(d.chats||[]).reduce((s,ch)=>s+(ch.unread_seller||0),0);setChatUnread(u);}}catch{}
  };
  const openSellerChat=async(ch)=>{
    setActiveChat(ch);
    try{
      const r=await fetch(`/api/chat/${ch.id}`);const d=await r.json();
      if(d.success){setActiveChatMsgs(d.messages||[]);sellerChatBottom.current?.scrollIntoView({behavior:'smooth'});}
      // mark as read
      await fetch(`/api/chat/${ch.id}/read`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reader_type:'seller'})});
      setSellerChats(prev=>prev.map(c=>c.id===ch.id?{...c,unread_seller:0}:c));
      setChatUnread(n=>Math.max(0,n-(ch.unread_seller||0)));
    }catch{}
  };
  const sendSellerMessage=async()=>{
    if(!chatDraft.trim()||!activeChat||chatSending)return;
    const body=chatDraft.trim();setChatDraft('');setChatSending(true);
    try{
      const r=await fetch(`/api/chat/${activeChat.id}/message`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sender_type:'seller',sender_name:dash?.seller?.shop_name||dash?.seller?.name||'Seller',body})});
      const d=await r.json();
      if(d.success)setActiveChatMsgs(prev=>[...prev,d.message]);
    }catch{}finally{setChatSending(false);}
  };

  // Seller socket for real-time chat alerts
  React.useEffect(()=>{
    if(!dash?.seller?.id)return;
    const s=socketIO('/',{path:'/socket.io',transports:['websocket','polling']});
    sellerSocketRef.current=s;
    s.emit('join_seller_chat',dash.seller.id);
    s.on('new_chat',()=>{loadSellerChats();});
    s.on('chat_message',(msg)=>{
      if(activeChat&&msg.chat_id===activeChat.id){
        setActiveChatMsgs(prev=>prev.find(m=>m.id===msg.id)?prev:[...prev,msg]);
      }else{
        setChatUnread(n=>n+1);
        setSellerChats(prev=>prev.map(ch=>ch.id===msg.chat_id?{...ch,unread_seller:(ch.unread_seller||0)+1,last_message:msg.body}:ch));
      }
    });
    // Poll for new chats every 20s
    const poll=setInterval(()=>loadSellerChats(),20000);
    return()=>{s.disconnect();clearInterval(poll);};
  },[dash?.seller?.id]);

  React.useEffect(()=>{sellerChatBottom.current?.scrollIntoView({behavior:'smooth'});},[activeChatMsgs]);

  useEffect(()=>{if(!auth.user){nav('/login?return=/seller/dashboard');return;}loadDash();},[]);
  useEffect(()=>{if(tab==='products')loadProducts();},[tab,prodTab]);
  useEffect(()=>{if(tab==='orders')loadOrders();},[tab,orderTab]);
  useEffect(()=>{if(tab==='payouts')loadPayouts();},[tab]);
  useEffect(()=>{if(tab==='messages')loadSellerChats();},[tab,dash?.seller?.id]);

  const toggleDeliveryNew=opt=>setNewProd(p=>({...p,delivery:p.delivery.includes(opt)?p.delivery.filter(x=>x!==opt):[...p.delivery,opt]}));

  const addNewProdImages=e=>{
    const files=Array.from(e.target.files||[]);
    const remaining=10-newProdImages.length;
    setNewProdImages(imgs=>[...imgs,...files.slice(0,remaining).map(f=>({file:f,preview:URL.createObjectURL(f)}))]);
  };

  const submitNewProduct=async()=>{
    if(!newProd.name||!newProd.category||!newProd.price||!newProd.description){setAddLoading(false);alert('Product name, category, price and description are required');return;}
    if(!newProd.delivery||newProd.delivery.length===0){setAddLoading(false);alert('Select at least one fulfillment option (Walk-in, Pickup, Local Delivery or Nationwide).');return;}
    setAddLoading(true);
    try{
      let imageUrls=[];
      if(newProdImages.length>0){
        const fd=new FormData();newProdImages.forEach(img=>fd.append('images',img.file));
        const ur=await fetch('/api/upload/product-images',{method:'POST',body:fd,headers:{'Authorization':`Bearer ${tok()}`}});
        const ud=await ur.json();if(ud.urls)imageUrls=ud.urls;
      }
      const r=await api('/api/products',{method:'POST',body:JSON.stringify({
        seller_id:dash.seller.id,name:newProd.name,description:newProd.description,
        price:parseInt(newProd.price.toString().replace(/[^0-9]/g,'')),
        stock_quantity:newProd.quantity?parseInt(newProd.quantity):0,
        condition:newProd.condition,subcategory:newProd.subcategory,
        delivery_options:newProd.delivery,is_pending_review:true,images:imageUrls
      })});
      const d=await r.json();
      if(d.success){setShowAddProd(false);setNewProd({name:'',category:'',subcategory:'',price:'',description:'',condition:'new',quantity:'',delivery:[]});setNewProdImages([]);loadProducts();setProdTab('review');setTab('products');}
      else alert(d.error||'Failed to add product');
    }catch(e){alert('Connection error');}finally{setAddLoading(false);}
  };

  const toggleProdActive=async(prodId,cur)=>{
    await api(`/api/seller/products/${prodId}`,{method:'PATCH',body:JSON.stringify({is_active:!cur})});
    loadProducts();
  };

  const updateOrderStatus=async(itemId,status)=>{
    await api(`/api/seller/orders/${itemId}`,{method:'PATCH',body:JSON.stringify({status})});
    loadOrders();
  };

  const requestPayout=async()=>{
    if(!payoutAmt||parseInt(payoutAmt)<5000){setPayoutMsg('Minimum payout is UGX 5,000');return;}
    const r=await api('/api/seller/payouts/request',{method:'POST',body:JSON.stringify({amount:parseInt(payoutAmt),method:payoutMethod})});
    const d=await r.json();
    if(d.success){setPayoutMsg(d.message);setPayoutAmt('');loadPayouts();}
    else setPayoutMsg(d.error||'Failed');
  };

  const saveProfile=async()=>{
    setSaving(true);
    try{
      const r=await api('/api/seller/profile',{method:'PATCH',body:JSON.stringify(profileForm),headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok()}`}});
      const d=await r.json();
      if(d.success){setProfile(d.seller);setProfileEdit(false);profileEditor.clearDraft();loadDash();}
    }catch{}finally{setSaving(false);}
  };

  const STATUS_COLOR={pending:'#92400e',paid:'#166534',processing:'#1d4ed8',shipped:'#6d28d9',delivered:'#15803d',cancelled:'#991b1b',disputed:'#b45309',review:'#b45309',live:'#166534',draft:'#6b7280'};
  const STATUS_BG={pending:'#fffbeb',paid:'#f0fdf4',processing:'#eff6ff',shipped:'#f5f3ff',delivered:'#dcfce7',cancelled:'#fff0f0',disputed:'#fffbeb',review:'#fff7ed',live:'#f0fdf4',draft:'#f3f4f6'};

  const Pill=({s})=>s?<span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.4,padding:'2px 8px',borderRadius:10,background:STATUS_BG[s]||'#f3f4f6',color:STATUS_COLOR[s]||MUTED}}>{s}</span>:null;

  if(!auth.user)return null;

  if(loading)return(
    <div style={{background:SD,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:GS3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 20px',boxShadow:'0 0 32px rgba(200,153,42,0.35)'}}>🏪</div>
        <div style={{color:'rgba(200,153,42,0.5)',fontSize:13,letterSpacing:2}}>LOADING YOUR DASHBOARD…</div>
      </div>
    </div>
  );

  if(error==='no_seller')return(
    <div style={{background:SD,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM,padding:16}}>
      <div style={{...CARD3,padding:'52px 40px',maxWidth:440,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:56,marginBottom:16}}>🏪</div>
        <h2 style={{fontSize:24,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',margin:'0 0 12px'}}>No Seller Account</h2>
        <p style={{fontSize:14,color:'rgba(200,153,42,0.5)',marginBottom:28,lineHeight:1.6}}>You haven't registered as a seller yet. Set up your shop to start selling on 256 Mall.</p>
        <button onClick={()=>nav('/sell')} style={{...GBTN3,width:'100%',padding:'13px'}}>Start Selling →</button>
      </div>
    </div>
  );

  if(error)return(
    <div style={{background:SD,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM,padding:16}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:14,color:'#f87171',marginBottom:14}}>{error}</div>
        <button onClick={loadDash} style={GBTN3}>Retry</button>
      </div>
    </div>
  );

  const seller=dash?.seller||{};
  const stats=dash?.stats||{};
  const balance=dash?.balance||{};
  const prodStats=stats.products||{};
  const orderStats=stats.orders||{};

  const TABS=[
    {id:'overview', icon:'📊', label:'Overview'},
    {id:'products', icon:'📦', label:'Products'},
    {id:'orders',   icon:'🛍️', label:'Orders'},
    {id:'messages', icon:'💬', label:'Messages', badge:chatUnread},
    {id:'payouts',  icon:'💰', label:'Payouts'},
    {id:'profile',  icon:'🏪', label:'My Shop'},
  ];

  const SStatColors={pending:'#fbbf24',paid:'#60a5fa',processing:'#a78bfa',shipped:'#38bdf8',delivered:'#4ade80',cancelled:'#f87171',disputed:'#fb923c',review:'#fbbf24',live:'#4ade80',draft:'#9ca3af'};
  const SStatBg={pending:'rgba(251,191,36,0.12)',paid:'rgba(96,165,250,0.12)',processing:'rgba(167,139,250,0.12)',shipped:'rgba(56,189,248,0.12)',delivered:'rgba(74,222,128,0.12)',cancelled:'rgba(248,113,113,0.12)',disputed:'rgba(251,146,60,0.12)',review:'rgba(251,191,36,0.12)',live:'rgba(74,222,128,0.12)',draft:'rgba(156,163,175,0.12)'};
  const SPill2=({s})=>s?<span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',padding:'3px 8px',borderRadius:8,background:SStatBg[s]||'rgba(200,153,42,0.08)',color:SStatColors[s]||GL,border:`1px solid ${SStatColors[s]||GL}33`,fontFamily:DM}}>{s}</span>:null;

  return(
    <div style={{background:SD,minHeight:'100vh',fontFamily:DM}}>

      {/* Header */}
      <div style={{background:'linear-gradient(180deg,#0d0800 0%,#09090e 100%)',borderBottom:'1px solid rgba(200,153,42,0.2)',padding:'20px 16px 0'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
            <div style={{width:52,height:52,borderRadius:12,background:GS3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0,boxShadow:'0 0 20px rgba(200,153,42,0.35)'}}>
              {seller.business_photo_url
                ?<img src={seller.business_photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:12}}/>
                :'🏪'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,letterSpacing:3,color:'rgba(200,153,42,0.45)',fontWeight:700,textTransform:'uppercase',marginBottom:4,fontFamily:DM}}>Seller Dashboard</div>
              <div style={{fontSize:20,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:4}}>
                {seller.shop_name||'Your Shop'}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:10,background:seller.is_verified?'rgba(74,222,128,0.15)':'rgba(251,191,36,0.15)',color:seller.is_verified?'#4ade80':'#fbbf24',border:`1px solid ${seller.is_verified?'rgba(74,222,128,0.3)':'rgba(251,191,36,0.3)'}`,fontFamily:DM}}>
                  {seller.is_verified?'✓ Verified':'⏳ Pending Verification'}
                </span>
                <span style={{fontSize:10,color:'rgba(200,153,42,0.35)',fontFamily:DM}}>@{seller.shop_slug}</span>
              </div>
            </div>
            {/* Notification Bell */}
            <div style={{position:'relative',flexShrink:0}}>
              <button onClick={()=>{setShowNotifs(v=>!v);if(!showNotifs&&notifications.some(n=>!n.is_read))markAllRead();}}
                style={{background:'rgba(200,153,42,0.1)',color:GL,border:'1px solid rgba(200,153,42,0.25)',borderRadius:8,padding:'9px 12px',fontSize:18,cursor:'pointer',position:'relative',fontFamily:DM}}>
                🔔
                {notifications.filter(n=>!n.is_read).length>0&&(
                  <span style={{position:'absolute',top:-4,right:-4,background:'#ef4444',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700,minWidth:16}}>
                    {notifications.filter(n=>!n.is_read).length}
                  </span>
                )}
              </button>
              {showNotifs&&(
                <div style={{position:'absolute',right:0,top:'110%',width:340,background:'#0f0d07',border:'1px solid rgba(200,153,42,0.3)',borderRadius:12,boxShadow:'0 16px 48px rgba(0,0,0,.8)',zIndex:500,overflow:'hidden'}}>
                  <div style={{padding:'14px 18px',borderBottom:'1px solid rgba(200,153,42,0.15)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#f0ede4',fontFamily:PF}}>Notifications</div>
                    {notifications.length>0&&<button onClick={markAllRead} style={{fontSize:11,color:'rgba(200,153,42,0.5)',background:'none',border:'none',cursor:'pointer',fontFamily:DM}}>Mark all read</button>}
                  </div>
                  <div style={{maxHeight:320,overflowY:'auto'}}>
                    {notifications.length===0
                      ?<div style={{padding:'28px 18px',textAlign:'center',color:'rgba(200,153,42,0.35)',fontSize:13,fontFamily:DM}}>No notifications yet</div>
                      :notifications.map(n=>(
                        <div key={n.id} style={{padding:'14px 18px',borderBottom:'1px solid rgba(200,153,42,0.08)',background:n.is_read?'transparent':'rgba(200,153,42,0.04)',display:'flex',gap:10,alignItems:'flex-start'}}>
                          <span style={{fontSize:20,flexShrink:0}}>{n.type.includes('approved')||n.type.includes('verified')||n.type.includes('completed')?'✅':'❌'}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:'#f0ede4',marginBottom:2,fontFamily:DM}}>{n.title}</div>
                            <div style={{fontSize:12,color:'rgba(200,153,42,0.5)',lineHeight:1.5,fontFamily:DM}}>{n.message}</div>
                            <div style={{fontSize:10,color:'rgba(200,153,42,0.3)',marginTop:4,fontFamily:DM}}>{new Date(n.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                          </div>
                          {!n.is_read&&<div style={{width:7,height:7,background:GL,borderRadius:'50%',flexShrink:0,marginTop:4}}/>}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <button onClick={()=>setShowAddProd(true)}
              style={{...GBTN3,padding:'10px 18px',whiteSpace:'nowrap',flexShrink:0}}>
              + Add Product
            </button>
          </div>

          {/* Tab bar */}
          <div style={{display:'flex',gap:0,overflowX:'auto',scrollbarWidth:'none'}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>{setTab(t.id);if(t.id==='messages')loadSellerChats();}}
                style={{display:'flex',alignItems:'center',gap:6,padding:'12px 18px',background:'transparent',border:'none',
                  borderBottom:`2px solid ${tab===t.id?GOLD:'transparent'}`,
                  color:tab===t.id?GL:'rgba(200,153,42,0.4)',
                  fontSize:13,fontWeight:tab===t.id?700:400,cursor:'pointer',fontFamily:DM,whiteSpace:'nowrap',flexShrink:0,transition:'all .15s',position:'relative'}}>
                <span>{t.icon}</span>{t.label}
                {t.badge>0&&<span style={{position:'absolute',top:8,right:4,background:RED,color:WHITE,borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'24px 16px 80px'}}>

        {/* ── OVERVIEW ── */}
        {tab==='overview'&&(
          <div>
            {parseInt(prodStats.under_review||0)>0&&(
              <div style={{background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:12,padding:'16px 20px',marginBottom:20,display:'flex',gap:14,alignItems:'flex-start'}}>
                <span style={{fontSize:28,flexShrink:0,lineHeight:1}}>📦</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:'#fbbf24',marginBottom:4,fontFamily:PF}}>
                    {prodStats.under_review} product{parseInt(prodStats.under_review)>1?'s':''} under review
                  </div>
                  <div style={{fontSize:13,color:'rgba(251,191,36,0.6)',lineHeight:1.5,marginBottom:10}}>
                    Your {parseInt(prodStats.under_review)>1?'products are':'product is'} in the review queue and will go live within 24 hours.
                  </div>
                  <button onClick={()=>{setTab('products');setProdTab('review');}}
                    style={{background:'rgba(251,191,36,0.15)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DM}}>
                    View Under Review →
                  </button>
                </div>
              </div>
            )}

            {/* Stat grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:20}}>
              {[
                {label:'Live Products',val:prodStats.live||0,icon:'✅',color:'#4ade80',onClick:()=>{setTab('products');setProdTab('live');}},
                {label:'Under Review',val:prodStats.under_review||0,icon:'⏳',color:'#fbbf24',onClick:()=>{setTab('products');setProdTab('review');}},
                {label:'Total Orders',val:orderStats.total||0,icon:'📋',color:'#60a5fa',onClick:()=>setTab('orders')},
                {label:'Pending Orders',val:orderStats.pending||0,icon:'🔔',color:'#fb923c',onClick:()=>{setTab('orders');setOrderTab('new');}},
              ].map(s=>(
                <button key={s.label} onClick={s.onClick}
                  style={{...CARD3,padding:'20px 18px',cursor:'pointer',textAlign:'left',background:'linear-gradient(145deg,rgba(200,153,42,0.07),rgba(200,153,42,0.02))',transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.border='1px solid rgba(200,153,42,0.5)';}}
                  onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${GBS}`;}} >
                  <div style={{fontSize:24,marginBottom:10}}>{s.icon}</div>
                  <div style={{fontSize:32,fontWeight:900,color:s.color,lineHeight:1,marginBottom:5,fontFamily:PF}}>{s.val}</div>
                  <div style={{fontSize:12,color:'rgba(200,153,42,0.55)',marginTop:4,fontFamily:DM}}>{s.label}</div>
                  <div style={{fontSize:10,color:s.color,marginTop:6,opacity:.8,fontFamily:DM}}>view →</div>
                </button>
              ))}
            </div>

            {/* Balance card */}
            <div style={{...CARD3,padding:'20px 22px',marginBottom:20}}>
              <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:16,fontFamily:DM}}>Your Balance</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
                {[
                  {label:'Available',val:balance.available||0,color:'#4ade80'},
                  {label:'Held',val:balance.held||0,color:'#fbbf24'},
                  {label:'Total Earned',val:balance.total_earned||0,color:GL},
                ].map(b=>(
                  <div key={b.label} style={{textAlign:'center',padding:'14px 8px',background:'rgba(200,153,42,0.04)',borderRadius:10,border:'1px solid rgba(200,153,42,0.12)'}}>
                    <div style={{fontSize:15,fontWeight:800,color:b.color,fontFamily:PF}}>{ugx(b.val)}</div>
                    <div style={{fontSize:11,color:'rgba(200,153,42,0.45)',marginTop:4,fontFamily:DM}}>{b.label}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setTab('payouts')} style={{...GBTN3,width:'100%',padding:'11px',fontSize:13}}>
                Request Payout →
              </button>
            </div>

            {/* Recent orders */}
            {(dash?.recent_orders||[]).length>0&&(
              <div style={{...CARD3,padding:'20px 22px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',fontFamily:DM}}>Recent Orders</div>
                  <button onClick={()=>setTab('orders')} style={{fontSize:12,color:GL,background:'none',border:'none',cursor:'pointer',fontFamily:DM}}>See all →</button>
                </div>
                {(dash.recent_orders||[]).map(o=>(
                  <div key={o.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid rgba(200,153,42,0.1)'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#f0ede4',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:DM}}>{o.product_name}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>#{o.order_number} · {o.delivery_name}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:GL,fontFamily:DM}}>{ugx(o.total_price)}</div>
                      <SPill2 s={o.status}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!seller.is_verified&&(
              <div style={{...CARD3,padding:'20px 22px',marginTop:16,borderColor:'rgba(251,191,36,0.25)'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#fbbf24',marginBottom:12,fontFamily:PF}}>⚠️ Complete verification to unlock full features</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    [!!seller.phone,'Phone number added'],
                    [!!seller.mtn_momo||!!seller.airtel_money,'Mobile money payout number'],
                    [!!seller.district,'District and address'],
                    [seller.is_verified,'Identity verified'],
                  ].map(([done,label])=>(
                    <div key={label} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:done?'#4ade80':'rgba(200,153,42,0.5)',fontFamily:DM}}>
                      <span>{done?'✅':'◻️'}</span><span>{label}</span>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setTab('profile')} style={{...GBTN3,marginTop:14,padding:'9px 20px',fontSize:12}}>
                  Complete Profile →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PRODUCTS ── */}
        {tab==='products'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4'}}>Your Products</h2>
              <button onClick={()=>setShowAddProd(true)} style={GBTN3}>+ Add Product</button>
            </div>
            <div style={{display:'flex',gap:0,borderBottom:'1px solid rgba(200,153,42,0.15)',marginBottom:18,overflowX:'auto',scrollbarWidth:'none'}}>
              {[
                ['live',`✅ Live (${prodStats.live||0})`],
                ['review',`⏳ Under Review (${prodStats.under_review||0})`],
                ['draft','📝 Drafts'],
                ['out','📭 Out of Stock'],
              ].map(([id,label])=>(
                <button key={id} onClick={()=>setProdTab(id)}
                  style={{padding:'10px 16px',background:'transparent',border:'none',borderBottom:`2px solid ${prodTab===id?GOLD:'transparent'}`,
                    fontSize:13,fontWeight:prodTab===id?700:400,color:prodTab===id?GL:'rgba(200,153,42,0.4)',cursor:'pointer',fontFamily:DM,whiteSpace:'nowrap',flexShrink:0,transition:'all .15s'}}>
                  {label}
                </button>
              ))}
            </div>
            {products.length===0
              ?<div style={{...CARD3,textAlign:'center',padding:'56px 20px'}}>
                  <div style={{fontSize:40,marginBottom:14,opacity:.4}}>📦</div>
                  {prodTab==='live'&&parseInt(prodStats.under_review||0)>0
                    ?<>
                      <div style={{fontSize:14,fontWeight:700,color:'#fbbf24',marginBottom:8,fontFamily:PF}}>Your products are under review</div>
                      <div style={{fontSize:13,color:'rgba(200,153,42,0.4)',marginBottom:18,fontFamily:DM}}>They will appear here once approved (within 24 hours).</div>
                      <button onClick={()=>setProdTab('review')} style={{...GBTN3,padding:'10px 22px'}}>See Products Under Review →</button>
                    </>
                    :<>
                      <div style={{fontSize:14,color:'rgba(200,153,42,0.4)',marginBottom:18,fontFamily:DM}}>No products in this tab yet.</div>
                      <button onClick={()=>setShowAddProd(true)} style={GBTN3}>+ Add Your First Product</button>
                    </>
                  }
                </div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'rgba(200,153,42,0.05)',borderRadius:10,border:'1px solid rgba(200,153,42,0.15)'}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#f0ede4',fontFamily:DM}}>
                    {products.length} product{products.length!==1?'s':''} {prodTab==='review'?'under review':prodTab==='live'?'live':prodTab==='out'?'out of stock':'in drafts'}
                  </span>
                  {prodTab==='review'&&<span style={{fontSize:12,color:'rgba(251,191,36,0.6)',fontFamily:DM}}>⏳ Review up to 24 hrs</span>}
                </div>
                {products.map(p=>{
                  const statusKey=p.is_pending_review?'review':p.is_active?'live':'draft';
                  return(
                  <div key={p.id} style={{...CARD3,padding:'16px',display:'flex',alignItems:'center',gap:12,borderColor:p.is_pending_review?'rgba(251,191,36,0.3)':GBS}}>
                    <div style={{width:58,height:58,borderRadius:8,background:'rgba(200,153,42,0.06)',flexShrink:0,overflow:'hidden',border:'1px solid rgba(200,153,42,0.15)'}}>
                      {p.main_image?<img src={p.main_image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📦</div>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#f0ede4',marginBottom:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:DM}}>{p.name}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:700,color:GL,fontFamily:DM}}>{ugx(p.price)}</span>
                        <SPill2 s={statusKey}/>
                        <span style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>Stock: {p.stock_quantity}</span>
                        <span style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>👁 {p.views||0}</span>
                      </div>
                      {p.is_pending_review&&<div style={{fontSize:11,color:'rgba(251,191,36,0.6)',marginTop:4,fontFamily:DM}}>Awaiting team review before going live</div>}
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      {!p.is_pending_review&&(
                        <button onClick={()=>toggleProdActive(p.id,p.is_active)}
                          style={{fontSize:11,padding:'6px 12px',borderRadius:6,border:'1px solid rgba(200,153,42,0.25)',background:'rgba(200,153,42,0.06)',color:'rgba(200,153,42,0.6)',cursor:'pointer',fontFamily:DM}}>
                          {p.is_active?'Unpublish':'Publish'}
                        </button>
                      )}
                    </div>
                  </div>
                );})}
              </div>
            }
          </div>
        )}

        {/* ── ORDERS ── */}
        {tab==='orders'&&(
          <div>
            <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 16px',fontFamily:PF,color:'#f0ede4'}}>Your Orders</h2>
            <div style={{display:'flex',gap:0,borderBottom:'1px solid rgba(200,153,42,0.15)',marginBottom:16,overflowX:'auto',scrollbarWidth:'none'}}>
              {[['all','All'],['new','New'],['paid','Paid'],['processing','Processing'],['shipped','Shipped'],['delivered','Delivered'],['cancelled','Cancelled']].map(([id,label])=>(
                <button key={id} onClick={()=>setOrderTab(id)}
                  style={{padding:'10px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${orderTab===id?GOLD:'transparent'}`,
                    fontSize:12,fontWeight:orderTab===id?700:400,color:orderTab===id?GL:'rgba(200,153,42,0.4)',cursor:'pointer',fontFamily:DM,whiteSpace:'nowrap',flexShrink:0,transition:'all .15s'}}>
                  {label}
                </button>
              ))}
            </div>
            {orders.length===0
              ?<div style={{...CARD3,textAlign:'center',padding:'56px 20px'}}>
                  <div style={{fontSize:40,marginBottom:14,opacity:.4}}>🛍️</div>
                  <div style={{fontSize:14,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>No orders in this tab yet.</div>
                </div>
              :<div style={{display:'flex',flexDirection:'column',gap:10}}>
                {orders.map(o=>(
                  <div key={o.id} style={{...CARD3,padding:'18px 20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:'#f0ede4',marginBottom:3,fontFamily:DM}}>Order #{o.order_number}</div>
                        <div style={{fontSize:12,color:'rgba(200,153,42,0.5)',fontFamily:DM}}>{o.delivery_name} · {o.delivery_phone}</div>
                        <div style={{fontSize:11,color:'rgba(200,153,42,0.35)',marginTop:2,fontFamily:DM}}>{fmtDate(o.order_date)}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:15,fontWeight:800,color:GL,fontFamily:PF}}>{ugx(o.total_price)}</div>
                        <SPill2 s={o.status}/>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'rgba(200,153,42,0.04)',borderRadius:8,border:'1px solid rgba(200,153,42,0.12)',marginBottom:12}}>
                      <span style={{fontSize:20}}>📦</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#f0ede4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:DM}}>{o.product_name}</div>
                        <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>Qty: {o.quantity} · {ugx(o.unit_price)} each</div>
                      </div>
                    </div>
                    {['pending','paid','processing'].includes(o.status)&&(
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {o.status==='pending'&&<button onClick={()=>updateOrderStatus(o.id,'processing')} style={{fontSize:12,fontWeight:600,padding:'7px 14px',borderRadius:7,border:'none',background:'rgba(96,165,250,0.12)',color:'#60a5fa',cursor:'pointer',fontFamily:DM}}>Mark Processing</button>}
                        {o.status==='processing'&&<button onClick={()=>updateOrderStatus(o.id,'shipped')} style={{fontSize:12,fontWeight:600,padding:'7px 14px',borderRadius:7,border:'none',background:'rgba(167,139,250,0.12)',color:'#a78bfa',cursor:'pointer',fontFamily:DM}}>Mark Shipped</button>}
                        {['processing','shipped'].includes(o.status)&&<button onClick={()=>updateOrderStatus(o.id,'delivered')} style={{fontSize:12,fontWeight:600,padding:'7px 14px',borderRadius:7,border:'none',background:'rgba(74,222,128,0.12)',color:'#4ade80',cursor:'pointer',fontFamily:DM}}>Mark Delivered</button>}
                        {['pending','paid'].includes(o.status)&&<button onClick={()=>updateOrderStatus(o.id,'cancelled')} style={{fontSize:12,fontWeight:600,padding:'7px 14px',borderRadius:7,border:'none',background:'rgba(248,113,113,0.1)',color:'#f87171',cursor:'pointer',fontFamily:DM}}>Cancel</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── PAYOUTS ── */}
        {tab==='messages'&&(
          <div style={{display:'grid',gridTemplateColumns:'280px 1fr',gap:14,height:'calc(100vh - 220px)',minHeight:400}}>
            {/* Chat list */}
            <div style={{...CARD3,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(200,153,42,0.15)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:GL}}>💬 Customer Chats</div>
                {chatUnread>0&&<span style={{background:RED,color:WHITE,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:12}}>{chatUnread} unread</span>}
              </div>
              <div style={{flex:1,overflowY:'auto'}}>
                {sellerChats.length===0
                  ?<div style={{textAlign:'center',padding:'32px 16px',color:'rgba(200,153,42,0.4)',fontSize:13}}>No messages yet.<br/>Customers will appear here when they chat about your products.</div>
                  :sellerChats.map(ch=>(
                    <div key={ch.id} onClick={()=>openSellerChat(ch)}
                      style={{padding:'12px 16px',borderBottom:'1px solid rgba(200,153,42,0.1)',cursor:'pointer',
                        background:activeChat?.id===ch.id?'rgba(200,153,42,0.1)':ch.unread_seller>0?'rgba(200,153,42,0.05)':'transparent',
                        transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(200,153,42,0.08)'}
                      onMouseLeave={e=>e.currentTarget.style.background=activeChat?.id===ch.id?'rgba(200,153,42,0.1)':ch.unread_seller>0?'rgba(200,153,42,0.05)':'transparent'}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:ch.unread_seller>0?800:600,color:ch.unread_seller>0?GL:'rgba(200,153,42,0.7)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.buyer_name}</div>
                          <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.product_name||'Product enquiry'}</div>
                          <div style={{fontSize:11,color:'rgba(200,153,42,0.5)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ch.last_message||'—'}</div>
                          {ch.has_flagged&&<span style={{fontSize:9,background:'rgba(245,158,11,.2)',color:'#f59e0b',fontWeight:700,padding:'1px 6px',borderRadius:8,marginTop:3,display:'inline-block'}}>⚠️ Flagged message</span>}
                        </div>
                        {ch.unread_seller>0&&<span style={{background:YELLOW,color:TEXT,fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:10,flexShrink:0}}>{ch.unread_seller}</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Chat window */}
            <div style={{...CARD3,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {!activeChat?(
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14,color:'rgba(200,153,42,0.4)'}}>
                  <div style={{fontSize:48}}>💬</div>
                  <div style={{fontSize:14,fontWeight:600}}>Select a conversation</div>
                  <div style={{fontSize:12}}>Customers who chat about your products appear on the left</div>
                </div>
              ):(
                <>
                  {/* Chat header */}
                  <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(200,153,42,0.15)',flexShrink:0,display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:36,height:36,background:'rgba(200,153,42,0.15)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>👤</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:GL}}>{activeChat.buyer_name}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.5)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Re: {activeChat.product_name||'Product enquiry'}</div>
                    </div>
                    {activeChat.has_flagged&&<span style={{fontSize:11,background:'rgba(245,158,11,.15)',color:'#f59e0b',fontWeight:700,padding:'4px 10px',borderRadius:12,border:'1px solid rgba(245,158,11,.3)'}}>⚠️ Flagged</span>}
                  </div>
                  {/* Messages */}
                  <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                    {activeChatMsgs.map(m=>{
                      const isSeller=m.sender_type==='seller';
                      return(
                        <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:isSeller?'flex-end':'flex-start'}}>
                          <div style={{maxWidth:'80%',padding:'9px 13px',borderRadius:isSeller?'12px 12px 2px 12px':'12px 12px 12px 2px',fontSize:13,lineHeight:1.5,
                            background:isSeller?'rgba(200,153,42,0.2)':'rgba(255,255,255,0.05)',
                            color:isSeller?GL:'rgba(240,237,228,0.9)',
                            border:m.is_flagged?'2px solid #f59e0b':'1px solid rgba(200,153,42,0.15)'}}>
                            {m.body}
                            {m.is_flagged&&<div style={{marginTop:5,fontSize:10,color:'#f59e0b',fontWeight:600,padding:'4px 8px',background:'rgba(245,158,11,.1)',borderRadius:5}}>⚠️ This message was flagged — it may be requesting off-platform payment. All payments must stay on 256 Mall.</div>}
                          </div>
                          <div style={{fontSize:9,color:'rgba(200,153,42,0.35)',marginTop:2}}>{isSeller?'You':m.sender_name} · {m.created_at?new Date(m.created_at).toLocaleTimeString('en-UG',{hour:'2-digit',minute:'2-digit'}):''}</div>
                        </div>
                      );
                    })}
                    <div ref={sellerChatBottom}/>
                  </div>
                  {/* Reply input */}
                  <div style={{borderTop:'1px solid rgba(200,153,42,0.15)',padding:'12px 14px',display:'flex',gap:10,alignItems:'flex-end',flexShrink:0}}>
                    <textarea value={chatDraft} onChange={e=>setChatDraft(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendSellerMessage();}}}
                      placeholder="Reply to customer… (Enter to send)"
                      rows={2}
                      style={{flex:1,background:'rgba(200,153,42,0.05)',border:'1px solid rgba(200,153,42,0.25)',borderRadius:8,padding:'9px 12px',fontSize:13,fontFamily:DM,outline:'none',color:'#f0ede4',resize:'none'}}/>
                    <button onClick={sendSellerMessage} disabled={!chatDraft.trim()||chatSending}
                      style={{background:chatDraft.trim()?GSHINE:'rgba(200,153,42,0.2)',color:'#07070e',border:'none',borderRadius:8,padding:'10px 18px',fontSize:13,fontWeight:700,cursor:chatDraft.trim()?'pointer':'default',fontFamily:DM,flexShrink:0,opacity:chatSending?.7:1}}>
                      {chatSending?'…':'Send'}
                    </button>
                  </div>
                  <div style={{padding:'4px 14px 8px',fontSize:9,color:'rgba(200,153,42,0.35)',textAlign:'center'}}>
                    💳 Remind customers: all payments must go through 256 Mall
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab==='payouts'&&(
          <div>
            <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 18px',fontFamily:PF,color:'#f0ede4'}}>Payments & Payouts</h2>

            {/* Balance summary */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
              {[
                {label:'Available Balance',val:payouts.balance?.available||0,color:'#4ade80',icon:'✅'},
                {label:'Held Balance',val:payouts.balance?.held||0,color:'#fbbf24',icon:'🔒'},
                {label:'Pending Release',val:payouts.balance?.pending||0,color:'#60a5fa',icon:'⏳'},
                {label:'Total Earned',val:payouts.balance?.total_earned||0,color:GL,icon:'💰'},
              ].map(b=>(
                <div key={b.label} style={{...CARD3,padding:'16px 18px'}}>
                  <div style={{fontSize:20,marginBottom:8}}>{b.icon}</div>
                  <div style={{fontSize:18,fontWeight:800,color:b.color,fontFamily:PF}}>{ugx(b.val)}</div>
                  <div style={{fontSize:11,color:'rgba(200,153,42,0.45)',marginTop:4,fontFamily:DM}}>{b.label}</div>
                </div>
              ))}
            </div>

            {/* Request payout */}
            <div style={{...CARD3,padding:'20px 22px',marginBottom:18}}>
              <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:16,fontFamily:DM}}>Request Payout</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Amount (UGX)</label>
                  <input placeholder="e.g. 50000" value={payoutAmt} onChange={e=>setPayoutAmt(e.target.value)} style={inp} inputMode="numeric"/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Payout Method</label>
                  <select value={payoutMethod} onChange={e=>setPayoutMethod(e.target.value)} style={selInp}>
                    <option value="mtn_momo">MTN MoMo ({seller.mtn_momo||'not set'})</option>
                    <option value="airtel_money">Airtel Money ({seller.airtel_money||'not set'})</option>
                  </select>
                </div>
              </div>
              {payoutMsg&&<div style={{fontSize:12,padding:'9px 13px',background:payoutMsg.includes('submitted')?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)',color:payoutMsg.includes('submitted')?'#4ade80':'#f87171',borderRadius:7,marginBottom:12,border:`1px solid ${payoutMsg.includes('submitted')?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}`,fontFamily:DM}}>{payoutMsg}</div>}
              <button onClick={requestPayout} style={{...GBTN3,width:'100%',padding:'12px',fontSize:13}}>
                Request Payout →
              </button>
              <p style={{fontSize:11,color:'rgba(200,153,42,0.35)',marginTop:10,lineHeight:1.6,fontFamily:DM}}>Minimum withdrawal UGX 5,000. Processed within 24 hours on business days. 3% platform commission deducted per transaction.</p>
            </div>

            {/* Payout history */}
            {payouts.payouts?.length>0&&(
              <div style={{...CARD3,padding:'20px 22px',marginBottom:18}}>
                <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:14,fontFamily:DM}}>Payout History</div>
                {payouts.payouts.map(p=>(
                  <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid rgba(200,153,42,0.1)'}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:GL,fontFamily:DM}}>{ugx(p.amount)}</div>
                      <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>{p.method==='mtn_momo'?'MTN MoMo':'Airtel Money'} · {fmtDate(p.created_at)}</div>
                    </div>
                    <SPill2 s={p.status}/>
                  </div>
                ))}
              </div>
            )}

            {/* Transaction history */}
            {payouts.transactions?.length>0&&(
              <div style={{...CARD3,padding:'20px 22px'}}>
                <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:14,fontFamily:DM}}>Incoming Payments</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead><tr style={{background:'rgba(200,153,42,0.06)'}}>
                      {['Order','Amount','Commission','Your Payout','Status'].map(h=><th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:600,color:'rgba(200,153,42,0.55)',fontFamily:DM}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{payouts.transactions.map(t=>(
                      <tr key={t.id} style={{borderBottom:'1px solid rgba(200,153,42,0.08)'}}>
                        <td style={{padding:'10px 12px',color:'#f0ede4',fontFamily:DM}}>{t.order_number||'—'}</td>
                        <td style={{padding:'10px 12px',color:'#f0ede4',fontFamily:DM}}>{ugx(t.amount)}</td>
                        <td style={{padding:'10px 12px',color:'#f87171',fontFamily:DM}}>−{ugx(t.commission)}</td>
                        <td style={{padding:'10px 12px',fontWeight:700,color:'#4ade80',fontFamily:DM}}>{ugx(t.net_amount)}</td>
                        <td style={{padding:'10px 12px'}}><SPill2 s={t.status}/></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHOP PROFILE ── */}
        {tab==='profile'&&(
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:0,fontFamily:PF,color:'#f0ede4'}}>My Shop Profile</h2>
              {!profileEdit
                ?<button onClick={()=>setProfileEdit(true)} style={{fontSize:13,fontWeight:600,padding:'9px 20px',borderRadius:8,border:'1px solid rgba(200,153,42,0.25)',background:'rgba(200,153,42,0.06)',color:'rgba(200,153,42,0.7)',cursor:'pointer',fontFamily:DM}}>Edit Profile</button>
                :<div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setProfileEdit(false);setProfileForm(profile);}} style={{fontSize:13,padding:'9px 18px',borderRadius:8,border:'1px solid rgba(200,153,42,0.2)',background:'transparent',color:'rgba(200,153,42,0.5)',cursor:'pointer',fontFamily:DM}}>Cancel</button>
                  <button onClick={saveProfile} disabled={saving} style={{...GBTN3,padding:'9px 22px',fontSize:13,opacity:saving?.7:1}}>{saving?'Saving…':'Save Changes'}</button>
                </div>
              }
            </div>

            {profileEdit&&profileEditor.pendingDraft&&<UnsavedDraftBanner onRestore={profileEditor.restoreDraft} onDiscard={profileEditor.discardDraft}/>}
            <div style={{...CARD3,padding:'22px',display:'flex',flexDirection:'column',gap:14,marginBottom:16}}>
              {profileEdit?(
                <>
                  {[
                    {label:'Shop Name',k:'shop_name',ph:'Your shop name'},
                    {label:'Phone',k:'phone',ph:'07XX XXX XXX'},
                    {label:'Email',k:'email',ph:'shop@email.com'},
                    {label:'MTN MoMo Number',k:'mtn_momo',ph:'077/078 XXXXXXX'},
                    {label:'Airtel Money Number',k:'airtel_money',ph:'070/075 XXXXXXX'},
                    {label:'Address / Area',k:'address',ph:'e.g. Kalerwe Market, Stall 14'},
                  ].map(f=>(
                    <div key={f.k}>
                      <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>{f.label}</label>
                      <input value={profileForm[f.k]||''} onChange={e=>setProfileForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={inp}/>
                    </div>
                  ))}
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>District</label>
                    <select value={profileForm.district||''} onChange={e=>setProfileForm(p=>({...p,district:e.target.value}))} style={selInp}>
                      <option value="">Select district</option>
                      {[...new Set(SELL_DISTRICTS)].sort().map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Shop Description</label>
                    <textarea value={profileForm.description||''} onChange={e=>setProfileForm(p=>({...p,description:e.target.value}))} placeholder="Describe your shop, products and services…" style={{...inp,minHeight:80,resize:'vertical',lineHeight:1.6}}/>
                  </div>
                </>
              ):(
                <>
                  {[
                    ['Shop Name',profile?.shop_name],
                    ['Phone',profile?.phone],
                    ['Email',profile?.email],
                    ['MTN MoMo',profile?.mtn_momo],
                    ['Airtel Money',profile?.airtel_money],
                    ['District',profile?.district],
                    ['Address',profile?.address],
                    ['Seller Type',profile?.seller_type],
                    ['Member Since',fmtDate(profile?.created_at)],
                  ].map(([k,v])=>v?(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',fontSize:13,padding:'11px 14px',background:'rgba(200,153,42,0.04)',borderRadius:8,border:'1px solid rgba(200,153,42,0.1)'}}>
                      <span style={{color:'rgba(200,153,42,0.45)',flexShrink:0,marginRight:12,fontFamily:DM}}>{k}</span>
                      <span style={{color:'#f0ede4',fontWeight:500,textAlign:'right',wordBreak:'break-word',fontFamily:DM}}>{v}</span>
                    </div>
                  ):null)}
                  {profile?.description&&(
                    <div style={{padding:'13px',background:'rgba(200,153,42,0.04)',borderRadius:8,border:'1px solid rgba(200,153,42,0.1)'}}>
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'rgba(200,153,42,0.45)',marginBottom:6,fontFamily:DM}}>Description</div>
                      <div style={{fontSize:13,color:'rgba(200,153,42,0.7)',lineHeight:1.6,fontFamily:DM}}>{profile.description}</div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Verification checklist */}
            <div style={{...CARD3,padding:'22px'}}>
              <div style={{fontSize:10,letterSpacing:2,color:'rgba(200,153,42,0.5)',fontWeight:700,textTransform:'uppercase',marginBottom:16,fontFamily:DM}}>Seller Verification</div>
              {[
                [!!profile?.phone,'Phone number added','Required for buyer contact'],
                [!!profile?.mtn_momo||!!profile?.airtel_money,'Mobile money payout added','Required to receive payments'],
                [!!profile?.district,'Location confirmed','Your district is set'],
                [profile?.is_verified,'Identity verified','Submit ID to verify your account'],
              ].map(([done,label,sub])=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid rgba(200,153,42,0.1)'}}>
                  <span style={{fontSize:18,flexShrink:0}}>{done?'✅':'⬜'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:done?700:400,color:done?'#4ade80':'#f0ede4',fontFamily:DM}}>{label}</div>
                    <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>{sub}</div>
                  </div>
                  {!done&&<span style={{fontSize:10,fontWeight:700,color:'#fbbf24',background:'rgba(251,191,36,0.1)',padding:'3px 10px',borderRadius:8,border:'1px solid rgba(251,191,36,0.2)',fontFamily:DM}}>Pending</span>}
                </div>
              ))}
              <div style={{marginTop:16,background:'rgba(74,222,128,0.06)',borderRadius:8,padding:'13px 16px',display:'flex',alignItems:'center',gap:10,border:'1px solid rgba(74,222,128,0.15)'}}>
                <span style={{fontSize:20}}>📋</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#4ade80',fontFamily:DM}}>Upload National ID to get Verified Seller badge</div>
                  <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>Contact support via WhatsApp to submit verification documents.</div>
                </div>
              </div>
              <a href="https://wa.me/256200900256?text=Hello%2C%20I%20want%20to%20verify%20my%20seller%20account%20on%20256%20Mall" target="_blank" rel="noopener noreferrer"
                style={{display:'block',marginTop:14,background:'#25D366',color:'#fff',borderRadius:8,padding:'11px',textAlign:'center',fontSize:13,fontWeight:700,textDecoration:'none',fontFamily:DM}}>
                💬 Contact Support on WhatsApp
              </a>
            </div>
          </div>
        )}

      </div>

      {/* ── ADD PRODUCT MODAL ── */}
      {showAddProd&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',zIndex:1000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowAddProd(false);}}>
          <div style={{background:'#0d0a04',border:'1px solid rgba(200,153,42,0.3)',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:700,maxHeight:'92vh',overflowY:'auto',padding:'24px 22px 44px',boxShadow:'0 -20px 60px rgba(0,0,0,.9)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
              <div style={{fontSize:18,fontWeight:900,fontFamily:PF,background:GSWEEP,backgroundSize:'300% auto',backgroundClip:'text',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Add New Product</div>
              <button onClick={()=>setShowAddProd(false)} style={{background:'rgba(200,153,42,0.08)',border:'1px solid rgba(200,153,42,0.2)',borderRadius:8,width:32,height:32,cursor:'pointer',color:'rgba(200,153,42,0.6)',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Product Name *</label>
                <input placeholder="e.g. Samsung Galaxy A54, Fresh Maize 50kg" value={newProd.name} onChange={e=>setNewProd(p=>({...p,name:e.target.value}))} style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Category *</label>
                  <select value={newProd.category} onChange={e=>setNewProd(p=>({...p,category:e.target.value,subcategory:''}))} style={selInp}>
                    <option value="">Select category</option>
                    {SELL_CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Subcategory</label>
                  <select value={newProd.subcategory} onChange={e=>setNewProd(p=>({...p,subcategory:e.target.value}))} style={selInp} disabled={!newProd.category}>
                    <option value="">Select subcategory</option>
                    {(SELL_CATEGORIES.find(c=>c.value===newProd.category)?.subs||[]).map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Price (UGX) *</label>
                  <input placeholder="e.g. 150000" value={newProd.price} onChange={e=>setNewProd(p=>({...p,price:e.target.value}))} style={inp} inputMode="numeric"/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Condition</label>
                  <select value={newProd.condition} onChange={e=>setNewProd(p=>({...p,condition:e.target.value}))} style={selInp}>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Description *</label>
                <textarea placeholder="Describe your product in detail…" value={newProd.description} onChange={e=>setNewProd(p=>({...p,description:e.target.value}))} style={{...inp,minHeight:80,resize:'vertical',lineHeight:1.6}}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:5,fontFamily:DM}}>Quantity / Stock</label>
                <input placeholder="e.g. 10" value={newProd.quantity} onChange={e=>setNewProd(p=>({...p,quantity:e.target.value}))} style={inp} inputMode="numeric"/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:8,fontFamily:DM}}>Delivery Options</label>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontSize:11,color:'rgba(200,153,42,0.45)',marginBottom:6,lineHeight:1.5}}>Select all that apply — buyers will see these options on your listing.</div>
                  {[['walkin','🚶','Walk-in / Browse in store','Customers can visit your shop and buy directly.'],
                    ['pickup','🏪','Self Pickup','Buyer orders online and collects from your location.'],
                    ['delivery','🛵','Local Delivery','You or a rider delivers within your area/district.'],
                    ['nationwide','🚚','Nationwide Delivery','Delivery to any of the 146 districts in Uganda.']].map(([val,icon,title,sub])=>{
                    const sel=newProd.delivery.includes(val);
                    return(<button key={val} onClick={()=>toggleDeliveryNew(val)}
                      style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',border:`1px solid ${sel?'rgba(74,222,128,0.5)':'rgba(200,153,42,0.2)'}`,borderRadius:9,background:sel?'rgba(74,222,128,0.08)':'rgba(200,153,42,0.02)',cursor:'pointer',fontFamily:DM,textAlign:'left',width:'100%',transition:'all .15s'}}>
                      <span style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${sel?'#4ade80':'rgba(200,153,42,0.3)'}`,background:sel?'#4ade80':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#07070e',fontWeight:700,flexShrink:0,marginTop:1}}>{sel?'✓':icon}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:sel?700:500,color:sel?'#4ade80':'rgba(200,153,42,0.7)',marginBottom:2}}>{title}</div>
                        <div style={{fontSize:11,color:'rgba(200,153,42,0.4)',lineHeight:1.4}}>{sub}</div>
                      </div>
                    </button>);
                  })}
                  {newProd.delivery.length===0&&<div style={{fontSize:11,color:'#f87171',padding:'6px 10px',background:'rgba(248,113,113,0.08)',borderRadius:6,border:'1px solid rgba(248,113,113,0.2)'}}>⚠️ Select at least one fulfillment option — buyers need to know how to get their order.</div>}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:'rgba(200,153,42,0.55)',display:'block',marginBottom:6,fontFamily:DM}}>Images <span style={{fontWeight:400,color:'rgba(200,153,42,0.35)'}}>(up to 10)</span></label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                  {newProdImages.map((img,i)=>(
                    <div key={i} style={{position:'relative',aspectRatio:'1',borderRadius:8,overflow:'hidden',border:'1px solid rgba(200,153,42,0.2)'}}>
                      <img src={img.preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      <button onClick={()=>setNewProdImages(imgs=>{URL.revokeObjectURL(imgs[i].preview);return imgs.filter((_,idx)=>idx!==i);})} style={{position:'absolute',top:3,right:3,width:20,height:20,borderRadius:'50%',background:'rgba(0,0,0,.7)',border:'none',color:'#fff',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:DM}}>×</button>
                    </div>
                  ))}
                  {newProdImages.length<10&&(
                    <label style={{aspectRatio:'1',borderRadius:8,border:'2px dashed rgba(200,153,42,0.25)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',background:'rgba(200,153,42,0.03)',gap:4}}>
                      <span style={{fontSize:22,opacity:.5}}>📷</span>
                      <span style={{fontSize:10,color:'rgba(200,153,42,0.4)',fontFamily:DM}}>Add photo</span>
                      <input type="file" accept="image/*" multiple capture="environment" onChange={addNewProdImages} style={{display:'none'}}/>
                    </label>
                  )}
                </div>
              </div>
              <button onClick={submitNewProduct} disabled={addLoading}
                style={{...GBTN3,width:'100%',padding:'14px',fontSize:14,opacity:addLoading?.7:1,marginTop:6,cursor:addLoading?'not-allowed':'pointer'}}>
                {addLoading?'Submitting…':'Submit Product →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pesapal Payment Callback ─────────────────────────────────────────────────
function PesapalCallbackPage(){
  const [params]=useSearchParams();
  const nav=useNavigate();
  const ref=params.get('OrderMerchantReference')||params.get('ref');
  const [status,setStatus]=useState('checking');
  useEffect(()=>{
    if(!ref){setStatus('error');return;}
    let tries=0;
    const poll=async()=>{
      tries++;
      try{
        const r=await fetch(`/api/pesapal/status/${ref}`);
        const d=await r.json();
        if(d.status==='SUCCESSFUL'){setStatus('success');return;}
        if(d.status==='FAILED'){setStatus('failed');return;}
      }catch{}
      if(tries<15)setTimeout(poll,2000);
      else setStatus('timeout');
    };
    poll();
  },[ref]);
  const states={
    checking:{icon:null,spin:true,title:'Verifying Payment…',sub:'Confirming your transaction with Pesapal. This takes a few seconds.',btnLabel:null,btnAction:null,btnStyle:null,accentColor:'#c8992a'},
    success:{icon:'✓',spin:false,title:'Payment Confirmed',sub:'Your order is paid and now being prepared. You\'ll receive updates as it progresses.',btnLabel:'View My Orders →',btnAction:'/account',btnStyle:GSHINE,accentColor:'#4ade80'},
    failed:{icon:'✕',spin:false,title:'Payment Failed',sub:'The payment was not completed. You have not been charged.',btnLabel:'Return to Checkout',btnAction:'/checkout',btnStyle:'linear-gradient(135deg,#ef4444,#b91c1c)',accentColor:'#f87171'},
    error:{icon:'✕',spin:false,title:'Payment Failed',sub:'The payment was not completed. You have not been charged.',btnLabel:'Return to Checkout',btnAction:'/checkout',btnStyle:'linear-gradient(135deg,#ef4444,#b91c1c)',accentColor:'#f87171'},
    timeout:{icon:'◷',spin:false,title:'Still Processing',sub:'Your payment is being verified. Your order will update automatically once confirmed.',btnLabel:'View My Orders',btnAction:'/account',btnStyle:GSHINE,accentColor:'#f5d060'},
  };
  const s=states[status]||states.checking;
  return(
    <div style={{background:'linear-gradient(160deg,#07070e 0%,#0d0b04 50%,#07070e 100%)',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:DM}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}@keyframes glow{0%,100%{box-shadow:0 0 0 0 ${s.accentColor}40}50%{box-shadow:0 0 0 20px ${s.accentColor}00}}`}</style>
      {/* Brand mark */}
      <div style={{marginBottom:40,textAlign:'center',animation:'fadeIn .5s ease'}}>
        <div style={{fontSize:11,letterSpacing:5,color:'rgba(200,153,42,0.4)',fontWeight:700,textTransform:'uppercase',marginBottom:8}}>256 Mall</div>
        <div style={{height:1,width:80,background:'linear-gradient(90deg,transparent,#c8992a,transparent)',margin:'0 auto'}}/>
      </div>
      <div style={{background:'linear-gradient(145deg,rgba(200,153,42,0.08),rgba(7,7,14,0.97))',border:`1px solid ${s.accentColor}40`,borderRadius:24,padding:'52px 44px',maxWidth:460,width:'100%',textAlign:'center',boxShadow:`0 8px 80px ${s.accentColor}18`,animation:'fadeIn .6s ease'}}>
        {/* Icon */}
        <div style={{width:80,height:80,borderRadius:'50%',background:`${s.accentColor}18`,border:`2px solid ${s.accentColor}60`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 28px',animation:'glow 2.5s ease-in-out infinite'}}>
          {s.spin
            ?<div style={{width:36,height:36,border:`3px solid ${s.accentColor}30`,borderTop:`3px solid ${s.accentColor}`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
            :<span style={{fontSize:36,fontWeight:900,color:s.accentColor,lineHeight:1}}>{s.icon}</span>}
        </div>
        <div style={{fontSize:10,letterSpacing:4,color:`${s.accentColor}99`,fontWeight:700,textTransform:'uppercase',marginBottom:10}}>
          {status==='checking'?'Processing':'Payment '+status}
        </div>
        <h2 style={{fontSize:28,fontWeight:900,fontFamily:PF,color:'#f0ede4',margin:'0 0 14px',lineHeight:1.2}}>{s.title}</h2>
        <p style={{fontSize:14,color:'rgba(200,153,42,0.5)',lineHeight:1.8,marginBottom:s.btnLabel?32:0}}>{s.sub}</p>
        {s.btnLabel&&(
          <button onClick={()=>nav(s.btnAction)}
            style={{background:s.btnStyle,color:'#07070e',border:'none',borderRadius:12,padding:'15px 36px',fontSize:15,fontWeight:900,cursor:'pointer',fontFamily:PF,letterSpacing:.5,boxShadow:`0 0 32px ${s.accentColor}40`,width:'100%'}}>
            {s.btnLabel}
          </button>
        )}
      </div>
      <div style={{marginTop:28,fontSize:11,color:'rgba(200,153,42,0.3)',letterSpacing:1}}>🔒 Secured by Pesapal · 256 Mall</div>
    </div>
  );
}

function SellerStorefrontPage({cart}){
  const {slug}=useParams();
  const nav=useNavigate();
  const [tab,setTab]=useState('products');
  const [seller,setSeller]=useState(null);
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let alive=true;
    async function loadStore(){
      setLoading(true);
      setError('');
      try{
        const sellerRes=await fetch(`/api/sellers/${encodeURIComponent(slug)}`);
        const sellerData=await sellerRes.json().catch(()=>({}));
        if(!sellerRes.ok||!sellerData.seller) throw new Error(sellerData.error||'Store not found');
        if(!alive) return;
        setSeller(sellerData.seller);
        const productRes=await fetch(`/api/products?seller_id=${encodeURIComponent(sellerData.seller.id)}&limit=60`);
        const productData=await productRes.json().catch(()=>({products:[]}));
        if(!alive) return;
        setProducts(Array.isArray(productData.products)?productData.products:[]);
      }catch(err){
        if(alive) setError(err.message||'Store not found');
      }finally{
        if(alive) setLoading(false);
      }
    }
    loadStore();
    return()=>{alive=false;};
  },[slug]);

  const money=(value)=>`UGX ${Number(value||0).toLocaleString()}`;
  const category=seller?.seller_type?String(seller.seller_type).replace(/_/g,' '):'Verified Seller';
  const district=seller?.district||'Uganda';
  const payout=seller?.mtn_momo?'MTN MoMo':seller?.airtel_money?'Airtel Money':'Mobile Money';
  const productCount=Number(seller?.product_count||products.length||0);
  const joined=seller?.created_at?new Date(seller.created_at).toLocaleDateString('en-UG',{month:'long',year:'numeric'}):'July 2026';

  if(loading){
    return <div style={{minHeight:'60vh',display:'grid',placeItems:'center',background:'#f7f5f0',fontFamily:'Outfit, sans-serif',color:'#92660a'}}>Loading store...</div>;
  }
  if(error||!seller){
    return (
      <div style={{minHeight:'60vh',display:'grid',placeItems:'center',background:'#f7f5f0',fontFamily:'Outfit, sans-serif',textAlign:'center',padding:24}}>
        <div>
          <div style={{fontFamily:'DM Serif Display, serif',fontSize:36,fontStyle:'italic',marginBottom:10}}>Store not found</div>
          <p style={{color:'rgba(13,15,12,.58)',marginBottom:22}}>{error||'This seller storefront is not available.'}</p>
          <button onClick={()=>nav('/products')} style={{border:'none',background:'linear-gradient(120deg,#fdeec0,#c99a2e,#f3d98a)',padding:'12px 22px',borderRadius:8,fontWeight:800,cursor:'pointer'}}>Browse 256 Mall</button>
        </div>
      </div>
    );
  }

  return (
    <div className="storefront-page">
      <style>{`
        .storefront-page{--ink:#0d0f0c;--paper:#f7f5f0;--card:#fffdf8;--line:rgba(13,15,12,.10);--muted:rgba(13,15,12,.55);--muted2:rgba(13,15,12,.38);--gold:#92660a;--gold2:#c99a2e;--goldsoft:#d9b869;--red:#b91c1c;background:var(--paper);color:var(--ink);font-family:Outfit,system-ui,sans-serif;font-weight:300}
        .sf-utility{background:var(--ink);color:var(--goldsoft);display:flex;align-items:center;justify-content:center;padding:11px 24px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;border-bottom:2px solid var(--gold2);font-weight:700}
        .sf-cover{height:280px;background:#fff;padding:10px;border-top:2px solid var(--gold2);border-bottom:3px solid var(--ink)}
        .sf-cover-inner{position:relative;width:100%;height:100%;overflow:hidden;border:1px solid var(--gold2);background:linear-gradient(150deg,#efe6d0 0%,#f7f3e8 55%,#ece2c9 100%);background-size:cover;background-position:center}
        .sf-cover-inner::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,15,12,0) 0%,rgba(13,15,12,.55) 100%)}
        .sf-crumb{position:absolute;top:18px;left:24px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--ink);z-index:1;font-weight:700}.sf-crumb b{color:var(--red)}
        .sf-cover-title{position:absolute;left:24px;bottom:22px;z-index:1;color:#fff;font-family:"DM Serif Display",serif;font-style:italic;font-size:34px;text-shadow:0 3px 18px rgba(0,0,0,.35)}
        .sf-header{background:var(--card);border-bottom:2px solid var(--ink);padding:0 32px 24px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
        .sf-header-left{display:flex;align-items:center;gap:20px}.sf-logo{width:96px;height:96px;border-radius:50%;flex-shrink:0;background:var(--paper);border:4px solid var(--card);box-shadow:0 6px 18px rgba(13,15,12,.18);overflow:hidden;margin-top:-46px;display:grid;place-items:center;color:var(--gold);font-size:30px;font-weight:800;background-size:cover;background-position:center}
        .sf-header-text{padding-top:24px;padding-bottom:6px}.sf-brand{display:flex;align-items:center;gap:9px;font-family:"DM Serif Display",serif;font-style:italic;font-size:28px;color:var(--ink);letter-spacing:.01em}.sf-badge{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;background:var(--red);color:#fff;font-size:11px;font-style:normal;flex-shrink:0}.sf-sub{margin-top:6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);font-weight:700}
        .sf-actions{display:flex;gap:12px;padding-bottom:8px}.sf-line,.sf-solid{padding:12px 24px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;cursor:pointer}.sf-line{border:1.5px solid var(--ink);background:transparent;color:var(--ink)}.sf-line:hover{background:var(--ink);color:#fff}.sf-solid{border:none;color:var(--ink);background:linear-gradient(120deg,#fdeec0 0%,#e9c569 25%,#c99a2e 55%,#f3d98a 80%,#e9c569 100%);box-shadow:0 4px 14px rgba(201,154,46,.4),inset 0 1px 0 rgba(255,255,255,.55)}
        .sf-stats{display:flex;justify-content:center;gap:0;padding:20px 24px;background:var(--ink);border-bottom:2px solid var(--gold2);flex-wrap:wrap}.sf-stat{display:flex;align-items:baseline;gap:8px;padding:0 28px;border-right:1px solid rgba(247,245,240,.16)}.sf-stat:last-child{border-right:none}.sf-stat-num{font-family:"DM Serif Display",serif;font-size:19px;color:#fff}.sf-stat-label{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--goldsoft);font-weight:700}
        .sf-tabs{background:var(--card);border-bottom:2px solid var(--ink);display:flex;justify-content:center;padding-top:18px;gap:44px}.sf-tab{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);padding:0 0 16px;border:0;border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-weight:800}.sf-tab.active{color:var(--ink);border-bottom-color:var(--gold2)}
        .sf-body{max-width:1080px;margin:0 auto;padding:56px 32px 100px}.sf-heading{text-align:center;margin-bottom:44px}.sf-eyebrow{font-size:11px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:var(--gold);margin-bottom:10px}.sf-heading h2{font-family:"DM Serif Display",serif;font-weight:400;font-style:italic;font-size:32px;margin:0}.sf-divider{width:56px;height:1px;background:var(--gold2);margin:18px auto 0}
        .sf-products{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--line);border:1px solid var(--line)}.sf-product{background:var(--card);position:relative;overflow:hidden}.sf-product-img{height:320px;background:linear-gradient(150deg,#efe6d0 0%,#f7f3e8 55%,#ece2c9 100%);display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;cursor:pointer}.sf-img-empty{display:flex;flex-direction:column;align-items:center;gap:6px;color:rgba(146,102,10,.55);font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}.sf-product-info{display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;background:var(--ink);padding:16px;height:210px}.sf-product-name{font-family:"DM Serif Display",serif;font-style:italic;font-size:14.5px;margin-bottom:4px;color:#fff}.sf-product-desc{font-size:10.5px;line-height:1.4;color:rgba(255,255,255,.72);margin-bottom:6px;padding:0 2px}.sf-discount{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink);background:var(--goldsoft);padding:2px 8px;border-radius:999px;margin-bottom:5px}.sf-was{font-size:10px;color:rgba(255,255,255,.55);text-decoration:line-through;margin-bottom:2px}.sf-product-actions{width:100%;display:flex;flex-direction:column;gap:6px;margin:6px 0}.sf-price{width:100%;padding:8px 12px;border-radius:8px;border:none;cursor:pointer;font-weight:800;font-size:12.5px;color:var(--ink);background:linear-gradient(120deg,#fdeec0,#e9c569,#c99a2e,#f3d98a);box-shadow:0 3px 10px rgba(201,154,46,.4)}.sf-order{width:100%;padding:7px 12px;border-radius:8px;cursor:pointer;border:1.5px solid var(--goldsoft);background:transparent;color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.sf-order:hover{background:var(--goldsoft);color:var(--ink)}.sf-shipping{width:100%;font-size:9px;letter-spacing:.04em;color:rgba(255,255,255,.62);text-transform:uppercase;border-top:1px solid rgba(255,255,255,.14);padding-top:7px}.sf-shipping b{color:var(--goldsoft)}
        .sf-empty{background:var(--card);border:1px solid var(--line);text-align:center;padding:56px 24px}.sf-empty h3{font-family:"DM Serif Display",serif;font-style:italic;font-weight:400;font-size:28px;margin:0 0 10px}.sf-empty p{color:var(--muted);margin:0}
        .sf-about{display:grid;grid-template-columns:1.3fr 1fr;border:1px solid var(--line);border-radius:4px;overflow:hidden}.sf-about-quote{background:var(--ink);padding:40px 44px}.sf-quote{font-family:"DM Serif Display",serif;font-style:italic;font-size:22px;line-height:1.5;color:#fff;position:relative;padding-left:26px}.sf-quote::before{content:"\\201C";position:absolute;left:-6px;top:-10px;font-size:52px;color:var(--goldsoft)}.sf-quote-attr{margin-top:20px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--goldsoft);padding-left:26px}.sf-details{background:var(--card);padding:40px 44px;border-left:1px solid var(--line)}.sf-detail{display:flex;justify-content:space-between;gap:18px;padding:15px 0;border-bottom:1px solid var(--line)}.sf-detail:first-child{border-top:1px solid var(--line)}.sf-detail-k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted2);font-weight:800}.sf-detail-v{font-size:13.5px;color:var(--ink);font-weight:500;text-align:right}
        .sf-review-card{background:var(--card);border:1px solid var(--line);text-align:center;padding:44px 24px}.sf-review-stars{color:var(--gold2);font-size:13px;letter-spacing:3px;margin-bottom:16px}.sf-review-text{font-family:"DM Serif Display",serif;font-style:italic;font-size:18px;line-height:1.65;color:var(--ink);margin-bottom:16px}.sf-review-name{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted2);font-weight:800}
        .sf-footer{background:var(--ink);color:rgba(247,245,240,.4);text-align:center;padding:40px 24px}.sf-footer-mark{font-family:"DM Serif Display",serif;font-style:italic;font-size:20px;color:var(--paper);margin-bottom:10px}.sf-footer-line{width:36px;height:1px;background:var(--goldsoft);margin:18px auto}.sf-footer-note{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase}.sf-footer-contact{font-size:11px;letter-spacing:.06em;color:var(--goldsoft);margin-top:10px}
        @media(max-width:760px){.sf-cover{height:220px}.sf-header{padding:0 20px 22px}.sf-actions{width:100%;padding-bottom:0}.sf-line,.sf-solid{flex:1;padding-left:12px;padding-right:12px}.sf-products{grid-template-columns:1fr}.sf-about{grid-template-columns:1fr}.sf-details{border-left:0}.sf-tabs{gap:20px}.sf-brand{font-size:24px}.sf-body{padding:44px 18px 72px}.sf-stat{border-right:0;padding:6px 16px}}
      `}</style>
      <div className="sf-utility">256 Mall - Uganda's National Online Shopping Center</div>
      <div className="sf-cover">
        <div className="sf-cover-inner" style={seller.cover_image_url?{backgroundImage:`url(${seller.cover_image_url})`}:undefined}>
          <div className="sf-crumb">256 Mall &nbsp;·&nbsp; <b>{category}</b> &nbsp;·&nbsp; {district}</div>
          <div className="sf-cover-title">{seller.shop_name}</div>
        </div>
      </div>
      <div className="sf-header">
        <div className="sf-header-left">
          <div className="sf-logo" style={seller.logo_url?{backgroundImage:`url(${seller.logo_url})`}:undefined}>{!seller.logo_url&&(seller.shop_name||'S').slice(0,1).toUpperCase()}</div>
          <div className="sf-header-text">
            <div className="sf-brand">{seller.shop_name} {seller.is_verified&&<span className="sf-badge">✓</span>}</div>
            <div className="sf-sub">Verified {category} · Est. {joined}</div>
          </div>
        </div>
        <div className="sf-actions">
          <a className="sf-line" href={`tel:${seller.phone||''}`}>Message Store</a>
          <button className="sf-solid" onClick={()=>nav('/products')}>Follow Store</button>
        </div>
      </div>
      <div className="sf-stats">
        <div className="sf-stat"><span className="sf-stat-num">{productCount}</span><span className="sf-stat-label">Products</span></div>
        <div className="sf-stat"><span className="sf-stat-num">{seller.rating?Number(seller.rating).toFixed(1):'New'}</span><span className="sf-stat-label">Rating</span></div>
        <div className="sf-stat"><span className="sf-stat-num">{district}</span><span className="sf-stat-label">District</span></div>
        <div className="sf-stat"><span className="sf-stat-num">&lt;1hr</span><span className="sf-stat-label">Response</span></div>
      </div>
      <div className="sf-tabs">
        <button className={`sf-tab ${tab==='products'?'active':''}`} onClick={()=>setTab('products')}>Collection</button>
        <button className={`sf-tab ${tab==='about'?'active':''}`} onClick={()=>setTab('about')}>The Story</button>
        <button className={`sf-tab ${tab==='reviews'?'active':''}`} onClick={()=>setTab('reviews')}>Testimonials</button>
      </div>
      <div className="sf-body">
        {tab==='products'&&(
          <>
            <div className="sf-heading"><div className="sf-eyebrow">The Collection</div><h2>Listed on 256 Mall</h2><div className="sf-divider"/></div>
            {products.length>0?(
              <div className="sf-products">
                {products.map(p=>{
                  const price=Number(p.price||0);
                  const original=Number(p.original_price||0);
                  const discount=original>price&&price>0?Math.round((1-price/original)*100):0;
                  return (
                    <div className="sf-product" key={p.id}>
                      <div className="sf-product-img" onClick={()=>nav(`/product/${p.id}`)} style={p.primary_image?{backgroundImage:`url(${p.primary_image})`}:undefined}>
                        {!p.primary_image&&<div className="sf-img-empty"><span style={{fontSize:22}}>□</span><span>No Product Image</span></div>}
                      </div>
                      <div className="sf-product-info">
                        <div>
                          <div className="sf-product-name">{p.name}</div>
                          <div className="sf-product-desc">{p.description||p.category_name||'Available from this verified 256 Mall seller.'}</div>
                          {discount>0&&<div className="sf-discount">-{discount}% · Applied Automatically</div>}
                          {discount>0&&<div className="sf-was">{money(original)}</div>}
                        </div>
                        <div className="sf-product-actions">
                          <button className="sf-price" onClick={()=>nav(`/product/${p.id}`)}>{money(price)}</button>
                          <button className="sf-order" onClick={()=>cart?.add?p.stock_quantity===0?nav(`/product/${p.id}`):cart.add(p.id):nav(`/product/${p.id}`)}>Order Now</button>
                        </div>
                        <div className="sf-shipping"><b>256 Delivery</b> · All Districts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div className="sf-empty"><h3>No live products yet</h3><p>This seller storefront is ready. Products will appear here after approval.</p></div>
            )}
          </>
        )}
        {tab==='about'&&(
          <>
            <div className="sf-heading"><div className="sf-eyebrow">The Story</div><h2>{seller.shop_name}</h2><div className="sf-divider"/></div>
            <div className="sf-about">
              <div className="sf-about-quote">
                <p className="sf-quote">{seller.description||`${seller.shop_name} is a verified 256 Mall seller serving buyers across Uganda with mobile-money payments and nationwide delivery.`}</p>
                <div className="sf-quote-attr">- {seller.shop_name}</div>
              </div>
              <div className="sf-details">
                <div className="sf-detail"><span className="sf-detail-k">Category</span><span className="sf-detail-v">{category}</span></div>
                <div className="sf-detail"><span className="sf-detail-k">District</span><span className="sf-detail-v">{district}</span></div>
                <div className="sf-detail"><span className="sf-detail-k">Phone</span><span className="sf-detail-v">{seller.phone||'Available on request'}</span></div>
                <div className="sf-detail"><span className="sf-detail-k">Email</span><span className="sf-detail-v">{seller.email||'Not listed'}</span></div>
                <div className="sf-detail"><span className="sf-detail-k">Payout Method</span><span className="sf-detail-v">{payout}</span></div>
                <div className="sf-detail"><span className="sf-detail-k">Delivery</span><span className="sf-detail-v">All 146 Districts</span></div>
                <div className="sf-detail"><span className="sf-detail-k">Established</span><span className="sf-detail-v">{joined}</span></div>
              </div>
            </div>
          </>
        )}
        {tab==='reviews'&&(
          <>
            <div className="sf-heading"><div className="sf-eyebrow">Testimonials</div><h2>Customer Reviews</h2><div className="sf-divider"/></div>
            <div className="sf-review-card">
              <div className="sf-review-stars">★★★★★</div>
              <div className="sf-review-text">Verified customer reviews will appear here after buyers complete orders.</div>
              <div className="sf-review-name">256 Mall Reviews</div>
            </div>
          </>
        )}
      </div>
      <div className="sf-footer">
        <div className="sf-footer-mark">{seller.shop_name}</div>
        <div className="sf-footer-line"></div>
        <div className="sf-footer-note">A 256 Mall Verified Store · {district}, Uganda</div>
        <div className="sf-footer-contact">{seller.phone||''}{seller.phone&&seller.email?' · ':''}{seller.email||''}</div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const cart=useCart();
  const auth=useAuth();
  useEffect(()=>{
    const ref=new URLSearchParams(window.location.search).get('ref');
    if(ref) localStorage.setItem('256mall_ref',ref);
  },[]);
  if(LAUNCH_GATE) return <LaunchGatePage/>;
  return(
    <BrowserRouter>
      <ChatProvider>
      <Navbar cartCount={cart.count} user={auth.user} logout={auth.logout}/>
      <InstallAppBanner/>
      <Routes>
        <Route path="/" element={<HomePage cart={cart}/>}/>
        <Route path="/shop" element={<LandingPage cart={cart}/>}/>
        <Route path="/products" element={<ProductsPage cart={cart}/>}/>
        <Route path="/category/:slug" element={<ProductsPage cart={cart}/>}/>
        <Route path="/product/:id" element={<ProductPage cart={cart}/>}/>
        <Route path="/store/:slug" element={<SellerStorefrontPage cart={cart}/>}/>
        <Route path="/search" element={<SearchPage cart={cart}/>}/>
        <Route path="/cart" element={<CartPage cart={cart}/>}/>
        <Route path="/checkout" element={<CheckoutPage cart={cart} auth={auth}/>}/>
        <Route path="/login" element={<AuthPage auth={auth}/>}/>
        <Route path="/register" element={<AuthPage auth={auth}/>}/>
        <Route path="/sell" element={<SellPage auth={auth}/>}/>
        <Route path="/track" element={<TrackPage/>}/>
        <Route path="/news" element={<NewsPage/>}/>
        <Route path="/produce" element={<ProduceMarketPage/>}/>
        <Route path="/produce/:id" element={<ProduceDetailPage/>}/>
        <Route path="/wholesale" element={<WholesaleHub/>}/>
        <Route path="/wholesale/supplier/:id" element={<WholesaleStorefront/>}/>
        <Route path="/export" element={<ExportPage/>}/>
        <Route path="/directory" element={<BusinessDirectoryPage/>}/>
        <Route path="/directory/:id" element={<BusinessProfilePage/>}/>
        <Route path="/biz-dashboard" element={<BizDashboardPage/>}/>
        <Route path="/farmers/join" element={<FarmerJoinPage/>}/>
        <Route path="/animals" element={<AnimalMarketPage/>}/>
        <Route path="/animals/register" element={<AnimalSellerRegPage/>}/>
        <Route path="/realestate" element={<RealEstatePage/>}/>
        <Route path="/realestate/list" element={<RealEstateListPage/>}/>
        <Route path="/export/register" element={<ExportRegPage/>}/>
        <Route path="/delivery" element={<DeliveryPage/>}/>
        <Route path="/driver/register" element={<DriverRegisterPage/>}/>
        <Route path="/driver/dashboard" element={<DriverDashboardPage/>}/>
        <Route path="/delivery/track/:orderId" element={<BuyerTrackingPage/>}/>
        <Route path="/admin/delivery" element={<AdminDeliveryPage/>}/>
        <Route path="/seller/dashboard" element={<SellerDashboardPage auth={auth}/>}/>
        <Route path="/account" element={<BuyerDashboardPage auth={auth}/>}/>
        <Route path="/animals/dashboard" element={<AnimalDashboardPage/>}/>
        <Route path="/realestate/dashboard" element={<RealEstateDashboardPage/>}/>
        <Route path="/admin" element={<MallAdminPage/>}/>
        <Route path="/admin/review" element={<MallAdminPage/>}/>
        <Route path="/payment/callback" element={<PesapalCallbackPage/>}/>
        <Route path="*" element={<LandingPage cart={cart}/>}/>
      </Routes>
      <Footer/>
      </ChatProvider>
    </BrowserRouter>
  );
}
