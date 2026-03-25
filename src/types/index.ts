// 项目类型
export type ProjectType = 'half-day' | 'one-day' | 'multi-day';

// 住宿标准类型
export type AccommodationType = '3-diamond' | '4-diamond' | '5-diamond' | 'camp';

// 工作人员类型
export type StaffType = 'guide' | 'photographer' | 'videographer' | 'driver';

// 工作人员用餐方式
export type StaffMealType = 'with-group' | 'independent'; // 随团用餐 | 独立用餐

// 客户用餐方式
export type ClientMealType = 'table' | 'individual'; // 桌餐 | 例餐

// 每餐配置
export interface MealConfig {
  clientMealType: ClientMealType; // 客户用餐方式：桌餐或例餐
  tableCount: number; // 桌餐桌数（仅桌餐时使用）
  staffMealType: StaffMealType; // 工作人员用餐方式
  amount: number; // 实际金额（可手动修改）
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
}

// 核心信息配置
export interface CoreConfig {
  // 客户人员
  studentCount: number;
  parentCount: number;
  teacherCount: number;
  
  // 工作人员
  staffCounts: {
    guide: number;
    photographer: number;
    videographer: number;
    driver: number;
  };
  
  // 工作人员日薪资参考
  staffDailyFees: StaffFeeConfig;
  
  // 行程信息
  tripDays: number;
  accommodationDays: number;
  
  // 住宿信息 - 按房型分开
  accommodationType: AccommodationType; // 住宿标准：3钻、4钻、5钻、营地
  twinRoom: RoomConfig; // 双床房
  kingRoom: RoomConfig; // 大床房
  
  // 用餐 - 仅保留餐标
  mealStandardClient: number; // 客户每正餐人均餐费
  mealStandardStaff: number; // 工作人员每正餐人均餐费（独立用餐时使用）
  
  // 交通
  busFee: number; // 大巴车包车费用（含司机薪资）
}

// 工作人员费用配置
export interface StaffFeeConfig {
  guide: number; // 导游领队日薪
  photographer: number; // 摄影师日薪
  videographer: number; // 摄像师日薪
  driver: number; // 司机日薪
}

// 单项费用项目
export interface SingleItem {
  id: string;
  name: string;
  price: number; // 单价
  count: number; // 数量
  totalPrice: number; // 总价
}

// 每日费用
export interface DailyExpense {
  day: number; // 第几天
  date?: string; // 日期
  
  // 固定费用
  accommodation: number; // 住宿费用
  lunch: MealConfig; // 中餐
  dinner: MealConfig; // 晚餐
  
  // 工作人员费用
  staffFees: StaffFeeConfig;
  
  // 单项费用（门票、活动等）
  singleItems: SingleItem[];
  
  // 团队费用（一次性费用，如场地租赁等）
  teamExpenses: number;
}

// 其他费用
export interface OtherExpense {
  insurance: number; // 保险费（总额）
  serviceFee: number; // 服务费
  reserveFund: number; // 备用金
  materialFee: number; // 物料费
  giftFee: number; // 礼品费
  other: number; // 其他费用
}

// 项目完整数据
export interface ProjectData {
  project: Project;
  coreConfig: CoreConfig;
  dailyExpenses: DailyExpense[];
  otherExpenses: OtherExpense;
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
  totalTeamExpenses: number; // 总团队费用
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
  teamExpenses: number;
  dailyTotal: number;
}

// 默认餐食配置
export const DEFAULT_MEAL_CONFIG: MealConfig = {
  clientMealType: 'individual',
  tableCount: 0,
  staffMealType: 'with-group',
  amount: 0,
};

// 默认值
export const DEFAULT_CORE_CONFIG: CoreConfig = {
  studentCount: 0,
  parentCount: 0,
  teacherCount: 0,
  staffCounts: {
    guide: 0,
    photographer: 0,
    videographer: 0,
    driver: 0,
  },
  staffDailyFees: {
    guide: 0,
    photographer: 0,
    videographer: 0,
    driver: 0,
  },
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
  mealStandardClient: 0,
  mealStandardStaff: 0,
  busFee: 0,
};

export const DEFAULT_STAFF_FEES: StaffFeeConfig = {
  guide: 0,
  photographer: 0,
  videographer: 0,
  driver: 0,
};

export const DEFAULT_OTHER_EXPENSES: OtherExpense = {
  insurance: 0,
  serviceFee: 0,
  reserveFund: 0,
  materialFee: 0,
  giftFee: 0,
  other: 0,
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
