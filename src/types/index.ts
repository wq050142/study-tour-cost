// 项目类型
export type ProjectType = 'half-day' | 'one-day' | 'multi-day';

// 住宿标准类型
export type AccommodationType = '3-diamond' | '4-diamond' | '5-diamond' | 'camp';

// 工作人员用餐方式
export type StaffMealType = 'with-group' | 'independent'; // 随团用餐 | 独立用餐

// 客户用餐方式
export type ClientMealType = 'table' | 'individual'; // 桌餐 | 例餐

// 每餐配置
export interface MealConfig {
  clientMealType: ClientMealType; // 客户用餐方式：桌餐或例餐
  tableCount: number; // 桌餐桌数（仅桌餐时使用）
  clientCount: number; // 客户用餐人数（例餐时使用，参考客户配置）
  pricePerPerson: number; // 单价（元/人），参考客户配置，可修改
  staffMealType: StaffMealType; // 工作人员用餐方式
  amount: number; // 实际金额（可手动修改）
  restaurantName: string; // 餐厅名称备注
  quoteAmount?: number; // 报价金额（可手动修改，默认等于 amount）
}

// 项目基础信息
export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

// 房型配置
export interface RoomConfig {
  price: number; // 房间单价
  countClient: number; // 客户房间数
  countStaff: number; // 工作人员房间数
  quotePrice?: number; // 报价单价（可手动修改，默认等于 price）
}

// 工作人员配置（动态）
export interface StaffMember {
  id: string;
  name: string; // 角色名称，如：导游、摄影、摄像等
  count: number; // 人数
  dailyFee: number; // 日薪
}

// 核心信息配置
export interface CoreConfig {
  // 客户人员
  studentCount: number;
  parentCount: number;
  teacherCount: number;
  
  // 工作人员（动态数组）
  staffMembers: StaffMember[];
  
  // 行程信息
  tripDays: number;
  accommodationDays: number;
  
  // 住宿信息 - 按房型分开
  accommodationType: AccommodationType; // 住宿标准：3钻、4钻、5钻、营地
  twinRoom: RoomConfig; // 双床房
  kingRoom: RoomConfig; // 大床房
  
  // 工作人员住宿配置
  staffAccommodation: boolean; // 工作人员是否住宿
  staffAccommodationNights: number; // 工作人员住宿晚数
  staffRoomType: 'twin' | 'king'; // 工作人员床型：双床或大床
  staffRoomPrice: number; // 工作人员房间单价
  
  // 用餐 - 仅保留餐标
  mealStandardClient: number; // 客户每正餐人均餐费
  mealStandardStaff: number; // 工作人员每正餐人均餐费（独立用餐时使用）
  
  // 交通
  busFee: number; // 大巴车包车费用（含司机薪资）
  busQuoteFee?: number; // 大巴报价（可手动修改，默认等于 busFee）
  // 其他交通方式（飞机、高铁等）
  otherTransports: TransportItem[];
}

// 交通方式项
export interface TransportItem {
  id: string;
  type: 'flight' | 'train'; // 飞机 | 高铁
  price: number; // 成本单价
  count: number; // 数量
  quotePrice?: number; // 报价单价（可手动修改，默认等于 price）
}

// 单项费用项目
export interface SingleItem {
  id: string;
  name: string; // 项目名称
  remark: string; // 备注说明
  startTime: string; // 开始时间，格式 HH:mm
  endTime: string; // 结束时间，格式 HH:mm
  price: number; // 成本单价
  count: number; // 数量
  unit: '人' | '团' | '组' | '辆' | '间'; // 单位
  totalPrice: number; // 总价
  quotePrice?: number; // 报价单价（可手动修改，默认等于 price）
  quoteTotalPrice?: number; // 报价总价（可手动修改，默认等于 quotePrice * count）
}

// 每日费用
export interface DailyExpense {
  day: number; // 第几天
  date?: string; // 日期
  
  // 固定费用
  accommodation: number; // 住宿费用
  lunch: MealConfig; // 中餐
  dinner: MealConfig; // 晚餐
  
  // 工作人员费用（按角色ID存储日薪）
  staffFees: Record<string, number>;
  
  // 单项费用（门票、活动等）
  singleItems: SingleItem[];
}

// 保险费用配置
export interface InsuranceConfig {
  pricePerPerson: number; // 元/人/天
  days: number; // 天数
  totalAmount: number; // 总价（可手动修改）
}

