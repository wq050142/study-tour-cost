// 项目类型
export type ProjectType = 'half-day' | 'one-day' | 'multi-day';

// 工作人员类型
export type StaffType = 'guide' | 'photographer' | 'videographer' | 'driver';

// 项目基础信息
export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  remark: string;
  createdAt: string;
  updatedAt: string;
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
  
  // 行程信息
  tripDays: number;
  accommodationDays: number;
  
  // 住宿信息
  hotelStar: number; // 1-5星
  roomPrice: number; // 房间单价
  roomCount: number;
  
  // 用餐
  mealStandard: number; // 每正餐人均餐费
  mealCountPerDay: number; // 每日用餐次数
  
  // 交通
  busFee: number; // 大巴车包车费用
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
  meal: number; // 用餐费用
  
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
  meal: number;
  staffFee: number;
  singleItems: number;
  teamExpenses: number;
  dailyTotal: number;
}

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
  tripDays: 1,
  accommodationDays: 0,
  hotelStar: 3,
  roomPrice: 0,
  roomCount: 0,
  mealStandard: 0,
  mealCountPerDay: 3,
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
