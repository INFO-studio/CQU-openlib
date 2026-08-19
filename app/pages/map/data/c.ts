import type { MapItem } from '../type';
import addCampusId from '../utils/addCampusId';

const items = addCampusId('c', [
  {
    id: 'c_teaching_01',
    name: '第一教学楼',
    category: 'teaching',
    coord: [106.455036, 29.559969],
    desc: 'C校园公共教学楼',
  },
  {
    id: 'c_transit_01',
    name: '重庆大学轨道交通站',
    category: 'transit',
    coord: [106.463616, 29.568332],
    desc: '轨道交通环线站点',
  },
  {
    id: 'c_carstop_01',
    name: 'C区乘车点',
    category: 'bus_station',
    coord: [106.455649, 29.560364],
    desc: '可从这里坐车',
  },
] as const satisfies readonly Omit<MapItem, 'campusId'>[]);

export default items;