// 物料费用项
export interface MaterialItem {
  id: string;
  name: string; // 物料名称
  price: number; // 单价
  quantity: number; // 数量
  totalPrice: number; // 总价
}

// 其他费用项
export interface OtherExpenseItem {
  id: string;
  remark: string; // 备注
  amount: number; // 金额
}

// 其他费用
export interface OtherExpenses {
  insurance: InsuranceConfig; // 保险费
  serviceFeePercent: number; // 服务费百分比
  reserveFund: number; // 备用金
  materials: MaterialItem[]; // 物料费列表
  otherExpenses: OtherExpenseItem[]; // 其他费用列表
}

// 项目完整数据
export interface ProjectData {
  project: Project;
  coreConfig: CoreConfig;
  dailyExpenses: DailyExpense[];
  otherExpenses: OtherExpenses;
}

// 成本汇总
export interface CostSummary {
  // 人员统计
  totalClients: number; // 客户总人数
  totalStaff: number; // 工作人员总人数
  
  // 费用明细
  totalAccommodation: number; // 总住宿费用
  totalMeal: number; // 总用餐费用
  totalBus: number; // 总交通费用
  totalStaffFee: number; // 总工作人员费用
  totalSingleItems: number; // 总单项费用
  totalOtherExpenses: number; // 总其他费用
  
  // 总成本
  totalCost: number;
  
  // 人均成本
  avgCostPerClient: number;
  
  // 每日明细
  dailyBreakdown: DailyCostBreakdown[];
}

// 每日成本明细
export interface DailyCostBreakdown {
  day: number;
  accommodation: number;
  lunch: number;
  dinner: number;
  staffFee: number;
  singleItems: number;
  dailyTotal: number;
}

// 默认餐食配置
export const DEFAULT_MEAL_CONFIG: MealConfig = {
  clientMealType: 'table', // 客户默认桌餐
  tableCount: 0,
  clientCount: 0, // 客户用餐人数
  pricePerPerson: 0, // 单价
  staffMealType: 'with-group', // 工作人员默认随团用餐
  amount: 0,
  restaurantName: '', // 餐厅名称
};

// 默认工作人员配置
export const DEFAULT_STAFF_MEMBERS: StaffMember[] = [
  { id: 'guide', name: '导游', count: 0, dailyFee: 0 },
  { id: 'photographer', name: '摄影', count: 0, dailyFee: 0 },
  { id: 'videographer', name: '摄像', count: 0, dailyFee: 0 },
  { id: 'driver', name: '司机', count: 0, dailyFee: 0 },
];

// 默认值
export const DEFAULT_CORE_CONFIG: CoreConfig = {
  studentCount: 0,
  parentCount: 0,
  teacherCount: 0,
  staffMembers: [...DEFAULT_STAFF_MEMBERS],
  tripDays: 1,
  accommodationDays: 0,
  accommodationType: '3-diamond',
  twinRoom: {
    price: 0,
    countClient: 0,
    countStaff: 0,
  },
  kingRoom: {
    price: 0,
    countClient: 0,
    countStaff: 0,
  },
  staffAccommodation: false, // 工作人员默认不住宿
  staffAccommodationNights: 0,
  staffRoomType: 'twin',
  staffRoomPrice: 0,
  mealStandardClient: 0,
  mealStandardStaff: 0,
  busFee: 0,
  otherTransports: [],
};

export const DEFAULT_INSURANCE_CONFIG: InsuranceConfig = {
  pricePerPerson: 0,
  days: 1,
  totalAmount: 0,
};

export const DEFAULT_OTHER_EXPENSES: OtherExpenses = {
  insurance: { ...DEFAULT_INSURANCE_CONFIG },
  serviceFeePercent: 10, // 默认10%
  reserveFund: 0,
  materials: [],
  otherExpenses: [],
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  'half-day': '半日',
  'one-day': '一日',
  'multi-day': '多日',
};

export const ACCOMMODATION_TYPE_LABELS: Record<AccommodationType, string> = {
  '3-diamond': '3钻',
  '4-diamond': '4钻',
  '5-diamond': '5钻',
  'camp': '营地',
};

// 兼容旧数据迁移
export const DEFAULT_STAFF_FEES = {
  guide: 0,
  photographer: 0,
  videographer: 0,
  driver: 0,
};
