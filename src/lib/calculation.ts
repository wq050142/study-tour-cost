import { ProjectData, CostSummary, DailyCostBreakdown, DEFAULT_MEAL_CONFIG } from '@/types';

// 计算单餐费用
function calculateMealAmount(
  mealConfig: { clientMealType?: string; tableCount?: number; staffMealType?: string; amount?: number },
  coreConfig: ProjectData['coreConfig'],
  totalClients: number,
  totalStaff: number
): number {
  // 如果有手动输入的金额，直接使用
  if (mealConfig.amount && mealConfig.amount > 0) {
    return mealConfig.amount;
  }
  
  // 客户餐费
  const clientMealType = mealConfig.clientMealType || 'individual';
  const clientAmount = clientMealType === 'table'
    ? (coreConfig.mealStandardClient || 0) * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
    : (coreConfig.mealStandardClient || 0) * totalClients;
  
  // 工作人员餐费
  const staffAmount = mealConfig.staffMealType === 'independent'
    ? (coreConfig.mealStandardStaff || 0) * totalStaff
    : 0;
  
  return clientAmount + staffAmount;
}

// 计算成本汇总
export function calculateCostSummary(data: ProjectData): CostSummary {
  const { coreConfig, dailyExpenses, otherExpenses } = data;
  
  // 计算总人数
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = 
    coreConfig.staffCounts.guide + 
    coreConfig.staffCounts.photographer + 
    coreConfig.staffCounts.videographer + 
    coreConfig.staffCounts.driver;
  
  // 计算住宿费用
  // 客户住宿费用（双床房 + 大床房）
  const clientTwinRoomTotal = (coreConfig.twinRoom?.price || 0) * (coreConfig.twinRoom?.countClient || 0) * coreConfig.accommodationDays;
  const clientKingRoomTotal = (coreConfig.kingRoom?.price || 0) * (coreConfig.kingRoom?.countClient || 0) * coreConfig.accommodationDays;
  
  // 工作人员住宿费用
  const staffAccommodationTotal = coreConfig.staffAccommodation
    ? (coreConfig.staffRoomPrice || 0) * Math.ceil(totalStaff / 2) * (coreConfig.staffAccommodationNights || 0)
    : 0;
  
  const totalAccommodation = clientTwinRoomTotal + clientKingRoomTotal + staffAccommodationTotal;
  
  // 计算用餐费用（中餐 + 晚餐）
  let totalMeal = 0;
  dailyExpenses.forEach(day => {
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    totalMeal += calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    totalMeal += calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
  });
  
  // 计算交通费用（大巴全程费用，含司机薪资，不乘天数）
  const totalBus = coreConfig.busFee;
  
  // 计算工作人员费用（不含司机，司机薪资已包含在大巴费用中）
  let totalStaffFee = 0;
  dailyExpenses.forEach(day => {
    totalStaffFee += 
      day.staffFees.guide * coreConfig.staffCounts.guide +
      day.staffFees.photographer * coreConfig.staffCounts.photographer +
      day.staffFees.videographer * coreConfig.staffCounts.videographer;
    // 司机薪资不单独计算，已包含在大巴费中
  });
  
  // 计算单项费用
  let totalSingleItems = 0;
  dailyExpenses.forEach(day => {
    day.singleItems.forEach(item => {
      totalSingleItems += item.totalPrice || (item.price * item.count);
    });
  });
  
  // 计算其他费用
  const totalOtherExpenses = 
    otherExpenses.insurance +
    otherExpenses.serviceFee +
    otherExpenses.reserveFund +
    otherExpenses.materialFee +
    otherExpenses.giftFee +
    otherExpenses.other;
  
  // 计算总成本
  const totalCost = 
    totalAccommodation +
    totalMeal +
    totalBus +
    totalStaffFee +
    totalSingleItems +
    totalOtherExpenses;
  
  // 计算人均成本（按客户人数）
  const avgCostPerClient = totalClients > 0 ? totalCost / totalClients : 0;
  
  // 计算每日明细
  const dailyBreakdown: DailyCostBreakdown[] = dailyExpenses.map(day => {
    const dayStaffFee = 
      day.staffFees.guide * coreConfig.staffCounts.guide +
      day.staffFees.photographer * coreConfig.staffCounts.photographer +
      day.staffFees.videographer * coreConfig.staffCounts.videographer;
    
    const daySingleItems = day.singleItems.reduce((sum, item) => 
      sum + (item.totalPrice || item.price * item.count), 0);
    
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
    
    const dailyTotal = 
      day.accommodation + 
      lunchAmount + 
      dinnerAmount + 
      dayStaffFee + 
      daySingleItems;
    
    return {
      day: day.day,
      accommodation: day.accommodation,
      lunch: lunchAmount,
      dinner: dinnerAmount,
      staffFee: dayStaffFee,
      singleItems: daySingleItems,
      dailyTotal,
    };
  });
  
  return {
    totalClients,
    totalStaff,
    totalAccommodation,
    totalMeal,
    totalBus,
    totalStaffFee,
    totalSingleItems,
    totalOtherExpenses,
    totalCost,
    avgCostPerClient,
    dailyBreakdown,
  };
}

// 格式化金额
export function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

// 生成初始每日费用数据
export function generateInitialDailyExpenses(tripDays: number, accommodationDays: number) {
  return Array.from({ length: tripDays }, (_, index) => ({
    day: index + 1,
    accommodation: index < accommodationDays ? 0 : 0,
    lunch: { ...DEFAULT_MEAL_CONFIG, restaurantName: '' },
    dinner: { ...DEFAULT_MEAL_CONFIG, restaurantName: '' },
    staffFees: {
      guide: 0,
      photographer: 0,
      videographer: 0,
      driver: 0,
    },
    singleItems: [],
  }));
}
