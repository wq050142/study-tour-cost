import { ProjectData, CostSummary, DailyCostBreakdown } from '@/types';

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
  
  // 计算住宿费用（双床房 + 大床房）
  const twinRoomTotal = (coreConfig.twinRoom?.price || 0) * ((coreConfig.twinRoom?.countClient || 0) + (coreConfig.twinRoom?.countStaff || 0)) * coreConfig.accommodationDays;
  const kingRoomTotal = (coreConfig.kingRoom?.price || 0) * ((coreConfig.kingRoom?.countClient || 0) + (coreConfig.kingRoom?.countStaff || 0)) * coreConfig.accommodationDays;
  const totalAccommodation = twinRoomTotal + kingRoomTotal;
  
  // 计算用餐费用
  let totalMeal = 0;
  dailyExpenses.forEach(day => {
    totalMeal += day.meal;
  });
  
  // 如果没有每日用餐费用，使用餐标计算
  if (totalMeal === 0) {
    // 客户餐费：例餐按人数×餐标，桌餐按桌数×餐标×10
    const clientMealType = coreConfig.clientMealType || 'individual';
    const clientMealPerMeal = clientMealType === 'table'
      ? (coreConfig.mealStandardClient || 0) * 10 * (coreConfig.tableCount || Math.ceil(totalClients / 10))
      : (coreConfig.mealStandardClient || 0) * totalClients;
    
    // 工作人员餐费：随团用餐不计，独立用餐按人数×餐标
    const staffMealPerMeal = coreConfig.staffMealType === 'independent'
      ? (coreConfig.mealStandardStaff || 0) * totalStaff
      : 0;
    
    totalMeal = (clientMealPerMeal + staffMealPerMeal) * coreConfig.mealCountPerDay * coreConfig.tripDays;
  }
  
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
  
  // 计算团队费用
  let totalTeamExpenses = 0;
  dailyExpenses.forEach(day => {
    totalTeamExpenses += day.teamExpenses;
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
    totalTeamExpenses +
    totalOtherExpenses;
  
  // 计算人均成本（按客户人数）
  const avgCostPerClient = totalClients > 0 ? totalCost / totalClients : 0;
  
  // 计算每日明细
  const dailyBreakdown: DailyCostBreakdown[] = dailyExpenses.map(day => {
    const dayStaffFee = 
      day.staffFees.guide * coreConfig.staffCounts.guide +
      day.staffFees.photographer * coreConfig.staffCounts.photographer +
      day.staffFees.videographer * coreConfig.staffCounts.videographer;
    // 司机薪资不单独计算
    
    const daySingleItems = day.singleItems.reduce((sum, item) => 
      sum + (item.totalPrice || item.price * item.count), 0);
    
    const dailyTotal = 
      day.accommodation + 
      day.meal + 
      dayStaffFee + 
      daySingleItems + 
      day.teamExpenses;
    
    return {
      day: day.day,
      accommodation: day.accommodation,
      meal: day.meal,
      staffFee: dayStaffFee,
      singleItems: daySingleItems,
      teamExpenses: day.teamExpenses,
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
    totalTeamExpenses,
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
    meal: 0,
    staffFees: {
      guide: 0,
      photographer: 0,
      videographer: 0,
      driver: 0,
    },
    singleItems: [],
    teamExpenses: 0,
  }));
}
