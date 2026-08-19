import type { MapItem } from '../type';
import addCampusId from '../utils/addCampusId';

const items = addCampusId('b', [
  {
    id: 'b_teaching_01',
    name: '第二综合楼',
    category: 'teaching',
    coord: [106.461484, 29.566761],
    desc: 'B校园主要公共教学楼',
  },
  {
    id: 'b_teaching_02',
    name: '第一综合楼',
    category: 'teaching',
    coord: [106.459751, 29.566117],
    desc: '教学与办公楼',
  },
  {
    id: 'b_teaching_03',
    name: '建工馆',
    category: 'teaching',
    coord: [106.461012, 29.567465],
    desc: 'B校园标志性教学建筑',
  },
  {
    id: 'b_library_01',
    name: 'B区图书馆',
    category: 'library',
    coord: [106.460531, 29.566551],
    desc: 'B校园图书馆',
  },
  {
    id: 'b_college_01',
    name: '建筑城规学院',
    category: 'college',
    coord: [106.461622, 29.568165],
  },
  {
    id: 'b_college_02',
    name: '管理科学与房地产学院',
    category: 'college',
    coord: [106.460562, 29.565734],
  },
  {
    id: 'b_college_03',
    name: '材料楼',
    category: 'college',
    coord: [106.462484, 29.567367],
    desc: '材料相关教学科研楼',
  },
  {
    id: 'b_hospital_01',
    name: 'B区校医院',
    category: 'hospital',
    coord: [106.462545, 29.567922],
    desc: 'B校园医疗服务点',
  },
  {
    id: 'b_sports_01',
    name: 'B区足球场',
    category: 'sports',
    coord: [106.459923, 29.567912],
    desc: '田径与足球场',
  },
  {
    id: 'b_canteen_01',
    name: '学生二食堂',
    category: 'canteen',
    coord: [106.458829, 29.564575],
    desc: 'B校园主要食堂',
  },
  {
    id: 'b_dorm_01',
    name: '学生三舍',
    category: 'dormitory',
    coord: [106.457658, 29.564653],
  },
  {
    id: 'b_dorm_02',
    name: '学生四舍',
    category: 'dormitory',
    coord: [106.456967, 29.564928],
  },
  {
    id: 'b_transit_01',
    name: '重庆大学轨道交通站',
    category: 'transit',
    coord: [106.463616, 29.568332],
    desc: '轨道交通环线站点',
  },
  {
    id: 'b_food_01',
    name: '黑娃餐馆(重大B区店)',
    category: 'food',
    coord: [106.459129, 29.563863],
    desc: '重大B区附近餐馆',
    comment: [{ detail: '好吃，味道足' }],
  },
  {
    id: 'b_food_02',
    name: '诗熠烤米线',
    category: 'food',
    coord: [106.46306, 29.568446],
    desc: '重大B区校门附近烤米线店',
    comment: [
      {
        author: '巧克力大王',
        detail:
          '这家店在重大B区大门对面，或许是重庆唯一一家烤米线，做法比较有特色，是用锡纸包裹米线及其他食材进行烤制，口味偏咸香，卫生条件堪忧但味道不错',
      },
    ],
  },
] as const satisfies readonly Omit<MapItem, 'campusId'>[]);

export default items;
