import type { MapItem } from '../type';
import addCampusId from '../utils/addCampusId';

const items = addCampusId('e', [
  {
    id: 'e_teaching_01',
    name: '教学楼A栋',
    category: 'teaching',
    coord: [106.811052, 29.739938],
    desc: '卓越工程师学院教学楼',
  },
  {
    id: 'e_teaching_02',
    name: '教学楼B栋',
    category: 'teaching',
    coord: [106.810559, 29.739415],
    desc: '卓越工程师学院教学楼',
  },
  {
    id: 'e_teaching_03',
    name: '教学楼C栋',
    category: 'teaching',
    coord: [106.810276, 29.739832],
    desc: '卓越工程师学院教学楼',
  },
  {
    id: 'e_dorm_01',
    name: '学生宿舍1栋',
    category: 'dormitory',
    coord: [106.807427, 29.739101],
  },
  {
    id: 'e_dorm_02',
    name: '学生宿舍2栋',
    category: 'dormitory',
    coord: [106.807657, 29.738741],
  },
  {
    id: 'e_canteen_01',
    name: '两江校区食堂',
    category: 'canteen',
    coord: [106.808541, 29.7406],
    desc: '校园食堂',
  },
  {
    id: 'e_sports_01',
    name: '两江校区运动场',
    category: 'sports',
    coord: [106.809396, 29.738322],
    desc: '田径与足球场',
  },
  {
    id: 'e_bus_station_01',
    name: '桐梓林轨道交通站',
    category: 'transit',
    coord: [106.815265, 29.741924],
    desc: '轨道交通4号线站点',
  },
] as const satisfies readonly Omit<MapItem, 'campusId'>[]);

export default items;
