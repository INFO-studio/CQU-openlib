import type { MapItem } from '../type';
import addCampusId from '../utils/addCampusId';

const items = addCampusId('a', [
  {
    id: 'a_teaching_01',
    name: '主教学楼',
    category: 'teaching',
    coord: [106.470635, 29.565793],
    desc: '用于行政办公和上课',
  },
  {
    id: 'a_teaching_02',
    name: '第一教学楼',
    category: 'teaching',
    coord: [106.468608, 29.568038],
  },
  {
    id: 'a_teaching_03',
    name: '第二教学楼',
    category: 'teaching',
    coord: [106.467702, 29.569261],
  },
  {
    id: 'a_teaching_04',
    name: '第三教学楼/资源与安全学院',
    category: 'teaching',
    coord: [106.467702, 29.569261],
  },
  {
    id: 'a_teaching_05',
    name: '第四教学楼/离退休工作处',
    category: 'teaching',
    coord: [106.46549, 29.568574],
  },
  {
    id: 'a_teaching_06',
    name: '第五教学楼',
    category: 'teaching',
    coord: [106.466938, 29.566302],
    desc: '主要教学楼之一',
  },
  {
    id: 'a_teaching_07',
    name: '第六教学楼',
    category: 'teaching',
    coord: [106.466247, 29.564607],
  },
  {
    id: 'a_teaching_08',
    name: '第七教学楼',
    category: 'teaching',
    coord: [106.468115, 29.568509],
    desc: '原机械与运载工程学院楼，现已搬迁至科学中心',
  },
  {
    id: 'a_teaching_09',
    name: '第八教学楼',
    category: 'teaching',
    coord: [106.465483, 29.566393],
    desc: '主要教学楼之一',
  },
  {
    id: 'a_dorm_01',
    name: '学生一宿舍',
    category: 'dormitory',
    coord: [106.467148, 29.56402],
    desc: '装修中',
  },
  {
    id: 'a_dorm_02',
    name: '学生二宿舍',
    category: 'dormitory',
    coord: [106.467793, 29.56352],
    desc: '装修中',
  },
  {
    id: 'a_dorm_03',
    name: '学生三宿舍',
    category: 'dormitory',
    coord: [106.468535, 29.563045],
  },
  {
    id: 'a_dorm_04',
    name: '学生四宿舍',
    category: 'dormitory',
    coord: [106.469166, 29.562623],
  },
  {
    id: 'a_dorm_05',
    name: '学生五宿舍',
    category: 'dormitory',
    coord: [106.469151, 29.560881],
  },
  {
    id: 'a_dorm_06',
    name: '学生六宿舍',
    category: 'dormitory',
    coord: [106.46916, 29.56169],
  },
  {
    id: 'a_dorm_07',
    name: '学生七宿舍',
    category: 'dormitory',
    coord: [106.466721, 29.562545],
  },
  {
    id: 'a_dorm_08',
    name: '学生八宿舍',
    category: 'dormitory',
    coord: [106.46735, 29.56302],
  },
  {
    id: 'a_dorm_09',
    name: '学生九宿舍',
    category: 'dormitory',
    coord: [106.469151, 29.560881],
  },
  {
    id: 'a_dorm_10',
    name: '学生十宿舍',
    category: 'dormitory',
    coord: [106.466898, 29.561764],
  },
  {
    id: 'a_dorm_11',
    name: '学生十一宿舍',
    category: 'dormitory',
    coord: [106.467705, 29.56232],
  },
  {
    id: 'a_dorm_12',
    name: '学生十二宿舍',
    category: 'dormitory',
    coord: [106.468227, 29.561993],
  },
  {
    id: 'a_dorm_13',
    name: '学生宿舍ACD楼',
    category: 'dormitory',
    coord: [106.467524, 29.561769],
  },
  {
    id: 'a_canteen_01',
    name: '学生一食堂',
    category: 'canteen',
    coord: [106.466877, 29.563312],
    desc: '一楼有麦当劳',
  },
  {
    id: 'a_canteen_02',
    name: '民主湖食堂（学生四食堂）',
    category: 'canteen',
    coord: [106.46868, 29.562435],
  },
  {
    id: 'a_canteen_03',
    name: '柏树林食堂（学生三食堂）',
    category: 'canteen',
    coord: [106.469893, 29.560915],
  },
  {
    id: 'a_canteen_04',
    name: '东林教工食堂',
    category: 'canteen',
    coord: [106.464602, 29.56578],
  },
  {
    id: 'a_canteen_05',
    name: '新华园食堂',
    category: 'canteen',
    coord: [106.467374, 29.56991],
  },
  {
    id: 'a_library_01',
    name: 'A区图书馆',
    category: 'library',
    coord: [106.46834, 29.565402],
    desc: '设有多层自习区与研讨室',
  },
  {
    id: 'a_sports_01',
    name: '思群广场',
    category: 'sports',
    coord: [106.468322, 29.564328],
    desc: '室外操场，足球场',
  },
  {
    id: 'a_sports_02',
    name: '团结广场',
    category: 'sports',
    coord: [106.469169, 29.566284],
    desc: '室外操场，足球场',
  },
  {
    id: 'a_sports_03',
    name: '篮球场（靠近钟塔）',
    category: 'sports',
    coord: [106.468128, 29.567122],
  },
  {
    id: 'a_sports_04',
    name: '风雨操场',
    category: 'sports',
    coord: [106.471981, 29.564492],
    desc: '靠近体育馆',
  },
  {
    id: 'a_sports_05',
    name: '体育馆',
    category: 'sports',
    coord: [106.472226, 29.564279],
    desc: '可在重大后勤-场馆预约中预约羽毛球，乒乓球场地',
  },
  {
    id: 'a_sports_06',
    name: '篮球场/羽毛球场/网球场（靠近图书馆）',
    category: 'sports',
    coord: [106.466915, 29.56568],
    desc: '靠近图书馆的篮球场，羽毛球场和网球场',
  },
  {
    id: 'a_sports_07',
    name: '乒乓球场',
    category: 'sports',
    coord: [106.469415, 29.565071],
    desc: '室外场地，点位为近似位置',
  },
  {
    id: 'a_admin_01',
    name: '办公楼',
    category: 'admin',
    coord: [106.468748, 29.565564],
    desc: 'A区行政处',
  },
  {
    id: 'a_admin_02',
    name: '办公楼',
    category: 'admin',
    coord: [106.469015, 29.565397],
    desc: 'A区财务处，投递报销单的地方',
  },
  {
    id: 'a_gate_01',
    name: 'A区中门',
    category: 'gate',
    coord: [106.467012, 29.561711],
    desc: '靠近十舍；设门禁，午夜后关闭',
  },
  {
    id: 'a_gate_02',
    name: 'A区南一门',
    category: 'gate',
    coord: [106.470113, 29.55999],
    desc: '面向沙中路的出入口，这个门没有门禁，也可出入车辆',
  },
  {
    id: 'a_gate_03',
    name: 'A区东一门（柏树林门）',
    category: 'gate',
    coord: [106.472131, 29.561537],
    desc: '面向松林路的出入口',
  },
  {
    id: 'a_gate_04',
    name: 'A区东门（校医院门）',
    category: 'gate',
    coord: [106.472428, 29.562889],
    desc: '校医院旁边的门，进出校医院可走这里',
  },
  {
    id: 'a_gate_05',
    name: 'A区东南门（体育学院门）',
    category: 'gate',
    coord: [106.472673, 29.563667],
    desc: '靠近体育学院',
  },
  {
    id: 'a_gate_06',
    name: '江边电梯',
    category: 'gate',
    coord: [106.471948, 29.565361],
    desc: '可从这里进出校园，下电梯直达江边',
  },
  {
    id: 'a_gate_07',
    name: 'A区西北门',
    category: 'gate',
    coord: [106.465015, 29.570122],
  },
  {
    id: 'a_gate_08',
    name: 'A区正大门（正门）',
    category: 'gate',
    coord: [106.464181, 29.567418],
    desc: 'A校园正门',
  },
  {
    id: 'a_gate_09',
    name: 'A区后门（松林坡门）',
    category: 'gate',
    coord: [106.472394, 29.563486],
    desc: 'A校园松林坡门，往这里走下去有很多好吃的',
  },
  {
    id: 'a_hospital_01',
    name: '校医院',
    category: 'hospital',
    coord: [106.472216, 29.563117],
  },
  {
    id: 'a_bus_station_01',
    name: '后门校车站',
    category: 'bus_station',
    coord: [106.471154, 29.562414],
  },
  {
    id: 'a_bus_station_02',
    name: '钟塔校车站',
    category: 'bus_station',
    coord: [106.467243, 29.567197],
  },
  {
    id: 'a_landmark_01',
    name: '钟塔',
    category: 'landmark',
    coord: [106.467473, 29.567312],
  },
  {
    id: 'a_landmark_02',
    name: '防空洞爱国教育基地',
    category: 'landmark',
    coord: [106.46731, 29.56792],
  },
  {
    id: 'a_food_01',
    name: '中渡芋圆',
    category: 'food',
    coord: [106.472875, 29.564787],
    desc: 'A校园附近甜品店',
  },
  {
    id: 'a_food_02',
    name: '曾一刀私房牛肉面',
    category: 'food',
    coord: [106.462373, 29.558773],
    comment: [
      {
        author: '巧克力大王',
        detail:
          '这是重庆一三八高中生下课吃面的常驻地，笔者最推荐其原汤牛肉牛筋混合韭叶面加蛋，其中“原汤”并不指浅白色的牛骨汤，而是指浮于汤面上的那层微辣牛油，这是整碗面的精髓；单吃牛肉太柴，单吃牛筋太腻，牛肉牛筋混合这一搭配折中两者优缺，让吃面也不再单调；韭叶面由其形状酷似韭菜叶子得名，源于四川达州大竹县，其优点是在吃面时可裹上更多红油，牛油香味更浓；在吃面时煎蛋埋于碗底，面吃到一半时，煎蛋已吸饱汤汁，此时再吃味更美(๑´ڡ`๑)',
      },
    ],
  },
  {
    id: 'a_food_03',
    name: '吹得神豌杂面(小龙坎新街店)',
    category: 'food',
    coord: [106.464133, 29.558334],
    comment: [
      {
        author: '巧克力大王',
        detail:
          '这家店以干馏豌杂见长，笔者推荐干馏豌杂加蛋，是否加辣取决于个人，加不加辣都好吃。这家店的干馏豌杂面面条较粗，豌杂酱汁收得咸香浓稠，调料沉在碗底，因此吃前需要把面与调料拌匀（用重庆话说就是“霍转”），不然吃到最后会过咸，煎蛋需事先埋于碗底，这样最后吃到煎蛋时，煎蛋早已吸饱酱汁，吃起来更有味',
      },
    ],
  },
  {
    id: 'a_food_04',
    name: '毛烧烤(工人村店)',
    category: 'food',
    coord: [106.468068, 29.557186],
    comment: [
      {
        author: '巧克力大王',
        detail:
          '这是一家极具特色的烧烤店，点单方式类似麻辣烫，自行选菜然后让后厨加工。笔者推荐小芋头和蜜汁烤翅，这家店选用的芋头是重庆老芋仔，其历史最早可追溯至清朝晚期，个头小，口感顺滑，带有一丝奶香。烤制过后外层轻微失水，质地似镜面蛋糕的淋面，用嘴抿开表面，绵密微烫的芋头便裹挟着干辣椒与香葱化开在舌尖，这样的烤芋头在别处很难吃到。蜜汁烤翅也是一绝，后厨在烤制时会反复刷酱，鸡翅吃起来又香又甜又嫩，一个人至少要吃两串（四个鸡翅）才能吃得尽兴。吃这家烧烤时推荐配店里的大窑或街对面的蜜雪冰城',
      },
    ],
  },
  {
    id: 'a_food_05',
    name: 'Clean_Cup自烘焙咖啡店',
    category: 'food',
    coord: [106.463645, 29.563953],
    comment: [
      {
        author: '巧克力大王',
        detail:
          '位于欣阳广场旁小巷的深处，是一家自主烘焙咖啡豆的门店，店内装修风格温暖，有可爱的小猫。笔者推荐这家店的美式咖啡，这家店豆单一直在更新，豆子可凭自己喜好选择，在这家店喝咖啡，你能清晰地感受到精品咖啡的魅力，不同温度下咖啡的风味是清晰且不同的',
      },
    ],
  },
  {
    id: 'a_food_06',
    name: '沈姐烤鱼',
    category: 'food',
    coord: [106.463131, 29.570069],
    desc: '重庆七中附近烤鱼店',
    comment: [
      {
        author: '巧克力大王',
        detail:
          '相信坐过环线的同学们都听过沈姐烤鱼的广告，老校区这边的沈姐烤鱼位于重庆七中旁的巷子里。这家店的烤鱼好吃，干锅也不赖，笔者喜欢吃这家店的肥肠干锅，肥肠处理得很干净，切成小段，炒得肠皮微焦香气十足',
      },
    ],
  },
  {
    id: 'a_food_07',
    name: 'guoguo䴹果',
    category: 'food',
    coord: [106.463535, 29.564095],
    desc: '欣阳广场附近面包店',
    comment: [
      {
        author: '巧克力大王',
        detail:
          '就在cleancup coffee旁边，该店的抹茶制品做得十分出色，笔者推荐抹茶麻薯米面包，内馅是冰冰凉凉的抹茶奶油，外面裹着糯糯的鲜奶麻薯，最外层是很本分的，让人安心的米面包。推荐在这家面包店买点面包，然后到隔壁咖啡店坐着点杯咖啡消磨时光',
      },
    ],
  },
  {
    id: 'a_food_08',
    name: '大粽小吃',
    category: 'food',
    coord: [106.463533, 29.565155],
    desc: '沙坪坝小学附近小吃店',
    comment: [
      {
        author: '巧克力大王',
        detail:
          '是一家开在沙坪坝小学旁的老店，中国自古以来便有甜咸粽之争，但在这家店，双方可以和平共处，因为这家店有卖咸粽甜粽甚至白粽。作为咸粽党，笔者推荐咸蛋黄肉粽，个头大，粽子里有整颗咸蛋黄，肉是带有一定油脂的，油脂化开在糯米上，吃着很香',
      },
    ],
  },
  {
    id: 'a_food_09',
    name: '不养鱼咖啡',
    category: 'food',
    coord: [106.459993, 29.558256],
    desc: '南开步行街附近独立咖啡店',
    comment: [
      {
        author: '巧克力大王',
        detail:
          '这家店对初来的同学有点难找，位于南开步行街卤校长火锅背后的巷子里。这是一家一人经营的独立咖啡门店，老板是多年咖啡师，会详细向顾客介绍咖啡出品，咖啡价格较为合理，笔者推荐拿铁，这家店的特调比较出名，笔者还没喝过，或许值得一试',
      },
    ],
  },
  {
    id: 'a_transit_01',
    name: '重庆大学轨道交通站',
    category: 'transit',
    coord: [106.463616, 29.568332],
    desc: '轨道交通环线站点',
  },
  {
    id: 'a_express_01',
    name: 'A区邮政快递点',
    category: 'express',
    coord: [106.467409, 29.561742],
    desc: '邮政快递可以在这里拿取',
  },
  {
    id: 'a_express_02',
    name: 'A区主快递点',
    category: 'express',
    coord: [106.468178, 29.562029],
    desc: '顺丰/京东/圆通/申通/拼多多快递都可在这里拿取',
  },
] as const satisfies readonly Omit<MapItem, 'campusId'>[]);

export default items;
