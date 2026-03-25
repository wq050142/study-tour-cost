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
  
  // 计算住宿费用
  const totalAccommodation = coreConfig.roomPrice * coreConfig.roomCount * coreConfig.accommodationDays;
  
  // 计算用餐费用
  let totalMeal = 0;
  dailyExpenses.forEach(day => {
    totalMeal += day.meal;
  });
  
  // 如果没有每日用餐费用，使用餐标计算
  if (totalMeal === 0 && coreConfig.mealStandard > 0) {
    totalMeal = coreConfig.mealStandard * coreConfig.mealCountPerDay * coreConfig.tripDays * (totalClients + totalStaff);
  }
  
  // 计算交通费用（大巴全程费用，不乘天数）
  const totalBus = coreConfig.busFee;
  
  // 计算工作人员费用
  let totalStaffFee = 0;
  dailyExpenses.forEach(day => {
    totalStaffFee += 
      day.staffFees.guide * coreConfig.staffCounts.guide +
      day.staffFees.photographer * coreConfig.staffCounts.photographer +
      day.staffFees.videographer * coreConfig.staffCounts.videographer +
      day.staffFees.driver * coreConfig.staffCounts.driver;
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
      day.staffFees.videographer * coreConfig.staffCounts.videographer +
      day.staffFees.driver * coreConfig.staffCounts.driver;
    
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
