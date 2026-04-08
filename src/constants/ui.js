export const consoleMenus = [
  { key: "overview", label: "指挥中心", hint: "实时概览" },
  { key: "access", label: "出入管理", hint: "识别与闸机" },
  { key: "billing", label: "计费引擎", hint: "计费规则" },
  { key: "spaces", label: "车位管理", hint: "地图与预约" },
  { key: "finance", label: "财务审计", hint: "流水与报表" },
];

export const portalMenus = [
  { key: "overview", label: "服务概览", hint: "当前停车与提醒" },
  { key: "reservations", label: "预约车位", hint: "预约与到场信息" },
  { key: "coupons", label: "优惠券", hint: "权益与抵扣" },
  { key: "orders", label: "停车订单", hint: "账单与发票" },
  { key: "membership", label: "月租服务", hint: "套餐与续费" },
];

export const roleLabels = {
  admin: "管理端",
  merchant: "商户端",
  user: "用户端",
};

const spaceStatusLabels = {
  available: "空闲",
  occupied: "占用",
  reserved: "预约保留",
  monthly: "月租中",
};

const spaceTypeLabels = {
  temporary: "临停车位",
  fixed: "固定车位",
  vip: "VIP 车位",
};

export function getSpaceStatusLabel(status) {
  return spaceStatusLabels[status] || status || "--";
}

export function getSpaceTypeLabel(type) {
  return spaceTypeLabels[type] || type || "--";
}
